# Ideas Board

An AI-friendly hierarchical ideas board. Capture ideas fast, organise them across
multiple boards per idea, and export them as markdown to develop with Claude.

> Status: in-progress build. Currently at **step 1** of the build order in
> [IDEAS_BOARD_BRIEF.md](IDEAS_BOARD_BRIEF.md) - Vite + React + TypeScript + Firebase
> scaffold is running locally. See the brief for the full vision and feature list.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **Firebase** - Firestore (data) + Auth (email/password)
- **pnpm** for package management
- **Vercel** for hosting (auto-deploy from GitHub `main`)

## Local development

Prereqs: Node 18+, pnpm.

```powershell
pnpm install
pnpm dev          # http://localhost:5173
pnpm typecheck    # TypeScript check
pnpm build        # production build to ./dist
pnpm preview      # serve the production build locally
```

### Environment variables

Create `.env.local` (gitignored) with your Firebase web app config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...   # optional
```

Vite exposes these to client code as `import.meta.env.VITE_*`. Anything that
should stay secret must NOT use the `VITE_` prefix - it will be inlined into
the client bundle.

## Project layout

```
.
├── index.html              # Vite entry (root, not /public)
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── src/
│   ├── main.tsx            # React root render
│   ├── App.tsx             # top-level component
│   ├── firebase.ts         # Firebase init - exports `auth`, `db`
│   ├── index.css
│   └── vite-env.d.ts       # types for import.meta.env
└── IDEAS_BOARD_BRIEF.md    # full product brief and build order
```

## Deployment

The repo is connected to Vercel and auto-deploys on push to `main`. The same
`VITE_FIREBASE_*` variables must be set in the Vercel project settings.

## License

MIT.
