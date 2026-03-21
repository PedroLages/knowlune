import { describe, it, expect, vi } from 'vitest'
import { calculateMomentumScore, getMomentumTier } from '@/lib/momentum'
import type { StudySession } from '@/data/types'
import { createStudySession } from '../../../tests/support/fixtures/factories/session-factory'

function makeSession(daysAgo: number, courseId = 'course-1') {
  const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return createStudySession({
    courseId,
    startTime,
    endTime: startTime,
    duration: 3600,
    lastActivity: startTime,
  })
}

// ── getMomentumTier ────────────────────────────────────────────────

describe('getMomentumTier', () => {
  it('returns hot for scores >= 70', () => {
    expect(getMomentumTier(70)).toBe('hot')
    expect(getMomentumTier(100)).toBe('hot')
    expect(getMomentumTier(85)).toBe('hot')
  })

  it('returns warm for scores 30–69', () => {
    expect(getMomentumTier(30)).toBe('warm')
    expect(getMomentumTier(69)).toBe('warm')
    expect(getMomentumTier(50)).toBe('warm')
  })

  it('returns cold for scores < 30', () => {
    expect(getMomentumTier(0)).toBe('cold')
    expect(getMomentumTier(29)).toBe('cold')
  })
})

// ── calculateMomentumScore ─────────────────────────────────────────

describe('calculateMomentumScore — no sessions', () => {
  it('returns score 0, tier cold when no sessions and no completion', () => {
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 0,
      sessions: [],
    })
    expect(result.score).toBe(0)
    expect(result.tier).toBe('cold')
  })

  it('only completion contributes when no sessions', () => {
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 100,
      sessions: [],
    })
    // score = 0*0.4 + 100*0.3 + 0*0.3 = 30
    expect(result.score).toBe(30)
    expect(result.tier).toBe('warm')
  })
})

describe('calculateMomentumScore — weight isolation', () => {
  it('applies weights: 40% recency, 30% completion, 30% frequency', () => {
    // recencyScore ≈ 100 (session 0 days ago)
    // completionScore = 50
    // frequencyScore = 10 (1 session in 30 days × 10)
    // expected = round(100*0.4 + 50*0.3 + 10*0.3) = round(40 + 15 + 3) = 58
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 50,
      sessions: [makeSession(0)],
    })
    expect(result.score).toBe(58)
  })

  it('isolates completion-only contribution', () => {
    // All sessions > 14 days and > 30 days → recency = 0, frequency = 0
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 80,
      sessions: [makeSession(31)],
    })
    // score = 0*0.4 + 80*0.3 + 0*0.3 = 24
    expect(result.score).toBe(24)
  })
})

describe('calculateMomentumScore — recency', () => {
  it('recent session (0 days ago) gives high recency score', () => {
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 0,
      sessions: [makeSession(0)],
    })
    // recency ~100, frequency 10 (1 session * 10)
    // score = 100*0.4 + 0*0.3 + 10*0.3 = 43
    expect(result.score).toBe(43)
  })

  it('session exactly 14 days ago gives zero recency score', () => {
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 0,
      sessions: [makeSession(14)],
    })
    // recency = 0 (14-day cutoff), frequency = 10 (within 30d window)
    // score = 0*0.4 + 0*0.3 + 10*0.3 = 3
    expect(result.score).toBe(3)
  })

  it('session 13 days ago gives small positive recency', () => {
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 0,
      sessions: [makeSession(13)],
    })
    // recency ≈ 100 - 13*(100/14) ≈ 7.14
    // frequency = 10 (within 30d)
    // score = round(7.14*0.4 + 0 + 10*0.3) = round(2.86 + 3) = 6
    expect(result.score).toBe(6)
  })

  it('recent session scores higher than old session', () => {
    const recent = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 0,
      sessions: [makeSession(1)],
    })
    const old = calculateMomentumScore({
      courseId: 'c2',
      totalLessons: 10,
      completionPercent: 0,
      sessions: [makeSession(10)],
    })
    expect(recent.score).toBeGreaterThan(old.score)
  })
})

