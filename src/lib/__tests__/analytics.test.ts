import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  analyzeTopicPerformance,
  calculateImprovement,
  calculateNormalizedGain,
  calculateRetakeFrequency,
  interpretRetakeFrequency,
} from '@/lib/analytics'
import {
  makeQuestion,
  makeAttempt,
  makeCorrectAnswer,
  makeWrongAnswer,
  makeSkippedAnswer,
} from '../../../tests/support/fixtures/factories/quiz-factory'
import { db } from '@/db'

vi.mock('@/db', () => ({
  db: {
    quizAttempts: {
      toArray: vi.fn(),
    },
  },
}))

const mockToArray = db.quizAttempts.toArray as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Shorthand aliases
// ---------------------------------------------------------------------------

const q = (id: string, order: number, topic?: string) =>
  makeQuestion({ id, order, text: `Question ${order}`, ...(topic ? { topic } : {}) })
const correct = (questionId: string) => makeCorrectAnswer(questionId)
const wrong = (questionId: string) => makeWrongAnswer(questionId)
const skipped = (questionId: string) => makeSkippedAnswer(questionId)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyzeTopicPerformance', () => {
  it('categorizes mixed topics into strengths and growth areas', () => {
    const questions = [
      q('q1', 1, 'Arrays'),
      q('q2', 2, 'Arrays'),
      q('q3', 3, 'Functions'),
      q('q4', 4, 'Functions'),
      q('q5', 5, 'Objects'),
    ]
    const answers = [
      correct('q1'), // Arrays ✓
      correct('q2'), // Arrays ✓
      wrong('q3'), // Functions ✗
      wrong('q4'), // Functions ✗
      correct('q5'), // Objects ✓
    ]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.correctCount).toBe(3)
    expect(result.incorrectCount).toBe(2)
    expect(result.skippedCount).toBe(0)
    expect(result.hasMultipleTopics).toBe(true)

    // Strengths: Arrays 100%, Objects 100%
    expect(result.strengths).toHaveLength(2)
    expect(result.strengths[0]).toEqual({ name: 'Arrays', percentage: 100, questionNumbers: [] })
    expect(result.strengths[1]).toEqual({ name: 'Objects', percentage: 100, questionNumbers: [] })

    // Growth: Functions 0%
    expect(result.growthAreas).toHaveLength(1)
    expect(result.growthAreas[0]).toEqual({
      name: 'Functions',
      percentage: 0,
      questionNumbers: [3, 4],
    })
  })

  it('returns all strengths when all answers are correct', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'B')]
    const answers = [correct('q1'), correct('q2')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.strengths).toHaveLength(2)
    expect(result.growthAreas).toHaveLength(0)
    expect(result.correctCount).toBe(2)
  })

  it('returns all growth areas when all answers are incorrect', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'B')]
    const answers = [wrong('q1'), wrong('q2')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.strengths).toHaveLength(0)
    expect(result.growthAreas).toHaveLength(2)
    expect(result.incorrectCount).toBe(2)
  })

  it('groups under "General" when questions have no topic tags', () => {
    const questions = [q('q1', 1), q('q2', 2), q('q3', 3)]
    const answers = [correct('q1'), correct('q2'), wrong('q3')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.hasMultipleTopics).toBe(false)
    // Single "General" topic at 66% (2/3 = floor(66.67)) → growth area
    expect(result.strengths).toHaveLength(0)
    expect(result.growthAreas).toHaveLength(1)
    expect(result.growthAreas[0].name).toBe('General')
    expect(result.growthAreas[0].percentage).toBe(66)
  })

  it('groups all-correct no-topic quiz under "General" as strength', () => {
    const questions = [q('q1', 1), q('q2', 2), q('q3', 3)]
    const answers = [correct('q1'), correct('q2'), correct('q3')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.hasMultipleTopics).toBe(false)
    expect(result.strengths).toHaveLength(1)
    expect(result.strengths[0]).toEqual({ name: 'General', percentage: 100, questionNumbers: [] })
  })

  it('treats empty string topic as "General"', () => {
    const questions = [makeQuestion({ id: 'q1', order: 1, topic: '' })]
    const answers = [correct('q1')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.strengths[0].name).toBe('General')
  })

  it('trims whitespace-only topic to "General"', () => {
    const questions = [makeQuestion({ id: 'q1', order: 1, topic: '  ' })]
    const answers = [correct('q1')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.strengths[0].name).toBe('General')
  })

  it('sets hasMultipleTopics false when only one unique topic exists', () => {
    const questions = [q('q1', 1, 'Arrays'), q('q2', 2, 'Arrays')]
    const answers = [correct('q1'), wrong('q2')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.hasMultipleTopics).toBe(false)
  })

  it('counts skipped questions correctly', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'A'), q('q3', 3, 'B')]
    const answers = [correct('q1'), skipped('q2'), wrong('q3')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.skippedCount).toBe(1)
    expect(result.correctCount).toBe(1)
    expect(result.incorrectCount).toBe(1)
  })

  it('counts questions with no answer at all as skipped', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'A')]
    // Only q1 has an answer — q2 has no matching answer
    const answers = [correct('q1')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.skippedCount).toBe(1)
    expect(result.correctCount).toBe(1)
  })

  it('limits growth areas to 3', () => {
    const questions = [
      q('q1', 1, 'A'),
      q('q2', 2, 'B'),
      q('q3', 3, 'C'),
      q('q4', 4, 'D'),
      q('q5', 5, 'E'),
    ]
    const answers = [wrong('q1'), wrong('q2'), wrong('q3'), wrong('q4'), wrong('q5')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.growthAreas).toHaveLength(3)
  })

  it('sorts strengths from highest to lowest percentage', () => {
    const questions = [
      q('q1', 1, 'A'),
      q('q2', 2, 'A'),
      q('q3', 3, 'A'), // A: 2/3 = 66% — not strength
      q('q4', 4, 'B'),
      q('q5', 5, 'B'), // B: 2/2 = 100%
      q('q6', 6, 'C'),
      q('q7', 7, 'C'),
      q('q8', 8, 'C'),
      q('q9', 9, 'C'), // C: 3/4 = 75%
    ]
    const answers = [
      correct('q1'),
      correct('q2'),
      wrong('q3'),
      correct('q4'),
      correct('q5'),
      correct('q6'),
      correct('q7'),
      correct('q8'),
      wrong('q9'),
    ]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.strengths.map(s => s.name)).toEqual(['B', 'C'])
    expect(result.strengths[0].percentage).toBe(100)
    expect(result.strengths[1].percentage).toBe(75)
  })

  it('sorts growth areas from lowest to highest percentage', () => {
    const questions = [
      q('q1', 1, 'A'),
      q('q2', 2, 'A'), // A: 1/2 = 50%
      q('q3', 3, 'B'),
      q('q4', 4, 'B'), // B: 0/2 = 0%
    ]
    const answers = [correct('q1'), wrong('q2'), wrong('q3'), wrong('q4')]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.growthAreas.map(g => g.name)).toEqual(['B', 'A'])
    expect(result.growthAreas[0].percentage).toBe(0)
    expect(result.growthAreas[1].percentage).toBe(50)
  })

  it('only includes incorrect question numbers in questionNumbers', () => {
    const questions = [q('q1', 1, 'Math'), q('q2', 2, 'Math'), q('q3', 3, 'Math')]
    const answers = [correct('q1'), wrong('q2'), wrong('q3')]

    const result = analyzeTopicPerformance(questions, answers)

    // Math: 1/3 = 33% → growth area
    expect(result.growthAreas[0].questionNumbers).toEqual([2, 3])
  })

  it('handles empty questions array', () => {
    const result = analyzeTopicPerformance([], [])

    expect(result.correctCount).toBe(0)
    expect(result.incorrectCount).toBe(0)
    expect(result.skippedCount).toBe(0)
    expect(result.strengths).toEqual([])
    expect(result.growthAreas).toEqual([])
    expect(result.hasMultipleTopics).toBe(false)
  })

  it('treats 70% as strength threshold (boundary)', () => {
    // 7/10 = 70% exactly → strength
    const questions = Array.from({ length: 10 }, (_, i) => q(`q${i}`, i + 1, 'X'))
    const answers = [
      ...questions.slice(0, 7).map(q => correct(q.id)),
      ...questions.slice(7).map(q => wrong(q.id)),
    ]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.strengths).toHaveLength(1)
    expect(result.strengths[0].percentage).toBe(70)
    expect(result.growthAreas).toHaveLength(0)
  })

  it('treats 69% as growth area (boundary — Math.floor prevents rounding up)', () => {
    // 69/100 = 69% exactly → growth area (not promoted to 70% by rounding)
    const questions = Array.from({ length: 100 }, (_, i) => q(`q${i}`, i + 1, 'X'))
    const answers = [
      ...questions.slice(0, 69).map(q => correct(q.id)),
      ...questions.slice(69).map(q => wrong(q.id)),
    ]

    const result = analyzeTopicPerformance(questions, answers)

    expect(result.growthAreas).toHaveLength(1)
    expect(result.growthAreas[0].percentage).toBe(69)
    expect(result.strengths).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// calculateImprovement
// ---------------------------------------------------------------------------

describe('calculateImprovement', () => {
  it('returns all nulls for empty attempts array', () => {
    const result = calculateImprovement([])
    expect(result.firstScore).toBeNull()
    expect(result.bestScore).toBeNull()
    expect(result.bestAttemptNumber).toBeNull()
    expect(result.currentScore).toBe(0)
    expect(result.improvement).toBeNull()
    expect(result.isNewBest).toBe(false)
  })

  it('single attempt: improvement null, isNewBest false', () => {
    const attempt = makeAttempt({ percentage: 70, completedAt: '2026-01-01T10:00:00.000Z' })
    const result = calculateImprovement([attempt])
    expect(result.currentScore).toBe(70)
    expect(result.firstScore).toBeNull()
    expect(result.improvement).toBeNull()
    expect(result.isNewBest).toBe(false)
    expect(result.bestScore).toBe(70)
    expect(result.bestAttemptNumber).toBe(1)
  })

  it('two attempts, score improved: isNewBest true, correct delta', () => {
    const a1 = makeAttempt({ percentage: 60, completedAt: '2026-01-01T10:00:00.000Z' })
    const a2 = makeAttempt({ percentage: 85, completedAt: '2026-01-02T10:00:00.000Z' })
    const result = calculateImprovement([a1, a2])
    expect(result.firstScore).toBe(60)
    expect(result.currentScore).toBe(85)
    expect(result.improvement).toBe(25)
    expect(result.isNewBest).toBe(true)
    expect(result.bestScore).toBe(85)
  })

  it('two attempts, same score: isNewBest false (strict greater than)', () => {
    const a1 = makeAttempt({ percentage: 80, completedAt: '2026-01-01T10:00:00.000Z' })
    const a2 = makeAttempt({ percentage: 80, completedAt: '2026-01-02T10:00:00.000Z' })
    const result = calculateImprovement([a1, a2])
    expect(result.isNewBest).toBe(false)
    expect(result.improvement).toBe(0)
  })

  it('three attempts, current is new best: isNewBest true', () => {
    const a1 = makeAttempt({ percentage: 60, completedAt: '2026-01-01T10:00:00.000Z' })
    const a2 = makeAttempt({ percentage: 75, completedAt: '2026-01-02T10:00:00.000Z' })
    const a3 = makeAttempt({ percentage: 90, completedAt: '2026-01-03T10:00:00.000Z' })
    const result = calculateImprovement([a1, a2, a3])
    expect(result.isNewBest).toBe(true)
    expect(result.firstScore).toBe(60)
    expect(result.currentScore).toBe(90)
    expect(result.improvement).toBe(30)
  })

  it('three attempts, current is NOT best: isNewBest false, bestAttemptNumber correct', () => {
    const a1 = makeAttempt({ percentage: 60, completedAt: '2026-01-01T10:00:00.000Z' })
    const a2 = makeAttempt({ percentage: 90, completedAt: '2026-01-02T10:00:00.000Z' })
    const a3 = makeAttempt({ percentage: 75, completedAt: '2026-01-03T10:00:00.000Z' })
    const result = calculateImprovement([a1, a2, a3])
    expect(result.isNewBest).toBe(false)
    expect(result.currentScore).toBe(75)
    expect(result.bestScore).toBe(90)
    // bestAttemptNumber is 1-based index in the original (unsorted) array
    expect(result.bestAttemptNumber).toBe(2)
  })

  it('bestAttemptNumber = 3 when 3rd attempt is best', () => {
    const a1 = makeAttempt({ percentage: 50, completedAt: '2026-01-01T10:00:00.000Z' })
    const a2 = makeAttempt({ percentage: 60, completedAt: '2026-01-02T10:00:00.000Z' })
    const a3 = makeAttempt({ percentage: 95, completedAt: '2026-01-03T10:00:00.000Z' })
    // Pass in insertion order (a1, a2, a3) — bestAttemptNumber should be 3
    const result = calculateImprovement([a1, a2, a3])
    expect(result.bestAttemptNumber).toBe(3)
    expect(result.bestScore).toBe(95)
  })

  it('out-of-order completedAt: sort produces correct first/current', () => {
    // a2 has earlier completedAt, a1 is later — sort should pick a2 as first, a1 as current
    const a1 = makeAttempt({ percentage: 85, completedAt: '2026-01-03T10:00:00.000Z' })
    const a2 = makeAttempt({ percentage: 60, completedAt: '2026-01-01T10:00:00.000Z' })
    const result = calculateImprovement([a1, a2])
    expect(result.firstScore).toBe(60)
    expect(result.currentScore).toBe(85)
    expect(result.improvement).toBe(25)
    expect(result.isNewBest).toBe(true)
  })

  it('regression: current < first → improvement is negative, isNewBest false', () => {
    const a1 = makeAttempt({ percentage: 80, completedAt: '2026-01-01T10:00:00.000Z' })
    const a2 = makeAttempt({ percentage: 65, completedAt: '2026-01-02T10:00:00.000Z' })
    const result = calculateImprovement([a1, a2])
    expect(result.improvement).toBe(-15)
    expect(result.isNewBest).toBe(false)
    expect(result.bestScore).toBe(80)
    expect(result.currentScore).toBe(65)
  })
})

// ---------------------------------------------------------------------------
// calculateNormalizedGain (Hake's formula)
// ---------------------------------------------------------------------------

describe('calculateNormalizedGain', () => {
  it('returns null for empty attempts', () => {
    expect(calculateNormalizedGain([])).toBeNull()
  })

  it('returns null for a single attempt', () => {
    const a1 = makeAttempt({ percentage: 70, completedAt: '2026-01-01T00:00:00Z' })
    expect(calculateNormalizedGain([a1])).toBeNull()
  })

  it('calculates gain correctly: 40→70 = 0.50', () => {
    const a1 = makeAttempt({ percentage: 40, completedAt: '2026-01-01T00:00:00Z' })
    const a2 = makeAttempt({ percentage: 70, completedAt: '2026-01-02T00:00:00Z' })
    expect(calculateNormalizedGain([a1, a2])).toBeCloseTo(0.5, 2)
  })

  it('calculates gain correctly: 60→90 = 0.75', () => {
    const a1 = makeAttempt({ percentage: 60, completedAt: '2026-01-01T00:00:00Z' })
    const a2 = makeAttempt({ percentage: 90, completedAt: '2026-01-02T00:00:00Z' })
    expect(calculateNormalizedGain([a1, a2])).toBeCloseTo(0.75, 2)
  })

  it('returns 0 when no improvement (60→60)', () => {
    const a1 = makeAttempt({ percentage: 60, completedAt: '2026-01-01T00:00:00Z' })
    const a2 = makeAttempt({ percentage: 60, completedAt: '2026-01-02T00:00:00Z' })
    expect(calculateNormalizedGain([a1, a2])).toBe(0)
  })

  it('returns null for ceiling effect (pre = 100%)', () => {
    const a1 = makeAttempt({ percentage: 100, completedAt: '2026-01-01T00:00:00Z' })
    const a2 = makeAttempt({ percentage: 100, completedAt: '2026-01-02T00:00:00Z' })
    expect(calculateNormalizedGain([a1, a2])).toBeNull()
  })

  it('handles negative gain (regression): 80→60 = -1.0', () => {
    const a1 = makeAttempt({ percentage: 80, completedAt: '2026-01-01T00:00:00Z' })
    const a2 = makeAttempt({ percentage: 60, completedAt: '2026-01-02T00:00:00Z' })
    expect(calculateNormalizedGain([a1, a2])).toBeCloseTo(-1.0, 2)
  })

  it('uses first and last chronologically (ignores middle)', () => {
    const a1 = makeAttempt({ percentage: 40, completedAt: '2026-01-01T00:00:00Z' })
    const a2 = makeAttempt({ percentage: 50, completedAt: '2026-01-02T00:00:00Z' })
    const a3 = makeAttempt({ percentage: 70, completedAt: '2026-01-03T00:00:00Z' })
    expect(calculateNormalizedGain([a1, a2, a3])).toBeCloseTo(0.5, 2)
  })
})

// ---------------------------------------------------------------------------
// calculateRetakeFrequency (E17-S02)
// ---------------------------------------------------------------------------

describe('calculateRetakeFrequency', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 0 averageRetakes when no attempts', async () => {
    mockToArray.mockResolvedValue([])
    const result = await calculateRetakeFrequency()
    expect(result).toEqual({ averageRetakes: 0, totalAttempts: 0, uniqueQuizzes: 0 })
  })

  it('calculates 3.0 for one quiz attempted 3 times', async () => {
    mockToArray.mockResolvedValue([
      { id: 'a1', quizId: 'q1' },
      { id: 'a2', quizId: 'q1' },
      { id: 'a3', quizId: 'q1' },
    ])
    const result = await calculateRetakeFrequency()
    expect(result.averageRetakes).toBe(3)
    expect(result.totalAttempts).toBe(3)
    expect(result.uniqueQuizzes).toBe(1)
  })

  it('calculates 1.0 for two different quizzes each attempted once', async () => {
    mockToArray.mockResolvedValue([
      { id: 'a1', quizId: 'q1' },
      { id: 'a2', quizId: 'q2' },
    ])
    const result = await calculateRetakeFrequency()
    expect(result.averageRetakes).toBe(1)
    expect(result.totalAttempts).toBe(2)
    expect(result.uniqueQuizzes).toBe(2)
  })

  it('calculates 2.5 for quiz A × 3 + quiz B × 2', async () => {
    mockToArray.mockResolvedValue([
      { id: 'a1', quizId: 'qA' },
      { id: 'a2', quizId: 'qA' },
      { id: 'a3', quizId: 'qA' },
      { id: 'a4', quizId: 'qB' },
      { id: 'a5', quizId: 'qB' },
    ])
    const result = await calculateRetakeFrequency()
    expect(result.averageRetakes).toBe(2.5)
    expect(result.totalAttempts).toBe(5)
    expect(result.uniqueQuizzes).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// interpretRetakeFrequency (E17-S02)
// ---------------------------------------------------------------------------

describe('interpretRetakeFrequency', () => {
  it('returns "No retakes yet" for exactly 1.0', () => {
    expect(interpretRetakeFrequency(1.0)).toBe('No retakes yet — each quiz taken once.')
  })

  it('returns "Light review" for 1.5', () => {
    expect(interpretRetakeFrequency(1.5)).toBe('Light review — you occasionally revisit quizzes.')
  })

  it('returns "Active practice" for 2.5', () => {
    expect(interpretRetakeFrequency(2.5)).toBe(
      'Active practice — you retake quizzes 2-3 times on average for mastery.'
    )
  })

  it('returns "Deep practice" for 4.0', () => {
    expect(interpretRetakeFrequency(4.0)).toBe(
      'Deep practice — strong commitment to mastery through repetition.'
    )
  })
})
