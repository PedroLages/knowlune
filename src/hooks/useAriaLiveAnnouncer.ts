import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Hook that manages an ARIA live region announcement string.
 *
 * Returns `[announcement, announce]` where:
 * - `announcement` is the current string to render inside an `aria-live` region
 * - `announce(msg)` sets a new message. If the same message is announced twice
 *   in a row, it appends an invisible unicode space so screen readers re-read it.
 *
 * Old announcements are automatically cleared after `clearMs` (default 5 s)
 * to avoid stale text lingering in the accessibility tree.
 */
export function useAriaLiveAnnouncer(clearMs = 5000): [string, (msg: string) => void] {
  const [announcement, setAnnouncement] = useState('')
  const prevRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const announce = useCallback(
    (msg: string) => {
      // If the same message is announced consecutively, append an invisible
      // space so the live region content actually changes and SR re-reads it.
      const effective = msg === prevRef.current ? msg + '\u200B' : msg
      prevRef.current = msg
      setAnnouncement(effective)

      // Auto-clear after timeout
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setAnnouncement(''), clearMs)
    },
    [clearMs],
  )

  return [announcement, announce]
}
