import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreSummary } from '../ScoreSummary'
import type { ImprovementData } from '@/lib/analytics'

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

// ---------------------------------------------------------------------------
// ImprovementData fixtures
// ---------------------------------------------------------------------------

const firstAttemptData: ImprovementData = {
  firstScore: null,
  bestScore: 85,
  bestAttemptNumber: 1,
  currentScore: 85,
  improvement: null,
  isNewBest: false,
}

const newBestData: ImprovementData = {
  firstScore: 60,
  bestScore: 85,
  bestAttemptNumber: 2,
  currentScore: 85,
  improvement: 25,
  isNewBest: true,
}

const regressionData: ImprovementData = {
  firstScore: 60,
  bestScore: 90,
  bestAttemptNumber: 2,
  currentScore: 75,
  improvement: 15,
  isNewBest: false,
}

// ---------------------------------------------------------------------------
// Tests: Score tier / ring (unchanged behavior)
// ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Improvement panel: no improvementData
  // ---------------------------------------------------------------------------

  it('renders no improvement panel when improvementData is absent', () => {
    render(<ScoreSummary {...passProps} />)
    expect(screen.queryByTestId('improvement-summary')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Improvement panel: first attempt state
  // ---------------------------------------------------------------------------

  it('first attempt: shows "First attempt complete!" message', () => {
    render(<ScoreSummary {...passProps} improvementData={firstAttemptData} />)
    expect(screen.getByTestId('improvement-summary')).toBeInTheDocument()
    expect(
      screen.getByText(/First attempt complete! Retake to track improvement\./)
    ).toBeInTheDocument()
  })

  it('first attempt: does NOT show "New personal best!"', () => {
    render(<ScoreSummary {...passProps} improvementData={firstAttemptData} />)
    expect(screen.queryByText(/New personal best/)).not.toBeInTheDocument()
  })

  it('first attempt: does NOT show improvement comparison panel rows', () => {
    render(<ScoreSummary {...passProps} improvementData={firstAttemptData} />)
    expect(screen.queryByText(/First attempt:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Improvement:/)).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Improvement panel: new personal best
  // ---------------------------------------------------------------------------

  it('new personal best: shows Trophy icon and "New personal best!" in green', () => {
    const { container } = render(<ScoreSummary {...passProps} improvementData={newBestData} />)
    expect(screen.getByText('New personal best!')).toBeInTheDocument()
    // Trophy svg rendered by lucide-react
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('new personal best: shows first/current/improvement rows', () => {
    render(<ScoreSummary {...passProps} improvementData={newBestData} />)
    expect(screen.getByText('First attempt:')).toBeInTheDocument()
    expect(screen.getByText('Current attempt:')).toBeInTheDocument()
    expect(screen.getByText('Improvement:')).toBeInTheDocument()
  })

  it('new personal best: improvement value is positive with + sign', () => {
    render(<ScoreSummary {...passProps} improvementData={newBestData} />)
    expect(screen.getByText('+25%')).toBeInTheDocument()
  })

  it('new personal best: improvement uses text-success class', () => {
    const { container } = render(<ScoreSummary {...passProps} improvementData={newBestData} />)
    const panel = container.querySelector('[data-testid="improvement-summary"]')
    // The improvement value span should carry text-success
    expect(panel?.textContent).toContain('+25%')
    const successSpan = panel?.querySelector('.text-success')
    expect(successSpan).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Improvement panel: regression state
  // ---------------------------------------------------------------------------

  it('regression: shows "Your best" and "Keep practicing" neutral message', () => {
    render(<ScoreSummary {...passProps} improvementData={regressionData} />)
    expect(screen.getByText(/Your best: 90%/)).toBeInTheDocument()
    expect(screen.getByText(/Keep practicing to beat your best!/)).toBeInTheDocument()
  })

  it('regression: shows attempt number for best score', () => {
    render(<ScoreSummary {...passProps} improvementData={regressionData} />)
    expect(screen.getByText(/attempt #2/)).toBeInTheDocument()
  })

  it('regression: does NOT show "New personal best!"', () => {
    render(<ScoreSummary {...passProps} improvementData={regressionData} />)
    expect(screen.queryByText(/New personal best/)).not.toBeInTheDocument()
  })

  it('regression: no text-destructive (red) in improvement panel', () => {
    const { container } = render(<ScoreSummary {...passProps} improvementData={regressionData} />)
    const panel = container.querySelector('[data-testid="improvement-summary"]')
    // Check that no element within the panel carries text-destructive
    const destructiveEls = panel?.querySelectorAll('.text-destructive')
    expect(destructiveEls?.length ?? 0).toBe(0)
  })

  it('never renders "You did worse" or negative failure messaging', () => {
    const { container } = render(<ScoreSummary {...passProps} improvementData={regressionData} />)
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).not.toContain('you did worse')
    expect(text).not.toContain('worse')
    expect(text).not.toContain('failed')
  })
})
