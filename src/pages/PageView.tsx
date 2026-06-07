import { useState } from 'react'
import Inbox from '../inbox/Inbox'
import IdeasList from '../ideas/IdeasList'
import IdeaModal from '../ideas/IdeaModal'
import { useIdeas } from '../ideas/useIdeas'
import type { Page, PagePatch } from './usePages'

type Props = {
  page: Page
  updatePage: (id: string, patch: PagePatch) => Promise<void>
}

export default function PageView({ page, updatePage }: Props) {
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

  // Resolve against the live list so the modal reflects real-time edits and
  // closes itself if the idea disappears (deleted here or on another device).
  const openIdea = ideas.find((i) => i.id === openIdeaId) ?? null

  return (
    <section className="page-view">
      <header className="page-view-header">
        <h2 className="page-view-title">{page.title || '(untitled)'}</h2>
      </header>

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

      {openIdea && (
        <IdeaModal
          idea={openIdea}
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
