import { useCallback, useEffect, useRef, useState } from 'react'

// --- Ambient types for the Web Speech API -------------------------------
// The Web Speech API isn't in lib.dom.d.ts, so we hand-declare just the
// slice we use rather than pull in @types/dom-speech-recognition (keeps the
// dependency list lean). Layer B (Whisper via a server function) will cover
// the browsers that don't expose this at all - see feature_voice_capture.
type SpeechAlternative = { readonly transcript: string }

type SpeechResult = {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechAlternative
}

type SpeechResultList = {
  readonly length: number
  readonly [index: number]: SpeechResult
}

type SpeechResultEvent = {
  readonly resultIndex: number
  readonly results: SpeechResultList
}

type SpeechErrorEvent = { readonly error: string; readonly message: string }

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onresult: ((e: SpeechResultEvent) => void) | null
  onerror: ((e: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}
// ------------------------------------------------------------------------

// Chrome ends a recognition session constantly - after a few seconds of
// silence, and again on its own internal session cap - so staying "on" through
// a whole idea means relaunching a fresh session each time it ends. start()
// throws InvalidStateError if the previous instance is still winding down, so
// the relaunch backs off and retries instead of giving up (which is what used
// to cut the mic mid-idea).
const MAX_RESTART_ATTEMPTS = 8 // consecutive *failed* relaunches before we stop
const RESTART_BASE_DELAY_MS = 120
const RESTART_MAX_DELAY_MS = 1500
// Transient network blips also end a session; retry a couple of times before
// treating "network" as the browser-doesn't-really-support-this signal.
const MAX_NETWORK_RETRIES = 3
// Sessions that heard nothing at all, back to back, before we assume the user
// has finished. Chrome gives up after roughly 7-8s of silence, so this is
// about a minute and a half of quiet - a long thinking pause survives it.
const MAX_SILENT_SESSIONS = 12

export type UseVoiceCapture = {
  supported: boolean
  listening: boolean
  transcript: string // finalized text accumulated this session
  interim: string // live words not yet finalized
  error: string | null
  // True when the mic stopped without the user asking it to (a long silence,
  // or a relaunch we could not recover). The captured text is intact - the UI
  // uses this to offer "resume" rather than silently ending the capture.
  droppedOut: boolean
  start: () => void
  stop: () => void
  reset: () => void
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

// Join two pieces of text on a single space, collapsing stray whitespace.
function joinText(a: string, b: string): string {
  return `${a} ${b}`.replace(/\s+/g, ' ').trim()
}

// Collapse a list of final segments, merging any segment that is just a longer
// re-statement of the one before it. Chrome (especially Android) re-reports a
// phrase as it grows by emitting each longer version as a *final* result, often
// at a new index: "okay", "okay here's", "okay here's my"... We keep only the
// longest of each such run. Segments with no prefix relationship are genuinely
// distinct and are all preserved. This is the de-duplication; doing it here -
// over the whole list each event - is what makes it robust to multiple growing
// segments in one session (the case the old per-string merge stacked instead).
function collapseGrowth(segments: string[]): string[] {
  const out: string[] = []
  for (const raw of segments) {
    const seg = raw.trim()
    if (!seg) continue
    const prev = out[out.length - 1]
    if (prev) {
      const prevLower = prev.toLowerCase()
      const segLower = seg.toLowerCase()
      if (segLower.startsWith(prevLower)) {
        out[out.length - 1] = seg // grew from the previous segment - replace it
        continue
      }
      if (prevLower.startsWith(segLower)) continue // shorter re-statement - drop
    }
    out.push(seg)
  }
  return out
}

// Default to en-GB to match the user's locale (UK date formatting elsewhere).
export function useVoiceCapture(lang = 'en-GB'): UseVoiceCapture {
  const [supported] = useState(() => getCtor() !== null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [droppedOut, setDroppedOut] = useState(false)

  const recRef = useRef<SpeechRecognitionLike | null>(null)
  // Mirrors `listening` for use inside event handlers, which close over a
  // stale state value. Drives the auto-restart-on-end behaviour below.
  const wantListeningRef = useRef(false)

  // `committedRef` holds finalized text from earlier sessions: the engine
  // wipes its `results` list between our auto-restarts, so onend folds each
  // finished session into it. `sessionFinalRef` holds the current session's
  // final text, which onresult rebuilds from scratch every event (see there).
  const committedRef = useRef('') // finalized text from previous sessions
  const sessionFinalRef = useRef('') // this session's final text, rebuilt per event

  // Relaunch bookkeeping. `restartAttempts` counts *consecutive failures* and
  // is cleared the moment a session actually starts, so an ordinary silence
  // loop never exhausts it. `silentSessions` counts sessions that produced no
  // words at all and is cleared by any result.
  const restartTimerRef = useRef<number | null>(null)
  const restartAttemptsRef = useRef(0)
  const networkRetriesRef = useRef(0)
  const silentSessionsRef = useRef(0)
  const heardThisSessionRef = useRef(false)
  // Set on the next launch by the handlers themselves; a ref because the
  // handlers are wired to one instance but must relaunch the *next* one.
  const launchRef = useRef<() => void>(() => {})

  const composeFinal = useCallback(() => {
    return joinText(committedRef.current, sessionFinalRef.current)
  }, [])

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    committedRef.current = ''
    sessionFinalRef.current = ''
    setTranscript('')
    setInterim('')
    setError(null)
    setDroppedOut(false)
  }, [])

  const stop = useCallback(() => {
    wantListeningRef.current = false
    clearRestartTimer()
    try {
      recRef.current?.stop()
    } catch {
      // stop() throws if recognition isn't running - safe to ignore.
    }
    setListening(false)
  }, [clearRestartTimer])

  // Give up on staying live, but keep everything captured so far and flag it
  // so the UI can offer a one-tap resume.
  const dropOut = useCallback(() => {
    wantListeningRef.current = false
    clearRestartTimer()
    setTranscript(committedRef.current)
    setInterim('')
    setListening(false)
    setDroppedOut(true)
  }, [clearRestartTimer])

  const scheduleRestart = useCallback(() => {
    if (!wantListeningRef.current) return
    if (restartAttemptsRef.current >= MAX_RESTART_ATTEMPTS) {
      dropOut()
      return
    }
    const delay = Math.min(
      RESTART_BASE_DELAY_MS * 2 ** restartAttemptsRef.current,
      RESTART_MAX_DELAY_MS,
    )
    restartAttemptsRef.current += 1
    clearRestartTimer()
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null
      launchRef.current()
    }, delay)
  }, [clearRestartTimer, dropOut])

  // Build a recognition instance, wire it up and start it. Called for the
  // first session and for every automatic relaunch after that.
  const launch = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) {
      setError('Voice capture is not supported in this browser.')
      setListening(false)
      return
    }

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onstart = () => {
      // The engine is genuinely live again, so the failure streak is over.
      restartAttemptsRef.current = 0
      heardThisSessionRef.current = false
      setDroppedOut(false)
      setListening(true)
    }

    rec.onresult = (event) => {
      // Rebuild from the full results list every event rather than appending
      // deltas. `event.results` is the engine's authoritative, index-stable
      // record for this session, so walking it from 0 is idempotent no matter
      // how Chrome batches, re-orders or re-reports results - which is what
      // makes the de-duplication reliable. (Appending each incoming final, as
      // we used to, stacked the whole growing phrase once a session produced
      // more than one segment - the intermittent duplication bug.)
      const finals: string[] = []
      let interimChunk = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          finals.push(text)
        } else {
          interimChunk += text
        }
      }
      // Words are flowing: this session is productive and the connection is
      // healthy, so clear both give-up counters.
      heardThisSessionRef.current = true
      silentSessionsRef.current = 0
      networkRetriesRef.current = 0
      sessionFinalRef.current = collapseGrowth(finals).join(' ')
      setTranscript(composeFinal())
      setInterim(interimChunk.replace(/\s+/g, ' ').trim())
    }

    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // Benign - onend will relaunch if we're still meant to be listening.
        return
      }
      if (event.error === 'network' && networkRetriesRef.current < MAX_NETWORK_RETRIES) {
        // Chrome's recognition is cloud-backed, so a momentary blip ends the
        // session. Let onend relaunch rather than killing the whole capture.
        networkRetriesRef.current += 1
        return
      }
      // Everything else is fatal for this session: stop and let the modal
      // fall back to the editable text box so the user can type.
      wantListeningRef.current = false
      clearRestartTimer()
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access was blocked. Allow it in your browser to use voice.')
      } else if (event.error === 'network') {
        setError(
          "Voice recognition isn't available in this browser - it works best in " +
            'Chrome (desktop or Android). You can type your idea instead; a built-in ' +
            'fallback for other browsers is coming.',
        )
      } else {
        setError(`Voice capture error: ${event.error}.`)
      }
      setListening(false)
      setDroppedOut(true)
    }

    rec.onend = () => {
      // Fold this session's merged final text into the committed base and
      // clear it, because the engine starts fresh on the next start().
      committedRef.current = composeFinal()
      sessionFinalRef.current = ''

      if (!wantListeningRef.current) {
        setTranscript(committedRef.current)
        setInterim('')
        setListening(false)
        return
      }

      // A session that heard nothing is a silence timeout. Keep relaunching
      // through an ordinary thinking pause, but stop eventually rather than
      // holding the mic (and the wake lock) open all day.
      if (heardThisSessionRef.current) {
        silentSessionsRef.current = 0
      } else if (++silentSessionsRef.current >= MAX_SILENT_SESSIONS) {
        dropOut()
        return
      }

      setInterim('')
      scheduleRestart()
    }

    recRef.current = rec
    try {
      rec.start()
    } catch {
      // start() throws if the previous instance is still winding down. Backing
      // off and retrying is the fix for the mic dying part-way through an
      // idea; the old code gave up here on the first throw.
      scheduleRestart()
    }
  }, [lang, composeFinal, clearRestartTimer, dropOut, scheduleRestart])

  // Handlers relaunch through this ref so they always reach the current
  // `launch` closure, not the one captured when their instance was built.
  useEffect(() => {
    launchRef.current = launch
  }, [launch])

  // Begin (or resume) capturing. Text already committed is kept, so calling
  // start() after a drop-out continues the same note rather than replacing it.
  const start = useCallback(() => {
    if (!getCtor()) {
      setError('Voice capture is not supported in this browser.')
      return
    }
    if (wantListeningRef.current) return

    clearRestartTimer()
    restartAttemptsRef.current = 0
    networkRetriesRef.current = 0
    silentSessionsRef.current = 0
    wantListeningRef.current = true
    setError(null)
    setInterim('')
    setDroppedOut(false)
    setListening(true)
    launch()
  }, [clearRestartTimer, launch])

  // Abort cleanly if the component unmounts mid-capture.
  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current)
      try {
        recRef.current?.abort()
      } catch {
        // ignore
      }
    }
  }, [])

  return { supported, listening, transcript, interim, error, droppedOut, start, stop, reset }
}
