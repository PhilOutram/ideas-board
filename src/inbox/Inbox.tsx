import { useRef, useState, type FormEvent } from 'react'
import type { Page, PagePatch } from '../pages/usePages'
import type { NewIdeaInput } from '../ideas/useIdeas'
import VoiceCaptureModal from '../voice/VoiceCaptureModal'
import { makeIdeaTitle } from '../ai/aiClient'
import { useQuickIdeas, type QuickIdea } from './useQuickIdeas'

type Props = {
  page: Page
  updatePage: (id: string, patch: PagePatch) => Promise<void>
  createIdea: (input: NewIdeaInput) => Promise<string>
}

export default function Inbox({ page, updatePage, createIdea }: Props) {
  const { quickIdeas, loading, error, addQuickIdea, deleteQuickIdea } = useQuickIdeas(page.id)
  const [draft, setDraft] = useState('')
  const [voiceOpen, setVoiceOpen] = useState(false)
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

  async function promote(item: QuickIdea) {
    // Promote the quick idea into a formal idea (default boards, warm). The
    // title is an AI-generated short summary; the full text seeds the messy
    // board. Then clear it from the inbox so it lives in exactly one place.
    const title = await makeIdeaTitle(item.text)
    await createIdea({ title, messy: item.text })
    await deleteQuickIdea(item.id)
  }

  async function sendTo(field: 'memory' | 'context', item: QuickIdea) {
    const stamp = item.created ? formatArchiveDate(item.created.toDate()) : ''
    await appendToField(field, item.text, stamp)
    await deleteQuickIdea(item.id)
  }

  // Append a snippet to the page's memory/context board with a date stamp.
  // Shared by the inbox "send to" actions and the voice capture buttons.
  async function appendToField(field: 'memory' | 'context', text: string, stamp?: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const date = stamp ?? formatArchiveDate(new Date())
    const existing = field === 'memory' ? page.memory : page.context
    const line = `[${date}] ${trimmed}`
    await updatePage(page.id, { [field]: existing ? `${existing}\n${line}` : line })
  }

  // Voice capture -> straight to a formal idea (with an AI short title).
  async function saveVoiceAsIdea(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const title = await makeIdeaTitle(trimmed)
    await createIdea({ title, messy: trimmed })
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
        <button
          type="button"
          className="inbox-mic"
          onClick={() => setVoiceOpen(true)}
          aria-label="Capture by voice"
          title="Capture by voice"
        >
          🎤
        </button>
      </form>

      {voiceOpen && (
        <VoiceCaptureModal
          onSaveIdea={saveVoiceAsIdea}
          onAddToMemory={(text) => appendToField('memory', text)}
          onAddToContext={(text) => appendToField('context', text)}
          onClose={() => setVoiceOpen(false)}
        />
      )}

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
              onPromote={() => promote(item)}
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
  onPromote: () => Promise<void> | void
  onSendToMemory: () => Promise<void> | void
  onSendToContext: () => Promise<void> | void
  onDelete: () => Promise<void> | void
}

function InboxItem({ item, onPromote, onSendToMemory, onSendToContext, onDelete }: ItemProps) {
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
            <button type="button" role="menuitem" onClick={() => run(onPromote)}>
              Promote to idea
            </button>
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

// Stable absolute date for snippets frozen into prose (memory, context,
// future markdown exports). Time of day is intentionally omitted: these
// snippets are read days, weeks, or months later, so "14:32" is noise.
function formatArchiveDate(date: Date): string {
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

// Live relative-time label for the inbox UI only. Don't use this for
// anything that gets persisted into prose.
function formatStamp(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMs < 0) return 'just now'
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m`

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)

  if (dayDiff === 0) return time
  if (dayDiff === 1) return `Yest ${time}`
  if (dayDiff < 7) {
    const day = date.toLocaleDateString([], { weekday: 'short' })
    return `${day} ${time}`
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' })
}
