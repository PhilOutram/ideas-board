import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'
import AuthScreen from './auth/AuthScreen'
import SignedInShell from './auth/SignedInShell'

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-in'; user: User }
  | { status: 'signed-out' }

export default function App() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState(user ? { status: 'signed-in', user } : { status: 'signed-out' })
    })
    return unsubscribe
  }, [])

  if (state.status === 'loading') {
    return (
      <main className="loading-screen">
        <p className="muted">Loading...</p>
      </main>
    )
  }

  if (state.status === 'signed-out') {
    return <AuthScreen />
  }

  return <SignedInShell user={state.user} />
}
