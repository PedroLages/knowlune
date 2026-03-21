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
    expect(screen.getByRole('radio', { name: '3' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '4' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '5' })).toBeInTheDocument()
  })

  it('dispatches multiple-select questions to MultipleSelectQuestion', () => {
    render(
      <QuestionDisplay
        question={makeQuestion({
          type: 'multiple-select',
          options: ['A', 'B', 'C'],
          correctAnswer: ['A', 'C'],
        })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getByText('Select all that apply')).toBeInTheDocument()
  })

  it('dispatches true-false questions to TrueFalseQuestion', () => {
    render(
      <QuestionDisplay
        question={makeQuestion({
          type: 'true-false',
          options: ['True', 'False'],
        })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByText('True')).toBeInTheDocument()
    expect(screen.getByText('False')).toBeInTheDocument()
    // Should only have 2 options (not 3+ like MC)
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('narrows array value to undefined for true-false questions', () => {
    render(
      <QuestionDisplay
        question={makeQuestion({
          type: 'true-false',
          options: ['True', 'False'],
        })}
        value={['True', 'False']}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radios = screen.getAllByRole('radio')
    radios.forEach(radio => {
      expect(radio).not.toBeChecked()
    })
  })

  it('shows unsupported type fallback for unknown question types', () => {
    render(
      <QuestionDisplay
        question={makeQuestion({ type: 'essay' as Question['type'] })}
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
        question={makeQuestion({ type: 'essay' as Question['type'] })}
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
