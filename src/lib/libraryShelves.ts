import type { Book } from '@/data/types'

const DEFAULT_CONTINUE_LIMIT = 12
const DEFAULT_RECENTLY_ADDED_LIMIT = 12
const DEFAULT_RECENTLY_FINISHED_LIMIT = 8
const DEFAULT_RECENT_SERIES_LIMIT = 10
const DEFAULT_DISCOVER_LIMIT = 12
const DEFAULT_AGAIN_LIMIT = 12
const RECENTLY_FINISHED_WINDOW_DAYS = 90

function toTimestamp(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function isInProgress(book: Book): boolean {
  return book.progress > 0 && book.progress < 100 && book.status !== 'finished'
}

function sortByLastOpenedDesc(a: Book, b: Book): number {
  return toTimestamp(b.lastOpenedAt) - toTimestamp(a.lastOpenedAt)
}

function isFinished(book: Book): boolean {
  return book.status === 'finished' || book.progress >= 100
}

function isEbook(book: Book): boolean {
  return book.format === 'epub' || book.format === 'pdf'
}

function isAudiobook(book: Book): boolean {
  return book.format === 'audiobook'
}

function getBookActivityTimestamp(book: Book): number {
  return Math.max(toTimestamp(book.lastOpenedAt), toTimestamp(book.finishedAt), toTimestamp(book.createdAt))
}

export function getContinueListeningShelf(
  books: Book[],
  limit = DEFAULT_CONTINUE_LIMIT
): Book[] {
  return books
    .filter(book => book.format === 'audiobook' && !!book.lastOpenedAt && isInProgress(book))
    .sort(sortByLastOpenedDesc)
    .slice(0, limit)
}

export function getContinueReadingShelf(books: Book[], limit = DEFAULT_CONTINUE_LIMIT): Book[] {
  return books
    .filter(
      book =>
        (book.format === 'epub' || book.format === 'pdf') && !!book.lastOpenedAt && isInProgress(book)
    )
    .sort(sortByLastOpenedDesc)
    .slice(0, limit)
}

export function getRecentlyAddedShelf(books: Book[], limit = DEFAULT_RECENTLY_ADDED_LIMIT): Book[] {
  return [...books]
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
    .slice(0, limit)
}

export function getRecentlyFinishedShelf(
  books: Book[],
  limit = DEFAULT_RECENTLY_FINISHED_LIMIT
): Book[] {
  const cutoff = Date.now() - RECENTLY_FINISHED_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return books
    .filter(book => {
      if (book.status !== 'finished' || !book.finishedAt) return false
      const finishedAt = toTimestamp(book.finishedAt)
      return finishedAt > cutoff
    })
    .sort((a, b) => toTimestamp(b.finishedAt) - toTimestamp(a.finishedAt))
    .slice(0, limit)
}

// ─── Media-first (Stitch D) format-aware shelves ─────────────────────────────

export interface RecentSeriesGroup {
  name: string
  books: Book[] // sorted by seriesSequence (as in useBookStore.getBooksBySeries)
  activityAt: number // epoch ms of most recent activity among books
}

function sortBooksBySeriesSequenceAsc(books: Book[]): Book[] {
  return [...books].sort((a, b) => {
    const rawA = a.seriesSequence != null ? parseFloat(a.seriesSequence) : Number.NaN
    const rawB = b.seriesSequence != null ? parseFloat(b.seriesSequence) : Number.NaN
    const seqA = Number.isNaN(rawA) ? Number.POSITIVE_INFINITY : rawA
    const seqB = Number.isNaN(rawB) ? Number.POSITIVE_INFINITY : rawB
    if (seqA !== seqB) return seqA - seqB
    return (a.seriesSequence ?? '').localeCompare(b.seriesSequence ?? '')
  })
}

function getRecentSeriesGroups(
  books: Book[],
  isFormatMatch: (b: Book) => boolean,
  limit = DEFAULT_RECENT_SERIES_LIMIT
): RecentSeriesGroup[] {
  const seriesMap = new Map<string, { displayName: string; books: Book[] }>()
  for (const book of books) {
    if (!isFormatMatch(book)) continue
    if (!book.series) continue
    const key = book.series.trim().toLowerCase()
    const existing = seriesMap.get(key)
    if (existing) {
      existing.books.push(book)
    } else {
      seriesMap.set(key, { displayName: book.series, books: [book] })
    }
  }

  const groups: RecentSeriesGroup[] = []
  for (const { displayName, books: seriesBooks } of seriesMap.values()) {
    const sorted = sortBooksBySeriesSequenceAsc(seriesBooks)
    const activityAt = Math.max(...sorted.map(getBookActivityTimestamp))
    groups.push({ name: displayName, books: sorted, activityAt })
  }

  return groups.sort((a, b) => b.activityAt - a.activityAt).slice(0, limit)
}

function sortByFinishedThenLastOpenedDesc(a: Book, b: Book): number {
  const aFinished = toTimestamp(a.finishedAt)
  const bFinished = toTimestamp(b.finishedAt)
  if (aFinished !== bFinished) return bFinished - aFinished
  return toTimestamp(b.lastOpenedAt) - toTimestamp(a.lastOpenedAt)
}

export function getAudiobookRecentlyAddedShelf(
  books: Book[],
  limit = DEFAULT_RECENTLY_ADDED_LIMIT
): Book[] {
  return books
    .filter(isAudiobook)
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
    .slice(0, limit)
}

export function getEbookRecentlyAddedShelf(books: Book[], limit = DEFAULT_RECENTLY_ADDED_LIMIT): Book[] {
  return books
    .filter(isEbook)
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
    .slice(0, limit)
}

export function getAudiobookRecentSeriesShelf(
  books: Book[],
  limit = DEFAULT_RECENT_SERIES_LIMIT
): RecentSeriesGroup[] {
  return getRecentSeriesGroups(books, isAudiobook, limit)
}

export function getEbookRecentSeriesShelf(
  books: Book[],
  limit = DEFAULT_RECENT_SERIES_LIMIT
): RecentSeriesGroup[] {
  return getRecentSeriesGroups(books, isEbook, limit)
}

export function getAudiobookDiscoverShelf(books: Book[], limit = DEFAULT_DISCOVER_LIMIT): Book[] {
  return books
    .filter(
      b =>
        isAudiobook(b) &&
        !isFinished(b) &&
        !isInProgress(b) &&
        (b.status === 'unread' || b.progress === 0)
    )
    .sort((a, b) => getBookActivityTimestamp(b) - getBookActivityTimestamp(a))
    .slice(0, limit)
}

export function getEbookDiscoverShelf(books: Book[], limit = DEFAULT_DISCOVER_LIMIT): Book[] {
  return books
    .filter(
      b =>
        isEbook(b) &&
        !isFinished(b) &&
        !isInProgress(b) &&
        (b.status === 'unread' || b.progress === 0)
    )
    .sort((a, b) => getBookActivityTimestamp(b) - getBookActivityTimestamp(a))
    .slice(0, limit)
}

export function getAudiobookListenAgainShelf(books: Book[], limit = DEFAULT_AGAIN_LIMIT): Book[] {
  return books
    .filter(b => isAudiobook(b) && isFinished(b))
    .sort(sortByFinishedThenLastOpenedDesc)
    .slice(0, limit)
}

export function getEbookReadAgainShelf(books: Book[], limit = DEFAULT_AGAIN_LIMIT): Book[] {
  return books
    .filter(b => isEbook(b) && isFinished(b))
    .sort(sortByFinishedThenLastOpenedDesc)
    .slice(0, limit)
}
