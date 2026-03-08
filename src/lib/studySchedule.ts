import type { StudyAction } from '@/lib/studyLog'
import type { StudyGoal } from '@/lib/studyGoals'
import type { Course } from '@/data/types'
import type { MomentumScore } from '@/lib/momentum'
import { toLocalDateString } from '@/lib/dateUtils'

export interface CourseWithMomentum {
  course: Course
  momentumScore: MomentumScore
}

export interface CourseAllocation {
  courseId: string
  courseTitle: string
  minutes: number
}

export type StudyScheduleStatus = 'insufficient-data' | 'no-goal' | 'ready'

export interface StudyScheduleResult {
  status: StudyScheduleStatus
  optimalHour: number | null
  recommendedDailyMinutes: number | null
  courseAllocations: CourseAllocation[]
  activeCourseCount: number
  distinctStudyDays: number
}

export interface StudyScheduleInput {
  studyLog: StudyAction[]
  goal: StudyGoal | null
  activeCourses: CourseWithMomentum[]
  windowDays?: number
  minDaysRequired?: number
}

/** Count unique calendar days with at least one lesson_complete within the past windowDays. */
export function getDistinctStudyDays(log: StudyAction[], windowDays = 30): number {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000
  const days = new Set<string>()
  for (const entry of log) {
    if (entry.type !== 'lesson_complete') continue
    const ts = new Date(entry.timestamp).getTime()
    if (ts < cutoff) continue
    // Use locale-stable date string (sv locale = YYYY-MM-DD) for consistent day bucketing
    days.add(toLocalDateString(new Date(entry.timestamp)))
  }
  return days.size
}

/** Return the hour of day (0-23) with the most lesson_complete events within windowDays.
 *  Tiebreaker: earlier hour wins. Returns null if no events. */
export function calculateOptimalStudyHour(log: StudyAction[], windowDays = 30): number | null {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000
  const hourCounts: Record<number, number> = {}

  for (const entry of log) {
    if (entry.type !== 'lesson_complete') continue
    const ts = new Date(entry.timestamp).getTime()
    if (ts < cutoff) continue
    const hour = new Date(entry.timestamp).getHours()
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
  }

  const entries = Object.entries(hourCounts)
  if (entries.length === 0) return null

  // Sort by count descending, then hour ascending for tiebreaking
  entries.sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
  return Number(entries[0][0])
}

/** Estimate how many days per week the user has studied over the window. Clamped to [1,7]. */
export function getHistoricalDaysPerWeek(log: StudyAction[], windowDays = 30): number {
  const distinctDays = getDistinctStudyDays(log, windowDays)
  const raw = distinctDays / (windowDays / 7)
  return Math.min(7, Math.max(1, raw))
}

/** Convert a StudyGoal to equivalent weekly minutes. Returns null for session-count goals. */
export function getWeeklyGoalMinutes(goal: StudyGoal): number | null {
  if (goal.metric === 'sessions') return null
  if (goal.frequency === 'weekly') return goal.target
  // daily time goal → multiply by 7
  return goal.target * 7
}

/** Compute recommended daily study duration, rounded to nearest 15 min, minimum 15 min.
 *  Returns null if no usable time goal. */
export function calculateDailyStudyDuration(
  goal: StudyGoal,
  log: StudyAction[],
  windowDays = 30
): number | null {
  const weeklyMinutes = getWeeklyGoalMinutes(goal)
  if (weeklyMinutes === null) return null

  const daysPerWeek = getHistoricalDaysPerWeek(log, windowDays)
  const rawDaily = weeklyMinutes / daysPerWeek
  const rounded = Math.round(rawDaily / 15) * 15
  return Math.max(15, rounded)
}

/** Distribute daily minutes across courses weighted by momentum score using largest-remainder
 *  allocation so the sum exactly equals dailyMinutes. Falls back to equal split when all
 *  scores are zero. */
export function allocateTimeAcrossCourses(
  dailyMinutes: number,
  courses: CourseWithMomentum[]
): CourseAllocation[] {
  if (courses.length === 0) return []

  const totalScore = courses.reduce((sum, c) => sum + c.momentumScore.score, 0)

  // Weights: proportional by score, or equal when all scores are zero
  const weights =
    totalScore === 0
      ? courses.map(() => 1 / courses.length)
      : courses.map(c => c.momentumScore.score / totalScore)

  // Largest-remainder allocation: floor each share, then distribute leftover
  // minutes to courses with the largest fractional parts
  const raws = weights.map(w => w * dailyMinutes)
  const floors = raws.map(r => Math.floor(r))
  const remainder = dailyMinutes - floors.reduce((sum, f) => sum + f, 0)

  const indices = Array.from({ length: courses.length }, (_, i) => i).sort(
    (a, b) => raws[b] - Math.floor(raws[b]) - (raws[a] - Math.floor(raws[a]))
  )
  for (let i = 0; i < remainder; i++) {
    floors[indices[i % indices.length]]++
  }

  return courses.map((c, i) => ({
    courseId: c.course.id,
    courseTitle: c.course.title,
    minutes: floors[i],
  }))
}

/** Top-level orchestrator: compute a full study schedule from user data. */
export function computeStudySchedule(input: StudyScheduleInput): StudyScheduleResult {
  const { studyLog, goal, activeCourses, windowDays = 30, minDaysRequired = 7 } = input

  const distinctStudyDays = getDistinctStudyDays(studyLog, windowDays)
  const activeCourseCount = activeCourses.length
  const optimalHour = calculateOptimalStudyHour(studyLog, windowDays)

  if (distinctStudyDays < minDaysRequired) {
    return {
      status: 'insufficient-data',
      optimalHour: null,
      recommendedDailyMinutes: null,
      courseAllocations: [],
      activeCourseCount,
      distinctStudyDays,
    }
  }

  const weeklyMinutes = goal ? getWeeklyGoalMinutes(goal) : null
  if (!goal || weeklyMinutes === null) {
    return {
      status: 'no-goal',
      optimalHour,
      recommendedDailyMinutes: null,
      courseAllocations: [],
      activeCourseCount,
      distinctStudyDays,
    }
  }

  // goal is non-null and time-based (weeklyMinutes !== null),
  // so calculateDailyStudyDuration is guaranteed to return a number.
  const dailyMinutes = calculateDailyStudyDuration(goal, studyLog, windowDays)
  if (dailyMinutes === null) {
    return {
      status: 'no-goal',
      optimalHour,
      recommendedDailyMinutes: null,
      courseAllocations: [],
      activeCourseCount,
      distinctStudyDays,
    }
  }
  const courseAllocations = allocateTimeAcrossCourses(dailyMinutes, activeCourses)

  return {
    status: 'ready',
    optimalHour,
    recommendedDailyMinutes: dailyMinutes,
    courseAllocations,
    activeCourseCount,
    distinctStudyDays,
  }
}
