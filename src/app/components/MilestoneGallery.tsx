import { Lock } from 'lucide-react'
import { getMilestones, getTierConfig, MILESTONE_VALUES } from '@/lib/streakMilestones'
import { cn } from '@/app/components/ui/utils'
import type { StreakMilestone } from '@/data/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function MilestoneGallery() {
  // Read fresh on every render — localStorage reads are fast and
  // this ensures newly earned milestones appear immediately.
  const milestones: StreakMilestone[] = getMilestones()

  // Group earned milestones by value
  const earned = new Map<number, StreakMilestone[]>()
  for (const m of milestones) {
    const list = earned.get(m.milestoneValue) ?? []
    list.push(m)
    earned.set(m.milestoneValue, list)
  }

  return (
    <ul aria-label="Milestone badges" className="grid grid-cols-2 gap-3">
      {MILESTONE_VALUES.map(value => {
        const achievements = earned.get(value)
        const isEarned = achievements && achievements.length > 0
        const tier = getTierConfig(value)
        const Icon = tier.icon

        if (!isEarned) {
          return (
            <li
              key={value}
              data-testid={`gallery-milestone-badge-${value}-locked`}
              aria-label={`${value}-Day Streak — Locked`}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20 p-4"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-muted/50">
                <Lock className="size-4 text-muted-foreground/50" aria-hidden="true" />
              </div>
              <p className="text-xs font-medium text-muted-foreground/60">{value}-Day Streak</p>
            </li>
          )
        }

        return (
          <li
            key={value}
            data-testid={`gallery-milestone-badge-${value}`}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border bg-gradient-to-br p-4',
              tier.gradient,
              tier.borderColor
            )}
          >
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-full bg-white/60 dark:bg-white/10',
                tier.textColor
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <p className={cn('text-xs font-bold', tier.textColor)}>{value}-Day Streak</p>
            {achievements.map((a, i) => (
              <p key={a.id} className="text-xs text-muted-foreground">
                {achievements.length > 1 ? `#${i + 1}: ` : ''}
                {formatDate(a.earnedAt)}
              </p>
            ))}
          </li>
        )
      })}
    </ul>
  )
}
