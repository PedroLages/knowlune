import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { Notification } from '@/data/types'

// Mock persistWithRetry to run operation once (no retries).
// Retry logic is tested in persistWithRetry's own tests.
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

// Mock sonner toast for error assertions
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

let useNotificationStore: (typeof import('@/stores/useNotificationStore'))['useNotificationStore']
let db: (typeof import('@/db/schema'))['db']

const FIXED_DATE = new Date('2026-03-23T10:00:00.000Z')
const FIXED_ISO = FIXED_DATE.toISOString()

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: crypto.randomUUID(),
    type: 'course-complete',
    title: 'Course Completed',
    message: 'You finished React 101',
    createdAt: FIXED_ISO,
    readAt: null,
    dismissedAt: null,
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  // Freeze Date.now and new Date() to FIXED_DATE
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_DATE.getTime())
  vi.spyOn(globalThis, 'Date').mockImplementation((...args: ConstructorParameters<typeof Date>) => {
    if (args.length === 0)
      return new (
        vi.mocked(Date).getMockImplementation?.() ?? (Date as unknown as { new (): Date })
      )(FIXED_DATE.getTime())
    // @ts-expect-error -- spread into Date constructor
    return new (Object.getPrototypeOf(FIXED_DATE).constructor)(...args)
  })
  // Restore real Date for internal use but mock the return
  vi.restoreAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_DATE.getTime())

  // Re-mock persistWithRetry after resetModules
  vi.doMock('@/lib/persistWithRetry', () => ({
    persistWithRetry: async (op: () => Promise<void>) => op(),
  }))

  const storeModule = await import('@/stores/useNotificationStore')
  useNotificationStore = storeModule.useNotificationStore
  const dbModule = await import('@/db/schema')
  db = dbModule.db
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('create', () => {
  it('7.1: adds notification to Dexie and updates store state', async () => {
    await useNotificationStore.getState().create({
      type: 'course-complete',
      title: 'Course Done',
      message: 'You finished React 101',
      actionUrl: '/courses/react-101',
    })

    const state = useNotificationStore.getState()
    expect(state.notifications).toHaveLength(1)

    const n = state.notifications[0]
    expect(n.type).toBe('course-complete')
    expect(n.title).toBe('Course Done')
    expect(n.message).toBe('You finished React 101')
    expect(n.actionUrl).toBe('/courses/react-101')
    expect(n.readAt).toBeNull()
    expect(n.dismissedAt).toBeNull()
    // ULID should be 26 chars
    expect(n.id).toHaveLength(26)

    // Verify persisted to Dexie
    const persisted = await db.notifications.get(n.id)
    expect(persisted).toBeDefined()
    expect(persisted!.title).toBe('Course Done')

    // unreadCount should be 1
    expect(state.unreadCount).toBe(1)
  })
})

describe('markRead', () => {
  it('7.2: sets readAt timestamp and decrements unreadCount', async () => {
    const notification = makeNotification()
    await db.notifications.add(notification)
    await useNotificationStore.getState().load()

    expect(useNotificationStore.getState().unreadCount).toBe(1)

    await useNotificationStore.getState().markRead(notification.id)

    const state = useNotificationStore.getState()
    expect(state.notifications[0].readAt).toBeTruthy()
    expect(state.unreadCount).toBe(0)

    // Verify persisted
    const persisted = await db.notifications.get(notification.id)
    expect(persisted!.readAt).toBeTruthy()
  })

  it('7.2: no-ops for already-read notification', async () => {
    const notification = makeNotification({ readAt: FIXED_ISO })
    await db.notifications.add(notification)
    await useNotificationStore.getState().load()

    expect(useNotificationStore.getState().unreadCount).toBe(0)

    await useNotificationStore.getState().markRead(notification.id)

    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })
})

describe('markAllRead', () => {
  it('7.3: sets readAt on all unread notifications', async () => {
    const n1 = makeNotification({ id: 'id-1' })
    const n2 = makeNotification({ id: 'id-2' })
    const n3 = makeNotification({ id: 'id-3', readAt: '2026-03-22T00:00:00.000Z' })
    await db.notifications.bulkAdd([n1, n2, n3])
    await useNotificationStore.getState().load()

    expect(useNotificationStore.getState().unreadCount).toBe(2)

    await useNotificationStore.getState().markAllRead()

    const state = useNotificationStore.getState()
    expect(state.unreadCount).toBe(0)
    state.notifications.forEach(n => {
      expect(n.readAt).not.toBeNull()
    })

    // Verify persisted
    const persisted1 = await db.notifications.get('id-1')
    expect(persisted1!.readAt).toBeTruthy()
  })

  it('7.3: no-ops when no unread notifications exist', async () => {
    const n = makeNotification({ readAt: FIXED_ISO })
    await db.notifications.add(n)
    await useNotificationStore.getState().load()

    await useNotificationStore.getState().markAllRead()

    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })
})

