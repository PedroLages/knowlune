import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Hook that manages an ARIA live region announcement string.
 *
 * Returns `[announcement, announce]` where:
 * - `announcement` is the current string to render inside an `aria-live` region
 * - `announce(msg)` sets a new message. If the same message is announced
 *   consecutively, it appends an incrementing number of invisible zero-width
 *   spaces so the live region content always changes and screen readers re-read.
 *
 * Old announcements are automatically cleared after `clearMs` (default 5 s)
 * to avoid stale text lingering in the accessibility tree.
 */
export function useAriaLiveAnnouncer(clearMs = 5000): [string, (msg: string) => void] {
  const [announcement, setAnnouncement] = useState('')
  const prevRef = useRef('')
  const counterRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const announce = useCallback(
    (msg: string) => {
      // If the same message is announced consecutively, append an incrementing
      // number of zero-width spaces so the live region content is always unique
      // and screen readers re-read it (handles 3+ consecutive identical calls).
      let effective: string
      if (msg === prevRef.current) {
        counterRef.current += 1
        effective = msg + '\u200B'.repeat(counterRef.current)
      } else {
        counterRef.current = 0
        effective = msg
      }
      prevRef.current = msg
      setAnnouncement(effective)

      // Auto-clear after timeout
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setAnnouncement(''), clearMs)
    },
    [clearMs]
  )

  return [announcement, announce]
}
