import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useVoiceCapture } from './useVoiceCapture'
import { useWakeLock } from './useWakeLock'
import { callAi } from '../ai/aiClient'
import { DEFAULT_THOUGHTS_PROMPT } from '../ai/prompts'
import { useSettings } from '../settings/SettingsContext'
import { sendForwardEmail, subjectFromNote, toEmailError, type EmailError } from '../lib/email'
import EmailErrorNotice from '../components/EmailErrorNotice'

type SaveAction = (text: string) => Promise<void> | void

type Props = {
  // The captured note (AI-tidied by default, optionally with a thoughts
  // section) is routed straight to one of four destinations - no inbox hop.
  // The inbox is the lightweight home for short notes to deal with later.
  onSaveIdea: SaveAction
  onAddToInbox: SaveAction
  onAddToMemory: SaveAction
  onAddToContext: SaveAction
  onClose: () => void
}

export default function VoiceCaptureModal({
  onSaveIdea,
  onAddToInbox,
  onAddToMemory,
  onAddToContext,
  onClose,
}: Props) {
  const { supported, listening, transcript, interim, error, start, stop, reset } = useVoiceCapture()
  const { thoughtsPrompt, setThoughtsPrompt, forwardEmail } = useSettings()

  // Hold the screen on while actively recording so the phone doesn't sleep
  // mid-capture (which would suspend the page and cut the mic).
  useWakeLock(listening)

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

  // Email is a "fire to work" side-action: unlike the four save buttons it
  // does NOT close the modal, so the note can still also be saved somewhere.
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [emailError, setEmailError] = useState<EmailError | null>(null)

  const [editingPrompt, setEditingPrompt] = useState(false)
  const [promptDraft, setPromptDraft] = useState('')

  // Let the user dismiss the error banner so it stops eating card space
  // (important on mobile). Reset the dismissal whenever a new error arrives.
  const [errorDismissed, setErrorDismissed] = useState(false)
  useEffect(() => {
    setErrorDismissed(false)
  }, [error])

  const startedRef = useRef(false)
  const recordedRef = useRef(false)
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

  useEffect(() => {
    if (supported && !startedRef.current) {
      startedRef.current = true
      reset()
      start()
    }
  }, [supported, start, reset])

  useEffect(() => {
    if (!listening && transcript && !raw) {
      recordedRef.current = true
      setRaw(transcript)
    }
  }, [listening, transcript, raw])

  useEffect(() => {
    if (raw && recordedRef.current && !autoTidiedRef.current) {
      autoTidiedRef.current = true
      void runTidy(raw)
    }
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

  async function savePrompt() {
    await setThoughtsPrompt(promptDraft)
    setEditingPrompt(false)
  }

  function handleRefine(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const instruction = refine.trim()
    if (!instruction) return
    void runTidy(tidied.trim() || raw, instruction)
    setRefine('')
  }

  // The note that gets saved: the tidied text (or raw), plus the thoughts
  // section if kept, plus the original if the user opted to keep it.
  function buildNote(): string {
    const primary = (tidied.trim() || raw.trim())
    if (!primary) return ''
    const parts = [primary]
    if (includeThoughts && thoughts.trim()) parts.push(`AI thoughts:\n${thoughts.trim()}`)
    if (keepOriginal && raw.trim() && raw.trim() !== primary) parts.push(`Original:\n${raw.trim()}`)
    return parts.join('\n\n')
  }

  async function doAction(action: SaveAction) {
    const note = buildNote()
    if (!note) return
    setSaving(true)
    try {
      await action(note)
      onClose()
    } catch (err) {
      console.error('Save action failed:', err)
      setSaving(false)
    }
  }

  async function doEmail() {
    const note = buildNote()
    if (!note || !forwardEmail) return
    setEmailState('sending')
    setEmailError(null)
    try {
      await sendForwardEmail({ to: forwardEmail, subject: subjectFromNote(note), text: note })
      setEmailState('sent')
      window.setTimeout(() => setEmailState('idle'), 2500)
    } catch (err) {
      console.error('Email action failed:', err)
      const e = toEmailError(err)
      setEmailState('failed')
      setEmailError(e)
      // Actionable errors stay put until the user acts; transient ones fade.
      if (e.kind !== 'reauth' && e.kind !== 'signed-out' && e.kind !== 'config') {
        window.setTimeout(() => setEmailState('idle'), 2500)
      }
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
          {error && !errorDismissed && (
            <div className="auth-error voice-error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="voice-error-close"
                onClick={() => setErrorDismissed(true)}
                aria-label="Dismiss this message"
              >
                ×
              </button>
            </div>
          )}

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
                      The instruction sent to the AI when generating thoughts. Saved to your account.
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
                    <textarea
                      className="voice-textarea"
                      value={thoughts}
                      onChange={(e) => setThoughts(e.target.value)}
                      rows={6}
                      aria-label="AI thoughts - edit or delete chunks as you like"
                    />
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

        {listening ? (
          <footer className="voice-actions">
            <button type="button" className="voice-stop" onClick={stop}>
              ◼ Stop
            </button>
            <button type="button" className="link-button" onClick={onClose}>
              Cancel
            </button>
          </footer>
        ) : (
          <footer className="voice-actions voice-actions-review">
            <div className="voice-save-actions">
              <button
                type="button"
                className="voice-action"
                onClick={() => doAction(onSaveIdea)}
                disabled={!canSave || saving}
              >
                💡 Save as idea
              </button>
              <button
                type="button"
                className="voice-action"
                onClick={() => doAction(onAddToInbox)}
                disabled={!canSave || saving}
              >
                📥 Add to inbox
              </button>
              <button
                type="button"
                className="voice-action"
                onClick={() => doAction(onAddToMemory)}
                disabled={!canSave || saving}
              >
                🧠 Add to memory
              </button>
              <button
                type="button"
                className="voice-action"
                onClick={() => doAction(onAddToContext)}
                disabled={!canSave || saving}
              >
                📝 Add to context
              </button>
              <button
                type="button"
                className="voice-action"
                onClick={doEmail}
                disabled={!canSave || saving || emailState === 'sending' || !forwardEmail}
                title={
                  forwardEmail
                    ? `Email to ${forwardEmail}`
                    : 'Set a forward email in Settings first'
                }
              >
                {emailState === 'sent'
                  ? '✓ Emailed'
                  : emailState === 'sending'
                    ? '… Emailing'
                    : emailState === 'failed'
                      ? '✗ Failed'
                      : '✉️ Email to work'}
              </button>
            </div>
            <EmailErrorNotice
              error={emailError}
              onRetry={doEmail}
              retrying={emailState === 'sending'}
              className="voice-email-error"
            />
            <div className="voice-actions-secondary">
              {supported && (
                <button type="button" className="voice-record" onClick={recordAgain}>
                  ● {raw ? 'Record again' : 'Record'}
                </button>
              )}
              <button type="button" className="link-button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
