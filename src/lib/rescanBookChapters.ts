/**
 * Re-scan chapters for an already-imported book.
 *
 * EPUB: extracts the TOC via epub.js and persists chapters[].
 * Audiobook (ABS): fetches per-item chapters via the AudiobookshelfService and persists chapters[].
 * Audiobook (local): not supported — chapters come from the file's metadata at import.
 *
 * Used both by the manual "Re-scan chapters" menu action and by LinkFormatsDialog's
 * lazy-on-pair fallback for ABS audiobooks whose list-endpoint payload omitted chapters.
 *
 * @module rescanBookChapters
 * @since E103 (Link Formats — Story A)
 */

import type { Book, BookChapter } from '@/data/types'
import { extractEpubChapters } from '@/lib/epubChapterExtractor'
import { fetchChapters } from '@/services/AudiobookshelfService'
import { bookContentService } from '@/services/BookContentService'
import { getAbsApiKey } from '@/lib/credentials/absApiKeyResolver'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

export type RescanResult =
  | { ok: true; chapters: BookChapter[] }
  | { ok: false; reason: 'no-toc' | 'no-chapters' | 'unsupported' | 'error'; message: string }

/** Re-extract EPUB TOC and return chapter records (does NOT persist). */
async function rescanEpubChapters(book: Book): Promise<RescanResult> {
  try {
    const buffer = await bookContentService.getEpubContent(book)
    const tocItems = await extractEpubChapters(buffer)
    if (tocItems.length === 0) {
      return { ok: false, reason: 'no-toc', message: 'EPUB has no table of contents.' }
    }
    const chapters: BookChapter[] = tocItems.map((item, index) => ({
      id: item.href,
      bookId: book.id,
      title: item.label,
      order: index,
      position: { type: 'cfi', value: item.href },
    }))
    return { ok: true, chapters }
  } catch (err) {
    console.error('[rescanBookChapters] EPUB extraction failed:', err)
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : 'Failed to read EPUB file.',
    }
  }
}

/** Re-fetch chapters for an Audiobookshelf item. Returns records (does NOT persist). */
async function rescanAbsChapters(book: Book): Promise<RescanResult> {
  if (!book.absServerId || !book.absItemId || book.source.type !== 'remote') {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Chapter re-scan is only available for Audiobookshelf-synced audiobooks.',
    }
  }
  try {
    const apiKey = await getAbsApiKey(book.absServerId)
    if (!apiKey) {
      return {
        ok: false,
        reason: 'error',
        message: 'Audiobookshelf API key missing. Re-enter it in Settings.',
      }
    }
    const result = await fetchChapters(book.source.url, apiKey, book.absItemId)
    if (!result.ok) {
      return { ok: false, reason: 'error', message: result.error }
    }
    const absChapters = result.data.chapters
    if (absChapters.length === 0) {
      return {
        ok: false,
        reason: 'no-chapters',
        message: 'Audiobookshelf reports no chapter markers for this item.',
      }
    }
    const chapters: BookChapter[] = absChapters.map((ch, index) => ({
      id: ch.id,
      bookId: book.id,
      title: ch.title,
      order: index,
      position: { type: 'time' as const, seconds: ch.start },
    }))
    return { ok: true, chapters }
  } catch (err) {
    console.error('[rescanBookChapters] ABS fetch failed:', err)
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : 'Failed to fetch chapters.',
    }
  }
}

/** Persist new chapters to Dexie + Zustand. Use after a successful rescan. */
export async function persistBookChapters(book: Book, chapters: BookChapter[]): Promise<void> {
  const merged = { ...book, chapters, updatedAt: new Date().toISOString() }
  await syncableWrite('books', 'put', merged as unknown as SyncableRecord)
  // Refresh in-memory store: easiest way without coupling to the store internals
  // is to reload from Dexie on the next access; callers using useBookStore.getState().books
  // will see the change after the syncableWrite trigger refreshes via the live query, or
  // we can hint by patching the books array directly.
  const { useBookStore } = await import('@/stores/useBookStore')
  useBookStore.setState(state => ({
    books: state.books.map(b => (b.id === book.id ? merged : b)),
  }))
}

/**
 * Re-scan a book's chapters from its source (EPUB TOC or ABS API) and persist.
 * Returns the updated chapters on success, or a structured failure.
 */
export async function rescanBookChapters(book: Book): Promise<RescanResult> {
  const result =
    book.format === 'epub'
      ? await rescanEpubChapters(book)
      : book.format === 'audiobook'
        ? await rescanAbsChapters(book)
        : { ok: false as const, reason: 'unsupported' as const, message: 'Unsupported format.' }

  if (result.ok) {
    try {
      await persistBookChapters(book, result.chapters)
    } catch (err) {
      console.error('[rescanBookChapters] persist failed:', err)
      return {
        ok: false,
        reason: 'error',
        message: err instanceof Error ? err.message : 'Failed to save chapters.',
      }
    }
  }
  return result
}
