export const VERSION = 'v0.22'

export type ChangelogEntry = {
  version: string
  date: string
  notes: string[]
}

// Newest first. Bump VERSION and add an entry here on every commit so
// the deployed build always shows exactly what shipped.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v0.22',
    date: '2026-06-11',
    notes: [
      'Voice/AI error messages can now be dismissed with an "×" so they stop taking up space on the card - handy on a phone.',
      'Every idea card now has a "Copy" button in its corner: one tap copies that idea to the clipboard as markdown (bold title), ready to paste into a chat.',
      'Recording now keeps your phone screen awake, so the screen turning off no longer cuts the capture short.',
      'After a voice capture you can now also send it straight to the Inbox (for short notes to deal with later), alongside Save as idea / memory / context.',
      'The "AI thoughts" are now editable while recording - trim or delete the bits you do not want before saving.',
    ],
  },
  {
    version: 'v0.21',
    date: '2026-06-11',
    notes: [
      'Import Markdown: paste a Markdown document (e.g. your design book exported from Word) and it builds the whole nested section tree - each #/##/### heading becomes a page, the text under it becomes that page\'s content. Live preview shows the tree before you import.',
      'Import under the current page, or as new top-level pages.',
      'Imported section content shows on the page (plain text for now; rich rendering + editing comes next).',
    ],
  },
  {
    version: 'v0.20',
    date: '2026-06-11',
    notes: [
      'Inherited memory on a sub-section is now tucked away at the bottom and collapsed by default, so it no longer dominates the page - expand it only when you want it.',
    ],
  },
  {
    version: 'v0.19',
    date: '2026-06-10',
    notes: [
      'Pages can now nest into a wiki-style tree: add sub-sections under any page (the "+" by each page), expand/collapse branches, and see the path to the current page as a breadcrumb. The first step toward a full design-book.',
      'Memory now cascades down the whole tree: an idea (or page) inherits memory from every ancestor section above it, nearest taking precedence.',
    ],
  },
  {
    version: 'v0.18',
    date: '2026-06-10',
    notes: [
      'Ideas now get a short AI-generated title (instead of using the whole note as the title). The full text lives in the Messy board.',
      'Idea cards are now compact - a short title and a few lines of preview, ending in "..."; click to open the full idea.',
      'Voice capture is faster to act on: after recording you get three direct buttons - Save as idea, Add to memory, Add to context - no inbox hop or menus.',
      'Your custom "AI thoughts" prompt now syncs across your devices (saved to your account) instead of being stuck on one browser.',
    ],
  },
  {
    version: 'v0.17',
    date: '2026-06-10',
    notes: [
      'Copy for Claude: export to your clipboard as clean markdown, ready to paste into a Claude chat. Includes a short preamble, the page Context, the page Memory (framed as protocols & reminders), then the idea(s) and their boards.',
      'Two options: "Copy for Claude" inside an idea copies that single idea; "Copy all ideas for Claude" by the page title copies every idea on the page. Empty sections are skipped.',
    ],
  },
  {
    version: 'v0.16',
    date: '2026-06-09',
    notes: [
      'Customise the AI thoughts prompt: in a voice capture, click the cog next to "AI thoughts" to edit the instruction sent to the AI, then Save (or Reset to default). Stored on your device.',
    ],
  },
  {
    version: 'v0.15',
    date: '2026-06-09',
    notes: [
      'AI tidy-up: after a voice capture, your rambly dictation is cleaned up automatically - filler words, false starts and repetition removed, meaning kept. Edit it, or ask for tweaks like "make it shorter" or "as bullets".',
      'AI thoughts: tap "Add AI thoughts" for suggestions on how to build on the idea plus problems worth considering - keep or discard. Tidy + thoughts also work for typed notes, not just voice.',
      'The tidied idea saves to your inbox (optionally keeping your original words too).',
      'Firestore now auto-detects long-polling, quieting connection warnings and making sync more reliable on strict networks.',
    ],
  },
  {
    version: 'v0.14',
    date: '2026-06-09',
    notes: [
      'Voice capture duplication on Android really fixed this time: the transcript now detects when the browser is just re-reporting the same phrase as it grows, and replaces rather than stacks it.',
      'Voice capture now fails gracefully in browsers without speech support (e.g. Edge, Firefox): instead of getting stuck on "Listening...", it shows a clear message and lets you type. Reliable voice in those browsers needs the upcoming server-side fallback.',
      'Quieten a console warning by adding the standard mobile-web-app-capable tag.',
    ],
  },
  {
    version: 'v0.13',
    date: '2026-06-08',
    notes: [
      'Installable app: add Ideas Board to your phone home screen ("Install app" / "Add to Home Screen") for one-tap, full-screen access. Uses your app icon.',
      'Proper multi-size and padded icons get refined in a later polish pass.',
    ],
  },
  {
    version: 'v0.12',
    date: '2026-06-08',
    notes: [
      'Fix voice capture on Android Chrome: text was duplicating wildly ("okay okay okay here\'s...") because the browser re-reports each phrase as it grows. Transcription now de-duplicates correctly.',
    ],
  },
  {
    version: 'v0.11',
    date: '2026-06-08',
    notes: [
      'Voice capture (beta): tap the mic in a page inbox, speak, and your words transcribe live. Hit stop, tweak the text if needed, and save it straight to the inbox.',
      'Works in Chrome on Android and desktop today. An iPhone/Firefox fallback and one-tap AI tidy-up are coming next.',
    ],
  },
  {
    version: 'v0.10',
    date: '2026-06-07',
    notes: [
      'Memory inheritance: open an idea and you now see an "Inherited memory" block - the parent page\'s memory - directly above the idea\'s own Memory board. The idea\'s own memory takes precedence.',
      'Inheritance is live: edit a page\'s memory and every idea under it reflects the change automatically (nothing is copied or duplicated).',
    ],
  },
  {
    version: 'v0.09',
    date: '2026-06-07',
    notes: [
      'Click an idea card to open it. The drill-in view shows every board (Messy, Tidy, Context, Memory) and lets you edit the title and each board inline - changes auto-save as you type and sync across devices.',
      'Add your own boards to an idea on the fly (e.g. "mechanics", "lore", "polished pitch") - no fixed templates.',
      'Delete an idea from inside its drill-in view (with a confirm step).',
    ],
  },
  {
    version: 'v0.08',
    date: '2026-06-07',
    notes: [
      'Ideas! Use an inbox item\'s "..." menu to "Promote to idea" - it becomes a card with the default boards, seeded from your captured text, and leaves the inbox.',
      'Ideas show as cards sorted by temperature: hot floats to the top, then warm. New ideas default to warm.',
      'Click the temperature badge on a card to cycle cold -> warm -> hot. Cold ideas drop into a collapsible "Cold / archived" section (never deleted, just tucked away).',
    ],
  },
  {
    version: 'v0.07',
    date: '2026-06-06',
    notes: [
      'Send-to-memory / send-to-context now prefixes the snippet with a stable absolute date (e.g. "6 Jun 2026") instead of the live relative time. Live relative time stays in the inbox only - it makes no sense once frozen into prose that will be read months later.',
    ],
  },
  {
    version: 'v0.06',
    date: '2026-06-06',
    notes: [
      'Smarter inbox timestamps: "just now", "5m", "14:32" (today), "Yest 14:32", "Mon 14:32" (this week), "5 Mar" (this year), "5 Mar 24" (older). Hover any stamp for the full date and time.',
    ],
  },
  {
    version: 'v0.05',
    date: '2026-06-06',
    notes: [
      'Page-level Inbox: type a quick idea, hit Enter, it lands with a timestamp and syncs in real time.',
      'Each inbox item has a "..." action menu: send to Memory, send to Context, or delete.',
      'Pages now show a small read-only summary of Memory and Context below the inbox so send-to-X is visible (full editors come with the boards in step 6).',
    ],
  },
  {
    version: 'v0.04',
    date: '2026-06-06',
    notes: [
      'Pages: create, list, and select pages from a sidebar. Pages are stored in Firestore and sync across devices in real time.',
      'Each page is scoped to its creator (owner uid), so accounts are isolated even though Firestore rules currently allow any signed-in user.',
    ],
  },
  {
    version: 'v0.03',
    date: '2026-06-06',
    notes: [
      'No more silent blank pages: Firebase startup errors and React render errors now show a readable on-screen message with the version number, instead of a blank screen.',
      'Firebase initialisation checks that all required VITE_FIREBASE_* env vars are set and reports any that are missing.',
    ],
  },
  {
    version: 'v0.02',
    date: '2026-06-06',
    notes: [
      'Fix Vercel deploy: tell Vercel the build output lives in dist/ (Vite default), not build/ (the old CRA path).',
    ],
  },
  {
    version: 'v0.01',
    date: '2026-06-06',
    notes: [
      'Initial Vite + React + TypeScript + Firebase scaffold.',
      'Email/password auth: sign-up, sign-in, sign-out with friendly error messages.',
      'Version indicator next to the title - click it to see the changelog.',
    ],
  },
]
