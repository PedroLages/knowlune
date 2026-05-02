/**
 * Unit tests for useNotificationPrefsStore — notification preferences with
 * Dexie persistence + Supabase sync via `syncableWrite` (E95-S06).
 *
 * Covers: init, setTypeEnabled, setQuietHours, hydrateFromRemote,
 *         isTypeEnabled, isInQuietHours — plus syncQueue assertions.
 *
 * @since E106-S01
 * @modified E95-S06 — wired through syncableWrite; added hydrateFromRemote tests
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { NotificationType } from '@/data/types'

// Mock toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

// Mock the syncEngine nudge so the fake-indexeddb-only env does not spin up
// a real engine / network layer during unit tests.
vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: { nudge: vi.fn() },
}))

let useNotificationPrefsStore: (typeof import('@/stores/useNotificationPrefsStore'))['useNotificationPrefsStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db/schema'))['db']

/** Seed the auth store with a user id so syncableWrite enqueues queue entries. */
function signIn(userId = 'user-1') {
  useAuthStore.setState({
    user: {
      id: userId,
      email: 'test@example.com',
    } as unknown as import('@supabase/supabase-js').User,
  })
}

/** Clear the auth store so syncableWrite treats the session as anonymous. */
function signOut() {
  useAuthStore.setState({ user: null })
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  vi.doMock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  }))
  vi.doMock('@/lib/sync/syncEngine', () => ({
    syncEngine: { nudge: vi.fn() },
  }))
  const storeModule = await import('@/stores/useNotificationPrefsStore')
  useNotificationPrefsStore = storeModule.useNotificationPrefsStore
  const authModule = await import('@/stores/useAuthStore')
  useAuthStore = authModule.useAuthStore
  const dbModule = await import('@/db/schema')
  db = dbModule.db
  // Start signed-out — individual tests opt in via signIn()
  signOut()
})

describe('initial state', () => {
  it('starts with defaults and isLoaded false', () => {
    const state = useNotificationPrefsStore.getState()
    expect(state.isLoaded).toBe(false)
    expect(state.prefs.courseComplete).toBe(true)
    expect(state.prefs.quietHoursEnabled).toBe(false)
  })
})

describe('init', () => {
  it('writes defaults to Dexie when no existing prefs (authenticated)', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()

    const state = useNotificationPrefsStore.getState()
    expect(state.isLoaded).toBe(true)
    expect(state.prefs.courseComplete).toBe(true)

    const record = await db.notificationPreferences.get('singleton')
    expect(record).toBeDefined()
    expect(record!.courseComplete).toBe(true)

    // syncableWrite stamps userId + updatedAt on the Dexie row
    expect((record as unknown as { userId?: string }).userId).toBe('user-1')
    expect(typeof record!.updatedAt).toBe('string')
  })

  it('enqueues a syncQueue entry with user_id (not id) in payload', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()

    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(1)
    expect(queue[0].tableName).toBe('notificationPreferences')
    expect(queue[0].operation).toBe('put')
    // fieldMap { id: 'user_id' } translation produces user_id, not id
    expect(queue[0].payload).toHaveProperty('user_id', 'singleton')
    expect(queue[0].payload).not.toHaveProperty('id')
    expect(queue[0].payload).toHaveProperty('course_complete', true)
    expect(queue[0].payload).toHaveProperty('quiet_hours_enabled', false)
  })

  it('writes Dexie but skips queue when anonymous (null userId)', async () => {
    signOut()
    await useNotificationPrefsStore.getState().init()

    const record = await db.notificationPreferences.get('singleton')
    expect(record).toBeDefined()
    expect(record!.courseComplete).toBe(true)

    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(0)
  })

  it('loads existing prefs from Dexie', async () => {
    await db.notificationPreferences.put({
      id: 'singleton',
      courseComplete: false,
      streakMilestone: true,
      importFinished: true,
      achievementUnlocked: true,
      reviewDue: true,
      srsDue: true,
      knowledgeDecay: true,
      recommendationMatch: true,
      milestoneApproaching: true,
      bookImported: true,
      bookDeleted: true,
      highlightReview: true,
      quietHoursEnabled: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '06:00',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    await useNotificationPrefsStore.getState().init()

    const state = useNotificationPrefsStore.getState()
    expect(state.isLoaded).toBe(true)
    expect(state.prefs.courseComplete).toBe(false)
    expect(state.prefs.quietHoursEnabled).toBe(true)
    expect(state.prefs.quietHoursStart).toBe('23:00')
  })

  it('handles DB error gracefully — falls through with defaults', async () => {
    vi.spyOn(db.notificationPreferences, 'get').mockRejectedValueOnce(new Error('DB fail'))

    await useNotificationPrefsStore.getState().init()

    expect(useNotificationPrefsStore.getState().isLoaded).toBe(true)
    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(true)
  })
})

