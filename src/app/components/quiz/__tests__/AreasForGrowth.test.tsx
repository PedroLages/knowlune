import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AreasForGrowth } from '../AreasForGrowth'

const makeItems = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    questionId: `q-${i + 1}`,
    questionText: `Question ${i + 1} text`,
    correctAnswer: `Answer ${i + 1}`,
  }))

describe('AreasForGrowth', () => {
  it('renders nothing when all answers are correct (empty array)', () => {
    const { container } = render(<AreasForGrowth incorrectItems={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows items for incorrect answers', () => {
    const items = makeItems(3)
    render(<AreasForGrowth incorrectItems={items} />)

    expect(screen.getByText('Areas to Review')).toBeInTheDocument()
    expect(
      screen.getByText('Review these topics to strengthen your understanding')
    ).toBeInTheDocument()

    for (const item of items) {
      expect(screen.getByText(item.questionText)).toBeInTheDocument()
      expect(screen.getByText(`Correct answer: ${item.correctAnswer}`)).toBeInTheDocument()
    }
  })

  it('displays correct answer for each missed question', () => {
    const items = [
      {
        questionId: 'q-react',
        questionText: 'What is React?',
        correctAnswer: 'A JavaScript library',
      },
      { questionId: 'q-jsx', questionText: 'What is JSX?', correctAnswer: 'JavaScript XML syntax' },
    ]
    render(<AreasForGrowth incorrectItems={items} />)

    expect(screen.getByText('Correct answer: A JavaScript library')).toBeInTheDocument()
    expect(screen.getByText('Correct answer: JavaScript XML syntax')).toBeInTheDocument()
  })

  it('renders as an ordered list', () => {
    const items = makeItems(3)
    const { container } = render(<AreasForGrowth incorrectItems={items} />)

    const ol = container.querySelector('ol')
    expect(ol).toBeInTheDocument()
    expect(ol?.querySelectorAll('li')).toHaveLength(3)
  })

  it('shows "Show all" button when more than 5 items', () => {
    const items = makeItems(7)
    render(<AreasForGrowth incorrectItems={items} />)

    // Only first 5 visible
    expect(screen.getByText('Question 5 text')).toBeInTheDocument()
    expect(screen.queryByText('Question 6 text')).not.toBeInTheDocument()

    const showAllButton = screen.getByRole('button', { name: /Show all/i })
    expect(showAllButton).toBeInTheDocument()
    expect(showAllButton).toHaveTextContent('Show all (7 items)')
  })

  it('reveals all items when "Show all" is clicked', async () => {
    const user = userEvent.setup()
    const items = makeItems(7)
    render(<AreasForGrowth incorrectItems={items} />)

    await user.click(screen.getByRole('button', { name: /Show all/i }))

    expect(screen.getByText('Question 6 text')).toBeInTheDocument()
    expect(screen.getByText('Question 7 text')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show fewer/i })).toBeInTheDocument()
  })

  it('collapses back to 5 items when "Show fewer" is clicked', async () => {
    const user = userEvent.setup()
    const items = makeItems(7)
    render(<AreasForGrowth incorrectItems={items} />)

    // Expand
    await user.click(screen.getByRole('button', { name: /Show all/i }))
    expect(screen.getByText('Question 7 text')).toBeInTheDocument()

    // Collapse
    await user.click(screen.getByRole('button', { name: /Show fewer/i }))
    expect(screen.queryByText('Question 6 text')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show all/i })).toBeInTheDocument()
  })

  it('displays pre-joined multi-select correct answer with "All of:" prefix', () => {
    const items = [
      {
        questionId: 'q-multi',
        questionText: 'Which are JavaScript frameworks?',
        correctAnswer: 'All of: React, Vue, Angular',
      },
    ]
    render(<AreasForGrowth incorrectItems={items} />)

    expect(screen.getByText('Correct answer: All of: React, Vue, Angular')).toBeInTheDocument()
  })

  it('does not show "Show all" button when 5 or fewer items', () => {
    render(<AreasForGrowth incorrectItems={makeItems(5)} />)
    expect(screen.queryByRole('button', { name: /Show all/i })).not.toBeInTheDocument()
  })
})
