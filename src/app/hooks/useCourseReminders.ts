import { useEffect, useRef, useCallback } from 'react'
import {
  getCourseReminders,
  shouldFireReminder,
  hasNotifiedCourseToday,
  sendCourseReminder,
  getNotificationPermission,
} from '@/lib/courseReminders'
import type { CourseReminder } from '@/data/types'

/**
 * Scheduling hook for per-course study reminders.
 * Mounts in Layout.tsx — runs a single 60s interval checking all enabled reminders.
 * Independent from the streak reminder hook (useStudyReminders).
 */
export function useCourseReminders(): void {
  const remindersRef = useRef<CourseReminder[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearScheduler = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startScheduler = useCallback(() => {
    clearScheduler()

    const enabledReminders = remindersRef.current.filter(r => r.enabled)
    if (enabledReminders.length === 0) return

    intervalRef.current = setInterval(() => {
      // Re-check permission each tick so the scheduler activates
      // when permissions are granted after initial mount (AC4)
      if (getNotificationPermission() !== 'granted') return

      const now = new Date()
      for (const reminder of remindersRef.current) {
        if (!reminder.enabled) continue
        if (hasNotifiedCourseToday(reminder.courseId)) continue
        if (shouldFireReminder(reminder, now)) {
          sendCourseReminder(reminder)
        }
      }
    }, 60_000)
  }, [clearScheduler])

  const loadAndStart = useCallback(async () => {
    try {
      remindersRef.current = await getCourseReminders()
      startScheduler()
    } catch (error) {
      console.error('[CourseReminders] Failed to load reminders:', error)
    }
  }, [startScheduler])

  useEffect(() => {
    loadAndStart()

    function handleUpdate() {
      loadAndStart()
    }

    window.addEventListener('course-reminders-updated', handleUpdate)

    return () => {
      clearScheduler()
      window.removeEventListener('course-reminders-updated', handleUpdate)
    }
  }, [loadAndStart, clearScheduler])
}
