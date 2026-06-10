import { useState, type FormEvent } from 'react'
import type { Page } from './usePages'
import { buildTree, type PageTreeNode } from './pageTree'

type Props = {
  pages: Page[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (title: string, parentId?: string | null) => Promise<string>
  onOpenImport: () => void
}

export default function PagesSidebar({ pages, selectedId, onSelect, onCreate, onOpenImport }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Nodes are expanded by default; we only track which ones are collapsed.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // Which node currently has its inline "add sub-section" input open.
  const [addingUnder, setAddingUnder] = useState<string | null>(null)

  const tree = buildTree(pages)

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.delete(parentId)
        return next
      })
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
      </form>

      {error && <p className="page-create-error" role="alert">{error}</p>}

      <button type="button" className="import-trigger" onClick={onOpenImport}>
        ⬇ Import Markdown
      </button>

      <nav className="pages-list" aria-label="Pages">
        {tree.length === 0 ? (
          <p className="pages-empty muted">No pages yet.</p>
        ) : (
          <ul className="page-tree">
            {tree.map((node) => (
              <PageTreeItem
                key={node.page.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                collapsed={collapsed}
                addingUnder={addingUnder}
                onToggle={toggle}
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
  selectedId: string | null
  collapsed: Set<string>
  addingUnder: string | null
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onStartAdd: (id: string | null) => void
  onCreateChild: (parentId: string, title: string) => Promise<void>
}

function PageTreeItem({
  node,
  depth,
  selectedId,
  collapsed,
  addingUnder,
  onToggle,
  onSelect,
  onStartAdd,
  onCreateChild,
}: ItemProps) {
  const { page, children } = node
  const hasChildren = children.length > 0
  const isCollapsed = collapsed.has(page.id)
  const active = page.id === selectedId
  const [childDraft, setChildDraft] = useState('')

  // Indent by depth; the caret/spacer keeps titles aligned across levels.
  const indent = { paddingLeft: `${depth * 0.85 + 0.2}rem` }

  function submitChild(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void onCreateChild(page.id, childDraft)
    setChildDraft('')
  }

  return (
    <li>
      <div className={active ? 'page-row page-row-active' : 'page-row'} style={indent}>
        {hasChildren ? (
          <button
            type="button"
            className="page-caret"
            onClick={() => onToggle(page.id)}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? '▸' : '▾'}
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

      {hasChildren && !isCollapsed && (
        <ul className="page-tree">
          {children.map((child) => (
            <PageTreeItem
              key={child.page.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              collapsed={collapsed}
              addingUnder={addingUnder}
              onToggle={onToggle}
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
