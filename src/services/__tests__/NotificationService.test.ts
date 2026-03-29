import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { appEventBus } from '@/lib/eventBus'
import {
  initNotificationService,
  destroyNotificationService,
  checkSrsDueOnStartup,
} from '@/services/NotificationService'

// ── Mocks ──────────────────────────────────────────────────────

const mockCreate = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/useNotificationStore', () => ({
  useNotificationStore: {
    getState: () => ({
      create: mockCreate,
    }),
  },
}))

// Chainable Dexie mock for db.notifications.where().equals().filter().first()
const mockFirst = vi.fn()
const mockFilter = vi.fn(() => ({ first: mockFirst }))
const mockEquals = vi.fn(() => ({ filter: mockFilter }))
const mockWhere = vi.fn(() => ({ equals: mockEquals }))

const mockFlashcardsToArray = vi.fn().mockResolvedValue([])
const mockReviewRecordsToArray = vi.fn().mockResolvedValue([])

vi.mock('@/db', () => ({
  db: {
    notifications: {
      where: (...args: Parameters<typeof mockWhere>) => mockWhere(...args),
    },
    flashcards: {
      toArray: () => mockFlashcardsToArray(),
    },
    reviewRecords: {
      toArray: () => mockReviewRecordsToArray(),
    },
  },
}))

// Fixed date to prevent midnight boundary flakiness
const FIXED_NOW = new Date('2026-03-15T12:00:00')

