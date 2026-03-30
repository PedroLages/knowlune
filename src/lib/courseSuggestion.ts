import type { ImportedCourse } from '@/data/types'

export interface CourseSuggestionResult {
  course: ImportedCourse
  sharedTags: string[]
}

/**
 * Suggest the next course after completing one.
 *
 * Algorithm (AC5):
 * 1. Exclude the completed course
 * 2. Score by number of overlapping tags (case-insensitive)
 * 3. Tiebreak by most recently imported (importedAt desc)
 * 4. Return null if no other courses exist (AC6)
 */
export function suggestNextCourse(
  completedCourseId: string,
  allCourses: ImportedCourse[]
): CourseSuggestionResult | null {
  const completedCourse = allCourses.find(c => c.id === completedCourseId)
  if (!completedCourse) return null

  const completedTags = completedCourse.tags.map(t => t.toLowerCase())

  const candidates = allCourses
    .filter(c => c.id !== completedCourseId)
    .map(course => {
      const sharedTags = course.tags.filter(t => completedTags.includes(t.toLowerCase()))
      return { course, sharedTags, overlapCount: sharedTags.length }
    })

  if (candidates.length === 0) return null

  // Sort: most tag overlap first, then most recently imported
  candidates.sort((a, b) => {
    if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount
    return new Date(b.course.importedAt).getTime() - new Date(a.course.importedAt).getTime()
  })

  return {
    course: candidates[0].course,
    sharedTags: candidates[0].sharedTags,
  }
}
