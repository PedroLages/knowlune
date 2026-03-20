import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuizActions } from '../QuizActions'

function renderActions(overrides: Partial<React.ComponentProps<typeof QuizActions>> = {}) {
  const props = {
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onSubmit: vi.fn(),
    isFirst: false,
    isLast: false,
    ...overrides,
  }
  render(<QuizActions {...props} />)
  return props
}

describe('QuizActions', () => {
  it('renders Previous and Next when not first or last', () => {
    renderActions()
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit quiz/i })).not.toBeInTheDocument()
  })

  it('Previous is disabled when isFirst=true', () => {
    renderActions({ isFirst: true })
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
  })

  it('Next is hidden and Submit Quiz shown when isLast=true', () => {
    renderActions({ isLast: true })
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit quiz/i })).toBeInTheDocument()
  })

  it('shows Previous and Submit on a single-question quiz (isFirst && isLast)', () => {
    renderActions({ isFirst: true, isLast: true })
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /submit quiz/i })).toBeInTheDocument()
  })

  it('clicking Previous calls onPrevious', async () => {
    const { onPrevious } = renderActions()
    await userEvent.click(screen.getByRole('button', { name: /previous/i }))
    expect(onPrevious).toHaveBeenCalledOnce()
  })

  it('clicking Next calls onNext', async () => {
    const { onNext } = renderActions()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('clicking Submit Quiz calls onSubmit', async () => {
    const { onSubmit } = renderActions({ isLast: true })
    await userEvent.click(screen.getByRole('button', { name: /submit quiz/i }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('shows "Submitting..." and disables button when isSubmitting is true', () => {
    renderActions({ isLast: true, isSubmitting: true })
    const btn = screen.getByRole('button', { name: /submitting/i })
    expect(btn).toBeDisabled()
    expect(screen.queryByRole('button', { name: /submit quiz/i })).not.toBeInTheDocument()
  })
})
