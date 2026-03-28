/**
 * NotificationService — maps domain events from the event bus to
 * user-facing notifications via useNotificationStore.
 *
 * Lifecycle: call `initNotificationService()` on app mount,
 * `destroyNotificationService()` on unmount.
 *
 * @module NotificationService
 * @since E43-S07
 */

import { appEventBus } from '@/lib/eventBus'
import type { AppEvent, AppEventType } from '@/lib/eventBus'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { db } from '@/db'

/** Streak milestones that trigger notifications */
const STREAK_MILESTONES = [7, 14, 30, 60, 100, 365] as const

/** Active unsubscribe functions (populated by init, cleared by destroy) */
let unsubscribers: Array<() => void> = []

/**
 * Check whether a `review-due` notification was already created today.
 * Uses the Dexie `notifications` table to avoid duplicates.
 */
async function hasReviewDueToday(): Promise<boolean> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()

  const existing = await db.notifications
    .where('type')
    .equals('review-due')
    .filter(n => n.createdAt >= todayIso)
    .first()

  return existing !== undefined
}

/** Handle a single domain event, creating the appropriate notification. */
async function handleEvent(event: AppEvent): Promise<void> {
  const store = useNotificationStore.getState()

  switch (event.type) {
    case 'course:completed':
      await store.create({
        type: 'course-complete',
        title: 'Course Completed!',
        message: `Congratulations! You finished "${event.courseName}".`,
        actionUrl: `/courses/${event.courseId}`,
        metadata: { courseId: event.courseId },
      })
      break

    case 'streak:milestone':
      // Only create notification for milestone thresholds
      if (!STREAK_MILESTONES.includes(event.days as (typeof STREAK_MILESTONES)[number])) {
        return
      }
      await store.create({
        type: 'streak-milestone',
        title: `${event.days}-Day Streak!`,
        message: `Incredible! You have studied ${event.days} days in a row. Keep the momentum going!`,
        metadata: { days: event.days },
      })
      break

    case 'import:finished':
      await store.create({
        type: 'import-finished',
        title: 'Course Imported',
        message: `"${event.courseName}" is ready with ${event.lessonCount} lesson${event.lessonCount === 1 ? '' : 's'}.`,
        actionUrl: `/courses/${event.courseId}`,
        metadata: {
          courseId: event.courseId,
          lessonCount: event.lessonCount,
        },
      })
      break

    case 'achievement:unlocked':
      await store.create({
        type: 'achievement-unlocked',
        title: 'Achievement Unlocked!',
        message: `You earned the "${event.achievementName}" badge.`,
        metadata: {
          achievementId: event.achievementId,
        },
      })
      break

    case 'review:due': {
      // Deduplicate: only one review-due notification per day
      const alreadyNotified = await hasReviewDueToday()
      if (alreadyNotified) return

      await store.create({
        type: 'review-due',
        title: 'Cards Due for Review',
        message: `You have ${event.dueCount} flashcard${event.dueCount === 1 ? '' : 's'} ready for review.`,
        actionUrl: '/review',
        metadata: { dueCount: event.dueCount },
      })
      break
    }
  }
}

/**
 * Initialize the notification service — subscribe to all domain events.
 * Safe to call multiple times (idempotent — destroys previous subscriptions first).
 */
export function initNotificationService(): void {
  // Prevent duplicate subscriptions
  destroyNotificationService()

  const eventTypes: AppEventType[] = [
    'course:completed',
    'streak:milestone',
    'import:finished',
    'achievement:unlocked',
    'review:due',
  ]

  for (const type of eventTypes) {
    const unsub = appEventBus.on(type, (event: AppEvent) => {
      // silent-catch-ok — notification creation failure is non-critical; logged for debugging
      handleEvent(event).catch(error => {
        console.error(`[NotificationService] Failed to handle "${type}":`, error)
      })
    })
    unsubscribers.push(unsub)
  }

  console.log('[NotificationService] Initialized with', eventTypes.length, 'event subscriptions')
}

/** Destroy the notification service — unsubscribe from all events. */
export function destroyNotificationService(): void {
  for (const unsub of unsubscribers) {
    unsub()
  }
  unsubscribers = []
}
