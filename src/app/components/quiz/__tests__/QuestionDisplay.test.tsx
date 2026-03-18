import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionDisplay } from '../QuestionDisplay'
import type { Question } from '@/types/quiz'

function makeTestQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    order: 1,
    type: 'multiple-choice',
    text: 'What is 2 + 2?',
    options: ['3', '4', '5'],
    correctAnswer: '4',
    explanation: '',
    points: 1,
    ...overrides,
  }
}

describe('QuestionDisplay', () => {
  it('dispatches multiple-choice questions to MultipleChoiceQuestion', () => {
    render(
      <QuestionDisplay
        question={makeTestQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows unsupported type fallback for unknown question types', () => {
    render(
      <QuestionDisplay
        question={makeTestQuestion({ type: 'fill-in-blank' as Question['type'] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(screen.getByText(/unsupported question type/i)).toBeInTheDocument()
  })

  it('defaults mode to active when not provided', () => {
    render(<QuestionDisplay question={makeTestQuestion()} value={undefined} onChange={vi.fn()} />)

    // Active mode: radiogroup should be enabled
    const radioGroup = screen.getByRole('radiogroup')
    expect(radioGroup).not.toHaveAttribute('disabled')
  })
})
