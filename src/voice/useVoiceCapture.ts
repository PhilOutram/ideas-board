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

  // Transcript is rebuilt, never appended-to: Android Chrome re-fires
  // `onresult` for the same segment repeatedly (each time a word longer and
  // flagged final), so appending deltas duplicates wildly. Instead we store
  // each final result by its index in the current recognition session
  // (a re-fire overwrites its slot) and keep a committed base for text from
  // earlier sessions, since the engine resets indices on each auto-restart.
  const committedRef = useRef('') // finalized text from previous sessions
  const sessionFinalsRef = useRef<string[]>([]) // this session's finals, by index

  const composeFinal = useCallback(() => {
    const session = sessionFinalsRef.current.join(' ')
    return joinText(committedRef.current, session)
  }, [])

  const reset = useCallback(() => {
    committedRef.current = ''
    sessionFinalsRef.current = []
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
          // Overwrite this index rather than append - dedupes Android re-fires.
          sessionFinalsRef.current[i] = text.trim()
        } else {
          interimChunk += text
        }
      }
      setTranscript(composeFinal())
      setInterim(interimChunk.trim())
    }

    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantListeningRef.current = false
        setError('Microphone access was blocked. Allow it in your browser to use voice.')
        setListening(false)
      } else if (event.error === 'no-speech' || event.error === 'aborted') {
        // Benign - onend will restart if we're still meant to be listening.
      } else {
        setError(`Voice capture error: ${event.error}`)
      }
    }

    rec.onend = () => {
      // Fold this session's finals into the committed base and clear the
      // per-session slots, because the engine resets result indices on the
      // next start() - otherwise session 2's index 0 would overwrite
      // session 1's first word.
      committedRef.current = composeFinal()
      sessionFinalsRef.current = []

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
