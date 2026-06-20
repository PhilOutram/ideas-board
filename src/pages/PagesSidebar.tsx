import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Page } from './usePages'
import { buildTree, type PageTreeNode } from './pageTree'

type Props = {
  userId: string
  pages: Page[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (title: string, parentId?: string | null) => Promise<string>
  onOpenImport: () => void
}

// A small palette so each top-level "book" gets its own colour cue (the left
// stripe in the sidebar), making books easy to tell apart from their pages.
const BOOK_COLORS = ['#910a2e', '#1f6feb', '#2da44e', '#9a6700', '#8250df', '#bf3989']

// Expansion state is per-account and remembered between visits (it is a local
// view preference, so localStorage rather than Firestore).
const STORAGE_PREFIX = 'ideas-board:expanded:'

function loadExpanded(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId)
    const arr = raw ? JSON.parse(raw) : null
    return Array.isArray(arr) ? new Set(arr) : new Set()
  } catch {
    return new Set()
  }
}

// Ids of every node in this subtree (including the node itself) that can be
// expanded - i.e. has children. Used for the double-click "open/close all".
function collectExpandable(node: PageTreeNode, acc: string[] = []): string[] {
  if (node.children.length > 0) {
    acc.push(node.page.id)
    for (const child of node.children) collectExpandable(child, acc)
  }
  return acc
}

export default function PagesSidebar({ userId, pages, selectedId, onSelect, onCreate, onOpenImport }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Nodes start collapsed; we track which ones the user has expanded so the
  // tree opens one layer at a time and the state survives reloads.
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded(userId))
  // Which node currently has its inline "add sub-section" input open.
  const [addingUnder, setAddingUnder] = useState<string | null>(null)

  const tree = buildTree(pages)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify([...expanded]))
    } catch {
      // Storage can be unavailable (private mode / quota); expansion just
      // won't persist, which is harmless.
    }
  }, [expanded, userId])

  // Single click: open/close just this one layer.
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Double click: open the whole branch if any part is collapsed, else close
  // the whole branch.
  function toggleAll(node: PageTreeNode) {
    const ids = collectExpandable(node)
    const anyCollapsed = ids.some((id) => !expanded.has(id))
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (anyCollapsed) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  async function createRoot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setBusy(true)
    setError(null)
    try {
      const newId = await onCreate(title, null)
      setDraft('')
      onSelect(newId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create page.')
    } finally {
      setBusy(false)
    }
  }

  async function createChild(parentId: string, title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    setError(null)
    try {
      const newId = await onCreate(trimmed, parentId)
      // Make sure the new child is visible and focused.
      setExpanded((prev) => new Set(prev).add(parentId))
      setAddingUnder(null)
      onSelect(newId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create sub-section.')
    }
  }

  return (
    <aside className="pages-sidebar">
      <form className="page-create" onSubmit={createRoot}>
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
        <button
          type="button"
          className="page-import-btn"
          onClick={onOpenImport}
          aria-label="Import Markdown"
          title="Import Markdown"
        >
          ⬇
        </button>
      </form>

      {error && <p className="page-create-error" role="alert">{error}</p>}

      <nav className="pages-list" aria-label="Pages">
        {tree.length === 0 ? (
          <p className="pages-empty muted">No pages yet.</p>
        ) : (
          <ul className="page-tree">
            {tree.map((node, i) => (
              <PageTreeItem
                key={node.page.id}
                node={node}
                depth={0}
                rootColor={BOOK_COLORS[i % BOOK_COLORS.length]}
                selectedId={selectedId}
                expanded={expanded}
                addingUnder={addingUnder}
                onToggle={toggle}
                onToggleAll={toggleAll}
                onSelect={onSelect}
                onStartAdd={setAddingUnder}
                onCreateChild={createChild}
              />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  )
}

type ItemProps = {
  node: PageTreeNode
  depth: number
  rootColor?: string
  selectedId: string | null
  expanded: Set<string>
  addingUnder: string | null
  onToggle: (id: string) => void
  onToggleAll: (node: PageTreeNode) => void
  onSelect: (id: string) => void
  onStartAdd: (id: string | null) => void
  onCreateChild: (parentId: string, title: string) => Promise<void>
}

function PageTreeItem({
  node,
  depth,
  rootColor,
  selectedId,
  expanded,
  addingUnder,
  onToggle,
  onToggleAll,
  onSelect,
  onStartAdd,
  onCreateChild,
}: ItemProps) {
  const { page, children } = node
  const hasChildren = children.length > 0
  const isExpanded = expanded.has(page.id)
  const active = page.id === selectedId
  const [childDraft, setChildDraft] = useState('')
  // Disambiguate single (one layer) from double (whole branch) click on the
  // caret: a single click is held briefly in case a second click follows.
  const clickTimer = useRef<number | null>(null)

  // Indent by depth; the caret/spacer keeps titles aligned across levels.
  const indent = { paddingLeft: `${depth * 0.85 + 0.2}rem` }
  const rowStyle = rootColor ? { ...indent, ['--book-color' as string]: rootColor } : indent

  function onCaretClick() {
    if (clickTimer.current !== null) return // the dblclick handler will run
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null
      onToggle(page.id)
    }, 220)
  }

  function onCaretDblClick() {
    if (clickTimer.current !== null) {
      window.clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    onToggleAll(node)
  }

  function submitChild(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void onCreateChild(page.id, childDraft)
    setChildDraft('')
  }

  const rowClass = [
    'page-row',
    depth === 0 ? 'page-row-root' : '',
    active ? 'page-row-active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li>
      <div className={rowClass} style={rowStyle}>
        {hasChildren ? (
          <button
            type="button"
            className="page-caret"
            onClick={onCaretClick}
            onDoubleClick={onCaretDblClick}
            aria-label={isExpanded ? 'Collapse (double-click for all)' : 'Expand (double-click for all)'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="page-caret page-caret-empty" aria-hidden="true" />
        )}

        <button type="button" className="page-item" onClick={() => onSelect(page.id)}>
          {page.title || <span className="muted">(untitled)</span>}
        </button>

        <button
          type="button"
          className="page-add-child"
          onClick={() => onStartAdd(addingUnder === page.id ? null : page.id)}
          aria-label={`Add a sub-section under ${page.title || 'this page'}`}
          title="Add sub-section"
        >
          +
        </button>
      </div>

      {addingUnder === page.id && (
        <form className="page-add-form" style={{ paddingLeft: `${(depth + 1) * 0.85 + 0.2}rem` }} onSubmit={submitChild}>
          <input
            autoFocus
            type="text"
            placeholder="Sub-section title..."
            value={childDraft}
            onChange={(e) => setChildDraft(e.target.value)}
            aria-label="Sub-section title"
          />
          <button type="submit" disabled={!childDraft.trim()} aria-label="Create sub-section">
            +
          </button>
        </form>
      )}

      {hasChildren && isExpanded && (
        <ul className="page-tree">
          {children.map((child) => (
            <PageTreeItem
              key={child.page.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              addingUnder={addingUnder}
              onToggle={onToggle}
              onToggleAll={onToggleAll}
              onSelect={onSelect}
              onStartAdd={onStartAdd}
              onCreateChild={onCreateChild}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
