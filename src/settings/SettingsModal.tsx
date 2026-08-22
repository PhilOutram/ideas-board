import { useEffect, useState, type FormEvent } from 'react'
import { useSettings } from './SettingsContext'
import { useOverlayDismiss } from '../lib/useOverlayDismiss'

// Where account-level preferences are configured. Today it's just the forward
// email address (for the ✉ buttons); the AI-thoughts prompt could move here
// later so all settings live in one place.
export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { forwardEmail, setForwardEmail } = useSettings()
  const [draft, setDraft] = useState(forwardEmail)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dismiss = useOverlayDismiss(onClose)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = draft.trim()
    // An empty value is allowed - it just clears the configured address.
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address (or leave it blank).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await setForwardEmail(value)
      setSaved(true)
      window.setTimeout(onClose, 700)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setError('Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" {...dismiss}>
      <div
        className="modal-card settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </header>

        <form className="modal-body settings-body" onSubmit={handleSubmit}>
          <label className="settings-field">
            <span className="settings-label">Forward / work email</span>
            <input
              type="email"
              value={draft}
              placeholder="you@work.com"
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Forward email address"
              autoFocus
            />
            <span className="settings-hint muted">
              Where the ✉ buttons send a captured idea. Stored privately to your account.
            </span>
          </label>

          {error && <p className="add-board-error" role="alert">{error}</p>}

          <div className="settings-actions">
            <button type="submit" className="ai-button" disabled={saving}>
              {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="link-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