describe('dismiss', () => {
  it('7.4: sets dismissedAt and removes from active list', async () => {
    const n1 = makeNotification({ id: 'keep-id' })
    const n2 = makeNotification({ id: 'dismiss-id' })
    await db.notifications.bulkAdd([n1, n2])
    await useNotificationStore.getState().load()

    expect(useNotificationStore.getState().notifications).toHaveLength(2)
    expect(useNotificationStore.getState().unreadCount).toBe(2)

    await useNotificationStore.getState().dismiss('dismiss-id')

    const state = useNotificationStore.getState()
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0].id).toBe('keep-id')
    expect(state.unreadCount).toBe(1)

    // Verify persisted (soft-delete, not hard-delete)
    const persisted = await db.notifications.get('dismiss-id')
    expect(persisted).toBeDefined()
    expect(persisted!.dismissedAt).toBeTruthy()
  })

  it('7.4: dismissing a read notification does not affect unreadCount', async () => {
    const n = makeNotification({ id: 'read-dismiss', readAt: FIXED_ISO })
    await db.notifications.add(n)
    await useNotificationStore.getState().load()

    expect(useNotificationStore.getState().unreadCount).toBe(0)

    await useNotificationStore.getState().dismiss('read-dismiss')

    expect(useNotificationStore.getState().unreadCount).toBe(0)
    expect(useNotificationStore.getState().notifications).toHaveLength(0)
  })
})

describe('TTL cleanup', () => {
  it('7.5: removes notifications older than 30 days', async () => {
    const thirtyOneDaysAgo = new Date(FIXED_DATE.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const recent = makeNotification({ id: 'recent' })
    const expired = makeNotification({ id: 'expired', createdAt: thirtyOneDaysAgo })
    await db.notifications.bulkAdd([recent, expired])

    await useNotificationStore.getState().cleanup()

    const remaining = await db.notifications.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('recent')
  })
})

describe('cap cleanup', () => {
  it('7.6: keeps only newest 100 notifications', async () => {
    // Create 110 notifications with incrementing timestamps
    const notifications: Notification[] = []
    for (let i = 0; i < 110; i++) {
      const ts = new Date(FIXED_DATE.getTime() - (110 - i) * 60000).toISOString()
      notifications.push(
        makeNotification({
          id: `n-${String(i).padStart(3, '0')}`,
          createdAt: ts,
        })
      )
    }
    await db.notifications.bulkAdd(notifications)

    await useNotificationStore.getState().cleanup()

    const remaining = await db.notifications.count()
    expect(remaining).toBe(100)

    // Verify the 10 oldest were removed
    const oldest = await db.notifications.get('n-000')
    expect(oldest).toBeUndefined()

    // Newest should still exist
    const newest = await db.notifications.get('n-109')
    expect(newest).toBeDefined()
  })
})

describe('cleanup performance', () => {
  it('7.7: completes in < 50ms for 120 records', async () => {
    // Create 120 notifications: 30 expired + 90 current
    const notifications: Notification[] = []
    const thirtyOneDaysAgo = FIXED_DATE.getTime() - 31 * 24 * 60 * 60 * 1000
    for (let i = 0; i < 30; i++) {
      notifications.push(
        makeNotification({
          id: `expired-${i}`,
          createdAt: new Date(thirtyOneDaysAgo - i * 60000).toISOString(),
        })
      )
    }
    for (let i = 0; i < 90; i++) {
      notifications.push(
        makeNotification({
          id: `current-${i}`,
          createdAt: new Date(FIXED_DATE.getTime() - i * 60000).toISOString(),
        })
      )
    }
    await db.notifications.bulkAdd(notifications)

    const start = performance.now()
    await useNotificationStore.getState().cleanup()
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)

    // After cleanup: 30 expired deleted, 90 remain (under 100 cap)
    const remaining = await db.notifications.count()
    expect(remaining).toBe(90)
  })
})
