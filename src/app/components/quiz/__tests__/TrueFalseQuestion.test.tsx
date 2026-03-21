import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrueFalseQuestion } from '../questions/TrueFalseQuestion'
import { makeQuestion } from '../../../../../tests/support/fixtures/factories/quiz-factory'

function makeTrueFalseQuestion(overrides: Parameters<typeof makeQuestion>[0] = {}) {
  return makeQuestion({
    type: 'true-false',
    text: 'Photosynthesis requires sunlight.',
    options: ['True', 'False'],
    correctAnswer: 'True',
    ...overrides,
  })
}

describe('TrueFalseQuestion', () => {
  it('renders exactly two options: "True" and "False"', () => {
    render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(screen.getByText('True')).toBeInTheDocument()
    expect(screen.getByText('False')).toBeInTheDocument()
  })

  it('no option is pre-selected when value is undefined', () => {
    render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
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
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
        value="True"
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radios = screen.getAllByRole('radio')
    const trueRadio = radios.find(r => r.getAttribute('value') === 'True')
    expect(trueRadio).toBeChecked()
  })

  it('calls onChange with option text when clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
        value={undefined}
        onChange={handleChange}
        mode="active"
      />
    )

    await user.click(screen.getByText('True'))
    expect(handleChange).toHaveBeenCalledWith('True')
  })

  it('applies selected CSS classes to selected option label', () => {
    const { container } = render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
        value="True"
        onChange={vi.fn()}
        mode="active"
      />
    )

    const labels = container.querySelectorAll('label')
    const trueLabel = Array.from(labels).find(l => l.textContent?.includes('True'))
    expect(trueLabel?.className).toContain('border-brand')
    expect(trueLabel?.className).toContain('bg-brand-soft')

    const falseLabel = Array.from(labels).find(l => l.textContent?.includes('False'))
    expect(falseLabel?.className).toContain('border-border')
    expect(falseLabel?.className).toContain('bg-card')
  })

  it('all labels use border-2 for consistent width (no layout shift)', () => {
    const { container } = render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
        value="True"
        onChange={vi.fn()}
        mode="active"
      />
    )

    const labels = container.querySelectorAll('label')
    labels.forEach(label => {
      expect(label.className).toContain('border-2')
    })
  })

  it('renders with fieldset semantic structure', () => {
    const { container } = render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(container.querySelector('fieldset')).toBeInTheDocument()
    expect(container.querySelector('legend')).toBeInTheDocument()
  })

  it('has radiogroup role with aria-labelledby pointing to legend', () => {
    const { container } = render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const radioGroup = screen.getByRole('radiogroup')
    const legend = container.querySelector('legend')
    const legendId = legend?.getAttribute('id')
    expect(legendId).toBeTruthy()
    expect(radioGroup).toHaveAttribute('aria-labelledby', legendId)
  })

  it('option labels have min-h-12 class for touch targets', () => {
    const { container } = render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
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
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
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

  it('disables interaction in review mode', () => {
    render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
        value="True"
        onChange={vi.fn()}
        mode="review-correct"
      />
    )

    const radioGroup = screen.getByRole('radiogroup')
    expect(radioGroup).toHaveAttribute('data-disabled')
  })

  it('renders question text with Markdown', () => {
    render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion({ text: '**Photosynthesis** requires sunlight.' })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    const strong = screen.getByText('Photosynthesis')
    expect(strong.tagName).toBe('STRONG')
  })

  it('warns on console when options count is not 2', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion({ options: ['True', 'False', 'Maybe'] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has 3 options (expected 2)'))
    warnSpy.mockRestore()
  })

  it('does not warn for exactly 2 options', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <TrueFalseQuestion
        question={makeTrueFalseQuestion()}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
