import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MultipleSelectQuestion } from '../questions/MultipleSelectQuestion'
import { makeQuestion } from '../../../../../tests/support/fixtures/factories/quiz-factory'

function makeMultiSelectQuestion(overrides: Parameters<typeof makeQuestion>[0] = {}) {
  return makeQuestion({
    type: 'multiple-select',
    text: 'Which of the following are valid?',
    options: ['Option A', 'Option B', 'Option C'],
    correctAnswer: ['Option A', 'Option B'],
    ...overrides,
  })
}

describe('MultipleSelectQuestion', () => {
  it('renders question text with Markdown (inline code)', () => {
    render(
      <MultipleSelectQuestion
        question={makeMultiSelectQuestion({ text: 'Which uses of `Array.map` are correct?' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const code = screen.getByText('Array.map')
    expect(code.tagName).toBe('CODE')
  })

  it('renders question text with Markdown (bold)', () => {
    render(
      <MultipleSelectQuestion
        question={makeMultiSelectQuestion({ text: 'Select all **valid** options:' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const strong = screen.getByText('valid')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders with fieldset and aria-labelledby referencing existing element', () => {
    const { container } = render(
      <MultipleSelectQuestion
        question={makeMultiSelectQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const fieldset = container.querySelector('fieldset')
    expect(fieldset).toBeInTheDocument()
    const labelId = fieldset?.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()

    const labelElement = container.querySelector(`#${labelId}`)
    expect(labelElement).toBeInTheDocument()
    expect(labelElement?.textContent).toContain('valid')
  })
})
