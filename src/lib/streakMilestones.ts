import { Flame, Star, Trophy, Crown } from 'lucide-react'
import type { StreakMilestone } from '@/data/types'
import { toLocalDateString } from '@/lib/studyLog'

const STORAGE_KEY = 'streak-milestones'

export const MILESTONE_VALUES = [7, 30, 60, 100] as const

// ── Tier configuration ───────────────────────────────────────

export interface TierConfig {
  label: string
  icon: typeof Flame
  gradient: string
  textColor: string
  borderColor: string
  confettiColors: string[]
  particleCount: number
  spread: number
}

export const TIER_CONFIG: Record<number, TierConfig> = {
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

// ── Storage ──────────────────────────────────────────────────

export function getMilestones(): StreakMilestone[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMilestones(milestones: StreakMilestone[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(milestones))
}

export function addMilestone(value: number, streakStartDate: string): StreakMilestone {
  const milestone: StreakMilestone = {
    id: crypto.randomUUID(),
    milestoneValue: value,
    earnedAt: new Date().toISOString(),
    streakStartDate,
  }
  const milestones = getMilestones()
  milestones.push(milestone)
  saveMilestones(milestones)
  return milestone
}

// ── Detection ────────────────────────────────────────────────

/**
 * Compute the approximate start date of the current streak.
 *
 * Assumption: the streak count includes today. A streak of N means
 * the user studied on each of the last N calendar days (today inclusive),
 * so the first day of the streak is `today - (N - 1)` days ago.
 *
 * This is a heuristic — the authoritative approach would trace actual
 * study-log entries, but that would couple this module to the study-log
 * internals and is out of scope for milestone detection.
 */
export function getStreakStartDate(currentStreak: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (currentStreak - 1))
  return toLocalDateString(d)
}

/**
 * Return milestone values that the current streak has reached
 * but haven't been celebrated in this streak instance.
 */
export function getUncelebratedMilestones(currentStreak: number, streakStart?: string): number[] {
  if (currentStreak < MILESTONE_VALUES[0]) return []

  const start = streakStart ?? getStreakStartDate(currentStreak)
  const existing = getMilestones()

  return MILESTONE_VALUES.filter(value => {
    if (currentStreak < value) return false
    // Check if already celebrated in this streak instance
    const alreadyCelebrated = existing.some(
      m => m.milestoneValue === value && m.streakStartDate === start
    )
    return !alreadyCelebrated
  })
}

/**
 * Detect uncelebrated milestones, persist them, and return the list
 * so the caller can fire toasts + confetti.
 *
 * Computes streakStart once and passes it through to avoid a
 * midnight race between detection and recording.
 */
export function detectAndRecordMilestones(currentStreak: number): StreakMilestone[] {
  const streakStart = getStreakStartDate(currentStreak)
  const uncelebrated = getUncelebratedMilestones(currentStreak, streakStart)
  if (uncelebrated.length === 0) return []

  return uncelebrated.map(value => addMilestone(value, streakStart))
}
