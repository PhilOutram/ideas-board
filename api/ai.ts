// Vercel serverless function (Node runtime). Calls the Anthropic Messages
// API with a plain fetch - no SDK dependency, to keep package.json lean.
// The API key lives ONLY here, server-side: set ANTHROPIC_API_KEY in Vercel
// (NOT prefixed with VITE_, so it never reaches the browser bundle).
// See memory: feature_voice_capture / feedback_vite_secrets.

type AiTask = 'tidy' | 'extend'

// Minimal shapes for Vercel's Node (req, res) - avoids a @vercel/node dep.
type ReqLike = { method?: string; body?: unknown }
type ResLike = {
  status: (code: number) => ResLike
  json: (body: unknown) => void
}

// Per agreed defaults: cheap/mechanical cleanup on Haiku, creative critique
// on Sonnet. Switchable later.
const MODELS: Record<AiTask, string> = {
  tidy: 'claude-haiku-4-5',
  extend: 'claude-sonnet-4-6',
}

const MAX_TOKENS: Record<AiTask, number> = { tidy: 2048, extend: 1024 }

const SYSTEM: Record<AiTask, string> = {
  tidy:
    'You clean up rough, dictated idea notes. Remove filler words ("um", ' +
    '"ah", "like"), false starts, and accidental repetition. Add light ' +
    'punctuation and fix obvious speech-to-text errors. Preserve the ' +
    "speaker's meaning, intent, and every substantive point - do not " +
    'summarise, do not add new ideas, do not editorialise, and keep their ' +
    'voice. Respond with ONLY the cleaned-up note text - no preamble, no ' +
    'quotation marks, no commentary.',
  extend:
    'You are a sharp, constructive thinking partner for someone capturing ' +
    'early-stage ideas. Given their idea note, respond with two short ' +
    'sections:\n\nBuilding on it: 2-4 bullets on how you would extend or ' +
    'develop the idea.\nWorth considering: 2-4 bullets on problems, risks, ' +
    'or open questions.\n\nBe specific and concise. Do not restate their ' +
    'idea. Use plain text with simple "-" bullets.',
}

export default async function handler(req: ReqLike, res: ResLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'AI is not configured yet (missing ANTHROPIC_API_KEY).' })
    return
  }

  let body: { task?: string; text?: string; instruction?: string; prompt?: string }
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : ((req.body as typeof body) ?? {})
  } catch {
    res.status(400).json({ error: 'Invalid JSON body.' })
    return
  }

  const task = body.task
  const text = (body.text ?? '').trim()
  const instruction = (body.instruction ?? '').trim()
  // Optional client-supplied system prompt (the user-editable thoughts prompt).
  // Capped to a sane length; falls back to the built-in default per task.
  const customPrompt = (body.prompt ?? '').trim()

  if (task !== 'tidy' && task !== 'extend') {
    res.status(400).json({ error: 'Unknown task.' })
    return
  }
  if (!text) {
    res.status(400).json({ error: 'No text provided.' })
    return
  }

  const userText =
    task === 'tidy'
      ? instruction
        ? `Clean up this note, and also apply this instruction: ${instruction}\n\n${text}`
        : `Clean up this dictated note:\n\n${text}`
      : text

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELS[task],
        max_tokens: MAX_TOKENS[task],
        system: customPrompt && customPrompt.length <= 8000 ? customPrompt : SYSTEM[task],
        messages: [{ role: 'user', content: userText }],
      }),
    })

    const data = (await r.json()) as {
      content?: Array<{ type: string; text?: string }>
      error?: { message?: string }
    }

    if (!r.ok) {
      res.status(502).json({ error: data?.error?.message ?? `AI request failed (${r.status}).` })
      return
    }

    const result = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim()

    res.status(200).json({ result })
  } catch {
    res.status(502).json({ error: 'Could not reach the AI service. Try again.' })
  }
}
