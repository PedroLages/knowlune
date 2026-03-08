import { Sprout, Star, Rocket, Trophy } from 'lucide-react'
import type { Challenge } from '@/data/types'

// ── Thresholds ──────────────────────────────────────────────

export const CHALLENGE_MILESTONES = [25, 50, 75, 100] as const

// ── Tier configuration ──────────────────────────────────────

export interface ChallengeTierConfig {
  label: string
  message: string
  icon: typeof Sprout
  gradient: string
  textColor: string
  borderColor: string
  confettiColors: string[]
  particleCount: number
  spread: number
}

export const CHALLENGE_TIER_CONFIG: Record<25 | 50 | 75 | 100, ChallengeTierConfig> = {
  25: {
    label: '25% Complete',
    message: "You're off to a great start!",
    icon: Sprout,
    gradient: 'from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-300 dark:border-green-700',
    confettiColors: ['#16a34a', '#22c55e', '#4ade80'], // green-600, green-500, green-400
    particleCount: 40,
    spread: 40,
  },
  50: {
    label: 'Halfway There',
    message: "Keep it up — you're doing great!",
    icon: Star,
    gradient: 'from-blue-100 to-sky-100 dark:from-blue-900/30 dark:to-sky-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-700',
    confettiColors: ['#2563eb', '#3b82f6', '#60a5fa'], // blue-600, blue-500, blue-400
    particleCount: 60,
    spread: 50,
  },
  75: {
    label: 'Almost There',
    message: 'The finish line is in sight!',
    icon: Rocket,
    gradient: 'from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-300 dark:border-amber-700',
    confettiColors: ['#d97706', '#f59e0b', '#fbbf24'], // amber-600, amber-500, amber-400
    particleCount: 80,
    spread: 60,
  },
  100: {
    label: 'Challenge Complete',
    message: 'You did it — challenge conquered!',
    icon: Trophy,
    gradient: 'from-purple-100 to-amber-50 dark:from-purple-900/30 dark:to-amber-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-300 dark:border-purple-700',
    confettiColors: ['#9333ea', '#7c3aed', '#eab308', '#fbbf24'], // purple-600, violet-600, yellow-500, amber-400
    particleCount: 120,
    spread: 80,
  },
}

export function getChallengeTierConfig(percent: number): ChallengeTierConfig {
  const config = CHALLENGE_TIER_CONFIG[percent as 25 | 50 | 75 | 100]
  if (!config) {
    console.warn(`[challengeMilestones] Unknown threshold ${percent}, falling back to 25%`)
  }
  return config ?? CHALLENGE_TIER_CONFIG[25]
}

// ── Detection ───────────────────────────────────────────────

/**
 * Detect which milestone thresholds the challenge has crossed
 * that haven't been celebrated yet.
 */
export function detectChallengeMilestones(challenge: Challenge, newProgress: number): number[] {
  if (challenge.targetValue <= 0) return []

  const percent = (newProgress / challenge.targetValue) * 100

  const celebrated = Array.isArray(challenge.celebratedMilestones)
    ? challenge.celebratedMilestones
    : []

  return CHALLENGE_MILESTONES.filter(threshold => {
    if (percent < threshold) return false
    return !celebrated.includes(threshold)
  })
}
