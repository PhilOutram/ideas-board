import { auth } from '../firebase'

type SendArgs = { to: string; subject: string; text: string }

// Forwards a captured note to the user's configured work email via our
// /api/email serverless function (which holds the EmailJS keys server-side).
// We attach the signed-in user's Firebase ID token so the endpoint can verify
// the caller and never act as an open relay. Throws a readable error so the UI
// can surface it.
export async function sendForwardEmail({ to, subject, text }: SendArgs): Promise<void> {
  const recipient = to.trim()
  if (!recipient) throw new Error('No forward email is configured. Set one in Settings.')
  if (!text.trim()) throw new Error('Nothing to send.')

  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('You need to be signed in to send email.')

  const res = await fetch('/api/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to: recipient, subject, text, idToken }),
  })

  let data: { ok?: boolean; error?: string } = {}
  try {
    data = await res.json()
  } catch {
    // Non-JSON response - e.g. a 404 under plain `vite dev`, where /api
    // functions aren't served. Fall through to the status-based error.
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Email failed (${res.status}).`)
  }
}

// A short subject built from the note's first non-empty line. Keeps it cheap
// (no AI call) - the full note goes in the body.
export function subjectFromNote(text: string): string {
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  if (!firstLine) return 'Idea'
  const clipped = firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}...` : firstLine
  return `Idea: ${clipped}`
}
