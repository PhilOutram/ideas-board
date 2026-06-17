// Vercel serverless function (Node runtime). Forwards a captured note to the
// user's work email via EmailJS's REST API with a plain fetch - no SDK. The
// @emailjs/browser SDK is browser-oriented (it leans on the page origin), so
// on the server plain fetch is the natural fit, not a workaround. All EmailJS
// keys live ONLY here, server-side, as Vercel env vars (NOT VITE_-prefixed, so
// they never reach the browser bundle). See memory: feedback_vite_secrets /
// feedback_dependency_philosophy.

// Minimal shapes for Vercel's Node (req, res) - avoids a @vercel/node dep.
type ReqLike = { method?: string; body?: unknown }
type ResLike = {
  status: (code: number) => ResLike
  json: (body: unknown) => void
}

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send'
const LOOKUP_ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup'

// Verify the caller's Firebase ID token so this endpoint can't be abused as an
// open email relay. Uses the (public) Firebase API key + the Identity Toolkit
// REST API, so no firebase-admin dependency is needed. Returns true if valid.
async function verifyIdToken(idToken: string, apiKey: string): Promise<boolean> {
  try {
    const r = await fetch(`${LOOKUP_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!r.ok) return false
    const data = (await r.json()) as { users?: unknown[] }
    return Array.isArray(data.users) && data.users.length > 0
  } catch {
    return false
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default async function handler(req: ReqLike, res: ResLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const serviceId = process.env.EMAILJS_SERVICE_ID
  const templateId = process.env.EMAILJS_TEMPLATE_ID
  const publicKey = process.env.EMAILJS_PUBLIC_KEY
  const privateKey = process.env.EMAILJS_PRIVATE_KEY // optional (strict mode)
  const firebaseApiKey = process.env.FIREBASE_API_KEY

  if (!serviceId || !templateId || !publicKey) {
    res.status(500).json({ error: 'Email is not configured yet (missing EMAILJS_* env vars).' })
    return
  }
  if (!firebaseApiKey) {
    res.status(500).json({ error: 'Email guard is not configured (missing FIREBASE_API_KEY).' })
    return
  }

  let body: { to?: string; subject?: string; text?: string; idToken?: string }
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : ((req.body as typeof body) ?? {})
  } catch {
    res.status(400).json({ error: 'Invalid JSON body.' })
    return
  }

  const to = (body.to ?? '').trim()
  const subject = (body.subject ?? '').trim() || 'Idea'
  const text = (body.text ?? '').trim()
  const idToken = (body.idToken ?? '').trim()

  if (!idToken) {
    res.status(401).json({ error: 'Missing auth token.' })
    return
  }
  if (!isEmail(to)) {
    res.status(400).json({ error: 'No valid recipient email.' })
    return
  }
  if (!text) {
    res.status(400).json({ error: 'No text to send.' })
    return
  }

  const authed = await verifyIdToken(idToken, firebaseApiKey)
  if (!authed) {
    res.status(401).json({ error: 'Not authorised.' })
    return
  }

  // template_params must match the variables in the EmailJS template:
  // {{to_email}} (the template's To field), {{subject}}, {{message}}.
  const params: Record<string, string> = { to_email: to, subject, message: text }

  try {
    const r = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        // Only sent when set - EmailJS "strict mode" / non-browser API calls.
        ...(privateKey ? { accessToken: privateKey } : {}),
        template_params: params,
      }),
    })

    if (!r.ok) {
      const detail = await r.text()
      res.status(502).json({ error: `Email service error (${r.status}): ${detail || 'unknown'}` })
      return
    }

    res.status(200).json({ ok: true })
  } catch {
    res.status(502).json({ error: 'Could not reach the email service. Try again.' })
  }
}
