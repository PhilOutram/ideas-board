# Email setup guide - "forward an idea to my work account"

A plain-English walkthrough of what the email feature is, how it works, and the
exact steps to switch it on. No prior knowledge assumed.

---

## 1. The big picture (what we're actually building)

You want: **capture an idea → press ✉ → it lands in your work inbox.**

There are three parts involved. You only have to configure two of them; the
third (the app code) is already done.

| Part | What it does | Who sets it up |
|------|--------------|----------------|
| **The app** (Ideas Board) | Shows the ✉ button, knows your work email | ✅ Already built |
| **A small server function** (`/api/email`) | The trusted middleman: holds the secret keys, checks it's really you, then asks EmailJS to send | ✅ Already built - you just feed it settings |
| **EmailJS** | The actual email-sending service that puts the message in an inbox | 🔧 You configure this |

**Why a middleman?** The app runs in your browser, and anything in the browser
can be read by anyone. So we never put the sending keys there. Instead the
browser asks our own server function, the function holds the keys privately and
does the send. This is the same pattern the AI features already use
(`/api/ai`).

---

## 2. How a send actually flows

```
You press ✉ in the app
        │
        ▼
Browser collects: the note text + your work email (from Settings)
        │   and a one-time proof that you're signed in (Firebase ID token)
        ▼
POST to our server function  /api/email
        │
        ├─ 1. Checks the proof: "is this really a signed-in user of MY app?"
        │      (stops strangers using it to send spam)
        │
        ├─ 2. Checks the recipient looks like a real email + the note isn't empty
        │
        ▼
Server function calls EmailJS (using secret keys only the server knows)
        │
        ▼
EmailJS sends the email  →  it arrives in your work inbox ✅
```

The email arrives **from** whatever mailbox you connect to EmailJS (e.g. your
Gmail/Outlook), and **to** the work address you set in the app's Settings.

---

## 3. What you need to set up

Two places: **the EmailJS dashboard** (section 4) and **Vercel** (section 5).

You already have an EmailJS account from your teamo app, so you can reuse it.

---

## 4. EmailJS dashboard setup

Sign in at <https://dashboard.emailjs.com>.

### 4a. Email Service (you likely already have one)

A "service" is the mailbox EmailJS sends through. Your teamo service is
`service_o8b47y7` - you can reuse it.

- Go to **Email Services**. Note the **Service ID** (looks like `service_xxxxxxx`).
- This is the account your idea emails will be sent **from**.

### 4b. Email Template (create a new one for ideas)

A "template" is the shape of the email, with **placeholders** that the app fills
in. We need a template with exactly these three placeholders:

| Placeholder | Filled with | Put it in the template's... |
|-------------|-------------|------------------------------|
| `{{to_email}}` | your work address | **To Email** field |
| `{{subject}}` | `Idea: <first line>` | **Subject** field |
| `{{message}}` | the full note | **Content / body** |

Steps:
1. Go to **Email Templates → Create New Template**.
2. In **Settings**, set **To Email** to `{{to_email}}`.
   (Leave From as your connected service mailbox.)
3. Set **Subject** to `{{subject}}`.
4. In the **Content**, put `{{message}}` where you want the note to appear.
   A minimal body is just: `{{message}}`.
5. **Save**. Note the **Template ID** (looks like `template_xxxxxxx`).

> ⚠️ The placeholder names must match **exactly** (`to_email`, `subject`,
> `message`). If they don't, EmailJS sends a blank or rejects it.

### 4c. Turn on server (non-browser) sending  ← easy to miss

By default EmailJS only accepts calls from a web page. Our middleman is a
server, so we must allow that:

1. Go to **Account → Security**.
2. Tick **"Allow EmailJS API for non-browser applications"**.
3. While you're there, make sure **"Use Private Key"** is available - we'll use
   the private key as an extra lock (see security, section 6).

### 4d. Find your two keys

Go to **Account → General → API Keys** (or **Account → Security**):
- **Public Key** - safe to expose, identifies your account (teamo's was
  `xptDbUUJb9PYrgzAa`).
- **Private Key** - **secret**. Treat it like a password.

---

## 5. Vercel environment variables

"Environment variables" are named settings stored on the server, **outside** the
code. We use them so secrets never sit in the codebase or the browser, and so
you can change them without changing code.

### 5a. The five variables

Add all five to your Vercel project. Values come from section 4.

| Variable name | Example value | What it is | Secret? |
|---------------|---------------|------------|---------|
| `EMAILJS_SERVICE_ID` | `service_o8b47y7` | Which mailbox to send through | No (just an ID) |
| `EMAILJS_TEMPLATE_ID` | `template_ab12cd3` | Which template to use | No (just an ID) |
| `EMAILJS_PUBLIC_KEY` | `xptDbUUJb9PYrgzAa` | Identifies your EmailJS account | No (designed to be public) |
| `EMAILJS_PRIVATE_KEY` | `a1b2c3...` | The extra lock so only your server can send | **Yes - keep secret** |
| `FIREBASE_API_KEY` | `AIzaSy...` | Used only to verify your sign-in token | No (already public in the app) |

> **About `FIREBASE_API_KEY`:** this is the *same value* already in your app as
> `VITE_FIREBASE_API_KEY`. A Firebase web API key is **not** a secret - it just
> names your project, and Firebase's security rules do the real protecting. We
> add it here (without the `VITE_` prefix) only so the server function can use
> it to check your login token.

