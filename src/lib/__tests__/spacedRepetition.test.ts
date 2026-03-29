/**
 * Unit tests for FSRS spaced repetition algorithm wrapper.
 *
 * E59-S07: Complete rewrite from SM-2 tests to FSRS tests.
 * All tests use:
 * - `fsrsTest` instance (enable_fuzz: false) for deterministic scheduling
 * - `FIXED_DATE` constant (per ESLint rule: test-patterns/deterministic-time)
 */
import { describe, it, expect } from 'vitest'
import {
  calculateNextReview,
  predictRetention,
  isDue,
  fsrsTest,
  type FSRSCardState,
  type FSRSSchedulingResult,
} from '../spacedRepetition'
import type { CardState } from '@/data/types'

// ─── Constants ──────────────────────────────────────────────────────

const FIXED_DATE = new Date('2026-03-15T12:00:00.000Z')

/** Helper to build a card state object for test inputs */
function makeCardState(overrides: Partial<FSRSCardState> = {}): FSRSCardState {
  return {
    stability: 5,
    difficulty: 5,
    reps: 3,
    lapses: 0,
    state: 2, // Review state
    elapsed_days: 5,
    scheduled_days: 5,
    due: FIXED_DATE.toISOString(),
    last_review: new Date(FIXED_DATE.getTime() - 5 * 86400000).toISOString(),
    ...overrides,
  }
}

// ─── calculateNextReview: new card (null input) ─────────────────────

