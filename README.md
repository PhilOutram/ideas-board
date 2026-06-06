# Ideas Board - AI-Friendly Hierarchical Note Taking

A sophisticated, multi-device synchronized ideas management system designed for AI workflows. Capture ideas → explore in boards → export to Claude → sync insights back.

## Features

- **Hierarchical Structure**: Pages → Ideas → Multiple Boards per Idea
- **Temperature Tracking**: Hot 🔥 / Warm 🟡 / Cold ❄️ ideas
- **Multi-Board Pattern**: Each idea has Messy, Tidy, Context, Memory boards (+ custom boards)
- **Inherited Memory**: Child ideas inherit parent page memory; updates cascade down
- **Page-Level Inbox**: Quick capture of unstructured thoughts before promoting to formal ideas
- **Markdown Export**: Copy ideas as formatted markdown for Claude chats
- **Real-Time Sync**: Multi-device sync via Firestore
- **Firebase Auth**: Email-based authentication
- **Polished UI**: Refined, focused design optimized for thinking and creativity

## Architecture

### Frontend
- **React 18** with hooks
- **Firebase SDK** for real-time Firestore sync and authentication
- **Vanilla CSS** (no build complexity)
- Designed for responsive mobile + desktop use

### Backend
- **Firestore** (Firebase's document database) for real-time data sync
- **Firebase Auth** for email/password authentication

### Data Model

```
/pages/{pageId}
  ├── title: string
  ├── context: string (shared with child ideas)
  ├── memory: string (inherited by child ideas)
  ├── order: number
  ├── created: timestamp
  └── /ideas/{ideaId}
      ├── title: string
      ├── temperature: 'hot' | 'warm' | 'cold'
      ├── boards: {
      │   messy: string (raw thoughts)
      │   tidy: string (polished version)
      │   context: string (context + inherited parent context)
      │   memory: string (key points)
      │   [custom]: string (user-defined boards)
      └── created: timestamp, lastEdited: timestamp

  └── /quickIdeas/{quickId}
      ├── text: string
      ├── created: timestamp
      └── (temporary inbox items, promoted to /ideas)
```

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., "ideas-board")
4. Accept Firebase terms, create project
5. Wait for project creation (1-2 minutes)

### 2. Enable Firestore Database

1. In Firebase Console, go to **Build → Firestore Database**
2. Click **Create database**
3. Choose region (closest to you)
4. Select **Start in production mode**
5. Click **Enable**

### 3. Enable Authentication

1. Go to **Build → Authentication**
2. Click **Get started**
3. Click **Email/Password**
4. Enable **Email/Password** and **Enable**
5. (Optional: Enable **Anonymous** for testing)

### 4. Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll to **Your apps** section
3. Click the web app icon (`</>`)
4. Copy the config object (contains API key, project ID, etc.)

### 5. Clone/Download This Project

```bash
# Create a new directory
mkdir ideas-board
cd ideas-board

# Copy the files from this template into the directory
# You should have:
# - IdeasBoard.jsx
# - index.js
# - package.json
# - public/index.html
# - .env.example
```

### 6. Set Up Environment Variables

1. Copy `.env.example` to `.env.local`
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and fill in your Firebase config:
   ```
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   ```

### 7. Install Dependencies and Run Locally

```bash
npm install
npm start
```

This opens the app at `http://localhost:3000`.

### 8. Create Your First Account

1. Sign up with your email (create a password)
2. Start creating pages and ideas!

## Deployment to Vercel

### Quick Deploy (Recommended)

