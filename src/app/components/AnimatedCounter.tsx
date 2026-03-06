import { useEffect, useRef } from 'react'
import { animate } from 'motion'

interface AnimatedCounterProps {
  value: number | string
  className?: string
  duration?: number
  /** data-testid for E2E testing */
  testId?: string
}

/**
 * Animates a number from 0 → value on mount.
 * Respects prefers-reduced-motion (shows final value instantly).
 * Handles string values like "12.5h" by extracting the number and preserving the suffix.
 */
export function AnimatedCounter({
  value,
  className,
  duration = 1.2,
  testId,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  const stringValue = String(value)
  const numericMatch = stringValue.match(/^([\d.]+)(.*)$/)
  const numericValue = numericMatch ? parseFloat(numericMatch[1]) : NaN
  const suffix = numericMatch ? numericMatch[2] : ''

  useEffect(() => {
    if (!ref.current || isNaN(numericValue) || hasAnimated.current) return

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      ref.current.textContent = stringValue
      hasAnimated.current = true
      return
    }

    hasAnimated.current = true
    const controls = animate(0, numericValue, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: latest => {
        if (!ref.current) return
        // Use fixed decimals if the original value has them
        const formatted = stringValue.includes('.') ? latest.toFixed(1) : String(Math.round(latest))
        ref.current.textContent = formatted + suffix
      },
    })

    return () => controls.stop()
  }, [numericValue, duration, stringValue, suffix])

  return (
    <span ref={ref} className={className} data-testid={testId}>
      {stringValue}
    </span>
  )
}
