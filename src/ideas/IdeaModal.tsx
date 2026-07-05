import { Fragment, useEffect, useState, type FormEvent } from 'react'
import type { Idea } from './useIdeas'
import { boardKeyFromName } from './useIdeas'
import type { MemorySource } from './inheritance'
import { buildIdeaExport, buildIdeaCard } from './exportForChat'
import CopyButton from '../components/CopyButton'
import { useDebouncedField } from '../lib/useDebouncedField'
import { useSettings } from '../settings/SettingsContext'
import { sendForwardEmail } from '../lib/email'
import type { Page } from '../pages/usePages'
import { buildTree, type PageTreeNode } from '../pages/pageTree'
import { useVoiceCapture } from '../voice/useVoiceCapture'
import { useWakeLock } from '../voice/useWakeLock'

type Props = {
  idea: Idea
  page: Page
  pages: Page[]
  inherited: MemorySource[]
  onUpdateTitle: (title: string) => void
  onUpdateBoard: (key: string, value: string) => void
  onAddBoard: (key: string) => Promise<void>
  onMove: (targetPageId: string) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

// The four defaults always render first, in this order. Anything else in the
// boards map is a custom board and renders after them, in insertion order.
const DEFAULT_BOARDS = ['messy', 'tidy', 'context', 'memory'] as const

export default function IdeaModal({
  idea,
  page,
  pages,
  inherited,
  onUpdateTitle,
  onUpdateBoard,
  onAddBoard,
  onMove,
  onDelete,
  onClose,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const [emailError, setEmailError] = useState<string | null>(null)

  // Dictation: one shared recognizer for the whole idea, plus which board (if
  // any) is currently capturing. Only one board records at a time.
  const voice = useVoiceCapture()
  const { listening, transcript, interim } = voice
  const [micKey, setMicKey] = useState<string | null>(null)

  // Hold the screen on while dictating so a phone sleeping doesn't cut the mic.
  useWakeLock(listening)

  // When a board's dictation ends (the user hit its mic again, or an error
  // stopped it), append the finalized transcript to that board and leave record
  // mode. The persisted board value is the base, so a whole spoken note lands
  // after whatever was already there. An error ends recording with no
  // transcript, so nothing is appended but the error banner still shows.
  useEffect(() => {
    if (!micKey || listening) return
    const spoken = transcript.trim()
    if (spoken) {
      const existing = idea.boards[micKey] ?? ''
      onUpdateBoard(micKey, existing ? `${existing}\n${spoken}` : spoken)
    }
    setMicKey(null)
  }, [micKey, listening, transcript, idea.boards, onUpdateBoard])

  // Toggle the mic for a board. Clicking the recording board's mic stops it;
  // clicking a board's mic while nothing records starts a fresh session there.
  // Other boards' mics are disabled while one records, so this never races over
  // where the transcript lands.
  function toggleMic(key: string) {
    if (micKey === key) {
      voice.stop()
    } else if (!micKey) {
      voice.reset()
      setMicKey(key)
      voice.start()
    }
  }

  const customKeys = Object.keys(idea.boards).filter(
    (k) => !DEFAULT_BOARDS.includes(k as (typeof DEFAULT_BOARDS)[number]),
  )
  const orderedKeys = [...DEFAULT_BOARDS, ...customKeys]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card idea-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit idea"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <TitleEditor value={idea.title} onSave={onUpdateTitle} />
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close idea"
          >
            ×
          </button>
        </header>

        <div className="modal-body">
          {voice.error && (
            <div className="auth-error voice-error" role="alert">
              <span>{voice.error}</span>
              <button
                type="button"
                className="voice-error-close"
                onClick={voice.reset}
                aria-label="Dismiss this message"
              >
                ×
              </button>
            </div>
          )}

          {orderedKeys.map((key) => (
            <Fragment key={key}>
              {/* Inherited memory sits directly above this idea's own Memory
                  board so the local value visibly takes precedence (4a). */}
              {key === 'memory' && inherited.length > 0 && (
                <InheritedMemory sources={inherited} />
              )}
              <BoardEditor
                label={labelForBoard(key)}
                value={idea.boards[key] ?? ''}
                onSave={(value) => onUpdateBoard(key, value)}
                micSupported={voice.supported}
                recording={micKey === key}
                micDisabled={micKey !== null && micKey !== key}
                liveText={micKey === key ? joinLive(transcript, interim) : ''}
                onToggleMic={() => toggleMic(key)}
              />
            </Fragment>
          ))}

          <AddBoard existingKeys={Object.keys(idea.boards)} onAdd={onAddBoard} />
        </div>

        <footer className="idea-modal-footer">
          <CopyButton
            className="copy-button copy-button-icon"
            icon="📋"
            label="Copy for Claude"
            getText={() => buildIdeaExport(page, idea)}
          />
          <EmailIdeaButton
            subject={idea.title ? `Idea: ${idea.title}` : 'Idea'}
            getBody={() => buildIdeaCard(idea)}
            onError={setEmailError}
          />
          <MoveIdeaButton
            pages={pages}
            currentPageId={page.id}
            onMove={onMove}
            onClose={onClose}
          />
          <DeleteIdeaButton onDelete={onDelete} onClose={onClose} />
          {emailError && (
            <p className="ai-error email-inline-error" role="alert">{emailError}</p>
          )}
        </footer>
      </div>
    </div>
  )
}

function TitleEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const { draft, onChange, flush } = useDebouncedField(value, onSave)
  return (
    <input
      className="idea-modal-title"
      value={draft}
      placeholder="Untitled idea"
      aria-label="Idea title"
      onChange={(e) => onChange(e.target.value)}
      onBlur={flush}
    />
  )
}

