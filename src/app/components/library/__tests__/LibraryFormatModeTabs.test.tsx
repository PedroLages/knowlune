import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Book } from '@/data/types'
import { LibraryFormatModeTabs } from '@/app/components/library/LibraryFormatModeTabs'

type StoreState = {
  books: Book[]
  filters: { format?: string[]; source?: 'all' | 'local' | 'audiobookshelf' }
  setFilter: (key: 'format', value: string[] | undefined) => void
}

const { store } = vi.hoisted(() => ({
  store: {
    books: [] as Book[],
    filters: {} as StoreState['filters'],
    setFilter: vi.fn() as StoreState['setFilter'],
  },
}))

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
    absServerId: overrides.absServerId,
    ...overrides,
  }
}

vi.mock('@/stores/useBookStore', () => ({
  useBookStore: (selector: (s: StoreState) => unknown) => selector(store),
}))

describe('LibraryFormatModeTabs', () => {
  beforeEach(() => {
    store.books.length = 0
    store.filters = {}
    vi.mocked(store.setFilter).mockReset()
    store.books.push(
      makeBook({ id: 'a1', format: 'audiobook', absServerId: undefined }),
      makeBook({ id: 'e1', format: 'epub', absServerId: undefined }),
      makeBook({ id: 'p1', format: 'pdf', absServerId: 'abs-1' })
    )
  })

  it('renders two tabs with ARIA semantics', () => {
    render(<LibraryFormatModeTabs />)
    expect(screen.getByRole('tablist', { name: /library format mode/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /audiobooks/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /ebooks/i })).toBeInTheDocument()
  })

  it('clicking tabs calls setFilter with the correct store contract', async () => {
    const user = userEvent.setup()
    render(<LibraryFormatModeTabs />)

    await user.click(screen.getByTestId('library-format-mode-audiobooks'))
    expect(store.setFilter).toHaveBeenCalledWith('format', ['audiobook'])

    await user.click(screen.getByTestId('library-format-mode-ebooks'))
    expect(store.setFilter).toHaveBeenCalledWith('format', ['epub', 'pdf'])
  })

  it('counts respect the current source filter', () => {
    store.filters = { source: 'local' }
    render(<LibraryFormatModeTabs />)
    // local = books without absServerId → a1 + e1
    expect(screen.getByTestId('library-format-mode-audiobooks').textContent).toContain('(1)')
    expect(screen.getByTestId('library-format-mode-ebooks').textContent).toContain('(1)')
  })
})

