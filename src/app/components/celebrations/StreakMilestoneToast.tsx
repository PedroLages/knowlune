import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { Flame, Star, Trophy, Crown } from 'lucide-react'
import type { StreakMilestone } from '@/data/types'

// ── Tier configuration ───────────────────────────────────────

interface TierConfig {
  label: string
  icon: typeof Flame
  gradient: string
  textColor: string
  borderColor: string
  confettiColors: string[]
  particleCount: number
  spread: number
}

const TIER_CONFIG: Record<number, TierConfig> = {
  7: {
    label: '7-Day Streak!',
    icon: Flame,
    gradient: 'from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-300 dark:border-orange-700',
    confettiColors: ['#ea580c', '#d97706', '#f59e0b'],
    particleCount: 60,
    spread: 50,
  },
  30: {
    label: '30-Day Streak!',
    icon: Star,
    gradient: 'from-slate-100 to-blue-50 dark:from-slate-800/30 dark:to-blue-900/30',
    textColor: 'text-slate-700 dark:text-slate-300',
    borderColor: 'border-slate-300 dark:border-slate-600',
    confettiColors: ['#94a3b8', '#64748b', '#3b82f6'],
    particleCount: 80,
    spread: 60,
  },
  60: {
    label: '60-Day Streak!',
    icon: Trophy,
    gradient: 'from-yellow-100 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
    confettiColors: ['#eab308', '#f59e0b', '#fbbf24'],
    particleCount: 100,
    spread: 70,
  },
  100: {
    label: '100-Day Streak!',
    icon: Crown,
    gradient: 'from-purple-100 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-300 dark:border-purple-700',
    confettiColors: ['#9333ea', '#7c3aed', '#a855f7', '#eab308'],
    particleCount: 150,
    spread: 90,
  },
}

export function getTierConfig(value: number): TierConfig {
  return TIER_CONFIG[value] ?? TIER_CONFIG[7]
}

// ── Toast component ──────────────────────────────────────────

interface StreakMilestoneToastProps {
  milestone: StreakMilestone
}

export function StreakMilestoneToast({ milestone }: StreakMilestoneToastProps) {
  const tier = getTierConfig(milestone.milestoneValue)
  const Icon = tier.icon

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReducedMotion) {
      confetti({
        particleCount: tier.particleCount,
        spread: tier.spread,
        origin: { y: 0.6 },
        colors: tier.confettiColors,
      })
    }
  }, [tier])

  return (
    <div
      data-testid={`milestone-badge-${milestone.milestoneValue}`}
      className={`flex items-center gap-3 rounded-xl border bg-gradient-to-r ${tier.gradient} ${tier.borderColor} p-4 shadow-lg min-w-[280px]`}
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-white/60 dark:bg-white/10 ${tier.textColor}`}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${tier.textColor}`}>{tier.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          You've studied {milestone.milestoneValue} days in a row!
        </p>
      </div>
    </div>
  )
}
