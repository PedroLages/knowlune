import { Flame, Sun, Snowflake } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { cn } from '@/app/components/ui/utils'
import type { MomentumTier } from '@/lib/momentum'

interface MomentumBadgeProps {
  score: number
  tier: MomentumTier
}

const tierConfig: Record<MomentumTier, { label: string; icon: typeof Flame; className: string }> = {
  hot: {
    label: 'Hot',
    icon: Flame,
    className: 'text-momentum-hot bg-momentum-hot-bg',
  },
  warm: {
    label: 'Warm',
    icon: Sun,
    className: 'text-momentum-warm bg-momentum-warm-bg',
  },
  cold: {
    label: 'Cold',
    icon: Snowflake,
    className: 'text-momentum-cold bg-momentum-cold-bg',
  },
}

export function MomentumBadge({ score, tier }: MomentumBadgeProps) {
  const { label, icon: Icon, className } = tierConfig[tier]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="momentum-badge"
          aria-label={`Momentum: ${label} (${score})`}
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium cursor-default rounded-sm px-1.5 py-0.5',
            className
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Momentum score: {score}/100</TooltipContent>
    </Tooltip>
  )
}
