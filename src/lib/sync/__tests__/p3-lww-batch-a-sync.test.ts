/**
 * p3-lww-batch-a-sync.test.ts — E96-S02 integration test for LWW batch A:
 * `learningPaths`, `learningPathEntries`, `studySchedules`.
 *
 * Asserts the wiring contract:
 *   - Every mutation path enqueues a syncQueue row through syncableWrite.
 *   - `hydrateFromRemote` is a pure setter — it writes Dexie via `bulkPut`
 *     and MUST NOT enqueue any syncQueue row (echo-loop regression guard).
 *
 * AC5 disposition (isAllDefaults guard): vacuously satisfied for all three
 * tables — they are collections keyed by `id`, not singletons.
 *
 * @module p3-lww-batch-a-sync
 * @since E96-S02
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { LearningPath, LearningPathEntry, StudySchedule, DayOfWeek } from '@/data/types'

let useLearningPathStore: (typeof import('@/stores/useLearningPathStore'))['useLearningPathStore']
let useStudyScheduleStore: (typeof import('@/stores/useStudyScheduleStore'))['useStudyScheduleStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e96-batch-a'

vi.mock('@/lib/auth/supabase', () => ({
  supabase: null,
}))

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  vi.doMock('@/lib/auth/supabase', () => ({ supabase: null }))

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 'batch-a@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const lpMod = await import('@/stores/useLearningPathStore')
  useLearningPathStore = lpMod.useLearningPathStore

  const ssMod = await import('@/stores/useStudyScheduleStore')
  useStudyScheduleStore = ssMod.useStudyScheduleStore

  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// learningPaths + learningPathEntries
// ---------------------------------------------------------------------------

describe('E96-S02 LWW batch A — learningPaths + learningPathEntries', () => {
  it('createPath enqueues a syncQueue add entry for learningPaths', async () => {
    const path = await useLearningPathStore.getState().createPath('Test Path', 'Desc')

    const stored = await db.learningPaths.get(path.id)
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('learningPaths')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('add')
    expect(entries[0].recordId).toBe(path.id)
  })

  it('renamePath enqueues a syncQueue put entry for learningPaths', async () => {
    const path = await useLearningPathStore.getState().createPath('Original')
    await useLearningPathStore.getState().renamePath(path.id, 'Renamed')

    const entries = await getQueueEntries('learningPaths')
    // one add from createPath + one put from renamePath
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.recordId).toBe(path.id)
  })

  it('addCourseToPath enqueues add for learningPathEntries + put for learningPaths', async () => {
    const path = await useLearningPathStore.getState().createPath('Path')
    await useLearningPathStore
      .getState()
      .addCourseToPath(path.id, 'course-abc', 'imported', 'justify')

    const entryQueue = await getQueueEntries('learningPathEntries')
    expect(entryQueue.some(e => e.operation === 'add')).toBe(true)

    const pathQueue = await getQueueEntries('learningPaths')
    // createPath add + addCourseToPath put
    expect(pathQueue.some(e => e.operation === 'put')).toBe(true)
  })

  it('deletePath enqueues delete for learningPaths and each learningPathEntries row', async () => {
    const path = await useLearningPathStore.getState().createPath('Path')
    await useLearningPathStore.getState().addCourseToPath(path.id, 'c1', 'imported')
    await useLearningPathStore.getState().addCourseToPath(path.id, 'c2', 'imported')

    // Snapshot queue length before delete to isolate delete-specific entries.
    const beforeEntries = await getQueueEntries('learningPathEntries')
    const beforePaths = await getQueueEntries('learningPaths')

    await useLearningPathStore.getState().deletePath(path.id)

    const afterEntries = await getQueueEntries('learningPathEntries')
    const afterPaths = await getQueueEntries('learningPaths')

    // Two entry deletes (one per enrolled course) + one path delete.
    const newEntryDeletes = afterEntries.length - beforeEntries.length
    const newPathDeletes = afterPaths.length - beforePaths.length
    expect(newEntryDeletes).toBe(2)
    expect(newPathDeletes).toBe(1)
    expect(afterEntries.filter(e => e.operation === 'delete')).toHaveLength(2)
    expect(afterPaths.find(e => e.operation === 'delete' && e.recordId === path.id)).toBeDefined()
  })

  it('hydrateFromRemote writes Dexie via bulkPut and does NOT enqueue any syncQueue row', async () => {
    const now = new Date().toISOString()
    const remotePath: LearningPath = {
      id: 'remote-path-1',
      name: 'Remote Path',
      createdAt: now,
      updatedAt: now,
      isAIGenerated: false,
    }
    const remoteEntry: LearningPathEntry = {
      id: 'remote-entry-1',
      pathId: 'remote-path-1',
      courseId: 'remote-course-1',
      courseType: 'imported',
      position: 1,
      isManuallyOrdered: false,
    }

    await useLearningPathStore
      .getState()
      .hydrateFromRemote({ paths: [remotePath], entries: [remoteEntry] })

    // Dexie has the rows.
    const storedPath = await db.learningPaths.get('remote-path-1')
    expect(storedPath).toBeDefined()
    const storedEntry = await db.learningPathEntries.get('remote-entry-1')
    expect(storedEntry).toBeDefined()

    // In-memory cache reflects them.
    expect(useLearningPathStore.getState().paths.find(p => p.id === 'remote-path-1')).toBeDefined()
    expect(
      useLearningPathStore.getState().entries.find(e => e.id === 'remote-entry-1')
    ).toBeDefined()

    // Critical echo-loop guard: syncQueue must be empty (no add* was called).
    const pathQueue = await getQueueEntries('learningPaths')
    const entryQueue = await getQueueEntries('learningPathEntries')
    expect(pathQueue).toHaveLength(0)
    expect(entryQueue).toHaveLength(0)
  })

  it('hydrateFromRemote([]) is a no-op (does not clobber local state)', async () => {
    const path = await useLearningPathStore.getState().createPath('Local')
    const queueBefore = (await db.syncQueue.toArray()).length

    await useLearningPathStore.getState().hydrateFromRemote({ paths: [], entries: [] })

    expect(useLearningPathStore.getState().paths.find(p => p.id === path.id)).toBeDefined()
    const queueAfter = (await db.syncQueue.toArray()).length
    expect(queueAfter).toBe(queueBefore)
  })
})

// ---------------------------------------------------------------------------
// studySchedules
// ---------------------------------------------------------------------------

describe('E96-S02 LWW batch A — studySchedules', () => {
  function makeScheduleInput(
    overrides: Partial<Omit<StudySchedule, 'id' | 'createdAt' | 'updatedAt'>> = {}
  ) {
    return {
      title: 'Morning Study',
      days: ['monday'] as DayOfWeek[],
      startTime: '09:00',
      durationMinutes: 60,
      recurrence: 'weekly',
      reminderMinutes: 15,
      enabled: true,
      timezone: 'UTC',
      ...overrides,
    } as Omit<StudySchedule, 'id' | 'createdAt' | 'updatedAt'>
  }

  it('addSchedule enqueues a syncQueue add entry', async () => {
    const result = await useStudyScheduleStore.getState().addSchedule(makeScheduleInput())
    expect(result).toBeDefined()

    const entries = await getQueueEntries('studySchedules')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('add')
    expect(entries[0].recordId).toBe(result!.id)
  })

  it('updateSchedule enqueues a syncQueue put entry', async () => {
    const result = await useStudyScheduleStore.getState().addSchedule(makeScheduleInput())
    await useStudyScheduleStore.getState().updateSchedule(result!.id, { title: 'Updated' })

    const entries = await getQueueEntries('studySchedules')
    const put = entries.find(e => e.operation === 'put')
    expect(put).toBeDefined()
    expect(put!.recordId).toBe(result!.id)
  })

  it('deleteSchedule enqueues a syncQueue delete entry', async () => {
    const result = await useStudyScheduleStore.getState().addSchedule(makeScheduleInput())
    await useStudyScheduleStore.getState().deleteSchedule(result!.id)

    const entries = await getQueueEntries('studySchedules')
    const del = entries.find(e => e.operation === 'delete')
    expect(del).toBeDefined()
    expect(del!.recordId).toBe(result!.id)
  })

  it('hydrateFromRemote writes Dexie via bulkPut and does NOT enqueue any syncQueue row', async () => {
    const remote: StudySchedule = {
      id: 'sched-remote-1',
      title: 'Remote',
      days: ['tuesday'],
      startTime: '10:00',
      durationMinutes: 45,
      recurrence: 'weekly',
      reminderMinutes: 10,
      enabled: true,
      timezone: 'UTC',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await useStudyScheduleStore.getState().hydrateFromRemote([remote])

    const stored = await db.studySchedules.get('sched-remote-1')
    expect(stored).toBeDefined()
    expect(
      useStudyScheduleStore.getState().schedules.find(s => s.id === 'sched-remote-1')
    ).toBeDefined()

    // Echo-loop guard.
    const entries = await getQueueEntries('studySchedules')
    expect(entries).toHaveLength(0)
  })
})
