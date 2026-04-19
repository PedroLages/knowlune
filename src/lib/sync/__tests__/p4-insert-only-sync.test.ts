/**
 * p4-insert-only-sync.test.ts — E96-S02 integration test for P4 insert-only tables.
 *
 * Verifies end-to-end wiring for append-only analytics tables:
 *   Call site → syncableWrite → Dexie write + syncQueue entry (operation: 'add')
 *
 * Insert-only tables (per `tableRegistry.ts`):
 *   - `quizAttempts` — written from `useQuizStore.submitQuiz`
 *   - `aiUsageEvents` — written from `lib/aiEventTracking.trackAIUsage`
 *
 * These tables have `conflictStrategy: 'insert-only'` + `insertOnly: true` on
 * the registry entry, which the upload engine (E92-S05) reads to force
 * `INSERT ... ON CONFLICT DO NOTHING`. Call sites use the normal 'add'
 * operation — no call-site flag required.
 *
 * AC5 (isAllDefaults guard) is vacuously satisfied for both tables —
 * they are append-only ledgers, not singletons; no hydrate path exists.
 *
 * @module p4-insert-only-sync
 * @since E96-S02
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { AIUsageEvent, Quiz } from '@/data/types'
import type { QuizAttempt } from '@/types/quiz'

let useQuizStore: (typeof import('@/stores/useQuizStore'))['useQuizStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let trackAIUsage: (typeof import('@/lib/aiEventTracking'))['trackAIUsage']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e96-s02'
const TEST_COURSE_ID = 'course-p4'
const TEST_LESSON_ID = 'lesson-p4'
const TEST_QUIZ_ID = 'quiz-p4'

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  // AI analytics must be enabled so trackAIUsage does not early-return.
  // Default is 'enabled' unless a persisted setting disables it.
  localStorage.clear()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 'p4-test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const quizMod = await import('@/stores/useQuizStore')
  useQuizStore = quizMod.useQuizStore

  const trackMod = await import('@/lib/aiEventTracking')
  trackAIUsage = trackMod.trackAIUsage

  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// quizAttempts — insert-only ledger (written by useQuizStore.submitQuiz)
// ---------------------------------------------------------------------------

describe('E96-S02 P4 sync wiring — quizAttempts (insert-only)', () => {
  async function seedAndSubmit(): Promise<QuizAttempt | undefined> {
    // Seed a quiz directly (not via syncableWrite — we only care about the
    // attempt being enqueued here).
    const quiz: Quiz = {
      id: TEST_QUIZ_ID,
      lessonId: TEST_LESSON_ID,
      bloomsLevel: 'remember',
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'Pick A',
          choices: ['A', 'B'],
          correctAnswer: 'A',
          explanation: '',
        },
      ],
      createdAt: new Date().toISOString(),
    } as unknown as Quiz
    await db.quizzes.put(quiz)

    await useQuizStore.getState().startQuiz(TEST_LESSON_ID)
    useQuizStore.getState().submitAnswer('q1', 'A')
    await useQuizStore.getState().submitQuiz(TEST_COURSE_ID)

    return useQuizStore.getState().attempts[0]
  }

  it('submitQuiz produces exactly one syncQueue add entry for quizAttempts', async () => {
    const attempt = await seedAndSubmit()
    expect(attempt).toBeDefined()

    const stored = await db.quizAttempts.get(attempt!.id)
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('quizAttempts')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('add')
    expect(entries[0].status).toBe('pending')
    expect(entries[0].recordId).toBe(attempt!.id)
  })

  it('contract — no update/delete entry points for quizAttempts exist on useQuizStore', () => {
    // Insert-only tables must not expose mutation beyond create.
    const state = useQuizStore.getState() as unknown as Record<string, unknown>
    expect(state.updateQuizAttempt).toBeUndefined()
    expect(state.deleteQuizAttempt).toBeUndefined()
    expect(state.updateAttempt).toBeUndefined()
    expect(state.deleteAttempt).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// aiUsageEvents — insert-only ledger (written by trackAIUsage)
// ---------------------------------------------------------------------------

describe('E96-S02 P4 sync wiring — aiUsageEvents (insert-only)', () => {
  it('trackAIUsage produces exactly one syncQueue add entry for aiUsageEvents', async () => {
    await trackAIUsage('summary', {
      courseId: TEST_COURSE_ID,
      durationMs: 123,
      metadata: { unit: 'test' },
    })

    const all = await db.aiUsageEvents.toArray()
    expect(all).toHaveLength(1)
    expect((all[0] as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('aiUsageEvents')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('add')
    expect(entries[0].status).toBe('pending')
    expect(entries[0].recordId).toBe((all[0] as AIUsageEvent).id)
  })

  it('contract — aiEventTracking module exports only trackAIUsage (no update/delete helpers)', async () => {
    const mod = await import('@/lib/aiEventTracking')
    const exportedNames = Object.keys(mod)
    // Guard against any future update*/delete* helpers creeping in.
    for (const name of exportedNames) {
      expect(name.toLowerCase()).not.toContain('update')
      expect(name.toLowerCase()).not.toContain('delete')
    }
  })
})
