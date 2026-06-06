import type { Page } from './usePages'

type Props = {
  page: Page
}

export default function PageView({ page }: Props) {
  return (
    <section className="page-view">
      <header className="page-view-header">
        <h2 className="page-view-title">{page.title || '(untitled)'}</h2>
      </header>

      <div className="page-view-body">
        <p className="muted">
          Inbox and ideas land here in the next steps. For now, this is just confirming
          the page exists and syncs.
        </p>
      </div>
    </section>
  )
}
