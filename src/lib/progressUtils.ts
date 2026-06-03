/**
 * Progress utility functions — shared helpers for course progress calculations.
 *
 * NOTE: The `isCourseInProgress` function is consumed by both PathTimeline
 * (syllabus status badges) and RoadmapListView (progress indicators on track
 * cards). Any future changes to the "in progress" semantics (e.g., adding a
 * minimum threshold, time-based decay, or new status values) must be validated
 * against both surfaces to ensure consistent behavior.
 */

/**
 * Check whether a course has been started (has some progress) but is not yet completed.
 *
 * @param completionPct — The course completion percentage (0-100), or null/undefined if unknown.
 * @param isCompleted — Whether the course is already marked as completed.
 * @returns true when the course has progress (1-99%) and is not fully completed.
 */
export function isCourseInProgress(
  completionPct: number | undefined | null,
  isCompleted: boolean
): boolean {
  return (completionPct ?? 0) > 0 && !isCompleted
}
