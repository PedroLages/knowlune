/**
 * Data factory for ReviewRecord test objects.
 *
 * Creates ReviewRecord-shaped data for seeding IndexedDB (Dexie)
 * in E2E tests. Uses deterministic time from test-time utils.
 */

import { FIXED_DATE, getRelativeDate } from '../../../utils/test-time'

export interface ReviewRecordTestData {
  id: string
  noteId: string
  rating: 'hard' | 'good' | 'easy'
  reviewedAt: string
  nextReviewAt: string
  interval: number
  easeFactor: number
  reviewCount: number
}

let counter = 0

export function createReviewRecord(
  overrides: Partial<ReviewRecordTestData> = {}
): ReviewRecordTestData {
  counter++
  return {
    id: overrides.id ?? `review-${counter}`,
    noteId: overrides.noteId ?? `note-${counter}`,
    rating: 'good',
    reviewedAt: getRelativeDate(-3), // Reviewed 3 days ago
    nextReviewAt: getRelativeDate(-1), // Due yesterday (overdue)
    interval: 3,
    easeFactor: 2.5,
    reviewCount: 1,
    ...overrides,
  }
}

/**
 * Create a review record that is due now (overdue by 1 day).
 */
export function createDueReviewRecord(
  overrides: Partial<ReviewRecordTestData> = {}
): ReviewRecordTestData {
  return createReviewRecord({
    reviewedAt: getRelativeDate(-5),
    nextReviewAt: getRelativeDate(-1),
    interval: 4,
    ...overrides,
  })
}

/**
 * Create a review record that is NOT yet due (scheduled for the future).
 */
export function createFutureReviewRecord(
  overrides: Partial<ReviewRecordTestData> = {}
): ReviewRecordTestData {
  return createReviewRecord({
    reviewedAt: FIXED_DATE,
    nextReviewAt: getRelativeDate(3),
    interval: 3,
    ...overrides,
  })
}
