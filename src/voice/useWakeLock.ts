import { useEffect, useRef } from 'react'

// Keep the screen awake while `active` is true (e.g. during voice recording).
// Phones sleep the screen after a short idle, which suspends the page and kills
// the microphone / Web Speech session. The Screen Wake Lock API asks the OS to
// hold the screen on. The browser auto-releases the lock whenever the tab is
// hidden, so we re-acquire it each time the page becomes visible again.
//
// Not supported everywhere (older iOS Safari, Firefox): in that case this is a
// silent no-op - recording still works, the screen just isn't held on.

type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> }
type WakeLockLike = { request: (type: 'screen') => Promise<WakeLockSentinelLike> }

function getWakeLock(): WakeLockLike | null {
  const nav = navigator as Navigator & { wakeLock?: WakeLockLike }
  return nav.wakeLock ?? null
}

export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)

  useEffect(() => {
    if (!active) return
    const wakeLock = getWakeLock()
    if (!wakeLock) return

    let cancelled = false
    const lock = wakeLock

    async function acquire() {
      // Only the foreground tab may hold a lock; bail if we're hidden.
      if (document.visibilityState !== 'visible') return
      try {
        const sentinel = await lock.request('screen')
        if (cancelled) {
          void sentinel.release()
          return
        }
        sentinelRef.current = sentinel
      } catch {
        // Can reject under battery saver or if the tab lost focus mid-request.
        // Non-fatal - just means the screen may dim.
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      const sentinel = sentinelRef.current
      sentinelRef.current = null
      if (sentinel) void sentinel.release()
    }
  }, [active])
}
