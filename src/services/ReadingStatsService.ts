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

export interface TimeOfDayBucket {
  period: 'Morning' | 'Afternoon' | 'Evening' | 'Night'
  count: number
  percentage: number
}

export interface TimeOfDayPattern {
  buckets: TimeOfDayBucket[]
  dominant: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | null
}

export interface ReadingStats {
  timeReadTodayMinutes: number
  booksInProgress: number
  totalBooksFinished: number
  avgReadingSpeedPagesPerHour: number | null
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
 * Compute average reading speed (pages/hour) from finished books.
 * Aggregates all sessions across finished books (last 90 days) and computes total pages / total hours.
 * Returns null if insufficient data or no finished books exist.
 * Used by usePagesReadToday for accurate page estimation and by ReadingStatsSection for display.
 *
 * Formula: totalPages / (totalReadingSeconds / 3600)
 */
export async function computeAverageReadingSpeed(): Promise<number | null> {
  const sessions = await getBookSessions()
  const finishedBooks = await db.books.where('status').equals('finished').toArray()

  if (finishedBooks.length === 0) return null

  const finishedBookIds = new Set(finishedBooks.map(b => b.id))
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // Only include books that have at least one session in the 90-day window
  // to avoid inflating speed with pages from books with no recent sessions
  const booksWithRecentSessions = new Set<string>()
  const bookPagesMap = new Map<string, number>()

  for (const book of finishedBooks) {
    if (book.totalPages) {
      bookPagesMap.set(book.id, book.totalPages)
    }
  }

  let totalSeconds = 0

  // Sum session duration for finished books in last 90 days, tracking which books contributed
  for (const session of sessions) {
    const bookId = session.contentItemId
    if (!bookId || !finishedBookIds.has(bookId)) continue
    if (!session.startTime) continue

    const sessionDate = new Date(session.startTime)
    if (sessionDate < ninetyDaysAgo) continue

    totalSeconds += session.duration ?? 0
    booksWithRecentSessions.add(bookId)
  }

  // Only count pages for books that had recent sessions
  let totalPages = 0
  for (const bookId of booksWithRecentSessions) {
    totalPages += bookPagesMap.get(bookId) ?? 0
  }

  if (totalSeconds === 0) return null

  // pages/hour = pages / (seconds / 3600) = (pages * 3600) / seconds
  const pagesPerHour = (totalPages * 3600) / totalSeconds
  return Math.round(pagesPerHour)
}

/**
 * Compute ETA (estimated finish date) for a book in progress.
 * Uses the user's average reading speed from recent sessions (last 30 days).
 * Returns "≈ N days" or "≈ X weeks" format, or "—" if insufficient data.
 * Returns null if the book is not in progress or has insufficient data.
 *
 * Formula: remainingPages / avgPagesPerDay where avgPagesPerDay = avgSpeedPagesPerHour * (dailyReadingHours)
 */
export async function computeETA(
  book: { id: string; status?: string; totalPages?: number; progress?: number },
  avgSpeedPagesPerHour: number | null
): Promise<string | null> {
  // Only compute ETA for in-progress books
  if (book.status !== 'reading') return null
  if (!book.totalPages || !avgSpeedPagesPerHour) return null

  const sessions = await getBookSessions()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Filter sessions for this book in the last 30 days
  let totalSeconds = 0
  let sessionCount = 0

  for (const session of sessions) {
    if (session.contentItemId !== book.id) continue
    if (!session.startTime) continue

    const sessionDate = new Date(session.startTime)
    if (sessionDate < thirtyDaysAgo) continue

    totalSeconds += session.duration ?? 0
    sessionCount++
  }

  // Insufficient data for ETA
  if (totalSeconds === 0 || sessionCount === 0) return null

  // avg pages per day = total pages read in window / 30 days
  // (avgSpeedPagesPerHour * hours read) = total pages read in last 30 days
  const avgPagesPerDay = (avgSpeedPagesPerHour * (totalSeconds / 3600)) / 30
  const remainingPages = Math.round((1 - (book.progress ?? 0) / 100) * book.totalPages)

  if (remainingPages <= 0) return null

  const etaDays = Math.ceil(remainingPages / Math.max(avgPagesPerDay, 0.1))

  if (etaDays > 14) {
    // weeks >= ceil(15/7) = 3 when etaDays > 14, so singular "week" is unreachable
    const weeks = Math.ceil(etaDays / 7)
    return `≈ ${weeks} weeks`
  }

  return `≈ ${etaDays} ${etaDays === 1 ? 'day' : 'days'}`
}

/**
 * Get time-of-day pattern from reading sessions.
 * Buckets: Morning [5, 12), Afternoon [12, 17), Evening [17, 21), Night [21, 5)
 * Night wraps around midnight — hour < 5 || hour >= 21.
 * Returns null if fewer than 7 sessions exist.
 */
export async function getTimeOfDayPattern(): Promise<TimeOfDayPattern | null> {
  const sessions = await getBookSessions()

  if (sessions.length < 7) return null

  const buckets = {
    Morning: 0,
    Afternoon: 0,
    Evening: 0,
    Night: 0,
  }

  for (const session of sessions) {
    if (!session.startTime) continue
    const hour = new Date(session.startTime).getHours()

    if (hour >= 5 && hour < 12) buckets.Morning++
    else if (hour >= 12 && hour < 17) buckets.Afternoon++
    else if (hour >= 17 && hour < 21) buckets.Evening++
    else buckets.Night++ // 21-4:59
  }

  const total = Object.values(buckets).reduce((sum, v) => sum + v, 0)
  if (total === 0) return null

  const dominant = (Object.entries(buckets).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null) as
    | 'Morning'
    | 'Afternoon'
    | 'Evening'
    | 'Night'
    | null

  return {
    buckets: Object.entries(buckets).map(([period, count]) => ({
      period: period as 'Morning' | 'Afternoon' | 'Evening' | 'Night',
      count,
      percentage: Math.round((count / total) * 100),
    })),
    dominant,
  }
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
  const [timeReadTodayMinutes, readingTrend, { inProgress, finished }, avgSpeed] =
    await Promise.all([
      getTimeReadToday(),
      getReadingTimeTrend(14),
      getBookStatusCounts(),
      computeAverageReadingSpeed(),
    ])

  return {
    timeReadTodayMinutes,
    booksInProgress: inProgress,
    totalBooksFinished: finished,
    avgReadingSpeedPagesPerHour: avgSpeed,
    readingTrend,
  }
}

export interface GenreDataPoint {
  genre: string
  count: number
}

export interface ReadingSummary {
  booksFinishedThisYear: number
  yearlyGoal: number | null
  avgPagesPerSession: number | null
  longestSessionMinutes: number | null
  mostReadAuthor: string | null
}

const READING_GOAL_STORAGE_KEY = 'knowlune:reading-goal'

/**
 * Get genre distribution from books (status: reading, finished, want-to-read — excludes abandoned).
 * Groups genres below 5% of total into "Other". Returns null if fewer than 2 books have genres.
 * Caps legend at 8 named genres (rest merged into "Other").
 */
export async function getGenreDistribution(): Promise<GenreDataPoint[] | null> {
  const books = await db.books
    .where('status')
    .anyOf(['reading', 'finished', 'want-to-read'])
    .toArray()

  // Build genre count map — books without a genre are excluded from distribution
  const genreCounts = new Map<string, number>()
  for (const book of books) {
    if (!book.genre) continue
    genreCounts.set(book.genre, (genreCounts.get(book.genre) ?? 0) + 1)
  }

  const total = Array.from(genreCounts.values()).reduce((sum, c) => sum + c, 0)
  if (total < 2) return null

  // Sort by count desc
  const sorted = Array.from(genreCounts.entries()).sort(([, a], [, b]) => b - a)

  // Cap at 8 named genres, rest → Other.
  // Priority: size cap (8) takes precedence over the 5% threshold — a genre above 5%
  // that falls outside the top 8 is still grouped into Other (AC2: legend caps at 8).
  const threshold = total * 0.05
  const named: GenreDataPoint[] = []
  let otherCount = 0

  for (const [genre, count] of sorted) {
    if (named.length < 8 && count >= threshold) {
      named.push({ genre, count })
    } else {
      otherCount += count
    }
  }

  if (otherCount > 0) {
    named.push({ genre: 'Other', count: otherCount })
  }

  return named
}

/**
 * Get reading summary metrics for the ReadingSummaryCard.
 * Returns null if no finished books exist.
 *
 * - booksFinishedThisYear: count of books with finishedAt in current calendar year
 * - yearlyGoal: from localStorage (ReadingGoal.yearlyBookTarget)
 * - avgPagesPerSession: totalPages of finished books / total session count
 * - longestSessionMinutes: max session duration across all book sessions
 * - mostReadAuthor: author with most finished books (alphabetical tie-break)
 */
export async function getReadingSummary(): Promise<ReadingSummary | null> {
  const finishedBooks = await db.books.where('status').equals('finished').toArray()
  if (finishedBooks.length === 0) return null

  const thisYear = new Date().getFullYear()
  const booksFinishedThisYear = finishedBooks.filter(b => {
    if (!b.finishedAt) return false
    return new Date(b.finishedAt).getFullYear() === thisYear
  }).length

  // Read yearly goal from localStorage (same key as useReadingGoalStore)
  let yearlyGoal: number | null = null
  try {
    const raw = localStorage.getItem(READING_GOAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { yearlyBookTarget?: number }
      yearlyGoal = parsed.yearlyBookTarget ?? null
    }
  } catch {
    // Intentional: localStorage may be unavailable in test environments — silently ignore
  }

  // Compute session-based metrics — scope to finished books only so that
  // avgPagesPerSession numerator (finished book pages) matches the denominator (finished book sessions)
  const allSessions = await getBookSessions()
  const finishedBookIds = new Set(finishedBooks.map(b => b.id))
  let totalDuration = 0
  let sessionCount = 0
  let longestDuration = 0

  for (const session of allSessions) {
    if (!session.contentItemId || !finishedBookIds.has(session.contentItemId)) continue
    const d = session.duration ?? 0
    if (d <= 0) continue
    totalDuration += d
    sessionCount++
    if (d > longestDuration) longestDuration = d
  }

  // Avg pages per session: finished books' total pages / finished books' session count
  const totalPages = finishedBooks.reduce((sum, b) => sum + (b.totalPages ?? 0), 0)
  const avgPagesPerSession =
    sessionCount > 0 && totalPages > 0 ? Math.round(totalPages / sessionCount) : null

  const longestSessionMinutes = longestDuration > 0 ? Math.round(longestDuration / 60) : null

  // Most read author: count finished books per author, tie-break alphabetically
  const authorCounts = new Map<string, number>()
  for (const book of finishedBooks) {
    if (!book.author) continue
    // Handle multi-author strings ("Author A, Author B" or "Author A & Author B")
    for (const name of book.author.split(/,\s*|\s+&\s+/)) {
      const trimmed = name.trim()
      if (trimmed) {
        authorCounts.set(trimmed, (authorCounts.get(trimmed) ?? 0) + 1)
      }
    }
  }

  let mostReadAuthor: string | null = null
  if (authorCounts.size > 0) {
    const sorted = Array.from(authorCounts.entries()).sort(([nameA, countA], [nameB, countB]) => {
      if (countB !== countA) return countB - countA
      return nameA.localeCompare(nameB) // alphabetical tie-break
    })
    mostReadAuthor = sorted[0]?.[0] ?? null
  }

  return {
    booksFinishedThisYear,
    yearlyGoal,
    avgPagesPerSession,
    longestSessionMinutes,
    mostReadAuthor,
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
