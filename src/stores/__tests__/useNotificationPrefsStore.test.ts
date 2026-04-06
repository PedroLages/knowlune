/**
 * Unit tests for useNotificationPrefsStore — notification preferences with Dexie persistence.
 *
 * Tests init, setTypeEnabled, setQuietHours, isTypeEnabled, and isInQuietHours.
 *
 * @since E106-S01
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { NotificationType } from '@/data/types'

const FIXED_DATE = new Date('2026-03-23T10:00:00.000Z')

// Mock persistWithRetry to just execute the operation directly
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: vi.fn(async (op: () => Promise<void>) => op()),
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

let useNotificationPrefsStore: (typeof import('@/stores/useNotificationPrefsStore'))['useNotificationPrefsStore']
let db: (typeof import('@/db/schema'))['db']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  // Re-apply mocks after module reset
  vi.doMock('@/lib/persistWithRetry', () => ({
    persistWithRetry: vi.fn(async (op: () => Promise<void>) => op()),
  }))
  vi.doMock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  }))
  const storeModule = await import('@/stores/useNotificationPrefsStore')
  useNotificationPrefsStore = storeModule.useNotificationPrefsStore
  const dbModule = await import('@/db/schema')
  db = dbModule.db
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
  it('writes defaults to Dexie when no existing prefs', async () => {
    await useNotificationPrefsStore.getState().init()

    const state = useNotificationPrefsStore.getState()
    expect(state.isLoaded).toBe(true)
    expect(state.prefs.courseComplete).toBe(true)

    // Verify Dexie
    const record = await db.notificationPreferences.get('singleton')
    expect(record).toBeDefined()
    expect(record!.courseComplete).toBe(true)
  })

  it('loads existing prefs from Dexie', async () => {
    // Pre-seed Dexie with custom prefs
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
    // Defaults still in place
    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(true)
  })
})

describe('setTypeEnabled', () => {
  it('toggles a notification type off', async () => {
    await useNotificationPrefsStore.getState().init()

    await useNotificationPrefsStore.getState().setTypeEnabled('course-complete', false)

    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(false)

    // Verify Dexie
    const record = await db.notificationPreferences.get('singleton')
    expect(record!.courseComplete).toBe(false)
  })

  it('toggles a notification type on', async () => {
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setTypeEnabled('streak-milestone', false)
    await useNotificationPrefsStore.getState().setTypeEnabled('streak-milestone', true)

    expect(useNotificationPrefsStore.getState().prefs.streakMilestone).toBe(true)
  })

  it('handles unknown type gracefully', async () => {
    await useNotificationPrefsStore.getState().init()
    const before = { ...useNotificationPrefsStore.getState().prefs }

    await useNotificationPrefsStore.getState().setTypeEnabled('unknown-type' as NotificationType, false)

    // No change
    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(before.courseComplete)
  })

  it('shows toast on DB failure', async () => {
    await useNotificationPrefsStore.getState().init()
    vi.spyOn(db.notificationPreferences, 'put').mockRejectedValueOnce(new Error('Write fail'))
    const { toast } = await import('sonner')

    await useNotificationPrefsStore.getState().setTypeEnabled('course-complete', false)

    expect(toast.error).toHaveBeenCalledWith('Failed to update notification preference')
  })
})

describe('setQuietHours', () => {
  it('enables quiet hours with start and end', async () => {
    await useNotificationPrefsStore.getState().init()

    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    })

    const prefs = useNotificationPrefsStore.getState().prefs
    expect(prefs.quietHoursEnabled).toBe(true)
    expect(prefs.quietHoursStart).toBe('22:00')
    expect(prefs.quietHoursEnd).toBe('07:00')
  })

  it('rejects invalid HH:MM format for start', async () => {
    await useNotificationPrefsStore.getState().init()
    const before = { ...useNotificationPrefsStore.getState().prefs }

    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursStart: '25:00', // Invalid
    })

    // No change
    expect(useNotificationPrefsStore.getState().prefs.quietHoursStart).toBe(before.quietHoursStart)
  })

  it('rejects invalid HH:MM format for end', async () => {
    await useNotificationPrefsStore.getState().init()
    const before = { ...useNotificationPrefsStore.getState().prefs }

    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnd: '12:60', // Invalid
    })

    expect(useNotificationPrefsStore.getState().prefs.quietHoursEnd).toBe(before.quietHoursEnd)
  })

  it('shows toast on DB failure', async () => {
    await useNotificationPrefsStore.getState().init()
    vi.spyOn(db.notificationPreferences, 'put').mockRejectedValueOnce(new Error('Write fail'))
    const { toast } = await import('sonner')

    await useNotificationPrefsStore.getState().setQuietHours({ quietHoursEnabled: true })

    expect(toast.error).toHaveBeenCalledWith('Failed to update quiet hours')
  })
})

describe('isTypeEnabled', () => {
  it('returns true for enabled types', async () => {
    await useNotificationPrefsStore.getState().init()
    expect(useNotificationPrefsStore.getState().isTypeEnabled('course-complete')).toBe(true)
  })

  it('returns false for disabled types', async () => {
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setTypeEnabled('course-complete', false)
    expect(useNotificationPrefsStore.getState().isTypeEnabled('course-complete')).toBe(false)
  })

  it('returns true for unknown type (safe default)', () => {
    expect(
      useNotificationPrefsStore.getState().isTypeEnabled('unknown' as NotificationType)
    ).toBe(true)
  })
})

describe('isInQuietHours', () => {
  it('returns false when quiet hours disabled', async () => {
    await useNotificationPrefsStore.getState().init()
    expect(useNotificationPrefsStore.getState().isInQuietHours()).toBe(false)
  })

  it('returns false when start equals end', async () => {
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '22:00',
    })

    expect(useNotificationPrefsStore.getState().isInQuietHours()).toBe(false)
  })

  it('detects when inside all-day quiet hours window', async () => {
    // Use 00:00-23:59 to guarantee current time is always inside
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnabled: true,
      quietHoursStart: '00:00',
      quietHoursEnd: '23:59',
    })

    expect(useNotificationPrefsStore.getState().isInQuietHours()).toBe(true)
  })

  it('detects midnight-spanning window that covers all times', async () => {
    // 23:00-22:59 spans midnight and covers essentially all hours
    await useNotificationPrefsStore.getState().init()
    await useNotificationPrefsStore.getState().setQuietHours({
      quietHoursEnabled: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '22:59',
    })

    // Current time is always >= 23:00 OR < 22:59 — always true
    expect(useNotificationPrefsStore.getState().isInQuietHours()).toBe(true)
  })
})
