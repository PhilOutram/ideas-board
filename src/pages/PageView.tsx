import { useState } from 'react'
import Inbox from '../inbox/Inbox'
import IdeasList from '../ideas/IdeasList'
import IdeaModal from '../ideas/IdeaModal'
import { useIdeas } from '../ideas/useIdeas'
import { inheritedMemory, inheritedMemoryForPage } from '../ideas/inheritance'
import { buildPageExport } from '../ideas/exportForChat'
import { ancestorsOf } from './pageTree'
import CopyButton from '../components/CopyButton'
import Markdown from '../components/Markdown'
import { useDebouncedField } from '../lib/useDebouncedField'
import type { Page, PagePatch } from './usePages'

type Props = {
  page: Page
  pages: Page[]
  updatePage: (id: string, patch: PagePatch) => Promise<void>
  deletePage: (id: string) => Promise<void>
  onSelectPage: (id: string) => void
}

export default function PageView({ page, pages, updatePage, deletePage, onSelectPage }: Props) {
  const {
    ideas,
    loading,
    error,
    createIdea,
    updateIdea,
    updateBoard,
    addBoard,
    setTemperature,
    deleteIdea,
  } = useIdeas(page.id)
  const [openIdeaId, setOpenIdeaId] = useState<string | null>(null)

  const openIdea = ideas.find((i) => i.id === openIdeaId) ?? null
  const ancestors = ancestorsOf(page.id, pages)
  const pageInherited = inheritedMemoryForPage(page, pages)
  const childCount = pages.filter((p) => p.parentId === page.id).length

  return (
    <section className="page-view">
      {ancestors.length > 0 && (
        <nav className="breadcrumb" aria-label="Section path">
          {ancestors.map((a) => (
            <span key={a.id}>
              <button type="button" className="breadcrumb-link" onClick={() => onSelectPage(a.id)}>
                {a.title || '(untitled)'}
              </button>
              <span className="breadcrumb-sep" aria-hidden="true"> › </span>
            </span>
          ))}
        </nav>
      )}

      <header className="page-view-header">
        <h2 className="page-view-title">{page.title || '(untitled)'}</h2>
        <div className="page-view-actions">
          <CopyButton
            className="copy-button copy-button-icon"
            icon="📋"
            label="Copy all ideas for Claude"
            getText={() => buildPageExport(page, ideas)}
            disabled={ideas.length === 0}
          />
          <DeletePageButton
            childCount={childCount}
            onDelete={() => deletePage(page.id)}
          />
        </div>
      </header>

      <SectionBody
        key={page.id}
        value={page.body}
        onSave={(body) => updatePage(page.id, { body })}
      />

      <Inbox page={page} updatePage={updatePage} createIdea={createIdea} />

      <IdeasList
        ideas={ideas}
        loading={loading}
        error={error}
        setTemperature={setTemperature}
        onOpen={setOpenIdeaId}
      />

      <div className="page-fields">
        <PageField label="Memory" value={page.memory} />
        <PageField label="Context" value={page.context} />
      </div>

      {pageInherited.length > 0 && (
        <details className="inherited-collapsible">
          <summary>Inherited memory ({pageInherited.length})</summary>
          <div className="inherited-collapsible-body">
            {pageInherited.map((source) => (
              <div key={source.label} className="inherited-source">
                <p className="inherited-source-label">{source.label}</p>
                <pre className="inherited-text">{source.memory}</pre>
              </div>
            ))}
            <p className="inherited-note muted">This page's own memory (above) takes precedence.</p>
          </div>
        </details>
      )}

      {openIdea && (
        <IdeaModal
          idea={openIdea}
          page={page}
          inherited={inheritedMemory(page, pages)}
          onUpdateTitle={(title) => updateIdea(openIdea.id, { title })}
          onUpdateBoard={(key, value) => updateBoard(openIdea.id, key, value)}
          onAddBoard={(key) => addBoard(openIdea.id, key)}
          onDelete={() => deleteIdea(openIdea.id)}
          onClose={() => setOpenIdeaId(null)}
        />
      )}
    </section>
  )
}

// Delete a page, behind a confirm step. Blocked while the page still has
// sub-sections so we never silently orphan a whole branch - the user removes
// (or, once re-parenting lands, moves) the children first.
function DeletePageButton({
  childCount,
  onDelete,
}: {
  childCount: number
  onDelete: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (childCount > 0) {
    return (
      <button
        type="button"
        className="delete-page delete-page-icon"
        disabled
        aria-label="Delete page"
        title={`Remove its ${childCount} sub-section${childCount === 1 ? '' : 's'} first`}
      >
        🗑
      </button>
    )
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="delete-page delete-page-icon"
        onClick={() => setConfirming(true)}
        aria-label="Delete page"
        title="Delete page"
      >
        🗑
      </button>
    )
  }

  return (
    <span className="delete-page-confirm">
      <span className="muted">Delete this page?</span>
      <button
        type="button"
        className="delete-page delete-page-yes"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onDelete()
          } catch (err) {
            console.error('Failed to delete page:', err)
            setBusy(false)
            setConfirming(false)
          }
        }}
      >
        {busy ? 'Deleting...' : 'Delete'}
      </button>
      <button type="button" className="link-button" onClick={() => setConfirming(false)}>
        Keep
      </button>
    </span>
  )
}

// The section's main content: a markdown body, rendered when viewing and
// edited as a plain textarea (markdown supported - tables, lists, headings).
// Auto-saves like the idea boards; editing/viewing toggles with one button.
function SectionBody({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const { draft, onChange, flush } = useDebouncedField(value, onSave)
  const hasContent = draft.trim().length > 0

  function toggle() {
    if (editing) flush()
    setEditing((v) => !v)
  }

  return (
    <section className="section-body">
      <div className="section-body-head">
        <h3 className="page-field-label">Content</h3>
        <button
          type="button"
          className="section-edit-toggle"
          onClick={toggle}
          aria-label={editing ? 'Done editing' : hasContent ? 'Edit content' : 'Add content'}
          title={editing ? 'Done editing' : hasContent ? 'Edit content' : 'Add content'}
        >
          {editing ? '✓' : '✏'}
        </button>
      </div>

      {editing ? (
        <textarea
          className="section-body-textarea"
          value={draft}
          placeholder="Write this section in markdown - # headings, **bold**, tables, - lists..."
          onChange={(e) => onChange(e.target.value)}
          onBlur={flush}
          rows={14}
          autoFocus
        />
      ) : hasContent ? (
        <Markdown source={draft} />
      ) : (
        <p className="muted section-body-empty">
          No content yet. Click the ✏ to write this section (markdown supported).
        </p>
      )}
    </section>
  )
}

function PageField({ label, value }: { label: string; value: string }) {
  return (
    <article className="page-field">
      <h3 className="page-field-label">{label}</h3>
      {value ? (
        <pre className="page-field-value">{value}</pre>
      ) : (
        <p className="muted page-field-empty">Empty.</p>
      )}
    </article>
  )
}
