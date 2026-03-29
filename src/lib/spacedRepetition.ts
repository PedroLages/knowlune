/**
 * Spaced Repetition Algorithm — FSRS (Free Spaced Repetition Scheduler) wrapper.
 *
 * Thin wrapper around ts-fsrs. This is the ONLY file that imports from ts-fsrs
 * (single gateway pattern). All other modules use the exported functions here.
 *
 * Pure functions for interval calculation and retention prediction.
 * No side effects — all persistence is handled by the store layer.
 */
import type { ReviewRating, CardState } from '@/data/types'
import {
  FSRS,
  Rating,
  createEmptyCard,
  forgetting_curve,
  type Card as FSRSCard,
  type Grade,
} from 'ts-fsrs'

// ─── FSRS Configuration ──────────────────────────────────────────────

/** Production FSRS instance — enable_fuzz provides natural interval variation */
const fsrs = new FSRS({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
})

/** Test FSRS instance — deterministic (no fuzz) for assertions */
export const fsrsTest = new FSRS({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false,
  enable_short_term: true,
})

// ─── Rating Conversion ───────────────────────────────────────────────

/** Map app-level string ratings to ts-fsrs Rating enum values */
const RATING_MAP: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

// ─── Type Definitions ────────────────────────────────────────────────

/** FSRS scheduling result returned by calculateNextReview */
export interface FSRSSchedulingResult {
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: CardState
  elapsed_days: number
  scheduled_days: number
  due: string // ISO 8601
  last_review: string // ISO 8601
}

/** Minimal card state required for scheduling calculations */
export interface FSRSCardState {
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: CardState
  elapsed_days: number
  scheduled_days: number
  due: string // ISO 8601
  last_review?: string // ISO 8601 — undefined for new/never-reviewed cards
}

// ─── Core Functions ──────────────────────────────────────────────────

/**
 * Calculate the next review schedule after a rating using FSRS.
 *
 * Converts app-level types to ts-fsrs types, calls fsrs.next(),
 * then converts the result back to app-level types (ISO strings, CardState).
 *
 * @param card - Current card state, or null for a brand-new card
 * @param rating - App-level string rating ('again' | 'hard' | 'good' | 'easy')
 * @param now - Current timestamp (defaults to new Date())
 * @param fsrsInstance - FSRS instance to use (defaults to production; pass fsrsTest for tests)
 */
export function calculateNextReview(
  card: FSRSCardState | null,
  rating: ReviewRating,
  now: Date = new Date(),
  fsrsInstance: FSRS = fsrs
): FSRSSchedulingResult {
  const grade = RATING_MAP[rating]

  // Build ts-fsrs Card from app state
  const fsrsCard: FSRSCard = card
    ? {
        due: new Date(card.due),
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state,
        last_review: card.last_review ? new Date(card.last_review) : undefined,
      }
    : createEmptyCard(now)

  const result = fsrsInstance.next(fsrsCard, now, grade)
  const nextCard = result.card

  return {
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    reps: nextCard.reps,
    lapses: nextCard.lapses,
    state: nextCard.state as CardState,
    elapsed_days: nextCard.elapsed_days,
    scheduled_days: nextCard.scheduled_days,
    due: nextCard.due.toISOString(),
    last_review: nextCard.last_review ? nextCard.last_review.toISOString() : now.toISOString(),
  }
}

/**
 * Predict current retention percentage (0-100) for a card.
 *
 * Uses FSRS power-law forgetting curve:
 *   R(t,S) = (1 + FACTOR * t / (9 * S))^DECAY
 * where t = elapsed days since last review, S = stability.
 *
 * @param record - Object with last_review (ISO string) and stability
 * @param now - Current timestamp (defaults to new Date())
 * @returns Retention percentage (0-100), rounded to nearest integer
 */
export function predictRetention(
  record: { last_review?: string; stability: number },
  now: Date = new Date()
): number {
  if (!record.last_review) return 0

  const lastReviewDate = new Date(record.last_review)
  if (isNaN(lastReviewDate.getTime())) return 0

  const elapsedMs = now.getTime() - lastReviewDate.getTime()
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24)

  if (elapsedDays <= 0) return 100
  if (record.stability <= 0) return 0

  // Use ts-fsrs forgetting_curve: returns 0-1 probability
  const retention = forgetting_curve(elapsedDays, record.stability)
  return Math.max(0, Math.min(100, Math.round(retention * 100)))
}

/**
 * Check if a card is due for review.
 *
 * @param card - Object with `due` field (ISO 8601 string)
 * @param now - Current timestamp (defaults to new Date())
 * @returns true if the card is due (due <= now)
 */
export function isDue(card: { due: string }, now: Date = new Date()): boolean {
  return new Date(card.due) <= now
}