// Read-only block of memory inherited from ancestors. Not editable here -
// it's edited where it lives (the parent page), and cascades down on change.
function InheritedMemory({ sources }: { sources: MemorySource[] }) {
  return (
    <section className="inherited-memory">
      <h3 className="board-label inherited-label">Inherited memory</h3>
      {sources.map((source) => (
        <div key={source.label} className="inherited-source">
          <p className="inherited-source-label">{source.label}</p>
          <pre className="inherited-text">{source.memory}</pre>
        </div>
      ))}
      <p className="inherited-note muted">
        This idea's own memory below takes precedence.
      </p>
    </section>
  )
}

type BoardProps = {
  label: string
  value: string
  onSave: (v: string) => void
  micSupported: boolean
  recording: boolean
  micDisabled: boolean
  liveText: string
  onToggleMic: () => void
}

// Join finalized transcript and live interim words on a single space for the
// dictation preview, collapsing any stray whitespace.
function joinLive(transcript: string, interim: string): string {
  return `${transcript} ${interim}`.replace(/\s+/g, ' ').trim()
}

function BoardEditor({
  label,
  value,
  onSave,
  micSupported,
  recording,
  micDisabled,
  liveText,
  onToggleMic,
}: BoardProps) {
  const { draft, onChange, flush } = useDebouncedField(value, onSave)
  return (
    <section className="board-editor">
      <div className="board-head">
        <label className="board-label">{label}</label>
        {micSupported && (
          <button
            type="button"
            className={`board-mic${recording ? ' board-mic-recording' : ''}`}
            onClick={onToggleMic}
            disabled={micDisabled}
            aria-pressed={recording}
            aria-label={recording ? `Stop dictation into ${label}` : `Dictate into ${label}`}
            title={recording ? 'Stop dictation' : 'Add a note by voice'}
          >
            {recording ? <span className="voice-pulse" aria-hidden="true" /> : '🎤'}
          </button>
        )}
      </div>
      <textarea
        className="board-textarea"
        value={draft}
        placeholder={`Nothing in ${label.toLowerCase()} yet...`}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        rows={3}
      />
      {recording && (
        <div className="board-dictation" aria-live="polite">
          <span className="voice-recording">
            <span className="voice-pulse" aria-hidden="true" /> Listening...
          </span>
          <p className="voice-live-text">
            {liveText ? (
              <>
                {liveText}
                <span className="muted"> - added when you stop</span>
              </>
            ) : (
              <span className="muted">Start speaking...</span>
            )}
          </p>
        </div>
      )}
    </section>
  )
}

