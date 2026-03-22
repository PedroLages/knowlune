import { describe, it, expect } from 'vitest'
import {
  analyzeTopicPerformance,
  calculateImprovement,
  calculateNormalizedGain,
  calculateItemDifficulty,
  calculateDiscriminationIndices,
} from '@/lib/analytics'
import {
  makeQuestion,
  makeQuiz,
  makeAttempt,
  makeCorrectAnswer,
  makeWrongAnswer,
  makeSkippedAnswer,
} from '../../../tests/support/fixtures/factories/quiz-factory'

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
// calculateItemDifficulty (E17-S03)
// ---------------------------------------------------------------------------

describe('calculateItemDifficulty', () => {
  it('returns empty array when no attempts', () => {
    const quiz = makeQuiz({ questions: [makeQuestion({ id: 'q1', order: 1, text: 'Q1' })] })
    expect(calculateItemDifficulty(quiz, [])).toEqual([])
  })

  it('calculates P-value correctly: 3/4 = 0.75', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result).toHaveLength(1)
    expect(result[0].pValue).toBeCloseTo(0.75)
  })

  it('categorizes P=0.8 as Easy (boundary: inclusive)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // 8/10 = 0.8 exactly
    const attempts = [
      ...Array.from({ length: 8 }, () => makeAttempt({ answers: [makeCorrectAnswer('q1')] })),
      ...Array.from({ length: 2 }, () => makeAttempt({ answers: [makeWrongAnswer('q1')] })),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].difficulty).toBe('Easy')
  })

  it('categorizes P=0.7999 as Medium (just below Easy boundary)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // 79/100 = 0.79
    const attempts = [
      ...Array.from({ length: 79 }, () => makeAttempt({ answers: [makeCorrectAnswer('q1')] })),
      ...Array.from({ length: 21 }, () => makeAttempt({ answers: [makeWrongAnswer('q1')] })),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].difficulty).toBe('Medium')
  })

  it('categorizes P=0.5 as Medium (boundary: inclusive)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].difficulty).toBe('Medium')
    expect(result[0].pValue).toBeCloseTo(0.5)
  })

  it('categorizes P=0.4999 as Difficult (just below Medium boundary)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // 49/100 = 0.49
    const attempts = [
      ...Array.from({ length: 49 }, () => makeAttempt({ answers: [makeCorrectAnswer('q1')] })),
      ...Array.from({ length: 51 }, () => makeAttempt({ answers: [makeWrongAnswer('q1')] })),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].difficulty).toBe('Difficult')
  })

  it('excludes questions with zero attempts', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1 answered' })
    const q2 = makeQuestion({ id: 'q2', order: 2, text: 'Q2 never answered' })
    const quiz = makeQuiz({ questions: [q1, q2] })
    // Only q1 has answers — q2 never appears in attempts
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result).toHaveLength(1)
    expect(result[0].questionId).toBe('q1')
  })

  it('sorts easiest first (highest P-value first)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Easy Q' })
    const q2 = makeQuestion({ id: 'q2', order: 2, text: 'Hard Q' })
    const quiz = makeQuiz({ questions: [q1, q2] })
    const attempts = [
      makeAttempt({
        answers: [makeCorrectAnswer('q1'), makeWrongAnswer('q2')],
      }),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].questionId).toBe('q1') // P=1.0 — easiest first
    expect(result[1].questionId).toBe('q2') // P=0.0 — hardest last
  })

  it('aggregates across multiple attempts for the same question', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // Correct in attempt1, wrong in attempt2 → P = 0.5
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].pValue).toBeCloseTo(0.5)
  })

  it('includes topic from question in result', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1', topic: 'Algebra' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].topic).toBe('Algebra')
  })

  it('defaults to "General" when question has no topic', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].topic).toBe('General')
  })

  it('single attempt with all correct: all Easy', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const q2 = makeQuestion({ id: 'q2', order: 2, text: 'Q2' })
    const quiz = makeQuiz({ questions: [q1, q2] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1'), makeCorrectAnswer('q2')] })]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result).toHaveLength(2)
    expect(result.every(r => r.difficulty === 'Easy')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// calculateDiscriminationIndices (E17-S04)
// ---------------------------------------------------------------------------

describe('calculateDiscriminationIndices', () => {
  // Helper: build a quiz with N questions (ids: 'q1', 'q2', ...)
  function makeTestQuiz(numQuestions: number): import('@/types/quiz').Quiz {
    const questions = Array.from({ length: numQuestions }, (_, i) =>
      makeQuestion({ id: `q${i + 1}`, order: i + 1, text: `Question ${i + 1}` })
    )
    return {
      id: 'quiz-disc-test',
      lessonId: 'lesson-disc-test',
      title: 'Discrimination Test Quiz',
      description: '',
      questions,
      timeLimit: null,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
  }

  it('returns null when fewer than 5 attempts', () => {
    const quiz = makeTestQuiz(2)
    const attempts = [
      makeAttempt({ quizId: 'quiz-disc-test' }),
      makeAttempt({ quizId: 'quiz-disc-test' }),
    ]
    expect(calculateDiscriminationIndices(quiz, attempts)).toBeNull()
  })

  it('returns null for exactly 4 attempts (boundary)', () => {
    const quiz = makeTestQuiz(2)
    const attempts = Array.from({ length: 4 }, () =>
      makeAttempt({ quizId: 'quiz-disc-test' })
    )
    expect(calculateDiscriminationIndices(quiz, attempts)).toBeNull()
  })

  it('returns results array for exactly 5 attempts (minimum boundary)', () => {
    const quiz = makeTestQuiz(1)
    const attempts = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({
        id: `a${i}`,
        quizId: 'quiz-disc-test',
        score: i,
        answers: [makeCorrectAnswer('q1', { isCorrect: i > 2, pointsEarned: i > 2 ? 1 : 0 })],
      })
    )
    const result = calculateDiscriminationIndices(quiz, attempts)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
  })

  it('calculates known rpb value correctly', () => {
    // Manually verified scenario:
    // 5 attempts, q1 correct in last 3 (high scorers), incorrect in first 2 (low scorers)
    // Scores: [0, 0, 1, 1, 1] for q1; total scores: [0, 0, 1, 1, 1]
    // group1 (correct) scores: [1, 1, 1], mean1 = 1.0
    // group0 (incorrect) scores: [0, 0], mean0 = 0.0
    // allScores = [0, 0, 1, 1, 1], meanAll = 0.6
    // variance = ((0.36 + 0.36 + 0.16 + 0.16 + 0.16) / 4) = 1.2/4 = 0.3
    // sd = sqrt(0.3) ≈ 0.5477
    // p = 3/5 = 0.6, pComplement = 0.4
    // rpb = (1.0 - 0.0) / 0.5477 * sqrt(0.6 * 0.4)
    //     = 1.826 * 0.4899 ≈ 0.894
    const quiz = makeTestQuiz(1)
    const attempts = [
      makeAttempt({ id: 'a1', quizId: 'quiz-disc-test', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a2', quizId: 'quiz-disc-test', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a5', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
    ]
    const result = calculateDiscriminationIndices(quiz, attempts)!
    expect(result).toHaveLength(1)
    expect(result[0].questionId).toBe('q1')
    expect(result[0].discriminationIndex).toBeCloseTo(0.894, 2)
  })

  it('returns discriminationIndex 0 and special interpretation when sd === 0 (all scores identical)', () => {
    const quiz = makeTestQuiz(1)
    // All attempts score 1 (identical) — some q1 correct, some not
    const attempts = [
      makeAttempt({ id: 'a1', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a2', quizId: 'quiz-disc-test', score: 1, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', quizId: 'quiz-disc-test', score: 1, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a5', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
    ]
    const result = calculateDiscriminationIndices(quiz, attempts)!
    expect(result[0].discriminationIndex).toBe(0)
    expect(result[0].interpretation).toContain('identical')
  })

  it('returns discriminationIndex 0 and "Not enough data" when all attempts got question correct', () => {
    const quiz = makeTestQuiz(1)
    // All correct — group0 is empty
    const attempts = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({
        id: `a${i}`,
        quizId: 'quiz-disc-test',
        score: i + 1,
        answers: [makeCorrectAnswer('q1')],
      })
    )
    const result = calculateDiscriminationIndices(quiz, attempts)!
    expect(result[0].discriminationIndex).toBe(0)
    expect(result[0].interpretation).toBe('Not enough data')
  })

  it('returns discriminationIndex 0 and "Not enough data" when all attempts got question wrong', () => {
    const quiz = makeTestQuiz(1)
    // All wrong — group1 is empty
    const attempts = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({
        id: `a${i}`,
        quizId: 'quiz-disc-test',
        score: i,
        answers: [makeWrongAnswer('q1')],
      })
    )
    const result = calculateDiscriminationIndices(quiz, attempts)!
    expect(result[0].discriminationIndex).toBe(0)
    expect(result[0].interpretation).toBe('Not enough data')
  })

  it('high discriminator (rpb > 0.3) gets correct interpretation text', () => {
    // Use the known-rpb scenario above (rpb ≈ 0.894 > 0.3)
    const quiz = makeTestQuiz(1)
    const attempts = [
      makeAttempt({ id: 'a1', quizId: 'quiz-disc-test', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a2', quizId: 'quiz-disc-test', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a5', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
    ]
    const result = calculateDiscriminationIndices(quiz, attempts)!
    expect(result[0].interpretation).toContain('High discriminator')
    expect(result[0].interpretation).toContain('strong attempts')
  })

  it('low discriminator (rpb < 0.2) gets correct interpretation text', () => {
    const quiz = makeTestQuiz(1)
    const attempts = [
      makeAttempt({ id: 'a1', quizId: 'quiz-disc-test', score: 2, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a2', quizId: 'quiz-disc-test', score: 2, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', quizId: 'quiz-disc-test', score: 3, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', quizId: 'quiz-disc-test', score: 3, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a5', quizId: 'quiz-disc-test', score: 4, answers: [makeWrongAnswer('q1')] }),
    ]
    const result = calculateDiscriminationIndices(quiz, attempts)!
    expect(result[0].interpretation).toContain('Low discriminator')
  })

  it('returns one result per quiz question', () => {
    const quiz = makeTestQuiz(3)
    const attempts = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({
        id: `a${i}`,
        quizId: 'quiz-disc-test',
        score: i,
        answers: [
          makeCorrectAnswer('q1', { isCorrect: i >= 3, pointsEarned: i >= 3 ? 1 : 0 }),
          makeCorrectAnswer('q2', { isCorrect: i >= 2, pointsEarned: i >= 2 ? 1 : 0 }),
          makeCorrectAnswer('q3', { isCorrect: true }),
        ],
      })
    )
    const result = calculateDiscriminationIndices(quiz, attempts)!
    expect(result).toHaveLength(3)
    expect(result.map(r => r.questionId)).toEqual(['q1', 'q2', 'q3'])
  })

  it('uses sample standard deviation (n-1 denominator)', () => {
    // Verify by checking a known calculation uses n-1:
    // n-1 sample SD: sqrt(1.2/4) = sqrt(0.3) ≈ 0.5477 → rpb ≈ 0.894
    // n population SD: sqrt(1.2/5) = sqrt(0.24) ≈ 0.4899 → rpb ≈ 1.0 (different)
    const quiz = makeTestQuiz(1)
    const attempts = [
      makeAttempt({ id: 'a1', quizId: 'quiz-disc-test', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a2', quizId: 'quiz-disc-test', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a5', quizId: 'quiz-disc-test', score: 1, answers: [makeCorrectAnswer('q1')] }),
    ]
    const result = calculateDiscriminationIndices(quiz, attempts)!
    // only passes if n-1
    expect(result[0].discriminationIndex).toBeCloseTo(0.894, 2)
  })
})
