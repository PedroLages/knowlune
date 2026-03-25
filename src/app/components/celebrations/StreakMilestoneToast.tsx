import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import type { StreakMilestone } from '@/data/types'
import { getTierConfig } from '@/lib/streakMilestones'
import { cn } from '@/app/components/ui/utils'
import { useEngagementPrefsStore } from '@/stores/useEngagementPrefsStore'

// ── Toast component ──────────────────────────────────────────

interface StreakMilestoneToastProps {
  milestone: StreakMilestone
}

export function StreakMilestoneToast({ milestone }: StreakMilestoneToastProps) {
  const tier = getTierConfig(milestone.milestoneValue)
  const Icon = tier.icon
  const animationsEnabled = useEngagementPrefsStore(s => s.animations)

  // Key on milestone.id (unique per achievement), NOT milestoneValue —
  // the same milestone value can be earned multiple times after streak resets.
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReducedMotion && animationsEnabled) {
      confetti({
        particleCount: tier.particleCount,
        spread: tier.spread,
        origin: { y: 0.6 },
        colors: tier.confettiColors,
      })
    }
  }, [milestone.id, tier.particleCount, tier.spread, tier.confettiColors, animationsEnabled])

  return (
    <div
      aria-label={`${tier.label} milestone achieved`}
      data-testid={`milestone-badge-${milestone.milestoneValue}`}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-gradient-to-r p-4 shadow-lg min-w-72',
        tier.gradient,
        tier.borderColor
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full bg-white/60 dark:bg-white/10',
          tier.textColor
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className={cn('text-sm font-bold', tier.textColor)}>{tier.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          You've studied {milestone.milestoneValue} days in a row!
        </p>
      </div>
    </div>
  )
}
