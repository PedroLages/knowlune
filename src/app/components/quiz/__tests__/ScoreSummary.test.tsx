import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreSummary } from '../ScoreSummary'

const passProps = {
  percentage: 85,
  score: 10,
  maxScore: 12,
  passed: true,
  passingScore: 70,
  timeSpent: 512000, // 8m 32s
}

const failProps = {
  percentage: 33.3,
  score: 1,
  maxScore: 3,
  passed: false,
  passingScore: 70,
  timeSpent: 45000, // 45s
}

describe('ScoreSummary', () => {
  it('renders pass state correctly', () => {
    render(<ScoreSummary {...passProps} />)

    // Percentage is split across elements (85 + %)
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getAllByText(/10 of 12 correct/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('PASSED')).toBeInTheDocument()
    expect(screen.getByText(/70% to pass/)).toBeInTheDocument()
  })

  it('renders not-pass state correctly', () => {
    render(<ScoreSummary {...failProps} />)

    expect(screen.getByText('33')).toBeInTheDocument()
    expect(screen.getAllByText(/1 of 3 correct/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('NEEDS WORK')).toBeInTheDocument()
  })

  it('shows NEEDS REVIEW tier for 50-69%', () => {
    render(<ScoreSummary {...failProps} percentage={55} />)
    expect(screen.getByText('NEEDS REVIEW')).toBeInTheDocument()
  })

  it('shows EXCELLENT tier for >= 90%', () => {
    render(<ScoreSummary {...passProps} percentage={95} />)
    expect(screen.getByText('EXCELLENT')).toBeInTheDocument()
  })

  it('never renders "Failed" in any state', () => {
    const { container: passContainer } = render(<ScoreSummary {...passProps} />)
    expect(passContainer.textContent?.toLowerCase()).not.toContain('failed')

    const { container: failContainer } = render(<ScoreSummary {...failProps} />)
    expect(failContainer.textContent?.toLowerCase()).not.toContain('failed')
  })

  it('renders time formatting correctly', () => {
    render(<ScoreSummary {...passProps} />)
    expect(screen.getByText('Completed in 8m 32s')).toBeInTheDocument()
  })

  it('renders encouraging message for high score (>= 90%)', () => {
    render(<ScoreSummary {...passProps} percentage={95} />)
    expect(screen.getByText(/mastered this material/)).toBeInTheDocument()
  })

  it('renders encouraging message for medium score (70-89%)', () => {
    render(<ScoreSummary {...passProps} percentage={75} />)
    expect(screen.getByText(/on the right track/)).toBeInTheDocument()
  })

  it('renders encouraging message for low-medium score (50-69%)', () => {
    render(<ScoreSummary {...failProps} percentage={55} />)
    expect(screen.getByText(/Review the growth areas/)).toBeInTheDocument()
  })

  it('renders encouraging message for low score (< 50%)', () => {
    render(<ScoreSummary {...failProps} percentage={30} />)
    expect(screen.getByText(/Keep practicing/)).toBeInTheDocument()
  })

  it('announces score to screen readers via aria-live', () => {
    render(<ScoreSummary {...passProps} />)
    const liveRegion = screen.getByText(/Quiz score: 85 percent/i)
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
  })

  it('renders SVG score ring with tier-specific color class', () => {
    const { container } = render(<ScoreSummary {...passProps} percentage={95} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(2)
    // Second circle is the progress arc — should carry success color for 95%
    expect(circles[1].getAttribute('class')).toContain('text-success')
  })

  it('ring uses warning color for NEEDS REVIEW tier', () => {
    const { container } = render(<ScoreSummary {...failProps} percentage={55} />)
    const circles = container.querySelectorAll('circle')
    expect(circles[1].getAttribute('class')).toContain('text-warning')
  })

  it('ring uses destructive color for NEEDS WORK tier', () => {
    const { container } = render(<ScoreSummary {...failProps} percentage={30} />)
    const circles = container.querySelectorAll('circle')
    expect(circles[1].getAttribute('class')).toContain('text-destructive')
  })

  it('exactly 90% with passed=true yields EXCELLENT, not PASSED', () => {
    render(<ScoreSummary {...passProps} percentage={90} />)
    expect(screen.getByText('EXCELLENT')).toBeInTheDocument()
  })

  it('89% with passed=true yields PASSED, not EXCELLENT', () => {
    render(<ScoreSummary {...passProps} percentage={89} />)
    expect(screen.getByText('PASSED')).toBeInTheDocument()
  })

  it('exactly 50% yields NEEDS REVIEW', () => {
    render(<ScoreSummary {...failProps} percentage={50} />)
    expect(screen.getByText('NEEDS REVIEW')).toBeInTheDocument()
  })

  it('49% yields NEEDS WORK', () => {
    render(<ScoreSummary {...failProps} percentage={49} />)
    expect(screen.getByText('NEEDS WORK')).toBeInTheDocument()
  })

  it('clamps percentage > 100 to 100 in display', () => {
    render(<ScoreSummary {...passProps} percentage={150} />)
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('clamps negative percentage to 0 in display', () => {
    render(<ScoreSummary {...failProps} percentage={-10} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('floors timeSpent to 1s when 0ms', () => {
    render(<ScoreSummary {...passProps} timeSpent={0} />)
    expect(screen.getByText('Completed in 1s')).toBeInTheDocument()
  })

  it('floors timeSpent to 1s when sub-second (500ms)', () => {
    render(<ScoreSummary {...passProps} timeSpent={500} />)
    expect(screen.getByText('Completed in 1s')).toBeInTheDocument()
  })

  it('hides time display when showTimeSpent is false', () => {
    render(<ScoreSummary {...passProps} showTimeSpent={false} />)
    expect(screen.queryByText(/Completed in/)).not.toBeInTheDocument()
  })

  it('shows time display when showTimeSpent is true (default)', () => {
    render(<ScoreSummary {...passProps} />)
    expect(screen.getByText('Completed in 8m 32s')).toBeInTheDocument()
  })

  it('shows previous attempt time when previousAttemptTimeSpent is provided', () => {
    render(
      <ScoreSummary
        {...passProps}
        timeSpent={512000} // 8m 32s
        previousAttemptTimeSpent={615000} // 10m 15s
      />
    )
    expect(screen.getByText('Completed in 8m 32s')).toBeInTheDocument()
    expect(screen.getByText(/Previous: 10m 15s/)).toBeInTheDocument()
  })

  it('does not show previous time when previousAttemptTimeSpent is undefined', () => {
    render(<ScoreSummary {...passProps} timeSpent={512000} />)
    expect(screen.queryByText(/Previous:/)).not.toBeInTheDocument()
  })

  it('does not show previous time when showTimeSpent is false', () => {
    render(<ScoreSummary {...passProps} showTimeSpent={false} previousAttemptTimeSpent={615000} />)
    expect(screen.queryByText(/Previous:/)).not.toBeInTheDocument()
  })
})
