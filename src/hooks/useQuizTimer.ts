import { useState, useEffect, useRef } from 'react'
import { useQuizStore } from '@/stores/useQuizStore'

/**
 * Formats seconds into MM:SS display string.
 * Moved from QuizHeader — shared by useQuizTimer and QuizTimer component.
 */
export function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0)
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
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

    // Reset displayed time when initialSeconds changes (e.g., quiz starts
    // and hook transitions from 0 → 900). useState only uses its initial
    // value on first mount, so we must sync explicitly.
    setTimeRemaining(initialSeconds)
    hasFiredRef.current = false
    const startTime = Date.now()
    const endTime = startTime + initialSeconds * 1000

    // Sync remaining time back to store for crash recovery.
    // Store expects timeRemaining in minutes. Accepts 0 so expiry
    // is persisted (prevents stale time on crash recovery).
    const syncToStore = (remainingSeconds: number) => {
      if (remainingSeconds >= 0) {
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

    const recalculate = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeRemaining(remaining)

      if (remaining === 0 && !hasFiredRef.current) {
        hasFiredRef.current = true
        clearInterval(interval)
        syncToStore(0)
        Promise.resolve(onExpireRef.current()).catch(console.error)
      }

      return remaining
    }

    const interval = setInterval(recalculate, 1000)

    // Combined visibility change handler: recalculate on visible, sync on hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recalculate()
      } else {
        const now = Date.now()
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
        syncToStore(remaining)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Periodic store sync every 60 seconds
    const syncInterval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      syncToStore(remaining)
    }, 60_000)

    return () => {
      clearInterval(interval)
      clearInterval(syncInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Final sync on unmount
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      syncToStore(remaining)
    }
  }, [initialSeconds])

  return timeRemaining
}
