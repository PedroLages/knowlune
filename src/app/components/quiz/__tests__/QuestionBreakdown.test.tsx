import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionBreakdown } from '../QuestionBreakdown'

const questions = [
  {
    id: 'q1',
    text: 'What is React?',
    order: 1,
    explanation: 'React is a JavaScript library for building user interfaces.',
    correctAnswer: 'A library',
  },
  {
    id: 'q2',
    text: 'Which hook is used for side effects in React components?',
    order: 2,
    explanation: 'useEffect is the hook for side effects.',
    correctAnswer: 'useEffect',
  },
  {
    id: 'q3',
    text: 'What does JSX stand for?',
    order: 3,
    // No explanation — tests non-expandable row
  },
]

const answers = [
  { questionId: 'q1', isCorrect: true, pointsEarned: 10, pointsPossible: 10, userAnswer: 'A library' },
  { questionId: 'q2', isCorrect: false, pointsEarned: 0, pointsPossible: 10, userAnswer: 'useState' },
  { questionId: 'q3', isCorrect: true, pointsEarned: 10, pointsPossible: 10, userAnswer: 'JavaScript XML' },
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
    const { container } = render(<QuestionBreakdown answers={[]} questions={questions} />)

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
      { questionId: 'q1', isCorrect: true, pointsEarned: 10, pointsPossible: 10, userAnswer: 'A' },
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

  describe('expandable details', () => {
    it('expands incorrect question to show explanation and correct answer', async () => {
      const user = userEvent.setup()
      render(<QuestionBreakdown answers={answers} questions={questions} />)
      await user.click(screen.getByRole('button', { name: /question breakdown/i }))

      // Click incorrect question row to expand
      const q2Row = screen.getByRole('button', { name: /Q2/ })
      expect(q2Row).toHaveAttribute('aria-expanded', 'false')
      await user.click(q2Row)

      // Details region appears
      const details = screen.getByRole('region', { name: /details for question 2/i })
      expect(details).toBeInTheDocument()

      // Correct answer shown
      expect(screen.getByText(/Correct answer:/)).toBeInTheDocument()
      expect(screen.getByText('useEffect')).toBeInTheDocument()

      // Explanation shown
      expect(screen.getByText(/useEffect is the hook/)).toBeInTheDocument()

      // aria-expanded updated
      expect(q2Row).toHaveAttribute('aria-expanded', 'true')
    })

    it('collapses expanded question on second click', async () => {
      const user = userEvent.setup()
      render(<QuestionBreakdown answers={answers} questions={questions} />)
      await user.click(screen.getByRole('button', { name: /question breakdown/i }))

      const q2Row = screen.getByRole('button', { name: /Q2/ })
      await user.click(q2Row)
      expect(screen.getByRole('region')).toBeInTheDocument()

      await user.click(q2Row)
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('renders non-expandable correct row as div (not disabled button)', async () => {
      const user = userEvent.setup()
      render(<QuestionBreakdown answers={answers} questions={questions} />)
      await user.click(screen.getByRole('button', { name: /question breakdown/i }))

      // Q3 is correct with no explanation — rendered as div, not button
      const q3Text = screen.getByText('What does JSX stand for?')
      const q3Container = q3Text.closest('[class*="flex w-full"]')
      expect(q3Container?.tagName).toBe('DIV')
      // Should not have aria-expanded
      expect(q3Container).not.toHaveAttribute('aria-expanded')
    })

    it('shows unanswered question with "not answered in time" text', async () => {
      const user = userEvent.setup()
      const unansweredAnswers = [
        { questionId: 'q1', isCorrect: false, pointsEarned: 0, pointsPossible: 10, userAnswer: '' },
      ]
      render(<QuestionBreakdown answers={unansweredAnswers} questions={questions} />)
      await user.click(screen.getByRole('button', { name: /question breakdown/i }))

      // Clock icon shown for unanswered
      expect(screen.getByLabelText('Not answered in time')).toBeInTheDocument()

      // Expand to see details
      const q1Row = screen.getByRole('button', { name: /Q1/ })
      await user.click(q1Row)

      expect(screen.getByText(/not answered in time/i)).toBeInTheDocument()
      expect(screen.getByText(/Correct answer:/)).toBeInTheDocument()
    })

    it('expands correct question with explanation to show it', async () => {
      const user = userEvent.setup()
      render(<QuestionBreakdown answers={answers} questions={questions} />)
      await user.click(screen.getByRole('button', { name: /question breakdown/i }))

      // Q1 is correct but HAS explanation — should be expandable
      const q1Row = screen.getByRole('button', { name: /Q1/ })
      await user.click(q1Row)

      expect(screen.getByText(/React is a JavaScript library/)).toBeInTheDocument()
      // Correct answer NOT shown for correct questions
      expect(screen.queryByText(/Correct answer:/)).not.toBeInTheDocument()
    })
  })
})