describe('calculateNextReview', () => {
  describe('new card (null input) + each rating', () => {
    it('Again rating → state transitions to Learning (1)', () => {
      const result = calculateNextReview(null, 'again', FIXED_DATE, fsrsTest)
      expect(result.state).toBe(1) // Learning (short-term learning enabled)
      expect(result.reps).toBe(1) // FSRS increments reps on first review
      expect(result.lapses).toBe(0)
    })

    it('Hard rating → state transitions to Learning (1)', () => {
      const result = calculateNextReview(null, 'hard', FIXED_DATE, fsrsTest)
      expect(result.state).toBe(1) // Learning (short-term learning enabled)
      expect(result.reps).toBe(1)
      expect(result.lapses).toBe(0)
    })

    it('Good rating → state transitions to Learning (1)', () => {
      const result = calculateNextReview(null, 'good', FIXED_DATE, fsrsTest)
      expect(result.state).toBe(1) // Learning (short-term learning enabled)
      expect(result.reps).toBe(1)
      expect(result.lapses).toBe(0)
    })

    it('Easy rating → state transitions to Review (2)', () => {
      const result = calculateNextReview(null, 'easy', FIXED_DATE, fsrsTest)
      expect(result.state).toBe(2) // Easy on new card → straight to Review
      expect(result.reps).toBe(1)
      expect(result.lapses).toBe(0)
    })

    it('stability increases with better ratings (again < hard < good < easy)', () => {
      const again = calculateNextReview(null, 'again', FIXED_DATE, fsrsTest)
      const hard = calculateNextReview(null, 'hard', FIXED_DATE, fsrsTest)
      const good = calculateNextReview(null, 'good', FIXED_DATE, fsrsTest)
      const easy = calculateNextReview(null, 'easy', FIXED_DATE, fsrsTest)

      expect(again.stability).toBeLessThanOrEqual(hard.stability)
      expect(hard.stability).toBeLessThanOrEqual(good.stability)
      expect(good.stability).toBeLessThan(easy.stability)
    })

    it('scheduled_days increases with better ratings', () => {
      const again = calculateNextReview(null, 'again', FIXED_DATE, fsrsTest)
      const hard = calculateNextReview(null, 'hard', FIXED_DATE, fsrsTest)
      const good = calculateNextReview(null, 'good', FIXED_DATE, fsrsTest)
      const easy = calculateNextReview(null, 'easy', FIXED_DATE, fsrsTest)

      expect(again.scheduled_days).toBeLessThanOrEqual(hard.scheduled_days)
      expect(hard.scheduled_days).toBeLessThanOrEqual(good.scheduled_days)
      expect(good.scheduled_days).toBeLessThanOrEqual(easy.scheduled_days)
    })

    it('difficulty decreases with better ratings (again has highest difficulty)', () => {
      const again = calculateNextReview(null, 'again', FIXED_DATE, fsrsTest)
      const easy = calculateNextReview(null, 'easy', FIXED_DATE, fsrsTest)

      expect(again.difficulty).toBeGreaterThan(easy.difficulty)
    })

    it('returns valid ISO 8601 due date', () => {
      const result = calculateNextReview(null, 'good', FIXED_DATE, fsrsTest)
      expect(() => new Date(result.due)).not.toThrow()
      expect(new Date(result.due).getTime()).toBeGreaterThanOrEqual(FIXED_DATE.getTime())
    })

    it('returns valid ISO 8601 last_review date', () => {
      const result = calculateNextReview(null, 'good', FIXED_DATE, fsrsTest)
      expect(() => new Date(result.last_review)).not.toThrow()
      expect(result.last_review).toBe(FIXED_DATE.toISOString())
    })
  })

  // ─── calculateNextReview: review card + each rating ─────────────────

  describe('review card + each rating → stability/difficulty changes', () => {
    it('Again rating → lapses increment, state becomes Relearning (3)', () => {
      const card = makeCardState({ state: 2, reps: 5, lapses: 0 })
      const result = calculateNextReview(card, 'again', FIXED_DATE, fsrsTest)

      expect(result.lapses).toBeGreaterThan(0)
      expect(result.state).toBe(3) // Relearning
    })

    it('Again rating → stability decreases (memory reset)', () => {
      const card = makeCardState({ stability: 10, state: 2 })
      const result = calculateNextReview(card, 'again', FIXED_DATE, fsrsTest)

      expect(result.stability).toBeLessThan(10)
    })

    it('Again rating → difficulty increases', () => {
      const card = makeCardState({ difficulty: 5, state: 2 })
      const result = calculateNextReview(card, 'again', FIXED_DATE, fsrsTest)

      expect(result.difficulty).toBeGreaterThan(5)
    })

    it('Hard rating → stability still grows but less than Good', () => {
      const card = makeCardState({ stability: 5, state: 2 })
      const hardResult = calculateNextReview(card, 'hard', FIXED_DATE, fsrsTest)
      const goodResult = calculateNextReview(card, 'good', FIXED_DATE, fsrsTest)

      expect(hardResult.stability).toBeGreaterThanOrEqual(card.stability)
      expect(goodResult.stability).toBeGreaterThan(hardResult.stability)
    })

    it('Good rating → stability grows, state stays Review (2)', () => {
      const card = makeCardState({ stability: 5, state: 2 })
      const result = calculateNextReview(card, 'good', FIXED_DATE, fsrsTest)

      expect(result.stability).toBeGreaterThan(card.stability)
      expect(result.state).toBe(2) // Stays in Review
    })

    it('Easy rating → stability grows most, difficulty decreases', () => {
      const card = makeCardState({ stability: 5, difficulty: 5, state: 2 })
      const result = calculateNextReview(card, 'easy', FIXED_DATE, fsrsTest)

      expect(result.stability).toBeGreaterThan(card.stability)
      expect(result.difficulty).toBeLessThan(5)
    })

    it('Easy rating → larger stability gain than Good', () => {
      const card = makeCardState({ stability: 5, state: 2 })
      const goodResult = calculateNextReview(card, 'good', FIXED_DATE, fsrsTest)
      const easyResult = calculateNextReview(card, 'easy', FIXED_DATE, fsrsTest)

      expect(easyResult.stability).toBeGreaterThan(goodResult.stability)
    })

    it('reps increments for successful reviews (Hard/Good/Easy)', () => {
      const card = makeCardState({ reps: 3, state: 2 })
      const hardResult = calculateNextReview(card, 'hard', FIXED_DATE, fsrsTest)
      const goodResult = calculateNextReview(card, 'good', FIXED_DATE, fsrsTest)
      const easyResult = calculateNextReview(card, 'easy', FIXED_DATE, fsrsTest)

      expect(hardResult.reps).toBe(4)
      expect(goodResult.reps).toBe(4)
      expect(easyResult.reps).toBe(4)
    })

    it('scheduled_days increases proportionally with stability', () => {
      const card = makeCardState({ stability: 5, state: 2 })
      const result = calculateNextReview(card, 'good', FIXED_DATE, fsrsTest)

      expect(result.scheduled_days).toBeGreaterThan(0)
      // Due date should be in the future by scheduled_days
      const dueDate = new Date(result.due)
      const daysDiff = (dueDate.getTime() - FIXED_DATE.getTime()) / 86400000
      expect(daysDiff).toBeCloseTo(result.scheduled_days, 0)
    })
  })

  // ─── calculateNextReview: edge cases ────────────────────────────────

  describe('edge cases', () => {
    it('card with last_review: undefined (new card state) is handled', () => {
      const card = makeCardState({
        stability: 0,
        difficulty: 0,
        reps: 0,
        lapses: 0,
        state: 0, // New
        elapsed_days: 0,
        scheduled_days: 0,
        due: FIXED_DATE.toISOString(),
        last_review: undefined,
      })
      const result = calculateNextReview(card, 'good', FIXED_DATE, fsrsTest)

      expect(result.state).toBeGreaterThanOrEqual(0)
      expect(result.stability).toBeGreaterThan(0)
      expect(result.due).toBeTruthy()
      expect(result.last_review).toBe(FIXED_DATE.toISOString())
    })

    it('null card (brand new, never seen) produces valid result', () => {
      const result = calculateNextReview(null, 'good', FIXED_DATE, fsrsTest)

      expect(result.stability).toBeGreaterThan(0)
      expect(result.difficulty).toBeGreaterThanOrEqual(0)
      expect(result.due).toBeTruthy()
      expect(result.last_review).toBe(FIXED_DATE.toISOString())
    })

    it('difficulty stays within 0-10 range after many Again ratings', () => {
      let card: FSRSCardState | null = null
      let result: FSRSSchedulingResult

      // Simulate 10 consecutive Again ratings
      for (let i = 0; i < 10; i++) {
        result = calculateNextReview(card, 'again', FIXED_DATE, fsrsTest)
        card = {
          stability: result.stability,
          difficulty: result.difficulty,
          reps: result.reps,
          lapses: result.lapses,
          state: result.state as CardState,
          elapsed_days: result.elapsed_days,
          scheduled_days: result.scheduled_days,
          due: result.due,
          last_review: result.last_review,
        }
      }

      expect(card!.difficulty).toBeGreaterThanOrEqual(0)
      expect(card!.difficulty).toBeLessThanOrEqual(10)
    })

    it('difficulty stays within 0-10 range after many Easy ratings', () => {
      let card: FSRSCardState | null = null
      let result: FSRSSchedulingResult

      // Simulate 10 consecutive Easy ratings
      for (let i = 0; i < 10; i++) {
        result = calculateNextReview(card, 'easy', FIXED_DATE, fsrsTest)
        card = {
          stability: result.stability,
          difficulty: result.difficulty,
          reps: result.reps,
          lapses: result.lapses,
          state: result.state as CardState,
          elapsed_days: result.elapsed_days,
          scheduled_days: result.scheduled_days,
          due: result.due,
          last_review: result.last_review,
        }
      }

      expect(card!.difficulty).toBeGreaterThanOrEqual(0)
      expect(card!.difficulty).toBeLessThanOrEqual(10)
    })

    it('stability is always positive after review', () => {
      const ratings = ['again', 'hard', 'good', 'easy'] as const
      for (const rating of ratings) {
        const result = calculateNextReview(null, rating, FIXED_DATE, fsrsTest)
        expect(result.stability).toBeGreaterThanOrEqual(0)
      }
    })
  })
})

