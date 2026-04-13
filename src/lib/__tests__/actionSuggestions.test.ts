import { describe, it, expect } from 'vitest'
import {
  generateActionSuggestions,
  calculateUrgencyScore,
  fsrsDecayFactor,
  recencyDecayFactor,
  type TopicWithScore,
} from '@/lib/actionSuggestions'

// Deterministic date constant per ESLint test-patterns/deterministic-time rule
const FIXED_DATE = new Date('2026-04-01T12:00:00Z')
void FIXED_DATE // Referenced for pattern compliance; pure functions don't use dates

// ── Test Helpers ────────────────────────────────────────────────

function makeTopic(overrides: Partial<TopicWithScore> = {}): TopicWithScore {
  return {
    topicName: 'Linear Algebra',
    canonicalName: 'linear-algebra',
    score: 50,
    tier: 'fading',
    trend: 'declining',
    recencyScore: 40,
    hasFlashcards: false,
    hasQuizzes: false,
    lessons: [],
    ...overrides,
  }
}

// ── AC 1: Weak topic with flashcard data → flashcard-review ─────

describe('generateActionSuggestions', () => {
  it('generates flashcard-review for a weak topic with flashcard data (AC 1)', () => {
    const topic = makeTopic({
      topicName: 'Calculus',
      canonicalName: 'calculus',
      score: 35,
      tier: 'weak',
      hasFlashcards: true,
    })

    const result = generateActionSuggestions([topic])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      actionType: 'flashcard-review',
      actionLabel: 'Review 5 flashcards on Calculus',
      actionRoute: '/flashcards?topic=calculus',
      estimatedMinutes: 5,
    })
  })

  // ── AC 2: Fading topic with quiz data → quiz-refresh ──────────

  it('generates quiz-refresh for a fading topic with quiz data (AC 2)', () => {
    const topic = makeTopic({
      topicName: 'Organic Chemistry',
      canonicalName: 'organic-chemistry',
      score: 55,
      tier: 'fading',
      hasQuizzes: true,
    })

    const result = generateActionSuggestions([topic])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      actionType: 'quiz-refresh',
      actionLabel: 'Take a refresher quiz on Organic Chemistry',
      actionRoute: '/quiz?topic=organic-chemistry',
      estimatedMinutes: 10,
    })
  })

  // ── AC 3: Fading topic with lessons → lesson-rewatch (lowest completion) ──

  it('generates lesson-rewatch targeting lowest-completion lesson (AC 3)', () => {
    const topic = makeTopic({
      topicName: 'Data Structures',
      canonicalName: 'data-structures',
      score: 42,
      tier: 'fading',
      lessons: [
        { lessonId: 'L1', courseId: 'C1', title: 'Arrays', completionPct: 80, durationMinutes: 20 },
        { lessonId: 'L2', courseId: 'C1', title: 'Trees', completionPct: 30, durationMinutes: 25 },
        { lessonId: 'L3', courseId: 'C1', title: 'Graphs', completionPct: 60 },
      ],
    })

    const result = generateActionSuggestions([topic])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      actionType: 'lesson-rewatch',
      actionLabel: 'Rewatch Trees',
      actionRoute: '/courses/C1/lessons/L2',
      estimatedMinutes: 25,
      lessonTitle: 'Trees',
    })
  })

  // ── AC 4: Urgency sorting (descending) ────────────────────────

  it('sorts suggestions by urgency score descending (AC 4)', () => {
    const highUrgency = makeTopic({
      topicName: 'Physics',
      canonicalName: 'physics',
      score: 20, // very low score → high urgency
      tier: 'weak',
      recencyScore: 10,
      hasFlashcards: true,
    })
    const lowUrgency = makeTopic({
      topicName: 'Biology',
      canonicalName: 'biology',
      score: 60, // moderate score → lower urgency
      tier: 'fading',
      recencyScore: 80,
      hasQuizzes: true,
    })

    const result = generateActionSuggestions([lowUrgency, highUrgency])

    expect(result).toHaveLength(2)
    expect(result[0].canonicalName).toBe('physics')
    expect(result[1].canonicalName).toBe('biology')
    expect(result[0].urgencyScore).toBeGreaterThan(result[1].urgencyScore)
  })

  // ── AC 5: Deduplication keeps highest-priority action per topic ──

  it('deduplicates to keep only highest-priority action type per topic (AC 5)', () => {
    const topic = makeTopic({
      topicName: 'Statistics',
      canonicalName: 'statistics',
      score: 45,
      tier: 'fading',
      hasFlashcards: true,
      hasQuizzes: true,
      lessons: [{ lessonId: 'L1', courseId: 'C2', title: 'Probability', completionPct: 50 }],
    })

    const result = generateActionSuggestions([topic])

    // Should only return one suggestion per topic (flashcard-review has highest priority)
    expect(result).toHaveLength(1)
    expect(result[0].actionType).toBe('flashcard-review')
  })

  // ── AC 6: FSRS stability produces higher urgency for low-stability topics ──

  it('uses FSRS stability for urgency when provided (AC 6)', () => {
    const lowStability = makeTopic({
      topicName: 'Chemistry',
      canonicalName: 'chemistry',
      score: 50,
      tier: 'fading',
      hasFlashcards: true,
    })
    const highStability = makeTopic({
      topicName: 'History',
      canonicalName: 'history',
      score: 50,
      tier: 'fading',
      hasFlashcards: true,
    })

    const fsrsStability = new Map([
      ['chemistry', 5], // low stability → high decay
      ['history', 50], // high stability → low decay
    ])

    const result = generateActionSuggestions([lowStability, highStability], { fsrsStability })

    expect(result).toHaveLength(2)
    // Chemistry (low stability=5, decay=90) should have higher urgency than History (stability=50, decay=0)
    const chemistry = result.find(s => s.canonicalName === 'chemistry')!
    const history = result.find(s => s.canonicalName === 'history')!
    expect(chemistry.urgencyScore).toBeGreaterThan(history.urgencyScore)
  })

  // ── AC 7: Recency decay fallback when FSRS not provided ───────

  it('falls back to recency decay when FSRS not provided (AC 7)', () => {
    const lowRecency = makeTopic({
      topicName: 'Art',
      canonicalName: 'art',
      score: 50,
      tier: 'fading',
      recencyScore: 20, // low recency → high decay (80)
      hasQuizzes: true,
    })
    const highRecency = makeTopic({
      topicName: 'Music',
      canonicalName: 'music',
      score: 50,
      tier: 'fading',
      recencyScore: 90, // high recency → low decay (10)
      hasQuizzes: true,
    })

    const result = generateActionSuggestions([lowRecency, highRecency])

    const art = result.find(s => s.canonicalName === 'art')!
    const music = result.find(s => s.canonicalName === 'music')!
    expect(art.urgencyScore).toBeGreaterThan(music.urgencyScore)
  })

  // ── AC 8: maxSuggestions limit respected ──────────────────────

  it('respects maxSuggestions limit (AC 8)', () => {
    const topics = Array.from({ length: 7 }, (_, i) =>
      makeTopic({
        topicName: `Topic ${i}`,
        canonicalName: `topic-${i}`,
        score: 30 + i * 3,
        tier: 'weak',
        hasFlashcards: true,
      })
    )

    const result = generateActionSuggestions(topics, { maxSuggestions: 3 })

    expect(result).toHaveLength(3)
  })

  // ── Zero-activity declining topic returns empty suggestions ────

  it('returns empty array for a fading topic with no activities (no flashcards, quizzes, or lessons)', () => {
    const topic = makeTopic({
      topicName: 'Empty Topic',
      canonicalName: 'empty-topic',
      score: 40,
      tier: 'fading',
      hasFlashcards: false,
      hasQuizzes: false,
      lessons: [],
    })

    const result = generateActionSuggestions([topic])

    expect(result).toEqual([])
  })

  // ── Default recencyScore fallback (undefined → 50) ────────────

  it('uses default recencyScore of 50 when not provided', () => {
    const topic = makeTopic({
      topicName: 'No Recency',
      canonicalName: 'no-recency',
      score: 45,
      tier: 'fading',
      recencyScore: undefined,
      hasFlashcards: true,
    })

    const result = generateActionSuggestions([topic])

    expect(result).toHaveLength(1)
    // With default recencyScore=50, decayFactor=50, urgency = (100-45)*0.6 + 50*0.4 = 33 + 20 = 53
    expect(result[0].urgencyScore).toBeCloseTo(53)
  })

  // ── AC 9: Empty input returns empty array ─────────────────────

  it('returns empty array for empty input (AC 9)', () => {
    expect(generateActionSuggestions([])).toEqual([])
  })

  // ── AC 9: All strong topics returns empty array ───────────────

  it('returns empty array when all topics are strong (AC 9)', () => {
    const topics = [
      makeTopic({ canonicalName: 'math', score: 85, tier: 'strong', hasFlashcards: true }),
      makeTopic({ canonicalName: 'english', score: 72, tier: 'strong', hasQuizzes: true }),
    ]

    expect(generateActionSuggestions(topics)).toEqual([])
  })

  // ── AC 10: Topic with only lessons produces only lesson-rewatch ──

  it('produces only lesson-rewatch for topic with only lessons (AC 10)', () => {
    const topic = makeTopic({
      topicName: 'Philosophy',
      canonicalName: 'philosophy',
      score: 38,
      tier: 'weak',
      hasFlashcards: false,
      hasQuizzes: false,
      lessons: [{ lessonId: 'L5', courseId: 'C3', title: 'Ethics 101', completionPct: 20 }],
    })

    const result = generateActionSuggestions([topic])

    expect(result).toHaveLength(1)
    expect(result[0].actionType).toBe('lesson-rewatch')
    expect(result[0].actionLabel).toBe('Rewatch Ethics 101')
    expect(result[0].estimatedMinutes).toBe(15) // default duration
  })
})

