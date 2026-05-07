import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Book } from '@/data/types'
import { BookCard } from '@/app/components/library/BookCard'

function makeBook(overrides: Partial<Book> = {}): Book {
  const now = new Date().toISOString()
  return {
    id: 'bc-1',
    title: 'Sample Title',
    author: 'Sample Author',
    format: 'epub',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/tmp/book' },
    progress: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

vi.mock('@/app/hooks/useBookCoverUrl', () => ({
  useBookCoverUrl: () => null,
}))

vi.mock('@/stores/useBookReviewStore', () => ({
  useBookReviewStore: (selector: (s: { getReviewForBook: (id: string) => undefined }) => unknown) => {
    const state = { getReviewForBook: () => undefined as undefined }
    return selector(state)
  },
}))

describe('BookCard', () => {
  it('shows Audio format badge for audiobooks', () => {
    render(
      <MemoryRouter>
        <BookCard book={makeBook({ format: 'audiobook', id: 'audio-1' })} />
      </MemoryRouter>
    )
    expect(screen.getByLabelText('Audio format')).toBeInTheDocument()
  })

  it('shows Ebook format badge for non-audiobook formats', () => {
    render(
      <MemoryRouter>
        <BookCard book={makeBook({ format: 'epub' })} />
      </MemoryRouter>
    )
    expect(screen.getByLabelText('Ebook format')).toBeInTheDocument()
  })

  it('does not show NEW label for recently added audiobook with zero progress', () => {
    render(
      <MemoryRouter>
        <BookCard
          book={makeBook({
            format: 'audiobook',
            progress: 0,
            createdAt: new Date().toISOString(),
          })}
        />
      </MemoryRouter>
    )
    expect(screen.queryByText('NEW')).not.toBeInTheDocument()
  })

  it('does not show NEW label for recently added ebook with zero progress', () => {
    render(
      <MemoryRouter>
        <BookCard
          book={makeBook({
            format: 'epub',
            progress: 0,
            createdAt: new Date().toISOString(),
          })}
        />
      </MemoryRouter>
    )
    expect(screen.queryByText('NEW')).not.toBeInTheDocument()
  })
})