// ─── predictRetention ────────────────────────────────────────────────

describe('predictRetention', () => {
  it('returns 100% immediately after review (0 elapsed days)', () => {
    const record = { last_review: FIXED_DATE.toISOString(), stability: 5 }
    const retention = predictRetention(record, FIXED_DATE)
    expect(retention).toBe(100)
  })

  it('decreases over time (power-law decay)', () => {
    const record = { last_review: FIXED_DATE.toISOString(), stability: 5 }
    const oneDay = new Date(FIXED_DATE.getTime() + 86400000)
    const fiveDays = new Date(FIXED_DATE.getTime() + 5 * 86400000)

    const retAt1Day = predictRetention(record, oneDay)
    const retAt5Days = predictRetention(record, fiveDays)

    expect(retAt1Day).toBeLessThan(100)
    expect(retAt5Days).toBeLessThan(retAt1Day)
    expect(retAt5Days).toBeGreaterThan(0)
  })

  it('higher stability → slower decay', () => {
    const lowStability = { last_review: FIXED_DATE.toISOString(), stability: 1 }
    const highStability = { last_review: FIXED_DATE.toISOString(), stability: 30 }
    const twoDaysLater = new Date(FIXED_DATE.getTime() + 2 * 86400000)

    const retLow = predictRetention(lowStability, twoDaysLater)
    const retHigh = predictRetention(highStability, twoDaysLater)

    expect(retHigh).toBeGreaterThan(retLow)
  })

  it('returns value between 0 and 100', () => {
    const record = { last_review: FIXED_DATE.toISOString(), stability: 3 }
    const farFuture = new Date(FIXED_DATE.getTime() + 365 * 86400000)
    const retention = predictRetention(record, farFuture)

    expect(retention).toBeGreaterThanOrEqual(0)
    expect(retention).toBeLessThanOrEqual(100)
  })

  it('low retention for very old reviews with low stability', () => {
    const record = { last_review: FIXED_DATE.toISOString(), stability: 1 }
    const farFuture = new Date(FIXED_DATE.getTime() + 100 * 86400000)
    const retention = predictRetention(record, farFuture)

    // Power-law decay at t=100, S=1 yields ~20% — much lower than fresh
    expect(retention).toBeLessThan(25)
    expect(retention).toBeGreaterThan(0)
  })

  it('uses power-law decay (not exponential)', () => {
    // Power-law decays slower at long intervals than exponential.
    // At t=stability, FSRS retention should be ~90% (by design of R=0.9).
    const record = { last_review: FIXED_DATE.toISOString(), stability: 10 }
    const atStability = new Date(FIXED_DATE.getTime() + 10 * 86400000)
    const retention = predictRetention(record, atStability)

    // FSRS forgetting curve at t=S should yield ~90% retention
    // (request_retention=0.9 means R(S)≈0.9)
    expect(retention).toBeGreaterThanOrEqual(88)
    expect(retention).toBeLessThanOrEqual(92)
  })

  it('returns 0 when last_review is undefined (never reviewed)', () => {
    const record = { last_review: undefined, stability: 5 }
    const retention = predictRetention(record, FIXED_DATE)
    expect(retention).toBe(0)
  })

  it('returns 0 when stability is 0', () => {
    const record = { last_review: FIXED_DATE.toISOString(), stability: 0 }
    const oneDayLater = new Date(FIXED_DATE.getTime() + 86400000)
    const retention = predictRetention(record, oneDayLater)
    expect(retention).toBe(0)
  })

  it('returns 0 for invalid last_review date', () => {
    const record = { last_review: 'not-a-date', stability: 5 }
    const retention = predictRetention(record, FIXED_DATE)
    expect(retention).toBe(0)
  })
})

