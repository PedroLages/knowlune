import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReadingStatsSection } from '../ReadingStatsSection'

vi.mock('@/db/schema', () => ({
  db: {
    books: {
      where: () => ({ equals: () => ({ toArray: async () => [] }) }),
    },
  },
}))

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/app/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}))

vi.mock('date-fns', () => ({
  format: (_date: Date, _fmt: string) => 'Jan 01',
}))

vi.mock('@/services/ReadingStatsService', () => ({
  getReadingStats: vi.fn(),
  computeETA: vi.fn(),
  formatReadingTime: vi.fn((mins: number) => `${mins}m`),
}))

import { getReadingStats, computeETA } from '@/services/ReadingStatsService'

const mockGetReadingStats = vi.mocked(getReadingStats)
const mockComputeETA = vi.mocked(computeETA)

describe('ReadingStatsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockComputeETA.mockResolvedValue(null)
  })

  it('renders "X p/h" when avgReadingSpeedPagesPerHour is set', async () => {
    mockGetReadingStats.mockResolvedValue({
      timeReadTodayMinutes: 30,
      booksInProgress: 2,
      totalBooksFinished: 5,
      avgReadingSpeedPagesPerHour: 42,
      readingTrend: [],
    })
    render(<ReadingStatsSection />)
    await waitFor(() => {
      expect(screen.getByTestId('reading-stat-avg-speed')).toBeInTheDocument()
    })
    expect(screen.getByTestId('reading-stat-avg-speed')).toHaveTextContent('42')
  })

  it('renders "—" when avgReadingSpeedPagesPerHour is null', async () => {
    mockGetReadingStats.mockResolvedValue({
      timeReadTodayMinutes: 30,
      booksInProgress: 2,
      totalBooksFinished: 5,
      avgReadingSpeedPagesPerHour: null,
      readingTrend: [],
    })
    render(<ReadingStatsSection />)
    await waitFor(() => {
      expect(screen.getByTestId('reading-stat-avg-speed')).toBeInTheDocument()
    })
    expect(screen.getByTestId('reading-stat-avg-speed')).toHaveTextContent('—')
  })

  it('renders null when stats are all zero/empty', async () => {
    mockGetReadingStats.mockResolvedValue({
      timeReadTodayMinutes: 0,
      booksInProgress: 0,
      totalBooksFinished: 0,
      avgReadingSpeedPagesPerHour: null,
      readingTrend: [],
    })
    const { container } = render(<ReadingStatsSection />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="reading-stats-section"]')).toBeNull()
    })
  })
})
