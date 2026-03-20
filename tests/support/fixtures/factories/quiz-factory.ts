/**
 * Data factories for LevelUp quiz content.
 *
 * Creates Quiz, Question, QuizAttempt, and QuizProgress objects with
 * sensible defaults and override support.
 *
 * Pattern: factory function with Partial<T> overrides
 */
import type { Quiz, Question, QuizAttempt, QuizProgress } from '../../../../src/types/quiz'
import { FIXED_DATE, FIXED_TIMESTAMP } from '../../../utils/test-time'

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: crypto.randomUUID(),
    order: 1,
    type: 'multiple-choice',
    text: 'What is the capital of France?',
    options: ['Paris', 'London', 'Berlin', 'Madrid'],
    correctAnswer: 'Paris',
    explanation: 'Paris is the capital of France.',
    points: 1,
    hint: overrides.hint ?? undefined,
    ...overrides,
  }
}

export function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  const question = makeQuestion()
  return {
    id: crypto.randomUUID(),
    lessonId: crypto.randomUUID(),
    title: 'Test Quiz',
    description: 'A test quiz',
    questions: [question],
    timeLimit: null,
    passingScore: 70,
    allowRetakes: true,
    shuffleQuestions: false,
    shuffleAnswers: false,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

export function makeAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: crypto.randomUUID(),
    quizId: crypto.randomUUID(),
    answers: [],
    score: 1,
    percentage: 100,
    passed: true,
    timeSpent: 30000,
    completedAt: FIXED_DATE,
    startedAt: FIXED_DATE,
    timerAccommodation: 'standard',
    ...overrides,
  }
}

export function makeProgress(quizId: string, overrides: Partial<QuizProgress> = {}): QuizProgress {
  return {
    quizId,
    currentQuestionIndex: 0,
    answers: {},
    startTime: FIXED_TIMESTAMP,
    timeRemaining: null,
    isPaused: false,
    markedForReview: [],
    questionOrder: [],
    timerAccommodation: 'standard',
    ...overrides,
  }
}
