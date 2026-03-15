/**
 * Spaced Repetition Algorithm — SM-2 variant with 3-grade system.
 *
 * Pure functions for interval calculation and retention prediction.
 * No side effects — all persistence is handled by the store layer.
 */
import type { ReviewRating, ReviewRecord } from '@/data/types'
import { addDays } from 'date-fns'

/** Quality mapping: rating → SM-2 quality value (0-5 scale) */
const QUALITY_MAP: Record<ReviewRating, number> = {
  hard: 1,
  good: 3,
  easy: 5,
}

/** Default intervals (days) for first review by rating */
const FIRST_REVIEW_INTERVALS: Record<ReviewRating, number> = {
  hard: 1,
  good: 3,
  easy: 7,
}

/** Minimum ease factor to prevent intervals from shrinking too aggressively */
const MIN_EASE_FACTOR = 1.3

/** Default ease factor for new items */
const DEFAULT_EASE_FACTOR = 2.5

/** Minimum interval (days) */
const MIN_INTERVAL = 1

/**
 * Calculate the next review schedule after a rating.
 *
 * For first reviews (no existing record), uses fixed intervals per rating.
 * For subsequent reviews, applies SM-2 formula to adjust interval and ease factor.
 */
export function calculateNextReview(
  record: ReviewRecord | null,
  rating: ReviewRating,
  now: Date = new Date()
): { interval: number; easeFactor: number; nextReviewAt: string } {
  const quality = QUALITY_MAP[rating]

  if (!record || record.reviewCount === 0) {
    // First review — use fixed intervals
    const interval = FIRST_REVIEW_INTERVALS[rating]
    return {
      interval,
      easeFactor: calculateNewEaseFactor(DEFAULT_EASE_FACTOR, quality),
      nextReviewAt: addDays(now, interval).toISOString(),
    }
  }

  // Subsequent reviews — SM-2 formula
  const newEaseFactor = calculateNewEaseFactor(record.easeFactor, quality)

  let newInterval: number
  if (quality < 2) {
    // Hard rating — reset to short interval (but not below minimum)
    newInterval = MIN_INTERVAL
  } else {
    newInterval = Math.max(MIN_INTERVAL, Math.round(record.interval * newEaseFactor))
  }

  return {
    interval: newInterval,
    easeFactor: newEaseFactor,
    nextReviewAt: addDays(now, newInterval).toISOString(),
  }
}

/**
 * Predict current retention percentage (0-100) for a review record.
 *
 * Uses exponential forgetting curve: R = e^(-t/S)
 * where t = elapsed time since last review (days)
 * and S = stability (proportional to scheduled interval).
 */
export function predictRetention(record: ReviewRecord, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - new Date(record.reviewedAt).getTime()
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24)

  if (elapsedDays <= 0) return 100

  // Stability is proportional to the scheduled interval
  // Higher interval = slower decay (learner demonstrated stronger memory)
  const stability = record.interval

  if (stability <= 0) return 0

  const retention = Math.exp(-elapsedDays / stability) * 100
  return Math.max(0, Math.min(100, Math.round(retention)))
}

/**
 * Check if a review record is due for review.
 */
export function isDue(record: ReviewRecord, now: Date = new Date()): boolean {
  return new Date(record.nextReviewAt) <= now
}

/**
 * SM-2 ease factor adjustment formula.
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 */
function calculateNewEaseFactor(currentEF: number, quality: number): number {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  return Math.max(MIN_EASE_FACTOR, currentEF + delta)
}
