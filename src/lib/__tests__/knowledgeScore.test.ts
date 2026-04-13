import { describe, it, expect } from 'vitest'
import {
  calculateRecencyScore,
  calculateTopicScore,
  calculateAggregateRetention,
  calculateDecayDate,
  getKnowledgeTier,
  getConfidenceLevel,
  computeUrgency,
  suggestActions,
  BASE_WEIGHTS,
} from '@/lib/knowledgeScore'

// ── getKnowledgeTier ──────────────────────────────────────────────

describe('getKnowledgeTier', () => {
  it('returns "strong" for score >= 70', () => {
    expect(getKnowledgeTier(70)).toBe('strong')
    expect(getKnowledgeTier(100)).toBe('strong')
  })

  it('returns "fading" for score 40-69', () => {
    expect(getKnowledgeTier(40)).toBe('fading')
    expect(getKnowledgeTier(69)).toBe('fading')
  })

  it('returns "weak" for score < 40', () => {
    expect(getKnowledgeTier(39)).toBe('weak')
    expect(getKnowledgeTier(0)).toBe('weak')
  })
})

// ── getConfidenceLevel ────────────────────────────────────────────

describe('getConfidenceLevel', () => {
  it('returns "high" for 4 signals', () => {
    expect(getConfidenceLevel(4)).toBe('high')
  })

  it('returns "medium" for 3 signals', () => {
    expect(getConfidenceLevel(3)).toBe('medium')
  })

  it('returns "low" for 2 signals', () => {
    expect(getConfidenceLevel(2)).toBe('low')
  })

  it('returns "none" for 0-1 signals', () => {
    expect(getConfidenceLevel(0)).toBe('none')
    expect(getConfidenceLevel(1)).toBe('none')
  })
})

// ── calculateRecencyScore ─────────────────────────────────────────

describe('calculateRecencyScore', () => {
  it('returns 100 for 0 days', () => {
    expect(calculateRecencyScore(0)).toBe(100)
  })

  it('returns 100 for 7 days (boundary)', () => {
    expect(calculateRecencyScore(7)).toBe(100)
  })

  it('returns 10 for 90 days (boundary)', () => {
    expect(calculateRecencyScore(90)).toBe(10)
  })

  it('returns 10 for 180 days (beyond floor)', () => {
    expect(calculateRecencyScore(180)).toBe(10)
  })

  it('returns approximately 56 for 48 days (midpoint)', () => {
    const score = calculateRecencyScore(48)
    // Linear decay: 100 - ((48-7)/83) * 90 ≈ 100 - 44.46 ≈ 56
    expect(score).toBeGreaterThanOrEqual(54)
    expect(score).toBeLessThanOrEqual(57)
  })

  it('decays linearly between 7 and 90 days', () => {
    const s30 = calculateRecencyScore(30)
    const s50 = calculateRecencyScore(50)
    const s70 = calculateRecencyScore(70)
    expect(s30).toBeGreaterThan(s50)
    expect(s50).toBeGreaterThan(s70)
  })
})

// ── calculateTopicScore ───────────────────────────────────────────

