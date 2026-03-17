import { describe, it, expect } from 'vitest'
import {
  QuestionMediaSchema,
  QuestionSchema,
  QuizSchema,
  AnswerSchema,
  QuizAttemptSchema,
  QuizProgressSchema,
  type Question,
  type Quiz,
} from '../quiz'

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

function makeMCQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    order: 1,
    type: 'multiple-choice',
    text: 'What is 2+2?',
    options: ['3', '4', '5', '6'],
    correctAnswer: '4',
    explanation: 'Basic arithmetic.',
    points: 10,
    ...overrides,
  }
}

function makeTFQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q2',
    order: 2,
    type: 'true-false',
    text: 'The sky is blue.',
    options: ['True', 'False'],
    correctAnswer: 'True',
    explanation: 'On a clear day, the sky appears blue.',
    points: 5,
    ...overrides,
  }
}

function makeMSQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q3',
    order: 3,
    type: 'multiple-select',
    text: 'Select all prime numbers.',
    options: ['2', '3', '4', '5'],
    correctAnswer: ['2', '3', '5'],
    explanation: '2, 3, and 5 are prime numbers.',
    points: 15,
    ...overrides,
  }
}

function makeFIBQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q4',
    order: 4,
    type: 'fill-in-blank',
    text: 'The capital of France is ____.',
    correctAnswer: 'Paris',
    explanation: 'Paris is the capital of France.',
    points: 10,
    ...overrides,
  }
}

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    lessonId: 'lesson-1',
    title: 'Sample Quiz',
    description: 'A sample quiz for testing.',
    // cast: ZodEffects inferred type is structurally equivalent to ZodObject output
    // but TypeScript can't prove it — see BaseQuestionSchema JSDoc in quiz.ts
    questions: [makeMCQuestion(), makeTFQuestion()] as unknown as Quiz['questions'],
    timeLimit: 600000,
    passingScore: 70,
    allowRetakes: true,
    shuffleQuestions: false,
    shuffleAnswers: false,
    createdAt: '2026-03-17T10:00:00.000Z',
    updatedAt: '2026-03-17T10:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// QuestionMediaSchema
// ---------------------------------------------------------------------------

describe('QuestionMediaSchema', () => {
  it('validates valid media', () => {
    const result = QuestionMediaSchema.safeParse({
      type: 'image',
      url: 'https://example.com/img.png',
      alt: 'A diagram',
    })
    expect(result.success).toBe(true)
  })

  it('validates media without optional alt', () => {
    const result = QuestionMediaSchema.safeParse({
      type: 'video',
      url: 'https://example.com/vid.mp4',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid media type', () => {
    const result = QuestionMediaSchema.safeParse({
      type: 'document',
      url: 'https://example.com/doc.pdf',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty url', () => {
    const result = QuestionMediaSchema.safeParse({
      type: 'image',
      url: '',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// QuestionSchema — Valid Data
// ---------------------------------------------------------------------------

describe('QuestionSchema — valid questions', () => {
  it('validates a multiple-choice question', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion())
    expect(result.success).toBe(true)
  })

  it('validates a true/false question', () => {
    const result = QuestionSchema.safeParse(makeTFQuestion())
    expect(result.success).toBe(true)
  })

  it('validates a multiple-select question', () => {
    const result = QuestionSchema.safeParse(makeMSQuestion())
    expect(result.success).toBe(true)
  })

  it('validates a fill-in-blank question', () => {
    const result = QuestionSchema.safeParse(makeFIBQuestion())
    expect(result.success).toBe(true)
  })

  it('validates a question with media', () => {
    const result = QuestionSchema.safeParse(
      makeMCQuestion({
        media: { type: 'image', url: 'https://example.com/q1.png', alt: 'Diagram' },
      })
    )
    expect(result.success).toBe(true)
  })

  it('validates MC question with 2 options (minimum)', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ options: ['A', 'B'] }))
    expect(result.success).toBe(true)
  })

  it('validates MC question with 6 options (maximum)', () => {
    const result = QuestionSchema.safeParse(
      makeMCQuestion({ options: ['A', 'B', 'C', 'D', 'E', 'F'] })
    )
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// QuestionSchema — Type-Specific Refinement Failures
// ---------------------------------------------------------------------------

describe('QuestionSchema — type-specific refinements', () => {
  it('rejects MC question without options', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ options: undefined }))
    expect(result.success).toBe(false)
  })

  it('rejects MC question with 1 option', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ options: ['Only one'] }))
    expect(result.success).toBe(false)
  })

  it('rejects MC question with 7 options', () => {
    const result = QuestionSchema.safeParse(
      makeMCQuestion({ options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] })
    )
    expect(result.success).toBe(false)
  })

  it('rejects TF question with 3 options', () => {
    const result = QuestionSchema.safeParse(makeTFQuestion({ options: ['True', 'False', 'Maybe'] }))
    expect(result.success).toBe(false)
  })

  it('rejects TF question with 1 option', () => {
    const result = QuestionSchema.safeParse(makeTFQuestion({ options: ['True'] }))
    expect(result.success).toBe(false)
  })

  it('rejects MS question without options', () => {
    const result = QuestionSchema.safeParse(makeMSQuestion({ options: undefined }))
    expect(result.success).toBe(false)
  })

  it('rejects FIB question with options', () => {
    const result = QuestionSchema.safeParse(makeFIBQuestion({ options: ['Paris', 'London'] }))
    expect(result.success).toBe(false)
  })

  it('allows FIB question with empty options array', () => {
    const result = QuestionSchema.safeParse(makeFIBQuestion({ options: [] }))
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// QuestionSchema — Field Validation
// ---------------------------------------------------------------------------

describe('QuestionSchema — field validation', () => {
  it('rejects empty question id', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ id: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects empty question text', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ text: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects zero points', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ points: 0 }))
    expect(result.success).toBe(false)
  })

  it('rejects negative points', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ points: -5 }))
    expect(result.success).toBe(false)
  })

  it('rejects non-integer order', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ order: 1.5 }))
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// QuizSchema
// ---------------------------------------------------------------------------

