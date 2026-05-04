import { Sprout, Star, Rocket, Trophy } from 'lucide-react'
import { db } from '@/db'
import { getAllProgress } from '@/lib/progress'
import type { ChallengeTierConfig } from '@/lib/challengeMilestones'
import { CHALLENGE_MILESTONES, getTierConfig } from '@/lib/challengeMilestones'
import { computePathCompletionPct } from '@/lib/pathCompletion'

// ── Path-specific tier configuration ──────────────────────────

export const PATH_MILESTONE_TIER_CONFIG: Record<25 | 50 | 75 | 100, ChallengeTierConfig> = {
  25: {
    label: 'First Steps',
    message: "You're on your way — keep exploring this learning path!",
    icon: Sprout,
    gradient: 'from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-300 dark:border-green-700',
    confettiColors: ['#16a34a', '#22c55e', '#4ade80'],
    particleCount: 40,
    spread: 40,
  },
  50: {
    label: 'Halfway There',
    message: "You've reached the midpoint — keep the momentum going!",
    icon: Star,
    gradient: 'from-blue-100 to-sky-100 dark:from-blue-900/30 dark:to-sky-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-700',
    confettiColors: ['#2563eb', '#3b82f6', '#60a5fa'],
    particleCount: 60,
    spread: 50,
  },
  75: {
    label: 'Almost Done',
    message: "The finish line is in sight — you've nearly mastered this path!",
    icon: Rocket,
    gradient: 'from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-300 dark:border-amber-700',
    confettiColors: ['#d97706', '#f59e0b', '#fbbf24'],
    particleCount: 80,
    spread: 60,
  },
  100: {
    label: 'Path Complete',
    message: 'You finished this learning path — congratulations on completing every course!',
    icon: Trophy,
    gradient: 'from-purple-100 to-amber-50 dark:from-purple-900/30 dark:to-amber-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-300 dark:border-purple-700',
    confettiColors: ['#9333ea', '#7c3aed', '#eab308', '#fbbf24'],
    particleCount: 120,
    spread: 80,
  },
}

/**
 * Get the tier config for a path milestone percentage.
 * Falls back to the 25% config for unknown thresholds.
 */
export function getPathMilestoneTierConfig(percent: number): ChallengeTierConfig {
  return getTierConfig(PATH_MILESTONE_TIER_CONFIG, percent)
}

// ── Path progress calculator ──────────────────────────────────

/**
 * Compute aggregate path completion percentage for a given path.
 *
 * Mirrors the logic in `usePathProgress`:
 * - Queries `learningPathEntries` to find courses in the path
 * - For imported courses: uses `importedCourses` for video count + `progress` table for completed videos
 * - Also falls back to localStorage progress for pre-seeded data
 * - Catalog courses report 0 progress (table dropped in E89-S01)
 */
export async function calculatePathMilestoneProgress(pathId: string): Promise<number> {
  // Get all entries for this path
  const entries = await db.learningPathEntries.where('pathId').equals(pathId).toArray()

  if (entries.length === 0) return 0

  const importedEntries = entries.filter(e => e.courseType === 'imported')

  if (importedEntries.length === 0) return 0

  const importedCourseIds = importedEntries.map(e => e.courseId)

  // Batch load course metadata and video progress
  const [importedCourses, videoProgress] = await Promise.all([
    db.importedCourses
      .where('id')
      .anyOf(importedCourseIds)
      .toArray()
      .catch(() => []),
    db.progress
      .where('courseId')
      .anyOf(importedCourseIds)
      .toArray()
      .catch(() => []),
  ])

  const importedCourseMap = new Map(importedCourses.map(c => [c.id, c]))
  const localProgress = getAllProgress()

  return computePathCompletionPct(importedEntries, importedCourseMap, videoProgress, localProgress)
}

// Re-export for convenience
export { CHALLENGE_MILESTONES }
