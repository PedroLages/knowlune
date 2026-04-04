import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { appEventBus } from '@/lib/eventBus'
import {
  initNotificationService,
  destroyNotificationService,
  checkSrsDueOnStartup,
  checkKnowledgeDecayOnStartup,
  checkMilestoneApproachingOnStartup,
  MILESTONE_THRESHOLD,
  DECAY_THRESHOLD,
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

// Chainable Dexie mock for db.notifications.where().equals().filter().first()/.toArray()
const mockFirst = vi.fn()
const mockToArray = vi.fn().mockResolvedValue([])
const mockFilter = vi.fn(() => ({ first: mockFirst, toArray: mockToArray }))
const mockEquals = vi.fn(() => ({ filter: mockFilter }))
const mockWhere = vi.fn(() => ({ equals: mockEquals }))

const mockFlashcardsToArray = vi.fn().mockResolvedValue([])
const mockReviewRecordsToArray = vi.fn().mockResolvedValue([])
const mockNotesToArray = vi.fn().mockResolvedValue([])
const mockImportedCoursesToArray = vi.fn().mockResolvedValue([])
const mockContentProgressToArray = vi.fn().mockResolvedValue([])
const mockImportedVideosToArray = vi.fn().mockResolvedValue([])
const mockImportedPdfsToArray = vi.fn().mockResolvedValue([])

const mockIsTypeEnabled = vi.fn().mockReturnValue(true)
const mockIsInQuietHours = vi.fn().mockReturnValue(false)

vi.mock('@/stores/useNotificationPrefsStore', () => ({
  useNotificationPrefsStore: {
    getState: () => ({
      isTypeEnabled: (...args: unknown[]) => mockIsTypeEnabled(...args),
      isInQuietHours: () => mockIsInQuietHours(),
    }),
  },
}))

const mockGetTopicRetention = vi.fn().mockReturnValue([])

vi.mock('@/lib/retentionMetrics', () => ({
  getTopicRetention: (...args: unknown[]) => mockGetTopicRetention(...args),
  FADING_THRESHOLD: 50,
}))

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
    notes: {
      toArray: () => mockNotesToArray(),
    },
    importedCourses: {
      toArray: () => mockImportedCoursesToArray(),
    },
    contentProgress: {
      toArray: () => mockContentProgressToArray(),
    },
    importedVideos: {
      toArray: () => mockImportedVideosToArray(),
    },
    importedPdfs: {
      toArray: () => mockImportedPdfsToArray(),
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
    mockToArray.mockClear()
    mockFilter.mockClear()
    mockEquals.mockClear()
    mockWhere.mockClear()
    mockFlashcardsToArray.mockClear()
    mockReviewRecordsToArray.mockClear()
    mockNotesToArray.mockClear()
    mockImportedCoursesToArray.mockClear()
    mockContentProgressToArray.mockClear()
    mockImportedVideosToArray.mockClear()
    mockImportedPdfsToArray.mockClear()
    mockIsTypeEnabled.mockClear()
    mockIsInQuietHours.mockClear()
    mockGetTopicRetention.mockClear()
    // Default prefs: all types enabled, not in quiet hours
    mockIsTypeEnabled.mockReturnValue(true)
    mockIsInQuietHours.mockReturnValue(false)
    mockGetTopicRetention.mockReturnValue([])
    // Default: no existing notification + no due cards + no courses
    mockFirst.mockResolvedValue(undefined)
    mockToArray.mockResolvedValue([])
    mockFlashcardsToArray.mockResolvedValue([])
    mockReviewRecordsToArray.mockResolvedValue([])
    mockNotesToArray.mockResolvedValue([])
    mockImportedCoursesToArray.mockResolvedValue([])
    mockContentProgressToArray.mockResolvedValue([])
    mockImportedVideosToArray.mockResolvedValue([])
    mockImportedPdfsToArray.mockResolvedValue([])
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
        { id: '1', due: '2026-03-14T10:00:00' }, // Past FIXED_NOW → due
        { id: '2', due: '2026-03-16T10:00:00' }, // Future → not due
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
        { id: 'r1', due: '2026-03-14T10:00:00' }, // Past → due
      ])

      await checkSrsDueOnStartup()

      expect(emitSpy).toHaveBeenCalledWith({ type: 'srs:due', dueCount: 1 })
      emitSpy.mockRestore()
    })

    it('counts both flashcards and note reviews in combined total', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockFlashcardsToArray.mockResolvedValue([
        { id: '1', due: '2026-03-14T10:00:00' }, // due
        { id: '2', due: '2026-03-10T10:00:00' }, // due
      ])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', due: '2026-03-13T10:00:00' }, // due
        { id: 'r2', due: '2026-03-12T10:00:00' }, // due
        { id: 'r3', due: '2026-03-20T10:00:00' }, // not due
      ])

      await checkSrsDueOnStartup()

      expect(emitSpy).toHaveBeenCalledWith({ type: 'srs:due', dueCount: 4 })
      emitSpy.mockRestore()
    })

    it('treats new flashcards with due set to creation time as due', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      // FSRS sets due=now at creation, so new cards are immediately due
      mockFlashcardsToArray.mockResolvedValue([
        { id: '1', due: '2026-03-15T10:00:00' }, // Created before FIXED_NOW → due
        { id: '2', due: '2026-03-14T08:00:00' }, // Created before FIXED_NOW → due
      ])
      mockReviewRecordsToArray.mockResolvedValue([])

      await checkSrsDueOnStartup()

      expect(emitSpy).toHaveBeenCalledWith({ type: 'srs:due', dueCount: 2 })
      emitSpy.mockRestore()
    })

    it('does NOT emit when no cards are due', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockFlashcardsToArray.mockResolvedValue([
        { id: '1', due: '2026-03-20T10:00:00' }, // Future → not due
      ])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', due: '2026-03-20T10:00:00' }, // Future → not due
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

  // ── milestone:approaching event handling ──────────────────

  describe('milestone:approaching event handling', () => {
    it('creates milestone-approaching notification on milestone:approaching event', async () => {
      initNotificationService()

      appEventBus.emit({
        type: 'milestone:approaching',
        courseId: 'ts-course',
        courseName: 'Advanced TypeScript',
        remainingLessons: 2,
        totalLessons: 10,
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'milestone-approaching',
          title: 'Almost There!',
          message: 'Just 2 lessons left in Advanced TypeScript. Keep going!',
          actionUrl: '/courses/ts-course',
          metadata: { courseId: 'ts-course', remainingLessons: 2, totalLessons: 10 },
        })
      )
    })

    it('uses singular "lesson" when remainingLessons === 1', async () => {
      initNotificationService()

      appEventBus.emit({
        type: 'milestone:approaching',
        courseId: 'ts-course',
        courseName: 'Advanced TypeScript',
        remainingLessons: 1,
        totalLessons: 10,
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Just 1 lesson left in Advanced TypeScript. Keep going!',
        })
      )
    })

    it('does not create duplicate milestone notification for same course on same day', async () => {
      mockFirst.mockResolvedValue({
        id: 'existing-milestone',
        type: 'milestone-approaching',
        createdAt: FIXED_NOW.toISOString(),
      })

      initNotificationService()

      appEventBus.emit({
        type: 'milestone:approaching',
        courseId: 'ts-course',
        courseName: 'Advanced TypeScript',
        remainingLessons: 2,
        totalLessons: 10,
      })

      await vi.waitFor(() => expect(mockWhere).toHaveBeenCalled())

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('creates notifications for different courses on the same day', async () => {
      // First course has no existing notification; second course does
      mockFirst
        .mockResolvedValueOnce(undefined) // course-a: no existing notif
        .mockResolvedValueOnce({
          id: 'existing',
          type: 'milestone-approaching',
          createdAt: FIXED_NOW.toISOString(),
        }) // course-b: already notified

      initNotificationService()

      appEventBus.emit({
        type: 'milestone:approaching',
        courseId: 'course-a',
        courseName: 'Course A',
        remainingLessons: 2,
        totalLessons: 8,
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      appEventBus.emit({
        type: 'milestone:approaching',
        courseId: 'course-b',
        courseName: 'Course B',
        remainingLessons: 1,
        totalLessons: 5,
      })

      // Give async handler time — course-b should be suppressed
      await vi.advanceTimersByTimeAsync(0)

      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ actionUrl: '/courses/course-a' }))
    })
  })

  // ── checkMilestoneApproachingOnStartup ─────────────────────

  describe('checkMilestoneApproachingOnStartup', () => {
    it('emits milestone:approaching for a course with remaining <= MILESTONE_THRESHOLD', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockImportedCoursesToArray.mockResolvedValue([
        { id: 'ts-course', name: 'Advanced TypeScript' },
      ])
      // 10 lessons: 8 videos + 2 pdfs
      mockImportedVideosToArray.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, courseId: 'ts-course' }))
      )
      mockImportedPdfsToArray.mockResolvedValue([
        { id: 'p0', courseId: 'ts-course' },
        { id: 'p1', courseId: 'ts-course' },
      ])
      // 8 lessons completed → 2 remaining (at threshold)
      mockContentProgressToArray.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({
          courseId: 'ts-course',
          itemId: `v${i}`,
          status: 'completed',
          updatedAt: FIXED_NOW.toISOString(),
        }))
      )

      await checkMilestoneApproachingOnStartup()

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'milestone:approaching',
          courseId: 'ts-course',
          courseName: 'Advanced TypeScript',
          remainingLessons: 2,
          totalLessons: 10,
        })
      )
      emitSpy.mockRestore()
    })

    it('does NOT emit when remaining > MILESTONE_THRESHOLD', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockImportedCoursesToArray.mockResolvedValue([
        { id: 'ts-course', name: 'Advanced TypeScript' },
      ])
      mockImportedVideosToArray.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, courseId: 'ts-course' }))
      )
      mockImportedPdfsToArray.mockResolvedValue([])
      // 5 completed → 5 remaining (above threshold of ${MILESTONE_THRESHOLD})
      mockContentProgressToArray.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          courseId: 'ts-course',
          itemId: `v${i}`,
          status: 'completed',
          updatedAt: FIXED_NOW.toISOString(),
        }))
      )

      await checkMilestoneApproachingOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('does NOT emit when remaining === 0 (course complete)', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockImportedCoursesToArray.mockResolvedValue([{ id: 'c1', name: 'Done Course' }])
      mockImportedVideosToArray.mockResolvedValue([
        { id: 'v0', courseId: 'c1' },
        { id: 'v1', courseId: 'c1' },
      ])
      mockImportedPdfsToArray.mockResolvedValue([])
      mockContentProgressToArray.mockResolvedValue([
        { courseId: 'c1', itemId: 'v0', status: 'completed', updatedAt: FIXED_NOW.toISOString() },
        { courseId: 'c1', itemId: 'v1', status: 'completed', updatedAt: FIXED_NOW.toISOString() },
      ])

      await checkMilestoneApproachingOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('skips courses already notified today (batch dedup)', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockImportedCoursesToArray.mockResolvedValue([{ id: 'ts-course', name: 'Advanced TypeScript' }])
      mockImportedVideosToArray.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, courseId: 'ts-course' }))
      )
      mockImportedPdfsToArray.mockResolvedValue([])
      mockContentProgressToArray.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({
          courseId: 'ts-course',
          itemId: `v${i}`,
          status: 'completed',
          updatedAt: FIXED_NOW.toISOString(),
        }))
      )
      // Simulate an existing milestone notification today for this course
      mockToArray.mockResolvedValue([
        {
          id: 'existing',
          type: 'milestone-approaching',
          createdAt: FIXED_NOW.toISOString(),
          metadata: { courseId: 'ts-course' },
        },
      ])

      await checkMilestoneApproachingOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('does NOT emit when no courses exist', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      await checkMilestoneApproachingOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('exports MILESTONE_THRESHOLD as a positive integer', () => {
      expect(MILESTONE_THRESHOLD).toBeGreaterThan(0)
      expect(Number.isInteger(MILESTONE_THRESHOLD)).toBe(true)
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

  // ── knowledge:decay event handling ──────────────────────────

  describe('knowledge:decay event handling', () => {
    it('creates knowledge-decay notification on knowledge:decay event', async () => {
      initNotificationService()

      appEventBus.emit({
        type: 'knowledge:decay',
        topic: 'React Hooks',
        retention: 35,
        dueCount: 3,
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge-decay',
          title: 'Knowledge Fading: React Hooks',
          message: 'Your retention for "React Hooks" has dropped to 35%. Review now to strengthen your memory.',
          actionUrl: '/review',
          metadata: { topic: 'React Hooks', retention: 35 },
        })
      )
    })

    it('does not create duplicate knowledge-decay notification for same topic same day', async () => {
      mockFirst.mockResolvedValue({
        id: 'existing-decay',
        type: 'knowledge-decay',
        createdAt: FIXED_NOW.toISOString(),
        metadata: { topic: 'React Hooks' },
      })

      initNotificationService()

      appEventBus.emit({
        type: 'knowledge:decay',
        topic: 'React Hooks',
        retention: 30,
        dueCount: 2,
      })

      await vi.waitFor(() => expect(mockWhere).toHaveBeenCalled())

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('allows knowledge-decay notification for different topic same day', async () => {
      // First call: no existing notif for "TypeScript"; second call: existing for "React"
      mockFirst
        .mockResolvedValueOnce(undefined) // TypeScript: no existing
        .mockResolvedValueOnce({
          id: 'existing',
          type: 'knowledge-decay',
          createdAt: FIXED_NOW.toISOString(),
          metadata: { topic: 'React Hooks' },
        })

      initNotificationService()

      appEventBus.emit({
        type: 'knowledge:decay',
        topic: 'TypeScript',
        retention: 25,
        dueCount: 1,
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      appEventBus.emit({
        type: 'knowledge:decay',
        topic: 'React Hooks',
        retention: 30,
        dueCount: 2,
      })

      // Give async handler time — React Hooks should be suppressed
      await vi.advanceTimersByTimeAsync(0)

      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Knowledge Fading: TypeScript' })
      )
    })
  })

  // ── recommendation:match event handling ─────────────────────

  describe('recommendation:match event handling', () => {
    it('creates recommendation-match notification on recommendation:match event', async () => {
      initNotificationService()

      appEventBus.emit({
        type: 'recommendation:match',
        courseId: 'adv-react',
        courseName: 'Advanced React Patterns',
        reason: 'Matches your weak area in hooks',
      })

      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'recommendation-match',
          title: 'Recommended for You',
          message: 'Advanced React Patterns: Matches your weak area in hooks',
          actionUrl: '/courses/adv-react',
          metadata: { courseId: 'adv-react', courseName: 'Advanced React Patterns' },
        })
      )
    })

    it('does not create duplicate recommendation-match for same courseId same day', async () => {
      mockFirst.mockResolvedValue({
        id: 'existing-rec',
        type: 'recommendation-match',
        createdAt: FIXED_NOW.toISOString(),
        metadata: { courseId: 'adv-react' },
      })

      initNotificationService()

      appEventBus.emit({
        type: 'recommendation:match',
        courseId: 'adv-react',
        courseName: 'Advanced React Patterns',
        reason: 'Matches your weak area',
      })

      await vi.waitFor(() => expect(mockWhere).toHaveBeenCalled())

      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  // ── checkKnowledgeDecayOnStartup ─────────────────────────────

  describe('checkKnowledgeDecayOnStartup', () => {
    it('emits knowledge:decay for topics below DECAY_THRESHOLD', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockNotesToArray.mockResolvedValue([
        { id: 'n1', tags: ['React'], deleted: false },
      ])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', noteId: 'n1' },
      ])
      mockGetTopicRetention.mockReturnValue([
        { topic: 'React', retention: 30, level: 'critical', lastReviewedAt: '2026-03-10T12:00:00', noteCount: 1, dueCount: 1 },
      ])
      // No existing decay notifications today
      mockToArray.mockResolvedValue([])

      await checkKnowledgeDecayOnStartup()

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge:decay',
          topic: 'React',
          retention: 30,
          dueCount: 1,
        })
      )
      emitSpy.mockRestore()
    })

    it('does NOT emit for topics above DECAY_THRESHOLD', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockNotesToArray.mockResolvedValue([
        { id: 'n1', tags: ['React'], deleted: false },
      ])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', noteId: 'n1' },
      ])
      mockGetTopicRetention.mockReturnValue([
        { topic: 'React', retention: 75, level: 'strong', lastReviewedAt: '2026-03-14T12:00:00', noteCount: 1, dueCount: 0 },
      ])

      await checkKnowledgeDecayOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('does NOT emit when retention is exactly at threshold (< required, not <=)', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockNotesToArray.mockResolvedValue([
        { id: 'n1', tags: ['React'], deleted: false },
      ])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', noteId: 'n1' },
      ])
      mockGetTopicRetention.mockReturnValue([
        { topic: 'React', retention: DECAY_THRESHOLD, level: 'fading', lastReviewedAt: '2026-03-14T12:00:00', noteCount: 1, dueCount: 0 },
      ])

      await checkKnowledgeDecayOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('does NOT emit when notes array is empty', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockNotesToArray.mockResolvedValue([])
      mockReviewRecordsToArray.mockResolvedValue([])

      await checkKnowledgeDecayOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('does NOT emit when review records are empty (no reviewed notes)', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockNotesToArray.mockResolvedValue([
        { id: 'n1', tags: ['React'], deleted: false },
      ])
      mockReviewRecordsToArray.mockResolvedValue([])

      await checkKnowledgeDecayOnStartup()

      // getTopicRetention is never called because reviewRecords.length === 0
      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('skips topics already notified today (batch dedup)', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockNotesToArray.mockResolvedValue([
        { id: 'n1', tags: ['React'], deleted: false },
      ])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', noteId: 'n1' },
      ])
      mockGetTopicRetention.mockReturnValue([
        { topic: 'React', retention: 30, level: 'critical', lastReviewedAt: '2026-03-10T12:00:00', noteCount: 1, dueCount: 1 },
      ])
      // Simulate existing decay notification for React today
      mockToArray.mockResolvedValue([
        {
          id: 'existing',
          type: 'knowledge-decay',
          createdAt: FIXED_NOW.toISOString(),
          metadata: { topic: 'React' },
        },
      ])

      await checkKnowledgeDecayOnStartup()

      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('does NOT emit when knowledge-decay preference is disabled', async () => {
      const emitSpy = vi.spyOn(appEventBus, 'emit')

      mockIsTypeEnabled.mockImplementation((type: string) => type !== 'knowledge-decay')

      mockNotesToArray.mockResolvedValue([
        { id: 'n1', tags: ['React'], deleted: false },
      ])
      mockReviewRecordsToArray.mockResolvedValue([
        { id: 'r1', noteId: 'n1' },
      ])

      await checkKnowledgeDecayOnStartup()

      // Should return early, never calling getTopicRetention
      expect(mockGetTopicRetention).not.toHaveBeenCalled()
      expect(emitSpy).not.toHaveBeenCalled()
      emitSpy.mockRestore()
    })

    it('exports DECAY_THRESHOLD as a positive number', () => {
      expect(DECAY_THRESHOLD).toBeGreaterThan(0)
      expect(DECAY_THRESHOLD).toBe(50)
    })
  })

  // ── Preference suppression ──────────────────────────────────

  describe('preference suppression', () => {
    it('does NOT create notification when knowledge-decay is disabled', async () => {
      mockIsTypeEnabled.mockImplementation((type: string) => type !== 'knowledge-decay')

      initNotificationService()

      appEventBus.emit({
        type: 'knowledge:decay',
        topic: 'React',
        retention: 30,
        dueCount: 1,
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('does NOT create notification when recommendation-match is disabled', async () => {
      mockIsTypeEnabled.mockImplementation((type: string) => type !== 'recommendation-match')

      initNotificationService()

      appEventBus.emit({
        type: 'recommendation:match',
        courseId: 'c1',
        courseName: 'Test Course',
        reason: 'Good match',
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('does NOT create notification when milestone-approaching is disabled', async () => {
      mockIsTypeEnabled.mockImplementation((type: string) => type !== 'milestone-approaching')

      initNotificationService()

      appEventBus.emit({
        type: 'milestone:approaching',
        courseId: 'c1',
        courseName: 'Test Course',
        remainingLessons: 1,
        totalLessons: 10,
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('does NOT create any notification during quiet hours', async () => {
      mockIsInQuietHours.mockReturnValue(true)

      initNotificationService()

      appEventBus.emit({
        type: 'knowledge:decay',
        topic: 'React',
        retention: 30,
        dueCount: 1,
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockCreate).not.toHaveBeenCalled()
    })
  })
})
