import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HighlightListPanel } from '../HighlightListPanel'
import { useHighlightStore } from '@/stores/useHighlightStore'
import type { BookHighlight } from '@/data/types'

const baseHighlight: BookHighlight = {
  id: 'highlight-1',
  bookId: 'book-1',
  cfiRange: 'epubcfi(/6/4)',
  textAnchor: 'Principles are fundamental truths',
  color: 'yellow',
  position: { type: 'cfi', value: 'epubcfi(/6/4)' },
  createdAt: '2026-04-27T00:00:00.000Z',
}

function seedHighlights(highlights: BookHighlight[]) {
  useHighlightStore.setState({
    highlights,
    colorFilter: 'all',
    getFilteredHighlights: () => useHighlightStore.getState().highlights,
  })
}

describe('HighlightListPanel flashcard action', () => {
  afterEach(() => {
    cleanup()
    useHighlightStore.setState({
      highlights: [],
      colorFilter: 'all',
      getFilteredHighlights: () => useHighlightStore.getState().highlights,
    })
    vi.restoreAllMocks()
  })

  it('views a linked flashcard instead of opening create flow', async () => {
    const user = userEvent.setup()
    const linkedHighlight = { ...baseHighlight, flashcardId: 'card-1' }
    const onClose = vi.fn()
    const onFlashcardRequest = vi.fn()
    const onLinkedFlashcardRequest = vi.fn()
    seedHighlights([linkedHighlight])

    render(
      <HighlightListPanel
        open
        onClose={onClose}
        rendition={null}
        onFlashcardRequest={onFlashcardRequest}
        onLinkedFlashcardRequest={onLinkedFlashcardRequest}
      />
    )

    await user.click(screen.getByTestId('highlight-card-flashcard-button'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onLinkedFlashcardRequest).toHaveBeenCalledWith(linkedHighlight)
    expect(onFlashcardRequest).not.toHaveBeenCalled()
  })

  it('keeps create flow for highlights without a linked flashcard', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onFlashcardRequest = vi.fn()
    const onLinkedFlashcardRequest = vi.fn()
    seedHighlights([baseHighlight])

    render(
      <HighlightListPanel
        open
        onClose={onClose}
        rendition={null}
        onFlashcardRequest={onFlashcardRequest}
        onLinkedFlashcardRequest={onLinkedFlashcardRequest}
      />
    )

    await user.click(screen.getByTestId('highlight-card-flashcard-button'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onFlashcardRequest).toHaveBeenCalledWith(baseHighlight.textAnchor, baseHighlight.id)
    expect(onLinkedFlashcardRequest).not.toHaveBeenCalled()
  })
})
