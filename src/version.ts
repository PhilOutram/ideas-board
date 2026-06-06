export const VERSION = 'v0.03'

export type ChangelogEntry = {
  version: string
  date: string
  notes: string[]
}

// Newest first. Bump VERSION and add an entry here on every commit so
// the deployed build always shows exactly what shipped.
export const CHANGELOG: ChangelogEntry[] = [
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
