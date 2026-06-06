export const VERSION = 'v0.07'

export type ChangelogEntry = {
  version: string
  date: string
  notes: string[]
}

// Newest first. Bump VERSION and add an entry here on every commit so
// the deployed build always shows exactly what shipped.
export const CHANGELOG: ChangelogEntry[] = [
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
