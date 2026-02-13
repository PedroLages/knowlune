import { Course } from "@/data/types"
import { logStudyAction, getStudyLog } from "./studyLog"

const STORAGE_KEY = "course-progress"
const MINUTES_PER_LESSON = 15

export interface CourseProgress {
  courseId: string
  completedLessons: string[]
  lastWatchedLesson?: string
  lastVideoPosition?: number
  notes: Record<string, string>
  startedAt: string
  lastAccessedAt: string
}

export function getAllProgress(): Record<string, CourseProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAllProgress(data: Record<string, CourseProgress>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function ensureProgress(courseId: string): CourseProgress {
  const all = getAllProgress()
  if (!all[courseId]) {
    all[courseId] = {
      courseId,
      completedLessons: [],
      notes: {},
      startedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    }
    saveAllProgress(all)
  }
  return all[courseId]
}

export function getProgress(courseId: string): CourseProgress {
  return ensureProgress(courseId)
}

export function markLessonComplete(courseId: string, lessonId: string) {
  const all = getAllProgress()
  const progress = ensureProgress(courseId)
  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId)
  }
  progress.lastAccessedAt = new Date().toISOString()
  all[courseId] = progress
  saveAllProgress(all)
  logStudyAction({ type: "lesson_complete", courseId, lessonId, timestamp: new Date().toISOString() })
}

export function markLessonIncomplete(courseId: string, lessonId: string) {
  const all = getAllProgress()
  const progress = ensureProgress(courseId)
  progress.completedLessons = progress.completedLessons.filter(
    (id) => id !== lessonId
  )
  progress.lastAccessedAt = new Date().toISOString()
  all[courseId] = progress
  saveAllProgress(all)
}

export function saveVideoPosition(
  courseId: string,
  lessonId: string,
  seconds: number
) {
  const all = getAllProgress()
  const progress = ensureProgress(courseId)
  progress.lastWatchedLesson = lessonId
  progress.lastVideoPosition = seconds
  progress.lastAccessedAt = new Date().toISOString()
  all[courseId] = progress
  saveAllProgress(all)
  logStudyAction({ type: "video_progress", courseId, lessonId, timestamp: new Date().toISOString(), metadata: { seconds } })
}

export function saveNote(courseId: string, lessonId: string, text: string) {
  const all = getAllProgress()
  const progress = ensureProgress(courseId)
  progress.notes[lessonId] = text
  progress.lastAccessedAt = new Date().toISOString()
  all[courseId] = progress
  saveAllProgress(all)
}

export function getCourseCompletionPercent(
  courseId: string,
  totalLessons: number
): number {
  if (totalLessons === 0) return 0
  const progress = getProgress(courseId)
  return Math.round((progress.completedLessons.length / totalLessons) * 100)
}

export function isLessonComplete(courseId: string, lessonId: string): boolean {
  const progress = getProgress(courseId)
  return progress.completedLessons.includes(lessonId)
}

export function getNote(courseId: string, lessonId: string): string {
  const progress = getProgress(courseId)
  return progress.notes[lessonId] || ""
}

export function getCoursesInProgress(courses: Course[]): (Course & { progress: CourseProgress; completionPercent: number })[] {
  const all = getAllProgress()
  return courses
    .filter((c) => {
      const p = all[c.id]
      if (!p) return false
      const total = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
      const pct = total > 0 ? (p.completedLessons.length / total) * 100 : 0
      return pct > 0 && pct < 100
    })
    .map((c) => {
      const p = all[c.id]!
      const total = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
      return { ...c, progress: p, completionPercent: Math.round((p.completedLessons.length / total) * 100) }
    })
    .sort((a, b) => new Date(b.progress.lastAccessedAt).getTime() - new Date(a.progress.lastAccessedAt).getTime())
}

export function getCompletedCourses(courses: Course[]): Course[] {
  const all = getAllProgress()
  return courses.filter((c) => {
    const p = all[c.id]
    if (!p) return false
    const total = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
    return total > 0 && p.completedLessons.length >= total
  })
}

export function getNotStartedCourses(courses: Course[]): Course[] {
  const all = getAllProgress()
  return courses.filter((c) => {
    const p = all[c.id]
    return !p || p.completedLessons.length === 0
  })
}

export function getTotalCompletedLessons(): number {
  const all = getAllProgress()
  return Object.values(all).reduce((sum, p) => sum + p.completedLessons.length, 0)
}

export function getTotalStudyNotes(): number {
  const all = getAllProgress()
  return Object.values(all).reduce((sum, p) => sum + Object.values(p.notes).filter((n) => n.trim().length > 0).length, 0)
}

export function getRecentActivity(courses: Course[], limit = 5): (Course & { progress: CourseProgress })[] {
  const all = getAllProgress()
  return courses
    .filter((c) => all[c.id])
    .map((c) => ({ ...c, progress: all[c.id]! }))
    .sort((a, b) => new Date(b.progress.lastAccessedAt).getTime() - new Date(a.progress.lastAccessedAt).getTime())
    .slice(0, limit)
}

export function getLast7DaysLessonCompletions(): number[] {
  const logs = getStudyLog()
  const last7Days = Array(7).fill(0)
  const now = new Date()

  logs.forEach((log) => {
    if (log.type === "lesson_complete") {
      const logDate = new Date(log.timestamp)
      const daysAgo = Math.floor(
        (now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysAgo >= 0 && daysAgo < 7) {
        last7Days[6 - daysAgo]++
      }
    }
  })

  return last7Days
}

export function getWeeklyChange(metric: "lessons" | "courses" | "notes"): number {
  const logs = getStudyLog()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  let thisWeek = 0
  let lastWeek = 0

  logs.forEach((log) => {
    const logDate = new Date(log.timestamp)
    const matchesMetric =
      (metric === "lessons" && log.type === "lesson_complete") ||
      (metric === "notes" && log.type === "note_saved")

    if (!matchesMetric) return

    if (logDate >= weekAgo) {
      thisWeek++
    } else if (logDate >= twoWeeksAgo) {
      lastWeek++
    }
  })

  return thisWeek - lastWeek
}

export function getAverageProgressPercent(courses: Course[]): number {
  const inProgress = getCoursesInProgress(courses)
  if (inProgress.length === 0) return 0

  const totalPercent = inProgress.reduce((sum, course) => sum + course.completionPercent, 0)
  return Math.round(totalPercent / inProgress.length)
}

export function getTotalEstimatedStudyHours(): number {
  const totalLessons = getTotalCompletedLessons()
  return Math.round((totalLessons * MINUTES_PER_LESSON) / 60 * 10) / 10 // Round to 1 decimal
}

export function getTimeRemaining(courseId: string, course: Course): number {
  const progress = getProgress(courseId)
  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const remainingLessons = totalLessons - progress.completedLessons.length
  return Math.round((remainingLessons * MINUTES_PER_LESSON) / 60 * 10) / 10 // Round to 1 decimal
}
