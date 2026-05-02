/**
 * LibraryFilters — responsive primary row (status vs utilities)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Book } from '@/data/types'
import { LibraryFilters } from '../LibraryFilters'

const mockSetFilter = vi.fn()
const mockGetBookCountByStatus = vi.fn(() => ({
  all: 1,
  unread: 1,
  reading: 0,
  finished: 0,
  abandoned: 0,
}))

vi.mock('@/app/components/library/FilterSidebar', () => ({
  FilterSidebar: () => null,
}))

vi.mock('@/stores/useBookStore', () => ({
  useBookStore: (selector: unknown) =>
    (selector as (s: object) => unknown)({
      filters: { status: 'all', source: 'all' },
      setFilter: mockSetFilter,
      books: [] as Book[],
      getBookCountByStatus: mockGetBookCountByStatus,
    }),
}))

describe('LibraryFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stacks status row above utilities on small screens (sm:flex-row on container)', () => {
    render(<LibraryFilters viewToggle={<span data-testid="mock-view-toggle">VT</span>} />)

    const statusRow = screen.getByRole('tablist', { name: /filter by reading status/i }).parentElement
      ?.parentElement
    expect(statusRow).toHaveClass('flex-col', 'sm:flex-row')

    expect(screen.getByTestId('mock-view-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-all')).toBeInTheDocument()
  })
})
