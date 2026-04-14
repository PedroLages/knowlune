import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReadingPatternsCard } from '../ReadingPatternsCard'

vi.mock('@/services/ReadingStatsService', () => ({
  getTimeOfDayPattern: vi.fn(),
}))

import { getTimeOfDayPattern } from '@/services/ReadingStatsService'

const mockGetTimeOfDayPattern = vi.mocked(getTimeOfDayPattern)

const mockPattern = {
  buckets: [
    { period: 'Morning' as const, count: 5, percentage: 50 },
    { period: 'Afternoon' as const, count: 3, percentage: 30 },
    { period: 'Evening' as const, count: 1, percentage: 10 },
    { period: 'Night' as const, count: 1, percentage: 10 },
  ],
  dominant: 'Morning' as const,
}

describe('ReadingPatternsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when service returns null', async () => {
    mockGetTimeOfDayPattern.mockResolvedValue(null)
    const { container } = render(<ReadingPatternsCard />)
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders card with bucket data', async () => {
    mockGetTimeOfDayPattern.mockResolvedValue(mockPattern)
    render(<ReadingPatternsCard />)
    await waitFor(() => {
      expect(screen.getByTestId('reading-patterns-card')).toBeInTheDocument()
    })
    expect(screen.getByText('Morning')).toBeInTheDocument()
  })

  it('progress bars have accessibility attributes', async () => {
    mockGetTimeOfDayPattern.mockResolvedValue(mockPattern)
    render(<ReadingPatternsCard />)
    await waitFor(() => {
      expect(screen.getByTestId('reading-patterns-card')).toBeInTheDocument()
    })
    const meters = screen.getAllByRole('meter')
    expect(meters.length).toBeGreaterThan(0)
    for (const meter of meters) {
      expect(meter).toHaveAttribute('aria-valuenow')
      expect(meter).toHaveAttribute('aria-valuemin', '0')
      expect(meter).toHaveAttribute('aria-valuemax', '100')
    }
  })

  it('handles error gracefully — renders null', async () => {
    mockGetTimeOfDayPattern.mockRejectedValue(new Error('Service error'))
    const { container } = render(<ReadingPatternsCard />)
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })
})