// ─── isDue ──────────────────────────────────────────────────────────

describe('isDue', () => {
  it('returns true when due date is in the past', () => {
    const card = { due: new Date(FIXED_DATE.getTime() - 86400000).toISOString() }
    expect(isDue(card, FIXED_DATE)).toBe(true)
  })

  it('returns true when due date is exactly now', () => {
    const card = { due: FIXED_DATE.toISOString() }
    expect(isDue(card, FIXED_DATE)).toBe(true)
  })

  it('returns false when due date is in the future', () => {
    const card = { due: new Date(FIXED_DATE.getTime() + 86400000).toISOString() }
    expect(isDue(card, FIXED_DATE)).toBe(false)
  })

  it('works with FSRSSchedulingResult output (integration)', () => {
    const result = calculateNextReview(null, 'good', FIXED_DATE, fsrsTest)
    // A new card rated Good should have due date in the future
    expect(isDue({ due: result.due }, FIXED_DATE)).toBe(false)
    // But it should be due after its scheduled interval
    const farFuture = new Date(FIXED_DATE.getTime() + 365 * 86400000)
    expect(isDue({ due: result.due }, farFuture)).toBe(true)
  })
})

// ─── Full review flow integration ───────────────────────────────────

describe('full review flow integration', () => {
  it('new card → Good → Good → Good produces increasing stability', () => {
    // First review: new card rated Good
    const first = calculateNextReview(null, 'good', FIXED_DATE, fsrsTest)

    // Second review: at the due date
    const secondDate = new Date(first.due)
    const secondCard: FSRSCardState = {
      stability: first.stability,
      difficulty: first.difficulty,
      reps: first.reps,
      lapses: first.lapses,
      state: first.state as CardState,
      elapsed_days: first.elapsed_days,
      scheduled_days: first.scheduled_days,
      due: first.due,
      last_review: first.last_review,
    }
    const second = calculateNextReview(secondCard, 'good', secondDate, fsrsTest)

    // Third review
    const thirdDate = new Date(second.due)
    const thirdCard: FSRSCardState = {
      stability: second.stability,
      difficulty: second.difficulty,
      reps: second.reps,
      lapses: second.lapses,
      state: second.state as CardState,
      elapsed_days: second.elapsed_days,
      scheduled_days: second.scheduled_days,
      due: second.due,
      last_review: second.last_review,
    }
    const third = calculateNextReview(thirdCard, 'good', thirdDate, fsrsTest)

    // Stability should increase with each successful review
    expect(second.stability).toBeGreaterThan(first.stability)
    expect(third.stability).toBeGreaterThan(second.stability)

    // Scheduled days should increase too
    expect(second.scheduled_days).toBeGreaterThan(first.scheduled_days)
    expect(third.scheduled_days).toBeGreaterThan(second.scheduled_days)
  })

  it('review card → Again → Good recovery path', () => {
    // Start with a Review-state card
    const card = makeCardState({ stability: 10, difficulty: 5, state: 2, reps: 5, lapses: 0 })

    // Fail: rate Again
    const failed = calculateNextReview(card, 'again', FIXED_DATE, fsrsTest)
    expect(failed.state).toBe(3) // Relearning
    expect(failed.lapses).toBeGreaterThan(0)
    expect(failed.stability).toBeLessThan(10)

    // Recover: rate Good
    const recoveredCard: FSRSCardState = {
      stability: failed.stability,
      difficulty: failed.difficulty,
      reps: failed.reps,
      lapses: failed.lapses,
      state: failed.state as CardState,
      elapsed_days: failed.elapsed_days,
      scheduled_days: failed.scheduled_days,
      due: failed.due,
      last_review: failed.last_review,
    }
    const recovered = calculateNextReview(
      recoveredCard,
      'good',
      new Date(failed.due),
      fsrsTest
    )

    // Should transition back to Review state
    expect(recovered.state).toBe(2)
    expect(recovered.stability).toBeGreaterThan(0)
  })
})
