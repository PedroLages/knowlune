/**
 * Data factory for ReviewRecord test objects (FSRS schema).
 *
 * Creates ReviewRecord-shaped data for seeding IndexedDB (Dexie)
 * in E2E tests. Uses deterministic time from test-time utils.
 *
 * FSRS fields: stability, difficulty, reps, lapses, state,
 * elapsed_days, scheduled_days, due, last_review
 */

import { FIXED_DATE, getRelativeDate } from '../../../utils/test-time'

export interface ReviewRecordTestData {
  id: string
  noteId: string
  rating: 'again' | 'hard' | 'good' | 'easy'
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: 0 | 1 | 2 | 3 // 0=New, 1=Learning, 2=Review, 3=Relearning
  elapsed_days: number
  scheduled_days: number
  due: string // ISO 8601
  last_review?: string // ISO 8601
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
    stability: 5.0, // ~5 day stability
    difficulty: 5.0, // Mid-range difficulty
    reps: 1,
    lapses: 0,
    state: 2, // Review state (previously reviewed card)
    elapsed_days: 3,
    scheduled_days: 5,
    due: getRelativeDate(-1), // Due yesterday (overdue)
    last_review: getRelativeDate(-3), // Reviewed 3 days ago
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
    stability: 4.0,
    difficulty: 5.0,
    reps: 2,
    lapses: 0,
    state: 2,
    elapsed_days: 5,
    scheduled_days: 4,
    due: getRelativeDate(-1), // Due yesterday
    last_review: getRelativeDate(-5), // Reviewed 5 days ago
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
    stability: 10.0,
    difficulty: 4.0,
    reps: 3,
    lapses: 0,
    state: 2,
    elapsed_days: 0,
    scheduled_days: 10,
    due: getRelativeDate(3), // Due in 3 days
    last_review: FIXED_DATE, // Just reviewed
    ...overrides,
  })
}

/**
 * Create a new (never-reviewed) review record.
 */
export function createNewReviewRecord(
  overrides: Partial<ReviewRecordTestData> = {}
): ReviewRecordTestData {
  return createReviewRecord({
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    state: 0, // New
    elapsed_days: 0,
    scheduled_days: 0,
    due: FIXED_DATE, // Due now
    last_review: undefined,
    ...overrides,
  })
}
