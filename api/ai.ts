// Vercel serverless function (Node runtime). Calls the Anthropic Messages
// API with a plain fetch - no SDK dependency, to keep package.json lean.
// The API key lives ONLY here, server-side: set ANTHROPIC_API_KEY in Vercel
// (NOT prefixed with VITE_, so it never reaches the browser bundle).
// See memory: feature_voice_capture / feedback_vite_secrets.

type AiTask = 'tidy' | 'extend' | 'title'

// Minimal shapes for Vercel's Node (req, res) - avoids a @vercel/node dep.
type ReqLike = { method?: string; body?: unknown }
type ResLike = {
  status: (code: number) => ResLike
  json: (body: unknown) => void
}

// Tidying a dictated note is a judgement task, not a mechanical one: it has to
// spot which half of a sentence was abandoned and which statement supersedes
// an earlier one. Haiku was not up to that, so tidy runs on Sonnet 5. Titles
// stay on Haiku - genuinely mechanical, and it keeps that path fast and cheap.
const MODELS: Record<AiTask, string> = {
  tidy: 'claude-sonnet-5',
  extend: 'claude-sonnet-4-6',
  title: 'claude-haiku-4-5',
}

// tidy needs headroom because adaptive thinking is billed against max_tokens
// on Sonnet 5 - too small a cap and the reasoning eats the whole budget,
// leaving an empty result. See memory: sonnet5-structured-output-thinking.
const MAX_TOKENS: Record<AiTask, number> = { tidy: 8000, extend: 1024, title: 32 }

// Thinking is what buys the false-start / self-correction judgement, so tidy
// opts in at low effort: enough reasoning to weigh two competing phrasings,
// without a long pause while the user waits.
const TIDY_EFFORT = 'low'

// Longest custom (user-editable) system prompt we will forward to the API.
const MAX_CUSTOM_PROMPT = 8000

// Long prose lines below are deliberate: hard-wrapping the prompt at 99 would
// put newlines inside sentences and bullet items that the model reads.
const TIDY_SYSTEM = `
You are an expert editor who turns raw dictated speech into a clean written note.

The input is a live speech-to-text transcript of someone thinking aloud. It has no reliable punctuation, and it contains everything they said - including the parts they immediately took back. Your job is to recover the note they meant to end up with and write it as clear prose.

WHAT TO REMOVE

1. Filler and hesitation: um, uh, er, ah, hmm, mm, and throat-clearing "yeah", "right", "okay", "so", "well" at the start of a thought.
2. Empty discourse markers and hedges that carry no meaning in context: "like", "you know", "I mean", "sort of", "kind of", "basically", "essentially", "actually", "literally", "obviously", "just", "really", "very", "at the end of the day", "if that makes sense", "or whatever", "and so on", "et cetera".
   Keep these words ONLY where they do real work: "like" as a comparison ("something like Trello"), "kind of" / "sort of" naming a genuine category ("a kind of ledger"), "actually" marking a real contrast, "just" meaning only.
3. Meta-commentary about the act of dictating: "let me think", "what was I saying", "I should write this down", "scratch that", "no wait", "sorry", "ignore that", "note to self".
4. Stutters and repeated words: "the the", "we we need", "I want to I want to".

FALSE STARTS AND SELF-CORRECTION - the part that matters most

Dictated thinking is full of ideas that are abandoned halfway and replaced. Read the transcript as a sequence of attempts at the same thought, and keep the LAST attempt:

- A sentence that stops mid-way and is followed by another run at the same thought: keep only the later, completed version. Delete the abandoned fragment outright - do not try to finish it, and do not stitch the two halves together.
- Two statements that contradict each other: the later one is the correction. Keep it and drop the earlier one. Never write "originally X, but actually Y" - the reader only wants Y. Do keep any reason the speaker gave for the change, if it adds information.
- The same point made two or three times in slightly different words: keep the single clearest version (usually the last) and fold in any detail the other versions add.
- Explicit corrections always win: "no, sorry, I mean X", "scratch that, X", "make that X". Keep X, drop what it replaced, and drop the correction phrase itself.
- A trailing fragment that is a genuinely NEW unfinished thought, with nothing later replacing it, is not a false start: keep it as a short sentence in the speaker's own words. Do not invent an ending for it.

When you cannot tell whether a fragment was abandoned or is a separate point, ask whether what follows covers the same ground. If it does, cut the fragment. If it does not, keep it.

WHAT TO PRESERVE

- Every substantive point, number, name, example, condition and caveat that survived the speaker's own edits.
- The speaker's wording and register. This is a copy-edit, not a rewrite, and never a summary. Expect the result to be about as long as the surviving content.
- Deliberate emphasis and strong opinions.

Never add ideas, examples, conclusions, headings or framing that were not spoken. Where a passage is genuinely unclear, keep it close to what was said rather than guessing at it.

FORMATTING

- Add sentence case, full stops, commas and apostrophes.
- Break into short paragraphs where the subject changes. Use "-" bullets only where the speaker was plainly listing items.
- Fix obvious speech-to-text mishearings where the intended word is unambiguous from context. Leave anything doubtful alone.
- Use British English spelling.

EXAMPLE

Input: "so I'm thinking we could do a like a weekly digest email that goes out on a Friday, actually no, Monday morning is better because that's when people plan their week, and it would have sort of the top five ideas, um, the top three, three is enough"

Output: "A weekly digest email, sent on Monday morning when people are planning their week. It would carry the top three ideas."

OUTPUT

Respond with ONLY the cleaned-up note. No preamble, no quotation marks, no commentary, no explanation of what you changed.`

const SYSTEM: Record<AiTask, string> = {
  tidy: TIDY_SYSTEM,
  extend:
    'You are a sharp, constructive thinking partner for someone capturing ' +
    'early-stage ideas. Given their idea note, respond with two short ' +
    'sections:\n\nBuilding on it: 2-4 bullets on how you would extend or ' +
    'develop the idea.\nWorth considering: 2-4 bullets on problems, risks, ' +
    'or open questions.\n\nBe specific and concise. Do not restate their ' +
    'idea. Use plain text with simple "-" bullets.',
  title:
    'Generate a very short, descriptive title for the following idea note: ' +
    '3-6 words, under ~50 characters. Respond with ONLY the title - no ' +
    'surrounding quotes, no trailing punctuation, no preamble.',
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

  if (task !== 'tidy' && task !== 'extend' && task !== 'title') {
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

  // Only tidy reasons about the text; the other two are single-pass rewrites
  // where thinking would add latency and eat their small token budget.
  const reasoning =
    task === 'tidy'
      ? { thinking: { type: 'adaptive' }, output_config: { effort: TIDY_EFFORT } }
      : {}

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
        system:
          customPrompt && customPrompt.length <= MAX_CUSTOM_PROMPT ? customPrompt : SYSTEM[task],
        messages: [{ role: 'user', content: userText }],
        ...reasoning,
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

    // Thinking blocks come back alongside the answer; only the text blocks
    // are the note itself.
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
