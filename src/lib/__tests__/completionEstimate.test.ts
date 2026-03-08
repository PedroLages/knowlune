import { describe, it, expect } from 'vitest'
import { calculateCompletionEstimate } from '@/lib/completionEstimate'
import { createStudySession } from '../../../tests/support/fixtures/factories/session-factory'

function makeSession(daysAgo: number, durationSeconds: number, courseId = 'course-1') {
  const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return createStudySession({
    courseId,
    startTime,
    endTime: startTime,
    duration: durationSeconds,
    lastActivity: startTime,
  })
}

// ── AC3: Completion estimate based on remaining content and average pace ──

describe('calculateCompletionEstimate — average pace calculation', () => {
  it('calculates average from recent sessions (30 min each)', () => {
    const sessions = [
      makeSession(5, 1800),  // 30 min, 5 days ago
      makeSession(10, 1800), // 30 min, 10 days ago
    ]
    const result = calculateCompletionEstimate(sessions, 60) // 60 min remaining

    expect(result.averageSessionMinutes).toBe(30)
    expect(result.sessionsNeeded).toBe(2) // 60 / 30 = 2
    expect(result.estimatedDays).toBe(2)
  })

  it('rounds average session minutes to nearest integer', () => {
    const sessions = [
      makeSession(5, 2500),  // 41.67 min
      makeSession(10, 2200), // 36.67 min
    ]
    const result = calculateCompletionEstimate(sessions, 90)

    // Average = (41.67 + 36.67) / 2 = 39.17 → rounds to 39
    expect(result.averageSessionMinutes).toBe(39)
  })

  it('uses only last 30 days of sessions', () => {
    const sessions = [
      makeSession(5, 3600),   // 60 min, within 30 days
      makeSession(10, 3600),  // 60 min, within 30 days
      makeSession(35, 1800),  // 30 min, older than 30 days (excluded)
      makeSession(40, 1800),  // 30 min, older than 30 days (excluded)
    ]
    const result = calculateCompletionEstimate(sessions, 120)

    // Only first 2 sessions counted: avg = 60 min
    expect(result.averageSessionMinutes).toBe(60)
    expect(result.sessionsNeeded).toBe(2) // 120 / 60 = 2
  })

  it('filters sessions exactly at 30-day boundary', () => {
    const sessions = [
      makeSession(30, 3600),  // Exactly 30 days ago (should be included)
      makeSession(31, 3600),  // 31 days ago (excluded)
    ]
    const result = calculateCompletionEstimate(sessions, 60)

    // Only 1 session within threshold
    expect(result.averageSessionMinutes).toBe(60)
    expect(result.sessionsNeeded).toBe(1)
  })
})

describe('calculateCompletionEstimate — sessions needed calculation', () => {
  it('ceils fractional sessions (e.g., 2.5 sessions → 3)', () => {
    const sessions = [makeSession(5, 2400)] // 40 min average
    const result = calculateCompletionEstimate(sessions, 100) // 100 min remaining

    // 100 / 40 = 2.5 → ceil to 3
    expect(result.sessionsNeeded).toBe(3)
  })

  it('handles exact division (no rounding needed)', () => {
    const sessions = [makeSession(5, 1800)] // 30 min
    const result = calculateCompletionEstimate(sessions, 90) // 90 min

    // 90 / 30 = 3 (exact)
    expect(result.sessionsNeeded).toBe(3)
  })

  it('returns 1 session when remaining < average', () => {
    const sessions = [makeSession(5, 3600)] // 60 min average
    const result = calculateCompletionEstimate(sessions, 20) // 20 min remaining

    // 20 / 60 = 0.33 → ceil to 1
    expect(result.sessionsNeeded).toBe(1)
  })
})

// ── AC4: Default 30-minute pace for new users with no sessions ──

describe('calculateCompletionEstimate — default pace fallback', () => {
  it('uses 30-minute default when no sessions exist', () => {
    const result = calculateCompletionEstimate([], 60)

    expect(result.averageSessionMinutes).toBe(30) // Default
    expect(result.sessionsNeeded).toBe(2) // 60 / 30 = 2
    expect(result.estimatedDays).toBe(2)
  })

  it('uses 30-minute default when all sessions are older than 30 days', () => {
    const sessions = [
      makeSession(35, 3600), // All sessions > 30 days old
      makeSession(40, 3600),
    ]
    const result = calculateCompletionEstimate(sessions, 90)

    // No recent sessions → default pace
    expect(result.averageSessionMinutes).toBe(30)
    expect(result.sessionsNeeded).toBe(3) // 90 / 30 = 3
  })

  it('does NOT use default when even 1 recent session exists', () => {
    const sessions = [makeSession(5, 3600)] // Single 60 min session
    const result = calculateCompletionEstimate(sessions, 120)

    // Should use actual average (60 min), not default (30 min)
    expect(result.averageSessionMinutes).toBe(60)
    expect(result.sessionsNeeded).toBe(2) // 120 / 60 = 2
  })
})

