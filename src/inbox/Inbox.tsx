import { useRef, useState, type FormEvent } from 'react'
import type { Page, PagePatch } from '../pages/usePages'
import { useQuickIdeas, type QuickIdea } from './useQuickIdeas'

type Props = {
  page: Page
  updatePage: (id: string, patch: PagePatch) => Promise<void>
}

export default function Inbox({ page, updatePage }: Props) {
  const { quickIdeas, loading, error, addQuickIdea, deleteQuickIdea } = useQuickIdeas(page.id)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    inputRef.current?.focus()
    try {
      await addQuickIdea(text)
    } catch (err) {
      console.error('Failed to add quick idea:', err)
      setDraft(text) // restore so the user doesn't lose it
    }
  }

  async function sendTo(field: 'memory' | 'context', item: QuickIdea) {
    const existing = field === 'memory' ? page.memory : page.context
    const stamp = item.created ? formatStamp(item.created.toDate()) : ''
    const prefix = stamp ? `[${stamp}] ` : ''
    const appended = existing ? `${existing}\n${prefix}${item.text}` : `${prefix}${item.text}`
    await updatePage(page.id, { [field]: appended })
    await deleteQuickIdea(item.id)
  }

  return (
    <div className="inbox">
      <form className="inbox-add" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Quick idea..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Quick idea"
          autoFocus
        />
        <button type="submit" disabled={!draft.trim()}>Add</button>
      </form>

      {error && (
        <p className="auth-error" role="alert">Couldn't load inbox: {error.message}</p>
      )}

      {loading ? (
        <p className="muted inbox-status">Loading inbox...</p>
      ) : quickIdeas.length === 0 ? (
        <p className="muted inbox-status">Inbox is empty.</p>
      ) : (
        <ul className="inbox-list">
          {quickIdeas.map((item) => (
            <InboxItem
              key={item.id}
              item={item}
              onSendToMemory={() => sendTo('memory', item)}
              onSendToContext={() => sendTo('context', item)}
              onDelete={() => deleteQuickIdea(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

type ItemProps = {
  item: QuickIdea
  onSendToMemory: () => Promise<void> | void
  onSendToContext: () => Promise<void> | void
  onDelete: () => Promise<void> | void
}

function InboxItem({ item, onSendToMemory, onSendToContext, onDelete }: ItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const created = item.created?.toDate() ?? null
  const stamp = created ? formatStamp(created) : '...'
  const fullStamp = created ? created.toLocaleString() : ''

  async function run(action: () => Promise<void> | void) {
    setMenuOpen(false)
    try {
      await action()
    } catch (err) {
      console.error('Inbox action failed:', err)
    }
  }

  return (
    <li className="inbox-item">
      <div className="inbox-item-body">
        <p className="inbox-item-text">{item.text}</p>
        <time className="inbox-item-stamp" title={fullStamp}>{stamp}</time>
      </div>

      <div className="inbox-item-menu-wrap">
        <button
          type="button"
          className="inbox-item-menu-trigger"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          onBlur={(e) => {
            // Close menu when focus leaves the wrapper entirely.
            if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
              setMenuOpen(false)
            }
          }}
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="popover" role="menu">
            <button type="button" role="menuitem" onClick={() => run(onSendToMemory)}>
              Send to memory
            </button>
            <button type="button" role="menuitem" onClick={() => run(onSendToContext)}>
              Send to context
            </button>
            <button
              type="button"
              role="menuitem"
              className="popover-danger"
              onClick={() => run(onDelete)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

function formatStamp(date: Date): string {
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
