import { signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'
import AppTitle from '../components/AppTitle'

type Props = {
  user: User
}

export default function SignedInShell({ user }: Props) {
  async function handleSignOut() {
    await signOut(auth)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <AppTitle />
        <div className="app-user">
          <span className="muted">{user.email}</span>
          <button type="button" className="link-button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="app-main">
        <p className="muted">
          You're signed in. Pages, ideas, and boards are coming in the next steps.
        </p>
      </main>
    </div>
  )
}