> **Why no `VITE_` prefix on these?** In this app, any variable starting with
> `VITE_` gets baked into the browser bundle and is therefore public. Leaving
> the prefix **off** keeps a variable server-only. That's why the private key
> must **never** be `VITE_`-prefixed.

### 5b. Where they go (step by step)

1. Open your project on <https://vercel.com> → **Settings → Environment
   Variables**.
2. For each of the five: type the **Name**, paste the **Value**, and tick **all
   three** environments (Production, Preview, Development). Click **Save**.
3. Environment variables only take effect on a **fresh build**. Go to
   **Deployments → (latest) → ⋯ → Redeploy** (or just push any commit).

That's it - the ✉ buttons go live after that redeploy.

---

## 6. Security: risks, protections, mitigations

Email endpoints are attractive to spammers, so this was designed carefully.
Here's the honest picture.

| Risk | Protection already in place | Residual risk |
|------|-----------------------------|----------------|
| **Secrets leak** (someone reads your private key) | All keys live server-side as env vars; the private key is never `VITE_`-prefixed, so it never reaches the browser | None, as long as you don't paste the private key into front-end code |
| **Open relay / spam** (a stranger POSTs to `/api/email` to send junk) | The function rejects any request without a valid **Firebase sign-in token** - only signed-in users of *your* app get through | A signed-in user (i.e. you) could send to any address. Fine for a personal, single-user app |
| **Public-key abuse** (someone copies your EmailJS public key from a browser and sends as you) | We never expose it in the browser - sends go through the server, locked with the **private key** (strict mode) | Low. Optionally also set **Allowed Origins** in EmailJS |
| **Recipient privacy** ("only I can see my work address") | Stored in Firestore under your user id (`/userSettings/{uid}`); the existing rule only lets the signed-in owner read it | None for your use |
| **Quota burn** (someone exhausts your free emails) | Same sign-in guard limits who can trigger sends | EmailJS free tier is ~200 emails/month - ample personal headroom |

**In short:** secrets stay on the server, only *you* (signed in) can trigger a
send, and your work address stays private to your account.

**If you ever make the app multi-user**, add one more rule: have the server
force the recipient to the signed-in user's *own* saved address, so one user
can't email another. Not needed while it's just you.

---

## 7. Test checklist (after the redeploy)

1. Open the deployed app and **sign in**.
2. Click the **⚙ gear** in the header → set your **work email** → Save.
3. Capture a quick voice/typed note → press **✉ Email to work** → expect
   **"✓ Emailed"**.
4. Try **✉** on an **inbox item** too.
5. Check your work inbox (and spam folder the first time).

> Reminder: the ✉ buttons do **nothing useful on `vite dev`** locally, because
> `/api/email` only runs on the Vercel deployment. Always test on the deploy.

---

## 8. Troubleshooting

| What you see | Likely cause | Fix |
|--------------|--------------|-----|
| Button says "Set a forward email in Settings first" | No work address saved | ⚙ Settings → add it |
| "Email is not configured yet (missing EMAILJS_* env vars)" | A Vercel variable is missing/misnamed | Re-check section 5a, then redeploy |
| "Email guard is not configured (missing FIREBASE_API_KEY)" | That one variable isn't set | Add `FIREBASE_API_KEY` (same value as `VITE_FIREBASE_API_KEY`), redeploy |
| "We couldn't verify your sign-in..." (was "Not authorised.") | Sign-in token rejected by the server. The app now auto-refreshes the token once before showing this, so a stale token is already ruled out | Click **Re-authorise & retry**; if it still fails, **Sign in again**. If it *still* fails right after a fresh sign-in, it's server-side (next two rows) |
| Still "not authorised" after re-signing in | `FIREBASE_API_KEY` on Vercel is missing/wrong, **or** the Firebase API key has Google Cloud **application restrictions (HTTP referrers)** - browser calls pass, but the server function's referrer-less call is blocked | 1) Vercel → confirm `FIREBASE_API_KEY` == `VITE_FIREBASE_API_KEY`. 2) Google Cloud Console → APIs & Services → Credentials → that API key → set **Application restrictions = None** (or add the Vercel domain), and ensure **Identity Toolkit API** is allowed. Then redeploy |
| EmailJS error mentioning "non-browser" / "API calls disabled" | The section 4c toggle is off | Turn on "Allow EmailJS API for non-browser applications" |
| Email sends but body/subject is blank | Template placeholders don't match | They must be `{{to_email}}`, `{{subject}}`, `{{message}}` |
| Nothing arrives, no error | Check spam; confirm the template **To Email** = `{{to_email}}` | - |

---

## Quick reference: the five variables

```
EMAILJS_SERVICE_ID     = service_xxxxxxx        (EmailJS → Email Services)
EMAILJS_TEMPLATE_ID    = template_xxxxxxx       (EmailJS → Email Templates)
EMAILJS_PUBLIC_KEY     = xxxxxxxxxxxxxxxxx       (EmailJS → Account → API Keys)
EMAILJS_PRIVATE_KEY    = xxxxxxxxxxxxxxxxx       (EmailJS → Account → API Keys)  ← secret
FIREBASE_API_KEY       = AIzaSy...               (same value as VITE_FIREBASE_API_KEY)
```

All five go in **Vercel → Settings → Environment Variables**, ticked for all
environments, then **redeploy**.
