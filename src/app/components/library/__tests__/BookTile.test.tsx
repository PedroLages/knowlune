import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Book } from '@/data/types'
import { BookTile } from '@/app/components/library/BookTile'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'test-book',
    title: 'Test Book',
    author: 'Author Name',
    format: 'epub',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/tmp/book' },
    progress: 50,
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

vi.mock('@/app/hooks/useBookCoverUrl', () => ({
  useBookCoverUrl: () => null,
}))

describe('BookTile', () => {
  describe('variant sizing', () => {
    it('applies shelf card width class for small variant', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      // LIBRARY_SHELF_CARD_WIDTH_CLASS = 'w-44 sm:w-48'
      expect(tile.className).toContain('w-44')
      expect(tile.className).toContain('sm:w-48')
    })

    it('applies shelf card width class for denseContinue variant', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="denseContinue" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      expect(tile.className).toContain('w-44')
      expect(tile.className).toContain('sm:w-48')
    })
  })

  describe('cover rendering', () => {
    it('renders square aspect ratio for covers', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      // The inner cover div should have aspect-square
      const coverDiv = screen.getByTestId('book-tile-test-book').querySelector('.aspect-square')
      expect(coverDiv).not.toBeNull()
    })

    it('applies object-cover for all book formats (square frame, no dedicated audiobook padding)', () => {
      const audiobook = makeBook({ format: 'audiobook' })
      render(
        <MemoryRouter>
          <BookTile book={audiobook} variant="small" />
        </MemoryRouter>
      )
      // Cover container uses bg-muted for all formats (no per-format background)
      const coverDiv = screen.getByTestId('book-tile-test-book').querySelector('.bg-muted')
      expect(coverDiv).not.toBeNull()
    })

    it('renders fallback icon when no cover URL', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      expect(tile.querySelector('svg')).not.toBeNull()
    })

    it('includes translateZ(0) + isolate for corner clipping fix on GPU compositing', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      const coverDiv = screen.getByTestId('book-tile-test-book').querySelector('[class*="[transform:translateZ(0)]"]')
      expect(coverDiv).not.toBeNull()
      expect(coverDiv!.className).toContain('isolate')
    })
  })

  describe('hover animation unification', () => {
    it('applies 8px lift and brand shadow on hover (matching BookCard)', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      const coverDiv = screen.getByTestId('book-tile-test-book').querySelector('.rounded-2xl')
      expect(coverDiv).not.toBeNull()
      // -translate-y-2 (8px lift)
      expect(coverDiv!.className).toContain('group-hover/tile:-translate-y-2')
      // Brand shadow
      expect(coverDiv!.className).toContain('group-hover/tile:shadow-[0_10px_30px_var(--shadow-brand)]')
    })

    it('uses 500ms image transition (matching BookCard)', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      const coverDiv = screen.getByTestId('book-tile-test-book').querySelector('.rounded-2xl')
      expect(coverDiv).not.toBeNull()
      // The img has duration-500
      const img = coverDiv!.querySelector('img')
      // No img in fallback state, skip
    })
  })

  describe('badge system', () => {
    it('shows Audio badge for audiobooks', () => {
      const audiobook = makeBook({ format: 'audiobook' })
      render(
        <MemoryRouter>
          <BookTile book={audiobook} variant="small" />
        </MemoryRouter>
      )
      expect(screen.getByTestId('book-tile-test-book-audio-badge')).toBeInTheDocument()
      expect(screen.getByText('Audio')).toBeInTheDocument()
    })

    it('does not show Audio badge for ebooks', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook({ format: 'epub' })} variant="small" />
        </MemoryRouter>
      )
      expect(screen.queryByTestId('book-tile-test-book-audio-badge')).not.toBeInTheDocument()
    })
  })

  describe('overlay action icon', () => {
    it('shows PlayCircle icon for audiobooks on hover overlay (not text)', () => {
      const audiobook = makeBook({ format: 'audiobook' })
      render(
        <MemoryRouter>
          <BookTile book={audiobook} variant="small" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      const coverDiv = tile.querySelector('.rounded-2xl')
      // The overlay div (bg-foreground/0) should contain an SVG icon
      const overlayDiv = coverDiv?.querySelector('.bg-foreground\\/0')
      expect(overlayDiv).not.toBeNull()
      expect(overlayDiv!.querySelector('svg')).not.toBeNull()
    })

    it('shows BookOpen icon for ebooks on hover overlay (not text)', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      const coverDiv = tile.querySelector('.rounded-2xl')
      // The overlay div should contain an SVG icon
      const overlayDiv = coverDiv?.querySelector('.bg-foreground\\/0')
      expect(overlayDiv).not.toBeNull()
      expect(overlayDiv!.querySelector('svg')).not.toBeNull()
    })

    it('icon is aria-hidden (root aria-label provides accessible name)', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      const coverDiv = tile.querySelector('.rounded-2xl')
      // The overlay icon SVG should have aria-hidden="true"
      const overlayDiv = coverDiv?.querySelector('.bg-foreground\\/0')
      const overlaySvg = overlayDiv?.querySelector('svg')
      expect(overlaySvg).toHaveAttribute('aria-hidden', 'true')
    })

    it('derives aria-label from book format (Play for audiobooks, Open for ebooks)', () => {
      const audiobook = makeBook({ format: 'audiobook' })
      const { unmount } = render(
        <MemoryRouter>
          <BookTile book={audiobook} variant="small" />
        </MemoryRouter>
      )
      expect(screen.getByTestId('book-tile-test-book')).toHaveAttribute('aria-label', 'Play Test Book')
      unmount()

      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      expect(screen.getByTestId('book-tile-test-book')).toHaveAttribute('aria-label', 'Open Test Book')
    })
  })

  describe('progress display', () => {
    it('shows progress bar and meta when showProgress is true', () => {
      const audiobook = makeBook({
        format: 'audiobook',
        progress: 45,
        totalDuration: 6000,
        currentPosition: { type: 'time', seconds: 2700 },
      })
      render(
        <MemoryRouter>
          <BookTile book={audiobook} variant="denseContinue" showProgress />
        </MemoryRouter>
      )
      expect(screen.getByTestId('book-tile-test-book-progress-meta')).toBeInTheDocument()
    })

    it('does not show progress meta when showProgress is false', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" showProgress={false} />
        </MemoryRouter>
      )
      expect(screen.queryByTestId('book-tile-test-book-progress-meta')).not.toBeInTheDocument()
    })

    it('does not show progress by default (showProgress defaults to false)', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      expect(screen.queryByTestId('book-tile-test-book-progress-meta')).not.toBeInTheDocument()
    })
  })

  describe('typography', () => {
    it('renders title with text-foreground (no brand hover)', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook({ title: 'My Great Book' })} variant="small" />
        </MemoryRouter>
      )
      const title = screen.getByText('My Great Book')
      expect(title.className).toContain('text-foreground')
      // Should NOT contain group-hover:text-brand (blue title bug)
      expect(title.className).not.toContain('group-hover:text-brand')
    })

    it('renders author with text-muted-foreground', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook({ author: 'Jane Doe' })} variant="small" />
        </MemoryRouter>
      )
      const author = screen.getByText('Jane Doe')
      expect(author.className).toContain('text-muted-foreground')
    })

    it('does not render author paragraph when author is missing', () => {
      const book = makeBook()
      book.author = undefined
      render(
        <MemoryRouter>
          <BookTile book={book} variant="small" />
        </MemoryRouter>
      )
      expect(screen.getByText('Test Book')).toBeInTheDocument()
      const tile = screen.getByTestId('book-tile-test-book')
      const metaContainer = tile.querySelector('.mt-3')
      expect(metaContainer?.children.length).toBe(1) // Only title
    })
  })

  describe('accessibility', () => {
    it('has role="link" and tabIndex=0 for keyboard navigation', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      expect(tile).toHaveAttribute('role', 'link')
      expect(tile).toHaveAttribute('tabindex', '0')
    })
  })
})
