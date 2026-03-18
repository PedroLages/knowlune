import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultipleChoiceQuestion } from '../questions/MultipleChoiceQuestion'
import type { Question } from '@/types/quiz'

function makeTestQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    order: 1,
    type: 'multiple-choice',
    text: 'What is the capital of France?',
    options: ['Paris', 'London', 'Berlin', 'Madrid'],
    correctAnswer: 'Paris',
    explanation: 'Paris is the capital of France.',
    points: 1,
    ...overrides,
  }
}

describe('MultipleChoiceQuestion', () => {
  it('renders all options from question.options', () => {
    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    expect(screen.getByText('Madrid')).toBeInTheDocument()
  })

  it('renders radio group with correct number of options', () => {
    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(4)
  })

  it('no option is pre-selected when value is undefined', () => {
    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radios = screen.getAllByRole('radio')
    radios.forEach(radio => {
      expect(radio).not.toBeChecked()
    })
  })

  it('shows the correct option as selected when value is provided', () => {
    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value="London"
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radios = screen.getAllByRole('radio')
    const london = radios.find(r => r.getAttribute('value') === 'London')
    expect(london).toBeChecked()
  })

  it('calls onChange with option text when clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value={undefined}
        onChange={handleChange}
        mode="active"
      />
    )

    await user.click(screen.getByText('Berlin'))
    expect(handleChange).toHaveBeenCalledWith('Berlin')
  })

  it('renders question text with Markdown (bold)', () => {
    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion({ text: '**Bold question** text' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const strong = screen.getByText('Bold question')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders question text with Markdown (inline code)', () => {
    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion({ text: 'What does `console.log` do?' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const code = screen.getByText('console.log')
    expect(code.tagName).toBe('CODE')
  })

  it('warns on console when fewer than 2 options', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion({ options: ['Only one'] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('has 1 options (expected 2-6)')
    )
    warnSpy.mockRestore()
  })

  it('warns on console when more than 6 options', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion({
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('has 7 options (expected 2-6)')
    )
    warnSpy.mockRestore()
  })

  it('renders with fieldset semantic structure', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const fieldset = container.querySelector('fieldset')
    expect(fieldset).toBeInTheDocument()

    const legend = container.querySelector('legend')
    expect(legend).toBeInTheDocument()
  })

  it('has radiogroup role', () => {
    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('option labels have min-h-12 class for touch targets', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const labels = container.querySelectorAll('label')
    labels.forEach(label => {
      expect(label.className).toContain('min-h-12')
    })
  })

  it('disables interaction in non-active modes', () => {
    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value="Paris"
        onChange={vi.fn()}
        mode="review-correct"
      />
    )

    // Radix RadioGroup uses data-disabled attribute, not native disabled
    const radioGroup = screen.getByRole('radiogroup')
    expect(radioGroup).toHaveAttribute('data-disabled')
  })

  it('accepts mode prop for forward compatibility (review-disabled)', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeTestQuestion()}
        value="Paris"
        onChange={vi.fn()}
        mode="review-disabled"
      />
    )

    // Verify it renders without crashing
    expect(container.querySelector('fieldset')).toBeInTheDocument()
  })

  it('gracefully renders with empty options array', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <MultipleChoiceQuestion
        question={makeTestQuestion({ options: [] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radios = screen.queryAllByRole('radio')
    expect(radios).toHaveLength(0)
    warnSpy.mockRestore()
  })
})
