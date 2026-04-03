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
import type { NotificationType } from '@/data/types'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useNotificationPrefsStore } from '@/stores/useNotificationPrefsStore'
import { db } from '@/db'
import { isDue } from '@/lib/spacedRepetition'
import { getTopicRetention } from '@/lib/retentionMetrics'

/** Streak milestones that trigger notifications */
const STREAK_MILESTONES = [7, 14, 30, 60, 100, 365] as const

/** Retention percentage below which a topic is considered decaying (E60-S01) */
export const DECAY_THRESHOLD = 50

/**
 * Active unsubscribe functions (populated by init, cleared by destroy).
 *
 * Module-level mutable state is intentional here: NotificationService is a
 * singleton that lives for the app's lifetime. `initNotificationService()`
 * is idempotent (calls destroy first), so there is no risk of leaked
 * subscriptions. Tests should call `destroyNotificationService()` in
 * afterEach to reset state.
 */
let unsubscribers: Array<() => void> = []

/**
 * Check whether a `review-due` notification was already created today.
 * Uses the Dexie `notifications` table to avoid duplicates.
 */
async function hasReviewDueToday(): Promise<boolean> {
  // Use local-time YYYY-MM-DD comparison to avoid timezone boundary issues.
  // toLocaleDateString('sv-SE') produces 'YYYY-MM-DD' in the user's local timezone.
  const todayStr = new Date().toLocaleDateString('sv-SE')

  const existing = await db.notifications
    .where('type')
    .equals('review-due')
    .filter(n => new Date(n.createdAt).toLocaleDateString('sv-SE') === todayStr)
    .first()

  return existing !== undefined
}

/**
 * Check whether an `srs-due` notification was already created today.
 * Same dedup pattern as `hasReviewDueToday()`.
 */
async function hasSrsDueToday(): Promise<boolean> {
  const todayStr = new Date().toLocaleDateString('sv-SE')

  const existing = await db.notifications
    .where('type')
    .equals('srs-due')
    .filter(n => new Date(n.createdAt).toLocaleDateString('sv-SE') === todayStr)
    .first()

  return existing !== undefined
}

/**
 * Check whether a `knowledge-decay` notification was already created today
 * for a specific topic. Dedup key: type + metadata.topic + date.
 */
async function hasKnowledgeDecayToday(topic: string): Promise<boolean> {
  const todayStr = new Date().toLocaleDateString('sv-SE')

  const existing = await db.notifications
    .where('type')
    .equals('knowledge-decay')
    .filter(
      n =>
        (n.metadata as Record<string, unknown>)?.topic === topic &&
        new Date(n.createdAt).toLocaleDateString('sv-SE') === todayStr
    )
    .first()

  return existing !== undefined
}

/**
 * On app startup, count all due flashcards + note reviews and emit
 * an `srs:due` event if any are due. This provides a proactive reminder
 * without requiring the user to navigate to the review page.
 */
export async function checkSrsDueOnStartup(): Promise<void> {
  const now = new Date()

  const [flashcards, reviewRecords] = await Promise.all([
    db.flashcards.toArray(),
    db.reviewRecords.toArray(),
  ])

  const dueFlashcards = flashcards.filter(card => isDue(card, now)).length

  const dueReviews = reviewRecords.filter(r => isDue(r, now)).length

  const dueCount = dueFlashcards + dueReviews
  if (dueCount > 0) {
    appEventBus.emit({ type: 'srs:due', dueCount })
  }
}

/**
 * On app startup, check all topics for knowledge decay and emit
 * events for topics below the retention threshold.
 * Uses getTopicRetention() from retentionMetrics to calculate per-topic retention.
 */
export async function checkKnowledgeDecayOnStartup(): Promise<void> {
  const now = new Date()

  const [notes, reviewRecords] = await Promise.all([db.notes.toArray(), db.reviewRecords.toArray()])

  if (notes.length === 0 || reviewRecords.length === 0) return

  const topicRetentions = getTopicRetention(notes, reviewRecords, now)

  for (const topic of topicRetentions) {
    if (topic.retention < DECAY_THRESHOLD) {
      appEventBus.emit({
        type: 'knowledge:decay',
        topic: topic.topic,
        retention: topic.retention,
        dueCount: topic.dueCount,
      })
    }
  }
}

/** Map domain event types to NotificationType for preference lookup */
const EVENT_TO_NOTIF_TYPE: Record<AppEventType, NotificationType> = {
  'course:completed': 'course-complete',
  'streak:milestone': 'streak-milestone',
  'import:finished': 'import-finished',
  'achievement:unlocked': 'achievement-unlocked',
  'review:due': 'review-due',
  'srs:due': 'srs-due',
  'knowledge:decay': 'knowledge-decay',
}

/** Handle a single domain event, creating the appropriate notification. */
async function handleEvent(event: AppEvent): Promise<void> {
  const prefsStore = useNotificationPrefsStore.getState()

  // Suppress notifications during quiet hours
  if (prefsStore.isInQuietHours()) return

  // Suppress notifications for disabled types
  const notifType = EVENT_TO_NOTIF_TYPE[event.type]
  if (notifType && !prefsStore.isTypeEnabled(notifType)) return

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
        // Note: lessonCount reflects items detected at import time. Future lesson
        // types (e.g., interactive exercises) may not be counted if the import
        // pipeline doesn't recognise them yet.
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

    case 'srs:due': {
      // Deduplicate: only one srs-due notification per day
      const alreadySrsNotified = await hasSrsDueToday()
      if (alreadySrsNotified) return

      await store.create({
        type: 'srs-due',
        title: 'Cards Ready for Review',
        message: `You have ${event.dueCount} card${event.dueCount === 1 ? '' : 's'} due for spaced repetition review.`,
        actionUrl: '/flashcards',
        metadata: { dueCount: event.dueCount },
      })
      break
    }

    case 'knowledge:decay': {
      // Deduplicate: one decay notification per topic per day
      const alreadyDecayNotified = await hasKnowledgeDecayToday(event.topic)
      if (alreadyDecayNotified) return

      await store.create({
        type: 'knowledge-decay',
        title: `Knowledge Fading: ${event.topic}`,
        message: `Your retention for "${event.topic}" has dropped to ${event.retention}%. Review now to strengthen your memory.`,
        actionUrl: '/review',
        metadata: { topic: event.topic, retention: event.retention },
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
    'srs:due',
    'knowledge:decay',
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

  console.debug('[NotificationService] Initialized with', eventTypes.length, 'event subscriptions')

  // Proactive daily check: count due SRS items and notify
  // silent-catch-ok — startup check failure is non-critical; logged for debugging
  checkSrsDueOnStartup().catch(error => {
    console.error('[NotificationService] SRS startup check failed:', error)
  })

  // Proactive decay check: emit events for topics below retention threshold
  // silent-catch-ok — startup check failure is non-critical; logged for debugging
  checkKnowledgeDecayOnStartup().catch(error => {
    console.error('[NotificationService] Knowledge decay startup check failed:', error)
  })
}

/** Destroy the notification service — unsubscribe from all events. */
export function destroyNotificationService(): void {
  for (const unsub of unsubscribers) {
    unsub()
  }
  unsubscribers = []
}
