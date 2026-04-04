import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * useAutoHide — Generic hook for auto-hiding UI elements after inactivity.
 *
 * Shows the element on mouse move, touch, or keyboard focus. Hides after
 * `timeout` ms of inactivity. When `disabled` is true (e.g. reduced motion),
 * the element is always visible.
 *
 * @param timeout - ms before hiding (default 3000)
 * @param disabled - when true, always visible (no auto-hide)
 * @returns { isVisible, show, resetTimer, containerRef }
 *
 * @see E65-S02
 */
export function useAutoHide(timeout = 3000, disabled = false) {
  const [isVisible, setIsVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      setIsVisible(false)
    }, timeout)
  }, [timeout, clearTimer])

  const show = useCallback(() => {
    setIsVisible(true)
    if (!disabled) {
      startTimer()
    }
  }, [disabled, startTimer])

  const resetTimer = useCallback(() => {
    if (disabled) return
    setIsVisible(true)
    startTimer()
  }, [disabled, startTimer])

  // Global mouse/touch listeners to show on interaction
  useEffect(() => {
    if (disabled) {
      setIsVisible(true)
      clearTimer()
      return
    }

    const handleActivity = () => resetTimer()

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('touchstart', handleActivity)

    // Start initial timer
    startTimer()

    return () => {
      clearTimer()
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
    }
  }, [disabled, resetTimer, startTimer, clearTimer])

  // Show when container receives keyboard focus
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleFocusIn = () => {
      setIsVisible(true)
      clearTimer() // Don't auto-hide while focused
    }

    const handleFocusOut = (e: FocusEvent) => {
      // Only restart timer if focus left the container entirely
      if (!el.contains(e.relatedTarget as Node)) {
        if (!disabled) startTimer()
      }
    }

    el.addEventListener('focusin', handleFocusIn)
    el.addEventListener('focusout', handleFocusOut)
    return () => {
      el.removeEventListener('focusin', handleFocusIn)
      el.removeEventListener('focusout', handleFocusOut)
    }
  }, [disabled, clearTimer, startTimer])

  return { isVisible, show, resetTimer, containerRef }
}