// ── Urgency Calculation Unit Tests ──────────────────────────────

describe('calculateUrgencyScore', () => {
  it('computes urgency from score and decay factor', () => {
    // score=35, decayFactor=80 → (100-35)*0.6 + 80*0.4 = 39 + 32 = 71
    expect(calculateUrgencyScore(35, 80)).toBeCloseTo(71)
  })

  it('returns 100 for score=0, decay=100', () => {
    expect(calculateUrgencyScore(0, 100)).toBeCloseTo(100)
  })

  it('returns 0 for score=100, decay=0', () => {
    expect(calculateUrgencyScore(100, 0)).toBeCloseTo(0)
  })
})

describe('fsrsDecayFactor', () => {
  it('returns 100 for stability 0', () => {
    expect(fsrsDecayFactor(0)).toBe(100)
  })

  it('returns 0 for stability 50', () => {
    expect(fsrsDecayFactor(50)).toBe(0)
  })

  it('returns 0 for stability > 50 (clamped)', () => {
    expect(fsrsDecayFactor(80)).toBe(0)
  })

  it('returns 90 for stability 5', () => {
    expect(fsrsDecayFactor(5)).toBe(90)
  })
})

describe('recencyDecayFactor', () => {
  it('returns high decay for low recency', () => {
    expect(recencyDecayFactor(20)).toBe(80)
  })

  it('returns low decay for high recency', () => {
    expect(recencyDecayFactor(90)).toBe(10)
  })
})
