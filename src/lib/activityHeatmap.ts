import type { StudySession } from '@/data/types'
import { toLocalDateString } from '@/lib/dateUtils'

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4

export interface HeatmapDay {
  date: string // YYYY-MM-DD
  totalSeconds: number
  level: HeatmapLevel
  isToday: boolean
}

export interface MonthSummary {
  label: string // e.g. "Jan 2026"
  activeDays: number
  totalSeconds: number
}

/**
 * Map total study seconds to a 0-4 intensity level.
 *
 * Thresholds (based on minutes studied):
 *  0 = 0s        (no activity)
 *  1 = 1–899s    (up to 14 min)
 *  2 = 900–2699s (15–44 min)
 *  3 = 2700–5399s(45–89 min)
 *  4 = 5400s+    (90+ min)
 */
export function getActivityLevel(totalSeconds: number): HeatmapLevel {
  if (totalSeconds <= 0) return 0
  if (totalSeconds < 900) return 1
  if (totalSeconds < 2700) return 2
  if (totalSeconds < 5400) return 3
  return 4
}

/**
 * Aggregate completed study sessions by day, summing active duration.
 * Pure function — no IndexedDB access.
 *
 * @param sessions - All study sessions (completed + orphaned)
 * @param today    - YYYY-MM-DD string for the reference "today"
 * @param days     - How many days back to include (default 365)
 * @returns Map<YYYY-MM-DD, totalSeconds> pre-populated for every day in range
 */
export function aggregateSessionsByDay(
  sessions: Pick<StudySession, 'startTime' | 'duration' | 'endTime'>[],
  today: string,
  days = 365
): Map<string, number> {
  const result = new Map<string, number>()

  // Pre-populate every day in the window with 0
  const endDate = new Date(today + 'T12:00:00')
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate)
    d.setDate(d.getDate() - i)
    result.set(toLocalDateString(d), 0)
  }

  // Sum durations from completed sessions (endTime defined)
  for (const session of sessions) {
    if (!session.endTime) continue
    const date = toLocalDateString(new Date(session.startTime))
    if (result.has(date)) {
      result.set(date, (result.get(date) ?? 0) + session.duration)
    }
  }

  return result
}

/**
 * Build a 2D grid for rendering the heatmap:
 *   grid[dayOfWeek][weekIndex] — 7 rows (Sun-Sat) × N week columns
 *
 * The first week may have null entries for days before the range starts.
 */
export function buildHeatmapGrid(
  dayMap: Map<string, number>,
  today: string
): {
  grid: (HeatmapDay | null)[][]
  monthLabels: { label: string; colStart: number }[]
  totalWeeks: number
} {
  const sortedDates = Array.from(dayMap.keys()).sort()

  if (sortedDates.length === 0) {
    return { grid: [], monthLabels: [], totalWeeks: 0 }
  }

  const firstDate = new Date(sortedDates[0] + 'T12:00:00')
  const firstDayOfWeek = firstDate.getDay() // 0=Sun

  // Build flat array of HeatmapDay
  const days: HeatmapDay[] = sortedDates.map(date => ({
    date,
    totalSeconds: dayMap.get(date) ?? 0,
    level: getActivityLevel(dayMap.get(date) ?? 0),
    isToday: date === today,
  }))

  // Pad start so week columns are Sunday-aligned
  const padded: (HeatmapDay | null)[] = [...Array<null>(firstDayOfWeek).fill(null), ...days]

  // Pad end to make the last week complete
  while (padded.length % 7 !== 0) {
    padded.push(null)
  }

  const totalWeeks = padded.length / 7

  // Build grid[dayOfWeek][weekIndex]
  const grid: (HeatmapDay | null)[][] = Array.from({ length: 7 }, () => [])
  for (let i = 0; i < padded.length; i++) {
    const dayOfWeek = i % 7
    const weekIndex = Math.floor(i / 7)
    grid[dayOfWeek][weekIndex] = padded[i]
  }

  // Month labels: collect the first week where each new month starts
  const monthLabels: { label: string; colStart: number }[] = []
  let prevMonth = -1

  for (let wi = 0; wi < totalWeeks; wi++) {
    // Find the first non-null day in this week column
    for (let di = 0; di < 7; di++) {
      const day = grid[di][wi]
      if (!day) continue
      const d = new Date(day.date + 'T12:00:00')
      const month = d.getMonth()
      if (month !== prevMonth) {
        monthLabels.push({
          label: d.toLocaleDateString('en-US', { month: 'short' }),
          colStart: wi,
        })
        prevMonth = month
      }
      break
    }
  }

  return { grid, monthLabels, totalWeeks }
}

/**
 * Summarise heatmap data into monthly totals for the accessible table view.
 */
export function getMonthlyHeatmapSummary(dayMap: Map<string, number>): MonthSummary[] {
  const monthMap = new Map<string, { activeDays: number; totalSeconds: number }>()

  for (const [date, seconds] of dayMap) {
    const d = new Date(date + 'T12:00:00')
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const entry = monthMap.get(label) ?? { activeDays: 0, totalSeconds: 0 }
    entry.totalSeconds += seconds
    if (seconds > 0) entry.activeDays++
    monthMap.set(label, entry)
  }

  // Return in chronological order (months come in insertion order since dates are sorted)
  return Array.from(monthMap.entries()).map(([label, data]) => ({
    label,
    activeDays: data.activeDays,
    totalSeconds: data.totalSeconds,
  }))
}

/** Format seconds as "Xh Ym" or "Ym" or "< 1 min" */
export function formatStudyTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'No activity'
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 1) return '< 1 min'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}
