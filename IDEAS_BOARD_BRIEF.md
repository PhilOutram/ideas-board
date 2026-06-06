# Ideas Board — Project Brief & Build Spec

> **Purpose of this document:** A complete handoff brief to build the "Ideas Board" app from scratch in Claude Code using Vite. It captures the concept, design decisions, data model, feature set, and architecture so you can build it properly with the ability to run, test, and iterate. Treat this as the project's "context board."

---

## 1. The Concept

An **AI-friendly hierarchical ideas board**. A personal thinking system for capturing, organising, exploring, and developing ideas — designed to work hand-in-glove with Claude.

The core insight: the structure deliberately mirrors **how both the human brain and LLMs organise information** — hierarchical context, layered memory (working vs. long-term), and multiple views on a single concept. It "speaks Claude's language" because that language also happens to be a sensible model for idea curation.

### The workflow it enables
1. Capture ideas fast, with minimal friction, into the right space
2. Drill into any idea and explore it across multiple "boards" (messy, tidy, context, memory, custom)
3. Export an idea (or any single board) as clean markdown
4. Drop that markdown into a Claude chat (free, using Claude Max — no per-token cost) and develop it
5. Bring insights back into the board via "add from chat" and (optionally) preset reconciliation prompts

### Design priority (most important first)
1. **Capture speed.** The single most important feature: come up with an idea and get it onto the right board with near-zero friction. A real brainstorming space where ideas feel instantly safe and captured.
2. Navigation between pages and drilling into ideas
3. Copy/export for Claude
4. Re-entry of insights from chat

---

## 2. Architecture Decisions

- **Build tool:** **Vite** (NOT Create React App — CRA is deprecated/unmaintained). Use `npm create vite@latest` with the React template.
- **Frontend:** React 18 with hooks. Functional components.
- **Backend:** **Firebase** — Firestore (real-time database) + Firebase Auth (email/password). Already set up and working (see §8).
- **Hosting:** **Vercel**, auto-deploying from GitHub on push. Already set up (see §8).
- **Styling:** Open to choice. Current scaffold used inline `<style>` block with vanilla CSS — fine to keep simple, but splitting into CSS modules or a clean single stylesheet is welcome. No heavy framework. (Owner preference: vanilla, minimal dependencies.)
- **File structure:** Split into sensible components — do NOT build one giant single-file component (the previous scaffold was ~900 lines in one file, which is a known mistake to avoid; see §9).

### Owner's standing preferences
- Strong preference for **vanilla / minimal-dependency** frontend apps. Avoid unnecessary frameworks and libraries.
- Prefers **targeted, minimal file changes** over full rewrites when patching later.
- Experienced with Claude Code on Windows/PowerShell, GitHub, and Vercel workflows.

---

## 3. Data Model (Firestore)

Hierarchy: **Pages → Ideas → Boards**. Every level has its own context and memory, and memory is inherited down the tree.

```
/pages/{pageId}
  ├── title: string
  ├── order: number
  ├── context: string          // page-level context
  ├── memory: string           // page-level memory (inherited by child ideas)
  ├── created: timestamp
  │
  ├── /ideas/{ideaId}
  │     ├── title: string
  │     ├── temperature: 'hot' | 'warm' | 'cold'
  │     ├── boards: {
  │     │     messy:   string,   // raw, unstructured thoughts (also a chat-history sink)
  │     │     tidy:    string,   // polished / cleaned-up version
  │     │     context: string,   // the idea's own context
  │     │     memory:  string,   // key distilled points
  │     │     [custom]: string   // user-defined boards, added on the fly
  │     │   }
  │     ├── created: timestamp
  │     └── lastEdited: timestamp
  │
  └── /quickIdeas/{quickId}      // the page-level "Inbox" / messy capture
        ├── text: string
        └── created: timestamp
```

> **Note:** The hierarchy may want to extend further (sub-pages, or ideas containing sub-ideas). For MVP, two levels (Pages → Ideas) is enough, but design the data model so deeper nesting could be added later without a rewrite.

---

## 4. Key Design Concepts (the important details)

