/**
 * useFormatSwitch — enables seamless switching between EPUB and audiobook formats.
 *
 * Queries Dexie for chapter mappings linking the current book to a paired format,
 * exposes whether a mapping exists, the linked book, and a function to perform
 * the switch (saving position first, then navigating with ?startChapter).
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

interface UseFormatSwitchReturn {
  /** Whether a chapter mapping exists for this book */
  hasMapping: boolean
  /** The linked book in the other format, or null */
  linkedBook: Book | null
  /**
   * Switch to the other format at the matching chapter.
   * @param currentChapterIndex — 0-based chapter index in the current format
   * @param savePosition — optional callback to persist current position before navigating
   */
  switchToFormat: (currentChapterIndex: number, savePosition?: () => void) => void
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
    (currentChapterIndex: number, savePosition?: () => void) => {
      if (!mapping || !linkedBook || switchingRef.current) return
      switchingRef.current = true

      // Save current position before navigating
      savePosition?.()

      // Resolve target chapter index from the mapping
      let targetIndex = 0
      const isCurrentEpub = format === 'epub'

      if (isCurrentEpub) {
        // Current = EPUB, switching to audiobook. Find audio chapter for this EPUB chapter.
        // We need the EPUB href at currentChapterIndex — but we receive the index.
        // The mapping stores epubChapterHref → audioChapterIndex pairs.
        // Find the mapping entry closest to the given index (by position in mappings array).
        const entry = mapping.mappings[currentChapterIndex]
        targetIndex = entry?.audioChapterIndex ?? 0
      } else {
        // Current = audiobook, switching to EPUB. Find EPUB chapter for this audio chapter.
        const entry = mapping.mappings.find(m => m.audioChapterIndex === currentChapterIndex)
        // If no exact match, find the closest lower audioChapterIndex
        if (entry) {
          targetIndex = mapping.mappings.indexOf(entry)
        } else {
          // Fallback: find closest mapping with audioChapterIndex <= currentChapterIndex
          let closest = mapping.mappings[0]
          let closestIdx = 0
          for (let i = 0; i < mapping.mappings.length; i++) {
            if (mapping.mappings[i].audioChapterIndex <= currentChapterIndex) {
              closest = mapping.mappings[i]
              closestIdx = i
            }
          }
          targetIndex = closest ? closestIdx : 0
        }
      }

      // Clamp to valid range
      targetIndex = Math.max(0, targetIndex)

      navigate(`/library/${linkedBook.id}/read?startChapter=${targetIndex}`, { replace: false })
      // switchingRef.current is NOT reset here — the component unmounts on navigation,
      // so the guard is automatically cleared. No setTimeout needed.
    },
    [mapping, linkedBook, format, navigate]
  )

  return { hasMapping, linkedBook, switchToFormat }
}
