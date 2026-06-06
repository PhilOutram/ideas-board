export const VERSION = 'v0.01'

export type ChangelogEntry = {
  version: string
  date: string
  notes: string[]
}

// Newest first. Bump VERSION and add an entry here on every commit so
// the deployed build always shows exactly what shipped.
export const CHANGELOG: ChangelogEntry[] = [
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
