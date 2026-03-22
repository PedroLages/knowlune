import { useState, useEffect, useRef } from 'react'
import { cn } from '@/app/components/ui/utils'
import { formatTime } from '@/hooks/useQuizTimer'

interface QuizTimerProps {
  /** Current remaining time in seconds */
  timeRemaining: number
  /** Total quiz time in seconds (used for threshold calculations) */
  totalTime: number
  /** Optional label shown after the time (e.g., "Extended Time") */
  annotation?: string
}

function formatMinuteAnnouncement(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'Time has expired'
  if (totalSeconds < 60) {
    return `Time remaining: ${totalSeconds} ${totalSeconds === 1 ? 'second' : 'seconds'}`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const minuteLabel = minutes === 1 ? 'minute' : 'minutes'
  return `Time remaining: ${minutes} ${minuteLabel}`
}

export function QuizTimer({ timeRemaining, totalTime, annotation }: QuizTimerProps) {
  const isWarning = timeRemaining <= totalTime * 0.25 && timeRemaining > totalTime * 0.1
  const isUrgent = timeRemaining <= totalTime * 0.1

  // Screen reader announcements — update on minute boundaries and threshold crossings
  const [liveAnnouncement, setLiveAnnouncement] = useState(() =>
    formatMinuteAnnouncement(timeRemaining)
  )
  const prevSecondsRef = useRef(timeRemaining)

  useEffect(() => {
    const prev = prevSecondsRef.current
    prevSecondsRef.current = timeRemaining

    // Announce on minute boundaries
    if (timeRemaining % 60 === 0 && timeRemaining !== prev) {
      setLiveAnnouncement(formatMinuteAnnouncement(timeRemaining))
    }

    // Announce when crossing 25% threshold
    const threshold25 = Math.floor(totalTime * 0.25)
    if (prev > threshold25 && timeRemaining <= threshold25) {
      const suffix = annotation ? ` (${annotation})` : ''
      setLiveAnnouncement(`Warning: ${formatMinuteAnnouncement(timeRemaining)}${suffix}`)
    }

    // Announce when crossing 10% threshold
    const threshold10 = Math.floor(totalTime * 0.1)
    if (prev > threshold10 && timeRemaining <= threshold10) {
      setLiveAnnouncement(`Urgent: ${formatMinuteAnnouncement(timeRemaining)}`)
    }
  }, [timeRemaining, totalTime, annotation])

  return (
    <>
      <div
        role="timer"
        aria-label="Time remaining"
        data-testid="quiz-timer"
        className={cn(
          'ml-auto flex items-baseline gap-1.5 font-mono text-sm sm:text-base font-semibold tabular-nums transition-colors duration-300',
          isUrgent && 'text-destructive',
          isWarning && 'text-warning',
          !isWarning && !isUrgent && 'text-muted-foreground'
        )}
      >
        {formatTime(timeRemaining)}
        {annotation && (
          <span className="text-muted-foreground text-xs font-sans font-normal">
            ({annotation})
          </span>
        )}
      </div>
      {/* Screen-reader-only live region — announces per-minute and at thresholds */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </span>
    </>
  )
}
