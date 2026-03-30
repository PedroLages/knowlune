/**
 * Data factory for Flashcard test objects (FSRS schema).
 *
 * Creates Flashcard-shaped data for seeding IndexedDB (Dexie)
 * in E2E tests. Uses deterministic time from test-time utils.
 *
 * Matches the Flashcard interface from src/data/types.ts with
 * embedded FSRS fields for self-contained scheduling.
 */

import { FIXED_DATE, getRelativeDate } from '../../../utils/test-time'

export interface FlashcardTestData {
  id: string
  courseId: string
  noteId?: string
  front: string
  back: string
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: 0 | 1 | 2 | 3 // 0=New, 1=Learning, 2=Review, 3=Relearning
  elapsed_days: number
  scheduled_days: number
  due: string // ISO 8601
  last_review?: string // ISO 8601
  lastRating?: 'again' | 'hard' | 'good' | 'easy'
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

let counter = 0

/**
 * Create a flashcard with FSRS defaults (new card, never reviewed).
 */
export function createFlashcard(overrides: Partial<FlashcardTestData> = {}): FlashcardTestData {
  counter++
  return {
    id: overrides.id ?? `flashcard-${counter}`,
    courseId: overrides.courseId ?? 'course-1',
    front: `Question ${counter}`,
    back: `Answer ${counter}`,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    state: 0, // New
    elapsed_days: 0,
    scheduled_days: 0,
    due: FIXED_DATE, // Due immediately (new card)
    last_review: undefined,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

/**
 * Create a flashcard that is due for review (overdue by 1 day).
 */
export function createDueFlashcard(overrides: Partial<FlashcardTestData> = {}): FlashcardTestData {
  return createFlashcard({
    stability: 5.0,
    difficulty: 5.0,
    reps: 2,
    lapses: 0,
    state: 2, // Review
    elapsed_days: 5,
    scheduled_days: 5,
    due: getRelativeDate(-1), // Due yesterday
    last_review: getRelativeDate(-5), // Reviewed 5 days ago
    lastRating: 'good',
    ...overrides,
  })
}

/**
 * Create a flashcard that is NOT yet due (scheduled for the future).
 */
export function createFutureFlashcard(
  overrides: Partial<FlashcardTestData> = {}
): FlashcardTestData {
  return createFlashcard({
    stability: 10.0,
    difficulty: 4.0,
    reps: 3,
    lapses: 0,
    state: 2, // Review
    elapsed_days: 0,
    scheduled_days: 10,
    due: getRelativeDate(3), // Due in 3 days
    last_review: FIXED_DATE, // Just reviewed
    lastRating: 'easy',
    ...overrides,
  })
}

/**
 * Create a flashcard in the learning state (just rated, short-term scheduling).
 */
export function createLearningFlashcard(
  overrides: Partial<FlashcardTestData> = {}
): FlashcardTestData {
  return createFlashcard({
    stability: 0.4,
    difficulty: 5.0,
    reps: 1,
    lapses: 0,
    state: 1, // Learning
    elapsed_days: 0,
    scheduled_days: 0,
    due: FIXED_DATE, // Due now (learning step)
    last_review: FIXED_DATE,
    lastRating: 'good',
    ...overrides,
  })
}
