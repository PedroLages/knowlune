/**
 * DailyGoalRing — compact SVG progress ring for today's reading goal.
 *
 * Shows minutes read today vs daily target.
 * Colors: brand (in-progress) → success (goal met).
 *
 * @module DailyGoalRing
 */
import { useEffect, useState } from 'react'
import { getTimeReadToday } from '@/services/ReadingStatsService'
import { useReadingGoalStore } from '@/stores/useReadingGoalStore'
import { cn } from '@/app/components/ui/utils'

const RADIUS = 20
const STROKE_WIDTH = 4
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const SIZE = (RADIUS + STROKE_WIDTH) * 2

interface DailyGoalRingProps {
  className?: string
}

export function DailyGoalRing({ className }: DailyGoalRingProps) {
  const goal = useReadingGoalStore(s => s.goal)
  const [minutesToday, setMinutesToday] = useState(0)

  useEffect(() => {
    let ignore = false
    getTimeReadToday()
      .then(seconds => {
        if (!ignore) setMinutesToday(Math.floor(seconds / 60))
      })
      .catch(() => {
        // silent-catch-ok: stats failure degrades gracefully (ring shows 0)
        if (!ignore) setMinutesToday(0)
      })
    return () => { ignore = true }
  }, [])

  if (!goal || goal.dailyType !== 'minutes') return null

  const progress = Math.min(minutesToday / goal.dailyTarget, 1)
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const isGoalMet = minutesToday >= goal.dailyTarget

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      title={`${minutesToday}/${goal.dailyTarget} min read today`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Daily reading goal: ${minutesToday} of ${goal.dailyTarget} minutes`}
      >
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          className="stroke-muted"
        />
        {/* Progress arc — rotated so it starts at top */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className={isGoalMet ? 'stroke-success' : 'stroke-brand'}
          // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic SVG transition, no Tailwind equivalent for stroke-dashoffset animation
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {minutesToday}/{goal.dailyTarget} min
      </span>
    </div>
  )
}
