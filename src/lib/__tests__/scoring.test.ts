import { describe, it, expect } from 'vitest'
import { calculateQuizScore } from '@/lib/scoring'
import type { Quiz } from '@/types/quiz'

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    lessonId: 'les-1',
    title: 'Test Quiz',
    description: '',
    questions: [],
    timeLimit: null,
    passingScore: 70,
    allowRetakes: true,
    shuffleQuestions: false,
    shuffleAnswers: false,
    createdAt: '2025-01-15T12:00:00.000Z',
    updatedAt: '2025-01-15T12:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// multiple-choice
// ---------------------------------------------------------------------------

describe('calculateQuizScore — multiple-choice', () => {
  const quiz = makeQuiz({
    questions: [
      {
        id: 'q1',
        order: 1,
        type: 'multiple-choice',
        text: 'Q1',
        options: ['A', 'B', 'C'],
        correctAnswer: 'A',
        explanation: '',
        points: 2,
      },
    ],
  })

  it('awards full points for correct answer', () => {
    const result = calculateQuizScore(quiz, { q1: 'A' })
    expect(result.score).toBe(2)
    expect(result.maxScore).toBe(2)
    expect(result.percentage).toBe(100)
    expect(result.passed).toBe(true)
    expect(result.answers[0].isCorrect).toBe(true)
    expect(result.answers[0].pointsEarned).toBe(2)
  })

  it('awards zero points for incorrect answer', () => {
    const result = calculateQuizScore(quiz, { q1: 'B' })
    expect(result.score).toBe(0)
    expect(result.percentage).toBe(0)
    expect(result.passed).toBe(false)
    expect(result.answers[0].isCorrect).toBe(false)
    expect(result.answers[0].pointsEarned).toBe(0)
  })

  it('treats unanswered question as incorrect', () => {
    const result = calculateQuizScore(quiz, {})
    expect(result.score).toBe(0)
    expect(result.answers[0].isCorrect).toBe(false)
    expect(result.answers[0].userAnswer).toBe('')
  })
})

// ---------------------------------------------------------------------------
// true-false
// ---------------------------------------------------------------------------

describe('calculateQuizScore — true-false', () => {
  const quiz = makeQuiz({
    questions: [
      {
        id: 'q1',
        order: 1,
        type: 'true-false',
        text: 'Q1',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: '',
        points: 1,
      },
    ],
  })

  it('scores correctly for true-false question', () => {
    expect(calculateQuizScore(quiz, { q1: 'True' }).passed).toBe(true)
    expect(calculateQuizScore(quiz, { q1: 'False' }).passed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// fill-in-blank
// ---------------------------------------------------------------------------

describe('calculateQuizScore — fill-in-blank', () => {
  const quiz = makeQuiz({
    questions: [
      {
        id: 'q1',
        order: 1,
        type: 'fill-in-blank',
        text: 'The capital of France is ___',
        options: [],
        correctAnswer: 'Paris',
        explanation: '',
        points: 1,
      },
    ],
  })

  it('scores correctly with exact match', () => {
    expect(calculateQuizScore(quiz, { q1: 'Paris' }).score).toBe(1)
  })

  it('is case-insensitive', () => {
    expect(calculateQuizScore(quiz, { q1: 'paris' }).score).toBe(1)
    expect(calculateQuizScore(quiz, { q1: 'PARIS' }).score).toBe(1)
  })

  it('trims whitespace before comparing', () => {
    expect(calculateQuizScore(quiz, { q1: '  Paris  ' }).score).toBe(1)
  })

  it('scores 0 for wrong answer', () => {
    expect(calculateQuizScore(quiz, { q1: 'London' }).score).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// multiple-select
// ---------------------------------------------------------------------------

describe('calculateQuizScore — multiple-select', () => {
  const quiz = makeQuiz({
    questions: [
      {
        id: 'q1',
        order: 1,
        type: 'multiple-select',
        text: 'Select all that apply',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: ['A', 'C'],
        explanation: '',
        points: 2,
      },
    ],
  })

  it('awards full points when all correct options selected in any order', () => {
    expect(calculateQuizScore(quiz, { q1: ['A', 'C'] }).score).toBe(2)
    expect(calculateQuizScore(quiz, { q1: ['C', 'A'] }).score).toBe(2)
  })

  it('awards zero for partial selection', () => {
    expect(calculateQuizScore(quiz, { q1: ['A'] }).score).toBe(0)
  })

  it('awards zero for extra selection', () => {
    expect(calculateQuizScore(quiz, { q1: ['A', 'B', 'C'] }).score).toBe(0)
  })

  it('awards zero for completely wrong selection', () => {
    expect(calculateQuizScore(quiz, { q1: ['B', 'D'] }).score).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// percentage rounding and passing threshold
// ---------------------------------------------------------------------------

describe('calculateQuizScore — percentage and passing', () => {
  const quiz = makeQuiz({
    passingScore: 70,
    questions: [
      { id: 'q1', order: 1, type: 'multiple-choice', text: 'Q1', options: ['A'], correctAnswer: 'A', explanation: '', points: 1 },
      { id: 'q2', order: 2, type: 'multiple-choice', text: 'Q2', options: ['A'], correctAnswer: 'A', explanation: '', points: 1 },
      { id: 'q3', order: 3, type: 'multiple-choice', text: 'Q3', options: ['A'], correctAnswer: 'A', explanation: '', points: 1 },
    ],
  })

  it('rounds percentage to 1 decimal place (1/3 = 33.3)', () => {
    const result = calculateQuizScore(quiz, { q1: 'A', q2: 'B', q3: 'B' })
    expect(result.percentage).toBe(33.3)
    expect(result.passed).toBe(false)
  })

  it('passes when percentage exactly equals passingScore', () => {
    // Need a quiz where exact passing is achievable: passingScore=33.3 or use different setup
    const exactQuiz = makeQuiz({ passingScore: 33.3, questions: quiz.questions })
    const result = calculateQuizScore(exactQuiz, { q1: 'A', q2: 'B', q3: 'B' })
    expect(result.passed).toBe(true)
  })

  it('fails when percentage is one point below passing', () => {
    const result = calculateQuizScore(quiz, { q1: 'A', q2: 'A', q3: 'B' }) // 66.7%
    expect(result.percentage).toBe(66.7)
    expect(result.passed).toBe(false)
  })

  it('passes when percentage is at or above passing (2/3 = 66.7 < 70 → fail; 3/3 = 100 → pass)', () => {
    expect(calculateQuizScore(quiz, { q1: 'A', q2: 'A', q3: 'A' }).passed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// empty quiz guard
// ---------------------------------------------------------------------------

describe('calculateQuizScore — empty questions', () => {
  it('returns 0 percentage and not passed when quiz has no questions', () => {
    const quiz = makeQuiz({ questions: [] })
    const result = calculateQuizScore(quiz, {})
    expect(result.score).toBe(0)
    expect(result.maxScore).toBe(0)
    expect(result.percentage).toBe(0)
    expect(result.passed).toBe(false)
    expect(result.answers).toHaveLength(0)
  })
})
