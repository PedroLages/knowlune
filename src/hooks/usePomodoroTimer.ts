import { useState, useRef, useCallback, useEffect } from 'react'

export type PomodoroPhase = 'idle' | 'focus' | 'break'
export type PomodoroStatus = 'stopped' | 'running' | 'paused'

export interface PomodoroState {
  phase: PomodoroPhase
  status: PomodoroStatus
  timeRemaining: number // seconds
  completedSessions: number // completed focus+break cycles
}

export interface PomodoroActions {
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  skip: () => void
}

export interface UsePomodoroTimerOptions {
  focusDuration?: number // seconds, default 25*60
  breakDuration?: number // seconds, default 5*60
  onFocusComplete?: () => void
  onBreakComplete?: () => void
  autoStartBreak?: boolean // default: true
  autoStartFocus?: boolean // default: false
}

/**
 * Drift-free Pomodoro countdown timer with phase management.
 *
 * Follows the same wall-clock anchoring pattern as `useQuizTimer`:
 * computes an absolute endTime and recalculates remaining time from
 * `Date.now()` on every tick and on `visibilitychange`.
 *
 * State machine: idle -> focus -> break -> focus -> ...
 * Any running phase can be paused/resumed. Reset returns to idle.
 */
export function usePomodoroTimer(
  options: UsePomodoroTimerOptions = {}
): PomodoroState & PomodoroActions {
  const {
    focusDuration = 25 * 60,
    breakDuration = 5 * 60,
    onFocusComplete,
    onBreakComplete,
    autoStartBreak = true,
    autoStartFocus = false,
  } = options

  const [phase, setPhase] = useState<PomodoroPhase>('idle')
  const [status, setStatus] = useState<PomodoroStatus>('stopped')
  const [timeRemaining, setTimeRemaining] = useState(focusDuration)
  const [completedSessions, setCompletedSessions] = useState(0)

  // Refs for timer internals (avoid stale closures and re-render loops)
  const endTimeRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const remainingAtPauseRef = useRef<number>(0)
  const hasFiredRef = useRef(false)
  const phaseRef = useRef<PomodoroPhase>('idle')

  // Refs for callbacks to avoid stale closures
  const onFocusCompleteRef = useRef(onFocusComplete)
  onFocusCompleteRef.current = onFocusComplete
  const onBreakCompleteRef = useRef(onBreakComplete)
  onBreakCompleteRef.current = onBreakComplete

  // Refs for options to avoid re-triggering effects
  const autoStartBreakRef = useRef(autoStartBreak)
  autoStartBreakRef.current = autoStartBreak
  const autoStartFocusRef = useRef(autoStartFocus)
  autoStartFocusRef.current = autoStartFocus
  const focusDurationRef = useRef(focusDuration)
  focusDurationRef.current = focusDuration
  const breakDurationRef = useRef(breakDuration)
  breakDurationRef.current = breakDuration

  // Sync timeRemaining when duration options change while idle
  useEffect(() => {
    if (phaseRef.current === 'idle' && intervalRef.current === null) {
      setTimeRemaining(focusDuration)
    }
  }, [focusDuration])

  // Keep phaseRef in sync with state
  const updatePhase = useCallback((newPhase: PomodoroPhase) => {
    phaseRef.current = newPhase
    setPhase(newPhase)
  }, [])

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  /** Handle phase completion transition logic. */
  const handlePhaseComplete = useCallback(
    (completedPhase: PomodoroPhase) => {
      if (completedPhase === 'focus') {
        onFocusCompleteRef.current?.()
        if (autoStartBreakRef.current) {
          // Auto-start break — will call startCountdown (defined below)
          return { autoStart: true as const, nextPhase: 'break' as const }
        }
        updatePhase('break')
        setStatus('stopped')
        setTimeRemaining(breakDurationRef.current)
        return { autoStart: false as const }
      } else if (completedPhase === 'break') {
        setCompletedSessions(prev => prev + 1)
        onBreakCompleteRef.current?.()
        if (autoStartFocusRef.current) {
          return { autoStart: true as const, nextPhase: 'focus' as const }
        }
        updatePhase('idle')
        setStatus('stopped')
        setTimeRemaining(focusDurationRef.current)
        return { autoStart: false as const }
      }
      return { autoStart: false as const }
    },
    [updatePhase]
  )

  const startCountdown = useCallback(
    (durationSeconds: number, newPhase: PomodoroPhase) => {
      clearTimer()
      hasFiredRef.current = false

      const now = Date.now()
      endTimeRef.current = now + durationSeconds * 1000

      updatePhase(newPhase)
      setStatus('running')
      setTimeRemaining(durationSeconds)

      const recalculate = () => {
        const remaining = Math.max(
          0,
          Math.floor((endTimeRef.current - Date.now()) / 1000)
        )
        setTimeRemaining(remaining)

        if (remaining === 0 && !hasFiredRef.current) {
          hasFiredRef.current = true
          clearTimer()

          const result = handlePhaseComplete(newPhase)
          if (result.autoStart) {
            const dur =
              result.nextPhase === 'break'
                ? breakDurationRef.current
                : focusDurationRef.current
            startCountdown(dur, result.nextPhase)
          }
        }
      }

      intervalRef.current = setInterval(recalculate, 1000)
    },
    [clearTimer, updatePhase, handlePhaseComplete]
  )

  // Handle visibility change for tab-return accuracy
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        intervalRef.current !== null
      ) {
        const remaining = Math.max(
          0,
          Math.floor((endTimeRef.current - Date.now()) / 1000)
        )
        setTimeRemaining(remaining)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Cleanup on unmount
  useEffect(() => clearTimer, [clearTimer])

  const start = useCallback(() => {
    startCountdown(focusDurationRef.current, 'focus')
  }, [startCountdown])

  const pause = useCallback(() => {
    if (intervalRef.current === null) return
    clearTimer()
    const remaining = Math.max(
      0,
      Math.floor((endTimeRef.current - Date.now()) / 1000)
    )
    remainingAtPauseRef.current = remaining
    setTimeRemaining(remaining)
    setStatus('paused')
  }, [clearTimer])

  const resume = useCallback(() => {
    if (remainingAtPauseRef.current <= 0) return
    const now = Date.now()
    endTimeRef.current = now + remainingAtPauseRef.current * 1000
    hasFiredRef.current = false
    setStatus('running')

    // Read phase from ref (always current, no stale closure)
    const currentPhase = phaseRef.current

    const recalculate = () => {
      const remaining = Math.max(
        0,
        Math.floor((endTimeRef.current - Date.now()) / 1000)
      )
      setTimeRemaining(remaining)

      if (remaining === 0 && !hasFiredRef.current) {
        hasFiredRef.current = true
        clearTimer()

        const result = handlePhaseComplete(currentPhase)
        if (result.autoStart) {
          const dur =
            result.nextPhase === 'break'
              ? breakDurationRef.current
              : focusDurationRef.current
          startCountdown(dur, result.nextPhase)
        }
      }
    }

    intervalRef.current = setInterval(recalculate, 1000)
  }, [clearTimer, startCountdown, handlePhaseComplete])

  const reset = useCallback(() => {
    clearTimer()
    hasFiredRef.current = false
    remainingAtPauseRef.current = 0
    updatePhase('idle')
    setStatus('stopped')
    setTimeRemaining(focusDurationRef.current)
    setCompletedSessions(0)
  }, [clearTimer, updatePhase])

  const skip = useCallback(() => {
    clearTimer()
    hasFiredRef.current = false

    const currentPhase = phaseRef.current
    const result = handlePhaseComplete(currentPhase)
    if (result.autoStart) {
      const dur =
        result.nextPhase === 'break'
          ? breakDurationRef.current
          : focusDurationRef.current
      startCountdown(dur, result.nextPhase)
    }
  }, [clearTimer, startCountdown, handlePhaseComplete])

  return {
    phase,
    status,
    timeRemaining,
    completedSessions,
    start,
    pause,
    resume,
    reset,
    skip,
  }
}
