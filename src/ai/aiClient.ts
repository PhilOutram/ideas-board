export type AiTask = 'tidy' | 'extend'

// Calls our server function (api/ai.ts), which holds the Anthropic key.
// Throws with a readable message on failure so the UI can show it and fall
// back to the user's raw text.
export async function callAi(task: AiTask, text: string, instruction?: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task, text, instruction }),
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
