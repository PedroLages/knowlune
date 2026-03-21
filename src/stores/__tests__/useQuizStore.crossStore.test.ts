import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import { makeQuiz, makeQuestion } from '../../../tests/support/fixtures/factories/quiz-factory'
import type { Module } from '@/data/types'

// Mock persistWithRetry — retry logic tested in its own tests
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

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
let useContentProgressStore: (typeof import('@/stores/useContentProgressStore'))['useContentProgressStore']
let db: (typeof import('@/db'))['db']

const COURSE_ID = 'course-1'
const LESSON_ID = 'les-1'
const QUIZ_ID = 'quiz-1'

const testModules: Module[] = [
  {
    id: 'mod-1',
    title: 'Module 1',
    lessons: [{ id: LESSON_ID, title: 'Lesson 1', type: 'video', duration: '10:00' }],
  },
] as Module[]

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()

  const storeMod = await import('@/stores/useQuizStore')
  useQuizStore = storeMod.useQuizStore
  const contentMod = await import('@/stores/useContentProgressStore')
  useContentProgressStore = contentMod.useContentProgressStore
  const dbMod = await import('@/db')
  db = dbMod.db

  vi.clearAllMocks()
})

describe('useQuizStore cross-store integration (E12-S03-AC5)', () => {
  const q1 = makeQuestion({ id: 'q1', correctAnswer: 'Paris' })

  async function seedAndStartPassingQuiz() {
    const quiz = makeQuiz({
      id: QUIZ_ID,
      lessonId: LESSON_ID,
      passingScore: 70,
      questions: [q1],
    })
    await db.quizzes.put(quiz)
    await db.courses.put({
      id: COURSE_ID,
      title: 'Test Course',
      shortTitle: 'TC',
      description: 'A test course',
      category: 'development',
      difficulty: 'beginner',
      totalLessons: 1,
      totalVideos: 1,
      totalPDFs: 0,
      estimatedHours: 1,
      tags: [],
      modules: testModules,
      isSequential: false,
      basePath: '/courses/test',
    } as import('@/data/types').Course)

    await act(async () => {
      await useQuizStore.getState().startQuiz(LESSON_ID)
    })

    return quiz
  }

  it('calls setItemStatus on contentProgressStore when quiz is passed', async () => {
    await seedAndStartPassingQuiz()

    const setItemStatusSpy = vi
      .spyOn(useContentProgressStore.getState(), 'setItemStatus')
      .mockResolvedValue(undefined)

    // Answer correctly (100% >= 70 passingScore → passed)
    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'Paris')
    })

    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    expect(setItemStatusSpy).toHaveBeenCalledOnce()
    expect(setItemStatusSpy).toHaveBeenCalledWith(
      COURSE_ID,
      LESSON_ID,
      'completed',
      testModules
    )

    setItemStatusSpy.mockRestore()
  })

  it('does NOT call setItemStatus when quiz is failed', async () => {
    await seedAndStartPassingQuiz()

    const setItemStatusSpy = vi
      .spyOn(useContentProgressStore.getState(), 'setItemStatus')
      .mockResolvedValue(undefined)

    // Answer incorrectly (0% < 70 passingScore → failed)
    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'London')
    })

    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    expect(setItemStatusSpy).not.toHaveBeenCalled()

    setItemStatusSpy.mockRestore()
  })

  it('quiz attempt is preserved even if setItemStatus throws', async () => {
    await seedAndStartPassingQuiz()

    const setItemStatusSpy = vi
      .spyOn(useContentProgressStore.getState(), 'setItemStatus')
      .mockRejectedValue(new Error('setItemStatus exploded'))

    // Suppress expected console.error from the catch block
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Answer correctly to trigger the passing path
    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'Paris')
    })

    // submitQuiz should NOT throw even though setItemStatus fails
    await act(async () => {
      await useQuizStore.getState().submitQuiz(COURSE_ID)
    })

    // setItemStatus was called (and threw)
    expect(setItemStatusSpy).toHaveBeenCalledOnce()

    // Quiz attempt was still saved to IndexedDB
    const attempts = await db.quizAttempts.where('quizId').equals(QUIZ_ID).toArray()
    expect(attempts).toHaveLength(1)
    expect(attempts[0].passed).toBe(true)
    expect(attempts[0].percentage).toBe(100)

    // Store state reflects the successful attempt
    const state = useQuizStore.getState()
    expect(state.attempts).toHaveLength(1)
    expect(state.attempts[0].passed).toBe(true)
    // currentProgress is cleared on successful submit
    expect(state.currentProgress).toBeNull()
    // No error set on the store (setItemStatus failure is isolated)
    expect(state.error).toBeNull()

    // Console error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useQuizStore] setItemStatus failed after quiz submit:',
      expect.any(Error)
    )

    setItemStatusSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
})
