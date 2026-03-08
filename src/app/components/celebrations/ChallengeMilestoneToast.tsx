import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import type { ChallengeTierConfig } from '@/lib/challengeMilestones'
import { cn } from '@/app/components/ui/utils'

interface ChallengeMilestoneToastProps {
  challengeName: string
  milestone: number
  tierConfig: ChallengeTierConfig
}

export function ChallengeMilestoneToast({
  challengeName,
  milestone,
  tierConfig,
}: ChallengeMilestoneToastProps) {
  const Icon = tierConfig.icon

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReducedMotion) {
      confetti({
        particleCount: tierConfig.particleCount,
        spread: tierConfig.spread,
        origin: { y: 0.6 },
        colors: tierConfig.confettiColors,
      })
    }
  }, [milestone, tierConfig.particleCount, tierConfig.spread, tierConfig.confettiColors])

  return (
    <div
      aria-label={`${tierConfig.label} milestone achieved`}
      data-testid={`challenge-milestone-badge-${milestone}`}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-gradient-to-r p-4 shadow-lg min-w-72',
        tierConfig.gradient,
        tierConfig.borderColor
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full bg-white/60 dark:bg-white/10',
          tierConfig.textColor
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className={cn('text-sm font-bold', tierConfig.textColor)}>{tierConfig.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{challengeName}</p>
        <p className="text-xs text-muted-foreground/80 mt-0.5">{tierConfig.message}</p>
      </div>
    </div>
  )
}
