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

export type UseVoiceCapture = {
  supported: boolean
  listening: boolean
  transcript: string // finalized text accumulated this session
  interim: string // live words not yet finalized
  error: string | null
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

  const composeFinal = useCallback(() => {
    return joinText(committedRef.current, sessionFinalRef.current)
  }, [])

  const reset = useCallback(() => {
    committedRef.current = ''
    sessionFinalRef.current = ''
    setTranscript('')
    setInterim('')
    setError(null)
  }, [])

  const stop = useCallback(() => {
    wantListeningRef.current = false
    try {
      recRef.current?.stop()
    } catch {
      // stop() throws if recognition isn't running - safe to ignore.
    }
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) {
      setError('Voice capture is not supported in this browser.')
      return
    }
    if (wantListeningRef.current) return

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

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
      sessionFinalRef.current = collapseGrowth(finals).join(' ')
      setTranscript(composeFinal())
      setInterim(interimChunk.replace(/\s+/g, ' ').trim())
    }

    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // Benign - onend will restart if we're still meant to be listening.
        return
      }
      // Everything else is fatal for this session: stop and let the modal
      // fall back to the editable text box so the user can type.
      wantListeningRef.current = false
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
    }

    rec.onend = () => {
      // Fold this session's merged final text into the committed base and
      // clear it, because the engine starts fresh on the next start().
      committedRef.current = composeFinal()
      sessionFinalRef.current = ''

      // Chrome ends recognition after a pause; restart while the user still
      // wants to capture, so a thinking pause doesn't cut the session short.
      if (wantListeningRef.current) {
        try {
          rec.start()
        } catch {
          wantListeningRef.current = false
          setListening(false)
        }
      } else {
        setTranscript(committedRef.current)
        setInterim('')
        setListening(false)
      }
    }

    recRef.current = rec
    wantListeningRef.current = true
    setError(null)
    setInterim('')
    setListening(true)
    try {
      rec.start()
    } catch {
      // Calling start() too soon after a previous run can throw; onend's
      // restart path will recover, so just ignore here.
    }
  }, [lang, composeFinal])

  // Abort cleanly if the component unmounts mid-capture.
  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      try {
        recRef.current?.abort()
      } catch {
        // ignore
      }
    }
  }, [])

  return { supported, listening, transcript, interim, error, start, stop, reset }
}
