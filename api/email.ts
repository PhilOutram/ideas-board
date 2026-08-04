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

// Why a token verification failed. 'invalid-token' is a genuine auth failure
// (re-sign-in may help); 'key-restricted' means Google rejected the API key
// itself - almost always an HTTP-referrer / API restriction that blocks this
// referrer-less server call (signing in won't help); 'unreachable' is a
// transient network problem talking to Google.
type VerifyReason = 'invalid-token' | 'key-restricted' | 'unreachable'
type VerifyResult = { ok: true } | { ok: false; reason: VerifyReason; detail?: string }

// Case-insensitive markers in Google's error message that mean "the key was
// rejected" rather than "the token was bad".
const KEY_BLOCK_MARKERS = /referer|blocked|api key|permission|forbidden/i

// Verify the caller's Firebase ID token so this endpoint can't be abused as an
// open email relay. Uses the (public) Firebase API key + the Identity Toolkit
// REST API, so no firebase-admin dependency is needed. Returns a typed result
// so the handler can tell a blocked key apart from a genuinely bad token and
// give a precise, actionable message.
async function verifyIdToken(idToken: string, apiKey: string): Promise<VerifyResult> {
  let r: Response
  try {
    r = await fetch(`${LOOKUP_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
  } catch {
    return { ok: false, reason: 'unreachable' }
  }

  if (r.ok) {
    const data = (await r.json()) as { users?: unknown[] }
    if (Array.isArray(data.users) && data.users.length > 0) return { ok: true }
    return { ok: false, reason: 'invalid-token' }
  }

  // Non-2xx: read Google's error to distinguish a blocked key from a bad token.
  let message = ''
  try {
    const body = (await r.json()) as { error?: { message?: string } }
    message = body.error?.message ?? ''
  } catch {
    // No JSON body - fall back to the status code below.
  }
  const blocked = r.status === 403 || KEY_BLOCK_MARKERS.test(message)
  return { ok: false, reason: blocked ? 'key-restricted' : 'invalid-token', detail: message }
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

  const verdict = await verifyIdToken(idToken, firebaseApiKey)
  if (!verdict.ok) {
    if (verdict.reason === 'key-restricted') {
      // Surfaced (and logged) so the cause is unambiguous: it's the server
      // guard's API key being rejected by Google, not the user's sign-in.
      console.warn('Email guard: FIREBASE_API_KEY rejected by Google:', verdict.detail)
      res.status(500).json({
        error:
          'Email guard blocked: the server\'s FIREBASE_API_KEY is being rejected by Google, ' +
          'usually an HTTP-referrer or API restriction on the key. In Google Cloud Console, ' +
          'set that key\'s Application restrictions to None (or add the deploy domain) and ' +
          'allow the Identity Toolkit API, then redeploy.',
      })
      return
    }
    if (verdict.reason === 'unreachable') {
      res.status(502).json({ error: 'Could not reach the sign-in verifier. Try again shortly.' })
      return
    }
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
