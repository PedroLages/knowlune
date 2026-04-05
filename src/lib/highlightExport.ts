/**
 * Book highlight export utilities for PKM workflows.
 *
 * Provides two export formats:
 *   - Obsidian Markdown: one .md file per book, highlights grouped by chapter
 *   - Readwise CSV: single flat CSV with all highlights across all books
 *
 * Both formats are compatible with popular PKM tools.
 *
 * @module highlightExport
 */
import { db } from '@/db/schema'
import type { Book, BookHighlight } from '@/data/types'
import type { ExportProgressCallback } from './exportService'

/** Result of a book highlight export */
export interface HighlightExportResult {
  /** Files generated (Obsidian format: one per book; Readwise: single CSV) */
  files: Array<{ name: string; content: string }>
  /** Total highlight count across all books */
  highlightCount: number
  /** Number of unique books with at least one highlight */
  bookCount: number
}

// ---------------------------------------------------------------------------
// Obsidian Markdown export
// ---------------------------------------------------------------------------

/**
 * Exports book highlights as Obsidian-compatible Markdown files.
 * One file per book, highlights grouped by chapter.
 *
 * @param onProgress - Optional progress callback (0-100)
 * @returns Array of { name, content } files with `book-highlights/` prefix
 */
export async function exportHighlightsAsObsidian(
  onProgress?: ExportProgressCallback
): Promise<HighlightExportResult> {
  onProgress?.(0, 'Loading book highlights...')

  const allHighlights = await db.bookHighlights.toArray()
  if (allHighlights.length === 0) {
    onProgress?.(100, 'Complete')
    return { files: [], highlightCount: 0, bookCount: 0 }
  }

  // Group highlights by bookId
  const byBook = new Map<string, BookHighlight[]>()
  for (const h of allHighlights) {
    const existing = byBook.get(h.bookId) ?? []
    existing.push(h)
    byBook.set(h.bookId, existing)
  }

  onProgress?.(20, 'Loading book metadata...')

  // Fetch books for all referenced bookIds
  const bookIds = Array.from(byBook.keys())
  const books = await db.books.where('id').anyOf(bookIds).toArray()
  const bookMap = new Map<string, Book>(books.map(b => [b.id, b]))

  const files: Array<{ name: string; content: string }> = []
  const bookCount = byBook.size
  let processed = 0

  for (const [bookId, highlights] of byBook) {
    const book = bookMap.get(bookId)
    const title = book?.title ?? 'Unknown Book'
    const author = book?.author ?? ''

    // Group within this book by chapterHref (undefined → 'Unknown Chapter')
    const byChapter = new Map<string, BookHighlight[]>()
    for (const h of highlights) {
      const chapter = h.chapterHref ?? '__unknown__'
      const existing = byChapter.get(chapter) ?? []
      existing.push(h)
      byChapter.set(chapter, existing)
    }

    const lines: string[] = [`# ${title}`]
    if (author) lines.push(`Author: ${author}`)
    lines.push('')

    for (const [chapterHref, chapterHighlights] of byChapter) {
      // Derive a readable chapter label from the href
      const chapterLabel =
        chapterHref === '__unknown__'
          ? 'Highlights'
          : (chapterHref.split('#')[0].split('/').pop() ?? chapterHref)

      lines.push(`## ${chapterLabel}`, '')

      for (const h of chapterHighlights) {
        const date = h.createdAt.slice(0, 10)
        lines.push(`> "${h.textAnchor}"`, '')
        if (h.note) {
          lines.push(`Note: ${h.note}`, '')
        }
        lines.push(`Color: ${h.color} | ${date}`, '')
      }
    }

    // Sanitize title for safe filename
    const safeName = title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60)
    files.push({
      name: `book-highlights/${safeName}.md`,
      content: lines.join('\n'),
    })

    processed++
    onProgress?.(20 + Math.round((processed / bookCount) * 70), `Exporting "${title}"...`)
  }

  onProgress?.(100, 'Complete')
  return { files, highlightCount: allHighlights.length, bookCount }
}

// ---------------------------------------------------------------------------
// Readwise CSV export
// ---------------------------------------------------------------------------

/**
 * Escapes a CSV field: wraps in double-quotes and escapes inner double-quotes.
 */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Exports book highlights as a Readwise-compatible CSV file.
 * Single file: `book-highlights/readwise-export.csv`
 *
 * Columns: Title, Author, Highlight, Note, Location, Color, Date
 *
 * @param onProgress - Optional progress callback (0-100)
 * @returns Single-element file array (or empty if no highlights)
 */
export async function exportHighlightsAsReadwiseCsv(
  onProgress?: ExportProgressCallback
): Promise<HighlightExportResult> {
  onProgress?.(0, 'Loading book highlights...')

  const allHighlights = await db.bookHighlights.toArray()
  if (allHighlights.length === 0) {
    onProgress?.(100, 'Complete')
    return { files: [], highlightCount: 0, bookCount: 0 }
  }

  onProgress?.(30, 'Loading book metadata...')

  const bookIds = [...new Set(allHighlights.map(h => h.bookId))]
  const books = await db.books.where('id').anyOf(bookIds).toArray()
  const bookMap = new Map<string, Book>(books.map(b => [b.id, b]))

  onProgress?.(60, 'Building CSV...')

  const header = 'Title,Author,Highlight,Note,Location,Color,Date'
  const rows: string[] = [header]

  const uniqueBooks = new Set<string>()

  for (const h of allHighlights) {
    const book = bookMap.get(h.bookId)
    const title = book?.title ?? 'Unknown Book'
    const author = book?.author ?? ''
    const location =
      h.chapterHref
        ? (h.chapterHref.split('#')[0].split('/').pop() ?? h.chapterHref)
        : (h.cfiRange ?? '')
    const date = h.createdAt.slice(0, 10)

    rows.push(
      [
        csvField(title),
        csvField(author),
        csvField(h.textAnchor),
        csvField(h.note ?? ''),
        csvField(location),
        csvField(h.color),
        csvField(date),
      ].join(',')
    )
    uniqueBooks.add(h.bookId)
  }

  onProgress?.(100, 'Complete')
  return {
    files: [{ name: 'book-highlights/readwise-export.csv', content: rows.join('\n') }],
    highlightCount: allHighlights.length,
    bookCount: uniqueBooks.size,
  }
}
