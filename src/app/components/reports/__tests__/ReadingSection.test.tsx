import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReadingSection } from '../ReadingSection'

// Each child card handles its own data loading; the Section is purely
// presentational, so we mock every child to keep the test fast and isolated.
vi.mock('@/app/components/reports/ReadingStatsSection', () => ({
  ReadingStatsSection: ({ showHeader }: { showHeader?: boolean }) => (
    <div data-testid="mock-reading-stats-section" data-show-header={String(showHeader)} />
  ),
}))

vi.mock('@/app/components/reports/ReadingPatternsCard', () => ({
  ReadingPatternsCard: () => <div data-testid="mock-reading-patterns-card" />,
}))

vi.mock('@/app/components/reports/ReadingGoalsCard', () => ({
  ReadingGoalsCard: () => <div data-testid="mock-reading-goals-card" />,
}))

vi.mock('@/app/components/reports/GenreDistributionCard', () => ({
  GenreDistributionCard: () => <div data-testid="mock-genre-distribution-card" />,
}))

vi.mock('@/app/components/reports/ReadingSummaryCard', () => ({
  ReadingSummaryCard: () => <div data-testid="mock-reading-summary-card" />,
}))

describe('ReadingSection', () => {
  it('renders the section wrapper with the correct testid', () => {
    render(<ReadingSection />)
    expect(screen.getByTestId('reading-section')).toBeInTheDocument()
  })

  it('renders all five child cards', () => {
    render(<ReadingSection />)
    expect(screen.getByTestId('mock-reading-stats-section')).toBeInTheDocument()
    expect(screen.getByTestId('mock-reading-patterns-card')).toBeInTheDocument()
    expect(screen.getByTestId('mock-reading-goals-card')).toBeInTheDocument()
    expect(screen.getByTestId('mock-genre-distribution-card')).toBeInTheDocument()
    expect(screen.getByTestId('mock-reading-summary-card')).toBeInTheDocument()
  })

  it('passes showHeader={false} to ReadingStatsSection', () => {
    render(<ReadingSection />)
    const el = screen.getByTestId('mock-reading-stats-section')
    expect(el.getAttribute('data-show-header')).toBe('false')
  })
})
