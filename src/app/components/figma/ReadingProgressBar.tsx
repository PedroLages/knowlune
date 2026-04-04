/**
 * ReadingProgressBar — Thin scroll progress indicator for reading mode.
 *
 * Fixed at the top of the viewport (below the status bar), 2px height.
 * Uses requestAnimationFrame throttling for scroll performance.
 *
 * @see E65-S02
 */

import { useState, useEffect, useRef } from 'react'

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = window.scrollY
        const docHeight = document.documentElement.scrollHeight - window.innerHeight
        const pct = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0
        setProgress(pct)
        rafRef.current = null
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    // Initial calculation
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return (
    <div
      className="fixed top-12 left-0 right-0 z-50 h-0.5 bg-transparent"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
      data-testid="reading-progress-bar"
    >
      {/* eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic width from scroll percentage */}
      <div
        className="h-full bg-brand transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
