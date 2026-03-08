import { AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { cn } from '@/app/components/ui/utils'

interface AtRiskBadgeProps {
  daysSinceLastSession: number
  className?: string
}

/**
 * AtRiskBadge displays a warning indicator when a course has been neglected.
 * Shows when 14+ days have passed since last study session and momentum < 20.
 *
 * Uses orange warning colors to visually distinguish from momentum badges.
 */
export function AtRiskBadge({ daysSinceLastSession, className }: AtRiskBadgeProps) {
  const daysText = daysSinceLastSession === 1 ? 'day' : 'days'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="at-risk-badge"
          aria-label={`At Risk: No activity for ${daysSinceLastSession} days`}
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium cursor-default rounded-sm px-1.5 py-0.5',
            'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
            className
          )}
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          At Risk
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        No activity for {daysSinceLastSession} {daysText}
      </TooltipContent>
    </Tooltip>
  )
}
