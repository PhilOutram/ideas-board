import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import type { EmailError } from '../lib/email'

type Props = {
  error: EmailError | null
  // Re-run the send that failed. For auth errors this is the "re-authorise"
  // action: sendForwardEmail already force-refreshes the token on a 401, so
  // simply sending again re-proves the sign-in.
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

// A constructive replacement for a bare red error string. For an auth failure
// it explains what "not authorised" means and gives two concrete ways out:
// re-authorise (silent token refresh + retry) or sign in again. For a
// server-config failure it makes clear that signing in won't help and points
// at the setup guide.
export default function EmailErrorNotice({ error, onRetry, retrying, className }: Props) {
  const [signingOut, setSigningOut] = useState(false)
  if (!error) return null

  const isAuth = error.kind === 'reauth' || error.kind === 'signed-out'
  const isConfig = error.kind === 'config'

  async function handleSignInAgain() {
    setSigningOut(true)
    try {
      // Drops back to the sign-in screen (App swaps on auth state). After
      // signing in, the note is still here to re-send - it lives in Firestore.
      await signOut(auth)
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className={`email-notice${className ? ` ${className}` : ''}`} role="alert">
      <p className="email-notice-msg">{error.message}</p>

      {isAuth && (
        <>
          <div className="email-notice-actions">
            {onRetry && (
              <button
                type="button"
                className="email-notice-btn"
                onClick={onRetry}
                disabled={retrying || signingOut}
              >
                {retrying ? 'Re-authorising...' : 'Re-authorise & retry'}
              </button>
            )}
            <button
              type="button"
              className="email-notice-link"
              onClick={handleSignInAgain}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out...' : 'Sign in again'}
            </button>
          </div>
          <p className="email-notice-hint">
            If it still fails right after signing in, the server's email guard needs a
            look (see docs/email-setup.md) - not something you can fix from here.
          </p>
        </>
      )}

      {isConfig && (
        <p className="email-notice-hint">
          This is a server-side setup issue - signing in won't fix it. See the email
          setup guide (docs/email-setup.md).
        </p>
      )}
    </div>
  )
}
