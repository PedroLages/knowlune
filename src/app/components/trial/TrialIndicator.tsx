// E19-S08: Trial Indicator — shown in the header during active trial
// Displays days remaining with a crown icon and progress ring.

import { Crown } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { useTrialStatus } from '@/app/hooks/useTrialStatus'

/**
 * AC2: Active trial indicator in the header showing days remaining.
 * Renders nothing if not trialing.
 */
export function TrialIndicator() {
  const { isTrialing, daysRemaining, trialEnd } = useTrialStatus()

  if (!isTrialing) return null

  const label =
    daysRemaining === 1
      ? '1 day left'
      : daysRemaining === 0
        ? 'Trial ends today'
        : `${daysRemaining} days left`

  const formattedEnd = trialEnd
    ? new Date(trialEnd).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className="gap-1.5 bg-gold-muted text-gold-soft-foreground border-transparent cursor-default"
          aria-label={`Free trial: ${label}`}
        >
          <Crown className="size-3.5" aria-hidden="true" />
          <span className="text-xs font-medium">{label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          Free trial {formattedEnd ? `ends ${formattedEnd}` : 'active'}. All premium features are
          unlocked.
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
