import { useEffect, useMemo, useState } from 'react'
import { countNodes, parseMarkdownToTree, type ParsedNode } from './importMarkdown'

type Props = {
  createPage: (title: string, parentId?: string | null, body?: string) => Promise<string>
  defaultParentId: string | null
  defaultParentTitle: string | null
  onClose: () => void
  onImported: (firstNewId: string) => void
}

export default function ImportModal({
  createPage,
  defaultParentId,
  defaultParentTitle,
  onClose,
  onImported,
}: Props) {
  const [text, setText] = useState('')
  // Default to importing under the current page if one is selected.
  const [atRoot, setAtRoot] = useState(defaultParentId === null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tree = useMemo(() => parseMarkdownToTree(text), [text])
  const total = useMemo(() => countNodes(tree), [tree])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  async function createTree(nodes: ParsedNode[], parentId: string | null): Promise<string | null> {
    let firstId: string | null = null
    for (const node of nodes) {
      // Parent is created before its children so parentId is always valid.
      const id = await createPage(node.title || '(untitled)', parentId, node.body)
      if (!firstId) firstId = id
      if (node.children.length) await createTree(node.children, id)
    }
    return firstId
  }

  async function handleImport() {
    if (total === 0) return
    setBusy(true)
    setError(null)
    try {
      const parentId = atRoot ? null : defaultParentId
      const firstId = await createTree(tree, parentId)
      if (firstId) onImported(firstId)
      onClose()
    } catch (err) {
      console.error('Import failed:', err)
      setError(err instanceof Error ? err.message : 'Import failed.')
      setBusy(false)
    }
  }

  const targetLabel = atRoot
    ? 'as new top-level pages'
    : `under "${defaultParentTitle || '(untitled)'}"`

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div
        className="modal-card import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import Markdown"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 className="modal-title">Import Markdown</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal-body">
          <p className="muted import-hint">
            Paste Markdown. Each heading (#, ##, ###...) becomes a nested section; the text under
            it becomes that section's body.
          </p>
          <textarea
            className="voice-textarea import-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'# Ember\n\n## Winning\nWhat feeling does the game elicit?\n\n## Resources\n...'}
            rows={8}
            autoFocus
          />

          {defaultParentId !== null && (
            <label className="studio-check">
              <input
                type="checkbox"
                checked={atRoot}
                onChange={(e) => setAtRoot(e.target.checked)}
              />
              Import as new top-level pages (instead of under "{defaultParentTitle || '(untitled)'}")
            </label>
          )}

          {error && <p className="ai-error">{error}</p>}

          {total > 0 ? (
            <div className="import-preview">
              <p className="studio-label">
                Preview — {total} section{total === 1 ? '' : 's'} {targetLabel}
              </p>
              <ul className="import-tree">
                {tree.map((node, i) => (
                  <ImportPreviewNode key={i} node={node} depth={0} />
                ))}
              </ul>
            </div>
          ) : (
            text.trim() && <p className="muted">No headings found - add #, ##, ### lines.</p>
          )}
        </div>

        <footer className="voice-actions">
          <button
            type="button"
            className="voice-save"
            onClick={handleImport}
            disabled={total === 0 || busy}
          >
            {busy ? 'Importing...' : `Import ${total || ''} section${total === 1 ? '' : 's'}`}
          </button>
          <button type="button" className="link-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}

function ImportPreviewNode({ node, depth }: { node: ParsedNode; depth: number }) {
  return (
    <li>
      <span className="import-tree-title" style={{ paddingLeft: `${depth * 1}rem` }}>
        {node.title || '(untitled)'}
      </span>
      {node.children.length > 0 && (
        <ul className="import-tree">
          {node.children.map((child, i) => (
            <ImportPreviewNode key={i} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
