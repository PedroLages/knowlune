import { describe, it, expect } from 'vitest'
import { calculateAtRiskStatus } from '@/lib/atRisk'
import { createStudySession } from '../../../tests/support/fixtures/factories/session-factory'
import { FIXED_TIMESTAMP } from '../../../tests/utils/test-time'
import type { MomentumScore } from '@/lib/momentum'

function makeSession(daysAgo: number, courseId = 'course-1') {
  const startTime = new Date(FIXED_TIMESTAMP - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return createStudySession({
    courseId,
    startTime,
    endTime: startTime,
    duration: 3600,
    lastActivity: startTime,
  })
}

function makeMomentumScore(score: number): MomentumScore {
  return {
    score,
    tier: score >= 70 ? 'hot' : score >= 30 ? 'warm' : 'cold',
    recencyScore: 0,
    completionScore: 0,
    frequencyScore: 0,
  }
}

// ── AC1: At-risk badge displays when 14+ days inactivity AND momentum < 20 ──

describe('calculateAtRiskStatus — no sessions', () => {
  it('returns isAtRisk false when no sessions (infinite days)', () => {
    const result = calculateAtRiskStatus([], makeMomentumScore(5), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(true) // Infinity >= 14 and score < 20
    expect(result.daysSinceLastSession).toBe(Infinity)
  })

  it('returns isAtRisk false when no sessions but momentum high', () => {
    const result = calculateAtRiskStatus([], makeMomentumScore(50), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(false) // score >= 20
    expect(result.daysSinceLastSession).toBe(Infinity)
  })
})

describe('calculateAtRiskStatus — boundary: 14 days', () => {
  it('returns isAtRisk true when exactly 14 days ago AND momentum < 20', () => {
    const sessions = [makeSession(14)]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(10), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(true)
    expect(result.daysSinceLastSession).toBe(14)
    expect(result.momentumScore).toBe(10)
  })

  it('returns isAtRisk false when exactly 13 days ago (just below threshold)', () => {
    const sessions = [makeSession(13)]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(10), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(false) // 13 < 14
  })

  it('returns isAtRisk true when 15 days ago (just above threshold)', () => {
    const sessions = [makeSession(15)]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(10), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(true) // 15 >= 14
  })
})

describe('calculateAtRiskStatus — boundary: momentum score 20', () => {
  it('returns isAtRisk false when momentum exactly 20 (threshold)', () => {
    const sessions = [makeSession(15)]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(20), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(false) // score not < 20
    expect(result.daysSinceLastSession).toBe(15)
  })

  it('returns isAtRisk true when momentum 19 (just below threshold)', () => {
    const sessions = [makeSession(15)]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(19), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(true) // 19 < 20
  })

  it('returns isAtRisk false when momentum 21 (just above threshold)', () => {
    const sessions = [makeSession(15)]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(21), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(false) // 21 not < 20
  })
})

describe('calculateAtRiskStatus — combined conditions', () => {
  it('requires BOTH conditions: 14+ days AND momentum < 20', () => {
    // Only 14+ days, momentum high → not at risk
    expect(calculateAtRiskStatus([makeSession(20)], makeMomentumScore(50), FIXED_TIMESTAMP).isAtRisk).toBe(false)

    // Only momentum < 20, recent session → not at risk
    expect(calculateAtRiskStatus([makeSession(5)], makeMomentumScore(10), FIXED_TIMESTAMP).isAtRisk).toBe(false)

    // Both conditions met → at risk
    expect(calculateAtRiskStatus([makeSession(20)], makeMomentumScore(10), FIXED_TIMESTAMP).isAtRisk).toBe(true)
  })
})

// ── AC2: Badge removes when momentum score increases to 20+ ──

describe('calculateAtRiskStatus — momentum changes', () => {
  it('transitions from at-risk to not-at-risk when momentum increases to 20+', () => {
    const sessions = [makeSession(15)]

    // Initially at risk (momentum < 20)
    const before = calculateAtRiskStatus(sessions, makeMomentumScore(19), FIXED_TIMESTAMP)
    expect(before.isAtRisk).toBe(true)

    // After momentum boost (momentum >= 20)
    const after = calculateAtRiskStatus(sessions, makeMomentumScore(20), FIXED_TIMESTAMP)
    expect(after.isAtRisk).toBe(false)
  })

  it('partial momentum increase (19 → 19.5) keeps at-risk status', () => {
    const sessions = [makeSession(15)]

    const before = calculateAtRiskStatus(sessions, makeMomentumScore(19), FIXED_TIMESTAMP)
    expect(before.isAtRisk).toBe(true)

    // Still below 20
    const after = calculateAtRiskStatus(sessions, makeMomentumScore(19.5), FIXED_TIMESTAMP)
    expect(after.isAtRisk).toBe(true)
  })
})

describe('calculateAtRiskStatus — most recent session selection', () => {
  it('uses most recent session when multiple sessions exist', () => {
    const sessions = [
      makeSession(20), // 20 days ago
      makeSession(5),  // 5 days ago (most recent)
      makeSession(10), // 10 days ago
    ]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(10), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(false) // 5 days < 14
    expect(result.daysSinceLastSession).toBe(5)
  })

  it('identifies at-risk even when multiple old sessions exist', () => {
    const sessions = [
      makeSession(20),
      makeSession(25),
      makeSession(30), // All old
    ]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(10), FIXED_TIMESTAMP)
    expect(result.isAtRisk).toBe(true)
    expect(result.daysSinceLastSession).toBe(20) // Most recent of the old sessions
  })
})

describe('calculateAtRiskStatus — edge cases', () => {
  it('handles sessions with same timestamp', () => {
    const now = new Date(FIXED_TIMESTAMP).toISOString()
    const sessions = [
      createStudySession({ startTime: now, duration: 1800 }),
      createStudySession({ startTime: now, duration: 1800 }),
    ]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(10), FIXED_TIMESTAMP)
    expect(result.daysSinceLastSession).toBe(0)
    expect(result.isAtRisk).toBe(false) // 0 < 14
  })

  it('floors fractional days (e.g., 14.8 days → 14)', () => {
    // Create session 14.8 days ago (should floor to 14)
    const daysAgo = 14.8
    const startTime = new Date(FIXED_TIMESTAMP - daysAgo * 24 * 60 * 60 * 1000).toISOString()
    const session = createStudySession({ startTime, duration: 3600 })

    const result = calculateAtRiskStatus([session], makeMomentumScore(10), FIXED_TIMESTAMP)
    expect(result.daysSinceLastSession).toBe(14) // Floored
    expect(result.isAtRisk).toBe(true) // 14.8 >= 14
  })

  it('handles sessions with future timestamps (clock skew)', () => {
    // Session 1 day in the future (negative daysSinceLastSession)
    const futureTime = new Date(FIXED_TIMESTAMP + 24 * 60 * 60 * 1000).toISOString()
    const session = createStudySession({ startTime: futureTime, duration: 1800 })

    const result = calculateAtRiskStatus([session], makeMomentumScore(10), FIXED_TIMESTAMP)
    expect(result.daysSinceLastSession).toBe(-1) // Floored negative value
    expect(result.isAtRisk).toBe(false) // -1 < 14
  })

  it('returns score from momentum parameter in result', () => {
    const result = calculateAtRiskStatus([makeSession(20)], makeMomentumScore(42), FIXED_TIMESTAMP)
    expect(result.momentumScore).toBe(42)
  })
})

describe('calculateAtRiskStatus — happy path', () => {
  it('correctly identifies at-risk course (15 days, momentum 10)', () => {
    const sessions = [makeSession(15)]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(10), FIXED_TIMESTAMP)

    expect(result.isAtRisk).toBe(true)
    expect(result.daysSinceLastSession).toBe(15)
    expect(result.momentumScore).toBe(10)
  })

  it('correctly identifies not-at-risk course (5 days, momentum 50)', () => {
    const sessions = [makeSession(5)]
    const result = calculateAtRiskStatus(sessions, makeMomentumScore(50), FIXED_TIMESTAMP)

    expect(result.isAtRisk).toBe(false)
    expect(result.daysSinceLastSession).toBe(5)
    expect(result.momentumScore).toBe(50)
  })
})
