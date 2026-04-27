import { describe, expect, it } from 'vitest'
import type { Book } from '@/data/types'
import {
  getContinueListeningShelf,
  getContinueReadingShelf,
  getRecentlyAddedShelf,
  getRecentlyFinishedShelf,
} from '@/lib/libraryShelves'

function makeBook(overrides: Partial<Book>): Book {
  const now = '2026-04-26T00:00:00.000Z'
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? 'Book',
    format: overrides.format ?? 'epub',
    status: overrides.status ?? 'unread',
    tags: overrides.tags ?? [],
    chapters: overrides.chapters ?? [],
    source: overrides.source ?? { type: 'local', opfsPath: '/tmp/book.epub' },
    progress: overrides.progress ?? 0,
    createdAt: overrides.createdAt ?? now,
    ...overrides,
  }
}

describe('libraryShelves selectors', () => {
  it('returns audiobook items for continue listening in last-opened order', () => {
    const books = [
      makeBook({
        id: 'a-1',
        format: 'audiobook',
        progress: 40,
        status: 'reading',
        lastOpenedAt: '2026-04-26T12:00:00.000Z',
      }),
      makeBook({
        id: 'a-2',
        format: 'audiobook',
        progress: 25,
        status: 'reading',
        lastOpenedAt: '2026-04-27T12:00:00.000Z',
      }),
      makeBook({
        id: 'a-3',
        format: 'audiobook',
        progress: 100,
        status: 'finished',
        lastOpenedAt: '2026-04-27T13:00:00.000Z',
      }),
      makeBook({
        id: 'e-1',
        format: 'epub',
        progress: 10,
        status: 'reading',
        lastOpenedAt: '2026-04-27T11:00:00.000Z',
      }),
    ]

    expect(getContinueListeningShelf(books).map(book => book.id)).toEqual(['a-2', 'a-1'])
  })

  it('returns epub/pdf items for continue reading in last-opened order', () => {
    const books = [
      makeBook({
        id: 'e-1',
        format: 'epub',
        progress: 50,
        status: 'reading',
        lastOpenedAt: '2026-04-26T10:00:00.000Z',
      }),
      makeBook({
        id: 'p-1',
        format: 'pdf',
        progress: 70,
        status: 'reading',
        lastOpenedAt: '2026-04-27T10:00:00.000Z',
      }),
      makeBook({
        id: 'a-1',
        format: 'audiobook',
        progress: 30,
        status: 'reading',
        lastOpenedAt: '2026-04-28T10:00:00.000Z',
      }),
    ]

    expect(getContinueReadingShelf(books).map(book => book.id)).toEqual(['p-1', 'e-1'])
  })

  it('sorts recently added by createdAt desc and respects limit', () => {
    const books = [
      makeBook({ id: 'b-1', createdAt: '2026-04-24T00:00:00.000Z' }),
      makeBook({ id: 'b-2', createdAt: '2026-04-26T00:00:00.000Z' }),
      makeBook({ id: 'b-3', createdAt: '2026-04-25T00:00:00.000Z' }),
    ]

    expect(getRecentlyAddedShelf(books, 2).map(book => book.id)).toEqual(['b-2', 'b-3'])
  })

  it('keeps only recently finished books from last 90 days', () => {
    const now = Date.now()
    const within90 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    const outside90 = new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString()
    const olderWithin90 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString()
    const books = [
      makeBook({ id: 'f-1', status: 'finished', finishedAt: within90 }),
      makeBook({ id: 'f-2', status: 'finished', finishedAt: olderWithin90 }),
      makeBook({ id: 'f-3', status: 'finished', finishedAt: outside90 }),
      makeBook({ id: 'r-1', status: 'reading', finishedAt: within90 }),
    ]

    expect(getRecentlyFinishedShelf(books).map(book => book.id)).toEqual(['f-1', 'f-2'])
  })
})
