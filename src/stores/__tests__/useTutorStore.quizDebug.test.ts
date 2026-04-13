/**
 * Unit tests for useTutorStore — quiz and debug actions (E73)
 *
 * Coverage:
 * - recordQuizAnswer(correct: true) increments correct count
 * - recordQuizAnswer(correct: false) increments total but not correct
 * - switchMode from 'quiz' saves lastQuizResult before resetting quizState
 * - recordDebugAssessment('green') adds entry to debugAssessments
 * - switchMode from 'debug' resets debugAssessments to []
 * - debugAssessments and quizState start at initial values
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTutorStore } from '@/stores/useTutorStore'

vi.mock('@/db', () => ({
  db: {
    chatConversations: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
      }),
      add: vi.fn().mockResolvedValue('id'),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

vi.mock('@/ai/tutor/learnerModelService', () => ({
  getOrCreateLearnerModel: vi.fn(),
  updateLearnerModel: vi.fn(),
  replaceLearnerModelFields: vi.fn(),
  clearLearnerModel: vi.fn(),
}))

const INITIAL_QUIZ_STATE = {
  totalQuestions: 0,
  correctAnswers: 0,
  currentStreak: 0,
  bloomLevel: 0,
  lastAnswerCorrect: null,
}

beforeEach(() => {
  useTutorStore.setState({
    messages: [],
    mode: 'socratic',
    quizState: { ...INITIAL_QUIZ_STATE },
    lastQuizResult: null,
    debugAssessments: [],
    modeHistory: [],
    modeTransitionContext: null,
    hintLevel: 0,
    stuckCount: 0,
  })
})

describe('initial state', () => {
  it('quizState starts at initial values', () => {
    const { quizState } = useTutorStore.getState()
    expect(quizState).toEqual(INITIAL_QUIZ_STATE)
  })

  it('debugAssessments starts as empty array', () => {
    const { debugAssessments } = useTutorStore.getState()
    expect(debugAssessments).toEqual([])
  })
})

describe('recordQuizAnswer', () => {
  it('increments correct count and total when correct=true', () => {
    useTutorStore.getState().recordQuizAnswer(true)
    const { quizState } = useTutorStore.getState()
    expect(quizState.correctAnswers).toBe(1)
    expect(quizState.totalQuestions).toBe(1)
    expect(quizState.lastAnswerCorrect).toBe(true)
  })

  it('increments total but not correct count when correct=false', () => {
    useTutorStore.getState().recordQuizAnswer(false)
    const { quizState } = useTutorStore.getState()
    expect(quizState.totalQuestions).toBe(1)
    expect(quizState.correctAnswers).toBe(0)
    expect(quizState.lastAnswerCorrect).toBe(false)
  })

  it('accumulates multiple answers', () => {
    useTutorStore.getState().recordQuizAnswer(true)
    useTutorStore.getState().recordQuizAnswer(false)
    useTutorStore.getState().recordQuizAnswer(true)
    const { quizState } = useTutorStore.getState()
    expect(quizState.totalQuestions).toBe(3)
    expect(quizState.correctAnswers).toBe(2)
  })
})

describe('switchMode from quiz', () => {
  it('saves lastQuizResult before resetting quizState', () => {
    // Set up quiz mode with some answers
    useTutorStore.setState({ mode: 'quiz' })
    useTutorStore.getState().recordQuizAnswer(true)
    useTutorStore.getState().recordQuizAnswer(true)
    useTutorStore.getState().recordQuizAnswer(false)

    useTutorStore.getState().switchMode('explain')

    const { lastQuizResult, quizState } = useTutorStore.getState()
    expect(lastQuizResult).not.toBeNull()
    expect(lastQuizResult?.totalQuestions).toBe(3)
    expect(lastQuizResult?.correctAnswers).toBe(2)
    expect(lastQuizResult?.completedAt).toBeTypeOf('number')

    // quizState should be reset
    expect(quizState).toEqual(INITIAL_QUIZ_STATE)
  })

  it('does not save lastQuizResult if no answers were recorded', () => {
    useTutorStore.setState({ mode: 'quiz', lastQuizResult: null })
    useTutorStore.getState().switchMode('explain')
    const { lastQuizResult } = useTutorStore.getState()
    expect(lastQuizResult).toBeNull()
  })
})

describe('recordDebugAssessment', () => {
  it('adds a green assessment entry to debugAssessments', () => {
    useTutorStore.getState().recordDebugAssessment('green')
    const { debugAssessments } = useTutorStore.getState()
    expect(debugAssessments).toHaveLength(1)
    expect(debugAssessments[0].assessment).toBe('green')
    expect(debugAssessments[0].timestamp).toBeTypeOf('number')
  })

  it('adds a yellow assessment with concept', () => {
    useTutorStore.getState().recordDebugAssessment('yellow', 'photosynthesis')
    const { debugAssessments } = useTutorStore.getState()
    expect(debugAssessments[0].concept).toBe('photosynthesis')
  })

  it('accumulates multiple assessments', () => {
    useTutorStore.getState().recordDebugAssessment('green')
    useTutorStore.getState().recordDebugAssessment('red')
    expect(useTutorStore.getState().debugAssessments).toHaveLength(2)
  })
})

describe('switchMode from debug', () => {
  it('resets debugAssessments to []', () => {
    useTutorStore.setState({ mode: 'debug' })
    useTutorStore.getState().recordDebugAssessment('green')
    useTutorStore.getState().recordDebugAssessment('yellow')

    useTutorStore.getState().switchMode('explain')

    const { debugAssessments } = useTutorStore.getState()
    expect(debugAssessments).toEqual([])
  })
})
