/**
 * Notification piercing and suppression during focus mode.
 *
 * Critical notifications (timer warnings, connection loss, session expiry)
 * pierce the focus overlay via elevated z-index Sonner toasts.
 * Non-critical notifications are queued and flushed when focus mode exits.
 *
 * @module notificationPiercing
 * @since E65-S04
 */

import { toast } from 'sonner'
import { isFocusModeActive } from '@/lib/focusModeState'
import type { NotificationType } from '@/data/types'

/** Notification types that pierce focus mode overlay */
const CRITICAL_TYPES: ReadonlySet<NotificationType> = new Set([
  // Timer warnings are handled separately via quiz timer toasts
  // These are for notification-service-created notifications:
  'review-due', // session expiry reminders
  'srs-due', // spaced repetition urgency
])

/** Non-critical types that get suppressed during focus mode */
const NON_CRITICAL_TYPES: ReadonlySet<NotificationType> = new Set([
  'course-complete',
  'streak-milestone',
  'import-finished',
  'achievement-unlocked',
  'knowledge-decay',
  'recommendation-match',
  'milestone-approaching',
])

interface QueuedNotification {
  title: string
  message: string
  type: NotificationType
}

const suppressedQueue: QueuedNotification[] = []

const MAX_INDIVIDUAL_TOASTS = 5
const FLUSH_DELAY_MS = 500

/**
 * Check if a notification should be suppressed during focus mode.
 * Returns true if the notification was handled (either shown as critical or queued).
 * Returns false if focus mode is not active (caller should proceed normally).
 */
export function handleFocusModeNotification(
  type: NotificationType,
  title: string,
  message: string
): boolean {
  if (!isFocusModeActive()) return false

  if (CRITICAL_TYPES.has(type)) {
    // Pierce the overlay — show with elevated z-index class
    toast.warning(title, {
      description: message,
      duration: 8000,
      className: 'focus-mode-critical-toast',
    })
    return true
  }

  if (NON_CRITICAL_TYPES.has(type)) {
    suppressedQueue.push({ title, message, type })
    return true
  }

  // Unknown type — let it through
  return false
}

/**
 * Flush all suppressed notifications after focus mode exits.
 * Shows individual toasts for up to 5, or a summary for more.
 */
export function flushSuppressedNotifications(): void {
  if (suppressedQueue.length === 0) return

  const queued = suppressedQueue.splice(0)

  if (queued.length <= MAX_INDIVIDUAL_TOASTS) {
    queued.forEach((notif, i) => {
      setTimeout(() => {
        toast.info(notif.title, {
          description: notif.message,
          duration: 5000,
        })
      }, i * FLUSH_DELAY_MS)
    })
  } else {
    // Summary toast for many queued notifications
    toast.info(`${queued.length} notifications while you were focused`, {
      description: 'Check the notification panel for details.',
      duration: 8000,
    })
  }
}

/**
 * Clear the suppressed queue (for testing or cleanup).
 */
export function clearSuppressedQueue(): void {
  suppressedQueue.length = 0
}