describe('setTypeEnabled', () => {
  it('toggles a notification type off (authenticated → enqueues)', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    await db.syncQueue.clear()

    await useNotificationPrefsStore.getState().setTypeEnabled('course-complete', false)

    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(false)

    const record = await db.notificationPreferences.get('singleton')
    expect(record!.courseComplete).toBe(false)

    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(1)
    expect(queue[0].payload).toHaveProperty('course_complete', false)
    // After init has run, `next` is sourced from Dexie (via re-read) and
    // carries the `userId` stamp from syncableWrite. `toSnakeCase` converts
    // `userId` → `user_id` (auto) and the fieldMap `id → user_id` maps the
    // singleton key to the same column; iteration order means the real auth
    // UUID wins, which is exactly what Supabase RLS expects on upsert.
    expect(queue[0].payload).toHaveProperty('user_id', 'user-1')
  })

  it('does NOT stamp a manual updatedAt on the next record (syncableWrite stamps it)', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    const storedBefore = await db.notificationPreferences.get('singleton')
    const beforeStamp = storedBefore!.updatedAt

    // Tick one millisecond so the new stamp is strictly greater.
    await new Promise(r => setTimeout(r, 2))
    await useNotificationPrefsStore.getState().setTypeEnabled('course-complete', false)

    const storedAfter = await db.notificationPreferences.get('singleton')
    expect(storedAfter!.updatedAt > beforeStamp).toBe(true)
  })

  it('toggles a notification type on', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setTypeEnabled('streak-milestone', false)
    await useNotificationPrefsStore.getState().setTypeEnabled('streak-milestone', true)

    expect(useNotificationPrefsStore.getState().prefs.streakMilestone).toBe(true)
  })

  it('handles unknown type gracefully', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    const before = { ...useNotificationPrefsStore.getState().prefs }

    await useNotificationPrefsStore
      .getState()
      .setTypeEnabled('unknown-type' as NotificationType, false)

    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(before.courseComplete)
  })

  it('shows toast on DB failure', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    // `syncableWrite` routes puts through `db.table(name).put(...)`, which is
    // a distinct reference from `db.notificationPreferences.put`. Spy on the
    // `db.table(...)` accessor path so the mock intercepts the real call.
    vi.spyOn(db.table('notificationPreferences'), 'put').mockRejectedValueOnce(
      new Error('Write fail')
    )
    const { toast } = await import('sonner')

    await useNotificationPrefsStore.getState().setTypeEnabled('course-complete', false)

    expect(toast.error).toHaveBeenCalledWith('Failed to update notification preference')
  })
})

describe('setQuietHours', () => {
  it('enables quiet hours with start and end (enqueues snake_case payload)', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    await db.syncQueue.clear()

    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    })

    const prefs = useNotificationPrefsStore.getState().prefs
    expect(prefs.quietHoursEnabled).toBe(true)
    expect(prefs.quietHoursStart).toBe('22:00')
    expect(prefs.quietHoursEnd).toBe('07:00')

    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(1)
    expect(queue[0].payload).toMatchObject({
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
    })
  })

  it('rejects invalid HH:MM format for start', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    const before = { ...useNotificationPrefsStore.getState().prefs }

    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursStart: '25:00',
    })

    expect(useNotificationPrefsStore.getState().prefs.quietHoursStart).toBe(before.quietHoursStart)
  })

  it('rejects invalid HH:MM format for end', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    const before = { ...useNotificationPrefsStore.getState().prefs }

    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnd: '12:60',
    })

    expect(useNotificationPrefsStore.getState().prefs.quietHoursEnd).toBe(before.quietHoursEnd)
  })

  it('shows toast on DB failure', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    vi.spyOn(db.table('notificationPreferences'), 'put').mockRejectedValueOnce(
      new Error('Write fail')
    )
    const { toast } = await import('sonner')

    await useNotificationPrefsStore.getState().setQuietHours({ quietHoursEnabled: true })

    expect(toast.error).toHaveBeenCalledWith('Failed to update quiet hours')
  })
})

