import { useEffect, useRef, useState } from 'react'

// Local draft + debounced save that won't fight incoming Firestore snapshots:
// while the user is mid-edit (dirty) we ignore remote values; once the remote
// value catches up to our draft we clear the dirty flag and resume syncing.
export function useDebouncedField(value: string, onSave: (v: string) => void, delay = 600) {
  const [draft, setDraft] = useState(value)
  const dirty = useRef(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (value === draft) {
      dirty.current = false
    } else if (!dirty.current) {
      setDraft(value)
    }
  }, [value, draft])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  function onChange(next: string) {
    setDraft(next)
    dirty.current = true
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSave(next), delay)
  }

  // Persist immediately on blur so a quick close never drops the last edit.
  function flush() {
    if (timer.current) window.clearTimeout(timer.current)
    if (dirty.current) onSave(draft)
  }

  return { draft, onChange, flush }
}
