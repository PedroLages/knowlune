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
}

export function clearStreakPause() {
  localStorage.removeItem(STREAK_PAUSE_KEY)
}

/**
 * Calculate current streak (consecutive days).
 * Delegates to parse-once helper for consistent logic.
 */
export function getCurrentStreak(): number {
  return currentStreakFromDays(studyDaysFromLog(getLog()))
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
 * Helper: Calculate streak counting backwards from a start date
 */
function calculateStreakFromDate(startDate: string, studyDays: string[]): number {
  let streak = 0
  const currentDate = parseLocalDate(startDate)

  while (true) {
    const dateStr = toLocalDateString(currentDate)
    if (studyDays.includes(dateStr)) {
      streak++
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

function currentStreakFromDays(studyDays: string[], pauseStatus: StreakPause | null = null): number {
  if (studyDays.length === 0) return 0

  const today = toLocalDateString()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = toLocalDateString(yesterdayDate)

  const pause = pauseStatus ?? getStreakPauseStatus()
  if (pause && pause.enabled) {
    const pauseStart = new Date(pause.startDate)
    const now = new Date()
    // DST-safe day diff: compare calendar dates, not milliseconds
    const diffMs = now.getTime() - pauseStart.getTime()
    const daysSincePause = Math.round(diffMs / 86400000)
    if (daysSincePause < pause.days) {
      return calculateStreakFromDate(yesterday, studyDays)
    } else {
      clearStreakPause()
    }
  }

  if (!studyDays.includes(today) && !studyDays.includes(yesterday)) return 0
  const startDate = studyDays.includes(today) ? today : yesterday
  return calculateStreakFromDate(startDate, studyDays)
}

function longestStreakFromDays(studyDays: string[]): number {
  if (studyDays.length === 0) return 0

  let maxStreak = 0
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
  activity: Array<{ date: string; hasActivity: boolean; lessonCount: number }>
  pauseStatus: StreakPause | null
}

export function getStreakSnapshot(activityDays = 30): StreakSnapshot {
  const log = getLog()
  const days = studyDaysFromLog(log)
  const pauseStatus = getStreakPauseStatus()

  return {
    currentStreak: currentStreakFromDays(days, pauseStatus),
    longestStreak: longestStreakFromDays(days),
    activity: activityFromLog(log, activityDays),
    pauseStatus,
  }
}
