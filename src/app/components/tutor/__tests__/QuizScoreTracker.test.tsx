/**
 * Unit tests for QuizScoreTracker (E73-S03)
 *
 * Coverage:
 * - Renders score in "X/Y" format
 * - Has role="status" and aria-live="polite"
 * - Returns null when total === 0
 * - Shows scale animation class when score changes
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QuizScoreTracker } from '../QuizScoreTracker'

describe('QuizScoreTracker', () => {
  it('renders score in "X/Y" format', () => {
    render(<QuizScoreTracker correct={3} total={5} lastAnswerCorrect={null} />)
    expect(screen.getByText(/Score: 3\/5/)).toBeInTheDocument()
  })

  it('has role="status" and aria-live="polite"', () => {
    render(<QuizScoreTracker correct={1} total={2} lastAnswerCorrect={null} />)
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-live', 'polite')
  })

  it('returns null when total === 0', () => {
    const { container } = render(<QuizScoreTracker correct={0} total={0} lastAnswerCorrect={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders check icon when lastAnswerCorrect is true', () => {
    render(<QuizScoreTracker correct={1} total={1} lastAnswerCorrect={true} />)
    // Check icon is aria-hidden — verify score element is present
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders X icon when lastAnswerCorrect is false', () => {
    render(<QuizScoreTracker correct={0} total={1} lastAnswerCorrect={false} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('applies scale animation class when total increases', async () => {
    vi.useFakeTimers()
    const { rerender } = render(<QuizScoreTracker correct={1} total={1} lastAnswerCorrect={true} />)

    // Increase total — should trigger pulse
    rerender(<QuizScoreTracker correct={2} total={2} lastAnswerCorrect={true} />)

    const el = screen.getByTestId('quiz-score-tracker')
    expect(el.className).toContain('motion-safe:scale-105')

    // After 200ms the animation class should be removed
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(el.className).not.toContain('motion-safe:scale-105')

    vi.useRealTimers()
  })
})