describe('QuizSchema', () => {
  it('validates a complete quiz', () => {
    const result = QuizSchema.safeParse(makeQuiz())
    expect(result.success).toBe(true)
  })

  it('validates a quiz with null timeLimit (untimed)', () => {
    const result = QuizSchema.safeParse(makeQuiz({ timeLimit: null }))
    expect(result.success).toBe(true)
  })

  it('rejects passingScore below 0', () => {
    const result = QuizSchema.safeParse(makeQuiz({ passingScore: -1 }))
    expect(result.success).toBe(false)
  })

  it('rejects passingScore above 100', () => {
    const result = QuizSchema.safeParse(makeQuiz({ passingScore: 101 }))
    expect(result.success).toBe(false)
  })

  it('accepts passingScore of 0', () => {
    const result = QuizSchema.safeParse(makeQuiz({ passingScore: 0 }))
    expect(result.success).toBe(true)
  })

  it('accepts passingScore of 100', () => {
    const result = QuizSchema.safeParse(makeQuiz({ passingScore: 100 }))
    expect(result.success).toBe(true)
  })

  it('rejects quiz with empty questions array', () => {
    const result = QuizSchema.safeParse(makeQuiz({ questions: [] as unknown as Quiz['questions'] })) // cast: see makeQuiz comment
    expect(result.success).toBe(false)
  })

  it('rejects quiz with missing required fields', () => {
    const result = QuizSchema.safeParse({ id: 'quiz-1' })
    expect(result.success).toBe(false)
  })

  it('rejects zero timeLimit', () => {
    const result = QuizSchema.safeParse(makeQuiz({ timeLimit: 0 }))
    expect(result.success).toBe(false)
  })

  it('rejects negative timeLimit', () => {
    const result = QuizSchema.safeParse(makeQuiz({ timeLimit: -1000 }))
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AnswerSchema
// ---------------------------------------------------------------------------

describe('AnswerSchema', () => {
  it('validates a string answer (MC/TF/FIB)', () => {
    const result = AnswerSchema.safeParse({
      questionId: 'q1',
      userAnswer: '4',
      isCorrect: true,
      pointsEarned: 10,
      pointsPossible: 10,
    })
    expect(result.success).toBe(true)
  })

  it('validates a string[] answer (MS)', () => {
    const result = AnswerSchema.safeParse({
      questionId: 'q3',
      userAnswer: ['2', '3', '5'],
      isCorrect: true,
      pointsEarned: 15,
      pointsPossible: 15,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative pointsEarned', () => {
    const result = AnswerSchema.safeParse({
      questionId: 'q1',
      userAnswer: '3',
      isCorrect: false,
      pointsEarned: -5,
      pointsPossible: 10,
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// QuizAttemptSchema
// ---------------------------------------------------------------------------

describe('QuizAttemptSchema', () => {
  it('validates a complete quiz attempt', () => {
    const result = QuizAttemptSchema.safeParse({
      id: 'attempt-1',
      quizId: 'quiz-1',
      answers: [
        {
          questionId: 'q1',
          userAnswer: '4',
          isCorrect: true,
          pointsEarned: 10,
          pointsPossible: 10,
        },
      ],
      score: 10,
      percentage: 100,
      passed: true,
      timeSpent: 30000,
      completedAt: '2026-03-17T10:05:00.000Z',
      startedAt: '2026-03-17T10:00:00.000Z',
      timerAccommodation: 'standard',
    })
    expect(result.success).toBe(true)
  })

  it('validates all timer accommodation values', () => {
    for (const accommodation of ['standard', '150%', '200%', 'untimed'] as const) {
      const result = QuizAttemptSchema.safeParse({
        id: 'attempt-1',
        quizId: 'quiz-1',
        answers: [],
        score: 0,
        percentage: 0,
        passed: false,
        timeSpent: 0,
        completedAt: '2026-03-17T10:05:00.000Z',
        startedAt: '2026-03-17T10:00:00.000Z',
        timerAccommodation: accommodation,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid timer accommodation', () => {
    const result = QuizAttemptSchema.safeParse({
      id: 'attempt-1',
      quizId: 'quiz-1',
      answers: [],
      score: 0,
      percentage: 0,
      passed: false,
      timeSpent: 0,
      completedAt: '2026-03-17T10:05:00.000Z',
      startedAt: '2026-03-17T10:00:00.000Z',
      timerAccommodation: '300%',
    })
    expect(result.success).toBe(false)
  })

  it('rejects percentage above 100', () => {
    const result = QuizAttemptSchema.safeParse({
      id: 'attempt-1',
      quizId: 'quiz-1',
      answers: [],
      score: 0,
      percentage: 150,
      passed: false,
      timeSpent: 0,
      completedAt: '2026-03-17T10:05:00.000Z',
      startedAt: '2026-03-17T10:00:00.000Z',
      timerAccommodation: 'standard',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// QuizProgressSchema
// ---------------------------------------------------------------------------

describe('QuizProgressSchema', () => {
  it('validates in-progress quiz state', () => {
    const result = QuizProgressSchema.safeParse({
      quizId: 'quiz-1',
      currentQuestionIndex: 2,
      answers: { q1: '4', q3: ['2', '5'] },
      startTime: 1710672000000,
      timeRemaining: 300000,
      isPaused: false,
      markedForReview: ['q3'],
      questionOrder: ['q1', 'q2', 'q3', 'q4'],
      timerAccommodation: '150%',
    })
    expect(result.success).toBe(true)
  })

  it('validates progress with null timeRemaining (untimed)', () => {
    const result = QuizProgressSchema.safeParse({
      quizId: 'quiz-1',
      currentQuestionIndex: 0,
      answers: {},
      startTime: 1710672000000,
      timeRemaining: null,
      isPaused: false,
      markedForReview: [],
      questionOrder: ['q1'],
      timerAccommodation: 'untimed',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative currentQuestionIndex', () => {
    const result = QuizProgressSchema.safeParse({
      quizId: 'quiz-1',
      currentQuestionIndex: -1,
      answers: {},
      startTime: 1710672000000,
      timeRemaining: null,
      isPaused: false,
      markedForReview: [],
      questionOrder: [],
      timerAccommodation: 'standard',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative timeRemaining', () => {
    const result = QuizProgressSchema.safeParse({
      quizId: 'quiz-1',
      currentQuestionIndex: 0,
      answers: {},
      startTime: 1710672000000,
      timeRemaining: -1,
      isPaused: false,
      markedForReview: [],
      questionOrder: [],
      timerAccommodation: 'standard',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// QuestionSchema — correctAnswer integrity
// ---------------------------------------------------------------------------

describe('QuestionSchema — correctAnswer integrity', () => {
  it('rejects empty string correctAnswer', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ correctAnswer: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects empty array correctAnswer', () => {
    const result = QuestionSchema.safeParse(makeMSQuestion({ correctAnswer: [] }))
    expect(result.success).toBe(false)
  })

  it('rejects array with empty string entries', () => {
    const result = QuestionSchema.safeParse(makeMSQuestion({ correctAnswer: ['', '3'] }))
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// QuestionSchema — refinement error message (documents current message contract)
// ---------------------------------------------------------------------------

describe('QuestionSchema — refinement error message', () => {
  it('refinement failure carries expected error message', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ options: undefined }))
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message)
      expect(messages).toContain(
        'Question options do not match the expected constraints for this question type'
      )
    }
  })
})

// ---------------------------------------------------------------------------
// QuizAttemptSchema — negative lower bounds
// ---------------------------------------------------------------------------

describe('QuizAttemptSchema — lower bound constraints', () => {
  const base = {
    id: 'attempt-1',
    quizId: 'quiz-1',
    answers: [],
    score: 10,
    percentage: 100,
    passed: true,
    timeSpent: 30000,
    completedAt: '2026-03-17T10:05:00.000Z',
    startedAt: '2026-03-17T10:00:00.000Z',
    timerAccommodation: 'standard' as const,
  }

  it('rejects negative score', () => {
    expect(QuizAttemptSchema.safeParse({ ...base, score: -1 }).success).toBe(false)
  })

  it('rejects negative percentage', () => {
    expect(QuizAttemptSchema.safeParse({ ...base, percentage: -1 }).success).toBe(false)
  })

  it('rejects negative timeSpent', () => {
    expect(QuizAttemptSchema.safeParse({ ...base, timeSpent: -1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Type Inference (compile-time verification)
// ---------------------------------------------------------------------------

describe('Type inference', () => {
  it('inferred Quiz type has correct structure', () => {
    // This test verifies TypeScript compilation — if it compiles, types infer correctly.
    const quiz: Quiz = makeQuiz()
    expect(quiz.id).toBe('quiz-1')
    expect(quiz.passingScore).toBe(70)
    expect(typeof quiz.allowRetakes).toBe('boolean')
    expect(quiz.timeLimit).toBe(600000)
  })

  it('Question correctAnswer accepts string', () => {
    const q: Question = makeMCQuestion()
    expect(typeof q.correctAnswer).toBe('string')
  })

  it('Question correctAnswer accepts string[]', () => {
    const q: Question = makeMSQuestion()
    expect(Array.isArray(q.correctAnswer)).toBe(true)
  })
})
