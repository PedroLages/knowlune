import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultipleChoiceQuestion } from '../questions/MultipleChoiceQuestion'
import { makeQuestion } from '../../../../../tests/support/fixtures/factories/quiz-factory'

describe('MultipleChoiceQuestion', () => {
  it('renders all options from question.options', () => {
    render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
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
        question={makeQuestion()}
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
        question={makeQuestion()}
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
        question={makeQuestion()}
        value="London"
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radios = screen.getAllByRole('radio')
    const london = radios.find(r => r.getAttribute('value') === 'London')
    expect(london).toBeChecked()
  })

  it('applies selected CSS classes to selected option label', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
        value="London"
        onChange={vi.fn()}
        mode="active"
      />
    )

    const labels = container.querySelectorAll('label')
    const londonLabel = Array.from(labels).find(l => l.textContent?.includes('London'))
    expect(londonLabel?.className).toContain('border-brand')
    expect(londonLabel?.className).toContain('bg-brand-soft')

    // Unselected labels should have border-border
    const parisLabel = Array.from(labels).find(l => l.textContent?.includes('Paris'))
    expect(parisLabel?.className).toContain('border-border')
    expect(parisLabel?.className).toContain('bg-card')
  })

  it('all labels use border-2 for consistent width (no layout shift)', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
        value="London"
        onChange={vi.fn()}
        mode="active"
      />
    )

    const labels = container.querySelectorAll('label')
    labels.forEach(label => {
      expect(label.className).toContain('border-2')
    })
  })

  it('calls onChange with option text when clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
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
        question={makeQuestion({ text: '**Bold question** text' })}
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
        question={makeQuestion({ text: 'What does `console.log` do?' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const code = screen.getByText('console.log')
    expect(code.tagName).toBe('CODE')
  })

  it('renders question text with GFM strikethrough', () => {
    render(
      <MultipleChoiceQuestion
        question={makeQuestion({ text: 'This is ~~wrong~~ correct' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const del = screen.getByText('wrong')
    expect(del.tagName).toBe('DEL')
  })

  it('renders question text via MarkdownRenderer (no legend needed)', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeQuestion({ text: 'Simple question text' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    // Question text is in a div (not legend) — block content is valid
    const questionText = container.querySelector('[data-testid="question-text"]')
    expect(questionText).toBeInTheDocument()
    expect(questionText?.tagName).toBe('DIV')
  })

  it('warns on console when fewer than 2 options', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <MultipleChoiceQuestion
        question={makeQuestion({ options: ['Only one'] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has 1 options (expected 2-6)'))
    warnSpy.mockRestore()
  })

  it('warns on console when more than 6 options', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <MultipleChoiceQuestion
        question={makeQuestion({
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has 7 options (expected 2-6)'))
    warnSpy.mockRestore()
  })

  it('does not warn for valid option counts (2 and 6)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { unmount } = render(
      <MultipleChoiceQuestion
        question={makeQuestion({ options: ['A', 'B'] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )
    expect(warnSpy).not.toHaveBeenCalled()
    unmount()

    render(
      <MultipleChoiceQuestion
        question={makeQuestion({ options: ['A', 'B', 'C', 'D', 'E', 'F'] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('renders with fieldset semantic structure and aria-labelledby', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const fieldset = container.querySelector('fieldset')
    expect(fieldset).toBeInTheDocument()
    expect(fieldset?.getAttribute('aria-labelledby')).toBeTruthy()

    const labelId = fieldset?.getAttribute('aria-labelledby')
    const label = container.querySelector(`#${CSS.escape(labelId!)}`)
    expect(label).toBeInTheDocument()
  })

  it('has radiogroup inside fieldset with aria-labelledby (fieldset provides accessible name)', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radioGroup = screen.getByRole('radiogroup')
    expect(radioGroup).toBeInTheDocument()

    // RadioGroup is inside fieldset — fieldset/legend provides the accessible name
    const fieldset = container.querySelector('fieldset')
    expect(fieldset).toBeInTheDocument()
    expect(fieldset?.contains(radioGroup)).toBe(true)
  })

  it('option labels have min-h-12 class for touch targets', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
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

  it('option labels have focus-within ring for keyboard indication', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const labels = container.querySelectorAll('label')
    labels.forEach(label => {
      expect(label.className).toContain('focus-within:ring-2')
    })
  })

  it('disables interaction in review-correct mode', () => {
    render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
        value="Paris"
        onChange={vi.fn()}
        mode="review-correct"
      />
    )

    const radioGroup = screen.getByRole('radiogroup')
    expect(radioGroup).toHaveAttribute('data-disabled')
  })

  it('disables interaction in review-incorrect mode', () => {
    render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
        value="London"
        onChange={vi.fn()}
        mode="review-incorrect"
      />
    )

    const radioGroup = screen.getByRole('radiogroup')
    expect(radioGroup).toHaveAttribute('data-disabled')
  })

  it('accepts mode prop for forward compatibility (review-disabled)', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={makeQuestion()}
        value="Paris"
        onChange={vi.fn()}
        mode="review-disabled"
      />
    )

    expect(container.querySelector('fieldset')).toBeInTheDocument()
    const radioGroup = screen.getByRole('radiogroup')
    expect(radioGroup).toHaveAttribute('data-disabled')
  })

  it('gracefully renders with empty options array', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <MultipleChoiceQuestion
        question={makeQuestion({ options: [] })}
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
