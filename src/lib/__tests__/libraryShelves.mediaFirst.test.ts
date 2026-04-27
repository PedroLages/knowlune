import { describe, expect, it } from 'vitest'
import type { Book } from '@/data/types'
import {
  getAudiobookDiscoverShelf,
  getAudiobookListenAgainShelf,
  getAudiobookRecentSeriesShelf,
  getAudiobookRecentlyAddedShelf,
  getEbookDiscoverShelf,
  getEbookReadAgainShelf,
  getEbookRecentSeriesShelf,
  getEbookRecentlyAddedShelf,
} from '@/lib/libraryShelves'

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? 'Book',
    format: overrides.format ?? 'epub',
    status: overrides.status ?? 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/tmp/book' },
    progress: overrides.progress ?? 0,
    createdAt: overrides.createdAt ?? '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('libraryShelves (media-first helpers)', () => {
  it('getAudiobookRecentlyAddedShelf filters to audiobooks and sorts by createdAt desc', () => {
    const books: Book[] = [
      makeBook({ id: 'e1', format: 'epub', createdAt: '2026-04-10T00:00:00.000Z' }),
      makeBook({ id: 'a1', format: 'audiobook', createdAt: '2026-04-11T00:00:00.000Z' }),
      makeBook({ id: 'a2', format: 'audiobook', createdAt: '2026-04-12T00:00:00.000Z' }),
    ]
    expect(getAudiobookRecentlyAddedShelf(books).map(b => b.id)).toEqual(['a2', 'a1'])
  })

  it('getEbookRecentlyAddedShelf filters to epub/pdf and sorts by createdAt desc', () => {
    const books: Book[] = [
      makeBook({ id: 'a1', format: 'audiobook', createdAt: '2026-04-12T00:00:00.000Z' }),
      makeBook({ id: 'p1', format: 'pdf', createdAt: '2026-04-11T00:00:00.000Z' }),
      makeBook({ id: 'e1', format: 'epub', createdAt: '2026-04-13T00:00:00.000Z' }),
    ]
    expect(getEbookRecentlyAddedShelf(books).map(b => b.id)).toEqual(['e1', 'p1'])
  })

  it('getAudiobookDiscoverShelf excludes in-progress and finished items', () => {
    const books: Book[] = [
      makeBook({
        id: 'discover',
        format: 'audiobook',
        status: 'unread',
        progress: 0,
        createdAt: '2026-04-12T00:00:00.000Z',
      }),
      makeBook({
        id: 'in-progress',
        format: 'audiobook',
        status: 'reading',
        progress: 25,
        lastOpenedAt: '2026-04-13T00:00:00.000Z',
      }),
      makeBook({
        id: 'finished',
        format: 'audiobook',
        status: 'finished',
        progress: 100,
        finishedAt: '2026-04-14T00:00:00.000Z',
      }),
    ]
    expect(getAudiobookDiscoverShelf(books).map(b => b.id)).toEqual(['discover'])
  })

  it('getEbookDiscoverShelf excludes in-progress and finished items', () => {
    const books: Book[] = [
      makeBook({
        id: 'discover',
        format: 'epub',
        status: 'unread',
        progress: 0,
        createdAt: '2026-04-12T00:00:00.000Z',
      }),
      makeBook({
        id: 'in-progress',
        format: 'pdf',
        status: 'reading',
        progress: 10,
        lastOpenedAt: '2026-04-13T00:00:00.000Z',
      }),
      makeBook({
        id: 'finished',
        format: 'epub',
        status: 'finished',
        progress: 100,
        finishedAt: '2026-04-14T00:00:00.000Z',
      }),
    ]
    expect(getEbookDiscoverShelf(books).map(b => b.id)).toEqual(['discover'])
  })

  it('getAudiobookListenAgainShelf returns finished audiobooks sorted by finishedAt desc', () => {
    const books: Book[] = [
      makeBook({ id: 'a1', format: 'audiobook', status: 'finished', progress: 100, finishedAt: '2026-04-10T00:00:00.000Z' }),
      makeBook({ id: 'a2', format: 'audiobook', status: 'finished', progress: 100, finishedAt: '2026-04-12T00:00:00.000Z' }),
      makeBook({ id: 'e1', format: 'epub', status: 'finished', progress: 100, finishedAt: '2026-04-13T00:00:00.000Z' }),
    ]
    expect(getAudiobookListenAgainShelf(books).map(b => b.id)).toEqual(['a2', 'a1'])
  })

  it('getEbookReadAgainShelf returns finished ebooks sorted by finishedAt desc', () => {
    const books: Book[] = [
      makeBook({ id: 'p1', format: 'pdf', status: 'finished', progress: 100, finishedAt: '2026-04-10T00:00:00.000Z' }),
      makeBook({ id: 'e1', format: 'epub', status: 'finished', progress: 100, finishedAt: '2026-04-12T00:00:00.000Z' }),
      makeBook({ id: 'a1', format: 'audiobook', status: 'finished', progress: 100, finishedAt: '2026-04-13T00:00:00.000Z' }),
    ]
    expect(getEbookReadAgainShelf(books).map(b => b.id)).toEqual(['e1', 'p1'])
  })

  it('recent series shelves group by series and sort groups by most recent activity', () => {
    const books: Book[] = [
      makeBook({
        id: 's1b1',
        format: 'audiobook',
        series: 'Series One',
        seriesSequence: '1',
        lastOpenedAt: '2026-04-10T00:00:00.000Z',
      }),
      makeBook({
        id: 's1b2',
        format: 'audiobook',
        series: 'Series One',
        seriesSequence: '2',
        lastOpenedAt: '2026-04-11T00:00:00.000Z',
      }),
      makeBook({
        id: 's2b1',
        format: 'audiobook',
        series: 'Series Two',
        seriesSequence: '1',
        lastOpenedAt: '2026-04-12T00:00:00.000Z',
      }),
    ]

    const groups = getAudiobookRecentSeriesShelf(books)
    expect(groups.map(g => g.name)).toEqual(['Series Two', 'Series One'])
    // Series One books should be sorted by seriesSequence asc
    const seriesOne = groups.find(g => g.name === 'Series One')
    expect(seriesOne?.books.map(b => b.id)).toEqual(['s1b1', 's1b2'])
  })

  it('ebook recent series shelf filters to epub/pdf only', () => {
    const books: Book[] = [
      makeBook({ id: 'a1', format: 'audiobook', series: 'Audio Series', lastOpenedAt: '2026-04-12T00:00:00.000Z' }),
      makeBook({ id: 'e1', format: 'epub', series: 'E Series', lastOpenedAt: '2026-04-11T00:00:00.000Z' }),
    ]
    const groups = getEbookRecentSeriesShelf(books)
    expect(groups.map(g => g.name)).toEqual(['E Series'])
  })
})

