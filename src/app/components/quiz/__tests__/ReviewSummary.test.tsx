import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewSummary } from '../ReviewSummary'

const questionOrder = ['q1', 'q2', 'q3', 'q4']

describe('ReviewSummary', () => {
  it('returns null when markedForReview is empty', () => {
    const { container } = render(
      <ReviewSummary
        markedForReview={[]}
        questionOrder={questionOrder}
        onJumpToQuestion={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows singular count "1 question marked for review"', () => {
    render(
      <ReviewSummary
        markedForReview={['q2']}
        questionOrder={questionOrder}
        onJumpToQuestion={vi.fn()}
      />
    )
    expect(screen.getByText(/1 question marked for review/i)).toBeInTheDocument()
  })

  it('shows plural count "3 questions marked for review"', () => {
    render(
      <ReviewSummary
        markedForReview={['q1', 'q2', 'q4']}
        questionOrder={questionOrder}
        onJumpToQuestion={vi.fn()}
      />
    )
    expect(screen.getByText(/3 questions marked for review/i)).toBeInTheDocument()
  })

  it('renders correct 1-indexed question numbers', () => {
    render(
      <ReviewSummary
        markedForReview={['q3', 'q1']}
        questionOrder={questionOrder}
        onJumpToQuestion={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Q1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Q3' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Q2' })).not.toBeInTheDocument()
  })

  it('renders buttons sorted by question order', () => {
    render(
      <ReviewSummary
        markedForReview={['q4', 'q1']}
        questionOrder={questionOrder}
        onJumpToQuestion={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('Q1')
    expect(buttons[1]).toHaveTextContent('Q4')
  })

  it('calls onJumpToQuestion with correct 0-based index on button click', async () => {
    const onJumpToQuestion = vi.fn()
    render(
      <ReviewSummary
        markedForReview={['q3']}
        questionOrder={questionOrder}
        onJumpToQuestion={onJumpToQuestion}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Q3' }))
    expect(onJumpToQuestion).toHaveBeenCalledWith(2)
  })

  it('filters out question IDs not found in questionOrder', () => {
    render(
      <ReviewSummary
        markedForReview={['q-unknown', 'q2']}
        questionOrder={questionOrder}
        onJumpToQuestion={vi.fn()}
      />
    )
    // Only q2 should appear since q-unknown is not in questionOrder
    expect(screen.getByRole('button', { name: 'Q2' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
