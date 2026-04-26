/**
 * DailyHighlightsStrip — contrast, cover resolution, fallback, navigation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Book, BookHighlight } from '@/data/types'
import { DailyHighlightsStrip } from '../DailyHighlightsStrip'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'

const { mockHighlights, mockBooks, mockNavigate } = vi.hoisted(() => ({
  mockHighlights: [] as BookHighlight[],
  mockBooks: [] as Book[],
  mockNavigate: vi.fn(),
}))

const iso = () => new Date().toISOString()

const longQuote = `${'A quote that is long enough for the daily strip filter. '.repeat(2)}`

const baseHighlight = (overrides: Partial<BookHighlight> = {}): BookHighlight => ({
  id: 'h1',
  bookId: 'b1',
  textAnchor: longQuote,
  color: 'yellow',
  position: { type: 'cfi', value: 'epubcfi(/6/4)' },
  createdAt: iso(),
  ...overrides,
})

const baseBook = (overrides: Partial<Book> = {}): Book =>
  ({
    id: 'b1',
    title: 'Alpha Book',
    format: 'epub',
    status: 'reading',
    chapters: [],
    source: { type: 'local', opfsPath: '/books/b1.epub' },
    tags: [],
    progress: 10,
    createdAt: iso(),
    coverUrl: 'https://example.com/cover.png',
    ...overrides,
  }) as Book

vi.mock('@/db/schema', () => ({
  db: {
    bookHighlights: {
      filter: () => ({
        toArray: async () => mockHighlights,
      }),
    },
  },
}))

vi.mock('@/stores/useBookStore', () => ({
  useBookStore: (selector: (s: { books: Book[] }) => Book[]) => selector({ books: mockBooks }),
}))

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/app/hooks/useBookCoverUrl', () => ({
  useBookCoverUrl: vi.fn(),
}))

const mockedUseBookCoverUrl = vi.mocked(useBookCoverUrl)

describe('DailyHighlightsStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHighlights.length = 0
    mockHighlights.push(baseHighlight())
    mockBooks.length = 0
    mockBooks.push(baseBook())

    mockedUseBookCoverUrl.mockImplementation(({ coverUrl }) => {
      if (!coverUrl?.trim()) return null
      if (coverUrl.startsWith('opfs-cover:') || coverUrl.startsWith('opfs:')) {
        return 'https://resolved-opfs.example/cover.jpg'
      }
      return coverUrl
    })
  })

  it('uses stable dark card surface (not theme foreground)', async () => {
    render(<DailyHighlightsStrip />)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /daily highlights/i })).toBeInTheDocument()
    })

    const region = screen.getByRole('region', { name: /daily highlights/i })
    const card = screen.getByText(/A quote that is long enough/i).closest('.bg-slate-950')
    expect(card).toBeInTheDocument()
    expect(region.querySelector('.from-slate-950')).toBeTruthy()
  })

  it('shows icon fallback when cover image fails to load', async () => {
    render(<DailyHighlightsStrip />)

    await waitFor(() => {
      expect(screen.getByAltText('Alpha Book cover')).toBeInTheDocument()
    })

    const thumb = screen.getByAltText('Alpha Book cover')
    fireEvent.error(thumb)

    await waitFor(() => {
      expect(screen.queryByAltText('Alpha Book cover')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('daily-highlight-cover-fallback')).toBeInTheDocument()
    expect(screen.getByTestId('daily-highlight-cover-fallback')).toHaveTextContent('A')
  })

  it('shows fallback tile when there is no cover URL', async () => {
    mockBooks[0] = baseBook({ coverUrl: undefined })

    render(<DailyHighlightsStrip />)

    await waitFor(() => {
      expect(screen.getByText(/A quote that is long enough/i)).toBeInTheDocument()
    })

    expect(screen.queryByRole('img', { name: /cover/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('daily-highlight-cover-fallback')).toBeInTheDocument()
  })

  it('treats whitespace-only cover URL as missing', async () => {
    mockBooks[0] = baseBook({ coverUrl: '   ' })

    render(<DailyHighlightsStrip />)

    await waitFor(() => {
      expect(screen.getByText(/A quote that is long enough/i)).toBeInTheDocument()
    })

    expect(screen.queryByAltText('Alpha Book cover')).not.toBeInTheDocument()
    expect(screen.getByTestId('daily-highlight-cover-fallback')).toBeInTheDocument()
  })

  it('uses resolved URL for cover when book has opfs-cover storage', async () => {
    mockBooks[0] = baseBook({ coverUrl: 'opfs-cover://b1' })

    render(<DailyHighlightsStrip />)

    await waitFor(() => {
      const img = screen.getByAltText('Alpha Book cover')
      expect(img).toHaveAttribute('src', 'https://resolved-opfs.example/cover.jpg')
    })

    expect(mockedUseBookCoverUrl).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: 'b1', coverUrl: 'opfs-cover://b1' })
    )
  })

  it('navigates to reader with sourceHighlightId when the card is activated', async () => {
    render(<DailyHighlightsStrip />)

    await waitFor(() => {
      expect(screen.getByTestId('daily-highlight-card')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('daily-highlight-card'))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('/library/b1/read?sourceHighlightId=h1')
  })

  it('shows previous and next controls when multiple highlights qualify', async () => {
    mockHighlights.push(
      baseHighlight({
        id: 'h2',
        textAnchor: `${'Second long quote for daily strip. '.repeat(3)}`,
      }),
      baseHighlight({
        id: 'h3',
        textAnchor: `${'Third long quote for daily strip. '.repeat(3)}`,
      })
    )

    render(<DailyHighlightsStrip />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next highlight/i })).toBeInTheDocument()
    })

    const card = () => screen.getByTestId('daily-highlight-card')
    const initialText = card().textContent

    fireEvent.click(screen.getByRole('button', { name: /next highlight/i }))

    await waitFor(() => {
      expect(card().textContent).not.toEqual(initialText)
    })

    fireEvent.click(screen.getByRole('button', { name: /previous highlight/i }))

    await waitFor(() => {
      expect(card().textContent).toEqual(initialText)
    })
  })

  it('jumps to a highlight via radio dot', async () => {
    mockHighlights.push(
      baseHighlight({
        id: 'h2',
        textAnchor: `${'Second long quote for daily strip. '.repeat(3)}`,
      })
    )

    render(<DailyHighlightsStrip />)

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /highlight 2 of 2/i })).toBeInTheDocument()
    })

    const initialText = screen.getByTestId('daily-highlight-card').textContent

    fireEvent.click(screen.getByRole('radio', { name: /highlight 2 of 2/i }))

    await waitFor(() => {
      expect(screen.getByTestId('daily-highlight-card').textContent).not.toEqual(initialText)
    })
  })
})
