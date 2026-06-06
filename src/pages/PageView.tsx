import Inbox from '../inbox/Inbox'
import type { Page, PagePatch } from './usePages'

type Props = {
  page: Page
  updatePage: (id: string, patch: PagePatch) => Promise<void>
}

export default function PageView({ page, updatePage }: Props) {
  return (
    <section className="page-view">
      <header className="page-view-header">
        <h2 className="page-view-title">{page.title || '(untitled)'}</h2>
      </header>

      <Inbox page={page} updatePage={updatePage} />

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
