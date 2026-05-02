import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LinkedFlashcardPanel } from '../LinkedFlashcardPanel'
import type { Flashcard } from '@/data/types'

const flashcard: Flashcard = {
  id: 'card-1',
  courseId: '',
  sourceType: 'book',
  sourceBookId: 'book-1',
  sourceHighlightId: 'highlight-1',
  front: 'Principles are [___] truths',
  back: 'Principles are fundamental truths',
  stability: 0,
  difficulty: 0,
  reps: 2,
  lapses: 0,
  state: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  due: '2026-04-27T00:00:00.000Z',
  createdAt: '2026-04-27T00:00:00.000Z',
  updatedAt: '2026-04-27T00:00:00.000Z',
}

describe('LinkedFlashcardPanel', () => {
  it('shows linked flashcard front and back content', () => {
    render(<LinkedFlashcardPanel open flashcard={flashcard} onClose={vi.fn()} />)

    expect(screen.getByTestId('linked-flashcard-panel')).toBeInTheDocument()
    expect(screen.getByTestId('linked-flashcard-front')).toHaveTextContent(
      'Principles are [___] truths'
    )
    expect(screen.getByTestId('linked-flashcard-back')).toHaveTextContent(
      'Principles are fundamental truths'
    )
  })

  it('shows an unavailable state when the linked flashcard is missing', () => {
    render(<LinkedFlashcardPanel open flashcard={null} onClose={vi.fn()} />)

    expect(screen.getByTestId('linked-flashcard-missing')).toHaveTextContent(
      'Linked flashcard not found'
    )
  })

  it('shows a loading state while resolving the linked flashcard', () => {
    render(<LinkedFlashcardPanel open flashcard={null} isLoading onClose={vi.fn()} />)

    expect(screen.getByTestId('linked-flashcard-loading')).toHaveTextContent(
      'Loading linked flashcard'
    )
    expect(screen.queryByTestId('linked-flashcard-missing')).not.toBeInTheDocument()
    expect(screen.queryByTestId('linked-flashcard-front')).not.toBeInTheDocument()
  })

  it('shows a retryable error state when lookup fails', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<LinkedFlashcardPanel open flashcard={null} isError onClose={vi.fn()} onRetry={onRetry} />)

    expect(screen.getByTestId('linked-flashcard-error')).toHaveTextContent(
      'Could not load linked flashcard'
    )

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('closes from the explicit close action', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<LinkedFlashcardPanel open flashcard={flashcard} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Close linked flashcard panel' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes from the back to reading action', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<LinkedFlashcardPanel open flashcard={flashcard} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Back to reading' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
