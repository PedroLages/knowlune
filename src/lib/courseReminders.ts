import { db } from '@/db/schema'
import type { CourseReminder, DayOfWeek } from '@/data/types'
import {
  getNotificationPermission,
  requestNotificationPermission,
  hasNotifiedToday,
  markNotifiedToday,
} from '@/lib/studyReminders'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

// ── Constants ──

const COURSE_REMINDER_DEDUP_PREFIX = 'course-reminder-last-'

// Sunday-first order matches JS Date.getDay() (0=Sunday, 6=Saturday).
// UI components (DaySelector, CourseReminderRow) use Monday-first for display.
const DAY_NAMES: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

// ── CRUD operations ──

export async function getCourseReminders(): Promise<CourseReminder[]> {
  return db.courseReminders.toArray()
}

export async function getCourseRemindersByCourse(courseId: string): Promise<CourseReminder[]> {
  return db.courseReminders.where('courseId').equals(courseId).toArray()
}

export async function saveCourseReminder(reminder: CourseReminder): Promise<void> {
  // E96-S02: route through syncableWrite so the change is enqueued for
  // Supabase upload. syncableWrite stamps `updatedAt` itself — callers must
  // NOT pre-stamp or the LWW comparison drifts.
  await syncableWrite(
    'courseReminders',
    'put',
    reminder as unknown as SyncableRecord,
  )
  window.dispatchEvent(new Event('course-reminders-updated'))
}

export async function deleteCourseReminder(id: string): Promise<void> {
  await syncableWrite('courseReminders', 'delete', id)
  window.dispatchEvent(new Event('course-reminders-updated'))
}

export async function toggleCourseReminder(id: string, enabled: boolean): Promise<void> {
  // syncableWrite requires a full record for 'put' — read the existing row,
  // merge the toggle, and let syncableWrite stamp `updatedAt`.
  const existing = await db.courseReminders.get(id)
  if (!existing) return
  await syncableWrite(
    'courseReminders',
    'put',
    { ...existing, enabled } as unknown as SyncableRecord,
  )
  window.dispatchEvent(new Event('course-reminders-updated'))
}

/**
 * Replace Dexie collection from a validated remote snapshot.
 *
 * E96-S02: called by `hydrateP3P4FromSupabase`. Pure setter — writes Dexie
 * via `bulkPut` directly (never `syncableWrite`) to avoid echo-looping
 * through the sync queue.
 *
 * AC5 disposition: isAllDefaults guard is vacuously satisfied for
 * `courseReminders` — it is a collection keyed by id, not a singleton.
 */
export async function hydrateCourseRemindersFromRemote(
  rows: CourseReminder[],
): Promise<void> {
  if (!rows || rows.length === 0) return
  await db.courseReminders.bulkPut(rows)
  window.dispatchEvent(new Event('course-reminders-updated'))
}

// ── Scheduling logic ──

/**
 * Checks whether a reminder should fire right now.
 * Matches current day-of-week and time within a 2-minute window.
 */
export function shouldFireReminder(reminder: CourseReminder, now: Date): boolean {
  if (!reminder.enabled) return false

  // Check day of week
  const currentDay = DAY_NAMES[now.getDay()]
  if (!reminder.days.includes(currentDay)) return false

  // Check time within 2-minute window
  const [targetHour, targetMinute] = reminder.time.split(':').map(Number)
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const targetMinutes = targetHour * 60 + targetMinute
  const currentMinutes = currentHour * 60 + currentMinute
  const diff = currentMinutes - targetMinutes

  return diff >= 0 && diff <= 2
}

/**
 * Returns the dedup localStorage key for a given course reminder.
 */
export function getCourseReminderDedupKey(courseId: string): string {
  return `${COURSE_REMINDER_DEDUP_PREFIX}${courseId}`
}

/**
 * Checks if a course reminder notification has already been sent today.
 */
export function hasNotifiedCourseToday(courseId: string): boolean {
  return hasNotifiedToday(getCourseReminderDedupKey(courseId))
}

/**
 * Marks a course reminder as notified today (multi-tab dedup).
 */
export function markNotifiedCourseToday(courseId: string): void {
  markNotifiedToday(getCourseReminderDedupKey(courseId))
}

// ── Notification sending ──

/**
 * Sends a browser notification for a course reminder.
 * Includes the course name and a deep-link to resume studying.
 */
export function sendCourseReminder(reminder: CourseReminder): void {
  if (getNotificationPermission() !== 'granted') return

  const url = `/courses/${reminder.courseId}`
  const notification = new Notification(`Time to study ${reminder.courseName}!`, {
    body: `Your scheduled study session for ${reminder.courseName} is starting now. Tap to jump in.`,
    icon: '/favicon.svg',
    tag: `levelup-course-reminder-${reminder.courseId}`,
    data: { url },
  })

  notification.onclick = () => {
    window.focus()
    window.location.href = url
  }

  markNotifiedCourseToday(reminder.courseId)
}

// ── Re-exports for convenience ──

export { getNotificationPermission, requestNotificationPermission }
export { DAY_NAMES }
export type { DayOfWeek }
