import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FillInBlankQuestion } from '../questions/FillInBlankQuestion'
import { makeQuestion } from '../../../../../tests/support/fixtures/factories/quiz-factory'

function makeFillInBlankQuestion(overrides: Parameters<typeof makeQuestion>[0] = {}) {
  return makeQuestion({
    type: 'fill-in-blank',
    text: 'What is the output of the expression?',
    options: [],
    correctAnswer: '42',
    ...overrides,
  })
}

describe('FillInBlankQuestion', () => {
  it('renders question text with Markdown (inline code)', () => {
    render(
      <FillInBlankQuestion
        question={makeFillInBlankQuestion({ text: 'What does `typeof null` return?' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const code = screen.getByText('typeof null')
    expect(code.tagName).toBe('CODE')
  })

  it('renders question text with Markdown (bold)', () => {
    render(
      <FillInBlankQuestion
        question={makeFillInBlankQuestion({ text: 'Enter the **exact** output:' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const strong = screen.getByText('exact')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders with fieldset and legend containing question text', () => {
    const { container } = render(
      <FillInBlankQuestion
        question={makeFillInBlankQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const fieldset = container.querySelector('fieldset')
    expect(fieldset).toBeInTheDocument()

    // Legend provides the accessible name for the fieldset
    const legend = fieldset?.querySelector('legend')
    expect(legend).toBeInTheDocument()
    expect(legend?.textContent).toContain('output')
  })
})
