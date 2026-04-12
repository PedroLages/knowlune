/**
 * SilenceSkipIndicator — transient badge showing when silence was skipped.
 *
 * Fades in when a silence skip occurs and disappears after 2 seconds.
 * Always rendered in the DOM so E2E tests can attach to it, but visually
 * hidden when no skip has occurred.
 *
 * @module SilenceSkipIndicator
 * @since E111-S02
 */
import { useEffect, useRef, useState } from 'react'
import type { SilenceSkip } from '@/app/hooks/useSilenceDetection'

interface SilenceSkipIndicatorProps {
  lastSkip: SilenceSkip | null
}

export function SilenceSkipIndicator({ lastSkip }: SilenceSkipIndicatorProps) {
  const [visible, setVisible] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!lastSkip) return

    const seconds = lastSkip.durationSeconds.toFixed(1)
    setDisplayText(`Skipped ${seconds}s silence`)
    setVisible(true)

    // Clear any pending hide timeout before setting a new one
    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current)
    }
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, 2000)

    return () => {
      if (hideTimeoutRef.current !== null) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [lastSkip])

  return (
    <div
      data-testid="silence-skip-indicator"
      aria-live="polite"
      aria-atomic="true"
      className={`pointer-events-none transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {displayText && (
        <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-soft-foreground">
          {displayText}
        </span>
      )}
    </div>
  )
}
