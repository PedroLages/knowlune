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
  it('renders pass message correctly', () => {
    render(<ScoreSummary {...passProps} />)

    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('10 of 12 correct')).toBeInTheDocument()
    expect(screen.getByText(/Congratulations! You passed!/)).toBeInTheDocument()
    expect(screen.getByText('70% required to pass')).toBeInTheDocument()
  })

  it('renders not-pass message correctly', () => {
    render(<ScoreSummary {...failProps} />)

    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 correct')).toBeInTheDocument()
    expect(screen.getByText(/Keep Going! You got 1 of 3 correct/)).toBeInTheDocument()
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

  it('renders SVG score ring', () => {
    const { container } = render(<ScoreSummary {...passProps} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelector('circle')).toBeInTheDocument()
  })
})
