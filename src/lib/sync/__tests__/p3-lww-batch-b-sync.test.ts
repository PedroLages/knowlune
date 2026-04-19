/**
 * p3-lww-batch-b-sync.test.ts — E96-S02 integration test for LWW batch B:
 * `challenges`, `courseReminders`, `notifications`.
 *
 * Asserts the wiring contract:
 *   - Every mutation path enqueues a syncQueue row through syncableWrite.
 *   - `hydrateFromRemote` / `hydrateCourseRemindersFromRemote` are pure
 *     setters — they write Dexie via `bulkPut` and MUST NOT enqueue any
 *     syncQueue row (echo-loop regression guard per E93 retrospective).
 *
 * `challenges` uses `conflictStrategy: 'monotonic'` on
 * `monotonicFields: ['currentProgress']`; the upload engine enforces
 * monotonicity — call sites do nothing special.
 *
 * AC5 disposition: vacuously satisfied for all three tables — they are
 * collections keyed by id, not singletons.
 *
 * @module p3-lww-batch-b-sync
 * @since E96-S02
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { Challenge, CourseReminder, Notification } from '@/data/types'

let useChallengeStore: (typeof import('@/stores/useChallengeStore'))['useChallengeStore']
let useNotificationStore: (typeof import('@/stores/useNotificationStore'))['useNotificationStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let courseRemindersModule: typeof import('@/lib/courseReminders')
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e96-batch-b'

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
    user: { id: TEST_USER_ID, email: 'batch-b@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const chMod = await import('@/stores/useChallengeStore')
  useChallengeStore = chMod.useChallengeStore
  useChallengeStore.setState({ challenges: [], error: null, isLoading: false })

  const notifMod = await import('@/stores/useNotificationStore')
  useNotificationStore = notifMod.useNotificationStore

  courseRemindersModule = await import('@/lib/courseReminders')

  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// challenges (monotonic conflict strategy, registry-driven)
// ---------------------------------------------------------------------------

describe('E96-S02 LWW batch B — challenges', () => {
  it('addChallenge enqueues a syncQueue add entry for challenges', async () => {
    await useChallengeStore.getState().addChallenge({
      name: 'Streak 7',
      type: 'study_streak',
      targetValue: 7,
      deadline: '2026-12-31T00:00:00.000Z',
    })

    const entries = await getQueueEntries('challenges')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('add')
  })

  it('deleteChallenge enqueues a syncQueue delete entry for challenges', async () => {
    await useChallengeStore.getState().addChallenge({
      name: 'To delete',
      type: 'study_streak',
      targetValue: 5,
      deadline: '2026-12-31T00:00:00.000Z',
    })
    const challengeId = useChallengeStore.getState().challenges[0].id
    await useChallengeStore.getState().deleteChallenge(challengeId)

    const entries = await getQueueEntries('challenges')
    const del = entries.find(e => e.operation === 'delete')
    expect(del).toBeDefined()
    expect(del!.recordId).toBe(challengeId)
  })

  it('hydrateFromRemote writes Dexie via bulkPut and does NOT enqueue any syncQueue row', async () => {
    const remote: Challenge = {
      id: 'challenge-remote-1',
      name: 'Remote Challenge',
      type: 'study_streak',
      targetValue: 10,
      deadline: '2026-12-31T00:00:00.000Z',
      createdAt: new Date().toISOString(),
      currentProgress: 3,
      celebratedMilestones: [],
    }

    await useChallengeStore.getState().hydrateFromRemote([remote])

    const stored = await db.challenges.get('challenge-remote-1')
    expect(stored).toBeDefined()
    expect(
      useChallengeStore.getState().challenges.find(c => c.id === 'challenge-remote-1')
    ).toBeDefined()

    // Critical echo-loop guard.
    const entries = await getQueueEntries('challenges')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// courseReminders (helper module, not a Zustand store)
// ---------------------------------------------------------------------------

describe('E96-S02 LWW batch B — courseReminders', () => {
  function makeReminder(overrides: Partial<CourseReminder> = {}): CourseReminder {
    return {
      id: crypto.randomUUID(),
      courseId: 'course-1',
      courseName: 'Course One',
      enabled: true,
      days: ['monday', 'wednesday'],
      time: '09:00',
      updatedAt: new Date().toISOString(),
      ...overrides,
    }
  }

  it('saveCourseReminder enqueues a syncQueue put entry', async () => {
    const reminder = makeReminder()
    await courseRemindersModule.saveCourseReminder(reminder)

    const entries = await getQueueEntries('courseReminders')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('put')
    expect(entries[0].recordId).toBe(reminder.id)
  })

  it('deleteCourseReminder enqueues a syncQueue delete entry', async () => {
    const reminder = makeReminder()
    await courseRemindersModule.saveCourseReminder(reminder)
    await courseRemindersModule.deleteCourseReminder(reminder.id)

    const entries = await getQueueEntries('courseReminders')
    const del = entries.find(e => e.operation === 'delete')
    expect(del).toBeDefined()
    expect(del!.recordId).toBe(reminder.id)
  })

  it('toggleCourseReminder enqueues a syncQueue put entry with merged record', async () => {
    const reminder = makeReminder({ enabled: true })
    await courseRemindersModule.saveCourseReminder(reminder)
    await courseRemindersModule.toggleCourseReminder(reminder.id, false)

    const stored = await db.courseReminders.get(reminder.id)
    expect(stored?.enabled).toBe(false)

    const entries = await getQueueEntries('courseReminders')
    // One save put + one toggle put.
    expect(entries.filter(e => e.operation === 'put')).toHaveLength(2)
  })

  it('hydrateCourseRemindersFromRemote writes Dexie via bulkPut and does NOT enqueue any syncQueue row', async () => {
    const remote = makeReminder({ id: 'reminder-remote-1' })
    await courseRemindersModule.hydrateCourseRemindersFromRemote([remote])

    const stored = await db.courseReminders.get('reminder-remote-1')
    expect(stored).toBeDefined()

    // Echo-loop guard.
    const entries = await getQueueEntries('courseReminders')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

describe('E96-S02 LWW batch B — notifications', () => {
  it('create enqueues a syncQueue add entry for notifications', async () => {
    await useNotificationStore.getState().create({
      type: 'course-complete',
      title: 'Nice',
      message: 'Keep going',
    })

    const entries = await getQueueEntries('notifications')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('add')
  })

  it('markRead enqueues a syncQueue put entry for notifications', async () => {
    await useNotificationStore.getState().create({
      type: 'course-complete',
      title: 'N',
      message: 'm',
    })
    const id = useNotificationStore.getState().notifications[0].id
    await useNotificationStore.getState().markRead(id)

    const entries = await getQueueEntries('notifications')
    const put = entries.find(e => e.operation === 'put')
    expect(put).toBeDefined()
    expect(put!.recordId).toBe(id)
  })

  it('dismiss enqueues a syncQueue put entry for notifications', async () => {
    await useNotificationStore.getState().create({
      type: 'course-complete',
      title: 'N',
      message: 'm',
    })
    const id = useNotificationStore.getState().notifications[0].id
    await useNotificationStore.getState().dismiss(id)

    const entries = await getQueueEntries('notifications')
    // create add + dismiss put.
    const put = entries.find(e => e.operation === 'put')
    expect(put).toBeDefined()
    expect(put!.recordId).toBe(id)
  })

  it('hydrateFromRemote writes Dexie via bulkPut and does NOT enqueue any syncQueue row', async () => {
    const remote: Notification = {
      id: 'notif-remote-1',
      type: 'course-complete',
      title: 'Remote',
      message: 'From server',
      createdAt: new Date().toISOString(),
      readAt: null,
      dismissedAt: null,
    }

    await useNotificationStore.getState().hydrateFromRemote([remote])

    const stored = await db.notifications.get('notif-remote-1')
    expect(stored).toBeDefined()
    expect(
      useNotificationStore.getState().notifications.find(n => n.id === 'notif-remote-1')
    ).toBeDefined()

    // Echo-loop guard.
    const entries = await getQueueEntries('notifications')
    expect(entries).toHaveLength(0)
  })
})
