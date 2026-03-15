import { describe, it, expect } from 'vitest'
import { calculateNextReview, predictRetention, isDue } from '../spacedRepetition'
import type { ReviewRecord } from '@/data/types'

const FIXED_DATE = new Date('2026-03-15T12:00:00.000Z')

function makeRecord(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: 'test-id',
    noteId: 'note-1',
    rating: 'good',
    reviewedAt: FIXED_DATE.toISOString(),
    nextReviewAt: new Date(FIXED_DATE.getTime() + 3 * 86400000).toISOString(),
    interval: 3,
    easeFactor: 2.5,
    reviewCount: 1,
    ...overrides,
  }
}

describe('calculateNextReview', () => {
  describe('first review (no existing record)', () => {
    it('Hard produces ~1 day interval', () => {
      const result = calculateNextReview(null, 'hard', FIXED_DATE)
      expect(result.interval).toBe(1)
    })

    it('Good produces ~3 day interval', () => {
      const result = calculateNextReview(null, 'good', FIXED_DATE)
      expect(result.interval).toBe(3)
    })

    it('Easy produces ~7 day interval', () => {
      const result = calculateNextReview(null, 'easy', FIXED_DATE)
      expect(result.interval).toBe(7)
    })

    it('returns a valid ISO 8601 nextReviewAt', () => {
      const result = calculateNextReview(null, 'good', FIXED_DATE)
      expect(() => new Date(result.nextReviewAt)).not.toThrow()
      expect(new Date(result.nextReviewAt).getTime()).toBeGreaterThan(FIXED_DATE.getTime())
    })
  })

  describe('subsequent reviews', () => {
    it('Hard rating resets interval to 1 day', () => {
      const record = makeRecord({ interval: 10, reviewCount: 3 })
      const result = calculateNextReview(record, 'hard', FIXED_DATE)
      expect(result.interval).toBe(1)
    })

    it('Good rating extends interval moderately', () => {
      const record = makeRecord({ interval: 3, easeFactor: 2.5, reviewCount: 2 })
      const result = calculateNextReview(record, 'good', FIXED_DATE)
      expect(result.interval).toBeGreaterThan(3)
    })

    it('Easy rating extends interval more than Good', () => {
      const record = makeRecord({ interval: 3, easeFactor: 2.5, reviewCount: 2 })
      const goodResult = calculateNextReview(record, 'good', FIXED_DATE)
      const easyResult = calculateNextReview(record, 'easy', FIXED_DATE)
      expect(easyResult.interval).toBeGreaterThan(goodResult.interval)
    })

    it('interval never goes below 1 day', () => {
      const record = makeRecord({ interval: 1, easeFactor: 1.3, reviewCount: 5 })
      const result = calculateNextReview(record, 'hard', FIXED_DATE)
      expect(result.interval).toBeGreaterThanOrEqual(1)
    })
  })

  describe('ease factor', () => {
    it('decreases with Hard ratings', () => {
      const record = makeRecord({ easeFactor: 2.5 })
      const result = calculateNextReview(record, 'hard', FIXED_DATE)
      expect(result.easeFactor).toBeLessThan(2.5)
    })

    it('increases with Easy ratings', () => {
      const record = makeRecord({ easeFactor: 2.5 })
      const result = calculateNextReview(record, 'easy', FIXED_DATE)
      expect(result.easeFactor).toBeGreaterThan(2.5)
    })

    it('never drops below 1.3', () => {
      const record = makeRecord({ easeFactor: 1.3 })
      const result = calculateNextReview(record, 'hard', FIXED_DATE)
      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3)
    })
  })
})

describe('predictRetention', () => {
  it('returns 100% immediately after review', () => {
    const record = makeRecord({ reviewedAt: FIXED_DATE.toISOString() })
    const retention = predictRetention(record, FIXED_DATE)
    expect(retention).toBe(100)
  })

  it('decreases over time', () => {
    const record = makeRecord({ interval: 3 })
    const oneDay = new Date(FIXED_DATE.getTime() + 86400000)
    const threeDays = new Date(FIXED_DATE.getTime() + 3 * 86400000)

    const retentionAt1Day = predictRetention(record, oneDay)
    const retentionAt3Days = predictRetention(record, threeDays)

    expect(retentionAt1Day).toBeLessThan(100)
    expect(retentionAt3Days).toBeLessThan(retentionAt1Day)
  })

  it('higher interval decays slower', () => {
    const shortInterval = makeRecord({ interval: 1 })
    const longInterval = makeRecord({ interval: 10 })
    const twoDaysLater = new Date(FIXED_DATE.getTime() + 2 * 86400000)

    const retShort = predictRetention(shortInterval, twoDaysLater)
    const retLong = predictRetention(longInterval, twoDaysLater)

    expect(retLong).toBeGreaterThan(retShort)
  })

  it('returns value between 0 and 100', () => {
    const record = makeRecord({ interval: 3 })
    const farFuture = new Date(FIXED_DATE.getTime() + 365 * 86400000)
    const retention = predictRetention(record, farFuture)

    expect(retention).toBeGreaterThanOrEqual(0)
    expect(retention).toBeLessThanOrEqual(100)
  })

  it('near-zero retention for very old reviews', () => {
    const record = makeRecord({ interval: 1 })
    const farFuture = new Date(FIXED_DATE.getTime() + 100 * 86400000)
    const retention = predictRetention(record, farFuture)

    expect(retention).toBeLessThan(5)
  })
})

describe('isDue', () => {
  it('returns true when nextReviewAt is in the past', () => {
    const record = makeRecord({
      nextReviewAt: new Date(FIXED_DATE.getTime() - 86400000).toISOString(),
    })
    expect(isDue(record, FIXED_DATE)).toBe(true)
  })

  it('returns true when nextReviewAt is exactly now', () => {
    const record = makeRecord({ nextReviewAt: FIXED_DATE.toISOString() })
    expect(isDue(record, FIXED_DATE)).toBe(true)
  })

  it('returns false when nextReviewAt is in the future', () => {
    const record = makeRecord({
      nextReviewAt: new Date(FIXED_DATE.getTime() + 86400000).toISOString(),
    })
    expect(isDue(record, FIXED_DATE)).toBe(false)
  })
})
