import { useEffect, useRef, useState } from 'react'
import { useVoiceCapture } from './useVoiceCapture'

type Props = {
  // Save the captured text. For Layer A this drops it into the inbox (the
  // page's messy space); AI tidy + the split-view review land in step 2.
  onSave: (text: string) => Promise<void> | void
  onClose: () => void
}

export default function VoiceCaptureModal({ onSave, onClose }: Props) {
  const { supported, listening, transcript, interim, error, start, stop, reset } = useVoiceCapture()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const startedRef = useRef(false)

  // The mic tap that opened this modal is the user gesture, so auto-start
  // recording on mount - "click record" with no extra tap.
  useEffect(() => {
    if (supported && !startedRef.current) {
      startedRef.current = true
      reset()
      start()
    }
  }, [supported, start, reset])

  // When recording stops, seed the editable draft with what was captured
  // (only if the user hasn't already typed something).
  useEffect(() => {
    if (!listening && transcript) setDraft((d) => d || transcript)
  }, [listening, transcript])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function recordAgain() {
    setDraft('')
    reset()
    start()
  }

  async function handleSave() {
    const text = (draft || transcript).trim()
    if (!text) return
    setSaving(true)
    try {
      await onSave(text)
      onClose()
    } catch (err) {
      console.error('Failed to save voice capture:', err)
      setSaving(false)
    }
  }

  const liveText = joinForDisplay(transcript, interim)
  const canSave = (draft || transcript).trim().length > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card voice-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Voice capture"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 className="modal-title">Voice capture</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal-body">
          {!supported && (
            <p className="voice-hint muted">
              This browser can't do in-app voice yet (an iPhone/Firefox fallback is coming).
              You can still type your idea below.
            </p>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}

          {listening ? (
            <div className="voice-live" aria-live="polite">
              <div className="voice-recording">
                <span className="voice-pulse" aria-hidden="true" />
                Listening...
              </div>
              <p className="voice-live-text">
                {transcript && <span>{transcript} </span>}
                <span className="voice-interim">{interim}</span>
                {!liveText && <span className="muted">Start speaking...</span>}
              </p>
            </div>
          ) : (
            <textarea
              className="voice-textarea"
              value={draft}
              placeholder="Your idea will appear here - speak, or type."
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              autoFocus
            />
          )}
        </div>

        <footer className="voice-actions">
          {listening ? (
            <button type="button" className="voice-stop" onClick={stop}>
              ◼ Stop
            </button>
          ) : (
            <>
              {supported && (
                <button type="button" className="voice-record" onClick={recordAgain}>
                  ● {transcript ? 'Record again' : 'Record'}
                </button>
              )}
              <button
                type="button"
                className="voice-save"
                onClick={handleSave}
                disabled={!canSave || saving}
              >
                {saving ? 'Saving...' : 'Save to inbox'}
              </button>
            </>
          )}
          <button type="button" className="link-button" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}

function joinForDisplay(transcript: string, interim: string): string {
  return `${transcript} ${interim}`.trim()
}
