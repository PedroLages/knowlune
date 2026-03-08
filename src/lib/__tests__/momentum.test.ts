import 'fake-indexeddb/auto'
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as progress from '@/lib/progress'
import { calculateMomentumScore, getMomentumTier } from '@/lib/momentum'
import type { StudySession } from '@/data/types'

// getCourseCompletionPercent reads localStorage — mock it for isolation
function mockCompletion(percent: number) {
  vi.spyOn(progress, 'getCourseCompletionPercent').mockReturnValue(percent)
}

afterEach(() => {
  vi.restoreAllMocks()
})

function makeSession(daysAgo: number, courseId = 'course-1'): StudySession {
  const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return {
    id: crypto.randomUUID(),
    courseId,
    contentItemId: 'lesson-1',
    startTime,
    endTime: startTime,
    duration: 3600,
    idleTime: 0,
    videosWatched: [],
    lastActivity: startTime,
    sessionType: 'video',
  }
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
    mockCompletion(0)
    const result = calculateMomentumScore({ courseId: 'c1', totalLessons: 10, sessions: [] })
    expect(result.score).toBe(0)
    expect(result.tier).toBe('cold')
  })

  it('only completion contributes when no sessions', () => {
    mockCompletion(100)
    const result = calculateMomentumScore({ courseId: 'c1', totalLessons: 10, sessions: [] })
    // score = 0*0.4 + 100*0.3 + 0*0.3 = 30
    expect(result.score).toBe(30)
    expect(result.tier).toBe('warm')
  })
})

describe('calculateMomentumScore — recency', () => {
  it('recent session (0 days ago) gives high recency score', () => {
    mockCompletion(0)
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      sessions: [makeSession(0)],
    })
    // recency ~100, completion 0, frequency 10 (1 session * 10)
    // score = 100*0.4 + 0*0.3 + 10*0.3 = 40 + 0 + 3 = 43
    expect(result.score).toBeGreaterThan(40)
  })

  it('session 14+ days ago gives zero recency score', () => {
    mockCompletion(0)
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      sessions: [makeSession(14)],
    })
    // recency = 0 (14 days = cutoff), frequency = 10 (within 30d window)
    // score = 0*0.4 + 0*0.3 + 10*0.3 = 3
    expect(result.score).toBeLessThanOrEqual(10)
  })

  it('recent session scores higher than old session', () => {
    mockCompletion(0)
    const recent = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      sessions: [makeSession(1)],
    })
    mockCompletion(0)
    const old = calculateMomentumScore({
      courseId: 'c2',
      totalLessons: 10,
      sessions: [makeSession(10)],
    })
    expect(recent.score).toBeGreaterThan(old.score)
  })
})

describe('calculateMomentumScore — frequency', () => {
  it('10 sessions in 30 days gives max frequency score', () => {
    mockCompletion(0)
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(i))
    const result = calculateMomentumScore({ courseId: 'c1', totalLessons: 10, sessions })
    // frequency = min(100, 10*10) = 100
    // recency = ~100 (session 0 days ago), frequency = 100
    // score = 100*0.4 + 0*0.3 + 100*0.3 = 40+0+30 = 70
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(result.tier).toBe('hot')
  })

  it('sessions older than 30 days do not count toward frequency', () => {
    mockCompletion(0)
    const oldSessions = Array.from({ length: 20 }, (_, i) => makeSession(31 + i))
    const result = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      sessions: oldSessions,
    })
    // All sessions > 30 days old, recency > 14d = 0
    expect(result.score).toBe(0)
  })

  it('more sessions give higher score than fewer sessions', () => {
    mockCompletion(0)
    const many = calculateMomentumScore({
      courseId: 'c1',
      totalLessons: 10,
      sessions: Array.from({ length: 8 }, (_, i) => makeSession(i + 1)),
    })
    mockCompletion(0)
    const few = calculateMomentumScore({
      courseId: 'c2',
      totalLessons: 10,
      sessions: [makeSession(5)],
    })
    expect(many.score).toBeGreaterThan(few.score)
  })
})

describe('calculateMomentumScore — score clamping', () => {
  it('score is never below 0', () => {
    mockCompletion(0)
    const result = calculateMomentumScore({ courseId: 'c1', totalLessons: 10, sessions: [] })
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('score is never above 100', () => {
    mockCompletion(100)
    const sessions = Array.from({ length: 20 }, () => makeSession(0))
    const result = calculateMomentumScore({ courseId: 'c1', totalLessons: 10, sessions })
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
