import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { Module, Course } from '@/data/types'
import { makeQuiz, makeQuestion } from '../../../tests/support/fixtures/factories/quiz-factory'

// Mock persistWithRetry to run operation once (no retries).
// Retry logic is tested in persistWithRetry's own tests.
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

vi.mock('sonner', () => {
  const toastFn = vi.fn() as ReturnType<typeof vi.fn> & {
    error: ReturnType<typeof vi.fn>
    success: ReturnType<typeof vi.fn>
  }
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  return { toast: toastFn }
})

let useQuizStore: (typeof import('@/stores/useQuizStore'))['useQuizStore']
let db: (typeof import('@/db'))['db']

// Minimal modules array for cross-store calls
const mockModules: Module[] = [
  {
    id: 'mod-1',
    title: 'Module 1',
    description: '',
    order: 1,
    lessons: [
      { id: 'les-1', title: 'Lesson 1', description: '', order: 1, resources: [], keyTopics: [] },
    ],
  },
]

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  // Clear persist storage to prevent cross-test state rehydration
  localStorage.removeItem('levelup-quiz-store')
  vi.resetModules()
  const storeMod = await import('@/stores/useQuizStore')
  useQuizStore = storeMod.useQuizStore
  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// startQuiz
// ---------------------------------------------------------------------------

