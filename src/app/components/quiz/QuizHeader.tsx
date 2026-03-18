import { useState, useEffect, useRef } from 'react'
import { Progress } from '@/app/components/ui/progress'
import type { Quiz, QuizProgress } from '@/types/quiz'
import { useQuizStore } from '@/stores/useQuizStore'

interface QuizHeaderProps {
  quiz: Quiz
  progress: QuizProgress
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatMinuteAnnouncement(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const minuteLabel = minutes === 1 ? 'minute' : 'minutes'
  return `Time remaining: ${minutes} ${minuteLabel}`
}

export function QuizHeader({ quiz, progress }: QuizHeaderProps) {
  const totalQuestions = progress.questionOrder.length || quiz.questions.length
  const currentQuestion = progress.currentQuestionIndex + 1
  const progressValue =
    totalQuestions > 0 ? Math.round((currentQuestion / totalQuestions) * 100) : 0

  // Initialize timer: timeRemaining is stored in minutes (matches quiz.timeLimit unit)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() => {
    if (progress.timeRemaining === null) return null
    return Math.round(progress.timeRemaining * 60)
  })

  // Announced text — only changes on minute boundaries to avoid per-second screen reader noise
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>(() => {
    if (progress.timeRemaining === null) return ''
    return formatMinuteAnnouncement(Math.round(progress.timeRemaining * 60))
  })

  // Ref for interval so we can clear it when timer hits 0
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Countdown — starts on mount, cleared on unmount or when timer reaches 0
  useEffect(() => {
    if (remainingSeconds === null) return

    intervalRef.current = setInterval(() => {
      setRemainingSeconds(s => {
        if (s === null || s <= 0) {
          // Timer expired — clear interval to stop useless state updates
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 0
        }
        const next = s - 1
        // Announce once per minute (when seconds cross a full-minute boundary)
        if (next % 60 === 0) {
          setLiveAnnouncement(formatMinuteAnnouncement(next))
        }
        return next
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, []) // intentionally empty: timer starts once on mount

  // Stable boolean for deps — prevents accidental re-creation if someone "fixes" to [remainingSeconds]
  const isTimed = remainingSeconds !== null

  // Sync remainingSeconds back to store every 60s (or on visibility change)
  // so that resume restores the correct time instead of resetting to full
  useEffect(() => {
    if (!isTimed) return

    const syncToStore = () => {
      setRemainingSeconds(current => {
        if (current !== null && current > 0) {
          useQuizStore.setState(state => {
            if (!state.currentProgress) return {}
            return {
              currentProgress: {
                ...state.currentProgress,
                timeRemaining: current / 60,
              },
            }
          })
        }
        return current
      })
    }

    // Sync every 60 seconds
    const syncInterval = setInterval(syncToStore, 60_000)

    // Also sync on visibility change (tab switch, minimize)
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') syncToStore()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(syncInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
      // Final sync on unmount
      syncToStore()
    }
  }, [isTimed]) // only re-run if timer existence changes

  return (
    <div className="mb-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold">{quiz.title}</h1>
        {remainingSeconds !== null && (
          <>
            {/* Visual timer — aria-hidden to silence per-second announcements */}
            <span
              className="ml-auto font-mono text-sm text-muted-foreground tabular-nums"
              aria-hidden="true"
            >
              {formatTime(remainingSeconds)}
            </span>
            {/* Screen-reader-only live region — announces once per minute */}
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {liveAnnouncement}
            </span>
          </>
        )}
      </div>
      <Progress
        value={progressValue}
        className="mt-2"
        aria-label="Quiz progress"
        aria-valuenow={progressValue}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      <p className="text-sm text-muted-foreground mt-1">
        Question {currentQuestion} of {totalQuestions}
      </p>
    </div>
  )
}
