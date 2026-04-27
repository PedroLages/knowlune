import type { Book } from '@/data/types'

const DEFAULT_CONTINUE_LIMIT = 12
const DEFAULT_RECENTLY_ADDED_LIMIT = 12
const DEFAULT_RECENTLY_FINISHED_LIMIT = 8
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
