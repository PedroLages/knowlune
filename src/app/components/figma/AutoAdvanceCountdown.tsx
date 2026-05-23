import { useEffect, useState, useRef } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { PathProgressRing } from '@/app/components/figma/PathProgressRing'

interface AutoAdvanceCountdownProps {
  seconds: number
  nextLessonTitle: string
  onAdvance: () => void
  onCancel: () => void
}

enum OverlayPhase {
  Entering,
  Visible,
  Exiting,
}

/** Which action the user (or countdown zero) chose — determines the callback after exit animation */
type ExitAction = 'cancel' | 'advance'

export function AutoAdvanceCountdown({
  seconds,
  nextLessonTitle,
  onAdvance,
  onCancel,
}: AutoAdvanceCountdownProps) {
  const [remaining, setRemaining] = useState(seconds)
  const [phase, setPhase] = useState(OverlayPhase.Entering)
  const exitActionRef = useRef<ExitAction | null>(null)
  const onAdvanceRef = useRef(onAdvance)
  const onCancelRef = useRef(onCancel)
  onAdvanceRef.current = onAdvance
  onCancelRef.current = onCancel

  const handleCancel = () => {
    exitActionRef.current = 'cancel'
    setPhase(OverlayPhase.Exiting)
  }

  const handleAdvance = () => {
    exitActionRef.current = 'advance'
    setPhase(OverlayPhase.Exiting)
  }

  // Mount animation: enter → visible on next frame
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase(OverlayPhase.Visible)
      })
    })
  }, [])

  // Fire the exit callback after the exit animation completes (200ms)
  useEffect(() => {
    if (phase === OverlayPhase.Exiting && exitActionRef.current) {
      const action = exitActionRef.current
      const timer = setTimeout(() => {
        if (action === 'advance') {
          onAdvanceRef.current()
        } else {
          onCancelRef.current()
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [phase])

  // Single stable interval — stops itself at zero
  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [seconds])

  // When countdown reaches zero, trigger exit animation with advance action
  useEffect(() => {
    if (remaining <= 0 && phase === OverlayPhase.Visible) {
      exitActionRef.current = 'advance'
      setPhase(OverlayPhase.Exiting)
    }
  }, [remaining, phase])

  const ringPercentage = seconds > 0 ? (remaining / seconds) * 100 : 0

  const isEntering = phase === OverlayPhase.Entering
  const isExiting = phase === OverlayPhase.Exiting

  // Don't render anything during enter phase (avoid flash)
  if (isEntering) return null

  return (
    <div
      data-testid="auto-advance-countdown"
      data-slot="countdown-overlay"
      role="status"
      aria-live="polite"
      className={[
        'fixed inset-0 z-50 flex items-center justify-center outline-none',
        'motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out',
        isExiting
          ? 'motion-safe:opacity-0 bg-transparent'
          : 'motion-safe:opacity-100 bg-black/50',
      ].join(' ')}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          handleCancel()
        }
      }}
    >
      {/* Card */}
      <div
        className={[
          'flex flex-col items-center gap-6 rounded-2xl bg-card p-8 shadow-lg max-w-[calc(100vw-2rem)]',
          'motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out',
          isExiting
            ? 'motion-safe:scale-95 motion-safe:opacity-0'
            : 'motion-safe:scale-100 motion-safe:opacity-100',
        ].join(' ')}
      >
        {/* Countdown ring */}
        <PathProgressRing
          percentage={ringPercentage}
          size="xl"
          strokeColor="stroke-brand"
          transitionDurationMs={1000}
        >
          <span className="text-4xl font-bold tabular-nums text-foreground" aria-live="off">
            {remaining}
          </span>
        </PathProgressRing>

        {/* Next up label and lesson title */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Next up</p>
          <p className="text-base font-semibold text-foreground">{nextLessonTitle}</p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            className="flex-1"
            onClick={handleAdvance}
          >
            <Play className="mr-2 size-4" aria-hidden="true" />
            Play Now
          </Button>
        </div>
      </div>

      {/* Screen reader announcement on mount */}
      <div role="status" aria-live="polite" className="sr-only">
        Next up: {nextLessonTitle}. Auto-playing in {remaining} seconds.
      </div>
    </div>
  )
}
