/**
 * usePagesReadToday — compute pages read today from book position changes.
 *
 * Scans all reading sessions from today and estimates pages using the user's
 * actual reading speed from completed books (if available), or falls back to
 * a 2 min/page heuristic for new users without reading history.
 *
 * For EPUB books, uses the `currentPage` estimate from reading position.
 * For PDF books, uses page number directly from ContentPosition.
 *
 * Sessions shorter than 30 seconds are already excluded at save-time by
 * useReadingSession, so they won't appear in studySessions at all.
 *
 * @module usePagesReadToday
 * @since E108-S05, updated E112-S01
 */
import { useEffect, useRef, useState } from 'react'
import { db } from '@/db/schema'
import { toLocalDateString } from '@/lib/studyLog'
import { computeAverageReadingSpeed } from '@/services/ReadingStatsService'

/** Minimum session duration in seconds to count toward pages estimate */
const MIN_SESSION_SECONDS = 30

/** Fallback heuristic: 2 minutes per page (used when no reading speed data exists) */
const FALLBACK_MIN_PER_PAGE = 2

/**
 * Shared helper: estimate pages read from a list of sessions.
 * Uses user-specific reading speed if available, otherwise falls back to 2 min/page.
 * Caps the estimate at currentPage to avoid over-counting.
 *
 * NOTE: Sessions < 30 seconds are filtered (accidental opens without reading).
 */
function estimatePagesFromSessions(
  sessions: { duration?: number | null }[],
  currentPage: number,
  minPerPage: number
): number {
  const qualifiedSessions = sessions.filter(s => (s.duration ?? 0) >= MIN_SESSION_SECONDS)
  if (qualifiedSessions.length === 0) return 0
  const totalMinutes = qualifiedSessions.reduce((sum, s) => sum + (s.duration ?? 0), 0) / 60
  const pagesEstimate = Math.round(totalMinutes / minPerPage)
  return Math.min(pagesEstimate, currentPage)
}

/**
 * Fetch pages read today across all books.
 *
 * Batches all studySessions queries into a single Dexie query filtered by
 * courseId = '' (the book session sentinel — see useReadingSession.ts:59)
 * and today's date, then groups results by contentItemId (bookId).
 *
 * Strategy: sum `duration` from today's book sessions and estimate pages using
 * the user's actual reading speed (pages/hour from completed books), or fall back
 * to 2 min/page for new users. Since no granular page-change log exists, this is
 * the best available approximation without significant architectural changes.
 */
export async function getPagesReadToday(): Promise<number> {
  const todayStr = toLocalDateString(new Date())
  const books = await db.books.toArray()

  // Get user's actual reading speed (pages/hour) or fall back to 2 min/page heuristic
  const avgSpeedPagesPerHour = await computeAverageReadingSpeed()
  const minPerPage = avgSpeedPagesPerHour ? 60 / avgSpeedPagesPerHour : FALLBACK_MIN_PER_PAGE

  // Batch query: fetch ALL book study sessions for today in one Dexie query
  // courseId = '' is the sentinel for book sessions (set in useReadingSession.ts)
  const todaySessions = await db.studySessions
    .where('courseId')
    .equals('')
    .filter(s => {
      if (!s.startTime) return false
      return toLocalDateString(new Date(s.startTime)) === todayStr
    })
    .toArray()

  // Group sessions by contentItemId (bookId) for O(1) lookup per book
  const sessionsByBookId = new Map<string, typeof todaySessions>()
  for (const session of todaySessions) {
    const bookId = session.contentItemId
    if (!bookId) continue
    if (!sessionsByBookId.has(bookId)) {
      sessionsByBookId.set(bookId, [])
    }
    sessionsByBookId.get(bookId)!.push(session)
  }

  let totalPages = 0

  for (const book of books) {
    if (!book.currentPosition || !book.lastOpenedAt) continue
    const lastOpenedDate = toLocalDateString(new Date(book.lastOpenedAt))
    if (lastOpenedDate !== todayStr) continue

    const bookSessions = sessionsByBookId.get(book.id) ?? []
    if (bookSessions.length === 0) continue

    // For PDF books with page-type position
    if (book.currentPosition.type === 'page' && book.totalPages) {
      const currentPage = book.currentPosition.pageNumber
      totalPages += estimatePagesFromSessions(bookSessions, currentPage, minPerPage)
    }

    // For EPUB books — estimate pages from progress delta
    if (book.currentPosition.type === 'cfi' && book.totalPages) {
      const currentPage = Math.round((book.progress / 100) * book.totalPages)
      totalPages += estimatePagesFromSessions(bookSessions, currentPage, minPerPage)
    }
  }

  return totalPages
}

/**
 * React hook: returns estimated pages read today.
 * Refreshes every 60 seconds to reflect reading progress without a full remount.
 */
export function usePagesReadToday(): number {
  const [pages, setPages] = useState(0)
  const ignoreRef = useRef(false)

  useEffect(() => {
    ignoreRef.current = false

    const fetchPages = () => {
      getPagesReadToday()
        .then(p => {
          if (!ignoreRef.current) setPages(p)
        })
        .catch(() => {
          // silent-catch-ok: pages estimate failure degrades gracefully
          if (!ignoreRef.current) setPages(0)
        })
    }

    fetchPages()
    const intervalId = setInterval(fetchPages, 60_000)

    return () => {
      ignoreRef.current = true
      clearInterval(intervalId)
    }
  }, [])

  return pages
}
