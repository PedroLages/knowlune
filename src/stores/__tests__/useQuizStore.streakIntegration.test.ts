/**
 * E18-S05: Quiz completion → study streak integration
 *
 * Tests the fire-and-forget pattern: submitQuiz logs study activity after
 * a successful DB write, and streak logging failures never block submission.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import { makeQuiz, makeQuestion } from '../../../tests/support/fixtures/factories/quiz-factory'
// Module type import removed (E89-S01)

// Module-level spy — referenced by the vi.mock factory below so every
// dynamic re-import of the quiz store still sees the same function object.
const mockLogStudyAction = vi.fn()

vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

vi.mock('@/lib/studyLog', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/studyLog')>()
  return { ...actual, logStudyAction: mockLogStudyAction }
})

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

let useQuizStore: (typeof import('@/stores/useQuizStore'))['useQuizStore']
let db: (typeof import('@/db'))['db']

const COURSE_ID = 'course-streak-test'
const LESSON_ID = 'les-streak-1'
const QUIZ_ID = 'quiz-streak-1'

// testModules removed (E89-S01) — courses table dropped

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()

  const storeMod = await import('@/stores/useQuizStore')
  useQuizStore = storeMod.useQuizStore
  const dbMod = await import('@/db')
  db = dbMod.db

  vi.clearAllMocks()
})

async function seedAndStartQuiz(passingScore = 70) {
  const q1 = makeQuestion({ id: 'q1', correctAnswer: 'Paris' })
  const quiz = makeQuiz({ id: QUIZ_ID, lessonId: LESSON_ID, passingScore, questions: [q1] })
  await db.quizzes.put(quiz)
  // Courses table dropped (E89-S01) — no course seeding needed

  await act(async () => {
    await useQuizStore.getState().startQuiz(LESSON_ID)
  })
  return quiz
}

describe('useQuizStore streak integration (E18-S05)', () => {
  it('calls logStudyAction with quiz_complete after successful submit', async () => {
    await seedAndStartQuiz()

    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'Paris')
    })
    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    // Assert the quiz_complete call specifically — other stores (e.g. progress.ts via
    // setItemStatus) may also call logStudyAction, so we check type rather than call count.
    expect(mockLogStudyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'quiz_complete',
        courseId: COURSE_ID,
        lessonId: LESSON_ID,
        timestamp: expect.any(String),
        metadata: expect.objectContaining({ passed: true }),
      })
    )
  })

  it('calls logStudyAction even when quiz is failed (not passed)', async () => {
    await seedAndStartQuiz()

    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'London') // wrong answer
    })
    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    expect(mockLogStudyAction).toHaveBeenCalledOnce()
    expect(mockLogStudyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'quiz_complete',
        metadata: expect.objectContaining({ passed: false }),
      })
    )
  })

  it('streak logging failure does not block quiz submission', async () => {
    await seedAndStartQuiz()

    // Throw only when the quiz_complete action fires — other stores (progress.ts)
    // may also call logStudyAction with different types and should not be affected.
    mockLogStudyAction.mockImplementation((action: { type: string }) => {
      if (action.type === 'quiz_complete') throw new Error('localStorage full')
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'Paris')
    })
    // submitQuiz must not throw even though logStudyAction throws
    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    // Quiz attempt persisted to IndexedDB
    const attempts = await db.quizAttempts.where('quizId').equals(QUIZ_ID).toArray()
    expect(attempts).toHaveLength(1)

    // Store state is correct — submission succeeded
    const state = useQuizStore.getState()
    expect(state.currentProgress).toBeNull()
    expect(state.error).toBeNull()
    expect(state.attempts).toHaveLength(1)

    // Error was logged (non-blocking)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useQuizStore] streak logging failed (non-blocking):',
      expect.any(Error)
    )

    mockLogStudyAction.mockReset()
    consoleErrorSpy.mockRestore()
  })

  it('does not call logStudyAction when DB write fails', async () => {
    await seedAndStartQuiz()

    // Simulate DB failure — E96-S02 routes quiz attempts through
    // syncableWrite; mock that instead of the raw Dexie table.
    const syncMod = await import('@/lib/sync/syncableWrite')
    vi.spyOn(syncMod, 'syncableWrite').mockRejectedValueOnce(
      new Error('IndexedDB quota exceeded')
    )

    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'Paris')
    })
    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    // logStudyAction should NOT be called — the quiz attempt failed
    expect(mockLogStudyAction).not.toHaveBeenCalled()

    // Store rolled back to error state
    expect(useQuizStore.getState().error).toBe('Failed to save quiz attempt')
  })
})
