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
import { usePagesReadToday } from '@/app/hooks/usePagesReadToday'
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
  const pagesToday = usePagesReadToday()

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
    return () => {
      ignore = true
    }
  }, [])

  if (!goal) return null

  const isPageMode = goal.dailyType === 'pages'
  const current = isPageMode ? pagesToday : minutesToday
  const target = goal.dailyTarget
  const unit = isPageMode ? 'pages' : 'min'
  const progress = Math.min(current / target, 1)
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const isGoalMet = current >= target

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      title={`${current}/${target} ${unit} read today`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Daily reading goal: ${current} of ${target} ${unit}`}
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
        {current}/{target} {unit}
      </span>
    </div>
  )
}
