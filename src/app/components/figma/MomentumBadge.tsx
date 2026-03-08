import { Flame, Sun, Snowflake } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { cn } from '@/app/components/ui/utils'
import type { MomentumTier } from '@/lib/momentum'

interface MomentumBadgeProps {
  score: number
  tier: MomentumTier
  size?: 'sm' | 'md'
}

const tierConfig: Record<MomentumTier, { label: string; icon: typeof Flame; className: string }> = {
  hot: {
    label: 'Hot',
    icon: Flame,
    className: 'text-orange-700 dark:text-orange-500',
  },
  warm: {
    label: 'Warm',
    icon: Sun,
    className: 'text-amber-700 dark:text-amber-500',
  },
  cold: {
    label: 'Cold',
    icon: Snowflake,
    className: 'text-blue-700 dark:text-blue-400',
  },
}

export function MomentumBadge({ score, tier, size = 'sm' }: MomentumBadgeProps) {
  const { label, icon: Icon, className } = tierConfig[tier]
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="momentum-badge"
          tabIndex={0}
          aria-label={`Momentum: ${label} (${score})`}
          className={cn(
            'inline-flex items-center gap-1 font-medium cursor-default rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current',
            className,
            textSize
          )}
        >
          <Icon className={cn(iconSize, 'shrink-0')} aria-hidden="true" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Momentum score: {score}/100</TooltipContent>
    </Tooltip>
  )
}
