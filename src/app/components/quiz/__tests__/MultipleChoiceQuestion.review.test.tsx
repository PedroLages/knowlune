import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MultipleChoiceQuestion } from '../questions/MultipleChoiceQuestion'
import { makeQuestion } from '../../../../../tests/support/fixtures/factories/quiz-factory'

const q = makeQuestion({
  id: 'mc-review',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
})

describe('MultipleChoiceQuestion — review modes', () => {
  it('review-correct: selected correct option shows success styling', () => {
    const { container } = render(
      <MultipleChoiceQuestion
        question={q}
        value="Paris"
        onChange={vi.fn()}
        mode="review-correct"
      />
    )
    const parisLabel = screen.getByText('Paris').closest('label')!
    expect(parisLabel.className).toMatch(/border-success/)
    expect(parisLabel.className).toMatch(/bg-success-soft/)
  })

  it('review-incorrect: selected wrong option shows warning styling', () => {
    render(
      <MultipleChoiceQuestion
        question={q}
        value="London"
        onChange={vi.fn()}
        mode="review-incorrect"
      />
    )
    const londonLabel = screen.getByText('London').closest('label')!
    expect(londonLabel.className).toMatch(/border-warning/)
    expect(londonLabel.className).toMatch(/bg-warning/)
  })

  it('review-incorrect: unselected correct option shown with success styling', () => {
    render(
      <MultipleChoiceQuestion
        question={q}
        value="London"
        onChange={vi.fn()}
        mode="review-incorrect"
      />
    )
    const parisLabel = screen.getByText('Paris').closest('label')!
    expect(parisLabel.className).toMatch(/border-success/)
    expect(parisLabel.className).toMatch(/bg-success-soft/)
  })

  it('review-disabled: all options show muted/inactive styling', () => {
    render(
      <MultipleChoiceQuestion
        question={q}
        value={undefined}
        onChange={vi.fn()}
        mode="review-disabled"
      />
    )
    // No option should have success or warning colors
    const labels = document.querySelectorAll('label')
    labels.forEach(label => {
      expect(label.className).not.toMatch(/border-success/)
      expect(label.className).not.toMatch(/border-warning/)
    })
  })

  it('radio buttons are all disabled in review mode', () => {
    render(
      <MultipleChoiceQuestion
        question={q}
        value="Paris"
        onChange={vi.fn()}
        mode="review-correct"
      />
    )
    const radios = screen.getAllByRole('radio')
    radios.forEach(radio => {
      expect(radio).toBeDisabled()
    })
  })
})