describe('startQuiz', () => {
  it('loads quiz and initializes progress with shuffled order when shuffleQuestions is true', async () => {
    const quiz = {
      id: 'quiz-1',
      lessonId: 'les-1',
      title: 'Quiz 1',
      description: '',
      questions: [
        {
          id: 'q1',
          order: 1,
          type: 'multiple-choice' as const,
          text: 'Q1',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: '',
          points: 1,
        },
        {
          id: 'q2',
          order: 2,
          type: 'true-false' as const,
          text: 'Q2',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: '',
          points: 1,
        },
      ],
      timeLimit: null,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: true,
      shuffleAnswers: false,
      createdAt: '2025-01-15T12:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
    }
    await db.quizzes.add(quiz)

    await act(async () => {
      await useQuizStore.getState().startQuiz('les-1')
    })

    const state = useQuizStore.getState()
    expect(state.currentQuiz?.id).toBe('quiz-1')
    expect(state.currentProgress?.quizId).toBe('quiz-1')
    // questionOrder should contain both question IDs (may be in any order)
    expect(state.currentProgress?.questionOrder).toHaveLength(2)
    expect(state.currentProgress?.questionOrder).toEqual(expect.arrayContaining(['q1', 'q2']))
    expect(state.isLoading).toBe(false)
  })

  it('preserves original order when shuffleQuestions is false', async () => {
    const quiz = {
      id: 'quiz-2',
      lessonId: 'les-2',
      title: 'Quiz 2',
      description: '',
      questions: [
        {
          id: 'q1',
          order: 1,
          type: 'multiple-choice' as const,
          text: 'Q1',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: '',
          points: 1,
        },
        {
          id: 'q2',
          order: 2,
          type: 'multiple-choice' as const,
          text: 'Q2',
          options: ['A', 'B'],
          correctAnswer: 'B',
          explanation: '',
          points: 1,
        },
      ],
      timeLimit: null,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2025-01-15T12:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
    }
    await db.quizzes.add(quiz)

    await act(async () => {
      await useQuizStore.getState().startQuiz('les-2')
    })

    const order = useQuizStore.getState().currentProgress?.questionOrder
    expect(order).toEqual(['q1', 'q2'])
  })

  it('sets error state when quiz not found', async () => {
    await act(async () => {
      await useQuizStore.getState().startQuiz('non-existent-lesson')
    })

    const state = useQuizStore.getState()
    expect(state.currentQuiz).toBeNull()
    expect(state.error).toBe('Quiz not found')
    expect(state.isLoading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// submitAnswer
// ---------------------------------------------------------------------------

describe('submitAnswer', () => {
  it('updates currentProgress.answers optimistically without writing to Dexie', async () => {
    const quiz = {
      id: 'quiz-3',
      lessonId: 'les-3',
      title: 'Quiz 3',
      description: '',
      questions: [
        {
          id: 'q1',
          order: 1,
          type: 'multiple-choice' as const,
          text: 'Q1',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: '',
          points: 1,
        },
      ],
      timeLimit: null,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2025-01-15T12:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
    }
    await db.quizzes.add(quiz)
    await act(async () => {
      await useQuizStore.getState().startQuiz('les-3')
    })

    useQuizStore.getState().submitAnswer('q1', 'A')

    const answers = useQuizStore.getState().currentProgress?.answers
    expect(answers?.['q1']).toBe('A')

    // No Dexie write — quizAttempts table should be empty
    const dbAttempts = await db.quizAttempts.toArray()
    expect(dbAttempts).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// submitQuiz
// ---------------------------------------------------------------------------

describe('submitQuiz', () => {
  async function setupQuizInProgress(lessonId: string) {
    const quiz = {
      id: `quiz-${lessonId}`,
      lessonId,
      title: 'Quiz',
      description: '',
      questions: [
        {
          id: 'q1',
          order: 1,
          type: 'multiple-choice' as const,
          text: 'Q1',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: '',
          points: 1,
        },
      ],
      timeLimit: null,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2025-01-15T12:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
    }
    await db.quizzes.add(quiz)
    await act(async () => {
      await useQuizStore.getState().startQuiz(lessonId)
    })
    return quiz
  }

  it('creates QuizAttempt in Dexie and clears currentProgress on success', async () => {
    await setupQuizInProgress('les-4')
    useQuizStore.getState().submitAnswer('q1', 'A')

    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })

    const state = useQuizStore.getState()
    expect(state.currentProgress).toBeNull()
    expect(state.attempts).toHaveLength(1)
    expect(state.isLoading).toBe(false)

    const dbAttempts = await db.quizAttempts.toArray()
    expect(dbAttempts).toHaveLength(1)
    expect(dbAttempts[0].passed).toBe(true)
  })

  it('calls useContentProgressStore.setItemStatus only when score >= passingScore', async () => {
    await setupQuizInProgress('les-5')
    // Answer correctly (100% >= 70% passing)
    useQuizStore.getState().submitAnswer('q1', 'A')

    // Seed course so submitQuiz can fetch modules from Dexie
    await db.courses.add({
      id: 'course-1',
      title: 'Test Course',
      shortTitle: 'TC',
      description: '',
      category: 'operative-training',
      difficulty: 'beginner',
      totalLessons: 1,
      totalVideos: 0,
      totalPDFs: 0,
      estimatedHours: 1,
      tags: [],
      modules: mockModules,
      isSequential: false,
      basePath: '/courses/course-1',
      instructorId: 'inst-1',
    } as Course)

    // Mock useContentProgressStore
    const mockSetItemStatus = vi.fn().mockResolvedValue(undefined)
    const { useContentProgressStore } = await import('@/stores/useContentProgressStore')
    useContentProgressStore.setState({ setItemStatus: mockSetItemStatus } as never)

    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })

    expect(mockSetItemStatus).toHaveBeenCalledOnce()
    expect(mockSetItemStatus).toHaveBeenCalledWith('course-1', 'les-5', 'completed', mockModules)
  })

  it('does NOT call setItemStatus when score < passingScore', async () => {
    await setupQuizInProgress('les-6')
    // Answer incorrectly (0% < 70% passing)
    useQuizStore.getState().submitAnswer('q1', 'B')

    const mockSetItemStatus = vi.fn().mockResolvedValue(undefined)
    const { useContentProgressStore } = await import('@/stores/useContentProgressStore')
    useContentProgressStore.setState({ setItemStatus: mockSetItemStatus } as never)

    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })

    expect(mockSetItemStatus).not.toHaveBeenCalled()
  })

  it('reverts state and shows toast on Dexie failure, preserving currentProgress', async () => {
    await setupQuizInProgress('les-7')
    useQuizStore.getState().submitAnswer('q1', 'A')

    // Capture pre-submit progress for comparison
    const progressBefore = useQuizStore.getState().currentProgress

    // Make db.quizAttempts.add throw
    vi.spyOn(db.quizAttempts, 'add').mockRejectedValueOnce(new Error('DB error'))

    const { toast } = await import('sonner')
    const toastWithError = toast as typeof toast & { error: ReturnType<typeof vi.fn> }

    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })

    const state = useQuizStore.getState()
    // State should be rolled back
    expect(state.currentProgress).toEqual(progressBefore)
    expect(state.error).toBe('Failed to save quiz attempt')
    expect(state.isLoading).toBe(false)
    // Toast error should have been shown
    expect(toastWithError.error).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// retakeQuiz
// ---------------------------------------------------------------------------

describe('retakeQuiz', () => {
  it('calls startQuiz internally to reset progress', async () => {
    const quiz = {
      id: 'quiz-rt',
      lessonId: 'les-rt',
      title: 'Retake Quiz',
      description: '',
      questions: [
        {
          id: 'q1',
          order: 1,
          type: 'multiple-choice' as const,
          text: 'Q1',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: '',
          points: 1,
        },
      ],
      timeLimit: null,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2025-01-15T12:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
    }
    await db.quizzes.add(quiz)

    // Add an answer first to ensure retake resets it
    await act(async () => {
      await useQuizStore.getState().startQuiz('les-rt')
    })
    useQuizStore.getState().submitAnswer('q1', 'B')
    expect(useQuizStore.getState().currentProgress?.answers['q1']).toBe('B')

    await act(async () => {
      await useQuizStore.getState().retakeQuiz('les-rt')
    })

    // Progress should be fresh — no answers
    const progress = useQuizStore.getState().currentProgress
    expect(progress?.answers).toEqual({})
    expect(progress?.quizId).toBe('quiz-rt')
  })

  it('resets timeRemaining to quiz timeLimit on retake', async () => {
    const timedQuiz = {
      id: 'quiz-rt-timed',
      lessonId: 'les-rt-timed',
      title: 'Timed Retake Quiz',
      description: '',
      questions: [
        {
          id: 'q1',
          order: 1,
          type: 'multiple-choice' as const,
          text: 'Q1',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: '',
          points: 1,
        },
      ],
      timeLimit: 30,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2025-01-15T12:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
    }
    await db.quizzes.add(timedQuiz)

    // Start and partially use time
    await act(async () => {
      await useQuizStore.getState().startQuiz('les-rt-timed')
    })
    expect(useQuizStore.getState().currentProgress?.timeRemaining).toBe(30)

    // Retake should reset timer
    await act(async () => {
      await useQuizStore.getState().retakeQuiz('les-rt-timed')
    })
    expect(useQuizStore.getState().currentProgress?.timeRemaining).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// resumeQuiz
// ---------------------------------------------------------------------------

describe('resumeQuiz', () => {
  it('is a no-op (persist middleware handles rehydration)', () => {
    // Inject some progress
    useQuizStore.setState({
      currentProgress: {
        quizId: 'quiz-x',
        currentQuestionIndex: 2,
        answers: { q1: 'A' },
        startTime: 1000,
        timeRemaining: null,
        isPaused: false,
        markedForReview: [],
        questionOrder: ['q1'],
        timerAccommodation: 'standard',
      },
    })

    useQuizStore.getState().resumeQuiz()

    // State unchanged — resumeQuiz is a no-op
    const progress = useQuizStore.getState().currentProgress
    expect(progress?.currentQuestionIndex).toBe(2)
    expect(progress?.answers['q1']).toBe('A')
  })
})

// ---------------------------------------------------------------------------
// toggleReviewMark
// ---------------------------------------------------------------------------

describe('toggleReviewMark', () => {
  it('adds questionId when not present', () => {
    useQuizStore.setState({
      currentProgress: {
        quizId: 'q',
        currentQuestionIndex: 0,
        answers: {},
        startTime: 1000,
        timeRemaining: null,
        isPaused: false,
        markedForReview: [],
        questionOrder: ['q1'],
        timerAccommodation: 'standard',
      },
    })

    useQuizStore.getState().toggleReviewMark('q1')
    expect(useQuizStore.getState().currentProgress?.markedForReview).toContain('q1')
  })

  it('removes questionId when already present', () => {
    useQuizStore.setState({
      currentProgress: {
        quizId: 'q',
        currentQuestionIndex: 0,
        answers: {},
        startTime: 1000,
        timeRemaining: null,
        isPaused: false,
        markedForReview: ['q1', 'q2'],
        questionOrder: ['q1', 'q2'],
        timerAccommodation: 'standard',
      },
    })

    useQuizStore.getState().toggleReviewMark('q1')
    expect(useQuizStore.getState().currentProgress?.markedForReview).not.toContain('q1')
    expect(useQuizStore.getState().currentProgress?.markedForReview).toContain('q2')
  })
})

// ---------------------------------------------------------------------------
// loadAttempts
// ---------------------------------------------------------------------------

describe('loadAttempts', () => {
  it('queries Dexie and sets attempts array', async () => {
    const quizId = 'quiz-la'
    await db.quizAttempts.bulkAdd([
      {
        id: 'a1',
        quizId,
        answers: [],
        score: 1,
        percentage: 100,
        passed: true,
        timeSpent: 10000,
        completedAt: '2025-01-15T10:00:00.000Z',
        startedAt: '2025-01-15T09:55:00.000Z',
        timerAccommodation: 'standard' as const,
      },
      {
        id: 'a2',
        quizId,
        answers: [],
        score: 0,
        percentage: 0,
        passed: false,
        timeSpent: 5000,
        completedAt: '2025-01-15T11:00:00.000Z',
        startedAt: '2025-01-15T10:55:00.000Z',
        timerAccommodation: 'standard' as const,
      },
    ])

    await act(async () => {
      await useQuizStore.getState().loadAttempts(quizId)
    })

    const attempts = useQuizStore.getState().attempts
    expect(attempts).toHaveLength(2)
    expect(attempts.map(a => a.id)).toContain('a1')
    expect(attempts.map(a => a.id)).toContain('a2')
  })
})

// ---------------------------------------------------------------------------
// persist partialize
// ---------------------------------------------------------------------------

describe('persist partialize', () => {
  it('serializes currentProgress and currentQuiz to localStorage, not attempts', () => {
    // Verify partialize config — currentQuiz must be persisted alongside
    // currentProgress so browser refresh during active quiz preserves state.
    const persistApi = (
      useQuizStore as unknown as {
        persist: { getOptions: () => { partialize: (s: unknown) => unknown; name: string } }
      }
    ).persist

    expect(persistApi).toBeDefined()

    const options = persistApi.getOptions()
    expect(options.name).toBe('levelup-quiz-store')

    const mockState = {
      currentQuiz: { id: 'quiz-x' } as never,
      currentProgress: { quizId: 'q1' } as never,
      attempts: [{ id: 'a1' }] as never,
      isLoading: false,
      error: null,
    }
    const partial = options.partialize(mockState)
    expect(partial).toEqual({
      currentProgress: { quizId: 'q1' },
      currentQuiz: { id: 'quiz-x' },
    })
  })
})

// ---------------------------------------------------------------------------
// Individual selectors
// ---------------------------------------------------------------------------

describe('individual selectors', () => {
  it('selectCurrentQuiz maps to currentQuiz', async () => {
    const { selectCurrentQuiz } = await import('@/stores/useQuizStore')
    const quiz = {
      id: 'quiz-sel',
      lessonId: 'les-sel',
      title: 'Selector Quiz',
      description: '',
      questions: [],
      timeLimit: null,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2025-01-15T12:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
    }
    useQuizStore.setState({ currentQuiz: quiz })
    expect(selectCurrentQuiz(useQuizStore.getState())).toEqual(quiz)
  })

  it('selectCurrentProgress maps to currentProgress', async () => {
    const { selectCurrentProgress } = await import('@/stores/useQuizStore')
    const progress = {
      quizId: 'quiz-sel',
      currentQuestionIndex: 1,
      answers: { q1: 'A' },
      startTime: 1000,
      timeRemaining: null,
      isPaused: false,
      markedForReview: [],
      questionOrder: ['q1'],
      timerAccommodation: 'standard' as const,
    }
    useQuizStore.setState({ currentProgress: progress })
    expect(selectCurrentProgress(useQuizStore.getState())).toEqual(progress)
  })

  it('selectIsLoading maps to isLoading', async () => {
    const { selectIsLoading } = await import('@/stores/useQuizStore')
    useQuizStore.setState({ isLoading: true })
    expect(selectIsLoading(useQuizStore.getState())).toBe(true)
  })

  it('selectError maps to error', async () => {
    const { selectError } = await import('@/stores/useQuizStore')
    useQuizStore.setState({ error: 'test error' })
    expect(selectError(useQuizStore.getState())).toBe('test error')
  })

  it('selectAttempts maps to attempts', async () => {
    const { selectAttempts } = await import('@/stores/useQuizStore')
    useQuizStore.setState({ attempts: [] })
    expect(selectAttempts(useQuizStore.getState())).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// clearQuiz and clearError
// ---------------------------------------------------------------------------

describe('clearQuiz', () => {
  it('resets all state fields to initial values', () => {
    useQuizStore.setState({
      currentQuiz: { id: 'q' } as never,
      currentProgress: { quizId: 'q' } as never,
      attempts: [{ id: 'a' }] as never,
      error: 'some error',
    })

    useQuizStore.getState().clearQuiz()

    const state = useQuizStore.getState()
    expect(state.currentQuiz).toBeNull()
    expect(state.currentProgress).toBeNull()
    expect(state.attempts).toHaveLength(0)
    expect(state.error).toBeNull()
  })
})

describe('clearError', () => {
  it('clears error without touching other state', () => {
    useQuizStore.setState({ error: 'existing error', isLoading: false })
    useQuizStore.getState().clearError()
    expect(useQuizStore.getState().error).toBeNull()
    expect(useQuizStore.getState().isLoading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// submitAnswer — no-op when no active progress
// ---------------------------------------------------------------------------

describe('submitAnswer — guard', () => {
  it('is a no-op when currentProgress is null', () => {
    useQuizStore.setState({ currentProgress: null })
    useQuizStore.getState().submitAnswer('q1', 'A')
    expect(useQuizStore.getState().currentProgress).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// startQuiz — timeLimit non-null
// ---------------------------------------------------------------------------

describe('startQuiz — timeLimit', () => {
  it('sets timeRemaining to quiz.timeLimit when non-null', async () => {
    const quiz = {
      id: 'quiz-tl',
      lessonId: 'les-tl',
      title: 'Timed Quiz',
      description: '',
      questions: [
        {
          id: 'q1',
          order: 1,
          type: 'multiple-choice' as const,
          text: 'Q1',
          options: ['A'],
          correctAnswer: 'A',
          explanation: '',
          points: 1,
        },
      ],
      timeLimit: 30,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2025-01-15T12:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
    }
    await db.quizzes.add(quiz)
    await act(async () => {
      await useQuizStore.getState().startQuiz('les-tl')
    })
    expect(useQuizStore.getState().currentProgress?.timeRemaining).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// submitQuiz — early return guard
// ---------------------------------------------------------------------------

describe('submitQuiz — guard', () => {
  it('returns early without DB write when no active quiz', async () => {
    useQuizStore.setState({ currentQuiz: null, currentProgress: null })
    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })
    const dbAttempts = await db.quizAttempts.toArray()
    expect(dbAttempts).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// loadAttempts — empty result
// ---------------------------------------------------------------------------

describe('loadAttempts — empty', () => {
  it('sets attempts to empty array when no records match', async () => {
    useQuizStore.setState({ attempts: [{ id: 'stale' }] as never })
    await act(async () => {
      await useQuizStore.getState().loadAttempts('non-existent-quiz')
    })
    expect(useQuizStore.getState().attempts).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// toggleReviewMark — no-op when no active progress
// ---------------------------------------------------------------------------

describe('toggleReviewMark — guard', () => {
  it('is a no-op when currentProgress is null', () => {
    useQuizStore.setState({ currentProgress: null })
    useQuizStore.getState().toggleReviewMark('q1')
    expect(useQuizStore.getState().currentProgress).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// navigateToQuestion
// ---------------------------------------------------------------------------

describe('navigateToQuestion', () => {
  const baseProgress = {
    quizId: 'quiz-nav',
    currentQuestionIndex: 0,
    answers: {},
    startTime: 1000,
    timeRemaining: null,
    isPaused: false,
    markedForReview: [],
    questionOrder: ['q1', 'q2', 'q3'],
    timerAccommodation: 'standard' as const,
  }

  const baseQuiz = {
    id: 'quiz-nav',
    lessonId: 'les-nav',
    title: 'Nav Quiz',
    description: '',
    questions: [
      {
        id: 'q1',
        order: 1,
        type: 'multiple-choice' as const,
        text: 'Q1',
        options: ['A'],
        correctAnswer: 'A',
        explanation: '',
        points: 1,
      },
      {
        id: 'q2',
        order: 2,
        type: 'multiple-choice' as const,
        text: 'Q2',
        options: ['A'],
        correctAnswer: 'A',
        explanation: '',
        points: 1,
      },
      {
        id: 'q3',
        order: 3,
        type: 'multiple-choice' as const,
        text: 'Q3',
        options: ['A'],
        correctAnswer: 'A',
        explanation: '',
        points: 1,
      },
    ],
    timeLimit: null,
    passingScore: 70,
    allowRetakes: true,
    shuffleQuestions: false,
    shuffleAnswers: false,
    createdAt: '2025-01-15T12:00:00.000Z',
    updatedAt: '2025-01-15T12:00:00.000Z',
  }

  it('sets currentQuestionIndex to the given index', () => {
    useQuizStore.setState({ currentQuiz: baseQuiz, currentProgress: baseProgress })
    useQuizStore.getState().navigateToQuestion(2)
    expect(useQuizStore.getState().currentProgress?.currentQuestionIndex).toBe(2)
  })

  it('is a no-op when index < 0', () => {
    useQuizStore.setState({
      currentQuiz: baseQuiz,
      currentProgress: { ...baseProgress, currentQuestionIndex: 1 },
    })
    useQuizStore.getState().navigateToQuestion(-1)
    expect(useQuizStore.getState().currentProgress?.currentQuestionIndex).toBe(1)
  })

  it('is a no-op when index >= questions.length', () => {
    useQuizStore.setState({
      currentQuiz: baseQuiz,
      currentProgress: { ...baseProgress, currentQuestionIndex: 1 },
    })
    useQuizStore.getState().navigateToQuestion(3)
    expect(useQuizStore.getState().currentProgress?.currentQuestionIndex).toBe(1)
  })

  it('is a no-op when no active quiz', () => {
    useQuizStore.setState({ currentQuiz: null, currentProgress: null })
    useQuizStore.getState().navigateToQuestion(1)
    expect(useQuizStore.getState().currentProgress).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// E13-S03: Per-quiz localStorage sync (pause/resume crash recovery)
// ---------------------------------------------------------------------------

describe('per-quiz localStorage sync', () => {
  const syncQuestion = makeQuestion({ id: 'q1' })
  const quizForSync = makeQuiz({
    id: 'quiz-sync',
    lessonId: 'les-sync',
    questions: [syncQuestion],
  })

  it('writes currentProgress to per-quiz localStorage key on submitAnswer', async () => {
    await db.quizzes.add(quizForSync)
    await act(async () => {
      await useQuizStore.getState().startQuiz('les-sync')
    })

    useQuizStore.getState().submitAnswer('q1', 'A')

    const raw = localStorage.getItem('quiz-progress-quiz-sync')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.answers.q1).toBe('A')
    expect(parsed.quizId).toBe('quiz-sync')
  })

  it('clears per-quiz localStorage key on submitQuiz success', async () => {
    await db.quizzes.add({ ...quizForSync, id: 'quiz-sync-2', lessonId: 'les-sync-2' })
    await act(async () => {
      await useQuizStore.getState().startQuiz('les-sync-2')
    })
    useQuizStore.getState().submitAnswer('q1', 'A')

    // Verify key exists before submit
    expect(localStorage.getItem('quiz-progress-quiz-sync-2')).not.toBeNull()

    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })

    // Key should be cleared after successful submission
    expect(localStorage.getItem('quiz-progress-quiz-sync-2')).toBeNull()
  })

  it('clears per-quiz localStorage key on clearQuiz', async () => {
    useQuizStore.setState({
      currentQuiz: quizForSync,
      currentProgress: {
        quizId: 'quiz-sync',
        currentQuestionIndex: 0,
        answers: { q1: 'A' },
        startTime: 1000,
        timeRemaining: null,
        isPaused: false,
        markedForReview: [],
        questionOrder: ['q1'],
        timerAccommodation: 'standard',
      },
    })

    // Subscribe listener should have written the key
    expect(localStorage.getItem('quiz-progress-quiz-sync')).not.toBeNull()

    useQuizStore.getState().clearQuiz()

    expect(localStorage.getItem('quiz-progress-quiz-sync')).toBeNull()
  })
})
