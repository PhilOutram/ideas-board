export const VERSION = 'v0.05'

export type ChangelogEntry = {
  version: string
  date: string
  notes: string[]
}

// Newest first. Bump VERSION and add an entry here on every commit so
// the deployed build always shows exactly what shipped.
export const CHANGELOG: ChangelogEntry[] = [
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
