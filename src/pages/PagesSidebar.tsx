import { useState, type FormEvent } from 'react'
import type { Page } from './usePages'

type Props = {
  pages: Page[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (title: string) => Promise<string>
}

export default function PagesSidebar({ pages, selectedId, onSelect, onCreate }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setBusy(true)
    setError(null)
    try {
      const newId = await onCreate(title)
      setDraft('')
      onSelect(newId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create page.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="pages-sidebar">
      <form className="page-create" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="New page..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
          aria-label="New page title"
        />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Create page">
          +
        </button>
      </form>

      {error && <p className="page-create-error" role="alert">{error}</p>}

      <nav className="pages-list" aria-label="Pages">
        {pages.length === 0 ? (
          <p className="pages-empty muted">No pages yet.</p>
        ) : (
          <ul>
            {pages.map((page) => {
              const active = page.id === selectedId
              return (
                <li key={page.id}>
                  <button
                    type="button"
                    className={active ? 'page-item page-item-active' : 'page-item'}
                    onClick={() => onSelect(page.id)}
                  >
                    {page.title || <span className="muted">(untitled)</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </aside>
  )
}
