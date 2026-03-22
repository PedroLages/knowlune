import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AnswerFeedback } from '../AnswerFeedback'
import type { Question } from '@/types/quiz'

const mcQuestion: Question = {
  id: 'q1',
  order: 1,
  type: 'multiple-choice',
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  explanation: 'Paris has been the capital of France since the 10th century.',
  points: 1,
}

const msQuestion: Question = {
  id: 'q2',
  order: 2,
  type: 'multiple-select',
  text: 'Which are primary colors?',
  options: ['Red', 'Green', 'Blue', 'Yellow'],
  correctAnswer: ['Red', 'Blue', 'Yellow'],
  explanation: 'The traditional primary colors are red, blue, and yellow.',
  points: 3,
}

describe('AnswerFeedback', () => {
  describe('correct answer', () => {
    it('shows "Correct!" with explanation', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer="Paris" />)

      expect(screen.getByText('Correct!')).toBeInTheDocument()
      expect(screen.getByText(/Paris has been the capital/)).toBeInTheDocument()
    })

    it('does not show correct answer indicator', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer="Paris" />)

      expect(screen.queryByText(/Correct answer:/)).not.toBeInTheDocument()
    })

    it('does not show points when full marks earned', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer="Paris" />)

      expect(screen.queryByText(/You earned/)).not.toBeInTheDocument()
    })
  })

  describe('incorrect answer', () => {
    it('shows "Not quite" with explanation and correct answer', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer="London" />)

      expect(screen.getByText('Not quite')).toBeInTheDocument()
      expect(screen.getByText(/Paris has been the capital/)).toBeInTheDocument()
      expect(screen.getByText(/Correct answer:/)).toBeInTheDocument()
      expect(screen.getByText('Paris')).toBeInTheDocument()
    })

    it('shows zero points earned', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer="London" />)

      expect(screen.getByText(/You earned 0 of 1 point/)).toBeInTheDocument()
    })
  })

  describe('partial credit (multiple-select)', () => {
    it('shows partial credit count and per-option breakdown', () => {
      // Select 2 of 3 correct (Red, Blue) — missing Yellow
      render(<AnswerFeedback question={msQuestion} userAnswer={['Red', 'Blue']} />)

      expect(screen.getByText('2 of 3 correct')).toBeInTheDocument()

      const breakdown = screen.getByRole('list', { name: 'Answer breakdown' })
      expect(within(breakdown).getByText('Red')).toBeInTheDocument()
      expect(within(breakdown).getByText('Blue')).toBeInTheDocument()
      expect(within(breakdown).getByText(/Yellow.*missed/)).toBeInTheDocument()
    })

    it('shows incorrectly selected options in breakdown', () => {
      // Select 2 correct (Red, Blue) + 1 wrong (Green) — missing Yellow
      // PCM: (2-1)/3 * 3 = 1 point → partial credit with breakdown
      render(<AnswerFeedback question={msQuestion} userAnswer={['Red', 'Blue', 'Green']} />)

      const breakdown = screen.getByRole('list', { name: 'Answer breakdown' })
      expect(within(breakdown).getByText('Red')).toBeInTheDocument()
      expect(within(breakdown).getByText('Blue')).toBeInTheDocument()
      // Green should appear as incorrectly selected
      expect(within(breakdown).getByText('Green')).toBeInTheDocument()
      // Missed correct option
      expect(within(breakdown).getByText(/Yellow.*missed/)).toBeInTheDocument()
    })

    it('shows points earned for partial credit', () => {
      render(<AnswerFeedback question={msQuestion} userAnswer={['Red', 'Blue']} />)

      expect(screen.getByText(/You earned/)).toBeInTheDocument()
    })

    it('shows full-credit multiple-select as "Correct!" not partial', () => {
      render(
        <AnswerFeedback question={msQuestion} userAnswer={['Red', 'Blue', 'Yellow']} />
      )

      expect(screen.getByText('Correct!')).toBeInTheDocument()
      // No answer breakdown for full credit
      expect(screen.queryByRole('list', { name: 'Answer breakdown' })).not.toBeInTheDocument()
    })

    it('shows all-wrong multiple-select as "Not quite" not partial', () => {
      render(<AnswerFeedback question={msQuestion} userAnswer={['Green']} />)

      expect(screen.getByText('Not quite')).toBeInTheDocument()
      // No partial breakdown — 0 points earned
      expect(screen.queryByRole('list', { name: 'Answer breakdown' })).not.toBeInTheDocument()
    })
  })

  describe('time-expired', () => {
    it('shows "Not answered in time" with correct answer', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer={undefined} isTimerExpired />)

      expect(screen.getByText('Not answered in time')).toBeInTheDocument()
      expect(screen.getByText(/Correct answer:/)).toBeInTheDocument()
      expect(screen.getByText('Paris')).toBeInTheDocument()
    })

    it('shows explanation', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer={undefined} isTimerExpired />)

      expect(screen.getByText(/Paris has been the capital/)).toBeInTheDocument()
    })

    it('handles timer-expired with empty array (multiple-select unanswered)', () => {
      render(<AnswerFeedback question={msQuestion} userAnswer={[]} isTimerExpired />)

      expect(screen.getByText('Not answered in time')).toBeInTheDocument()
      expect(screen.getByText(/Correct answer:/)).toBeInTheDocument()
    })

    it('handles timer-expired with empty string', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer="" isTimerExpired />)

      expect(screen.getByText('Not answered in time')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has role="status" and aria-live="polite"', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer="Paris" />)

      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
    })

    it('icons are decorative (aria-hidden)', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer="Paris" />)

      const status = screen.getByRole('status')
      const svgs = status.querySelectorAll('svg')
      svgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true')
      })
    })

    it('uses text labels not just color for state indication', () => {
      render(<AnswerFeedback question={mcQuestion} userAnswer="London" />)

      // Text label present (not relying solely on color)
      expect(screen.getByText('Not quite')).toBeInTheDocument()
      // Icon present
      const status = screen.getByRole('status')
      expect(status.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('renders without explanation when explanation is empty', () => {
      const noExplanation: Question = { ...mcQuestion, explanation: '' }
      render(<AnswerFeedback question={noExplanation} userAnswer="Paris" />)

      expect(screen.getByText('Correct!')).toBeInTheDocument()
    })

    it('does not render whitespace-only explanation', () => {
      const wsExplanation: Question = { ...mcQuestion, explanation: '   ' }
      const { container } = render(<AnswerFeedback question={wsExplanation} userAnswer="Paris" />)

      // No MarkdownRenderer content block rendered
      expect(container.querySelector('.prose')).not.toBeInTheDocument()
    })

    it('handles fill-in-blank correct (case-insensitive match happens in scoring)', () => {
      const fibQuestion: Question = {
        id: 'q3',
        order: 3,
        type: 'fill-in-blank',
        text: 'The process plants use to make food is called ___',
        correctAnswer: 'photosynthesis',
        explanation: 'Photosynthesis converts light energy to chemical energy.',
        points: 2,
      }
      render(<AnswerFeedback question={fibQuestion} userAnswer="Photosynthesis" />)

      expect(screen.getByText('Correct!')).toBeInTheDocument()
    })

    it('handles true/false incorrect', () => {
      const tfQuestion: Question = {
        id: 'q4',
        order: 4,
        type: 'true-false',
        text: 'The Earth is flat.',
        options: ['true', 'false'],
        correctAnswer: 'false',
        explanation: 'The Earth is approximately spherical.',
        points: 1,
      }
      render(<AnswerFeedback question={tfQuestion} userAnswer="true" />)

      expect(screen.getByText('Not quite')).toBeInTheDocument()
      expect(screen.getByText(/Correct answer:/)).toBeInTheDocument()
    })
  })
})
