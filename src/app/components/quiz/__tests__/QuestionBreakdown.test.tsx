import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionBreakdown } from '../QuestionBreakdown'

const questions = [
  { id: 'q1', text: 'What is React?', order: 1 },
  { id: 'q2', text: 'Which hook is used for side effects in React components?', order: 2 },
  { id: 'q3', text: 'What does JSX stand for?', order: 3 },
]

const answers = [
  { questionId: 'q1', isCorrect: true, pointsEarned: 10, pointsPossible: 10 },
  { questionId: 'q2', isCorrect: false, pointsEarned: 0, pointsPossible: 10 },
  { questionId: 'q3', isCorrect: true, pointsEarned: 10, pointsPossible: 10 },
]

describe('QuestionBreakdown', () => {
  it('renders correct and incorrect icons for each question', async () => {
    const user = userEvent.setup()
    render(<QuestionBreakdown answers={answers} questions={questions} />)

    // Expand the collapsible
    await user.click(screen.getByRole('button', { name: /question breakdown/i }))

    const correctIcons = screen.getAllByLabelText('Correct')
    const incorrectIcons = screen.getAllByLabelText('Incorrect')
    expect(correctIcons).toHaveLength(2)
    expect(incorrectIcons).toHaveLength(1)
  })

  it('shows correct count in header', () => {
    render(<QuestionBreakdown answers={answers} questions={questions} />)

    expect(screen.getByText('2/3 correct')).toBeInTheDocument()
  })

  it('is collapsed by default', () => {
    render(<QuestionBreakdown answers={answers} questions={questions} />)

    // The list should not be visible when collapsed
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('collapsible toggle works', async () => {
    const user = userEvent.setup()
    render(<QuestionBreakdown answers={answers} questions={questions} />)

    const trigger = screen.getByRole('button', { name: /question breakdown/i })

    // Initially collapsed - list not visible
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    // Open
    await user.click(trigger)
    expect(screen.getByRole('list')).toBeInTheDocument()

    // Close
    await user.click(trigger)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('handles empty answers array gracefully', () => {
    const { container } = render(
      <QuestionBreakdown answers={[]} questions={questions} />
    )

    // Should render nothing
    expect(container.firstChild).toBeNull()
  })

  it('renders full question text (CSS truncation handles overflow)', async () => {
    const user = userEvent.setup()
    const longQuestions = [
      {
        id: 'q1',
        text: 'This is a very long question text that should be truncated after approximately fifty characters',
        order: 1,
      },
    ]
    const singleAnswer = [
      { questionId: 'q1', isCorrect: true, pointsEarned: 10, pointsPossible: 10 },
    ]

    render(<QuestionBreakdown answers={singleAnswer} questions={longQuestions} />)
    await user.click(screen.getByRole('button', { name: /question breakdown/i }))

    // Full text is in the DOM; CSS `truncate` class handles visual overflow
    expect(screen.getByText(longQuestions[0].text)).toBeInTheDocument()
  })

  it('displays points for each question', async () => {
    const user = userEvent.setup()
    render(<QuestionBreakdown answers={answers} questions={questions} />)
    await user.click(screen.getByRole('button', { name: /question breakdown/i }))

    const pointsTexts = screen.getAllByText('10/10')
    expect(pointsTexts).toHaveLength(2)
    expect(screen.getByText('0/10')).toBeInTheDocument()
  })
})
