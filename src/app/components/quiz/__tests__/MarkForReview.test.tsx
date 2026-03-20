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
})
