// Audit (E96-S03 Unit 3): All notification mutations (create/markRead/markAllRead/dismiss) confirmed routed through syncableWrite in E96-S02. Mutator names: create, markRead, markAllRead, dismiss (not addNotification).

/**
 * e96-s03-notifications-sync.test.ts — E96-S03 integration test for the
 * notifications table.
 *
 * Locks the contract that:
 *   - `create` enqueues one add row (with `readAt: null`).
 *   - `markRead` enqueues one put row carrying `readAt` set.
 *   - `markAllRead` with N unread enqueues N put rows (coalescing is
 *     explicitly deferred per plan §Key Technical Decisions).
 *   - `dismiss` enqueues one put row with `dismissedAt` set.
 *   - Hydrate path does not double-enqueue (echo-loop guard per E93
 *     retrospective).
 *
 * Pattern reference: `p3-lww-batch-b-sync.test.ts`.
 *
 * @module e96-s03-notifications-sync
 * @since E96-S03
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { Notification } from '@/data/types'

let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let useNotificationStore: (typeof import('@/stores/useNotificationStore'))['useNotificationStore']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e96-s03-notif'

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  localStorage.clear()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 's03-notif@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const notifMod = await import('@/stores/useNotificationStore')
  useNotificationStore = notifMod.useNotificationStore

  const dbMod = await import('@/db')
  db = dbMod.db
})

describe('E96-S03 — notifications sync contract', () => {
  it('create enqueues exactly one add row and stores readAt:null', async () => {
    await useNotificationStore.getState().create({
      type: 'course-complete',
      title: 'Done',
      message: 'Good work',
    })

    const visible = useNotificationStore.getState().notifications
    expect(visible).toHaveLength(1)
    expect(visible[0].readAt).toBeNull()

    const entries = await getQueueEntries('notifications')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('add')
    expect(entries[0].recordId).toBe(visible[0].id)
  })

  it('markRead enqueues exactly one put row with readAt set', async () => {
    await useNotificationStore.getState().create({
      type: 'course-complete',
      title: 'N',
      message: 'm',
    })
    const id = useNotificationStore.getState().notifications[0].id

    await db.syncQueue.clear()

    await useNotificationStore.getState().markRead(id)

    const entries = await getQueueEntries('notifications')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('put')
    expect(entries[0].recordId).toBe(id)

    const stored = await db.notifications.get(id)
    expect(stored?.readAt).toBeTruthy()
  })

  it('markAllRead with 3 unread enqueues 3 put rows (one per record, no coalescing)', async () => {
    // Seed three unread notifications.
    for (let i = 0; i < 3; i++) {
      await useNotificationStore.getState().create({
        type: 'course-complete',
        title: `N${i}`,
        message: `m${i}`,
      })
    }

    await db.syncQueue.clear()

    await useNotificationStore.getState().markAllRead()

    const entries = await getQueueEntries('notifications')
    expect(entries).toHaveLength(3)
    expect(entries.every(e => e.operation === 'put')).toBe(true)

    const rows = await db.notifications.toArray()
    expect(rows.every(n => n.readAt !== null)).toBe(true)

    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('dismiss enqueues exactly one put row with dismissedAt set', async () => {
    await useNotificationStore.getState().create({
      type: 'course-complete',
      title: 'N',
      message: 'm',
    })
    const id = useNotificationStore.getState().notifications[0].id

    await db.syncQueue.clear()

    await useNotificationStore.getState().dismiss(id)

    const entries = await getQueueEntries('notifications')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('put')
    expect(entries[0].recordId).toBe(id)

    const stored = await db.notifications.get(id)
    expect(stored?.dismissedAt).toBeTruthy()
  })

  it('hydrateFromRemote does not enqueue any row (echo-loop guard)', async () => {
    const remote: Notification = {
      id: 'notif-remote-s03',
      type: 'course-complete',
      title: 'Remote',
      message: 'From server',
      createdAt: new Date().toISOString(),
      readAt: null,
      dismissedAt: null,
    }

    await useNotificationStore.getState().hydrateFromRemote([remote])

    const entries = await getQueueEntries('notifications')
    expect(entries).toHaveLength(0)
  })
})