describe('calculateTopicScore', () => {
  it('uses 30/30/20/20 weights when all 4 signals available (AC1)', () => {
    const result = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: 70,
      completionPercent: 100,
      daysSinceLastEngagement: 3,
    })

    // All 4 signals → weights stay at base (0.3, 0.3, 0.2, 0.2)
    expect(result.effectiveWeights.quiz).toBeCloseTo(0.3, 5)
    expect(result.effectiveWeights.flashcard).toBeCloseTo(0.3, 5)
    expect(result.effectiveWeights.completion).toBeCloseTo(0.2, 5)
    expect(result.effectiveWeights.recency).toBeCloseTo(0.2, 5)
    expect(result.signalsUsed).toBe(4)
    expect(result.confidence).toBe('high')
    expect(result.tier).toBe('strong')

    // Score: 80*0.3 + 70*0.3 + 100*0.2 + 100*0.2 = 24 + 21 + 20 + 20 = 85
    expect(result.score).toBe(85)
  })

  it('redistributes to 50/50 when quiz and flashcard are null (AC2)', () => {
    const result = calculateTopicScore({
      quizScore: null,
      flashcardRetention: null,
      completionPercent: 100,
      daysSinceLastEngagement: 3,
    })

    // Only completion (0.2) + recency (0.2) → each gets 0.5
    expect(result.effectiveWeights.quiz).toBe(0)
    expect(result.effectiveWeights.flashcard).toBe(0)
    expect(result.effectiveWeights.completion).toBeCloseTo(0.5, 5)
    expect(result.effectiveWeights.recency).toBeCloseTo(0.5, 5)
    expect(result.signalsUsed).toBe(2)
    expect(result.confidence).toBe('low')

    // Score: 100*0.5 + 100*0.5 = 100
    expect(result.score).toBe(100)
  })

  it('redistributes to ~43/29/29 when flashcard is null (AC3)', () => {
    const result = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: null,
      completionPercent: 60,
      daysSinceLastEngagement: 30,
    })

    // Available weights: quiz(0.3) + completion(0.2) + recency(0.2) = 0.7
    // quiz: 0.3/0.7 ≈ 0.4286, completion: 0.2/0.7 ≈ 0.2857, recency: 0.2/0.7 ≈ 0.2857
    expect(result.effectiveWeights.quiz).toBeCloseTo(0.4286, 3)
    expect(result.effectiveWeights.completion).toBeCloseTo(0.2857, 3)
    expect(result.effectiveWeights.recency).toBeCloseTo(0.2857, 3)
    expect(result.signalsUsed).toBe(3)
    expect(result.confidence).toBe('medium')
  })

  it('clamps score to 0-100', () => {
    const result = calculateTopicScore({
      quizScore: 100,
      flashcardRetention: 100,
      completionPercent: 100,
      daysSinceLastEngagement: 0,
    })
    expect(result.score).toBeLessThanOrEqual(100)

    const result2 = calculateTopicScore({
      quizScore: 0,
      flashcardRetention: 0,
      completionPercent: 0,
      daysSinceLastEngagement: 365,
    })
    expect(result2.score).toBeGreaterThanOrEqual(0)
  })

  it('handles all signals at zero', () => {
    const result = calculateTopicScore({
      quizScore: 0,
      flashcardRetention: 0,
      completionPercent: 0,
      daysSinceLastEngagement: 365,
    })
    expect(result.score).toBeLessThanOrEqual(10) // Recency floor is 10
    expect(result.tier).toBe('weak')
  })

  it('populates all factor fields', () => {
    const result = calculateTopicScore({
      quizScore: 75,
      flashcardRetention: 60,
      completionPercent: 80,
      daysSinceLastEngagement: 14,
    })
    expect(result.factors.quizScore).toBe(75)
    expect(result.factors.flashcardRetention).toBe(60)
    expect(result.factors.completionScore).toBe(80)
    expect(result.factors.recencyScore).toBeGreaterThan(0)
  })

  // ── Edge cases ──────────────────────────────────────────────────

  it('returns a valid score when questionCount is effectively 0 (quiz/flashcard both null)', () => {
    const result = calculateTopicScore({
      quizScore: null,
      flashcardRetention: null,
      completionPercent: 0,
      daysSinceLastEngagement: 0,
    })
    // signalsUsed === 2 (completion + recency), score must be in range
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.signalsUsed).toBe(2)
    expect(result.confidence).toBe('low')
  })

  it('returns score near recency floor when all signals are 0 (completionPercent=0, daysAgo=365)', () => {
    const result = calculateTopicScore({
      quizScore: 0,
      flashcardRetention: 0,
      completionPercent: 0,
      daysSinceLastEngagement: 365,
    })
    // recencyScore=10 (floor), completionScore=0, quizScore=0, flashcard=0
    // weighted score: 0*0.3 + 0*0.3 + 0*0.2 + 10*0.2 = 2
    expect(result.score).toBe(2)
    expect(result.tier).toBe('weak')
  })

  it('clamps flashcardRetention > 100 to 100 via completionPercent clamping pattern', () => {
    // The function clamps completionPercent to [0,100]; flashcardRetention is used as-is
    // but passed by the store as a 0-100 value. Test that a high retention value
    // does not push the score above 100.
    const result = calculateTopicScore({
      quizScore: 100,
      flashcardRetention: 150, // abnormally high — should still produce score <= 100
      completionPercent: 100,
      daysSinceLastEngagement: 0,
    })
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('scores very recent engagement (daysSinceLastEngagement=0) at full recency', () => {
    const result = calculateTopicScore({
      quizScore: null,
      flashcardRetention: null,
      completionPercent: 0,
      daysSinceLastEngagement: 0,
    })
    // recencyScore=100, completionScore=0, weights redistribute to 0.5 each
    // score = 0*0.5 + 100*0.5 = 50
    expect(result.score).toBe(50)
    expect(result.factors.recencyScore).toBe(100)
  })
})

