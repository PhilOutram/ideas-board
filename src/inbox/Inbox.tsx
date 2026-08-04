import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { Page, PagePatch } from '../pages/usePages'
import type { NewIdeaInput } from '../ideas/useIdeas'
import VoiceCaptureModal from '../voice/VoiceCaptureModal'
import { makeIdeaTitle } from '../ai/aiClient'
import CopyButton from '../components/CopyButton'
import { useSettings } from '../settings/SettingsContext'
import { sendForwardEmail, subjectFromNote, toEmailError, type EmailError } from '../lib/email'
import EmailErrorNotice from '../components/EmailErrorNotice'
import { useQuickIdeas, type QuickIdea } from './useQuickIdeas'

type Props = {
  page: Page
  updatePage: (id: string, patch: PagePatch) => Promise<void>
  createIdea: (input: NewIdeaInput) => Promise<string>
}

export default function Inbox({ page, updatePage, createIdea }: Props) {
  const { quickIdeas, loading, error, addQuickIdea, updateQuickIdea, deleteQuickIdea } =
    useQuickIdeas(page.id)
  const { forwardEmail } = useSettings()
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

  // Append a snippet to the page's memory/context board with a date stamp.
  // Used by the voice capture "add to memory/context" buttons.
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
          onAddToInbox={(text) => addQuickIdea(text)}
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
              forwardEmail={forwardEmail}
              onPromote={() => promote(item)}
              onSaveEdit={(text) => updateQuickIdea(item.id, text)}
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
  forwardEmail: string
  onPromote: () => Promise<void> | void
  onSaveEdit: (text: string) => Promise<void>
  onDelete: () => Promise<void> | void
}

// One icon-action button (1.9rem) plus the column gap (0.3rem). Used to work
// out how many action buttons fit alongside the (text-sized) item body.
const ACTION_BTN_REM = 1.9
const ACTION_GAP_REM = 0.3

