import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Book } from '@/data/types'
import { LibraryMediaShelfColumn } from '@/app/components/library/LibraryMediaShelfColumn'

type StoreState = {
  books: Book[]
  filters: { format?: string[]; source?: 'all' | 'local' | 'audiobookshelf' }
}

const { store } = vi.hoisted(() => ({
  store: {
    books: [] as Book[],
    filters: { format: ['audiobook'] } as StoreState['filters'],
  },
}))

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? 'Book',
    format: overrides.format ?? 'audiobook',
    status: overrides.status ?? 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/tmp/book' },
    progress: overrides.progress ?? 0,
    createdAt: overrides.createdAt ?? '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

vi.mock('@/stores/useBookStore', () => ({
  useBookStore: (selector: (s: StoreState) => unknown) => selector(store),
}))

vi.mock('@/app/hooks/useBookCoverUrl', () => ({
  useBookCoverUrl: () => null,
}))

describe('LibraryMediaShelfColumn', () => {
  beforeEach(() => {
    store.books.length = 0
    store.filters = { format: ['audiobook'] }

    store.books.push(
      // Continue listening
      makeBook({
        id: 'audio-continue',
        format: 'audiobook',
        status: 'reading',
        progress: 30,
        lastOpenedAt: '2026-04-27T12:00:00.000Z',
        totalDuration: 4000,
        currentPosition: { type: 'time', seconds: 1200 },
      }),
      // Recently added (also discover candidate)
      makeBook({
        id: 'audio-recent',
        format: 'audiobook',
        status: 'unread',
        progress: 0,
        createdAt: '2026-04-27T11:00:00.000Z',
        series: 'Audio Series',
        seriesSequence: '1',
      }),
      // Listen again
      makeBook({
        id: 'audio-finished',
        format: 'audiobook',
        status: 'finished',
        progress: 100,
        finishedAt: '2026-04-20T00:00:00.000Z',
        series: 'Audio Series',
        seriesSequence: '2',
      })
    )
  })

  it('renders required audiobook section labels when shelves have content', () => {
    render(
      <MemoryRouter>
        <LibraryMediaShelfColumn />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /continue listening/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /recently added/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /recent series/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /discover/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /listen again/i })).toBeInTheDocument()
  })

  it('switches headings for ebooks mode', () => {
    store.filters = { format: ['epub', 'pdf'] }
    store.books.push(
      makeBook({
        id: 'ebook-continue',
        format: 'epub',
        status: 'reading',
        progress: 50,
        lastOpenedAt: '2026-04-27T10:00:00.000Z',
        totalPages: 200,
        currentPosition: { type: 'page', pageNumber: 50 },
      }),
      makeBook({
        id: 'ebook-finished',
        format: 'pdf',
        status: 'finished',
        progress: 100,
        finishedAt: '2026-04-22T00:00:00.000Z',
      })
    )

    render(
      <MemoryRouter>
        <LibraryMediaShelfColumn />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /continue reading/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /read again/i })).toBeInTheDocument()
  })

  it('renders BookTile for Continue shelf with denseContinue variant', () => {
    render(
      <MemoryRouter>
        <LibraryMediaShelfColumn />
      </MemoryRouter>
    )

    // The continue book appears in both shelves; at least one entry in Continue shelf has progress
    const tiles = screen.getAllByTestId('book-tile-audio-continue')
    expect(tiles.length).toBeGreaterThanOrEqual(1)
    // Progress meta should be present for denseContinue variant (only Continue shelf has this)
    expect(screen.getByTestId('book-tile-audio-continue-progress-meta')).toBeInTheDocument()
    expect(screen.getAllByTestId('book-tile-audio-continue-audio-badge').length).toBeGreaterThanOrEqual(1)
  })

  it('renders BookTile for Recently Added shelf with small variant', () => {
    render(
      <MemoryRouter>
        <LibraryMediaShelfColumn />
      </MemoryRouter>
    )

    // The recently added book should be a BookTile
    const recentTiles = screen.getAllByTestId('book-tile-audio-recent')
    expect(recentTiles.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('book-tile-audio-recent-audio-badge').length).toBeGreaterThanOrEqual(1)
    // Progress should not be present on small variant (only on Continue variant)
    expect(screen.queryByTestId('book-tile-audio-recent-progress-meta')).not.toBeInTheDocument()
  })

  it('applies muted tone to Listen Again shelf cards', () => {
    render(
      <MemoryRouter>
        <LibraryMediaShelfColumn />
      </MemoryRouter>
    )
    const again = screen.getByTestId('recent-book-card-audio-finished')
    expect(again).toHaveAttribute('data-tone', 'muted')
  })
})

