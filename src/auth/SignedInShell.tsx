import { useEffect, useState } from 'react'
import { signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'
import AppTitle from '../components/AppTitle'
import PagesSidebar from '../pages/PagesSidebar'
import PageView from '../pages/PageView'
import ImportModal from '../pages/ImportModal'
import { usePages } from '../pages/usePages'
import { SettingsProvider } from '../settings/SettingsContext'
import SettingsModal from '../settings/SettingsModal'

type Props = {
  user: User
}

export default function SignedInShell({ user }: Props) {
  const { pages, loading, error, createPage, updatePage, deletePage } = usePages(user.uid)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // If nothing is selected (first load, or selected page was deleted),
  // fall back to the most recent page so the user always sees content.
  useEffect(() => {
    if (selectedId && pages.some((p) => p.id === selectedId)) return
    if (pages.length > 0) {
      setSelectedId(pages[pages.length - 1].id)
    } else {
      setSelectedId(null)
    }
  }, [pages, selectedId])

  const selectedPage = pages.find((p) => p.id === selectedId) ?? null

  async function handleSignOut() {
    await signOut(auth)
  }

  return (
    <SettingsProvider userId={user.uid}>
    <div className="app-shell">
      <header className="app-header">
        <AppTitle />
        <div className="app-user">
          <span className="muted">{user.email}</span>
          <button
            type="button"
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
          <button type="button" className="link-button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="app-body">
        <PagesSidebar
          userId={user.uid}
          pages={pages}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={createPage}
          onOpenImport={() => setImportOpen(true)}
        />

        <main className="app-main">
          {error ? (
            <p className="auth-error" role="alert">
              Couldn't load pages: {error.message}
            </p>
          ) : loading ? (
            <p className="muted">Loading pages...</p>
          ) : selectedPage ? (
            <PageView
              page={selectedPage}
              pages={pages}
              updatePage={updatePage}
              deletePage={deletePage}
              onSelectPage={setSelectedId}
            />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>

      {importOpen && (
        <ImportModal
          createPage={createPage}
          defaultParentId={selectedId}
          defaultParentTitle={selectedPage?.title ?? null}
          onClose={() => setImportOpen(false)}
          onImported={setSelectedId}
        />
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
    </SettingsProvider>
  )
}

function EmptyState() {
  return (
    <div className="empty-state">
      <h2>Welcome.</h2>
      <p className="muted">
        Create your first page in the sidebar to get started.
      </p>
    </div>
  )
}
