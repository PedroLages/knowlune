import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PathSummaryPanel } from '@/app/components/learning-path/PathSummaryPanel'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

function makeProgress(overrides: Partial<PathProgressSummary> = {}): PathProgressSummary {
  return {
    completionPct: 0,
    completedLessons: 0,
    totalLessons: 10,
    completedCourses: 0,
    totalCourses: 5,
    estimatedRemainingHours: 20,
    courseProgress: new Map(),
    ...overrides,
  }
}

describe('PathSummaryPanel', () => {
  it('renders progress percentage', () => {
    render(<PathSummaryPanel progress={makeProgress({ completionPct: 42 })} />)
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('renders lessons count', () => {
    render(<PathSummaryPanel progress={makeProgress({ completedLessons: 3, totalLessons: 10 })} />)
    expect(screen.getByText('3 / 10')).toBeInTheDocument()
  })

  it('renders courses count', () => {
    render(<PathSummaryPanel progress={makeProgress({ completedCourses: 2, totalCourses: 5 })} />)
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
  })

  it('renders estimated remaining time', () => {
    render(<PathSummaryPanel progress={makeProgress({ estimatedRemainingHours: 15 })} />)
    expect(screen.getByText('~15h')).toBeInTheDocument()
  })

  it('renders 0h when no remaining hours', () => {
    render(<PathSummaryPanel progress={makeProgress({ estimatedRemainingHours: 0 })} />)
    expect(screen.getByText('0h')).toBeInTheDocument()
  })

  it('progress bar reflects completionPct', () => {
    render(<PathSummaryPanel progress={makeProgress({ completionPct: 75 })} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '75')
  })

  it('handles 0% completion', () => {
    render(<PathSummaryPanel progress={makeProgress({ completionPct: 0 })} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('handles 100% completion', () => {
    render(<PathSummaryPanel progress={makeProgress({ completionPct: 100 })} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
  })

  it('has data-testid for component identification', () => {
    render(<PathSummaryPanel progress={makeProgress()} />)
    expect(screen.getByTestId('path-summary-panel')).toBeInTheDocument()
  })
})
