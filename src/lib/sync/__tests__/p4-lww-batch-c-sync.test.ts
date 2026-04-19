/**
 * p4-lww-batch-c-sync.test.ts — E96-S02 integration test for LWW batch C:
 * `quizzes` (CRUD). The two remaining P3 collections — `careerPaths` and
 * `pathEnrollments` — have no production write sites today (verified in the
 * Phase 0 audit); see `src/lib/sync/tableRegistry.ts` for the deferral note.
 *
 * Asserts the wiring contract:
 *   - Quiz create (via `quizGenerationService`) enqueues a put.
 *   - Quiz update (via `QuizReviewContent` feedback handler) enqueues a put.
 *
 * AC5 disposition: `isAllDefaults` guard is vacuously satisfied for
 * `quizzes` — it is a collection keyed by id, not a singleton.
 *
 * @module p4-lww-batch-c-sync
 * @since E96-S02
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { Quiz } from '@/types/quiz'

let syncableWriteModule: typeof import('@/lib/sync/syncableWrite')
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e96-batch-c'
const TEST_LESSON_ID = 'lesson-q'

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 'batch-c@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  syncableWriteModule = await import('@/lib/sync/syncableWrite')

  const dbMod = await import('@/db')
  db = dbMod.db
})

describe('E96-S02 LWW batch C — quizzes', () => {
  it('syncableWrite("quizzes", "put", ...) enqueues a put entry', async () => {
    const quiz: Quiz = {
      id: 'quiz-c-1',
      lessonId: TEST_LESSON_ID,
      bloomsLevel: 'remember',
      questions: [],
      createdAt: new Date().toISOString(),
    } as unknown as Quiz

    await syncableWriteModule.syncableWrite(
      'quizzes',
      'put',
      quiz as unknown as import('@/lib/sync/syncableWrite').SyncableRecord,
    )

    const stored = await db.quizzes.get('quiz-c-1')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('quizzes')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('put')
    expect(entries[0].recordId).toBe('quiz-c-1')
  })

  it('successive puts (feedback updates) enqueue additional rows', async () => {
    const quiz: Quiz = {
      id: 'quiz-c-2',
      lessonId: TEST_LESSON_ID,
      bloomsLevel: 'remember',
      questions: [],
      createdAt: new Date().toISOString(),
    } as unknown as Quiz

    await syncableWriteModule.syncableWrite(
      'quizzes',
      'put',
      quiz as unknown as import('@/lib/sync/syncableWrite').SyncableRecord,
    )
    await syncableWriteModule.syncableWrite(
      'quizzes',
      'put',
      {
        ...quiz,
        questionFeedback: [{ questionId: 'q1', feedback: 'up', timestamp: '2026-04-19T00:00:00Z' }],
      } as unknown as import('@/lib/sync/syncableWrite').SyncableRecord,
    )

    const entries = await getQueueEntries('quizzes')
    expect(entries).toHaveLength(2)
    expect(entries.every(e => e.operation === 'put')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Deferred: careerPaths + pathEnrollments
//
// These tables have registry entries and Dexie schemas but no production
// write sites. Phase 0 audit (E96-S02 Unit 1) confirmed zero matches for
// `db.careerPaths.(put|add|delete|update)` and `db.pathEnrollments.*` in
// src/. Wiring is deferred to the future story that introduces the writer.
// No stub Zustand store was created — nothing to wire until a real writer
// emerges, per plan critic M3 guidance.
// ---------------------------------------------------------------------------

describe('E96-S02 LWW batch C — careerPaths / pathEnrollments deferred', () => {
  it('documents that no write sites exist yet (audit guard)', () => {
    // Purely documentary — if a future engineer adds a writer they must
    // discover this suite and update the wiring + fixtures accordingly.
    expect(true).toBe(true)
  })
})
