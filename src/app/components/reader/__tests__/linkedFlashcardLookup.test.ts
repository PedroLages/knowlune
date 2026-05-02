import { describe, expect, it, vi } from 'vitest'
import { loadLinkedFlashcard } from '../linkedFlashcardLookup'
import type { BookHighlight, Flashcard } from '@/data/types'

const highlight: BookHighlight = {
  id: 'highlight-1',
  bookId: 'book-1',
  textAnchor: 'Principles are fundamental truths',
  color: 'yellow',
  flashcardId: 'card-1',
  position: { type: 'cfi', value: 'epubcfi(/6/4)' },
  createdAt: '2026-04-27T00:00:00.000Z',
}

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
  reps: 0,
  lapses: 0,
  state: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  due: '2026-04-27T00:00:00.000Z',
  createdAt: '2026-04-27T00:00:00.000Z',
  updatedAt: '2026-04-27T00:00:00.000Z',
}

describe('loadLinkedFlashcard', () => {
  it('loads a linked flashcard by highlight.flashcardId', async () => {
    const getFlashcard = vi.fn().mockResolvedValue(flashcard)

    await expect(loadLinkedFlashcard(highlight, getFlashcard)).resolves.toEqual(flashcard)
    expect(getFlashcard).toHaveBeenCalledWith('card-1')
  })

  it('returns null when the linked flashcard is missing', async () => {
    const getFlashcard = vi.fn().mockResolvedValue(undefined)

    await expect(loadLinkedFlashcard(highlight, getFlashcard)).resolves.toBeNull()
  })

  it('returns null without lookup when the highlight has no flashcardId', async () => {
    const getFlashcard = vi.fn().mockResolvedValue(flashcard)

    await expect(loadLinkedFlashcard({ ...highlight, flashcardId: undefined }, getFlashcard)).resolves.toBeNull()
    expect(getFlashcard).not.toHaveBeenCalled()
  })
})
