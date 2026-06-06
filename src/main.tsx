import React from 'react'
import ReactDOM from 'react-dom/client'
import ErrorBoundary from './components/ErrorBoundary'
import StartupError from './components/StartupError'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

import('./App')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    )
  })
  .catch((err: unknown) => {
    console.error('App failed to start:', err)
    const message = err instanceof Error ? err.message : String(err)
    root.render(<StartupError message={message} />)
  })
