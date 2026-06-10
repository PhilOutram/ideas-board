export type AiTask = 'tidy' | 'extend' | 'title'

type AiOptions = {
  instruction?: string // tidy: an extra tweak like "shorter" / "as bullets"
  prompt?: string // extend: override the system prompt (user-editable)
}

// Calls our server function (api/ai.ts), which holds the Anthropic key.
// Throws with a readable message on failure so the UI can show it and fall
// back to the user's raw text.
export async function callAi(task: AiTask, text: string, opts: AiOptions = {}): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task, text, instruction: opts.instruction, prompt: opts.prompt }),
  })

  let data: { result?: string; error?: string } = {}
  try {
    data = await res.json()
  } catch {
    // Non-JSON response - e.g. a 404 under plain `vite dev`, where /api
    // functions aren't served. Fall through to the status-based error.
  }

  if (!res.ok) {
    throw new Error(data.error ?? `AI request failed (${res.status}).`)
  }
  return (data.result ?? '').trim()
}

// A short idea title via Haiku, with a graceful fallback (first few words) if
// the AI is unavailable - so promoting an idea never blocks on the network.
export async function makeIdeaTitle(text: string): Promise<string> {
  const fallback = fallbackTitle(text)
  try {
    const title = cleanTitle(await callAi('title', text))
    return title || fallback
  } catch {
    return fallback
  }
}

function cleanTitle(raw: string): string {
  return raw.trim().replace(/^["'#\s]+/, '').replace(/["'.\s]+$/, '').slice(0, 80)
}

function fallbackTitle(text: string): string {
  const firstLine = text.trim().split('\n')[0] ?? ''
  const words = firstLine.split(/\s+/).filter(Boolean).slice(0, 8).join(' ')
  if (!words) return 'Untitled idea'
  return words.length > 60 ? `${words.slice(0, 57).trimEnd()}...` : words
}
