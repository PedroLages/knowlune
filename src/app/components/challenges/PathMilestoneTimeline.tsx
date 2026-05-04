import { cn } from '@/app/components/ui/utils'
import { getPathMilestoneTierConfig } from '@/lib/challengePathMilestones'
import { CHALLENGE_MILESTONES } from '@/lib/challengeMilestones'

interface PathMilestoneTimelineProps {
  progressPercent: number
}

/**
 * Renders a mini progress timeline showing the 4 milestone tiers (25/50/75/100%)
 * with checkmarks for completed tiers and an indicator for the current tier.
 */
export function PathMilestoneTimeline({ progressPercent }: PathMilestoneTimelineProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Path Milestones</h4>
      <div className="relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-muted" aria-hidden="true" />

        <div className="space-y-3">
          {CHALLENGE_MILESTONES.map((threshold, index) => {
            const achieved = progressPercent >= threshold
            const isCurrent =
              !achieved &&
              (index === 0 ||
                progressPercent >= CHALLENGE_MILESTONES[index - 1])
            const config = getPathMilestoneTierConfig(threshold)
            const Icon = config.icon

            return (
              <div key={threshold} className="flex items-start gap-3 relative">
                {/* Timeline dot */}
                <div
                  className={cn(
                    'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2',
                    achieved
                      ? `${config.borderColor} bg-gradient-to-br ${config.gradient}`
                      : isCurrent
                        ? 'border-brand bg-brand-soft'
                        : 'border-muted bg-card'
                  )}
                >
                  <Icon
                    className={cn(
                      'size-3.5',
                      achieved
                        ? config.textColor
                        : isCurrent
                          ? 'text-brand'
                          : 'text-muted-foreground/40'
                    )}
                  />
                </div>

                {/* Milestone info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      achieved
                        ? config.textColor
                        : isCurrent
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                    )}
                  >
                    {config.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {achieved
                      ? 'Completed'
                      : isCurrent
                        ? 'In progress'
                        : `${threshold}% completion`}
                  </p>
                </div>

                {/* Percentage badge */}
                <span
                  className={cn(
                    'text-xs font-medium tabular-nums',
                    achieved ? config.textColor : 'text-muted-foreground'
                  )}
                >
                  {threshold}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
