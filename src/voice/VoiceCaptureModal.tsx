import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useVoiceCapture } from './useVoiceCapture'
import { callAi } from '../ai/aiClient'
import { DEFAULT_THOUGHTS_PROMPT, getThoughtsPrompt, setThoughtsPrompt } from '../ai/prompts'

type Props = {
  // Save the captured note to the inbox (the page's messy space). The note is
  // the AI-tidied text by default (the raw dictation is discarded unless the
  // user opts to keep it), optionally with an AI "thoughts" section appended.
  onSave: (text: string) => Promise<void> | void
  onClose: () => void
}

export default function VoiceCaptureModal({ onSave, onClose }: Props) {
  const { supported, listening, transcript, interim, error, start, stop, reset } = useVoiceCapture()

  const [raw, setRaw] = useState('')
  const [tidied, setTidied] = useState('')
  const [thoughts, setThoughts] = useState('')
  const [includeThoughts, setIncludeThoughts] = useState(true)
  const [keepOriginal, setKeepOriginal] = useState(false)
  const [refine, setRefine] = useState('')

  const [tidying, setTidying] = useState(false)
  const [tidyError, setTidyError] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [thoughtsError, setThoughtsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // User-editable prompt for the "thoughts" generation (stored per-device).
  const [thoughtsPrompt, setThoughtsPromptState] = useState(() => getThoughtsPrompt())
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [promptDraft, setPromptDraft] = useState('')

  const startedRef = useRef(false)
  const recordedRef = useRef(false) // raw came from a recording (not typing)
  const autoTidiedRef = useRef(false)

  async function runTidy(source: string, instruction?: string) {
    const text = source.trim()
    if (!text) return
    setTidying(true)
    setTidyError(null)
    try {
      setTidied(await callAi('tidy', text, { instruction }))
    } catch (err) {
      setTidyError(err instanceof Error ? err.message : 'Could not tidy the text.')
    } finally {
      setTidying(false)
    }
  }

  async function runThoughts() {
    const base = (tidied.trim() || raw.trim())
    if (!base) return
    setThinking(true)
    setThoughtsError(null)
    try {
      setThoughts(await callAi('extend', base, { prompt: thoughtsPrompt }))
      setIncludeThoughts(true)
    } catch (err) {
      setThoughtsError(err instanceof Error ? err.message : 'Could not get thoughts.')
    } finally {
      setThinking(false)
    }
  }

  // Auto-start recording on open - the mic tap was the gesture.
  useEffect(() => {
    if (supported && !startedRef.current) {
      startedRef.current = true
      reset()
      start()
    }
  }, [supported, start, reset])

  // Once recording stops, move the captured text into the editable raw box.
  useEffect(() => {
    if (!listening && transcript && !raw) {
      recordedRef.current = true
      setRaw(transcript)
    }
  }, [listening, transcript, raw])

  // Auto-tidy a fresh dictation once (typed text is tidied manually instead).
  useEffect(() => {
    if (raw && recordedRef.current && !autoTidiedRef.current) {
      autoTidiedRef.current = true
      void runTidy(raw)
    }
    // runTidy is intentionally omitted - this should fire once per recording.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function recordAgain() {
    setRaw('')
    setTidied('')
    setThoughts('')
    setTidyError(null)
    setThoughtsError(null)
    setIncludeThoughts(true)
    setKeepOriginal(false)
    setRefine('')
    recordedRef.current = false
    autoTidiedRef.current = false
    reset()
    start()
  }

  function openPromptEditor() {
    setPromptDraft(thoughtsPrompt)
    setEditingPrompt(true)
  }

  function savePrompt() {
    setThoughtsPrompt(promptDraft)
    setThoughtsPromptState(getThoughtsPrompt())
    setEditingPrompt(false)
  }

  function handleRefine(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const instruction = refine.trim()
    if (!instruction) return
    void runTidy(tidied.trim() || raw, instruction)
    setRefine('')
  }

  async function handleSave() {
    const primary = (tidied.trim() || raw.trim())
    if (!primary) return
    const parts = [primary]
    if (includeThoughts && thoughts.trim()) parts.push(`AI thoughts:\n${thoughts.trim()}`)
    if (keepOriginal && raw.trim() && raw.trim() !== primary) {
      parts.push(`Original:\n${raw.trim()}`)
    }
    setSaving(true)
    try {
      await onSave(parts.join('\n\n'))
      onClose()
    } catch (err) {
      console.error('Failed to save capture:', err)
      setSaving(false)
    }
  }

  const canSave = (tidied.trim() || raw.trim()).length > 0

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
                {!transcript && !interim && <span className="muted">Start speaking...</span>}
              </p>
            </div>
          ) : (
            <>
              <section className="studio-section">
                <label className="studio-label">What you said</label>
                <textarea
                  className="voice-textarea"
                  value={raw}
                  placeholder="Speak, or type your idea here."
                  onChange={(e) => setRaw(e.target.value)}
                  rows={3}
                />
              </section>

              <section className="studio-section">
                <label className="studio-label">Tidied</label>
                {tidying ? (
                  <p className="ai-status"><span className="spinner" aria-hidden="true" /> Tidying with AI...</p>
                ) : tidied ? (
                  <>
                    <textarea
                      className="voice-textarea"
                      value={tidied}
                      onChange={(e) => setTidied(e.target.value)}
                      rows={4}
                    />
                    <form className="refine-row" onSubmit={handleRefine}>
                      <input
                        value={refine}
                        placeholder="Ask for a tweak: shorter, as bullets..."
                        onChange={(e) => setRefine(e.target.value)}
                        aria-label="Refine instruction"
                      />
                      <button type="submit" disabled={!refine.trim()}>Refine</button>
                    </form>
                  </>
                ) : (
                  <>
                    {tidyError && <p className="ai-error">{tidyError}</p>}
                    <button
                      type="button"
                      className="ai-button"
                      onClick={() => runTidy(raw)}
                      disabled={!raw.trim()}
                    >
                      ✨ Tidy with AI
                    </button>
                  </>
                )}
              </section>

              <section className="studio-section">
                <div className="studio-section-head">
                  <label className="studio-label">AI thoughts</label>
                  <button
                    type="button"
                    className="cog-button"
                    onClick={editingPrompt ? () => setEditingPrompt(false) : openPromptEditor}
                    aria-label="Edit the AI thoughts prompt"
                    aria-expanded={editingPrompt}
                    title="Edit the prompt used for AI thoughts"
                  >
                    ⚙
                  </button>
                </div>

                {editingPrompt && (
                  <div className="prompt-editor">
                    <p className="prompt-editor-hint muted">
                      The instruction sent to the AI when generating thoughts. Saved on this device.
                    </p>
                    <textarea
                      className="voice-textarea"
                      value={promptDraft}
                      onChange={(e) => setPromptDraft(e.target.value)}
                      rows={7}
                      aria-label="AI thoughts prompt"
                    />
                    <div className="prompt-editor-actions">
                      <button type="button" className="ai-button" onClick={savePrompt}>
                        Save prompt
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setPromptDraft(DEFAULT_THOUGHTS_PROMPT)}
                      >
                        Reset to default
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setEditingPrompt(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {thinking ? (
                  <p className="ai-status"><span className="spinner" aria-hidden="true" /> Thinking...</p>
                ) : thoughts ? (
                  <>
                    <div className="ai-thoughts-text">{thoughts}</div>
                    <label className="studio-check">
                      <input
                        type="checkbox"
                        checked={includeThoughts}
                        onChange={(e) => setIncludeThoughts(e.target.checked)}
                      />
                      Include these thoughts in the saved note
                    </label>
                    <button type="button" className="ai-button" onClick={runThoughts}>
                      ↻ Regenerate
                    </button>
                  </>
                ) : (
                  <>
                    {thoughtsError && <p className="ai-error">{thoughtsError}</p>}
                    <button
                      type="button"
                      className="ai-button"
                      onClick={runThoughts}
                      disabled={!(tidied.trim() || raw.trim())}
                    >
                      💡 Add AI thoughts
                    </button>
                  </>
                )}
              </section>

              {tidied.trim() && raw.trim() && (
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={keepOriginal}
                    onChange={(e) => setKeepOriginal(e.target.checked)}
                  />
                  Also keep my original words
                </label>
              )}
            </>
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
                  ● {raw ? 'Record again' : 'Record'}
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
