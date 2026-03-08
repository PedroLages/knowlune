import type { Course } from '@/data/types'
import type { CourseProgress } from './progress'

export interface SuggestionCandidate {
  course: Course
  score: number
  tagOverlapCount: number
}

/**
 * Compute the best next course to suggest after completing a course.
 *
 * Scoring:
 *   tagScore     = sharedTagCount / max(completedCourse.tags.length, 1)  [0–1]
 *   recencyScore = clamp(1 − daysSinceLastStudy / 14, 0, 1)
 *   progressScore = completedLessons / totalLessons                       [0–1]
 *   momentumProxy = (recencyScore * 0.5) + (progressScore * 0.5)
 *   finalScore    = (tagScore * 0.6) + (momentumProxy * 0.4)
 *
 * Returns null when no eligible candidates exist (all other courses are 100% done).
 */
export function computeNextCourseSuggestion(
  completedCourseId: string,
  allCourses: Course[],
  allProgress: Record<string, CourseProgress>
): SuggestionCandidate | null {
  const completedCourse = allCourses.find(c => c.id === completedCourseId)
  if (!completedCourse) return null

  const completedTags = completedCourse.tags.map(t => t.toLowerCase())

  const candidates: SuggestionCandidate[] = []

  for (const course of allCourses) {
    if (course.id === completedCourseId) continue

    const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
    if (totalLessons === 0) continue

    const progress = allProgress[course.id]
    const completedLessons = progress?.completedLessons.length ?? 0

    // Exclude 100%-complete courses
    if (completedLessons >= totalLessons) continue

    // Tag overlap
    const courseTags = course.tags.map(t => t.toLowerCase())
    const sharedCount = courseTags.filter(t => completedTags.includes(t)).length
    const tagScore = sharedCount / Math.max(completedTags.length, 1)

    // Momentum proxy
    const progressScore = completedLessons / totalLessons
    const recencyScore = computeRecencyScore(progress?.lastAccessedAt)
    const momentumProxy = recencyScore * 0.5 + progressScore * 0.5

    const finalScore = tagScore * 0.6 + momentumProxy * 0.4

    candidates.push({
      course,
      score: finalScore,
      tagOverlapCount: sharedCount,
    })
  }

  if (candidates.length === 0) return null

  // Sort: score desc, then tagOverlapCount desc, then momentumProxy desc
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.tagOverlapCount !== a.tagOverlapCount) return b.tagOverlapCount - a.tagOverlapCount
    // Recompute momentumProxy for stable tiebreaker
    return getMomentumProxy(b.course, allProgress) - getMomentumProxy(a.course, allProgress)
  })

  return candidates[0]
}

/**
 * Recency decay: 1.0 at 0 days, 0.0 at 14+ days since last study.
 * Returns 0 if no progress record exists (never studied).
 */
function computeRecencyScore(lastAccessedAt?: string): number {
  if (!lastAccessedAt) return 0
  const daysSince =
    (Date.now() - new Date(lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.min(1, 1 - daysSince / 14))
}

function getMomentumProxy(course: Course, allProgress: Record<string, CourseProgress>): number {
  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const progress = allProgress[course.id]
  const completedLessons = progress?.completedLessons.length ?? 0
  const progressScore = totalLessons > 0 ? completedLessons / totalLessons : 0
  const recencyScore = computeRecencyScore(progress?.lastAccessedAt)
  return recencyScore * 0.5 + progressScore * 0.5
}
