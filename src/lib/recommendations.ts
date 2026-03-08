import type { Course } from '@/data/types'
import type { CourseProgress } from '@/lib/progress'

export interface CourseScore {
  course: Course
  score: number
  completionPercent: number
}

function getTotalLessons(course: Course): number {
  return course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
}

/**
 * Compute composite recommendation score for a single course.
 *
 * Formula: (recencyScore * 0.40) + (completionProximityScore * 0.40) + (frequencyScore * 0.20)
 *
 * - recencyScore: 1.0 = accessed today, 0.0 = not accessed in 30+ days
 * - completionProximityScore: higher completion % = higher score (closer to done)
 * - frequencyScore: sessions in past 30 days, capped at 10 (1.0 max)
 *
 * When E07-S01 (Momentum Score) is implemented, replace frequencyScore with the
 * actual momentum value by updating this function signature.
 */
export function computeCompositeScore(
  course: Course,
  progress: CourseProgress,
  sessionCountLast30Days: number
): number {
  const totalLessons = getTotalLessons(course)
  if (totalLessons === 0) return 0

  // Recency score: 0 days ago = 1.0, 30+ days ago = 0.0
  const daysSinceAccess = (Date.now() - new Date(progress.lastAccessedAt).getTime()) / 86_400_000
  const recencyScore = Math.max(0, 1 - daysSinceAccess / 30)

  // Completion proximity: higher % = higher score (prioritize almost-done courses)
  const completionPercent = progress.completedLessons.length / totalLessons
  const completionProximityScore = completionPercent

  // Frequency score: capped at 1.0 at 10+ sessions
  const frequencyScore = Math.min(1, sessionCountLast30Days / 10)

  return recencyScore * 0.4 + completionProximityScore * 0.4 + frequencyScore * 0.2
}

/**
 * Returns the top `limit` active courses ranked by composite score.
 *
 * A course is "active" if: completedLessons > 0 AND completionPercent < 100
 *
 * Returns all active courses if fewer than `limit` exist.
 * Returns [] if no active courses.
 */
export function getRecommendedCourses(
  courses: Course[],
  allProgress: Record<string, CourseProgress>,
  sessionCountsPerCourse: Record<string, number>,
  limit = 3
): CourseScore[] {
  const scored: CourseScore[] = []

  for (const course of courses) {
    const progress = allProgress[course.id]
    if (!progress) continue

    const totalLessons = getTotalLessons(course)
    if (totalLessons === 0) continue

    const completedCount = progress.completedLessons.length
    if (completedCount === 0) continue // not started
    if (completedCount >= totalLessons) continue // fully completed

    const completionPercent = Math.round((completedCount / totalLessons) * 100)
    const sessionCount = sessionCountsPerCourse[course.id] ?? 0
    const score = computeCompositeScore(course, progress, sessionCount)

    scored.push({ course, score, completionPercent })
  }

  // Sort descending by score, return top `limit`
  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}
