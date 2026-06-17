import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { DEFAULT_THOUGHTS_PROMPT } from '../ai/prompts'

// Per-user preferences, stored at /userSettings/{uid} so they sync across the
// user's devices (unlike the old per-browser localStorage approach).
export type UserSettings = {
  thoughtsPrompt: string // effective prompt (custom if set, else the default)
  isCustomThoughtsPrompt: boolean
  forwardEmail: string // work/forward address for the ✉ buttons ('' = unset)
  loaded: boolean
  setThoughtsPrompt: (prompt: string) => Promise<void>
  setForwardEmail: (email: string) => Promise<void>
}

export function useUserSettings(userId: string): UserSettings {
  const [custom, setCustom] = useState('')
  const [forwardEmail, setForwardEmailState] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const ref = doc(db, 'userSettings', userId)
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data()
        setCustom((data?.thoughtsPrompt as string | undefined) ?? '')
        setForwardEmailState((data?.forwardEmail as string | undefined) ?? '')
        setLoaded(true)
      },
      () => setLoaded(true),
    )
    return unsubscribe
  }, [userId])

  async function setThoughtsPrompt(prompt: string): Promise<void> {
    const trimmed = prompt.trim()
    // Storing the default (or empty) just clears the override.
    const value = !trimmed || trimmed === DEFAULT_THOUGHTS_PROMPT ? '' : trimmed
    await setDoc(doc(db, 'userSettings', userId), { thoughtsPrompt: value }, { merge: true })
  }

  // Persist the forward address (an empty string clears it). Kept private to
  // the user by the existing /userSettings ownership rule.
  async function setForwardEmail(email: string): Promise<void> {
    await setDoc(doc(db, 'userSettings', userId), { forwardEmail: email.trim() }, { merge: true })
  }

  return {
    thoughtsPrompt: custom || DEFAULT_THOUGHTS_PROMPT,
    isCustomThoughtsPrompt: !!custom,
    forwardEmail,
    loaded,
    setThoughtsPrompt,
    setForwardEmail,
  }
}