describe('NotificationService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
    appEventBus.clear()
    mockCreate.mockClear()
    mockFirst.mockClear()
    mockFilter.mockClear()
    mockEquals.mockClear()
    mockWhere.mockClear()
    mockFlashcardsToArray.mockClear()
    mockReviewRecordsToArray.mockClear()
    // Default: no existing notification + no due cards
    mockFirst.mockResolvedValue(undefined)
    mockFlashcardsToArray.mockResolvedValue([])
    mockReviewRecordsToArray.mockResolvedValue([])
  })

  afterEach(() => {
    destroyNotificationService()
    vi.useRealTimers()
  })

  // ── Event-to-notification mapping ──────────────────────────

  describe('event-to-notification mapping', () => {
    it('creates course-complete notification on course:completed event', async () => {
      initNotificationService()

      appEventBus.emit({
        type: 'course:completed',
        courseId: 'c1',
        courseName: 'React Basics',
      })

      // handleEvent is async — flush microtasks
      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'course-complete',
          title: 'Course Completed!',
          message: 'Congratulations! You finished "React Basics".',
          actionUrl: '/courses/c1',
          metadata: { courseId: 'c1' },
        })
      )
    })

    it('creates streak-milestone notification for milestone threshold (7 days)', async () => {
      initNotificationService()

      appEventBus.emit({ type: 'streak:milestone', days: 7 })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streak-milestone',
          title: '7-Day Streak!',
          metadata: { days: 7 },
        })
      )
    })

    it('creates import-finished notification on import:finished event', async () => {
      initNotificationService()

      appEventBus.emit({
        type: 'import:finished',
        courseId: 'c2',
        courseName: 'Node.js',
        lessonCount: 12,
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'import-finished',
          title: 'Course Imported',
          message: '"Node.js" is ready with 12 lessons.',
          actionUrl: '/courses/c2',
          metadata: { courseId: 'c2', lessonCount: 12 },
        })
      )
    })

    it('uses singular "lesson" for lessonCount === 1', async () => {
      initNotificationService()

      appEventBus.emit({
        type: 'import:finished',
        courseId: 'c3',
        courseName: 'Intro',
        lessonCount: 1,
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '"Intro" is ready with 1 lesson.',
        })
      )
    })

    it('creates achievement-unlocked notification on achievement:unlocked event', async () => {
      initNotificationService()

      appEventBus.emit({
        type: 'achievement:unlocked',
        achievementId: 'a1',
        achievementName: 'First Steps',
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'achievement-unlocked',
          title: 'Achievement Unlocked!',
          message: 'You earned the "First Steps" badge.',
          metadata: { achievementId: 'a1' },
        })
      )
    })

    it('creates review-due notification on review:due event', async () => {
      initNotificationService()

      appEventBus.emit({ type: 'review:due', dueCount: 5 })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'review-due',
          title: 'Cards Due for Review',
          message: 'You have 5 flashcards ready for review.',
          actionUrl: '/review',
          metadata: { dueCount: 5 },
        })
      )
    })
  })

  // ── review-due deduplication ───────────────────────────────

  describe('review-due deduplication', () => {
    it('does not create duplicate review-due notification on the same day', async () => {
      // Simulate an existing review-due notification created today
      mockFirst.mockResolvedValue({
        id: 'existing',
        type: 'review-due',
        createdAt: FIXED_NOW.toISOString(),
      })

      initNotificationService()

      appEventBus.emit({ type: 'review:due', dueCount: 3 })

      // Give async handler time to run
      await vi.waitFor(() => expect(mockWhere).toHaveBeenCalled())

      // Should NOT have called create since one already exists today
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('creates review-due notification when none exists today', async () => {
      mockFirst.mockResolvedValue(undefined)

      initNotificationService()

      appEventBus.emit({ type: 'review:due', dueCount: 8 })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'review-due',
          metadata: { dueCount: 8 },
        })
      )
    })
  })

  // ── streak milestone filtering ─────────────────────────────

  describe('streak milestone filtering', () => {
    it('creates notification for each valid milestone threshold', async () => {
      const thresholds = [7, 14, 30, 60, 100, 365]

      for (const days of thresholds) {
        mockCreate.mockClear()
        initNotificationService()

        appEventBus.emit({ type: 'streak:milestone', days })

        await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'streak-milestone',
            title: `${days}-Day Streak!`,
          })
        )

        destroyNotificationService()
      }
    })

    it('does NOT create notification for non-milestone streak values', async () => {
      const nonMilestones = [1, 2, 5, 8, 15, 29, 50, 99, 200]

      for (const days of nonMilestones) {
        mockCreate.mockClear()
        initNotificationService()

        appEventBus.emit({ type: 'streak:milestone', days })

        // Flush microtasks (handleEvent is a resolved promise chain, no real timers)
        await vi.advanceTimersByTimeAsync(0)

        expect(mockCreate).not.toHaveBeenCalled()

        destroyNotificationService()
      }
    })
  })

  // ── srs:due event handling ────────────────────────────────

  describe('srs:due event handling', () => {
    it('creates srs-due notification on srs:due event', async () => {
      initNotificationService()

      appEventBus.emit({ type: 'srs:due', dueCount: 7 })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'srs-due',
          title: 'Cards Ready for Review',
          message: 'You have 7 cards due for spaced repetition review.',
          actionUrl: '/flashcards',
          metadata: { dueCount: 7 },
        })
      )
    })

    it('uses singular "card" for dueCount === 1', async () => {
      initNotificationService()

      appEventBus.emit({ type: 'srs:due', dueCount: 1 })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'You have 1 card due for spaced repetition review.',
        })
      )
    })

    it('does not create duplicate srs-due notification on the same day', async () => {
      // Simulate an existing srs-due notification created today
      mockFirst.mockResolvedValue({
        id: 'existing-srs',
        type: 'srs-due',
        createdAt: FIXED_NOW.toISOString(),
      })

      initNotificationService()

      appEventBus.emit({ type: 'srs:due', dueCount: 3 })

      await vi.waitFor(() => expect(mockWhere).toHaveBeenCalled())

      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  // ── checkSrsDueOnStartup ────────────────────────────────

  describe('checkSrsDueOnStartup', () => {
    it('emits srs:due when flashcards are due', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockFlashcardsToArray.mockResolvedValue([
        { id: '1', nextReviewAt: '2026-03-14T10:00:00' }, // Past FIXED_NOW → due
        { id: '2', nextReviewAt: '2026-03-16T10:00:00' }, // Future → not due
      ])
      mockReviewRecordsToArray.mockResolvedValue([])

      await checkSrsDueOnStartup()

      expect(emitSpy).toHaveBeenCalledWith({ type: 'srs:due', dueCount: 1 })
      emitSpy.mockRestore()
    })

    it('emits srs:due when note reviews are due', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockFlashcardsToArray.mockResolvedValue([])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', nextReviewAt: '2026-03-14T10:00:00' }, // Past → due
      ])

      await checkSrsDueOnStartup()

      expect(emitSpy).toHaveBeenCalledWith({ type: 'srs:due', dueCount: 1 })
      emitSpy.mockRestore()
    })

    it('counts both flashcards and note reviews in combined total', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockFlashcardsToArray.mockResolvedValue([
        { id: '1', nextReviewAt: '2026-03-14T10:00:00' }, // due
        { id: '2', nextReviewAt: '2026-03-10T10:00:00' }, // due
      ])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', nextReviewAt: '2026-03-13T10:00:00' }, // due
        { id: 'r2', nextReviewAt: '2026-03-12T10:00:00' }, // due
        { id: 'r3', nextReviewAt: '2026-03-20T10:00:00' }, // not due
      ])

      await checkSrsDueOnStartup()

      expect(emitSpy).toHaveBeenCalledWith({ type: 'srs:due', dueCount: 4 })
      emitSpy.mockRestore()
    })

    it('treats flashcards with no nextReviewAt as due (never reviewed)', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockFlashcardsToArray.mockResolvedValue([
        { id: '1' }, // No nextReviewAt → due
        { id: '2', nextReviewAt: undefined }, // Explicit undefined → due
      ])
      mockReviewRecordsToArray.mockResolvedValue([])

      await checkSrsDueOnStartup()

      expect(emitSpy).toHaveBeenCalledWith({ type: 'srs:due', dueCount: 2 })
      emitSpy.mockRestore()
    })

    it('does NOT emit when no cards are due', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockFlashcardsToArray.mockResolvedValue([
        { id: '1', nextReviewAt: '2026-03-20T10:00:00' }, // Future → not due
      ])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', nextReviewAt: '2026-03-20T10:00:00' }, // Future → not due
      ])

      await checkSrsDueOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('does NOT emit when both tables are empty', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      await checkSrsDueOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })
  })

  // ── lifecycle ──────────────────────────────────────────────

  describe('lifecycle', () => {
    it('initNotificationService is idempotent (no duplicate listeners)', async () => {
      initNotificationService()
      initNotificationService() // Second call should destroy first

      appEventBus.emit({
        type: 'course:completed',
        courseId: 'c1',
        courseName: 'Test',
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      // Should only be called once, not twice
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('destroyNotificationService stops receiving events', async () => {
      initNotificationService()
      destroyNotificationService()

      appEventBus.emit({
        type: 'course:completed',
        courseId: 'c1',
        courseName: 'Test',
      })

      // Flush microtasks
      await vi.advanceTimersByTimeAsync(0)

      expect(mockCreate).not.toHaveBeenCalled()
    })
  })
})