function AddBoard({
  existingKeys,
  onAdd,
}: {
  existingKeys: string[]
  onAdd: (key: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const key = boardKeyFromName(name)
    if (!key) {
      setError('Give the board a name.')
      return
    }
    if (existingKeys.includes(key)) {
      setError('A board with that name already exists.')
      return
    }
    try {
      await onAdd(key)
      setName('')
      setError(null)
      setOpen(false)
    } catch (err) {
      console.error('Failed to add board:', err)
      setError('Could not add the board.')
    }
  }

  if (!open) {
    return (
      <button type="button" className="add-board-trigger" onClick={() => setOpen(true)}>
        + Add board
      </button>
    )
  }

  return (
    <form className="add-board-form" onSubmit={handleSubmit}>
      <input
        autoFocus
        value={name}
        placeholder="Board name (e.g. mechanics)"
        aria-label="New board name"
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit">Add</button>
      <button
        type="button"
        className="link-button"
        onClick={() => {
          setOpen(false)
          setName('')
          setError(null)
        }}
      >
        Cancel
      </button>
      {error && <p className="add-board-error">{error}</p>}
    </form>
  )
}

// Email the whole idea (title + its non-empty boards) to the user's configured
// work address. Reads forwardEmail from settings; disabled with a hint if none
// is set. Shows a transient ✓/✗, reports any failure message to the parent via
// onError (shown inline under the footer), and does not close the modal.
function EmailIdeaButton({
  subject,
  getBody,
  onError,
}: {
  subject: string
  getBody: () => string
  onError: (message: string | null) => void
}) {
  const { forwardEmail } = useSettings()
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  async function handleEmail() {
    if (!forwardEmail) return
    onError(null)
    setState('sending')
    try {
      await sendForwardEmail({ to: forwardEmail, subject, text: getBody() })
      setState('sent')
    } catch (err) {
      setState('failed')
      onError(err instanceof Error ? err.message : 'Could not send the email.')
    }
    window.setTimeout(() => setState('idle'), 2500)
  }

  const glyph =
    state === 'sent' ? '✓' : state === 'failed' ? '✗' : state === 'sending' ? '…' : '✉️'

  return (
    <button
      type="button"
      className="email-idea email-idea-icon"
      onClick={handleEmail}
      disabled={!forwardEmail || state === 'sending'}
      aria-label={forwardEmail ? `Email idea to ${forwardEmail}` : 'Set a forward email in Settings'}
      title={forwardEmail ? `Email idea to ${forwardEmail}` : 'Set a forward email in Settings'}
    >
      {glyph}
    </button>
  )
}

// Move an idea to another page. Opens a small page-tree picker; choosing a
// target relocates the idea (copy into that page + delete here) then closes
// the modal, since the idea no longer lives on this page.
function MoveIdeaButton({
  pages,
  currentPageId,
  onMove,
  onClose,
}: {
  pages: Page[]
  currentPageId: string
  onMove: (targetPageId: string) => Promise<void>
  onClose: () => void
}) {
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePick(targetPageId: string) {
    setBusy(true)
    setError(null)
    try {
      await onMove(targetPageId)
      onClose()
    } catch (err) {
      console.error('Failed to move idea:', err)
      setError('Could not move the idea.')
      setBusy(false)
    }
  }

  // Only this page exists, so there's nowhere to move to - hide the control.
  if (pages.length < 2) return null

  return (
    <>
      <button
        type="button"
        className="move-idea move-idea-icon"
        onClick={() => setPicking(true)}
        aria-label="Move idea to another page"
        title="Move to page"
      >
        ➡
      </button>
      {picking && (
        <PagePicker
          pages={pages}
          currentPageId={currentPageId}
          busy={busy}
          error={error}
          onPick={handlePick}
          onCancel={() => {
            setPicking(false)
            setError(null)
          }}
        />
      )}
    </>
  )
}

// A nested-tree page chooser. Mirrors the sidebar's tree so the structure is
// familiar; the current page is shown but disabled (you can't move to here).
function PagePicker({
  pages,
  currentPageId,
  busy,
  error,
  onPick,
  onCancel,
}: {
  pages: Page[]
  currentPageId: string
  busy: boolean
  error: string | null
  onPick: (targetPageId: string) => void
  onCancel: () => void
}) {
  const tree = buildTree(pages)

  const renderNodes = (nodes: PageTreeNode[], depth: number) =>
    nodes.map((node) => (
      <Fragment key={node.page.id}>
        <li>
          <button
            type="button"
            className="move-picker-item"
            style={{ paddingLeft: `${0.6 + depth * 1.1}rem` }}
            disabled={busy || node.page.id === currentPageId}
            onClick={() => onPick(node.page.id)}
          >
            {node.page.title || '(untitled)'}
            {node.page.id === currentPageId && <span className="muted"> (current)</span>}
          </button>
        </li>
        {node.children.length > 0 && renderNodes(node.children, depth + 1)}
      </Fragment>
    ))

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-card move-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Move idea to page"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h3 className="modal-title">Move idea to...</h3>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Cancel move">
            ×
          </button>
        </header>
        <div className="modal-body move-picker-body">
          {error && <p className="add-board-error" role="alert">{error}</p>}
          <ul className="move-picker-tree">{renderNodes(tree, 0)}</ul>
        </div>
      </div>
    </div>
  )
}

function DeleteIdeaButton({
  onDelete,
  onClose,
}: {
  onDelete: () => Promise<void>
  onClose: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  async function handleDelete() {
    try {
      await onDelete()
      onClose()
    } catch (err) {
      console.error('Failed to delete idea:', err)
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="delete-idea delete-idea-icon"
        onClick={() => setConfirming(true)}
        aria-label="Delete idea"
        title="Delete idea"
      >
        🗑
      </button>
    )
  }

  return (
    <span className="delete-idea-confirm">
      <span className="muted">Delete this idea?</span>
      <button type="button" className="delete-idea delete-idea-yes" onClick={handleDelete}>
        Delete
      </button>
      <button type="button" className="link-button" onClick={() => setConfirming(false)}>
        Keep
      </button>
    </span>
  )
}

// "polished_pitch" -> "Polished pitch". Default boards keep their plain names.
function labelForBoard(key: string): string {
  const words = key.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
