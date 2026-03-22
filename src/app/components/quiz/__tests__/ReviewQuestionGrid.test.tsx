import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewQuestionGrid } from '../ReviewQuestionGrid'
import { makeQuestion, makeCorrectAnswer, makeWrongAnswer } from '../../../../../tests/support/fixtures/factories/quiz-factory'

const q1 = makeQuestion({ id: 'q1', order: 1 })
const q2 = makeQuestion({ id: 'q2', order: 2 })
const q3 = makeQuestion({ id: 'q3', order: 3 })

describe('ReviewQuestionGrid', () => {
  it('renders correct number of buttons', () => {
    render(
      <ReviewQuestionGrid
        questions={[q1, q2, q3]}
        answers={[]}
        currentIndex={0}
        onQuestionClick={vi.fn()}
      />
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('correct answers have aria label "correct"', () => {
    render(
      <ReviewQuestionGrid
        questions={[q1]}
        answers={[makeCorrectAnswer('q1')]}
        currentIndex={1}
        onQuestionClick={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Question 1, correct/i })).toBeInTheDocument()
  })

  it('incorrect answers have aria label "incorrect"', () => {
    render(
      <ReviewQuestionGrid
        questions={[q1]}
        answers={[makeWrongAnswer('q1')]}
        currentIndex={1}
        onQuestionClick={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Question 1, incorrect/i })).toBeInTheDocument()
  })

  it('unanswered questions have aria label "unanswered"', () => {
    render(
      <ReviewQuestionGrid
        questions={[q1]}
        answers={[]}
        currentIndex={1}
        onQuestionClick={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Question 1, unanswered/i })).toBeInTheDocument()
  })

  it('current index button has aria-current="step"', () => {
    render(
      <ReviewQuestionGrid
        questions={[q1, q2]}
        answers={[]}
        currentIndex={0}
        onQuestionClick={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: /Question 1/i })
    expect(btn).toHaveAttribute('aria-current', 'step')
  })

  it('calls onQuestionClick with the correct index when clicked', async () => {
    const handleClick = vi.fn()
    render(
      <ReviewQuestionGrid
        questions={[q1, q2, q3]}
        answers={[]}
        currentIndex={0}
        onQuestionClick={handleClick}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /Question 2/i }))
    expect(handleClick).toHaveBeenCalledWith(1)
  })
})