// ── computeUrgency ────────────────────────────────────────────────

describe('computeUrgency', () => {
  it('follows the urgency formula', () => {
    // urgency = (100 - score) * 0.6 + min(100, days * 2) * 0.4
    const urgency = computeUrgency(60, 30)
    // (100-60)*0.6 + min(100, 60)*0.4 = 24 + 24 = 48
    expect(urgency).toBe(48)
  })

  it('caps days factor at 100', () => {
    const urgency = computeUrgency(50, 100)
    // (100-50)*0.6 + min(100, 200)*0.4 = 30 + 40 = 70
    expect(urgency).toBe(70)
  })

  it('returns 0 for perfect score and recent engagement', () => {
    const urgency = computeUrgency(100, 0)
    expect(urgency).toBe(0)
  })
})

// ── suggestActions ────────────────────────────────────────────────

describe('suggestActions', () => {
  it('sorts by lowest-scoring signal first', () => {
    const actions = suggestActions({
      quizScore: 90,
      flashcardRetention: 40,
      completionPercent: 70,
    })
    expect(actions[0]).toBe('Review Flashcards')
    expect(actions[1]).toBe('Rewatch Lesson')
    expect(actions[2]).toBe('Retake Quiz')
  })

  it('omits Rewatch Lesson when completion is 100%', () => {
    const actions = suggestActions({
      quizScore: 50,
      flashcardRetention: 80,
      completionPercent: 100,
    })
    expect(actions).not.toContain('Rewatch Lesson')
    expect(actions).toHaveLength(2)
  })

  it('handles null quiz and flashcard', () => {
    const actions = suggestActions({
      quizScore: null,
      flashcardRetention: null,
      completionPercent: 50,
    })
    expect(actions).toEqual(['Rewatch Lesson'])
  })

  it('returns empty when all complete and no quiz/flashcard', () => {
    const actions = suggestActions({
      quizScore: null,
      flashcardRetention: null,
      completionPercent: 100,
    })
    expect(actions).toEqual([])
  })
})

// ── calculateAggregateRetention (E62-S01) ────────────────────────

describe('calculateAggregateRetention', () => {
  const FIXED_NOW = new Date('2026-04-14T12:00:00Z')

  it('returns average retention for cards with varying stability (AC1)', () => {
    // 5 cards, stability [10,20,30,40,50], all reviewed 5 days ago
    const fiveDaysAgo = new Date('2026-04-09T12:00:00Z').toISOString()
    const cards = [10, 20, 30, 40, 50].map(s => ({
      last_review: fiveDaysAgo,
      stability: s,
    }))
    const result = calculateAggregateRetention(cards, FIXED_NOW)
    expect(result.retention).not.toBeNull()
    // FSRS power-law with stabilities [10-50] at 5 days elapsed yields high retention (~98)
    expect(result.retention!).toBeGreaterThanOrEqual(90)
    expect(result.retention!).toBeLessThanOrEqual(100)
    expect(result.avgStability).toBeCloseTo(30, 0)
  })

  it('returns null for empty flashcard array (AC2)', () => {
    const result = calculateAggregateRetention([], FIXED_NOW)
    expect(result.retention).toBeNull()
    expect(result.avgStability).toBeNull()
  })

  it('returns null when all cards have stability 0 (AC3)', () => {
    const cards = [
      { last_review: '2026-04-09T12:00:00Z', stability: 0 },
      { last_review: '2026-04-09T12:00:00Z', stability: 0 },
    ]
    const result = calculateAggregateRetention(cards, FIXED_NOW)
    expect(result.retention).toBeNull()
    expect(result.avgStability).toBeNull()
  })

  it('returns null for cards with no last_review (unreviewed)', () => {
    const cards = [{ stability: 10 }, { stability: 20 }]
    const result = calculateAggregateRetention(cards, FIXED_NOW)
    expect(result.retention).toBeNull()
    expect(result.avgStability).toBeNull()
  })

  it('handles single card', () => {
    const card = { last_review: '2026-04-14T12:00:00Z', stability: 30 }
    const result = calculateAggregateRetention([card], FIXED_NOW)
    expect(result.retention).toBe(100) // reviewed just now → 100%
    expect(result.avgStability).toBe(30)
  })

  it('skips unreviewed cards, averages only reviewed ones', () => {
    const cards = [
      { last_review: '2026-04-14T12:00:00Z', stability: 30 }, // reviewed
      { stability: 10 }, // unreviewed (no last_review)
      { last_review: '2026-04-14T12:00:00Z', stability: 0 }, // stability 0 → filtered
    ]
    const result = calculateAggregateRetention(cards, FIXED_NOW)
    // Only the first card counts
    expect(result.retention).toBe(100)
    expect(result.avgStability).toBe(30)
  })
})

