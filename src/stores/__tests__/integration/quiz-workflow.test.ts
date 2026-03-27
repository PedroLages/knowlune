/**
 * Cross-Store Integration Test: Quiz Workflow
 *
 * Verifies that completing a quiz correctly updates:
 * - useQuizStore (attempt recorded, progress cleared)
 * - useContentProgressStore (lesson marked complete on pass)
 * - useChallengeStore (completion-type challenge progress reflects quiz)
 *
 * Uses real Dexie with fake-indexeddb (no mocks on persistence layer).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { Course, Module, Challenge } from '@/data/types'

// Mock persistWithRetry to pass-through (retry logic tested elsewhere)
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

// Mock sonner to prevent DOM errors
vi.mock('sonner', () => {
  const toastFn = vi.fn() as ReturnType<typeof vi.fn> & {
    error: ReturnType<typeof vi.fn>
    success: ReturnType<typeof vi.fn>
    warning: ReturnType<typeof vi.fn>
  }
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  toastFn.warning = vi.fn()
  return { toast: toastFn }
})

// Mock toastHelpers
vi.mock('@/lib/toastHelpers', () => ({
  toastWithUndo: vi.fn(),
  toastError: {
    deleteFailed: vi.fn(),
    saveFailed: vi.fn(),
    storageFull: vi.fn(),
  },
}))

// Mock progress bridge (uses localStorage directly)
vi.mock('@/lib/progress', () => ({
  markLessonComplete: vi.fn(),
  markLessonIncomplete: vi.fn(),
}))

// Mock quotaResilientStorage for zustand persist middleware
vi.mock('@/lib/quotaResilientStorage', () => ({
  quotaResilientStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  isQuotaExceeded: vi.fn().mockReturnValue(false),
  showThrottledWarning: vi.fn(),
  clearStaleQuizKeys: vi.fn(),
}))

// Mock studyLog (uses localStorage)
vi.mock('@/lib/studyLog', () => ({
  logStudyAction: vi.fn(),
  getStudyLog: vi.fn().mockReturnValue([]),
  toLocalDateString: vi.fn((d: Date) => d.toISOString().split('T')[0]),
}))

// Mock quizPreferences
vi.mock('@/lib/quizPreferences', () => ({
  getQuizPreferences: vi.fn().mockReturnValue({ shuffleQuestions: false }),
}))

// Mock challengeMilestones
vi.mock('@/lib/challengeMilestones', () => ({
  detectChallengeMilestones: vi.fn().mockReturnValue([]),
}))

let useQuizStore: (typeof import('@/stores/useQuizStore'))['useQuizStore']
let useContentProgressStore: (typeof import('@/stores/useContentProgressStore'))['useContentProgressStore']
let useChallengeStore: (typeof import('@/stores/useChallengeStore'))['useChallengeStore']
let db: (typeof import('@/db'))['db']

const COURSE_ID = 'course-quiz-1'
const LESSON_ID = 'lesson-quiz-1'
const QUIZ_ID = 'quiz-1'
const MODULE_ID = 'mod-quiz-1'

const testModules: Module[] = [
  {
    id: MODULE_ID,
    title: 'Module 1',
    description: 'Test module',
    order: 0,
    lessons: [
      {
        id: LESSON_ID,
        title: 'Lesson 1',
        description: 'Test lesson',
        order: 0,
        resources: [],
        keyTopics: [],
        duration: '10:00',
      },
    ],
  },
]

const testCourse: Course = {
  id: COURSE_ID,
  title: 'Quiz Test Course',
  shortTitle: 'QTC',
  description: 'A course for quiz integration testing',
  category: 'research-library',
  difficulty: 'beginner',
  totalLessons: 1,
  totalVideos: 1,
  totalPDFs: 0,
  estimatedHours: 1,
  tags: [],
  modules: testModules,
  isSequential: false,
  basePath: '/courses/quiz-test',
  authorId: 'author-1',
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()

  const dbMod = await import('@/db')
  db = dbMod.db

  const quizStoreMod = await import('@/stores/useQuizStore')
  useQuizStore = quizStoreMod.useQuizStore

  const progressStoreMod = await import('@/stores/useContentProgressStore')
  useContentProgressStore = progressStoreMod.useContentProgressStore

  const challengeStoreMod = await import('@/stores/useChallengeStore')
  useChallengeStore = challengeStoreMod.useChallengeStore

  vi.clearAllMocks()
})

describe('Quiz Workflow: Cross-Store Integration', () => {
  async function seedQuiz(passingScore = 70) {
    const quiz = {
      id: QUIZ_ID,
      lessonId: LESSON_ID,
      title: 'Test Quiz',
      description: 'Integration test quiz',
      questions: [
        {
          id: 'q1',
          order: 1,
          type: 'multiple-choice' as const,
          text: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: '4',
          explanation: '2+2=4',
          points: 1,
        },
      ],
      timeLimit: null,
      passingScore,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2026-03-27T10:00:00.000Z',
      updatedAt: '2026-03-27T10:00:00.000Z',
    }

    await db.quizzes.put(quiz)
    await db.courses.put(testCourse)

    return quiz
  }

  it('passing quiz marks lesson complete in contentProgressStore', async () => {
    await seedQuiz()

    // Start quiz
    await act(async () => {
      await useQuizStore.getState().startQuiz(LESSON_ID)
    })

    expect(useQuizStore.getState().currentQuiz).not.toBeNull()

    // Answer correctly
    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', '4')
    })

    // Submit quiz
    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    // Verify quiz attempt recorded
    const quizState = useQuizStore.getState()
    expect(quizState.attempts).toHaveLength(1)
    expect(quizState.attempts[0].passed).toBe(true)
    expect(quizState.attempts[0].percentage).toBe(100)
    expect(quizState.currentProgress).toBeNull() // cleared after submit

    // Verify content progress updated (cross-store)
    const lessonStatus = useContentProgressStore.getState().getItemStatus(COURSE_ID, LESSON_ID)
    expect(lessonStatus).toBe('completed')

    // Verify attempt persisted to DB
    const dbAttempts = await db.quizAttempts.where('quizId').equals(QUIZ_ID).toArray()
    expect(dbAttempts).toHaveLength(1)
    expect(dbAttempts[0].passed).toBe(true)
  })

  it('failing quiz does NOT mark lesson complete', async () => {
    await seedQuiz()

    // Start quiz
    await act(async () => {
      await useQuizStore.getState().startQuiz(LESSON_ID)
    })

    // Answer incorrectly
    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', '3')
    })

    // Submit quiz
    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    // Verify quiz attempt recorded as failed
    const quizState = useQuizStore.getState()
    expect(quizState.attempts).toHaveLength(1)
    expect(quizState.attempts[0].passed).toBe(false)
    expect(quizState.attempts[0].percentage).toBe(0)

    // Content progress should NOT have been updated
    const lessonStatus = useContentProgressStore.getState().getItemStatus(COURSE_ID, LESSON_ID)
    expect(lessonStatus).toBe('not-started')
  })

  it('quiz completion updates completion-type challenge progress', async () => {
    await seedQuiz()

    // Create a completion challenge that counts completed content items
    const challenge: Challenge = {
      id: 'challenge-1',
      name: 'Complete 5 lessons',
      type: 'completion',
      targetValue: 5,
      deadline: '2026-12-31T23:59:59.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      currentProgress: 0,
      celebratedMilestones: [],
    }
    await db.challenges.add(challenge)

    // Load challenges into store
    await act(async () => {
      await useChallengeStore.getState().loadChallenges()
    })

    expect(useChallengeStore.getState().challenges).toHaveLength(1)

    // Start and pass quiz (which marks lesson complete)
    await act(async () => {
      await useQuizStore.getState().startQuiz(LESSON_ID)
    })

    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', '4')
    })

    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    // Verify lesson is completed
    const lessonStatus = useContentProgressStore.getState().getItemStatus(COURSE_ID, LESSON_ID)
    expect(lessonStatus).toBe('completed')

    // Refresh challenge progress (reads from contentProgress DB)
    await act(async () => {
      await useChallengeStore.getState().refreshAllProgress()
    })

    // Challenge should reflect the completed lesson
    const challenges = useChallengeStore.getState().challenges
    expect(challenges[0].currentProgress).toBeGreaterThanOrEqual(1)
  })

  it('quiz attempt is persisted even if content progress update fails', async () => {
    await seedQuiz()

    // Start quiz
    await act(async () => {
      await useQuizStore.getState().startQuiz(LESSON_ID)
    })

    // Spy on setItemStatus and make it throw
    const setItemStatusSpy = vi
      .spyOn(useContentProgressStore.getState(), 'setItemStatus')
      .mockRejectedValue(new Error('DB write failed'))

    // Suppress expected console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Answer correctly and submit
    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', '4')
    })

    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    // Attempt should still be saved
    const dbAttempts = await db.quizAttempts.where('quizId').equals(QUIZ_ID).toArray()
    expect(dbAttempts).toHaveLength(1)
    expect(dbAttempts[0].passed).toBe(true)

    // Store state should reflect the attempt
    expect(useQuizStore.getState().attempts).toHaveLength(1)
    expect(useQuizStore.getState().error).toBeNull()

    setItemStatusSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('logStudyAction is called with quiz_complete on passing quiz', async () => {
    const { logStudyAction } = await import('@/lib/studyLog')
    await seedQuiz()

    await act(async () => {
      await useQuizStore.getState().startQuiz(LESSON_ID)
    })

    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', '4')
    })

    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    expect(logStudyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'quiz_complete',
        courseId: COURSE_ID,
        lessonId: LESSON_ID,
      })
    )
  })
})
