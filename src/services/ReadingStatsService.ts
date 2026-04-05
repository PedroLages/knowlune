/**
 * ReadingStatsService — aggregates reading session statistics from Dexie.
 *
 * Book reading sessions use the `studySessions` table with sentinel values:
 *   - courseId: '' (empty string — book session sentinel)
 *   - contentItemId: bookId
 *
 * This is the same pattern used by book-sourced Flashcards (courseId: '').
 *
 * @module ReadingStatsService
 */
import { db } from '@/db/schema'
import { toLocalDateString } from '@/lib/studyLog'

export interface ReadingTimePoint {
  date: string // YYYY-MM-DD
  minutes: number
}

export interface ReadingStats {
  timeReadTodayMinutes: number
  booksInProgress: number
  totalBooksFinished: number
  readingTrend: ReadingTimePoint[] // Last 14 days
}

/**
 * Fetch all reading and listening sessions from Dexie.
 * Both book reading and audiobook listening use courseId === '' as a sentinel (E85-S06, E87-S06).
 * This gives a unified "media time" view that covers EPUB reading + audiobook listening.
 */
async function getBookSessions() {
  return db.studySessions.where('courseId').equals('').toArray()
}

/**
 * Calculate time read today in minutes.
 */
export async function getTimeReadToday(): Promise<number> {
  const sessions = await getBookSessions()
  const todayStr = toLocalDateString(new Date())

  let totalSeconds = 0
  for (const s of sessions) {
    if (!s.startTime) continue
    const sessionDate = toLocalDateString(new Date(s.startTime))
    if (sessionDate === todayStr) {
      totalSeconds += s.duration ?? 0
    }
  }

  return totalSeconds / 60
}

/**
 * Build daily reading time trend for the last N days.
 */
export async function getReadingTimeTrend(days = 14): Promise<ReadingTimePoint[]> {
  const sessions = await getBookSessions()
  const now = new Date()

  // Build a map of date → total seconds
  const secondsByDay = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    secondsByDay.set(toLocalDateString(d), 0)
  }

  for (const s of sessions) {
    if (!s.startTime) continue
    const dateStr = toLocalDateString(new Date(s.startTime))
    if (secondsByDay.has(dateStr)) {
      secondsByDay.set(dateStr, (secondsByDay.get(dateStr) ?? 0) + (s.duration ?? 0))
    }
  }

  return Array.from(secondsByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, seconds]) => ({ date, minutes: Math.round(seconds / 60) }))
}

/**
 * Get book counts from the books table.
 * Avoids duplicating useBookStore — caller can provide these from the store.
 */
export async function getBookStatusCounts(): Promise<{ inProgress: number; finished: number }> {
  const [inProgress, finished] = await Promise.all([
    db.books.where('status').equals('reading').count(),
    db.books.where('status').equals('finished').count(),
  ])
  return { inProgress, finished }
}

/**
 * Fetch all reading statistics in a single call.
 */
export async function getReadingStats(): Promise<ReadingStats> {
  const [timeReadTodayMinutes, readingTrend, { inProgress, finished }] = await Promise.all([
    getTimeReadToday(),
    getReadingTimeTrend(14),
    getBookStatusCounts(),
  ])

  return {
    timeReadTodayMinutes,
    booksInProgress: inProgress,
    totalBooksFinished: finished,
    readingTrend,
  }
}

/**
 * Format minutes as "Xh Ym" or "Ym" for display.
 */
export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return '0m'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
