/**
 * Lookup helper for reader-linked flashcards.
 *
 * @module linkedFlashcardLookup
 */
import type { BookHighlight, Flashcard } from '@/data/types'

export async function loadLinkedFlashcard(
  highlight: BookHighlight,
  getFlashcard: (flashcardId: string) => Promise<Flashcard | undefined>
): Promise<Flashcard | null> {
  if (!highlight.flashcardId) return null
  return (await getFlashcard(highlight.flashcardId)) ?? null
}
