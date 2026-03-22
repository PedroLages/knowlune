import { useState, useEffect } from 'react'
import { formatTime, type WarningLevel } from '@/hooks/useQuizTimer'

interface TimerWarningsProps {
  /** Current warning level (null = no warning yet) */
  warningLevel: WarningLevel | null
  /** Remaining seconds when the warning fired */
  remainingSeconds: number
}

/**
 * ARIA-only component that updates screen reader live regions when timer
 * warning thresholds are crossed.
 *
 * Visible DOM: only two sr-only ARIA regions (polite + assertive).
 * Toast notifications are fired imperatively in Quiz.tsx's handleTimerWarning
 * callback (avoids React batching issues with short quizzes).
 */
export function TimerWarnings({ warningLevel, remainingSeconds }: TimerWarningsProps) {
  const [politeAnnouncement, setPoliteAnnouncement] = useState('')
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState('')

  useEffect(() => {
    if (!warningLevel) return

    const timeStr = formatTime(remainingSeconds)

    switch (warningLevel) {
      case '25%':
        setPoliteAnnouncement(`${timeStr} remaining`)
        break
      case '10%':
        // Clear stale polite region on urgency escalation
        setPoliteAnnouncement('')
        setAssertiveAnnouncement(`Only ${timeStr} remaining!`)
        break
      case '1min':
        setPoliteAnnouncement('')
        setAssertiveAnnouncement(`Only ${timeStr} remaining!`)
        break
    }
  }, [warningLevel, remainingSeconds])

  return (
    <>
      {/* Screen-reader-only: non-interrupting announcement for 25% threshold */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {politeAnnouncement}
      </div>
      {/* Screen-reader-only: interrupting announcement for 10% and 1min thresholds */}
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveAnnouncement}
      </div>
    </>
  )
}