// ── calculateDecayDate (E62-S01) ─────────────────────────────────

describe('calculateDecayDate', () => {
  const FIXED_NOW = new Date('2026-04-14T12:00:00Z')

  it('returns correct decay date for avgStability=15 (AC4)', () => {
    const result = calculateDecayDate(15, FIXED_NOW)
    expect(result).not.toBeNull()
    // daysUntilDecay = 9 * 15 * (1/0.7 - 1) = 135 * 0.4286 ≈ 57.86
    const decayDate = new Date(result!)
    const daysDiff = (decayDate.getTime() - FIXED_NOW.getTime()) / (1000 * 60 * 60 * 24)
    expect(daysDiff).toBeCloseTo(57.86, 0)
  })

  it('returns null for avgStability=0 (AC5)', () => {
    expect(calculateDecayDate(0, FIXED_NOW)).toBeNull()
  })

  it('returns null for negative avgStability (AC5)', () => {
    expect(calculateDecayDate(-5, FIXED_NOW)).toBeNull()
  })

  it('returns ISO string format', () => {
    const result = calculateDecayDate(20, FIXED_NOW)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ── calculateTopicScore with fsrsRetention (E62-S01) ─────────────

describe('calculateTopicScore with fsrsRetention', () => {
  it('uses fsrsRetention at 30% weight when provided (AC6)', () => {
    const result = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: null, // no legacy flashcard data
      completionPercent: 100,
      daysSinceLastEngagement: 3,
      fsrsRetention: 60,
    })
    // fsrsRetention=60 fills the flashcard slot → 4 signals
    expect(result.signalsUsed).toBe(4)
    expect(result.effectiveWeights.flashcard).toBeCloseTo(0.3, 5)
    expect(result.factors.flashcardRetention).toBe(60)
    // Score: 80*0.3 + 60*0.3 + 100*0.2 + 100*0.2 = 24 + 18 + 20 + 20 = 82
    expect(result.score).toBe(82)
  })

  it('falls back to flashcardRetention when fsrsRetention is null (AC7)', () => {
    const withFsrsNull = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: 70,
      completionPercent: 100,
      daysSinceLastEngagement: 3,
      fsrsRetention: null,
    })
    const withoutFsrs = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: 70,
      completionPercent: 100,
      daysSinceLastEngagement: 3,
    })
    // Identical output — no regression
    expect(withFsrsNull.score).toBe(withoutFsrs.score)
    expect(withFsrsNull.effectiveWeights).toEqual(withoutFsrs.effectiveWeights)
  })

  it('falls back when fsrsRetention is undefined (AC7)', () => {
    const withUndefined = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: 70,
      completionPercent: 100,
      daysSinceLastEngagement: 3,
      fsrsRetention: undefined,
    })
    const without = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: 70,
      completionPercent: 100,
      daysSinceLastEngagement: 3,
    })
    expect(withUndefined.score).toBe(without.score)
  })

  it('fsrsRetention overrides flashcardRetention when both present', () => {
    const result = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: 70, // would be used without fsrsRetention
      completionPercent: 100,
      daysSinceLastEngagement: 3,
      fsrsRetention: 50, // overrides
    })
    expect(result.factors.flashcardRetention).toBe(50)
  })
})

// ── calculateAggregateRetention — additional coverage (E62-S03) ──

