import { Clock } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

interface CompletionEstimateProps {
  sessionsNeeded: number
  estimatedDays: number
  className?: string
}

/**
 * CompletionEstimate displays predicted time to complete a course.
 * Shows sessions for short estimates (< 10) or days for longer ones.
 *
 * Based on user's average session pace from the last 30 days.
 */
export function CompletionEstimate({
  sessionsNeeded,
  estimatedDays,
  className,
}: CompletionEstimateProps) {
  // Adaptive display: sessions if < 10, days if >= 10
  const displayValue = sessionsNeeded < 10 ? sessionsNeeded : estimatedDays
  const displayUnit = sessionsNeeded < 10 ? 'session' : 'day'
  const pluralSuffix = displayValue === 1 ? '' : 's'

  return (
    <span
      data-testid="completion-estimate"
      className={cn('inline-flex items-center gap-1.5 text-sm text-muted-foreground', className)}
    >
      <Clock className="size-4 shrink-0" aria-hidden="true" />
      Est. ~{displayValue} {displayUnit}
      {pluralSuffix}
    </span>
  )
}
