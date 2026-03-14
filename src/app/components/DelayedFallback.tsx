import { useState, useEffect, type ReactNode } from 'react'

interface DelayedFallbackProps {
  /** Skeleton content to show after the delay elapses. */
  children: ReactNode
  /** Milliseconds to wait before showing the fallback. Default 200ms. */
  delayMs?: number
}

/**
 * Delays rendering of a loading skeleton to prevent flash on fast loads.
 *
 * If real content resolves before the delay, the skeleton is never shown.
 * Once visible, the skeleton stays until the parent unmounts it.
 *
 * Usage: wrap skeleton JSX as children inside a conditional render:
 *   {isLoading && <DelayedFallback><MySkeleton /></DelayedFallback>}
 */
export function DelayedFallback({ children, delayMs = 200 }: DelayedFallbackProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  if (!show) return null
  return <>{children}</>
}
