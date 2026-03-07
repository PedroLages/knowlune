import { Lock } from 'lucide-react'
import { getMilestones, MILESTONE_VALUES } from '@/lib/streakMilestones'
import { getTierConfig } from '@/app/components/celebrations/StreakMilestoneToast'
import type { StreakMilestone } from '@/data/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function MilestoneGallery() {
  const milestones = getMilestones()

  // Group earned milestones by value
  const earned = new Map<number, StreakMilestone[]>()
  for (const m of milestones) {
    const list = earned.get(m.milestoneValue) ?? []
    list.push(m)
    earned.set(m.milestoneValue, list)
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {MILESTONE_VALUES.map(value => {
        const achievements = earned.get(value)
        const isEarned = achievements && achievements.length > 0
        const tier = getTierConfig(value)
        const Icon = tier.icon

        if (!isEarned) {
          return (
            <div
              key={value}
              data-testid={`gallery-milestone-badge-${value}-locked`}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-4 opacity-50"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{value}-Day Streak</p>
            </div>
          )
        }

        return (
          <div
            key={value}
            data-testid={`gallery-milestone-badge-${value}`}
            className={`flex flex-col items-center gap-2 rounded-xl border bg-gradient-to-br ${tier.gradient} ${tier.borderColor} p-4`}
          >
            <div
              className={`flex size-10 items-center justify-center rounded-full bg-white/60 dark:bg-white/10 ${tier.textColor}`}
            >
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <p className={`text-xs font-bold ${tier.textColor}`}>{value}-Day Streak</p>
            {achievements.map((a, i) => (
              <p key={a.id} className="text-[10px] text-muted-foreground">
                {achievements.length > 1 ? `#${i + 1}: ` : ''}
                {formatDate(a.earnedAt)}
              </p>
            ))}
          </div>
        )
      })}
    </div>
  )
}
