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
    it('applies small width class for small variant', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      expect(tile.className).toContain('w-32')
    })

    it('applies denseContinue width class for denseContinue variant', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="denseContinue" overlayAction="Continue" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      expect(tile.className).toContain('w-36')
    })
  })

  describe('cover rendering', () => {
    it('renders 2:3 portrait frame for covers', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      // The inner cover div should have aspect-[2/3]
      const coverDiv = screen.getByTestId('book-tile-test-book').querySelector('.aspect-\\[2\\/3\\]')
      expect(coverDiv).not.toBeNull()
    })

    it('applies object-contain and padding for audiobooks', () => {
      const audiobook = makeBook({ format: 'audiobook' })
      render(
        <MemoryRouter>
          <BookTile book={audiobook} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      // Audiobook cover should use bg-brand-soft
      const coverDiv = screen.getByTestId('book-tile-test-book').querySelector('.bg-brand-soft')
      expect(coverDiv).not.toBeNull()
    })

    it('renders fallback icon when no cover URL', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      // Should have a fallback icon visible
      const tile = screen.getByTestId('book-tile-test-book')
      expect(tile.querySelector('svg')).not.toBeNull()
    })
  })

  describe('badge system', () => {
    it('shows Audio badge for audiobooks', () => {
      const audiobook = makeBook({ format: 'audiobook' })
      render(
        <MemoryRouter>
          <BookTile book={audiobook} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      expect(screen.getByTestId('book-tile-test-book-audio-badge')).toBeInTheDocument()
      expect(screen.getByText('Audio')).toBeInTheDocument()
    })

    it('does not show Audio badge for ebooks', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook({ format: 'epub' })} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      expect(screen.queryByTestId('book-tile-test-book-audio-badge')).not.toBeInTheDocument()
    })
  })

  describe('overlay CTA', () => {
    it('shows overlay action text', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      expect(screen.getByText('Open')).toBeInTheDocument()
    })

    it('shows Continue for Continue variant', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="denseContinue" overlayAction="Continue" />
        </MemoryRouter>
      )
      expect(screen.getByText('Continue')).toBeInTheDocument()
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
          <BookTile book={audiobook} variant="denseContinue" overlayAction="Continue" showProgress />
        </MemoryRouter>
      )
      expect(screen.getByTestId('book-tile-test-book-progress-meta')).toBeInTheDocument()
    })

    it('does not show progress meta when showProgress is false', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" overlayAction="Open" showProgress={false} />
        </MemoryRouter>
      )
      expect(screen.queryByTestId('book-tile-test-book-progress-meta')).not.toBeInTheDocument()
    })

    it('does not show progress by default (showProgress defaults to false)', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      expect(screen.queryByTestId('book-tile-test-book-progress-meta')).not.toBeInTheDocument()
    })
  })

  describe('typography', () => {
    it('renders title with text-foreground (no brand hover)', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook({ title: 'My Great Book' })} variant="small" overlayAction="Open" />
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
          <BookTile book={makeBook({ author: 'Jane Doe' })} variant="small" overlayAction="Open" />
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
          <BookTile book={book} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      // Title should be present, but no author text
      expect(screen.getByText('Test Book')).toBeInTheDocument()
      // The container has two children: title p and nothing else (no author, no progress)
      const tile = screen.getByTestId('book-tile-test-book')
      const metaContainer = tile.querySelector('.mt-3')
      expect(metaContainer?.children.length).toBe(1) // Only title
    })
  })

  describe('accessibility', () => {
    it('has role="link" and tabIndex=0 for keyboard navigation', () => {
      render(
        <MemoryRouter>
          <BookTile book={makeBook()} variant="small" overlayAction="Open" />
        </MemoryRouter>
      )
      const tile = screen.getByTestId('book-tile-test-book')
      expect(tile).toHaveAttribute('role', 'link')
      expect(tile).toHaveAttribute('tabindex', '0')
    })
  })
})
