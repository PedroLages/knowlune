import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  shouldFireReminder,
  sendCourseReminder,
  hasNotifiedCourseToday,
  markNotifiedCourseToday,
  getCourseReminderDedupKey,
} from '@/lib/courseReminders'
import type { CourseReminder } from '@/data/types'

// Mock the db module — we only test scheduling/notification logic here
vi.mock('@/db/schema', () => ({
  db: {
    courseReminders: {
      toArray: vi.fn(() => Promise.resolve([])),
      put: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
      })),
    },
  },
}))

function makeReminder(overrides: Partial<CourseReminder> = {}): CourseReminder {
  return {
    id: 'reminder-1',
    courseId: 'course-abc',
    courseName: 'TypeScript Fundamentals',
    days: ['monday', 'wednesday', 'friday'],
    time: '09:00',
    enabled: true,
    createdAt: '2026-03-16T00:00:00.000Z',
    updatedAt: '2026-03-16T00:00:00.000Z',
    ...overrides,
  }
}

describe('courseReminders', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── shouldFireReminder ──

  describe('shouldFireReminder', () => {
    it('returns true when day and time match exactly', () => {
      const reminder = makeReminder({ days: ['monday'], time: '09:00' })
      // Monday March 16 2026 at 09:00
      const now = new Date(2026, 2, 16, 9, 0)
      expect(shouldFireReminder(reminder, now)).toBe(true)
    })

    it('returns true within the 2-minute window (minute+1)', () => {
      const reminder = makeReminder({ days: ['monday'], time: '09:00' })
      const now = new Date(2026, 2, 16, 9, 1)
      expect(shouldFireReminder(reminder, now)).toBe(true)
    })

    it('returns true within the 2-minute window (minute+2)', () => {
      const reminder = makeReminder({ days: ['monday'], time: '09:00' })
      const now = new Date(2026, 2, 16, 9, 2)
      expect(shouldFireReminder(reminder, now)).toBe(true)
    })

    it('returns false outside the 2-minute window (minute+3)', () => {
      const reminder = makeReminder({ days: ['monday'], time: '09:00' })
      const now = new Date(2026, 2, 16, 9, 3)
      expect(shouldFireReminder(reminder, now)).toBe(false)
    })

    it('returns false before the target time', () => {
      const reminder = makeReminder({ days: ['monday'], time: '09:00' })
      const now = new Date(2026, 2, 16, 8, 59)
      expect(shouldFireReminder(reminder, now)).toBe(false)
    })

    it('returns false on a non-matching day', () => {
      const reminder = makeReminder({ days: ['monday'], time: '09:00' })
      // Tuesday March 17 2026 at 09:00
      const now = new Date(2026, 2, 17, 9, 0)
      expect(shouldFireReminder(reminder, now)).toBe(false)
    })

    it('returns false when reminder is disabled', () => {
      const reminder = makeReminder({ enabled: false, days: ['monday'], time: '09:00' })
      const now = new Date(2026, 2, 16, 9, 0)
      expect(shouldFireReminder(reminder, now)).toBe(false)
    })

    it('handles multiple days correctly', () => {
      const reminder = makeReminder({ days: ['monday', 'wednesday', 'friday'], time: '14:00' })
      // Wednesday March 18 2026 at 14:00
      const wed = new Date(2026, 2, 18, 14, 0)
      expect(shouldFireReminder(reminder, wed)).toBe(true)

      // Thursday March 19 2026 at 14:00
      const thu = new Date(2026, 2, 19, 14, 0)
      expect(shouldFireReminder(reminder, thu)).toBe(false)
    })
  })

  // ── sendCourseReminder ──

  describe('sendCourseReminder', () => {
    it('constructs Notification with correct title, body, tag, and data', () => {
      const instances: Array<{
        title: string
        options: NotificationOptions & { data?: unknown }
        onclick: (() => void) | null
      }> = []

      vi.stubGlobal(
        'Notification',
        Object.assign(
          class MockNotification {
            title: string
            options: NotificationOptions & { data?: unknown }
            onclick: (() => void) | null = null

            constructor(title: string, options: NotificationOptions & { data?: unknown }) {
              this.title = title
              this.options = options
              instances.push(this)
            }
          },
          { permission: 'granted' as NotificationPermission }
        )
      )

      const reminder = makeReminder()
      sendCourseReminder(reminder)

      expect(instances).toHaveLength(1)
      const [notif] = instances
      expect(notif.title).toBe('Time to study TypeScript Fundamentals!')
      expect(notif.options.tag).toBe('levelup-course-reminder-course-abc')
      expect(notif.options.data).toEqual({ url: '/courses/course-abc' })
    })

    it('attaches onclick handler that navigates to course deep-link', () => {
      const instances: Array<{ onclick: (() => void) | null }> = []

      vi.stubGlobal(
        'Notification',
        Object.assign(
          class MockNotification {
            onclick: (() => void) | null = null
            constructor() {
              instances.push(this)
            }
          },
          { permission: 'granted' as NotificationPermission }
        )
      )

      const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {})
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '',
      })

      const reminder = makeReminder({ courseId: 'course-xyz' })
      sendCourseReminder(reminder)

      expect(instances).toHaveLength(1)
      expect(instances[0].onclick).toBeTypeOf('function')

      // Simulate click
      instances[0].onclick!()
      expect(focusSpy).toHaveBeenCalled()

      focusSpy.mockRestore()
      locationSpy.mockRestore()
    })

    it('does nothing when permission is denied', () => {
      const instances: unknown[] = []

      vi.stubGlobal(
        'Notification',
        Object.assign(
          class MockNotification {
            constructor() {
              instances.push(this)
            }
          },
          { permission: 'denied' as NotificationPermission }
        )
      )

      sendCourseReminder(makeReminder())
      expect(instances).toHaveLength(0)
    })

    it('marks the course as notified today after sending', () => {
      vi.stubGlobal(
        'Notification',
        Object.assign(
          class MockNotification {
            onclick: (() => void) | null = null
          },
          { permission: 'granted' as NotificationPermission }
        )
      )

      const reminder = makeReminder({ courseId: 'course-123' })
      expect(hasNotifiedCourseToday('course-123')).toBe(false)

      sendCourseReminder(reminder)

      expect(hasNotifiedCourseToday('course-123')).toBe(true)
    })
  })

  // ── Dedup logic ──

  describe('hasNotifiedCourseToday / markNotifiedCourseToday', () => {
    it('returns false when not yet notified', () => {
      expect(hasNotifiedCourseToday('course-a')).toBe(false)
    })

    it('returns true after marking notified', () => {
      markNotifiedCourseToday('course-a')
      expect(hasNotifiedCourseToday('course-a')).toBe(true)
    })

    it('tracks courses independently', () => {
      markNotifiedCourseToday('course-a')
      expect(hasNotifiedCourseToday('course-a')).toBe(true)
      expect(hasNotifiedCourseToday('course-b')).toBe(false)
    })

    it('uses correct localStorage key prefix', () => {
      expect(getCourseReminderDedupKey('course-abc')).toBe('course-reminder-last-course-abc')
    })
  })
})
