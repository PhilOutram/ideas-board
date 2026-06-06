import { useEffect } from 'react'
import { CHANGELOG } from '../version'

type Props = {
  onClose: () => void
}

export default function ChangelogModal({ onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card changelog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="changelog-title" className="modal-title">Changelog</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close changelog"
          >
            ×
          </button>
        </header>

        <div className="modal-body">
          {CHANGELOG.map((entry) => (
            <section key={entry.version} className="changelog-entry">
              <div className="changelog-entry-head">
                <span className="changelog-version">{entry.version}</span>
                <span className="changelog-date">{entry.date}</span>
              </div>
              <ul className="changelog-notes">
                {entry.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
