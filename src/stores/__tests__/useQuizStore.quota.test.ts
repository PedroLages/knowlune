import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import { makeQuiz, makeQuestion } from '../../../tests/support/fixtures/factories/quiz-factory'

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

const origSetItem = Storage.prototype.setItem
const origGetItem = Storage.prototype.getItem

let useQuizStore: (typeof import('@/stores/useQuizStore'))['useQuizStore']
let db: (typeof import('@/db'))['db']
let _resetWarningThrottle: (typeof import('@/lib/quotaResilientStorage'))['_resetWarningThrottle']
let toast: ReturnType<typeof vi.fn> & {
  warning: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()

  const storeMod = await import('@/stores/useQuizStore')
  useQuizStore = storeMod.useQuizStore
  const dbMod = await import('@/db')
  db = dbMod.db
  const storageMod = await import('@/lib/quotaResilientStorage')
  _resetWarningThrottle = storageMod._resetWarningThrottle
  const sonnerMod = await import('sonner')
  toast = sonnerMod.toast as unknown as typeof toast

  _resetWarningThrottle()
  vi.clearAllMocks()
})

afterEach(() => {
  Storage.prototype.setItem = origSetItem
  Storage.prototype.getItem = origGetItem
})

describe('useQuizStore subscriber quota handling', () => {
  async function seedAndStartQuiz() {
    const quiz = makeQuiz({
      id: 'quiz-1',
      lessonId: 'les-1',
      questions: [makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' })],
    })
    await db.quizzes.put(quiz)

    await act(async () => {
      await useQuizStore.getState().startQuiz('les-1')
    })

    return quiz
  }

  it('falls back to sessionStorage when localStorage throws QuotaExceededError on subscriber write', async () => {
    await seedAndStartQuiz()

    // Now make localStorage throw on quiz-progress-* writes.
    // The subscriber writes to `quiz-progress-{id}` keys specifically.
    // The persist middleware writes to `levelup-quiz-store` key via the adapter.
    // We only need to throw for the subscriber's key pattern.
    const sessionWrites: Array<[string, string]> = []
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (this === localStorage && key.startsWith('quiz-progress-')) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      // Track sessionStorage writes for assertion
      if (this === sessionStorage && key.startsWith('quiz-progress-')) {
        sessionWrites.push([key, value])
      }
      origSetItem.call(this, key, value)
    }

    // Verify the quiz is started and has progress
    const stateBeforeAnswer = useQuizStore.getState()
    expect(stateBeforeAnswer.currentQuiz).not.toBeNull()
    expect(stateBeforeAnswer.currentProgress).not.toBeNull()

    // Answer a question — triggers subscriber which writes to quiz-progress-*
    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'a')
    })

    // Verify the answer was recorded in state
    const stateAfterAnswer = useQuizStore.getState()
    expect(stateAfterAnswer.currentProgress?.answers).toHaveProperty('q1', 'a')

    // Subscriber should have fallen back to sessionStorage
    expect(sessionWrites.length).toBeGreaterThan(0)
    const [, writtenValue] = sessionWrites.find(([k]) => k === 'quiz-progress-quiz-1')!
    const parsed = JSON.parse(writtenValue)
    expect(parsed.answers).toHaveProperty('q1', 'a')
  })

  it('shows throttled warning toast on subscriber quota error', async () => {
    await seedAndStartQuiz()

    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (this === localStorage && key.startsWith('quiz-progress-')) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      origSetItem.call(this, key, value)
    }

    // First answer — triggers subscriber which hits quota, calls showThrottledWarning
    await act(async () => {
      useQuizStore.getState().submitAnswer('q1', 'a')
    })
    // toast.warning may have been called by persist middleware too (via adapter),
    // so check it was called at least once
    expect(toast.warning).toHaveBeenCalled()
    const callCountAfterFirst = (toast.warning as ReturnType<typeof vi.fn>).mock.calls.length

    // Second answer within throttle window — no new toast from subscriber
    await act(async () => {
      useQuizStore.getState().submitAnswer('q2', 'b')
    })
    // Should NOT have increased — throttle prevents duplicate toasts
    expect(toast.warning).toHaveBeenCalledTimes(callCountAfterFirst)
  })
})
