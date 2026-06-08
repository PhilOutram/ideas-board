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

// Join a running transcript with a new chunk on a single space, tidily.
function joinText(existing: string, chunk: string): string {
  const left = existing.trim()
  const right = chunk.trim()
  if (!left) return right
  if (!right) return left
  return `${left} ${right}`
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

  const reset = useCallback(() => {
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
      let finalChunk = ''
      let interimChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalChunk += text
        else interimChunk += text
      }
      if (finalChunk) setTranscript((prev) => joinText(prev, finalChunk))
      setInterim(interimChunk)
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
  }, [lang])

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
