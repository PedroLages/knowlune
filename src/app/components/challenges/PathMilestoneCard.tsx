import { Route, Check } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { getPathMilestoneTierConfig } from '@/lib/challengePathMilestones'
import { CHALLENGE_MILESTONES } from '@/lib/challengeMilestones'
import type { Challenge } from '@/data/types'
import { Link } from 'react-router'

interface PathMilestoneCardProps {
  challenge: Challenge
}

/**
 * Renders a path milestone challenge card with path-specific styling.
 * Shows path name, current milestone %, progress bar, and next/current milestone info.
 */
export function PathMilestoneCard({ challenge }: PathMilestoneCardProps) {
  const progressPercent = Math.min(
    100,
    challenge.targetValue > 0
      ? Math.round((challenge.currentProgress / challenge.targetValue) * 100)
      : 0
  )

  const isCompleted = !!challenge.completedAt

  // Find the highest achieved milestone
  const highestMilestone = CHALLENGE_MILESTONES.filter(
    t => progressPercent >= t
  ).pop()

  // Find the next milestone to achieve
  const nextMilestone = CHALLENGE_MILESTONES.find(
    t => progressPercent < t
  )

  const milestoneConfig = highestMilestone
    ? getPathMilestoneTierConfig(highestMilestone)
    : null

  const MilestoneIcon = milestoneConfig?.icon ?? Route

  return (
    <Card
      className={cn(
        isCompleted && 'border-warning/60 bg-warning/5'
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-lg',
                isCompleted
                  ? 'bg-warning/10 text-warning'
                  : 'bg-brand/10 text-brand'
              )}
            >
              {isCompleted ? (
                <Check className="size-4.5" />
              ) : (
                <MilestoneIcon className="size-4.5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight">
                {challenge.name}
              </h3>
              <p className="text-muted-foreground text-xs">
                {highestMilestone
                  ? getPathMilestoneTierConfig(highestMilestone).label
                  : 'Just Started'}{' '}
                &middot; {progressPercent}% complete
              </p>
            </div>
          </div>
          <Badge
            variant={isCompleted ? 'default' : 'outline'}
            className={cn(
              'shrink-0 text-xs',
              isCompleted && 'bg-warning hover:bg-warning/90'
            )}
          >
            {isCompleted ? 'Completed' : 'Path Progress'}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {challenge.currentProgress}% / {challenge.targetValue}%
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            className={cn('h-2.5', isCompleted && '[&>div]:bg-warning')}
            aria-label={`${challenge.name}: ${progressPercent}% complete`}
          />
        </div>

        {/* Milestone markers */}
        <div className="flex items-center justify-between pt-1">
          {CHALLENGE_MILESTONES.map(threshold => {
            const achieved = progressPercent >= threshold
            const config = getPathMilestoneTierConfig(threshold)
            const Icon = config.icon
            return (
              <div
                key={threshold}
                className="flex flex-col items-center gap-1"
                title={`${config.label}: ${threshold}%`}
              >
                <Icon
                  className={cn(
                    'size-3.5',
                    achieved
                      ? config.textColor
                      : 'text-muted-foreground/30'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    achieved
                      ? config.textColor
                      : 'text-muted-foreground/40'
                  )}
                >
                  {threshold}%
                </span>
              </div>
            )
          })}
        </div>

        {/* Next milestone hint */}
        {!isCompleted && nextMilestone && (
          <p className="text-muted-foreground text-xs">
            Next: {getPathMilestoneTierConfig(nextMilestone).label} at{' '}
            {nextMilestone}%
          </p>
        )}

        {isCompleted && (
          <p className="text-muted-foreground text-xs">
            Completed &middot; All milestones reached
          </p>
        )}

        {/* Link to path */}
        {challenge.pathId && (
          <Link
            to={`/learning-tracks/${challenge.pathId}`}
            className="text-xs text-brand hover:text-brand-hover underline mt-1"
          >
            View Learning Path
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
