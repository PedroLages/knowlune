import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionDisplay } from '../QuestionDisplay'
import type { Question } from '@/types/quiz'
import { makeQuestion } from '../../../../../tests/support/fixtures/factories/quiz-factory'

describe('QuestionDisplay', () => {
  it('dispatches multiple-choice questions to MultipleChoiceQuestion', () => {
    render(
      <QuestionDisplay
        question={makeQuestion({ options: ['3', '4', '5'] })}
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
        question={makeQuestion({ type: 'fill-in-blank' as Question['type'] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(screen.getByText(/unsupported question type/i)).toBeInTheDocument()
  })

  it('unsupported type fallback has role="status"', () => {
    render(
      <QuestionDisplay
        question={makeQuestion({ type: 'fill-in-blank' as Question['type'] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('defaults mode to active when not provided', () => {
    render(<QuestionDisplay question={makeQuestion()} value={undefined} onChange={vi.fn()} />)

    // Active mode: radiogroup should not be disabled
    const radioGroup = screen.getByRole('radiogroup')
    expect(radioGroup).not.toHaveAttribute('data-disabled')
  })

  it('narrows value type safely for multiple-choice (ignores array values)', () => {
    render(
      <QuestionDisplay
        question={makeQuestion()}
        value={['Paris', 'London']}
        onChange={vi.fn()}
        mode="active"
      />
    )

    // Array value should be treated as undefined for MC (no pre-selection)
    const radios = screen.getAllByRole('radio')
    radios.forEach(radio => {
      expect(radio).not.toBeChecked()
    })
  })
})