describe('calculateCompletionEstimate — edge cases', () => {
  it('handles 0 remaining minutes (course complete)', () => {
    const sessions = [makeSession(5, 1800)]
    const result = calculateCompletionEstimate(sessions, 0)

    expect(result.remainingMinutes).toBe(0)
    expect(result.sessionsNeeded).toBe(0) // 0 / 30 = 0
    expect(result.estimatedDays).toBe(0)
  })

  it('handles very short sessions (< 5 min average)', () => {
    const sessions = [
      makeSession(5, 120),  // 2 min
      makeSession(10, 180), // 3 min
    ]
    const result = calculateCompletionEstimate(sessions, 50)

    // Average = (2 + 3) / 2 = 2.5 → rounds to 3 (or 2?)
    expect(result.averageSessionMinutes).toBeGreaterThan(0)
    expect(result.sessionsNeeded).toBeGreaterThan(0)
  })

  it('handles very long remaining content (>100 sessions)', () => {
    const sessions = [makeSession(5, 1800)] // 30 min average
    const result = calculateCompletionEstimate(sessions, 4000) // 4000 min remaining

    // 4000 / 30 = 133.33 → ceil to 134
    expect(result.sessionsNeeded).toBe(134)
    expect(result.estimatedDays).toBe(134)
  })

  it('handles sessions with duration = 0 (edge case)', () => {
    const sessions = [
      makeSession(5, 0),     // 0 min (invalid but possible)
      makeSession(10, 1800), // 30 min
    ]
    const result = calculateCompletionEstimate(sessions, 60)

    // Average = (0 + 30) / 2 = 15
    expect(result.averageSessionMinutes).toBe(15)
    expect(result.sessionsNeeded).toBe(4) // 60 / 15 = 4
  })

  it('handles all sessions with duration = 0 (fallback to default)', () => {
    const sessions = [
      makeSession(5, 0),
      makeSession(10, 0),
    ]
    const result = calculateCompletionEstimate(sessions, 60)

    // Average = 0, should fallback to default 30 min pace
    expect(result.averageSessionMinutes).toBe(30)
    expect(result.sessionsNeeded).toBe(2) // 60 / 30 = 2
  })

  it('handles negative session durations (data corruption)', () => {
    const sessions = [
      makeSession(5, -1800), // -30 min (corrupted data)
      makeSession(10, 1800), // 30 min
    ]
    const result = calculateCompletionEstimate(sessions, 60)

    // Average = (-30 + 30) / 2 = 0 → should fallback to default
    expect(result.averageSessionMinutes).toBe(30)
    expect(result.sessionsNeeded).toBe(2) // 60 / 30 = 2
  })

  it('handles negative remaining minutes (clamps to 0)', () => {
    const sessions = [makeSession(5, 1800)]
    const result = calculateCompletionEstimate(sessions, -50)

    // Negative remaining should be clamped to 0
    expect(result.remainingMinutes).toBe(0)
    expect(result.sessionsNeeded).toBe(0)
    expect(result.estimatedDays).toBe(0)
  })
})

describe('calculateCompletionEstimate — estimated days assumption', () => {
  it('assumes 1 session per day (estimatedDays = sessionsNeeded)', () => {
    const sessions = [makeSession(5, 1800)] // 30 min
    const result = calculateCompletionEstimate(sessions, 90)

    expect(result.sessionsNeeded).toBe(3)
    expect(result.estimatedDays).toBe(3) // Same as sessionsNeeded
  })
})

describe('calculateCompletionEstimate — return values', () => {
  it('returns all required fields in CompletionEstimate interface', () => {
    const sessions = [makeSession(5, 1800)]
    const result = calculateCompletionEstimate(sessions, 60)

    expect(result).toHaveProperty('sessionsNeeded')
    expect(result).toHaveProperty('estimatedDays')
    expect(result).toHaveProperty('averageSessionMinutes')
    expect(result).toHaveProperty('remainingMinutes')

    expect(result.remainingMinutes).toBe(60) // Echoes input
  })
})

describe('calculateCompletionEstimate — happy path', () => {
  it('correctly estimates completion for typical user (2 sessions, 30 min each)', () => {
    const sessions = [
      makeSession(5, 1800),  // 30 min
      makeSession(10, 1800), // 30 min
    ]
    const result = calculateCompletionEstimate(sessions, 120) // 2 hours remaining

    expect(result.averageSessionMinutes).toBe(30)
    expect(result.sessionsNeeded).toBe(4) // 120 / 30 = 4
    expect(result.estimatedDays).toBe(4)
    expect(result.remainingMinutes).toBe(120)
  })

  it('correctly uses default pace for brand new user', () => {
    const result = calculateCompletionEstimate([], 150) // 2.5 hours, no history

    expect(result.averageSessionMinutes).toBe(30) // Default
    expect(result.sessionsNeeded).toBe(5) // 150 / 30 = 5
    expect(result.estimatedDays).toBe(5)
  })
})
