import { getStudyLog, getFreezeDays, type StudyAction } from '@/lib/studyLog'
import { toLocalDateString } from '@/lib/dateUtils'

export interface DayStudyData {
  date: string // YYYY-MM-DD
  sessions: Array<{
    courseId: string
    timestamp: string
    type: string
  }>
  isFreezeDay: boolean
}

/**
 * Aggregate study-log actions for a given month into a Map keyed by YYYY-MM-DD.
 * O(n) scan of the full log, then O(1) lookups per day during render.
 */
export function getMonthStudyData(year: number, month: number): Map<string, DayStudyData> {
  const log = getStudyLog()
  const freezeDays = getFreezeDays()
  return buildMonthData(log, freezeDays, year, month)
}

/** Pure helper (testable without localStorage) */
export function buildMonthData(
  log: StudyAction[],
  freezeDayIndices: number[],
  year: number,
  month: number
): Map<string, DayStudyData> {
  const result = new Map<string, DayStudyData>()

  // Pre-populate every day of the month
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const key = toLocalDateString(date)
    result.set(key, {
      date: key,
      sessions: [],
      isFreezeDay: freezeDayIndices.includes(date.getDay()),
    })
  }

  // Bin actions into their day — use ISO prefix to skip Date construction for non-matching months
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  for (const action of log) {
    if (!action.timestamp.startsWith(monthPrefix)) continue
    const actionDate = new Date(action.timestamp)
    const key = toLocalDateString(actionDate)
    const day = result.get(key)
    if (day) {
      day.sessions.push({
        courseId: action.courseId,
        timestamp: action.timestamp,
        type: action.type,
      })
    }
  }

  return result
}
