/**
 * Pure utility functions for resolving the user's position when switching
 * between EPUB and audiobook formats of the same book.
 *
 * Two modes:
 *  - Chapter-only (legacy callers): given the current chapter, return the start
 *    of the mapped chapter on the other side.
 *  - Intra-chapter (E103 — Link Formats Story B): given the user's progress
 *    *within* the current chapter, apply the same time-percentage proportion
 *    to the mapped chapter on the other side, so format switching lands within
 *    ±1–2 paragraphs of where the user was, not just at the chapter start.
 *
 * Time-percentage proportional math is the documented industry baseline for
 * non-aligned dual-format products (KOReader, Plato, ABS-side integrations).
 * It uses data already live in both renderers — no schema changes, no
 * per-chapter text extraction.
 *
 * No React hooks, no side effects — pure data transformation. Easy to unit-test.
 *
 * @module chapterSwitchResolver
 * @since E103
 */

import type { Book, ChapterMapping, ChapterMappingRecord } from '@/data/types'

/** Confidence threshold below which intra-chapter math is skipped (jump to chapter start instead). */
export const INTRA_CHAPTER_CONFIDENCE_FLOOR = 0.7

/** Default lead-in seconds when switching EPUB → Audio (re-hear one sentence). */
export const DEFAULT_AUDIO_LEAD_IN_SECONDS = 3

/** Minimal subset of epub.js Locations API we depend on. */
export interface EpubLocations {
  percentageFromCfi(cfi: string): number
  cfiFromPercentage(percentage: number): string
}

/** Compute audiobook chapter start time in seconds. */
function audioChapterStartSeconds(book: Book, chapterIndex: number): number | null {
  const ch = book.chapters[chapterIndex]
  if (!ch || ch.position.type !== 'time') return null
  return ch.position.seconds
}

/**
 * Compute audiobook chapter end time in seconds. Falls back through
 * chapters[idx+1].seconds → book.totalDuration → audioElementDuration → null.
 */
function audioChapterEndSeconds(
  book: Book,
  chapterIndex: number,
  audioElementDuration?: number
): number | null {
  const next = book.chapters[chapterIndex + 1]
  if (next && next.position.type === 'time') return next.position.seconds
  if (typeof book.totalDuration === 'number' && book.totalDuration > 0) return book.totalDuration
  if (typeof audioElementDuration === 'number' && audioElementDuration > 0)
    return audioElementDuration
  return null
}

/**
 * Locate the mapping entry for a given audio chapter index, returning both
 * the entry and whether confidence clears the intra-chapter floor.
 */
function findMappingByAudioIndex(
  mapping: ChapterMappingRecord,
  audioChapterIndex: number
): ChapterMapping | null {
  return mapping.mappings.find(m => m.audioChapterIndex === audioChapterIndex) ?? null
}

function findMappingByEpubHref(
  mapping: ChapterMappingRecord,
  epubChapterHref: string
): ChapterMapping | null {
  return mapping.mappings.find(m => m.epubChapterHref === epubChapterHref) ?? null
}

/** Clamp `n` into [min, max]. */
function clamp(n: number, min: number, max: number): number {
  if (n < min) return min
  if (n > max) return max
  return n
}

// ─── Audio → EPUB ────────────────────────────────────────────────────────────

export interface ResolveEpubFromAudioArgs {
  audioCurrentTime: number
  audioBook: Book
  audioChapterIndex: number
  epubBook: Book
  mapping: ChapterMappingRecord
  /** epub.js `book.locations`, required for intra-chapter percentage math. */
  epubLocations: EpubLocations | null
  /** Optional fallback for last-chapter end time. */
  audioElementDuration?: number
}

/**
 * Given the user's audio position, compute target EPUB CFI.
 *
 * Returns null when:
 *  - No mapping exists for the current audio chapter
 *  - Mapping confidence is below INTRA_CHAPTER_CONFIDENCE_FLOOR
 *  - epub.js locations are not yet generated
 *  - Audio chapter end is indeterminate (last chapter, no totalDuration, no element duration)
 *  - Mapped EPUB chapter is not present on the EPUB side
 *
 * Caller convention: a null return means "fall back to chapter-start jump."
 */
