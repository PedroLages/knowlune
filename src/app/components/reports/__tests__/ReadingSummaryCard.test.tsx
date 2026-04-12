import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReadingSummaryCard } from '../ReadingSummaryCard'

vi.mock('@/services/ReadingStatsService', () => ({
  getReadingSummary: vi.fn(),
  formatReadingTime: vi.fn(),
}))

import { getReadingSummary, formatReadingTime } from '@/services/ReadingStatsService'

const mockGetReadingSummary = vi.mocked(getReadingSummary)
const mockFormatReadingTime = vi.mocked(formatReadingTime)

describe('ReadingSummaryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when summary is null (no finished books)', async () => {
    mockGetReadingSummary.mockResolvedValue(null)
    const { container } = render(<ReadingSummaryCard />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="reading-summary-card"]')).toBeNull()
    })
  })

  it('renders all 4 pills with data', async () => {
    mockGetReadingSummary.mockResolvedValue({
      booksFinishedThisYear: 12,
      yearlyGoal: 24,
      avgPagesPerSession: 45,
      longestSessionMinutes: 90,
      mostReadAuthor: 'Tolkien',
    })
    mockFormatReadingTime.mockReturnValue('1h 30m')
    render(<ReadingSummaryCard />)
    await waitFor(() => {
      expect(screen.getByTestId('summary-books-this-year')).toBeInTheDocument()
    })
    expect(screen.getByTestId('summary-books-this-year')).toHaveTextContent('12 / 24')
    expect(screen.getByTestId('summary-avg-pages')).toHaveTextContent('45 pages')
    expect(screen.getByTestId('summary-longest-session')).toHaveTextContent('1h 30m')
    expect(screen.getByTestId('summary-most-read-author')).toHaveTextContent('Tolkien')
  })

  it('null metrics show em-dash', async () => {
    mockGetReadingSummary.mockResolvedValue({
      booksFinishedThisYear: 3,
      yearlyGoal: null,
      avgPagesPerSession: null,
      longestSessionMinutes: null,
      mostReadAuthor: null,
    })
    mockFormatReadingTime.mockReturnValue('0m')
    render(<ReadingSummaryCard />)
    await waitFor(() => {
      expect(screen.getByTestId('summary-books-this-year')).toBeInTheDocument()
    })
    expect(screen.getByTestId('summary-books-this-year')).toHaveTextContent('3')
    expect(screen.getByTestId('summary-avg-pages')).toHaveTextContent('—')
    expect(screen.getByTestId('summary-longest-session')).toHaveTextContent('—')
    expect(screen.getByTestId('summary-most-read-author')).toHaveTextContent('—')
  })

  it('handles error gracefully — renders null', async () => {
    mockGetReadingSummary.mockRejectedValue(new Error('Service error'))
    const { container } = render(<ReadingSummaryCard />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="reading-summary-card"]')).toBeNull()
    })
  })
})
