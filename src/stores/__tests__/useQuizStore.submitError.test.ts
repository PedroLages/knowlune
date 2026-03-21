import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import { makeQuiz, makeQuestion } from '../../../tests/support/fixtures/factories/quiz-factory'

// Mock persistWithRetry to reject — overridden per-test via mockImplementation
const mockPersistWithRetry = vi.fn()
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: (...args: unknown[]) => mockPersistWithRetry(...args),
}))

// Mock sonner (required by toastHelpers)
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

// Mock toastHelpers to spy on toastError.saveFailed
const mockSaveFailed = vi.fn()
vi.mock('@/lib/toastHelpers', () => ({
  toastError: {
    saveFailed: (...args: unknown[]) => mockSaveFailed(...args),
    storageFull: vi.fn(),
  },
  toastSuccess: { saved: vi.fn() },
}))

// Mock useContentProgressStore
const mockSetItemStatus = vi.fn()
vi.mock('@/stores/useContentProgressStore', () => ({
  useContentProgressStore: {
    getState: () => ({
      setItemStatus: mockSetItemStatus,
    }),
  },
}))

let useQuizStore: (typeof import('@/stores/useQuizStore'))['useQuizStore']
let db: (typeof import('@/db'))['db']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()

  // Re-import after resetModules so mocks take effect on fresh module instances
  const storeMod = await import('@/stores/useQuizStore')
  useQuizStore = storeMod.useQuizStore
  const dbMod = await import('@/db')
  db = dbMod.db

  vi.clearAllMocks()
})

describe('useQuizStore submitQuiz error handling', () => {
  const q1 = makeQuestion({ id: 'q1', correctAnswer: 'Paris' })
  const q2 = makeQuestion({ id: 'q2', correctAnswer: 'Berlin' })

  async function seedQuizInProgress() {
    const quiz = makeQuiz({
      id: 'quiz-err-1',
      lessonId: 'les-err-1',
      questions: [q1, q2],
      passingScore: 70,
    })
    await db.quizzes.put(quiz)

    // Start quiz to populate currentQuiz + currentProgress
    await act(async () => {
      await useQuizStore.getState().startQuiz('les-err-1')
    })

    // Submit answers so currentProgress.answers is populated
    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'Paris')
      useQuizStore.getState().submitAnswer('q2', 'Berlin')
    })

    return quiz
  }

  it('rolls back state when persistWithRetry throws', async () => {
    await seedQuizInProgress()

    const stateBefore = useQuizStore.getState()
    const snapshotQuiz = stateBefore.currentQuiz
    const snapshotProgress = stateBefore.currentProgress

    // Make persistWithRetry reject (simulates all retries exhausted)
    mockPersistWithRetry.mockRejectedValueOnce(new Error('Dexie write failed'))

    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })

    const stateAfter = useQuizStore.getState()

    // Rollback: currentQuiz and currentProgress restored to snapshot
    expect(stateAfter.currentQuiz).toEqual(snapshotQuiz)
    expect(stateAfter.currentProgress).toEqual(snapshotProgress)
    expect(stateAfter.isLoading).toBe(false)
    expect(stateAfter.error).toBe('Failed to save quiz attempt')
  })

  it('shows error toast when Dexie write fails after retries', async () => {
    await seedQuizInProgress()

    mockPersistWithRetry.mockRejectedValueOnce(new Error('QuotaExceededError'))

    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })

    expect(mockSaveFailed).toHaveBeenCalledTimes(1)
    // When error is an Error instance, the message is passed as details
    expect(mockSaveFailed).toHaveBeenCalledWith('QuotaExceededError')
  })

  it('preserves currentProgress answers after error', async () => {
    await seedQuizInProgress()

    const answersBefore = { ...useQuizStore.getState().currentProgress!.answers }
    expect(Object.keys(answersBefore).length).toBe(2)

    mockPersistWithRetry.mockRejectedValueOnce(new Error('Write failed'))

    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })

    const answersAfter = useQuizStore.getState().currentProgress?.answers
    expect(answersAfter).toEqual(answersBefore)
    expect(answersAfter).toHaveProperty('q1', 'Paris')
    expect(answersAfter).toHaveProperty('q2', 'Berlin')
  })

  it('does not call cross-store setItemStatus on failure', async () => {
    await seedQuizInProgress()

    mockPersistWithRetry.mockRejectedValueOnce(new Error('DB error'))

    await act(async () => {
      await useQuizStore.getState().submitQuiz('course-1')
    })

    expect(mockSetItemStatus).not.toHaveBeenCalled()
  })
})
