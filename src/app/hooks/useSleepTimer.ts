/**
 * useSleepTimer — sleep timer countdown with audio fade-out for audiobook player.
 *
 * Features:
 * - Countdown mode: 15, 30, 45, or 60 minutes using setInterval
 * - End-of-chapter mode: listens for the custom 'chapterend' event
 * - On expiry: rAF-based volume fade-out over 5 seconds, then pause
 * - Persists `sleepTimerEnded` flag in localStorage for post-sleep toast
 *
 * @module useSleepTimer
 * @since E87-S03
 */
import { useState, useRef, useCallback, useEffect } from 'react'

export type SleepTimerOption = number | 'end-of-chapter' | 'off'

const FADE_DURATION_MS = 5_000
const LS_KEY = 'knowlune:sleep-timer-ended'

/** Fade audio volume to 0 over FADE_DURATION_MS, then pause and restore volume. */
export function fadeOutAndPause(audio: HTMLAudioElement, onDone: () => void): void {
  const startVolume = audio.volume
  const startTime = performance.now()

  function tick() {
    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / FADE_DURATION_MS, 1)
    audio.volume = startVolume * (1 - progress)
    if (progress < 1) {
      requestAnimationFrame(tick)
    } else {
      audio.pause()
      audio.volume = startVolume
      onDone()
    }
  }
  requestAnimationFrame(tick)
}

export interface UseSleepTimerReturn {
  /** Selected option — null means no timer running */
  activeOption: SleepTimerOption | null
  /** Remaining seconds (null when no countdown timer active) */
  remainingSeconds: number | null
  /** Human-readable badge text, e.g. "23m" or "EOC" */
  badgeText: string | null
  /** Start or change the sleep timer */
  setTimer: (
    option: SleepTimerOption,
    audioRef: React.RefObject<HTMLAudioElement | null>,
    onPause: () => void
  ) => void
  /** Cancel the sleep timer */
  cancelTimer: () => void
}

export function useSleepTimer(): UseSleepTimerReturn {
  const [activeOption, setActiveOption] = useState<SleepTimerOption | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const eocCleanupRef = useRef<(() => void) | null>(null)

  const cancelTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (eocCleanupRef.current) {
      eocCleanupRef.current()
      eocCleanupRef.current = null
    }
    setActiveOption(null)
    setRemainingSeconds(null)
  }, [])

  const setTimer = useCallback(
    (
      option: SleepTimerOption,
      audioRef: React.RefObject<HTMLAudioElement | null>,
      onPause: () => void
    ) => {
      // Cancel any existing timer first
      cancelTimer()

      if (option === 'off') return

      setActiveOption(option)

      if (option === 'end-of-chapter') {
        // Listen ONLY for 'chapterend' — NOT 'ended'.
        // 'ended' races with useAudioPlayer's auto-advance handler (which also
        // listens to 'ended' and immediately loads the next chapter). Listening
        // to both causes unpredictable behavior where the next chapter may
        // briefly start before the pause takes effect.
        // useAudioPlayer dispatches 'chapterend' for both single-file M4B
        // (chapter boundary detection) and multi-file (after auto-advance).
        const handleChapterEnd = (e: Event) => {
          // Prevent useAudioPlayer from auto-advancing to next chapter
          e.preventDefault()
          const audio = audioRef.current
          if (!audio) return
          fadeOutAndPause(audio, () => {
            localStorage.setItem(LS_KEY, '1')
            setActiveOption(null)
            setRemainingSeconds(null)
            onPause()
          })
        }
        const audio = audioRef.current
        if (audio) {
          audio.addEventListener('chapterend', handleChapterEnd)
          eocCleanupRef.current = () => {
            audio.removeEventListener('chapterend', handleChapterEnd)
          }
        }
        return
      }

      // Countdown timer
      const totalSeconds = option * 60
      setRemainingSeconds(totalSeconds)

      intervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(intervalRef.current!)
            intervalRef.current = null
            // Fade out and pause
            const audio = audioRef.current
            if (audio) {
              fadeOutAndPause(audio, () => {
                localStorage.setItem(LS_KEY, '1')
                setActiveOption(null)
                setRemainingSeconds(null)
                onPause()
              })
            } else {
              localStorage.setItem(LS_KEY, '1')
              setActiveOption(null)
              setRemainingSeconds(null)
              onPause()
            }
            return null
          }
          return prev - 1
        })
      }, 1_000)
    },
    [cancelTimer]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
      if (eocCleanupRef.current) eocCleanupRef.current()
    }
  }, [])

  const badgeText: string | null =
    activeOption === 'end-of-chapter'
      ? 'EOC'
      : remainingSeconds !== null
        ? `${Math.ceil(remainingSeconds / 60)}m`
        : null

  return { activeOption, remainingSeconds, badgeText, setTimer, cancelTimer }
}

/** Check and consume the sleep-timer-ended localStorage flag. Returns true once. */
export function consumeSleepTimerEndedFlag(): boolean {
  if (localStorage.getItem(LS_KEY) === '1') {
    localStorage.removeItem(LS_KEY)
    return true
  }
  return false
}