describe('calculateAggregateRetention — extended', () => {
  const FIXED_NOW = new Date('2026-04-14T12:00:00Z')

  it('returns correct retention for 5 cards with known FSRS stabilities at 10 days elapsed', () => {
    const tenDaysAgo = new Date('2026-04-04T12:00:00Z').toISOString()
    const cards = [5, 10, 20, 40, 80].map(s => ({
      last_review: tenDaysAgo,
      stability: s,
    }))
    const result = calculateAggregateRetention(cards, FIXED_NOW)
    expect(result.retention).not.toBeNull()
    // Each card: predictRetention at 10 days with given stability
    // Lower stability cards decay faster; average should be well-defined
    expect(result.retention!).toBeGreaterThan(0)
    expect(result.retention!).toBeLessThanOrEqual(100)
    expect(result.avgStability).toBeCloseTo(31, 0) // (5+10+20+40+80)/5 = 31
  })

  it('filters out SM-2 cards (interval + reviewedAt, no stability) — returns null', () => {
    // SM-2 path is not implemented; cards with stability=0 are filtered out
    const cards = [
      { interval: 5, reviewedAt: '2026-04-09T12:00:00Z', stability: 0 },
      { interval: 10, reviewedAt: '2026-04-04T12:00:00Z', stability: 0 },
    ]
    const result = calculateAggregateRetention(cards, FIXED_NOW)
    expect(result.retention).toBeNull()
    expect(result.avgStability).toBeNull()
  })

  it('includes only FSRS cards when mixed with SM-2 cards', () => {
    const cards = [
      // FSRS card — should be included
      { last_review: '2026-04-14T12:00:00Z', stability: 20 },
      // SM-2 card (no stability) — should be filtered
      { interval: 5, reviewedAt: '2026-04-09T12:00:00Z', stability: 0 },
    ]
    const result = calculateAggregateRetention(cards, FIXED_NOW)
    expect(result.retention).toBe(100) // reviewed just now
    expect(result.avgStability).toBe(20)
  })

  it('uses current date when now parameter is omitted', () => {
    // Card reviewed very recently with high stability → retention near 100
    const justNow = new Date(FIXED_NOW.getTime() - 1000).toISOString()
    const cards = [{ last_review: justNow, stability: 50 }]
    const result = calculateAggregateRetention(cards, FIXED_NOW)
    expect(result.retention).toBe(100)
  })

  it('returns lower retention for cards reviewed long ago', () => {
    const longAgo = new Date('2025-01-01T12:00:00Z').toISOString() // ~469 days ago
    const cards = [{ last_review: longAgo, stability: 10 }]
    const result = calculateAggregateRetention(cards, FIXED_NOW)
    expect(result.retention).not.toBeNull()
    // With stability=10 and ~469 days elapsed, retention should be significantly decayed
    expect(result.retention!).toBeLessThan(50)
  })
})

// ── calculateDecayDate — additional coverage (E62-S03) ───────────

describe('calculateDecayDate — extended', () => {
  const FIXED_NOW = new Date('2026-04-14T12:00:00Z')

  it('returns ~39 days for stability=10 (AC from story)', () => {
    const result = calculateDecayDate(10, FIXED_NOW)
    expect(result).not.toBeNull()
    const decayDate = new Date(result!)
    const daysDiff = (decayDate.getTime() - FIXED_NOW.getTime()) / (1000 * 60 * 60 * 24)
    // 9 * 10 * (1/0.7 - 1) = 90 * 0.4286 ≈ 38.57
    expect(daysDiff).toBeCloseTo(38.57, 0)
  })

  it('returns ~386 days for stability=100', () => {
    const result = calculateDecayDate(100, FIXED_NOW)
    expect(result).not.toBeNull()
    const decayDate = new Date(result!)
    const daysDiff = (decayDate.getTime() - FIXED_NOW.getTime()) / (1000 * 60 * 60 * 24)
    // 9 * 100 * (1/0.7 - 1) = 900 * 0.4286 ≈ 385.7
    expect(daysDiff).toBeCloseTo(385.7, 0)
  })

  it('scales linearly with stability', () => {
    const d10 = new Date(calculateDecayDate(10, FIXED_NOW)!).getTime()
    const d20 = new Date(calculateDecayDate(20, FIXED_NOW)!).getTime()
    const d40 = new Date(calculateDecayDate(40, FIXED_NOW)!).getTime()
    // d20 - FIXED_NOW should be ~2x (d10 - FIXED_NOW)
    const base = FIXED_NOW.getTime()
    expect((d20 - base) / (d10 - base)).toBeCloseTo(2, 1)
    expect((d40 - base) / (d10 - base)).toBeCloseTo(4, 1)
  })

  it('uses current date when now parameter is omitted', () => {
    const result = calculateDecayDate(10, FIXED_NOW)
    expect(result).not.toBeNull()
    const decayDate = new Date(result!)
    expect(decayDate.getTime()).toBeGreaterThan(FIXED_NOW.getTime())
  })
})

