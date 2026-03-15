import { describe, it, expect } from 'vitest'
import {
  calcActiveTimeScore,
  calcInteractionDensityScore,
  calcSessionLengthScore,
  calcBreaksScore,
  calculateQualityScore,
  getQualityTier,
  calculateQualityTrend,
} from '@/lib/qualityScore'
import { createStudySession } from '../../../tests/support/fixtures/factories/session-factory'

// ── calcActiveTimeScore ─────────────────────────────────────────

describe('calcActiveTimeScore', () => {
  it('returns 0 for zero total time', () => {
    expect(calcActiveTimeScore(0, 0)).toBe(0)
  })

  it('returns 100 for all-active session', () => {
    expect(calcActiveTimeScore(3600, 0)).toBe(100)
  })

  it('returns 50 for half active, half idle', () => {
    expect(calcActiveTimeScore(1800, 1800)).toBe(50)
  })

  it('returns low score for mostly idle session', () => {
    expect(calcActiveTimeScore(300, 3300)).toBeLessThan(10)
  })

  it('handles high idle time gracefully', () => {
    const score = calcActiveTimeScore(60, 7200)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ── calcInteractionDensityScore ─────────────────────────────────

describe('calcInteractionDensityScore', () => {
  it('returns 0 for no interactions', () => {
    expect(calcInteractionDensityScore(0, 3600)).toBe(0)
  })

  it('returns 0 for zero duration', () => {
    expect(calcInteractionDensityScore(10, 0)).toBe(0)
  })

  it('returns 100 for 5 interactions per minute', () => {
    // 5 interactions/min for 60 min = 300 interactions
    expect(calcInteractionDensityScore(300, 3600)).toBe(100)
  })

  it('caps at 100 for very high interaction rate', () => {
    expect(calcInteractionDensityScore(1000, 600)).toBe(100)
  })

  it('returns proportional score for moderate interactions', () => {
    // 2.5 interactions/min = ~50
    const score = calcInteractionDensityScore(150, 3600)
    expect(score).toBe(50)
  })
})

// ── calcSessionLengthScore ──────────────────────────────────────

describe('calcSessionLengthScore', () => {
  it('returns 0 for zero duration', () => {
    expect(calcSessionLengthScore(0)).toBe(0)
  })

  it('returns low score for very short sessions (<5min)', () => {
    expect(calcSessionLengthScore(120)).toBeLessThan(30) // 2 min
  })

  it('returns 100 for 30-60 minute sessions (sweet spot)', () => {
    expect(calcSessionLengthScore(1800)).toBe(100) // 30 min
    expect(calcSessionLengthScore(2700)).toBe(100) // 45 min
    expect(calcSessionLengthScore(3600)).toBe(100) // 60 min
  })

  it('returns moderate score for sessions between 5-30 minutes', () => {
    const score = calcSessionLengthScore(900) // 15 min
    expect(score).toBeGreaterThan(50)
    expect(score).toBeLessThan(100)
  })

  it('reduces score for sessions over 60 minutes', () => {
    const score90min = calcSessionLengthScore(5400)
    expect(score90min).toBeLessThan(100)
    expect(score90min).toBeGreaterThanOrEqual(70)
  })

  it('floors at 40 for very long sessions', () => {
    const score = calcSessionLengthScore(14400) // 4 hours
    expect(score).toBeGreaterThanOrEqual(40)
  })
})

// ── calcBreaksScore ─────────────────────────────────────────────

describe('calcBreaksScore', () => {
  it('returns 0 for zero duration', () => {
    expect(calcBreaksScore(0, 0)).toBe(0)
  })

  it('returns 100 for short session with no breaks', () => {
    expect(calcBreaksScore(0, 600)).toBe(100) // 10 min, no breaks
  })

  it('returns 100 for optimal breaks in long session', () => {
    expect(calcBreaksScore(2, 3600)).toBe(100) // 60 min, 2 breaks
  })

  it('penalizes long sessions with no breaks', () => {
    const score = calcBreaksScore(0, 3600) // 60 min, 0 breaks
    expect(score).toBeLessThan(80)
  })

  it('penalizes excessive breaks', () => {
    const score = calcBreaksScore(6, 3600) // 60 min, 6 breaks
    expect(score).toBeLessThan(60)
  })

  it('returns good score for 1 break in medium session', () => {
    expect(calcBreaksScore(1, 1800)).toBe(100) // 30 min, 1 break
  })
})

// ── getQualityTier ──────────────────────────────────────────────

describe('getQualityTier', () => {
  it('returns excellent for scores >= 85', () => {
    expect(getQualityTier(85)).toBe('excellent')
    expect(getQualityTier(100)).toBe('excellent')
  })

  it('returns good for scores 70-84', () => {
    expect(getQualityTier(70)).toBe('good')
    expect(getQualityTier(84)).toBe('good')
  })

  it('returns fair for scores 50-69', () => {
    expect(getQualityTier(50)).toBe('fair')
    expect(getQualityTier(69)).toBe('fair')
  })

  it('returns needs-improvement for scores < 50', () => {
    expect(getQualityTier(0)).toBe('needs-improvement')
    expect(getQualityTier(49)).toBe('needs-improvement')
  })
})

// ── calculateQualityScore ───────────────────────────────────────

describe('calculateQualityScore', () => {
  it('calculates composite score for a high-engagement session', () => {
    const session = createStudySession({
      duration: 2700, // 45 min active
      idleTime: 300, // 5 min idle
      interactionCount: 200, // ~4.4/min
      breakCount: 1,
    })

    const result = calculateQualityScore(session)
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(['excellent', 'good']).toContain(result.tier)
    expect(result.factors.activeTimeScore).toBeGreaterThan(80)
    expect(result.factors.interactionDensityScore).toBeGreaterThan(80)
  })

  it('calculates low score for minimal engagement session', () => {
    const session = createStudySession({
      duration: 120, // 2 min
      idleTime: 600, // 10 min idle
      interactionCount: 1,
      breakCount: 0,
    })

    const result = calculateQualityScore(session)
    expect(result.score).toBeLessThanOrEqual(40)
    expect(result.tier).toBe('needs-improvement')
  })

  it('handles session with no interaction data (legacy)', () => {
    const session = createStudySession({
      duration: 1800,
      idleTime: 200,
    })
    // interactionCount and breakCount are undefined

    const result = calculateQualityScore(session)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.factors.interactionDensityScore).toBe(0)
  })

  it('returns score between 0-100', () => {
    const session = createStudySession({
      duration: 3600,
      idleTime: 0,
      interactionCount: 500,
      breakCount: 2,
    })

    const result = calculateQualityScore(session)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

// ── calculateQualityTrend ───────────────────────────────────────

describe('calculateQualityTrend', () => {
  it('returns stable for insufficient data', () => {
    expect(calculateQualityTrend([])).toBe('stable')
    expect(calculateQualityTrend([80])).toBe('stable')
    expect(calculateQualityTrend([80, 75, 70])).toBe('stable')
  })

  it('returns improving when recent scores are higher', () => {
    // Recent first: [90, 85, 80, 60, 55, 50]
    expect(calculateQualityTrend([90, 85, 80, 60, 55, 50])).toBe('improving')
  })

  it('returns declining when recent scores are lower', () => {
    // Recent first: [50, 55, 60, 80, 85, 90]
    expect(calculateQualityTrend([50, 55, 60, 80, 85, 90])).toBe('declining')
  })

  it('returns stable when scores are within 5 points', () => {
    expect(calculateQualityTrend([75, 74, 73, 72, 71, 70])).toBe('stable')
  })

  it('handles exactly 4 scores', () => {
    const trend = calculateQualityTrend([90, 85, 40, 35])
    expect(trend).toBe('improving')
  })
})