function InboxItem({ item, forwardEmail, onPromote, onSaveEdit, onDelete }: ItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [emailError, setEmailError] = useState<EmailError | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  // How many action buttons the body is tall enough to show (1..4). The box is
  // sized to its text (up to 6 lines), so a one-line note shows a single "..."
  // and a tall note shows the whole rail. Defaults high until measured.
  const [capacity, setCapacity] = useState(4)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const compute = () => {
      const unit = (ACTION_BTN_REM + ACTION_GAP_REM) * root
      const fit = Math.floor((el.clientHeight + ACTION_GAP_REM * root) / unit)
      setCapacity(Math.min(4, Math.max(1, fit)))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const created = item.created?.toDate() ?? null
  const stamp = created ? formatStamp(created) : '...'
  const fullStamp = created ? created.toLocaleString() : ''

  function startEdit() {
    setDraft(item.text)
    setEditing(true)
  }

  async function commitEdit() {
    const next = draft.trim()
    setEditing(false)
    if (!next || next === item.text) return
    try {
      await onSaveEdit(next)
    } catch (err) {
      console.error('Failed to save inbox edit:', err)
    }
  }

  function onEditKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter commits (Shift+Enter inserts a newline); Esc cancels the edit.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(false)
    }
  }

  async function run(action: () => Promise<void> | void) {
    try {
      await action()
    } catch (err) {
      console.error('Inbox action failed:', err)
    }
  }

  async function forward() {
    if (!forwardEmail) return
    setEmailError(null)
    setEmailState('sending')
    try {
      await sendForwardEmail({
        to: forwardEmail,
        subject: subjectFromNote(item.text),
        text: item.text,
      })
      setEmailState('sent')
      window.setTimeout(() => setEmailState('idle'), 2500)
    } catch (err) {
      const e = toEmailError(err)
      setEmailState('failed')
      setEmailError(e)
      // Actionable errors (re-authorise / server setup) keep the ✗ and notice
      // up until the user acts; transient ones fade back to the ✉ glyph.
      if (e.kind !== 'reauth' && e.kind !== 'signed-out' && e.kind !== 'config') {
        window.setTimeout(() => setEmailState('idle'), 2500)
      }
    }
  }

  const emailGlyph =
    emailState === 'sent'
      ? '✓'
      : emailState === 'failed'
        ? '✗'
        : emailState === 'sending'
          ? '…'
          : '✉️'

  // The action rail, in priority order. Buttons that don't fit the text-sized
  // box collapse behind a trailing "..." button that opens the rest in a panel.
  const actions: { key: string; node: ReactNode }[] = [
    {
      key: 'promote',
      node: (
        <button
          type="button"
          className="icon-action"
          onClick={() => run(onPromote)}
          aria-label="Push to idea"
          title="Push to idea"
        >
          💡
        </button>
      ),
    },
    {
      key: 'copy',
      node: <CopyButton className="icon-action" icon="📋" label="Copy text" getText={() => item.text} />,
    },
    {
      key: 'forward',
      node: (
        <button
          type="button"
          className="icon-action"
          onClick={forward}
          disabled={!forwardEmail || emailState === 'sending'}
          aria-label={forwardEmail ? `Forward to ${forwardEmail}` : 'Set a forward email in Settings'}
          title={forwardEmail ? `Forward to ${forwardEmail}` : 'Set a forward email in Settings'}
        >
          {emailGlyph}
        </button>
      ),
    },
    {
      key: 'delete',
      node: (
        <button
          type="button"
          className="icon-action icon-action-danger"
          onClick={() => {
            setOverflowOpen(false)
            setConfirmingDelete(true)
          }}
          aria-label="Delete"
          title="Delete"
        >
          🗑
        </button>
      ),
    },
  ]

  // When something has to hide, the last visible slot becomes the "..." button.
  const showAll = capacity >= actions.length
  const visible = showAll ? actions : actions.slice(0, Math.max(0, capacity - 1))
  const hidden = showAll ? [] : actions.slice(Math.max(0, capacity - 1))

  return (
    <li className="inbox-item">
      <div className="inbox-item-body" ref={bodyRef}>
        {editing ? (
          <textarea
            className="inbox-item-edit"
            value={draft}
            rows={3}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onEditKeyDown}
            aria-label="Edit idea"
          />
        ) : (
          <button
            type="button"
            className="inbox-item-text inbox-item-text-button"
            onClick={startEdit}
            title="Click to edit"
          >
            {item.text}
          </button>
        )}
        <time className="inbox-item-stamp" title={fullStamp}>{stamp}</time>
      </div>

      <div className="inbox-item-actions">
        {confirmingDelete ? (
          <span className="inbox-delete-confirm">
            <button
              type="button"
              className="icon-action icon-action-danger"
              onClick={() => run(onDelete)}
              aria-label="Confirm delete"
              title="Confirm delete"
            >
              ✓
            </button>
            <button
              type="button"
              className="icon-action"
              onClick={() => setConfirmingDelete(false)}
              aria-label="Cancel delete"
              title="Cancel"
            >
              ✕
            </button>
          </span>
        ) : (
          <>
            {visible.map((a) => (
              <span key={a.key} className="inbox-action-slot">{a.node}</span>
            ))}
            {hidden.length > 0 && (
              <>
                <button
                  type="button"
                  className="icon-action"
                  onClick={() => setOverflowOpen((v) => !v)}
                  aria-haspopup="true"
                  aria-expanded={overflowOpen}
                  aria-label="More actions"
                  title="More actions"
                >
                  ⋯
                </button>
                {overflowOpen && (
                  <div className="inbox-overflow-panel" onClick={() => setOverflowOpen(false)}>
                    {hidden.map((a) => (
                      <span key={a.key} className="inbox-action-slot">{a.node}</span>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <EmailErrorNotice
        error={emailError}
        onRetry={forward}
        retrying={emailState === 'sending'}
        className="email-notice-inbox"
      />
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
