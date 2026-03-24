/**
 * Unit tests for ImprovementChart (E17-S05)
 * Mocks recharts to avoid canvas/DOM issues in Vitest
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ImprovementChart } from '../ImprovementChart'
import { makeAttempt } from '../../../../../tests/support/fixtures/factories/quiz-factory'

// Mirror the recharts mock pattern from ScoreTrajectoryChart.test.tsx
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>()
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    ...actual,
    ResponsiveContainer: Passthrough,
    LineChart: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="line-chart">{children}</div>
    ),
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  }
})

describe('ImprovementChart', () => {
  it('returns null when fewer than 3 attempts', () => {
    const attempts = [
      makeAttempt({ percentage: 50, completedAt: '2026-01-01T00:00:00Z' }),
      makeAttempt({ percentage: 60, completedAt: '2026-01-02T00:00:00Z' }),
    ]
    const { container } = render(<ImprovementChart attempts={attempts} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null for empty attempts', () => {
    const { container } = render(<ImprovementChart attempts={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders chart section with 3+ attempts', () => {
    const attempts = [
      makeAttempt({ percentage: 40, completedAt: '2026-01-01T00:00:00Z' }),
      makeAttempt({ percentage: 60, completedAt: '2026-01-02T00:00:00Z' }),
      makeAttempt({ percentage: 80, completedAt: '2026-01-03T00:00:00Z' }),
    ]
    render(<ImprovementChart attempts={attempts} />)
    expect(screen.getByTestId('improvement-chart')).toBeInTheDocument()
  })

  it('renders "Learning Trajectory" heading', () => {
    const attempts = [
      makeAttempt({ percentage: 40, completedAt: '2026-01-01T00:00:00Z' }),
      makeAttempt({ percentage: 60, completedAt: '2026-01-02T00:00:00Z' }),
      makeAttempt({ percentage: 80, completedAt: '2026-01-03T00:00:00Z' }),
    ]
    render(<ImprovementChart attempts={attempts} />)
    expect(screen.getByText('Learning Trajectory')).toBeInTheDocument()
  })

  it('displays pattern interpretation badge for linear improvement', () => {
    const attempts = [
      makeAttempt({ percentage: 20, completedAt: '2026-01-01T00:00:00Z' }),
      makeAttempt({ percentage: 40, completedAt: '2026-01-02T00:00:00Z' }),
      makeAttempt({ percentage: 60, completedAt: '2026-01-03T00:00:00Z' }),
      makeAttempt({ percentage: 80, completedAt: '2026-01-04T00:00:00Z' }),
    ]
    render(<ImprovementChart attempts={attempts} />)
    expect(screen.getByTestId('trajectory-pattern')).toHaveTextContent('Consistent improvement')
  })

  it('displays confidence percentage', () => {
    const attempts = [
      makeAttempt({ percentage: 20, completedAt: '2026-01-01T00:00:00Z' }),
      makeAttempt({ percentage: 40, completedAt: '2026-01-02T00:00:00Z' }),
      makeAttempt({ percentage: 60, completedAt: '2026-01-03T00:00:00Z' }),
      makeAttempt({ percentage: 80, completedAt: '2026-01-04T00:00:00Z' }),
    ]
    render(<ImprovementChart attempts={attempts} />)
    const confidence = screen.getByTestId('trajectory-confidence')
    expect(confidence.textContent).toMatch(/\d+% confidence/)
  })

  it('has accessible aria-label describing trajectory', () => {
    const attempts = [
      makeAttempt({ percentage: 70, completedAt: '2026-01-01T00:00:00Z' }),
      makeAttempt({ percentage: 72, completedAt: '2026-01-02T00:00:00Z' }),
      makeAttempt({ percentage: 71, completedAt: '2026-01-03T00:00:00Z' }),
    ]
    render(<ImprovementChart attempts={attempts} />)
    const section = screen.getByTestId('improvement-chart')
    const label = section.getAttribute('aria-label')
    expect(label).toContain('Learning trajectory')
    expect(label).toContain('plateau')
    expect(label).toContain('confidence')
  })

  it('displays declining pattern with appropriate interpretation', () => {
    const attempts = [
      makeAttempt({ percentage: 90, completedAt: '2026-01-01T00:00:00Z' }),
      makeAttempt({ percentage: 70, completedAt: '2026-01-02T00:00:00Z' }),
      makeAttempt({ percentage: 50, completedAt: '2026-01-03T00:00:00Z' }),
    ]
    render(<ImprovementChart attempts={attempts} />)
    expect(screen.getByTestId('trajectory-pattern')).toHaveTextContent(
      'Consider reviewing material'
    )
  })
})
