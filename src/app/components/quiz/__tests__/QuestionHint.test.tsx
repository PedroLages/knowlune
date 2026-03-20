import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionHint } from '../QuestionHint'

describe('QuestionHint', () => {
  it('renders nothing when hint is undefined', () => {
    const { container } = render(<QuestionHint />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when hint is empty string', () => {
    const { container } = render(<QuestionHint hint="" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders hint text when hint is provided', () => {
    render(<QuestionHint hint="Think about European geography." />)

    expect(screen.getByText('Hint')).toBeInTheDocument()
    expect(screen.getByText('Think about European geography.')).toBeInTheDocument()
  })

  it('has correct ARIA attributes', () => {
    render(<QuestionHint hint="Some helpful hint." />)

    const note = screen.getByRole('note')
    expect(note).toHaveAttribute('aria-label', 'Question hint')
  })

  it('renders lightbulb icon as decorative', () => {
    render(<QuestionHint hint="A hint" />)

    const note = screen.getByRole('note')
    const svg = note.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})
