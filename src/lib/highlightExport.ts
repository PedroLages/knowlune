/**
 * Book highlight export utilities for PKM workflows.
 *
 * Provides four export formats:
 *   - Plain Text: simple readable text, one file per book
 *   - Obsidian Markdown: one .md file per book, highlights grouped by chapter
 *   - Readwise CSV: single flat CSV with all highlights across all books
 *   - JSON: structured JSON with full highlight data
 *
 * All formats support per-book or all-books export scope.
 *
 * @module highlightExport
 * @since E86 (Obsidian/CSV), E109-S03 (plain text, JSON, per-book scoping)
 */
import { db } from '@/db/schema'
import type { Book, BookHighlight } from '@/data/types'
import type { ExportProgressCallback } from './exportService'

/** Supported highlight export formats */
export type HighlightExportFormat = 'text' | 'markdown' | 'csv' | 'json'

/** Options for scoping a highlight export */
export interface HighlightExportOptions {
  /** Restrict export to a single book; omit for all books */
  bookId?: string
  /** Optional progress callback (0-100) */
  onProgress?: ExportProgressCallback
}

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
// Shared helpers
// ---------------------------------------------------------------------------

/** Load highlights (optionally scoped to a single book) */
async function loadHighlights(bookId?: string): Promise<BookHighlight[]> {
  if (bookId) {
    return db.bookHighlights.where('bookId').equals(bookId).toArray()
  }
  return db.bookHighlights.toArray()
}

/** Load book metadata for a set of bookIds */
async function loadBookMap(bookIds: string[]): Promise<Map<string, Book>> {
  const books = await db.books.where('id').anyOf(bookIds).toArray()
  return new Map(books.map(b => [b.id, b]))
}

/** Group highlights by bookId */
function groupByBook(highlights: BookHighlight[]): Map<string, BookHighlight[]> {
  const byBook = new Map<string, BookHighlight[]>()
  for (const h of highlights) {
    const existing = byBook.get(h.bookId) ?? []
    existing.push(h)
    byBook.set(h.bookId, existing)
  }
  return byBook
}

/** Sanitize a book title for use as a filename */
function safeFilename(title: string): string {
  return title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Export highlights in the specified format.
 *
 * @param format - Export format: 'text' | 'markdown' | 'csv' | 'json'
 * @param options - Optional bookId scope and progress callback
 */
export async function exportHighlights(
  format: HighlightExportFormat,
  options: HighlightExportOptions = {}
): Promise<HighlightExportResult> {
  switch (format) {
    case 'text':
      return exportHighlightsAsPlainText(options)
    case 'markdown':
      return exportHighlightsAsObsidian(options.onProgress, options.bookId)
    case 'csv':
      return exportHighlightsAsReadwiseCsv(options.onProgress, options.bookId)
    case 'json':
      return exportHighlightsAsJson(options)
  }
}

// ---------------------------------------------------------------------------
// Obsidian Markdown export
// ---------------------------------------------------------------------------

/**
 * Exports book highlights as Obsidian-compatible Markdown files.
 * One file per book, highlights grouped by chapter.
 *
 * @param onProgress - Optional progress callback (0-100)
 * @param bookId - Optional book scope (omit for all books)
 * @returns Array of { name, content } files with `book-highlights/` prefix
 */
export async function exportHighlightsAsObsidian(
  onProgress?: ExportProgressCallback,
  bookId?: string
): Promise<HighlightExportResult> {
  onProgress?.(0, 'Loading book highlights...')

  const allHighlights = await loadHighlights(bookId)
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
    const safeName = title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60)
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
  onProgress?: ExportProgressCallback,
  bookId?: string
): Promise<HighlightExportResult> {
  onProgress?.(0, 'Loading book highlights...')

  const allHighlights = await loadHighlights(bookId)
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
    const location = h.chapterHref
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

// ---------------------------------------------------------------------------
// Plain Text export (E109-S03)
// ---------------------------------------------------------------------------

/**
 * Exports highlights as readable plain text, one file per book.
 */
async function exportHighlightsAsPlainText(
  options: HighlightExportOptions = {}
): Promise<HighlightExportResult> {
  options.onProgress?.(0, 'Loading highlights...')

  const allHighlights = await loadHighlights(options.bookId)
  if (allHighlights.length === 0) {
    options.onProgress?.(100, 'Complete')
    return { files: [], highlightCount: 0, bookCount: 0 }
  }

  options.onProgress?.(20, 'Loading book metadata...')
  const byBook = groupByBook(allHighlights)
  const bookMap = await loadBookMap(Array.from(byBook.keys()))

  const files: Array<{ name: string; content: string }> = []
  let processed = 0

  for (const [bookId, highlights] of byBook) {
    const book = bookMap.get(bookId)
    const title = book?.title ?? 'Unknown Book'
    const author = book?.author ?? ''

    const lines: string[] = [title]
    if (author) lines.push(`by ${author}`)
    lines.push(`${highlights.length} highlight${highlights.length !== 1 ? 's' : ''}`, '')

    for (const h of highlights) {
      const date = h.createdAt.slice(0, 10)
      lines.push(`"${h.textAnchor}"`)
      if (h.note) lines.push(`  Note: ${h.note}`)
      lines.push(`  [${h.color}] ${date}`, '')
    }

    files.push({
      name: `${safeFilename(title)}-highlights.txt`,
      content: lines.join('\n'),
    })

    processed++
    options.onProgress?.(20 + Math.round((processed / byBook.size) * 70), `Exporting "${title}"...`)
  }

  options.onProgress?.(100, 'Complete')
  return { files, highlightCount: allHighlights.length, bookCount: byBook.size }
}

// ---------------------------------------------------------------------------
// JSON export (E109-S03)
// ---------------------------------------------------------------------------

/**
 * Exports highlights as structured JSON with book metadata.
 */
async function exportHighlightsAsJson(
  options: HighlightExportOptions = {}
): Promise<HighlightExportResult> {
  options.onProgress?.(0, 'Loading highlights...')

  const allHighlights = await loadHighlights(options.bookId)
  if (allHighlights.length === 0) {
    options.onProgress?.(100, 'Complete')
    return { files: [], highlightCount: 0, bookCount: 0 }
  }

  options.onProgress?.(40, 'Loading book metadata...')
  const byBook = groupByBook(allHighlights)
  const bookMap = await loadBookMap(Array.from(byBook.keys()))

  options.onProgress?.(70, 'Building JSON...')

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalHighlights: allHighlights.length,
    books: Array.from(byBook.entries()).map(([bookId, highlights]) => {
      const book = bookMap.get(bookId)
      return {
        bookId,
        title: book?.title ?? 'Unknown Book',
        author: book?.author ?? '',
        highlights: highlights.map(h => ({
          id: h.id,
          text: h.textAnchor,
          note: h.note ?? null,
          color: h.color,
          chapter: h.chapterHref ?? null,
          createdAt: h.createdAt,
        })),
      }
    }),
  }

  const content = JSON.stringify(exportData, null, 2)

  options.onProgress?.(100, 'Complete')
  return {
    files: [{ name: 'highlights-export.json', content }],
    highlightCount: allHighlights.length,
    bookCount: byBook.size,
  }
}
