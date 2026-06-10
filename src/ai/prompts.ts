// Default instruction sent to the AI when generating "thoughts" on an idea.
// Keep this in sync with the `extend` fallback in api/ai.ts (the client now
// always sends this prompt, so api/ai.ts's copy is just a safety net).
export const DEFAULT_THOUGHTS_PROMPT = `You are a sharp, constructive thinking partner for someone capturing early-stage ideas. Given their idea note, respond with two short sections:

Building on it: 2-4 bullets on how you would extend or develop the idea.
Worth considering: 2-4 bullets on problems, risks, or open questions.

Be specific and concise. Do not restate their idea. Use plain text with simple "-" bullets.`

const STORAGE_KEY = 'ideasboard.thoughtsPrompt'

// Per-device override (localStorage). Returns the user's custom prompt if set,
// otherwise the default. Note: this is per-device and does NOT sync across
// devices - if cross-device sync is wanted later, move it to Firestore.
export function getThoughtsPrompt(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THOUGHTS_PROMPT
  } catch {
    return DEFAULT_THOUGHTS_PROMPT
  }
}

export function setThoughtsPrompt(prompt: string): void {
  try {
    const trimmed = prompt.trim()
    // Storing the default (or empty) just clears the override.
    if (!trimmed || trimmed === DEFAULT_THOUGHTS_PROMPT) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, trimmed)
    }
  } catch {
    // localStorage unavailable (e.g. private mode) - silently ignore.
  }
}
