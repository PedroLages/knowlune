import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { Book } from '@/data/types'
import { LibraryMediaHero } from '@/app/components/library/LibraryMediaHero'

const navigateMock = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@/app/hooks/useBookCoverUrl', () => ({
  useBookCoverUrl: () => null,
}))

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: overrides.id ?? 'book-1',
    title: overrides.title ?? 'Test title',
    author: overrides.author ?? 'Author',
    format: overrides.format ?? 'epub',
    status: overrides.status ?? 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/x' },
    progress: overrides.progress ?? 0,
    createdAt: overrides.createdAt ?? '2026-01-10T12:00:00.000Z',
    ...overrides,
  }
}

describe('LibraryMediaHero', () => {
  beforeEach(() => {
    navigateMock.mockClear()
  })

  it('prefers in-progress book with lastOpened over a newer unread book', () => {
    const books = [
      makeBook({
        id: 'unread-newer',
        title: 'Newer unread',
        status: 'unread',
        progress: 0,
        createdAt: '2026-02-01T12:00:00.000Z',
      }),
      makeBook({
        id: 'in-progress',
        title: 'In progress',
        status: 'reading',
        progress: 40,
        lastOpenedAt: '2026-01-20T12:00:00.000Z',
      }),
    ]

    render(
      <MemoryRouter>
        <LibraryMediaHero books={books} modeLabel="Ebooks" />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 2, name: 'In progress' })).toBeInTheDocument()
    const primary = screen.getByTestId('library-media-hero-primary')
    expect(primary).toHaveTextContent(/Continue reading/i)
  })

  it('shows Continue reading for unread-only ebook library', () => {
    const books = [
      makeBook({
        id: 'a',
        status: 'unread',
        progress: 0,
        createdAt: '2026-02-01T12:00:00.000Z',
      }),
    ]

    render(
      <MemoryRouter>
        <LibraryMediaHero books={books} modeLabel="Ebooks" />
      </MemoryRouter>
    )

    expect(screen.getByTestId('library-media-hero-primary')).toHaveTextContent(/Continue reading/i)
  })

  it('shows Read again for finished ebook', () => {
    const books = [
      makeBook({
        status: 'finished',
        progress: 100,
        finishedAt: '2026-01-05T12:00:00.000Z',
      }),
    ]

    render(
      <MemoryRouter>
        <LibraryMediaHero books={books} modeLabel="Ebooks" />
      </MemoryRouter>
    )

    expect(screen.getByTestId('library-media-hero-primary')).toHaveTextContent(/Read again/i)
  })

  it('shows Listen again for finished audiobook at 100% progress', () => {
    const books = [
      makeBook({
        format: 'audiobook',
        status: 'reading',
        progress: 100,
        finishedAt: '2026-01-05T12:00:00.000Z',
      }),
    ]

    render(
      <MemoryRouter>
        <LibraryMediaHero books={books} modeLabel="Audiobooks" />
      </MemoryRouter>
    )

    expect(screen.getByTestId('library-media-hero-primary')).toHaveTextContent(/Listen again/i)
  })

  it('navigates to reader when primary CTA is activated', async () => {
    const user = userEvent.setup()
    const books = [
      makeBook({
        id: 'go-read',
        status: 'unread',
        progress: 0,
      }),
    ]

    render(
      <MemoryRouter>
        <LibraryMediaHero books={books} modeLabel="Ebooks" />
      </MemoryRouter>
    )

    await user.click(screen.getByTestId('library-media-hero-primary'))
    expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining('go-read'))
  })
})
