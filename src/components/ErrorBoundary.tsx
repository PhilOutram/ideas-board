import { Component, type ErrorInfo, type ReactNode } from 'react'
import { VERSION } from '../version'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="error-screen">
        <div className="error-card">
          <h1 className="error-title">
            Something went wrong
            <span className="error-version">{VERSION}</span>
          </h1>
          <pre className="error-message">{this.state.error.message}</pre>
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
}
