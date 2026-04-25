/**
 * useFormatSwitch — enables seamless switching between EPUB and audiobook formats.
 *
 * Queries Dexie for chapter mappings linking the current book to a paired format,
 * exposes whether a mapping exists, the linked book, and a function to perform
 * the switch (saving position first, then navigating with chapter + intra-chapter
 * URL params: `?startChapter`, `?offsetCfi` (EPUB target), or `?seekSeconds`
 * (audio target)).
 *
 * Intra-chapter math (E103 — Story B): when the caller passes a current position
 * plus an EpubLocations instance, the hook computes a proportional target inside
 * the mapped chapter so the switch lands within ±1–2 paragraphs of where the
 * user was. Falls back gracefully to chapter-start jump when math returns null
 * (no mapping, low confidence, indeterminate end, etc.).
 *
 * @module useFormatSwitch
 * @since E103-S02
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { useBookStore } from '@/stores/useBookStore'
import type { Book, BookFormat, ChapterMappingRecord } from '@/data/types'
import {
  resolveAudioPositionFromEpub,
  INTRA_CHAPTER_CONFIDENCE_FLOOR,
  type EpubLocations,
} from '@/lib/chapterSwitchResolver'

/** Optional intra-chapter context from the calling renderer. */
export interface SwitchContext {
  /** Audio current playback time in seconds (audio side only). */
  audioCurrentTime?: number
  /** Live EPUB CFI from the rendition (epub side only). */
  epubCurrentCfi?: string
  /** EPUB chapter href the user is currently reading (epub side only). */
  epubChapterHref?: string
  /** epub.js `book.locations` — required for intra-chapter math on either direction. */
  epubLocations?: EpubLocations | null
  /** Fallback for last-chapter end derivation. */
  audioElementDuration?: number
}

interface UseFormatSwitchReturn {
  /** Whether a chapter mapping exists for this book */
  hasMapping: boolean
  /** The linked book in the other format, or null */
  linkedBook: Book | null
  /**
   * Switch to the other format at the matching chapter.
   * @param currentChapterIndex — 0-based chapter index in the current format
   * @param savePosition — optional callback to persist current position before navigating
   * @param context — optional intra-chapter context (Story B); when omitted, falls back to chapter-start jump
   */
  switchToFormat: (
    currentChapterIndex: number,
    savePosition?: () => void,
    context?: SwitchContext
  ) => void
}

/**
 * Resolve the chapter-only target index from the legacy mapping shape.
 *
 * Invariant: `mapping.mappings` is an array whose positional index (0, 1, 2…)
 * corresponds to the EPUB chapter index (epubChapterIndex). Each entry carries
 * `audioChapterIndex` for the paired audio side. When the current format is EPUB,
 * we index directly by `currentChapterIndex`. When the current format is audio,
 * we search by `audioChapterIndex` and return the position of the match.
 *
 * If a future schema adds an explicit `epubChapterIndex` field to ChapterMapping,
 * prefer field-based lookup (`m.epubChapterIndex === currentChapterIndex`) over
 * array-position lookup to avoid off-by-one errors from sparse or reordered arrays.
 */
function resolveTargetChapterIndex(
  mapping: ChapterMappingRecord,
  isCurrentEpub: boolean,
  currentChapterIndex: number
): number {
  if (isCurrentEpub) {
    // Mapping array is keyed by the EPUB side; use position in array as the EPUB index proxy.
    const entry = mapping.mappings[currentChapterIndex]
    return Math.max(0, entry?.audioChapterIndex ?? 0)
  }
  // Audio side: find the mapping whose audioChapterIndex matches.
  const entry = mapping.mappings.find(m => m.audioChapterIndex === currentChapterIndex)
  if (entry) return Math.max(0, mapping.mappings.indexOf(entry))
  // Fallback: closest mapping with audioChapterIndex <= currentChapterIndex
  let closest = mapping.mappings[0]
  let closestIdx = 0
  for (let i = 0; i < mapping.mappings.length; i++) {
    if (mapping.mappings[i].audioChapterIndex <= currentChapterIndex) {
      closest = mapping.mappings[i]
      closestIdx = i
    }
  }
  return closest ? Math.max(0, closestIdx) : 0
}

