import { VERSION } from '../version'

type Props = {
  message: string
}

export default function StartupError({ message }: Props) {
  return (
    <main className="error-screen">
      <div className="error-card">
        <h1 className="error-title">
          App failed to start
          <span className="error-version">{VERSION}</span>
        </h1>
        <pre className="error-message">{message}</pre>
        <p className="muted">
          Open the browser console (F12) for the full stack trace.
        </p>
        <button
          type="button"
          className="auth-submit"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </main>
  )
}
