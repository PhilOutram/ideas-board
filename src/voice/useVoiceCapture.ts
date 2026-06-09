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

  // Android Chrome re-reports a phrase as it grows, emitting each longer
  // version as a *final* result (often at a new index): "okay" then
  // "okay here's" then "okay here's my"... Appending or index-keying both
  // duplicate. So we track the current session's final text as ONE string
  // and merge each incoming final: if it extends what we have, replace
  // (cumulative growth); if it's genuinely new, append. `committedRef` holds
  // text from earlier sessions (the engine resets between auto-restarts).
  const committedRef = useRef('') // finalized text from previous sessions
  const sessionFinalRef = useRef('') // this session's merged final text

  const mergeFinal = useCallback((incoming: string) => {
    const next = incoming.trim()
    if (!next) return
    const prev = sessionFinalRef.current
    if (!prev) {
      sessionFinalRef.current = next
      return
    }
    const prevLower = prev.toLowerCase()
    const nextLower = next.toLowerCase()
    if (nextLower.startsWith(prevLower)) {
      sessionFinalRef.current = next // cumulative growth - replace
    } else if (prevLower.startsWith(nextLower)) {
      // shorter restatement of what we already have - ignore
    } else {
      sessionFinalRef.current = joinText(prev, next) // a new segment - append
    }
  }, [])

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
      let interimChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          mergeFinal(text)
        } else {
          interimChunk += text
        }
      }
      setTranscript(composeFinal())
      setInterim(interimChunk.trim())
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
  }, [lang, composeFinal, mergeFinal])

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
