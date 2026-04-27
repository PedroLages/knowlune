/**
 * p0-sync.test.ts — E92-S09 integration test for the three P0 sync tables.
 *
 * Verifies the end-to-end wiring inside the app:
 *   Store mutation → syncableWrite → Dexie write + syncQueue entry → nudge.
 *
 * Scope note: AC9 of E92-S09 originally specified a live-Supabase Playwright
 * E2E spec at `tests/sync/p0-sync.spec.ts`. Knowlune does not yet have a
 * `.env.test` Supabase project or a sign-in helper for Playwright (E92-S08
 * landed without one — see story Dev Notes). Rather than block S09 on
 * missing infrastructure, this vitest spec exercises the exact wiring S09 is
 * responsible for: that writes to `contentProgress`, `studySessions`, and
 * `progress` route through `syncableWrite` and produce syncQueue entries
 * with the correct `tableName`, `operation`, and monotonic semantics.
 *
 * The live-Supabase assertions (upload + cross-device download) remain a
 * follow-up for the sync-infra story that provisions the test project.
 *
 * @module p0-sync
 * @since E92-S09
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { Module } from '@/data/types'

let useContentProgressStore: (typeof import('@/stores/useContentProgressStore'))['useContentProgressStore']
let useSessionStore: (typeof import('@/stores/useSessionStore'))['useSessionStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e92-s09'

const modules: Module[] = [
  {
    id: 'mod-1',
    title: 'Module 1',
    description: '',
    order: 1,
    lessons: [
      { id: 'les-1', title: 'Lesson 1', description: '', order: 1, resources: [], keyTopics: [] },
      { id: 'les-2', title: 'Lesson 2', description: '', order: 2, resources: [], keyTopics: [] },
    ],
  },
]

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  // Seed a signed-in user so syncableWrite enqueues upload entries.
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 'test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const contentMod = await import('@/stores/useContentProgressStore')
  useContentProgressStore = contentMod.useContentProgressStore

  const sessionMod = await import('@/stores/useSessionStore')
  useSessionStore = sessionMod.useSessionStore

  const dbMod = await import('@/db')
  db = dbMod.db
})

describe('E92-S09 P0 sync wiring — contentProgress', () => {
  it('setItemStatus produces a syncQueue entry for contentProgress with correct metadata', async () => {
    await useContentProgressStore
      .getState()
      .setItemStatus('course-1', 'les-1', 'completed', modules)

    // Dexie row exists + stamped with userId/updatedAt by syncableWrite.
    const stored = await db.contentProgress.where({ courseId: 'course-1' }).toArray()
    const lesson = stored.find(r => r.itemId === 'les-1')
    expect(lesson).toBeDefined()
    expect(lesson?.status).toBe('completed')
    expect((lesson as unknown as { userId: string }).userId).toBe(TEST_USER_ID)

    // Queue entries: one for the lesson + one for the cascaded module.
    const queue = await db.syncQueue.toArray()
    const cpEntries = queue.filter(q => q.tableName === 'contentProgress')
    expect(cpEntries.length).toBeGreaterThanOrEqual(2)
    for (const entry of cpEntries) {
      expect(entry.operation).toBe('put')
      expect(entry.status).toBe('pending')
      expect(entry.payload).toMatchObject({ course_id: 'course-1' })
    }
  })

  it('unauthenticated writes still persist to Dexie but do NOT enqueue', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    await useContentProgressStore
      .getState()
      .setItemStatus('course-2', 'les-1', 'in-progress', modules)

    const stored = await db.contentProgress.where({ courseId: 'course-2' }).toArray()
    expect(stored.length).toBeGreaterThan(0)

    const queue = await db.syncQueue.toArray()
    const cpEntries = queue.filter(q => q.tableName === 'contentProgress')
    expect(cpEntries).toHaveLength(0)
  })
})

describe('E92-S09 P0 sync wiring — studySessions (INSERT-only)', () => {
  it('start+end produces exactly one syncQueue entry with the terminal session state', async () => {
    await useSessionStore.getState().startSession('course-1', 'les-1', 'video')
    const started = useSessionStore.getState().activeSession
    expect(started).not.toBeNull()

    // While active: no queue entries yet (local-only state).
    let queue = await db.syncQueue.toArray()
    expect(queue.filter(q => q.tableName === 'studySessions')).toHaveLength(0)

    useSessionStore.getState().endSession()
    // endSession persists asynchronously via persistWithRetry; yield a tick.
    await new Promise(resolve => setTimeout(resolve, 30))

    queue = await db.syncQueue.toArray()
    const sessionEntries = queue.filter(q => q.tableName === 'studySessions')
    expect(sessionEntries).toHaveLength(1)
    expect(sessionEntries[0].operation).toBe('put')
    expect(sessionEntries[0].payload).toMatchObject({ id: started!.id })
    // End-time set by endSession → serialized into the payload.
    expect(sessionEntries[0].payload).toHaveProperty('end_time')
  })
})

describe('E92-S09 P0 sync wiring — progress (monotonic)', () => {
  it('writes route through syncableWrite and produce put queue entries', async () => {
    // Simulate PdfContent.handlePageChange calling syncableWrite directly
    // via the same path the components take.
    const { syncableWrite } = await import('@/lib/sync/syncableWrite')

    await syncableWrite('progress', 'put', {
      courseId: 'course-1',
      videoId: 'pdf-1',
      currentTime: 0,
      completionPercentage: 0,
      durationSeconds: 0,
      currentPage: 5,
    })

    await syncableWrite('progress', 'put', {
      courseId: 'course-1',
      videoId: 'pdf-1',
      currentTime: 0,
      completionPercentage: 0,
      durationSeconds: 0,
      currentPage: 12,
    })

    const queue = await db.syncQueue.toArray()
    const progressEntries = queue.filter(q => q.tableName === 'progress')
    // Two put entries — the monotonic merge happens server-side in the
    // upsert_video_progress() RPC, not client-side. S09 only guarantees
    // the writes reach the queue; the upload engine (E92-S05) handles the
    // monotonic merge against Supabase.
    expect(progressEntries).toHaveLength(2)
    expect(progressEntries[0].operation).toBe('put')
    expect(progressEntries[0].payload).toMatchObject({
      course_id: 'course-1',
      video_id: 'pdf-1',
      watched_seconds: 0,
      duration_seconds: 0,
    })
  })
})
