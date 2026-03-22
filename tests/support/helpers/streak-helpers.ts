/**
 * Streak-related test helpers for building study logs and milestone data.
 */
import { createStudyAction } from '../fixtures/factories/course-factory'
import { FIXED_DATE } from '../../utils/test-time'

/** Build a study log with one lesson_complete per day for N consecutive days ending on FIXED_DATE. */
export function buildStreakLog(days: number) {
  const actions = []
  const now = new Date(FIXED_DATE)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(12, 0, 0, 0) // noon to avoid DST edge cases
    actions.push(
      createStudyAction({
        type: 'lesson_complete',
        courseId: 'streak-test-course',
        lessonId: `lesson-day-${days - i}`,
        timestamp: d.toISOString(),
      })
    )
  }
  return actions
}