describe('calculateMomentumScore — frequency', () => {
  it('10 sessions in 30 days gives max frequency score', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(i))
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 0,
      sessions,
    })
    // frequency = min(100, 10*10) = 100
    // recency = ~100 (session 0 days ago)
    // score = 100*0.4 + 0*0.3 + 100*0.3 = 70
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(result.tier).toBe('hot')
  })

  it('sessions older than 30 days do not count toward frequency', () => {
    const oldSessions = Array.from({ length: 20 }, (_, i) => makeSession(31 + i))
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 0,
      sessions: oldSessions,
    })
    // All sessions > 30 days old, recency > 14d = 0
    expect(result.score).toBe(0)
  })

  it('more sessions give higher score than fewer sessions', () => {
    const many = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 0,
      sessions: Array.from({ length: 8 }, (_, i) => makeSession(i + 1)),
    })
    const few = calculateMomentumScore({
      courseId: 'c2',
      totalLessons: 10,
      completionPercent: 0,
      sessions: [makeSession(5)],
    })
    expect(many.score).toBeGreaterThan(few.score)
  })
})

describe('calculateMomentumScore — score clamping', () => {
  it('score is never below 0', () => {
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 0,
      sessions: [],
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('score is never above 100', () => {
    const sessions = Array.from({ length: 20 }, () => makeSession(0))
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      completionPercent: 100,
      sessions,
    })
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

// ── corrupted session filtering ─────────────────────────────────────

describe('calculateMomentumScore — corrupted session filtering', () => {
  const base = {
    courseId: 'c1',
    totalLessons: 10,
    completionPercent: 0,
  }

  it('returns score 0, tier cold when all sessions are corrupted', () => {
    const corrupted = [
      { courseId: 123, startTime: FIXED_DATE, duration: 1800 }, // non-string courseId
      { courseId: 'c1', startTime: 'not-a-date', duration: 1800 }, // bad timestamp
      { courseId: 'c1', startTime: FIXED_DATE, duration: -100 }, // negative duration
    ] as unknown as StudySession[]

    const result = calculateMomentumScore({ ...base, sessions: corrupted })
    expect(result.score).toBe(0)
    expect(result.tier).toBe('cold')
  })

  it('filters null/undefined entries without crashing', () => {
    const sessions = [null, undefined, makeSession(0)] as unknown as StudySession[]
    const result = calculateMomentumScore({ ...base, sessions })
    // Only the valid session should contribute
    expect(result.score).toBeGreaterThan(0)
  })

  it('filters sessions with non-string courseId', () => {
    const sessions = [
      { courseId: 42, startTime: FIXED_DATE, duration: 1800 },
      { courseId: '', startTime: FIXED_DATE, duration: 1800 },
    ] as unknown as StudySession[]
    const result = calculateMomentumScore({ ...base, sessions })
    expect(result.score).toBe(0)
    expect(result.tier).toBe('cold')
  })

  it('filters sessions with unparseable startTime', () => {
    const sessions = [
      { courseId: 'c1', startTime: 'garbage', duration: 1800 },
      { courseId: 'c1', startTime: '', duration: 1800 },
    ] as unknown as StudySession[]
    const result = calculateMomentumScore({ ...base, sessions })
    expect(result.score).toBe(0)
  })

  it('filters sessions with NaN duration', () => {
    const sessions = [
      { courseId: 'c1', startTime: FIXED_DATE, duration: NaN },
    ] as unknown as StudySession[]
    const result = calculateMomentumScore({ ...base, sessions })
    expect(result.score).toBe(0)
  })

  it('filters sessions with Infinity duration', () => {
    const sessions = [
      { courseId: 'c1', startTime: FIXED_DATE, duration: Infinity },
    ] as unknown as StudySession[]
    const result = calculateMomentumScore({ ...base, sessions })
    expect(result.score).toBe(0)
  })

  it('valid sessions still contribute when mixed with corrupted ones', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sessions = [
      makeSession(0), // valid — recent session
      { courseId: 123 } as unknown as StudySession, // corrupted
      null as unknown as StudySession, // corrupted
    ]
    const result = calculateMomentumScore({ ...base, sessions })
    expect(result.score).toBeGreaterThan(0)
    // console.warn should fire for 2 corrupted sessions
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipped 2 corrupted session(s)'))
    warnSpy.mockRestore()
  })

  it('handles undefined sessions input gracefully', () => {
    const result = calculateMomentumScore({
      ...base,
      sessions: undefined as unknown as StudySession[],
    })
    expect(result.score).toBe(0)
    expect(result.tier).toBe('cold')
  })
})

const FIXED_DATE = '2026-03-15T10:00:00.000Z'
