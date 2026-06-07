import Inbox from '../inbox/Inbox'
import IdeasList from '../ideas/IdeasList'
import { useIdeas } from '../ideas/useIdeas'
import type { Page, PagePatch } from './usePages'

type Props = {
  page: Page
  updatePage: (id: string, patch: PagePatch) => Promise<void>
}

export default function PageView({ page, updatePage }: Props) {
  const { ideas, loading, error, createIdea, setTemperature } = useIdeas(page.id)

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
      />

      <div className="page-fields">
        <PageField label="Memory" value={page.memory} />
        <PageField label="Context" value={page.context} />
      </div>
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
