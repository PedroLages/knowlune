/**
 * Unit tests for ScoreTrajectoryChart
 * Mocks recharts to avoid canvas/DOM issues in Vitest
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ScoreTrajectoryChart } from '../ScoreTrajectoryChart'

// Mirror the recharts mock pattern from Reports.test.tsx
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
    ReferenceLine: ({ label }: { label?: { value?: string } }) => (
      <div data-testid="reference-line">{label?.value}</div>
    ),
  }
})

describe('ScoreTrajectoryChart', () => {
  const twoAttempts = [
    { attemptNumber: 1, percentage: 60 },
    { attemptNumber: 2, percentage: 80 },
  ]

  it('renders chart when 2+ attempts provided', () => {
    render(<ScoreTrajectoryChart attempts={twoAttempts} passingScore={70} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders passing score reference line with label', () => {
    render(<ScoreTrajectoryChart attempts={twoAttempts} passingScore={70} />)
    expect(screen.getByTestId('reference-line')).toHaveTextContent('Passing: 70%')
  })

  it('returns null when fewer than 2 attempts', () => {
    const { container } = render(
      <ScoreTrajectoryChart attempts={[{ attemptNumber: 1, percentage: 80 }]} passingScore={70} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when attempts array is empty', () => {
    const { container } = render(
      <ScoreTrajectoryChart attempts={[]} passingScore={70} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders section heading', () => {
    render(<ScoreTrajectoryChart attempts={twoAttempts} passingScore={70} />)
    expect(screen.getByText('Score Trajectory')).toBeInTheDocument()
  })
})
