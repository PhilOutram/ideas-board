import { useCallback, useRef } from 'react'

// Helpers for dropping dictated words into an existing text box at the point
// the user left the caret, rather than always tacking them on the end.

// Remembers where the caret is in one textarea so dictation can be inserted
// there later - by which time the box has been blurred by the mic button.
//
// A textarea reports selectionStart 0 until it has been focused, so a box the
// user never clicked into would silently take new words at the very start.
// Tracking whether it was ever focused is what makes "end of the text" the
// default instead.
export function useCaretTracker() {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const everFocused = useRef(false)

  const onFocus = useCallback(() => {
    everFocused.current = true
  }, [])

  const caret = useCallback((value: string) => {
    if (!ref.current || !everFocused.current) return value.length
    const pos = ref.current.selectionStart
    return typeof pos === 'number' ? Math.min(pos, value.length) : value.length
  }, [])

  return { ref, onFocus, caret }
}

// Splice `spoken` into `value` at `at`, adding a single space on each side only
// where one is actually needed. Deliberate line breaks either side of the caret
// are left alone, so dictating into the middle of a list doesn't run two lines
// together.
export function spliceDictation(value: string, at: number, spoken: string): string {
  const words = spoken.trim()
  if (!words) return value

  const left = value.slice(0, at).replace(/[ \t]+$/, '')
  const right = value.slice(at).replace(/^[ \t]+/, '')
  const leadSpace = left && !left.endsWith('\n') ? ' ' : ''
  const trailSpace = right && !right.startsWith('\n') ? ' ' : ''
  return `${left}${leadSpace}${words}${trailSpace}${right}`
}
