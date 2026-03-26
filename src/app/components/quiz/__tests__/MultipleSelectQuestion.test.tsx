import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('renders with fieldset and legend containing question text', () => {
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

    // Legend provides the accessible name for the fieldset
    const legend = fieldset?.querySelector('legend')
    expect(legend).toBeInTheDocument()
    expect(legend?.textContent).toContain('valid')
  })

  describe('ARIA live announcements (AC2)', () => {
    it('has an aria-live="polite" region for selection announcements', () => {
      render(
        <MultipleSelectQuestion
          question={makeMultiSelectQuestion()}
          value={undefined}
          onChange={vi.fn()}
          mode="active"
        />
      )

      const liveRegion = screen.getByTestId('selection-announcement')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })

    it('announces "Option N selected" when an option is checked', async () => {
      const onChange = vi.fn()
      render(
        <MultipleSelectQuestion
          question={makeMultiSelectQuestion()}
          value={[]}
          onChange={onChange}
          mode="active"
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0]) // Click "Option A" (Option 1)

      const liveRegion = screen.getByTestId('selection-announcement')
      expect(liveRegion).toHaveTextContent('Option 1 selected')
    })

    it('announces "Option N deselected" when an option is unchecked', async () => {
      const onChange = vi.fn()
      render(
        <MultipleSelectQuestion
          question={makeMultiSelectQuestion()}
          value={['Option A']}
          onChange={onChange}
          mode="active"
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0]) // Uncheck "Option A" (Option 1)

      const liveRegion = screen.getByTestId('selection-announcement')
      expect(liveRegion).toHaveTextContent('Option 1 deselected')
    })
  })
})
