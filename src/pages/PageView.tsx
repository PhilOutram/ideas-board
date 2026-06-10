import { useState } from 'react'
import Inbox from '../inbox/Inbox'
import IdeasList from '../ideas/IdeasList'
import IdeaModal from '../ideas/IdeaModal'
import { useIdeas } from '../ideas/useIdeas'
import { inheritedMemory, inheritedMemoryForPage } from '../ideas/inheritance'
import { buildPageExport } from '../ideas/exportForChat'
import { ancestorsOf } from './pageTree'
import CopyButton from '../components/CopyButton'
import type { Page, PagePatch } from './usePages'

type Props = {
  page: Page
  pages: Page[]
  updatePage: (id: string, patch: PagePatch) => Promise<void>
  onSelectPage: (id: string) => void
}

export default function PageView({ page, pages, updatePage, onSelectPage }: Props) {
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
        <CopyButton
          className="copy-button"
          label="Copy all ideas for Claude"
          getText={() => buildPageExport(page, ideas)}
          disabled={ideas.length === 0}
        />
      </header>

      {page.body && <pre className="page-body">{page.body}</pre>}

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
