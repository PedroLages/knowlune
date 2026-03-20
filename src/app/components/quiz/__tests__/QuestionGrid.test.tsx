import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionGrid } from '../QuestionGrid'

const defaultProps = {
  total: 3,
  answers: {},
  questionOrder: ['q1', 'q2', 'q3'],
  currentIndex: 0,
  markedForReview: [],
  onQuestionClick: vi.fn(),
}

describe('QuestionGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the correct number of bubbles', () => {
    render(<QuestionGrid {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(screen.getByLabelText('Question 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Question 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Question 3')).toBeInTheDocument()
  })

  it('current question has aria-current="step", others do not', () => {
    render(<QuestionGrid {...defaultProps} currentIndex={1} />)
    expect(screen.getByLabelText('Question 1')).not.toHaveAttribute('aria-current')
    expect(screen.getByLabelText('Question 2')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByLabelText('Question 3')).not.toHaveAttribute('aria-current')
  })

  it('answered questions get answered class (bg-brand-soft)', () => {
    render(<QuestionGrid {...defaultProps} answers={{ q1: 'A', q2: '' }} currentIndex={2} />)
    // q1 answered — has bg-brand-soft
    expect(screen.getByLabelText('Question 1').className).toContain('bg-brand-soft')
    // q2 empty string — treated as unanswered
    expect(screen.getByLabelText('Question 2').className).toContain('bg-card')
    // q3 unanswered (current, so gets bg-brand)
    expect(screen.getByLabelText('Question 3').className).toContain('bg-brand')
  })

  it('unanswered non-current questions get default class (bg-card)', () => {
    render(<QuestionGrid {...defaultProps} currentIndex={2} />)
    expect(screen.getByLabelText('Question 1').className).toContain('bg-card')
    expect(screen.getByLabelText('Question 2').className).toContain('bg-card')
  })

  it('clicking a bubble calls onQuestionClick with the correct 0-based index', async () => {
    const onQuestionClick = vi.fn()
    render(<QuestionGrid {...defaultProps} onQuestionClick={onQuestionClick} />)

    await userEvent.click(screen.getByLabelText('Question 3'))
    expect(onQuestionClick).toHaveBeenCalledWith(2)

    await userEvent.click(screen.getByLabelText('Question 1'))
    expect(onQuestionClick).toHaveBeenCalledWith(0)
  })

  describe('review indicator', () => {
    it('renders a review indicator for marked questions', () => {
      render(<QuestionGrid {...defaultProps} markedForReview={['q2']} />)
      // q2 is marked — its button aria-label includes "marked for review"
      expect(screen.getByLabelText('Question 2, marked for review')).toBeInTheDocument()
    })

    it('does not render review indicator for unmarked questions', () => {
      render(<QuestionGrid {...defaultProps} markedForReview={['q2']} />)
      expect(screen.getByLabelText('Question 1')).toBeInTheDocument()
      expect(screen.getByLabelText('Question 3')).toBeInTheDocument()
    })

    it('aria-label includes "marked for review" when question is marked', () => {
      render(<QuestionGrid {...defaultProps} markedForReview={['q1', 'q3']} />)
      expect(screen.getByLabelText('Question 1, marked for review')).toBeInTheDocument()
      expect(screen.getByLabelText('Question 2')).toBeInTheDocument()
      expect(screen.getByLabelText('Question 3, marked for review')).toBeInTheDocument()
    })

    it('shows no indicators when markedForReview is empty', () => {
      render(<QuestionGrid {...defaultProps} markedForReview={[]} />)
      expect(screen.getByLabelText('Question 1')).toBeInTheDocument()
      expect(screen.getByLabelText('Question 2')).toBeInTheDocument()
      expect(screen.getByLabelText('Question 3')).toBeInTheDocument()
    })
  })
})
