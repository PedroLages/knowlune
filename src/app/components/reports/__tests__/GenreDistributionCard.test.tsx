import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GenreDistributionCard } from '../GenreDistributionCard'

vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Tooltip: () => null,
}))

vi.mock('@/services/ReadingStatsService', () => ({
  getGenreDistribution: vi.fn(),
}))

// Mock ChartContainer to avoid SVG/ResizeObserver issues in JSDOM
vi.mock('@/app/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartConfig: {},
}))

import { getGenreDistribution } from '@/services/ReadingStatsService'

const mockGetGenreDistribution = vi.mocked(getGenreDistribution)

describe('GenreDistributionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when data is null', async () => {
    mockGetGenreDistribution.mockResolvedValue(null as never)
    const { container } = render(<GenreDistributionCard />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="genre-distribution-card"]')).toBeNull()
    })
  })

  it('renders null when data is empty array', async () => {
    mockGetGenreDistribution.mockResolvedValue([])
    const { container } = render(<GenreDistributionCard />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="genre-distribution-card"]')).toBeNull()
    })
  })

  it('renders genre list', async () => {
    mockGetGenreDistribution.mockResolvedValue([
      { genre: 'Fiction', count: 5 },
      { genre: 'Science', count: 3 },
      { genre: 'Other', count: 2 },
    ])
    render(<GenreDistributionCard />)
    await waitFor(() => {
      expect(screen.getByTestId('genre-distribution-card')).toBeInTheDocument()
    })
    expect(screen.getByText('Fiction')).toBeInTheDocument()
    expect(screen.getByText('5 (50%)')).toBeInTheDocument()
  })

  it('handles error gracefully — renders null', async () => {
    mockGetGenreDistribution.mockRejectedValue(new Error('Service error'))
    const { container } = render(<GenreDistributionCard />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="genre-distribution-card"]')).toBeNull()
    })
  })
})
