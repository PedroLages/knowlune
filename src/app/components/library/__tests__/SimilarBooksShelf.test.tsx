import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Book } from '@/data/types'
import type { SimilarBook } from '@/lib/similarity'
import { SimilarBooksShelf } from '@/app/components/library/SimilarBooksShelf'

vi.mock('@/app/hooks/useBookCoverUrl', () => ({
  useBookCoverUrl: () => null,
}))

function minimalBook(id: string, format: Book['format']): Book {
  return {
    id,
    title: `Title ${id}`,
    author: 'Author',
    format,
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/test' },
    progress: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function wrapSimilar(book: Book): SimilarBook {
  return { book, tier: 'keyword', score: 1 }
}

describe('SimilarBooksShelf', () => {
  it('returns null when there are no similar books', () => {
    const { container } = render(
      <MemoryRouter>
        <SimilarBooksShelf similarBooks={[]} />
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('uses LibraryRail shell with hover rail group class', () => {
    render(
      <MemoryRouter>
        <SimilarBooksShelf similarBooks={[wrapSimilar(minimalBook('a', 'epub'))]} />
      </MemoryRouter>
    )

    const shelf = screen.getByTestId('similar-books-shelf')
    expect(shelf.tagName.toLowerCase()).toBe('section')
    expect(shelf.className).toContain('group/rail')
  })

  it('applies scrollbar-none to the viewport', () => {
    render(
      <MemoryRouter>
        <SimilarBooksShelf similarBooks={[wrapSimilar(minimalBook('a', 'epub'))]} />
      </MemoryRouter>
    )

    expect(screen.getByTestId('similar-books-shelf-scroller').className).toContain(
      'scrollbar-none'
    )
  })

  it('renders audiobook and epub tiles with square covers and data-rail-tile', () => {
    render(
      <MemoryRouter>
        <SimilarBooksShelf
          similarBooks={[
            wrapSimilar(minimalBook('audio-id', 'audiobook')),
            wrapSimilar(minimalBook('epub-id', 'epub')),
          ]}
        />
      </MemoryRouter>
    )

    const audioCard = screen.getByTestId('similar-book-audio-id')
    const epubCard = screen.getByTestId('similar-book-epub-id')

    expect(audioCard).toHaveAttribute('data-rail-tile')
    expect(epubCard).toHaveAttribute('data-rail-tile')

    const audioCover = screen.getByTestId('similar-book-audio-id-cover')
    const epubCover = screen.getByTestId('similar-book-epub-id-cover')
    for (const cover of [audioCover, epubCover]) {
      expect(cover).toHaveClass('aspect-square')
      expect(cover).not.toHaveClass('aspect-[2/3]')
    }
  })

  it('renders pdf format tile with square cover', () => {
    render(
      <MemoryRouter>
        <SimilarBooksShelf similarBooks={[wrapSimilar(minimalBook('pdf-id', 'pdf'))]} />
      </MemoryRouter>
    )

    expect(screen.getByTestId('similar-book-pdf-id-cover')).toHaveClass('aspect-square')
    expect(screen.getByTestId('similar-book-pdf-id-cover')).not.toHaveClass('aspect-[2/3]')
  })
})
