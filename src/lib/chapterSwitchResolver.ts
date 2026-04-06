/**
 * Pure utility functions for resolving position when switching between
 * EPUB and audiobook formats of the same book.
 *
 * No React hooks, no side effects — just data transformation.
 *
 * @module chapterSwitchResolver
 * @since E103-S03
 */

import type { Book, ChapterMappingRecord, ContentPosition } from '@/data/types'

/**
 * Given the current EPUB position, find the corresponding audiobook position
 * using the chapter mapping.
 *
 * Strategy:
 * 1. Determine which EPUB chapter the user is currently in (from CFI or chapters list)
 * 2. Look up the matching audioChapterIndex in the mapping
 * 3. Return the start time of that audio chapter
 */
export function resolveAudioPositionFromEpub(
  epubBook: Book,
  audioBook: Book,
  mapping: ChapterMappingRecord
): ContentPosition | null {
  if (epubBook.format !== 'epub' || audioBook.format !== 'audiobook') return null
  if (!mapping.mappings.length) return null

  // Determine which EPUB chapter the user is in
  const currentChapterHref = findCurrentEpubChapterHref(epubBook)
  if (!currentChapterHref) {
    // Fallback: return first mapped audio chapter
    const first = mapping.mappings[0]
    return resolveAudioChapterPosition(audioBook, first.audioChapterIndex)
  }

  // Find the matching entry
  const match = mapping.mappings.find(m => m.epubChapterHref === currentChapterHref)
  if (!match) {
    // No match — try closest by order
    return null
  }

  return resolveAudioChapterPosition(audioBook, match.audioChapterIndex)
}

/**
 * Given the current audiobook position, find the corresponding EPUB position
 * using the chapter mapping.
 *
 * Strategy:
 * 1. Determine current audio chapter index from playback seconds
 * 2. Look up the matching epubChapterHref in the mapping
 * 3. Return the EPUB chapter's CFI position
 */
export function resolveEpubPositionFromAudio(
  audioBook: Book,
  epubBook: Book,
  mapping: ChapterMappingRecord
): ContentPosition | null {
  if (audioBook.format !== 'audiobook' || epubBook.format !== 'epub') return null
  if (!mapping.mappings.length) return null

  const currentAudioChapterIndex = findCurrentAudioChapterIndex(audioBook)
  if (currentAudioChapterIndex === null) {
    // Fallback: return first mapped EPUB chapter
    const first = mapping.mappings[0]
    return resolveEpubChapterPosition(epubBook, first.epubChapterHref)
  }

  const match = mapping.mappings.find(m => m.audioChapterIndex === currentAudioChapterIndex)
  if (!match) return null

  return resolveEpubChapterPosition(epubBook, match.epubChapterHref)
}

/**
 * Determine the current EPUB chapter href from the book's position and chapters.
 *
 * Uses chapter `order` (index) for reliable comparison. We find the chapter with
 * the highest order whose start CFI matches the current CFI prefix, falling back
 * to the chapter whose start CFI appears as a prefix of the current position CFI.
 *
 * CFI string comparison is NOT used — EPUBs do not guarantee lexicographic CFI order.
 */
function findCurrentEpubChapterHref(book: Book): string | null {
  if (!book.currentPosition || book.currentPosition.type !== 'cfi') return null
  if (!book.chapters.length) return null

  const currentCfi = book.currentPosition.value

  // Sort chapters by order ascending to process in spine order
  const sorted = [...book.chapters].sort((a, b) => a.order - b.order)

  // Find the last chapter (by order) whose start CFI appears in the current CFI prefix.
  // A chapter is "active" when the current CFI starts with or equals the chapter's CFI.
  let bestChapter = sorted[0]
  for (const ch of sorted) {
    if (ch.position.type === 'cfi' && currentCfi.startsWith(ch.position.value)) {
      bestChapter = ch
    }
  }

  // Fallback: if no chapter CFI is a prefix, pick the chapter with the highest order
  // that is still <= current chapter by exact CFI match
  if (bestChapter === sorted[0]) {
    for (const ch of sorted) {
      if (ch.position.type === 'cfi' && ch.position.value === currentCfi) {
        bestChapter = ch
        break
      }
    }
  }

  // The chapter ID is the href identifier
  return bestChapter.id
}

/**
 * Determine which audio chapter the user is currently listening to
 * based on playback position in seconds.
 */
function findCurrentAudioChapterIndex(book: Book): number | null {
  if (!book.currentPosition || book.currentPosition.type !== 'time') return null
  if (!book.chapters.length) return null

  const currentSeconds = book.currentPosition.seconds

  for (let i = book.chapters.length - 1; i >= 0; i--) {
    const ch = book.chapters[i]
    if (ch.position.type === 'time' && currentSeconds >= ch.position.seconds) {
      return i
    }
  }

  return null // No time-based chapter contains the current position
}

/**
 * Get the start position for a given audio chapter index.
 */
function resolveAudioChapterPosition(
  audioBook: Book,
  chapterIndex: number
): ContentPosition | null {
  if (chapterIndex < 0 || chapterIndex >= audioBook.chapters.length) return null
  const chapter = audioBook.chapters[chapterIndex]
  if (chapter.position.type === 'time') {
    return { type: 'time', seconds: chapter.position.seconds }
  }
  return null
}

/**
 * Get the start position for a given EPUB chapter href.
 */
function resolveEpubChapterPosition(epubBook: Book, chapterHref: string): ContentPosition | null {
  const chapter = epubBook.chapters.find(ch => ch.id === chapterHref)
  if (!chapter) return null
  if (chapter.position.type === 'cfi') {
    return { type: 'cfi', value: chapter.position.value }
  }
  return null
}