describe('hydrateFromRemote (E95-S06)', () => {
  it('replaces in-memory prefs with the provided remote snapshot', () => {
    const remote = {
      id: 'singleton' as const,
      courseComplete: false,
      streakMilestone: false,
      importFinished: true,
      achievementUnlocked: true,
      reviewDue: true,
      srsDue: true,
      knowledgeDecay: true,
      recommendationMatch: true,
      milestoneApproaching: true,
      bookImported: true,
      bookDeleted: true,
      highlightReview: true,
      quietHoursEnabled: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '06:00',
      updatedAt: '2026-04-19T00:00:00.000Z',
    }

    useNotificationPrefsStore.getState().hydrateFromRemote(remote)

    const state = useNotificationPrefsStore.getState()
    expect(state.isLoaded).toBe(true)
    expect(state.prefs.courseComplete).toBe(false)
    expect(state.prefs.streakMilestone).toBe(false)
    expect(state.prefs.quietHoursEnabled).toBe(true)
    expect(state.prefs.quietHoursStart).toBe('23:00')
  })

  it('is a pure setter — does NOT write to Dexie or the sync queue (no echo-loop)', async () => {
    // Critic-flagged invariant: hydration from a remote snapshot must not
    // generate a syncQueue entry. Otherwise every sign-in on every device
    // would echo the remote row back through the upload engine, producing
    // an O(N) queue-write amplification per device and per hydration cycle.
    signIn()
    const remote = {
      id: 'singleton' as const,
      courseComplete: false,
      streakMilestone: true,
      importFinished: true,
      achievementUnlocked: true,
      reviewDue: true,
      srsDue: true,
      knowledgeDecay: true,
      recommendationMatch: true,
      milestoneApproaching: true,
      bookImported: true,
      bookDeleted: true,
      highlightReview: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      updatedAt: '2026-04-19T00:00:00.000Z',
    }

    useNotificationPrefsStore.getState().hydrateFromRemote(remote)

    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(0)

    // Dexie row is also untouched by hydrateFromRemote (no .put was called).
    const record = await db.notificationPreferences.get('singleton')
    expect(record).toBeUndefined()
  })
})

describe('isTypeEnabled', () => {
  it('returns true for enabled types', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    expect(useNotificationPrefsStore.getState().isTypeEnabled('course-complete')).toBe(true)
  })

  it('returns false for disabled types', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setTypeEnabled('course-complete', false)
    expect(useNotificationPrefsStore.getState().isTypeEnabled('course-complete')).toBe(false)
  })

  it('returns true for unknown type (safe default)', () => {
    expect(useNotificationPrefsStore.getState().isTypeEnabled('unknown' as NotificationType)).toBe(
      true
    )
  })
})

describe('isInQuietHours', () => {
  it('returns false when quiet hours disabled', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    expect(useNotificationPrefsStore.getState().isInQuietHours()).toBe(false)
  })

  it('returns false when start equals end', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '22:00',
    })

    expect(useNotificationPrefsStore.getState().isInQuietHours()).toBe(false)
  })

  it('detects when inside all-day quiet hours window', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnabled: true,
      quietHoursStart: '00:00',
      quietHoursEnd: '23:59',
    })

    expect(useNotificationPrefsStore.getState().isInQuietHours()).toBe(true)
  })

  it('detects midnight-spanning window that covers all times', async () => {
    signIn()
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnabled: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '22:59',
    })

    expect(useNotificationPrefsStore.getState().isInQuietHours()).toBe(true)
  })
})
