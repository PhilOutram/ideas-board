import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'

// Click-the-backdrop-to-close, without the drag-select trap.
//
// A plain `onClick={onClose}` on the backdrop also fires when a text selection
// that STARTED inside the panel is released outside it: the browser dispatches
// the click on the nearest common ancestor of the press and the release, which
// is the backdrop. The panel would then close and the edit was lost - easily
// the most annoying thing about the data-entry panels.
//
// So dismiss only when the whole gesture belongs to the backdrop: the press,
// the release and the resulting click all landed on the backdrop element
// itself. Pointer events are used rather than mouse events so a tap on a
// touchscreen behaves the same way.
export function useOverlayDismiss(onDismiss: () => void) {
  const pressedBackdrop = useRef(false)
  const releasedBackdrop = useRef(false)

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    pressedBackdrop.current = e.target === e.currentTarget
  }, [])

  const onPointerUp = useCallback((e: PointerEvent<HTMLElement>) => {
    releasedBackdrop.current = e.target === e.currentTarget
  }, [])

  const onClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      const wholeGestureOnBackdrop =
        pressedBackdrop.current && releasedBackdrop.current && e.target === e.currentTarget
      pressedBackdrop.current = false
      releasedBackdrop.current = false
      if (wholeGestureOnBackdrop) onDismiss()
    },
    [onDismiss],
  )

  return { onPointerDown, onPointerUp, onClick }
}
