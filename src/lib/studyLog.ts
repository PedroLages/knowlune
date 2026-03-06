import { toLocalDateString } from '@/lib/dateUtils'

// Re-export for convenience (tests, consumers)
export { toLocalDateString }

const STORAGE_KEY = 'study-log'

export interface StudyAction {
  type: 'lesson_complete' | 'video_progress' | 'note_saved' | 'course_started' | 'pdf_progress'
  courseId: string
  lessonId?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

function getLog(): StudyAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLog(log: StudyAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
}

/**
 * Parse a YYYY-MM-DD string into a Date in the local timezone.
 * Avoids the UTC-midnight pitfall of `new Date("2026-03-05")`.
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function logStudyAction(action: StudyAction) {
  const log = getLog()
  log.push(action)
  // Keep last 1000 entries to prevent localStorage bloat
  if (log.length > 1000) {
    log.splice(0, log.length - 1000)
  }
  saveLog(log)
  window.dispatchEvent(new CustomEvent('study-log-updated'))
}

export function getStudyLog(): StudyAction[] {
  return getLog().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function getStudyLogForCourse(courseId: string): StudyAction[] {
  return getStudyLog().filter(a => a.courseId === courseId)
}

export function getActionsPerDay(days = 30): { date: string; count: number }[] {
  const log = getLog()
  const now = new Date()
  const counts: Record<string, number> = {}

  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    counts[toLocalDateString(d)] = 0
  }

  for (const action of log) {
    const date = toLocalDateString(new Date(action.timestamp))
    if (date in counts) {
      counts[date]++
    }
  }

  return Object.entries(counts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function getRecentActions(limit = 20): StudyAction[] {
  return getStudyLog().slice(0, limit)
}

/**
 * Streak tracking and vacation mode
 */
const STREAK_PAUSE_KEY = 'study-streak-pause'
const LONGEST_STREAK_KEY = 'study-longest-streak'
const FREEZE_DAYS_KEY = 'study-streak-freeze-days'

/** Sentinel value for indefinite pause (toggle-based, not timed) */
export const INDEFINITE_PAUSE_DAYS = 99999

interface FreezeDaysConfig {
  freezeDays: number[] // Day indices: 0=Sun, 1=Mon, ..., 6=Sat. Max 3.
}

export function getFreezeDays(): number[] {
  try {
    const raw = localStorage.getItem(FREEZE_DAYS_KEY)
    if (!raw) return []
    const config: FreezeDaysConfig = JSON.parse(raw)
    // Enforce max 3 + valid indices on read (defense against corrupted localStorage)
    return (config.freezeDays ?? [])
      .filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
      .slice(0, 3)
  } catch {
    return []
  }
}

export function setFreezeDays(days: number[]) {
  const valid = days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
  const config: FreezeDaysConfig = { freezeDays: valid.slice(0, 3) }
  localStorage.setItem(FREEZE_DAYS_KEY, JSON.stringify(config))
  window.dispatchEvent(new CustomEvent('study-log-updated'))
}

interface StreakPause {
  enabled: boolean
  startDate: string
  days: number
}

export function getStreakPauseStatus(): StreakPause | null {
  try {
    const raw = localStorage.getItem(STREAK_PAUSE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStreakPause(days: number) {
  const pause: StreakPause = {
    enabled: true,
    startDate: new Date().toISOString(),
    days,
  }
  localStorage.setItem(STREAK_PAUSE_KEY, JSON.stringify(pause))
  window.dispatchEvent(new CustomEvent('study-log-updated'))
}

export function clearStreakPause() {
  localStorage.removeItem(STREAK_PAUSE_KEY)
  window.dispatchEvent(new CustomEvent('study-log-updated'))
}

/**
 * Calculate current streak (consecutive days).
 * Delegates to parse-once helper for consistent logic.
 */
export function getCurrentStreak(): number {
  return currentStreakFromDays(studyDaysFromLog(getLog()), null, getFreezeDays())
}

/**
 * Get longest streak ever achieved.
 * Delegates to parse-once helper for consistent logic.
 */
export function getLongestStreak(): number {
  return longestStreakFromDays(studyDaysFromLog(getLog()))
}

/**
 * Get study activity for the last N days (for calendar heatmap).
 * Delegates to parse-once helper for consistent logic.
 */
export function getStudyActivity(
  days = 30
): Array<{ date: string; hasActivity: boolean; lessonCount: number }> {
  return activityFromLog(getLog(), days)
}

// ── Internal helpers for parse-once pattern ──

/**
 * Helper: Calculate streak counting backwards from a start date.
 * Freeze days with no activity are skipped (don't break the streak).
 * Freeze days with activity count normally toward the streak.
 */
function calculateStreakFromDate(
  startDate: string,
  studyDays: string[] | Set<string>,
  freezeDayIndices: number[] = []
): number {
  let streak = 0
  const currentDate = parseLocalDate(startDate)
  const studySet = studyDays instanceof Set ? studyDays : new Set(studyDays)

  while (true) {
    const dateStr = toLocalDateString(currentDate)
    if (studySet.has(dateStr)) {
      streak++
      currentDate.setDate(currentDate.getDate() - 1)
    } else if (freezeDayIndices.includes(currentDate.getDay())) {
      // Freeze day with no activity — skip without breaking streak
      currentDate.setDate(currentDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

function studyDaysFromLog(log: StudyAction[]): string[] {
  const days = new Set<string>()
  for (const a of log) {
    if (a.type === 'lesson_complete') {
      days.add(toLocalDateString(new Date(a.timestamp)))
    }
  }
  return Array.from(days).sort()
}

function currentStreakFromDays(
  studyDays: string[],
  pauseStatus: StreakPause | null = null,
  freezeDayIndices: number[] = []
): number {
  if (studyDays.length === 0) return 0

  const now = new Date()
  const today = toLocalDateString(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = toLocalDateString(yesterdayDate)

  const pause = pauseStatus ?? getStreakPauseStatus()
  if (pause && pause.enabled) {
    const pauseStartDate = new Date(pause.startDate)
    const diffMs = now.getTime() - pauseStartDate.getTime()
    const daysSincePause = Math.round(diffMs / 86400000)
    if (daysSincePause < pause.days) {
      // AC7: Freeze logic is suspended during pause — don't pass freeze days
      // Start from most recent study day to preserve streak across multi-day pauses
      const mostRecentStudyDay = studyDays[studyDays.length - 1]
      if (!mostRecentStudyDay) return 0
      return calculateStreakFromDate(mostRecentStudyDay, studyDays)
    } else {
      clearStreakPause()
    }
  }

  const todayIsFreezeDay = freezeDayIndices.includes(now.getDay())
  const yesterdayIsFreezeDay = freezeDayIndices.includes(yesterdayDate.getDay())
  const studySet = new Set(studyDays)
  const hasRecentActivity = studySet.has(today) || studySet.has(yesterday)

  // Allow streak bridging through freeze days (today or yesterday could be freeze days
  // that connect to older study days via the backward walk)
  if (!hasRecentActivity && !todayIsFreezeDay && !yesterdayIsFreezeDay) return 0

  // Start backward walk from today (freeze-day-aware walk handles gaps)
  if (studySet.has(today)) {
    return calculateStreakFromDate(today, studySet, freezeDayIndices)
  }
  // Today has no activity — start walk from yesterday
  // (today is either a freeze day being skipped, or yesterday has activity)
  return calculateStreakFromDate(yesterday, studySet, freezeDayIndices)
}

function longestStreakFromDays(studyDays: string[], freezeDayIndices: number[] = []): number {
  if (studyDays.length === 0) return 0

  let maxStreak = 0

  if (freezeDayIndices.length === 0) {
    // Fast path: no freeze days, simple consecutive check
    let cur = 1
    for (let i = 1; i < studyDays.length; i++) {
      const prev = parseLocalDate(studyDays[i - 1])
      const curr = parseLocalDate(studyDays[i])
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000)
      if (diff === 1) {
        cur++
      } else {
        maxStreak = Math.max(maxStreak, cur)
        cur = 1
      }
    }
    maxStreak = Math.max(maxStreak, cur)
  } else {
    // Freeze-aware: use backward walk from each study day to find its streak length
    const seen = new Set<string>()
    for (let i = studyDays.length - 1; i >= 0; i--) {
      if (seen.has(studyDays[i])) continue
      const streak = calculateStreakFromDate(studyDays[i], studyDays, freezeDayIndices)
      maxStreak = Math.max(maxStreak, streak)
      // Mark all study days in this streak as seen to skip them
      const d = parseLocalDate(studyDays[i])
      for (let j = 0; j < streak; j++) {
        seen.add(toLocalDateString(d))
        d.setDate(d.getDate() - 1)
      }
    }
  }

  const storedLongest = parseInt(localStorage.getItem(LONGEST_STREAK_KEY) || '0')
  if (maxStreak > storedLongest) {
    localStorage.setItem(LONGEST_STREAK_KEY, maxStreak.toString())
  }
  return Math.max(maxStreak, storedLongest)
}

function activityFromLog(
  log: StudyAction[],
  days: number
): Array<{ date: string; hasActivity: boolean; lessonCount: number }> {
  // O(n): build count map in single pass
  const countMap = new Map<string, number>()
  for (const a of log) {
    if (a.type === 'lesson_complete') {
      const d = toLocalDateString(new Date(a.timestamp))
      countMap.set(d, (countMap.get(d) ?? 0) + 1)
    }
  }

  // O(days): build result from map lookups
  const now = new Date()
  const result: Array<{ date: string; hasActivity: boolean; lessonCount: number }> = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = toLocalDateString(d)
    const lessonCount = countMap.get(dateStr) ?? 0

    result.push({
      date: dateStr,
      hasActivity: lessonCount > 0,
      lessonCount,
    })
  }

  return result
}

/**
 * Parse localStorage once and derive all streak data.
 * Use this instead of calling getCurrentStreak + getLongestStreak + getStudyActivity separately.
 */
export interface StreakSnapshot {
  currentStreak: number
  longestStreak: number
  activity: Array<{ date: string; hasActivity: boolean; lessonCount: number; isFreezeDay: boolean }>
  pauseStatus: StreakPause | null
  freezeDays: number[]
}

export function getStreakSnapshot(activityDays = 30): StreakSnapshot {
  const log = getLog()
  const days = studyDaysFromLog(log)
  const pauseStatus = getStreakPauseStatus()
  const freezeDays = getFreezeDays()

  const rawActivity = activityFromLog(log, activityDays)
  const activity = rawActivity.map(day => {
    const d = new Date(day.date + 'T12:00:00')
    return { ...day, isFreezeDay: freezeDays.includes(d.getDay()) }
  })

  return {
    currentStreak: currentStreakFromDays(days, pauseStatus, freezeDays),
    longestStreak: longestStreakFromDays(days, freezeDays),
    activity,
    pauseStatus,
    freezeDays,
  }
}
