import { useEffect, useRef } from 'react'

const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

interface UseIdleDetectionOptions {
  onIdle: () => void
  onActive: () => void
  onActivity: () => void // Every user interaction
}

export function useIdleDetection({ onIdle, onActive, onActivity }: UseIdleDetectionOptions) {
  const isIdleRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Store callbacks in refs to avoid re-registering event listeners on every render
  const onIdleRef = useRef(onIdle)
  const onActiveRef = useRef(onActive)
  const onActivityRef = useRef(onActivity)

  // Update refs when callbacks change (doesn't trigger effect re-run)
  useEffect(() => {
    onIdleRef.current = onIdle
  }, [onIdle])

  useEffect(() => {
    onActiveRef.current = onActive
  }, [onActive])

  useEffect(() => {
    onActivityRef.current = onActivity
  }, [onActivity])

  // Main idle detection effect - only runs once on mount
  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // If was idle, mark as active
      if (isIdleRef.current) {
        isIdleRef.current = false
        onActiveRef.current()
      }

      onActivityRef.current()

      // Start new 5min timeout
      timeoutRef.current = setTimeout(() => {
        if (!isIdleRef.current) {
          isIdleRef.current = true
          onIdleRef.current()
        }
      }, IDLE_TIMEOUT_MS)
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']

    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true })
    })

    resetTimer()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      events.forEach(event => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, []) // Empty deps - only run once
}