export function useFormatSwitch(
  bookId: string | undefined,
  format: BookFormat | undefined
): UseFormatSwitchReturn {
  const navigate = useNavigate()
  const books = useBookStore(s => s.books)
  const [linkedBook, setLinkedBook] = useState<Book | null>(null)
  const switchingRef = useRef(false)

  // Live query: find a mapping where this book is either the EPUB or audiobook side
  const mapping = useLiveQuery(async (): Promise<ChapterMappingRecord | undefined> => {
    if (!bookId) return undefined
    // Try as EPUB first
    const asEpub = await db.chapterMappings.where('epubBookId').equals(bookId).first()
    if (asEpub) return asEpub
    // Try as audiobook
    return db.chapterMappings.where('audioBookId').equals(bookId).first()
  }, [bookId])

  const hasMapping = !!mapping

  // Resolve linked book from store
  useEffect(() => {
    if (!mapping || !bookId) {
      setLinkedBook(null)
      return
    }
    const linkedId = mapping.epubBookId === bookId ? mapping.audioBookId : mapping.epubBookId
    const found = books.find(b => b.id === linkedId) ?? null
    setLinkedBook(found)
  }, [mapping, bookId, books])

  const switchToFormat = useCallback(
    (currentChapterIndex: number, savePosition?: () => void, context?: SwitchContext) => {
      if (!mapping || !linkedBook || switchingRef.current) return
      switchingRef.current = true

      // Save current position before navigating
      savePosition?.()

      const isCurrentEpub = format === 'epub'
      const targetChapterIndex = resolveTargetChapterIndex(
        mapping,
        isCurrentEpub,
        currentChapterIndex
      )

      // Build URL params: chapter index is always set; intra-chapter offset is best-effort.
      const params = new URLSearchParams()
      params.set('startChapter', String(targetChapterIndex))

      // Intra-chapter math (Story B). The source side always has enough data to
      // compute either:
      //  - EPUB → Audio: a precise `seekSeconds` (we have the audio Book chapters
      //    via linkedBook, and the source EPUB has its own locations).
      //  - Audio → EPUB: a chapter percentage `chapterPct` (we cannot compute the
      //    target CFI here because we lack the receiving EPUB's locations — the
      //    receiver applies the percentage to its own chapter range once locations
      //    are generated).
      // Either path degrades to chapter-start jump if math returns null or low confidence.
      const currentBook = books.find(b => b.id === bookId)
      if (context && currentBook) {
        if (isCurrentEpub) {
          // EPUB → Audio
          if (context.epubCurrentCfi && context.epubChapterHref && context.epubLocations) {
            const result = resolveAudioPositionFromEpub({
              epubCurrentCfi: context.epubCurrentCfi,
              epubBook: currentBook,
              epubChapterHref: context.epubChapterHref,
              audioBook: linkedBook,
              mapping,
              epubLocations: context.epubLocations,
              audioElementDuration: context.audioElementDuration,
            })
            if (result)
              params.set('seekSeconds', String(Math.round(result.targetSeconds * 1000) / 1000))
          }
        } else {
          // Audio → EPUB
          if (typeof context.audioCurrentTime === 'number') {
            // Confidence floor + mapping presence guard: skip intra-chapter math when low.
            const entry = mapping.mappings.find(
              m => m.audioChapterIndex === currentChapterIndex
            )
            if (entry && entry.confidence >= INTRA_CHAPTER_CONFIDENCE_FLOOR) {
              const ch = currentBook.chapters[currentChapterIndex]
              const next = currentBook.chapters[currentChapterIndex + 1]
              const start = ch && ch.position.type === 'time' ? ch.position.seconds : null
              const end =
                next && next.position.type === 'time'
                  ? next.position.seconds
                  : (currentBook.totalDuration ?? context.audioElementDuration ?? null)
              if (start !== null && end !== null && end > start) {
                const pct = Math.max(
                  0,
                  Math.min(1, (context.audioCurrentTime - start) / (end - start))
                )
                params.set('chapterPct', pct.toFixed(4))
              }
            }
          }
        }
      }

      navigate(`/library/${linkedBook.id}/read?${params.toString()}`, { replace: false })
      // switchingRef.current is NOT reset here — the component unmounts on navigation,
      // so the guard is automatically cleared. No setTimeout needed.
    },
    [mapping, linkedBook, format, navigate, books, bookId]
  )

  return { hasMapping, linkedBook, switchToFormat }
}