1. Push your code to GitHub (create a public or private repo)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/ideas-board
   git push -u origin main
   ```

2. Go to [Vercel](https://vercel.com/)
3. Click **Import Project**
4. Select your GitHub repo
5. Add environment variables:
   - Copy the same values from `.env.local`
   - Paste into Vercel's environment variables form
6. Click **Deploy**

### Manual Deploy

```bash
npm install -g vercel
vercel login
vercel
```

Follow the prompts to deploy.

## Usage Guide

### Capturing Ideas

**Quick capture to inbox:**
1. On any page, type in the "Quick idea?" input
2. Hit Enter or click "Add"
3. Idea appears in the Inbox section with timestamp
4. From there, you can:
   - **Promote** → Convert to formal idea (creates all boards)
   - **Delete** → Remove from inbox

### Working with Ideas

**Viewing an idea:**
1. Click any idea card
2. Modal opens with all boards
3. Click to edit any board
4. Changes auto-save

**Changing temperature:**
1. Click the emoji (🔥/🟡/❄️) on an idea card
2. Temperature changes; hot ideas float to top

**Exporting for Claude:**
1. Open an idea
2. Scroll to "Export" section
3. Click "Copy as Markdown"
4. Paste into Claude chat

### Context & Memory Inheritance

**How it works:**
- Pages have their own Context and Memory
- Ideas inherit parent page's Memory
- When you update a page's Memory, child ideas see the change
- But each idea can override with its own Memory/Context

**Example workflow:**
1. Create a "Games" page with Memory: "All games need win conditions"
2. Create a "Chess" idea under Games
3. Chess idea automatically inherits that memory
4. You can add Chess-specific memory: "32 pieces, 8x8 board"
5. When viewing Chess, you see both parent + child memory

### Consolidating Insights from Claude

**Workflow:**
1. Export an idea to markdown
2. Paste into Claude chat
3. Discuss, explore, iterate
4. When you have insights:
   - Copy the relevant chat snippet
   - Return to the board
   - Paste into the idea's Messy board with "Add from chat" timestamp
   - Later, manually move polished insights to Context/Memory

**Future: Automated synthesis (Phase 2)**
- "Consolidate insights" button
- Reads messy board + recent chat snippets
- Claude generates updated Context
- Shows diff before you confirm

## Customization

### Changing Board Types

You can add custom boards beyond messy/tidy/context/memory.

**To add a custom board:**
1. Open an idea
2. Boards are stored in the `boards` object
3. To add a new board type, you'd currently need to:
   - Add a new field to the `boards` object in Firestore
   - Add UI to display it (future version)

**Planned: Custom board types** (Phase 2)
- "Add board" button
- Define custom boards per idea (e.g., "mechanics", "graphics", "lore")

### Theming

The color scheme uses:
- Primary accent: `#910A2E` (deep red-mauve)
- Background: `#f5f3f0` (warm off-white)
- Typography: Crimson Text (serif, display) + Inter (sans-serif, body)

To customize, edit the CSS variables in `IdeasBoard.jsx`:
- `.btn-primary` for primary color
- `body` styles for typography
- Color values in card styles

## Troubleshooting

### "CORS error" or "Permission denied"

Make sure:
1. Firestore security rules allow your user (they should by default)
2. Your Firebase config is correct in `.env.local`
3. Environment variables are loaded (restart dev server)

### Ideas not syncing across devices

1. Check that you're signed in to the same account
2. Firestore should sync in real-time (within 1-2 seconds)
3. If stuck, refresh the page

### Auth not working

1. Make sure **Email/Password** is enabled in Firebase Auth
2. Check that your Firebase config is correct
3. Try signing up (it creates an account) rather than signing in

## Performance Notes

- Firestore has a free tier: 50k reads, 20k writes, 20k deletes per day
- Light usage (10-20 ideas, daily updates) will stay well under free tier
- Real-time listeners auto-disconnect when user logs out

## Next Steps

### Phase 2 Features (build on demand)
- [ ] Claude API integration for automated prompts
- [ ] "Consolidate insights" button with smart synthesis
- [ ] Custom board types per idea
- [ ] Tags/cross-linking between ideas
- [ ] Rich text editing (markdown renderer)
- [ ] Image attachments
- [ ] Timestamps on board edits (history)
- [ ] Mobile app wrapper

## Architecture Notes

This is intentionally **client-side first**:
- Firebase handles auth + sync
- No backend server needed
- Scales to thousands of ideas
- Cost-effective (free tier is generous)
- Real-time multi-device sync out of the box

The app is structured for easy extension:
- `IdeasBoard.jsx` is one file (easy to understand)
- Can split into components as it grows
- Firestore queries can be optimized as needed

## License

MIT - Use freely, modify as you wish.

## Questions?

This is your personal tool. Modify it, extend it, make it yours. The code is straightforward React + Firebase, so you should be able to customize anything.

Good luck with your ideas! 🚀
