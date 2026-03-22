import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { formatTime, type WarningLevel } from '@/hooks/useQuizTimer'

interface TimerWarningsProps {
  /** Current warning level (null = no warning yet) */
  warningLevel: WarningLevel | null
  /** Remaining seconds when the warning fired */
  remainingSeconds: number
}

/**
 * Renderless component that fires Sonner toasts and updates ARIA live
 * regions when timer warning thresholds are crossed.
 *
 * Visible DOM: only two sr-only ARIA regions (polite + assertive).
 * Toast notifications handled by Sonner (rendered via global <Toaster />).
 */
export function TimerWarnings({ warningLevel, remainingSeconds }: TimerWarningsProps) {
  const [politeAnnouncement, setPoliteAnnouncement] = useState('')
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState('')
  const prevLevelRef = useRef<WarningLevel | null>(null)

  useEffect(() => {
    if (!warningLevel || warningLevel === prevLevelRef.current) return
    prevLevelRef.current = warningLevel

    const timeStr = formatTime(remainingSeconds)

    switch (warningLevel) {
      case '25%':
        toast.info(`${timeStr} remaining`, { duration: 3000 })
        setPoliteAnnouncement(`${timeStr} remaining`)
        break
      case '10%':
        toast.warning(`Only ${timeStr} remaining!`, { duration: 5000 })
        setAssertiveAnnouncement(`Only ${timeStr} remaining!`)
        break
      case '1min':
        toast.warning(`${timeStr} remaining`, { duration: Infinity })
        setAssertiveAnnouncement(`${timeStr} remaining`)
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
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveAnnouncement}
      </div>
    </>
  )
}