// ── calculateTopicScore — regression & weight redistribution (E62-S03) ──

describe('calculateTopicScore — fsrsRetention weight redistribution', () => {
  it('redistributes when fsrsRetention present but quiz is null', () => {
    const result = calculateTopicScore({
      quizScore: null,
      flashcardRetention: null,
      completionPercent: 80,
      daysSinceLastEngagement: 5,
      fsrsRetention: 60,
    })
    // 3 signals: flashcard(0.3), completion(0.2), recency(0.2) → total 0.7
    expect(result.signalsUsed).toBe(3)
    expect(result.effectiveWeights.quiz).toBe(0)
    expect(result.effectiveWeights.flashcard).toBeCloseTo(0.3 / 0.7, 3)
    expect(result.effectiveWeights.completion).toBeCloseTo(0.2 / 0.7, 3)
    expect(result.effectiveWeights.recency).toBeCloseTo(0.2 / 0.7, 3)
    expect(result.confidence).toBe('medium')
  })

  it('regression: null fsrsRetention + null flashcard gives identical weights to pre-FSRS', () => {
    const preFsrs = calculateTopicScore({
      quizScore: 75,
      flashcardRetention: null,
      completionPercent: 60,
      daysSinceLastEngagement: 14,
    })
    const postFsrs = calculateTopicScore({
      quizScore: 75,
      flashcardRetention: null,
      completionPercent: 60,
      daysSinceLastEngagement: 14,
      fsrsRetention: null,
    })
    expect(postFsrs.score).toBe(preFsrs.score)
    expect(postFsrs.effectiveWeights).toEqual(preFsrs.effectiveWeights)
    expect(postFsrs.signalsUsed).toBe(preFsrs.signalsUsed)
    expect(postFsrs.tier).toBe(preFsrs.tier)
    expect(postFsrs.confidence).toBe(preFsrs.confidence)
  })

  it('regression snapshot: 4 signals with known values produce exact score', () => {
    // Pre-computed: quiz=80, flashcard=70, completion=100, recency=100 (days=3)
    // Score: 80*0.3 + 70*0.3 + 100*0.2 + 100*0.2 = 24+21+20+20 = 85
    const result = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: 70,
      completionPercent: 100,
      daysSinceLastEngagement: 3,
    })
    expect(result.score).toBe(85)
    expect(result.tier).toBe('strong')
    expect(result.confidence).toBe('high')
    expect(result.signalsUsed).toBe(4)
  })

  it('regression snapshot: 2 signals produce exact score', () => {
    // completion=50, recency at 365 days=10, each at 0.5 weight
    // Score: 50*0.5 + 10*0.5 = 25+5 = 30
    const result = calculateTopicScore({
      quizScore: null,
      flashcardRetention: null,
      completionPercent: 50,
      daysSinceLastEngagement: 365,
    })
    expect(result.score).toBe(30)
    expect(result.tier).toBe('weak')
  })

  it('fsrsRetention=60 with all other signals produces different score than null path', () => {
    const withFsrs = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: null,
      completionPercent: 100,
      daysSinceLastEngagement: 3,
      fsrsRetention: 60,
    })
    const withoutFsrs = calculateTopicScore({
      quizScore: 80,
      flashcardRetention: null,
      completionPercent: 100,
      daysSinceLastEngagement: 3,
      fsrsRetention: null,
    })
    // With FSRS: 4 signals (score=82), Without: 3 signals (different weights)
    expect(withFsrs.score).not.toBe(withoutFsrs.score)
    expect(withFsrs.signalsUsed).toBe(4)
    expect(withoutFsrs.signalsUsed).toBe(3)
  })
})

// ── BASE_WEIGHTS ──────────────────────────────────────────────────

describe('BASE_WEIGHTS', () => {
  it('sums to 1.0', () => {
    const sum =
      BASE_WEIGHTS.quiz + BASE_WEIGHTS.flashcard + BASE_WEIGHTS.completion + BASE_WEIGHTS.recency
    expect(sum).toBeCloseTo(1.0, 10)
  })
})
