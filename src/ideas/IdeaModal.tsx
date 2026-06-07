import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Idea } from './useIdeas'
import { boardKeyFromName } from './useIdeas'

type Props = {
  idea: Idea
  onUpdateTitle: (title: string) => void
  onUpdateBoard: (key: string, value: string) => void
  onAddBoard: (key: string) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

// The four defaults always render first, in this order. Anything else in the
// boards map is a custom board and renders after them, in insertion order.
const DEFAULT_BOARDS = ['messy', 'tidy', 'context', 'memory'] as const

export default function IdeaModal({
  idea,
  onUpdateTitle,
  onUpdateBoard,
  onAddBoard,
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
          {orderedKeys.map((key) => (
            <BoardEditor
              key={key}
              label={labelForBoard(key)}
              value={idea.boards[key] ?? ''}
              onSave={(value) => onUpdateBoard(key, value)}
            />
          ))}

          <AddBoard existingKeys={Object.keys(idea.boards)} onAdd={onAddBoard} />
        </div>

        <footer className="idea-modal-footer">
          <DeleteIdeaButton onDelete={onDelete} onClose={onClose} />
        </footer>
      </div>
    </div>
  )
}

// Local draft + debounced save that won't fight incoming Firestore snapshots:
// while the user is mid-edit (dirty) we ignore remote values; once the remote
// value catches up to our draft we clear the dirty flag and resume syncing.
function useDebouncedField(value: string, onSave: (v: string) => void, delay = 600) {
  const [draft, setDraft] = useState(value)
  const dirty = useRef(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (value === draft) {
      dirty.current = false
    } else if (!dirty.current) {
      setDraft(value)
    }
  }, [value, draft])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  function onChange(next: string) {
    setDraft(next)
    dirty.current = true
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSave(next), delay)
  }

  // Persist immediately on blur so a quick close never drops the last edit.
  function flush() {
    if (timer.current) window.clearTimeout(timer.current)
    if (dirty.current) onSave(draft)
  }

  return { draft, onChange, flush }
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

type BoardProps = {
  label: string
  value: string
  onSave: (v: string) => void
}

function BoardEditor({ label, value, onSave }: BoardProps) {
  const { draft, onChange, flush } = useDebouncedField(value, onSave)
  return (
    <section className="board-editor">
      <label className="board-label">{label}</label>
      <textarea
        className="board-textarea"
        value={draft}
        placeholder={`Nothing in ${label.toLowerCase()} yet...`}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        rows={3}
      />
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
      <button type="button" className="delete-idea" onClick={() => setConfirming(true)}>
        Delete idea
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