export function resolveEpubPositionFromAudio(
  args: ResolveEpubFromAudioArgs
): { targetCfi: string } | null {
  const {
    audioCurrentTime,
    audioBook,
    audioChapterIndex,
    epubBook,
    mapping,
    epubLocations,
    audioElementDuration,
  } = args

  if (!epubLocations) return null

  const entry = findMappingByAudioIndex(mapping, audioChapterIndex)
  if (!entry) return null
  if (entry.confidence < INTRA_CHAPTER_CONFIDENCE_FLOOR) return null

  const audioStart = audioChapterStartSeconds(audioBook, audioChapterIndex)
  const audioEnd = audioChapterEndSeconds(audioBook, audioChapterIndex, audioElementDuration)
  if (audioStart === null || audioEnd === null || audioEnd <= audioStart) return null

  const chapterPct = clamp((audioCurrentTime - audioStart) / (audioEnd - audioStart), 0, 1)

  // Map to EPUB chapter range
  const epubChapter = epubBook.chapters.find(ch => ch.id === entry.epubChapterHref)
  if (!epubChapter || epubChapter.position.type !== 'cfi') return null

  // Find the next EPUB chapter (by spine order) for end percentage
  const sorted = [...epubBook.chapters].sort((a, b) => a.order - b.order)
  const idxInSorted = sorted.findIndex(ch => ch.id === epubChapter.id)
  const nextEpubChapter = idxInSorted >= 0 ? sorted[idxInSorted + 1] : undefined

  let startPct: number
  let endPct: number
  try {
    startPct = epubLocations.percentageFromCfi(epubChapter.position.value)
    endPct =
      nextEpubChapter && nextEpubChapter.position.type === 'cfi'
        ? epubLocations.percentageFromCfi(nextEpubChapter.position.value)
        : 1
  } catch {
    return null
  }

  if (!Number.isFinite(startPct) || !Number.isFinite(endPct) || endPct <= startPct) return null

  const targetPct = clamp(startPct + chapterPct * (endPct - startPct), 0, 1)

  let targetCfi: string
  try {
    targetCfi = epubLocations.cfiFromPercentage(targetPct)
  } catch {
    return null
  }
  if (!targetCfi) return null

  return { targetCfi }
}

// ─── EPUB → Audio ────────────────────────────────────────────────────────────

export interface ResolveAudioFromEpubArgs {
  epubCurrentCfi: string
  epubBook: Book
  epubChapterHref: string
  audioBook: Book
  mapping: ChapterMappingRecord
  epubLocations: EpubLocations | null
  /** Lead-in subtracted from target seconds (clamped to chapter start). */
  leadInSeconds?: number
  /** Optional fallback for last-chapter end time. */
  audioElementDuration?: number
}

/**
 * Given the user's EPUB CFI, compute target audio seconds (with EPUB→Audio
 * lead-in bias so the listener re-hears one sentence rather than missing words).
 *
 * Returns null under the same conditions as the EPUB-target variant.
 */
export function resolveAudioPositionFromEpub(
  args: ResolveAudioFromEpubArgs
): { targetSeconds: number } | null {
  const {
    epubCurrentCfi,
    epubBook,
    epubChapterHref,
    audioBook,
    mapping,
    epubLocations,
    leadInSeconds = DEFAULT_AUDIO_LEAD_IN_SECONDS,
    audioElementDuration,
  } = args

  if (!epubLocations) return null

  const entry = findMappingByEpubHref(mapping, epubChapterHref)
  if (!entry) return null
  if (entry.confidence < INTRA_CHAPTER_CONFIDENCE_FLOOR) return null

  const epubChapter = epubBook.chapters.find(ch => ch.id === epubChapterHref)
  if (!epubChapter || epubChapter.position.type !== 'cfi') return null

  const sorted = [...epubBook.chapters].sort((a, b) => a.order - b.order)
  const idxInSorted = sorted.findIndex(ch => ch.id === epubChapter.id)
  const nextEpubChapter = idxInSorted >= 0 ? sorted[idxInSorted + 1] : undefined

  let chapterStartPct: number
  let chapterEndPct: number
  let currentPct: number
  try {
    chapterStartPct = epubLocations.percentageFromCfi(epubChapter.position.value)
    chapterEndPct =
      nextEpubChapter && nextEpubChapter.position.type === 'cfi'
        ? epubLocations.percentageFromCfi(nextEpubChapter.position.value)
        : 1
    currentPct = epubLocations.percentageFromCfi(epubCurrentCfi)
  } catch {
    return null
  }

  if (
    !Number.isFinite(chapterStartPct) ||
    !Number.isFinite(chapterEndPct) ||
    !Number.isFinite(currentPct) ||
    chapterEndPct <= chapterStartPct
  ) {
    return null
  }

  const chapterPct = clamp(
    (currentPct - chapterStartPct) / (chapterEndPct - chapterStartPct),
    0,
    1
  )

  const audioStart = audioChapterStartSeconds(audioBook, entry.audioChapterIndex)
  const audioEnd = audioChapterEndSeconds(audioBook, entry.audioChapterIndex, audioElementDuration)
  if (audioStart === null || audioEnd === null || audioEnd <= audioStart) return null

  const rawTarget = audioStart + chapterPct * (audioEnd - audioStart)
  const biased = rawTarget - leadInSeconds
  const targetSeconds = clamp(biased, audioStart, audioEnd)

  return { targetSeconds }
}