### 4a. Memory inheritance (Option A — inheritance + extension)
- A child idea **inherits** the memory of its parent page (and, if deeper nesting is added, all ancestors).
- The child ALSO has its own memory which **extends** the inherited memory.
- **Conflict rule:** if child memory conflicts with parent memory, **the child (more local) memory wins.**
- When a parent's memory is updated, the change **cascades down** so children see the new context automatically.
- **On export:** include inherited memory explicitly so a Claude chat gets the full picture (e.g. an "Inherited context" section plus the idea's own).

*Example:* A "Games" page has memory "All games need win conditions, turn structure." A "Chess" idea under it inherits that and adds its own "32 pieces, 8×8 board." Viewing/exporting Chess shows both; if they ever conflict, Chess's version takes precedence.

### 4b. Temperature (idea lifecycle state)
- Every idea has a temperature: **🔥 Hot / 🟡 Warm / ❄️ Cold.** New ideas default to **Warm**.
- One-click toggle on the card to change it.
- **Visual treatment:** subtle background tint + temperature icon (hot = warm glow, cold = cool tint + slightly faded). Not garish.
- **Sorting:** hot ideas sort to the top; but manual reordering should override sort.
- Cold ideas can optionally collapse into an "Archived/Cold" section to reduce clutter (they are never deleted, just de-emphasised).

### 4c. Boards (multiple views per idea)
- Default boards, always present: **Messy, Tidy, Context, Memory.**
- Users can **add custom boards per idea on the fly** (e.g. "mechanics", "units & graphics", "lore", "polished pitch"). This is vital — not optional.
- No enforced templates beyond the four defaults.
- Each board has an individual **Copy** button. There is also an **Export whole idea** as one markdown block (user gets to choose the granularity).

### 4d. Page-level "Inbox" / messy board (capture at every level)
- A messy capture space exists **at every level**, not just per-idea. At the page level it acts as an "Inbox."
- A quick-add input is always visible: type (or paste, or voice-to-text) an idea → Enter → it appears with a timestamp. Sub-second, minimal fuss.
- Each captured quick idea has an **action menu** with multiple options:
  - **Promote to formal idea** (creates a new idea with the default boards)
  - **Send to memory** (append to this page's memory board)
  - **Send to context** (append to this page's context board)
  - **Start a chat** (open the idea in a Claude flow with parent context auto-pulled — Phase 2)
  - **Archive / delete**

---

## 5. AI Workflow Integration

This is what makes it "AI-friendly." Two complementary modes, **both wanted**:

### 5a. Quick-copy (free, default)
- Copy any single board, or the whole idea, as clean markdown.
- Paste into a Claude chat (Claude Max → effectively free, long chats fine).
- Develop the idea, then bring insights back manually.

### 5b. Preset prompts + (optional) Claude API integration (opt-in, costs tokens)
- One-click buttons that **collect the right data AND supply a prompt**, ready to paste into Claude — or, if API integration is enabled, run directly in-app.
- Example preset: **"Reconcile memory against tidy content"** → gathers the Memory board + the Tidy board + a prompt instructing Claude to find what's new/different (especially new) in the tidy version and fold it into an updated tidy board, which the user can copy back.
- Other likely presets: "Extract game mechanics from this chat," "What changed in scope?," "Remember this for next time," "Tidy up this messy chat into the tidy board."
- **API integration is opt-in** so the user controls token spend. Default experience is free (quick-copy). When enabled, costs are tiny (~fractions of a cent per call) but should remain the user's explicit choice. Use the Anthropic Messages API; model can be a current Claude model. Never hardcode/expose an API key in client code — handle via env/proxy.

### 5c. Context/memory updates — "Option A + C hybrid" (agreed approach)
Do **NOT** auto-update context on every session (rejected as too aggressive / token-heavy). Instead:
- **(A) Explicit manual save:** during/after a chat, one-click "Add to context" / "Add to memory" buttons that append a selected snippet with a timestamp.
- **(C) Optional end-of-session "Consolidate insights":** a button (off by default) that, only for ideas actively edited this session, asks Claude to extract key insights and suggest context/memory updates, then **shows a diff for the user to review before committing.**
- **Guiding principle:** *Context should be curated, not auto-generated.* Memory can accumulate more rawly; context must be intentional.

### 5d. Direct chat-to-board input
- Allow inputting messy ideas via a chat-like interface (it feels naturally messier), with the ability to immediately **tidy it up** and route it (to memory, tidy board, etc.).

---

## 6. Feature Set: MVP vs Phase 2

### MVP (build first)
- [ ] Vite + React + Firebase project scaffolded and running
- [ ] Firebase Auth (email/password) — **including a working SIGN-UP** (see known bug §9)
- [ ] Pages: create, list, navigate/swipe between
- [ ] Page-level Inbox with quick-add + timestamps
- [ ] Quick-idea action menu (promote / send to memory / send to context / delete)
- [ ] Ideas with temperature (hot/warm/cold), default warm, one-click toggle, temperature-based sorting + sections
- [ ] Idea drill-in view showing all boards
- [ ] Default boards (messy, tidy, context, memory) + **add custom boards on the fly**
- [ ] Edit boards inline, auto-save to Firestore
- [ ] **Memory inheritance** (parent → child, child overrides on conflict, cascade on update) — *this was described but NOT implemented in the old scaffold; build it properly*
- [ ] Copy individual board + export whole idea as markdown (with inherited context included)
- [ ] Real-time multi-device sync via Firestore
- [ ] Responsive (works well on phone and laptop — capture on mobile matters)

### Phase 2 (build on demand)
- [ ] Preset prompt buttons (quick-copy mode)
- [ ] Optional Claude API integration for in-app reconciliation (opt-in, token-aware)
- [ ] End-of-session "Consolidate insights" with diff review
- [ ] "Add from chat" snippet capture with timestamp
- [ ] Tags / cross-linking between ideas
- [ ] Deeper nesting (sub-pages or sub-ideas)
- [ ] Rich-text / markdown rendering in boards
- [ ] Voice-to-text capture
- [ ] Image attachments
- [ ] Board edit history / timestamps
- [ ] Sharing: read-only vs edit access for others (see §7)

---

## 7. Auth & Sharing

- **For now:** email/password auth (Firebase). Owner signs in with email; this is the MVP approach and is fine to start.
- **Future sharing idea (Phase 2):** ability to share a board with others — possibly password-based access tiers (an edit password + a read-only password), set per top-level page, OR a read-only shared link. Not needed for MVP, but keep it in mind so the data model and rules don't preclude it.

---

## 8. Current Setup State (already working — reuse, don't redo)

The owner has already set up the backend and hosting. Reuse these; don't recreate from zero.

- **Firebase project:** created. Firestore enabled (production mode). Email/Password auth enabled. Web app registered; config obtained.
- **Firestore security rules** in place (authenticated users only):
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```
  *(Tighten later to per-user ownership when sharing/multi-user is added.)*
- **Environment variables** (Vite uses the `VITE_` prefix, NOT `REACT_APP_` — this is a required change from the old CRA scaffold). Expected vars:
  ```
  VITE_FIREBASE_API_KEY=...
  VITE_FIREBASE_AUTH_DOMAIN=...
  VITE_FIREBASE_PROJECT_ID=...
  VITE_FIREBASE_STORAGE_BUCKET=...
  VITE_FIREBASE_MESSAGING_SENDER_ID=...
  VITE_FIREBASE_APP_ID=...
  ```
  Access in code via `import.meta.env.VITE_FIREBASE_API_KEY` (Vite syntax), not `process.env`.
- **GitHub repo:** connected, with `.env`/`.env.local` git-ignored.
- **Vercel:** project connected to the GitHub repo, auto-deploys on push. Environment variables to be added in Vercel dashboard (with the new `VITE_` names). Vercel Web Analytics requires the `@vercel/analytics` package + `<Analytics />` component (or the Vercel Agent auto-PR) — not fully automatic.

---

## 9. Known Issues in the Previous Scaffold (avoid repeating)

The first version was a rough scaffold. Things to fix/avoid:
1. **Sign-up was broken:** the "Sign Up" button called `signInWithEmailAndPassword` instead of `createUserWithEmailAndPassword`. Implement real account creation.
2. **Memory inheritance was described but never implemented.** Build the actual cascade + override logic.
3. **Custom boards were not implemented.** The UI only rendered the four hardcoded boards. Make boards dynamic.
4. **Single ~900-line file.** Split into components (e.g. `App`, `AuthScreen`, `PagesSidebar`, `PageView`, `Inbox`, `IdeaCard`, `IdeaModal`, `BoardEditor`, `ExportPanel`) and a `firebase.js` config module.
5. **CRA + `REACT_APP_` env vars.** Replace with Vite + `VITE_` env vars and `import.meta.env`.
6. **No "add from chat" / preset prompts / consolidate** — these were specified but not built (Phase 2, but design for them).
7. Inline-styles-as-one-giant-string is workable but consider a cleaner stylesheet approach.

---

## 10. Aesthetic / UX Direction

- **Tone:** a refined designer's workspace, not a corporate productivity tool. Calm but energetic; creative but organised. Generous negative space.
- **Typography:** distinctive pairing — e.g. a serif display face (the scaffold used Crimson Text) + a clean sans for body (Inter). Open to better choices.
- **Accent colour:** the scaffold used the owner's brand colour `#910A2E` (deep red-mauve). Reusable, but not mandatory.
- **Temperature visualisation** is a signature visual feature — get it tasteful (subtle tint + icon, hot floats up, cold fades/collapses).
- **Capture must feel instant and effortless** — the quick-add should be the most frictionless thing in the app.

---

## 11. Suggested Build Order (for Claude Code)

1. Scaffold Vite + React; add Firebase; wire up `firebase.js` from `VITE_` env vars; confirm it runs.
2. Auth screen with working sign-up + sign-in + sign-out.
3. Pages: create/list/select, stored in Firestore, real-time.
4. Page Inbox: quick-add + timestamped list + action menu.
5. Ideas: promote from inbox, render as temperature-sorted cards, toggle temperature.
6. Idea modal: render boards dynamically, inline edit + auto-save, add custom boards.
7. Memory inheritance: compute inherited memory, override-on-conflict, cascade on parent update; surface in the idea view.
8. Export: per-board copy + whole-idea markdown (including inherited context).
9. Responsive polish + temperature aesthetics.
10. Commit, push, confirm Vercel deploy + env vars. Then tackle Phase 2 items as desired.

---

*End of brief. Drop this into Claude Code and say: "Build this with Vite — start with step 1 of the suggested build order."*
