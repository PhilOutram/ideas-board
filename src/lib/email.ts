import { auth } from '../firebase'

type SendArgs = { to: string; subject: string; text: string }

// The different ways a forward-email send can fail. The UI branches on this to
// decide whether to offer a re-authorise/sign-in affordance (kind 'reauth' /
// 'signed-out'), a "this is a server setup problem" hint ('config'), or just a
// transient retry ('service' / 'network').
export type EmailErrorKind =
  | 'no-recipient' // no forward address configured in Settings
  | 'empty' // nothing to send
  | 'signed-out' // no signed-in user at all
  | 'reauth' // server rejected the token, even after a fresh refresh
  | 'config' // server not configured (missing env vars)
  | 'service' // EmailJS / downstream send failure
  | 'network' // couldn't reach our own /api/email function
  | 'unknown'

export class EmailError extends Error {
  kind: EmailErrorKind
  constructor(kind: EmailErrorKind, message: string) {
    super(message)
    this.name = 'EmailError'
    this.kind = kind
  }
}

// Normalise any thrown value into an EmailError so call sites can always branch
// on `.kind` without instanceof gymnastics.
export function toEmailError(err: unknown): EmailError {
  if (err instanceof EmailError) return err
  if (err instanceof Error) return new EmailError('unknown', err.message)
  return new EmailError('unknown', 'Could not send the email.')
}

type ApiResult = { status: number; ok: boolean; error?: string }

// One round-trip to our serverless function. A rejected fetch (function
// unreachable) becomes a typed 'network' error; a non-JSON body (e.g. a 404
// under plain `vite dev`, where /api isn't served) leaves `error` undefined so
// the status-based classifier still produces a readable message.
async function callEmailApi(payload: Record<string, string>): Promise<ApiResult> {
  let res: Response
  try {
    res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new EmailError('network', "Couldn't reach the email service. Check your connection.")
  }

  let data: { ok?: boolean; error?: string } = {}
  try {
    data = await res.json()
  } catch {
    // Non-JSON response - fall through to the status-based error below.
  }

  return { status: res.status, ok: res.ok && data.ok === true, error: data.error }
}

// Turn a failed API result into a typed, user-facing error.
function classify(result: ApiResult): EmailError {
  const detail = result.error?.trim()
  switch (result.status) {
    case 401:
      // The server couldn't verify the sign-in token. We only reach here AFTER
      // a forced token refresh (see sendForwardEmail), so a stale token is
      // ruled out - the caller's login looks valid but the server still says
      // no. That points at the server-side guard (FIREBASE_API_KEY missing,
      // wrong, or restricted), which re-signing in may or may not fix.
      return new EmailError(
        'reauth',
        "We couldn't verify your sign-in to send this email. Re-authorise below, or sign in again.",
      )
    case 500:
      return new EmailError('config', detail || 'Email is not set up on the server yet.')
    case 502:
    case 503:
      return new EmailError('service', detail || 'The email service is unavailable. Try again shortly.')
    default:
      return new EmailError('unknown', detail || `Email failed (${result.status}).`)
  }
}

// Forwards a captured note to the user's configured work email via our
// /api/email serverless function (which holds the EmailJS keys server-side).
// We attach the signed-in user's Firebase ID token so the endpoint can verify
// the caller and never act as an open relay. On a 401 we transparently retry
// once with a force-refreshed token - that silently fixes the common
// stale/expired-token case without troubling the user. Throws a typed
// EmailError so the UI can offer the right recovery.
export async function sendForwardEmail({ to, subject, text }: SendArgs): Promise<void> {
  const recipient = to.trim()
  if (!recipient) {
    throw new EmailError('no-recipient', 'No forward email is configured. Set one in Settings.')
  }
  if (!text.trim()) throw new EmailError('empty', 'Nothing to send.')

  const user = auth.currentUser
  if (!user) {
    throw new EmailError('signed-out', 'You are signed out. Sign in again to send email.')
  }

  const base = { to: recipient, subject, text }

  const idToken = await user.getIdToken()
  let result = await callEmailApi({ ...base, idToken })

  // 401 might just be a stale cached token: force a fresh one and retry once.
  if (result.status === 401) {
    const fresh = await user.getIdToken(true)
    result = await callEmailApi({ ...base, idToken: fresh })
  }

  if (result.ok) return
  throw classify(result)
}

// A short subject built from the note's first non-empty line. Keeps it cheap
// (no AI call) - the full note goes in the body.
export function subjectFromNote(text: string): string {
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  if (!firstLine) return 'Idea'
  const clipped = firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}...` : firstLine
  return `Idea: ${clipped}`
}
