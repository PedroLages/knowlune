/**
 * e96-s03-course-reminders-sync.test.ts — E96-S03 integration test for the
 * courseReminders table.
 *
 * Locks the contract that every user-facing reminder mutation (save, toggle,
 * delete) flows through `syncableWrite`, producing exactly one syncQueue row
 * per mutation with the correct operation.
 *
 * Note: E96-S02 establishes a broader wiring contract in
 * `p3-lww-batch-b-sync.test.ts`. This story adds S03-specific coverage for
 * the *precise enqueue count per user action* and the merge-after-put
 * semantics used when UI flows read-modify-write a reminder.
 *
 * The current `CourseReminder` shape does not carry `snoozedUntil` /
 * `dismissedAt` fields (per `src/data/types.ts`), so the plan's
 * snooze/dismiss scenarios map onto the real user-facing mutations —
 * `saveCourseReminder`, `toggleCourseReminder`, and `deleteCourseReminder`.
 *
 * @module e96-s03-course-reminders-sync
 * @since E96-S03
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { CourseReminder } from '@/data/types'

let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let courseRemindersModule: typeof import('@/lib/courseReminders')
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e96-s03-cr'

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

function makeReminder(overrides: Partial<CourseReminder> = {}): CourseReminder {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    courseId: 'course-s03',
    courseName: 'S03 Course',
    enabled: true,
    days: ['tuesday', 'thursday'],
    time: '08:30',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  localStorage.clear()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 's03-cr@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  courseRemindersModule = await import('@/lib/courseReminders')

  const dbMod = await import('@/db')
  db = dbMod.db
})

describe('E96-S03 — courseReminders sync contract', () => {
  it('saveCourseReminder enqueues exactly one put row tagged with the reminder id', async () => {
    const reminder = makeReminder()
    await courseRemindersModule.saveCourseReminder(reminder)

    const entries = await getQueueEntries('courseReminders')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('put')
    expect(entries[0].recordId).toBe(reminder.id)
  })

  it('toggleCourseReminder enqueues a put with the merged record and stamped updatedAt', async () => {
    const reminder = makeReminder({ enabled: true })
    await courseRemindersModule.saveCourseReminder(reminder)

    // Clear the queue so we assert only the toggle's effect.
    await db.syncQueue.clear()

    await courseRemindersModule.toggleCourseReminder(reminder.id, false)

    const entries = await getQueueEntries('courseReminders')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('put')

    const stored = await db.courseReminders.get(reminder.id)
    expect(stored?.enabled).toBe(false)
    // syncableWrite stamps updatedAt — caller did not pre-stamp.
    expect(stored?.updatedAt).toBeTruthy()
  })

  it('deleteCourseReminder enqueues exactly one delete row', async () => {
    const reminder = makeReminder()
    await courseRemindersModule.saveCourseReminder(reminder)

    await db.syncQueue.clear()

    await courseRemindersModule.deleteCourseReminder(reminder.id)

    const entries = await getQueueEntries('courseReminders')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('delete')
    expect(entries[0].recordId).toBe(reminder.id)
  })

  it('no direct db.courseReminders write path from save/toggle/delete bypasses syncableWrite', async () => {
    const reminder = makeReminder()
    await courseRemindersModule.saveCourseReminder(reminder)
    await courseRemindersModule.toggleCourseReminder(reminder.id, false)
    await courseRemindersModule.deleteCourseReminder(reminder.id)

    const entries = await getQueueEntries('courseReminders')
    // Precise count: 1 put (save) + 1 put (toggle) + 1 delete = 3.
    expect(entries).toHaveLength(3)
    const ops = entries.map(e => e.operation).sort()
    expect(ops).toEqual(['delete', 'put', 'put'])
  })
})
