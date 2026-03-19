import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuizNavigation } from '../QuizNavigation'
import { makeQuiz, makeQuestion, makeProgress } from '../../../../../tests/support/fixtures/factories/quiz-factory'

const q1 = makeQuestion({ id: 'q1', order: 1 })
const q2 = makeQuestion({ id: 'q2', order: 2 })
const q3 = makeQuestion({ id: 'q3', order: 3 })

const quiz = makeQuiz({ id: 'quiz-1', questions: [q1, q2, q3] })
const progress = makeProgress('quiz-1', {
  questionOrder: ['q1', 'q2', 'q3'],
  currentQuestionIndex: 0,
})

const defaultProps = {
  quiz,
  progress,
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onSubmit: vi.fn(),
  onQuestionClick: vi.fn(),
}

describe('QuizNavigation', () => {
  it('renders with aria-label="Quiz navigation"', () => {
    render(<QuizNavigation {...defaultProps} />)
    expect(screen.getByRole('navigation', { name: 'Quiz navigation' })).toBeInTheDocument()
  })

  it('renders QuizActions (Previous/Next buttons)', () => {
    render(<QuizNavigation {...defaultProps} />)
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('renders QuestionGrid with correct bubble count', () => {
    render(<QuizNavigation {...defaultProps} />)
    expect(screen.getByLabelText('Question 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Question 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Question 3')).toBeInTheDocument()
  })
})
