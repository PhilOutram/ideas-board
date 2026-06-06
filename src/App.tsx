import { firebaseApp } from './firebase'

export default function App() {
  return (
    <main className="scaffold">
      <h1>Ideas Board</h1>
      <p>Vite + React + TypeScript + Firebase scaffold is running.</p>
      <p className="muted">
        Firebase project: <code>{firebaseApp.options.projectId ?? '(not configured)'}</code>
      </p>
    </main>
  )
}
