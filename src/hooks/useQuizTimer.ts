import { useState, useEffect, useRef } from 'react'
import { useQuizStore } from '@/stores/useQuizStore'

/**
 * Formats seconds into MM:SS display string.
 * Moved from QuizHeader — shared by useQuizTimer and QuizTimer component.
 */
export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Drift-free countdown timer anchored to Date.now().
 *
 * Instead of decrementing a counter each interval tick (which drifts when
 * the browser throttles setInterval on hidden tabs), this hook computes an
 * absolute endTime and recalculates remaining time from the wall clock on
 * every tick and on visibilitychange.
 *
 * @param initialSeconds - Starting countdown in seconds (0 = disabled)
 * @param onExpire - Callback fired once when the timer reaches 0
 * @returns Current remaining time in seconds
 */
export function useQuizTimer(initialSeconds: number, onExpire: () => void): number {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  // Track whether onExpire has already been called to prevent double-fire
  const hasFiredRef = useRef(false)

  useEffect(() => {
    if (initialSeconds <= 0) return

    hasFiredRef.current = false
    const startTime = Date.now()
    const endTime = startTime + initialSeconds * 1000

    const recalculate = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeRemaining(remaining)

      if (remaining === 0 && !hasFiredRef.current) {
        hasFiredRef.current = true
        clearInterval(interval)
        onExpireRef.current()
      }

      return remaining
    }

    const interval = setInterval(recalculate, 1000)

    // Recalculate on tab visibility change to correct for throttled intervals
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recalculate()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Sync remaining time back to store for crash recovery
    // Store expects timeRemaining in minutes
    const syncToStore = (remainingSeconds: number) => {
      if (remainingSeconds > 0) {
        useQuizStore.setState(state => {
          if (!state.currentProgress) return {}
          return {
            currentProgress: {
              ...state.currentProgress,
              timeRemaining: remainingSeconds / 60,
            },
          }
        })
      }
    }

    // Periodic store sync every 60 seconds
    const syncInterval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      syncToStore(remaining)
    }, 60_000)

    // Sync on tab hidden (user switching away)
    const handleHiddenSync = () => {
      if (document.visibilityState === 'hidden') {
        const now = Date.now()
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
        syncToStore(remaining)
      }
    }
    document.addEventListener('visibilitychange', handleHiddenSync)

    return () => {
      clearInterval(interval)
      clearInterval(syncInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleHiddenSync)
      // Final sync on unmount
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      syncToStore(remaining)
    }
  }, [initialSeconds])

  return timeRemaining
}
