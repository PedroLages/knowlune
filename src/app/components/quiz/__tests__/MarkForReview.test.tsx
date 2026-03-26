import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarkForReview } from '../MarkForReview'

const defaultProps = {
  questionId: 'q1',
  isMarked: false,
  onToggle: vi.fn(),
}

describe('MarkForReview', () => {
  it('renders unchecked when isMarked is false', () => {
    render(<MarkForReview {...defaultProps} isMarked={false} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('renders checked when isMarked is true', () => {
    render(<MarkForReview {...defaultProps} isMarked={true} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('calls onToggle when checkbox is clicked', async () => {
    const onToggle = vi.fn()
    render(<MarkForReview {...defaultProps} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onToggle when label is clicked', async () => {
    const onToggle = vi.fn()
    render(<MarkForReview {...defaultProps} onToggle={onToggle} />)
    await userEvent.click(screen.getByText('Mark for Review'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('renders "Mark for Review" label text', () => {
    render(<MarkForReview {...defaultProps} />)
    expect(screen.getByText('Mark for Review')).toBeInTheDocument()
  })

  it('toggles via keyboard interaction', async () => {
    const onToggle = vi.fn()
    render(<MarkForReview {...defaultProps} onToggle={onToggle} />)
    // Tab to the checkbox and press Space (Radix Checkbox = button role=checkbox)
    await userEvent.tab()
    expect(screen.getByRole('checkbox')).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('has accessible name via aria-labelledby', () => {
    render(<MarkForReview {...defaultProps} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-labelledby', 'mark-review-q1-label')
  })

  describe('ARIA live announcements (AC3)', () => {
    it('has an aria-live="polite" region for review state', () => {
      render(<MarkForReview {...defaultProps} />)
      const liveRegion = screen.getByTestId('review-announcement')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })

    it('does not announce on initial render', () => {
      render(<MarkForReview {...defaultProps} isMarked={false} />)
      const liveRegion = screen.getByTestId('review-announcement')
      expect(liveRegion).toHaveTextContent('')
    })

    it('announces "Marked for review" when toggled on', () => {
      const { rerender } = render(<MarkForReview {...defaultProps} isMarked={false} />)
      rerender(<MarkForReview {...defaultProps} isMarked={true} />)
      const liveRegion = screen.getByTestId('review-announcement')
      expect(liveRegion).toHaveTextContent('Marked for review')
    })

    it('announces "Removed from review" when toggled off', () => {
      const { rerender } = render(<MarkForReview {...defaultProps} isMarked={true} />)
      rerender(<MarkForReview {...defaultProps} isMarked={false} />)
      const liveRegion = screen.getByTestId('review-announcement')
      expect(liveRegion).toHaveTextContent('Removed from review')
    })
  })
})
