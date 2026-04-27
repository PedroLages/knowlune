import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Book } from '@/data/types'
import {
  LibraryContinueShelves,
  LibraryDiscoveryShelves,
} from '@/app/components/library/LibraryShelves'
import { LIBRARY_SHELF_CARD_WIDTH_CLASS } from '@/app/components/library/shelfCardSizing'

const { mockBooks } = vi.hoisted(() => ({
  mockBooks: [] as Book[],
}))

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? 'Book',
    format: overrides.format ?? 'epub',
    status: overrides.status ?? 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/tmp/book.epub' },
    progress: overrides.progress ?? 0,
    createdAt: overrides.createdAt ?? '2026-04-26T00:00:00.000Z',
    ...overrides,
  }
}

vi.mock('@/stores/useBookStore', () => ({
  useBookStore: (selector: (s: { books: Book[] }) => Book[]) => selector({ books: mockBooks }),
}))

vi.mock('@/app/hooks/useBookCoverUrl', () => ({
  useBookCoverUrl: () => null,
}))

describe('LibraryShelves', () => {
  beforeEach(() => {
    mockBooks.length = 0
    mockBooks.push(
      makeBook({
        id: 'audio-continue',
        format: 'audiobook',
        status: 'reading',
        progress: 45,
        totalDuration: 4000,
        currentPosition: { type: 'time', seconds: 1200 },
        lastOpenedAt: '2026-04-27T12:00:00.000Z',
      }),
      makeBook({
        id: 'epub-continue',
        format: 'epub',
        status: 'reading',
        progress: 62,
        totalPages: 280,
        currentPosition: { type: 'page', pageNumber: 174 },
        lastOpenedAt: '2026-04-26T12:00:00.000Z',
      }),
      makeBook({
        id: 'recent-book',
        format: 'epub',
        status: 'unread',
        progress: 0,
        createdAt: '2026-04-27T11:00:00.000Z',
      }),
      makeBook({
        id: 'finished-book',
        format: 'audiobook',
        status: 'finished',
        progress: 100,
        finishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      })
    )
  })

  it('renders continue and discovery shelf headings as top-level h2 sections', () => {
    render(
      <MemoryRouter>
        <>
          <LibraryContinueShelves />
          <LibraryDiscoveryShelves />
        </>
      </MemoryRouter>
    )
    const h2s = screen.getAllByRole('heading', { level: 2 })
    const labels = h2s.map(h => h.textContent?.trim())
    expect(labels).toEqual(
      expect.arrayContaining([
        'Continue Listening(1)',
        'Continue Reading(1)',
        'Recently Added(4)',
        'Recently Finished(1)',
      ])
    )
  })

  it('uses shared shelf card width for continue and recent cards', () => {
    render(
      <MemoryRouter>
        <>
          <LibraryContinueShelves />
          <LibraryDiscoveryShelves />
        </>
      </MemoryRouter>
    )
    expect(screen.getByTestId('continue-shelf-tile-audio-continue').className).toContain(
      LIBRARY_SHELF_CARD_WIDTH_CLASS
    )
    expect(screen.getByTestId('recent-book-card-recent-book').className).toContain(
      LIBRARY_SHELF_CARD_WIDTH_CLASS
    )
  })

  it('returns null when library has no books', () => {
    mockBooks.length = 0
    const { container } = render(
      <MemoryRouter>
        <>
          <LibraryContinueShelves />
          <LibraryDiscoveryShelves />
        </>
      </MemoryRouter>
    )
    expect(container.firstChild).toBeNull()
  })
})
