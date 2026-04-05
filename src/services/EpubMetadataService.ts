/**
 * EPUB metadata extraction service.
 *
 * Parses EPUB files using epub.js to extract title, author, ISBN,
 * and embedded cover images.
 *
 * @module EpubMetadataService
 * @since E83-S02
 */

import ePub from 'epubjs'

export interface EpubMetadata {
  title: string
  author: string
  isbn?: string
  coverBlob?: Blob
}

/**
 * Extract metadata from an EPUB file.
 * Falls back to filename-derived title and "Unknown Author" when metadata is missing.
 */
export async function extractEpubMetadata(file: File): Promise<EpubMetadata> {
  const arrayBuffer = await file.arrayBuffer()
  const book = ePub(arrayBuffer)
  await book.ready

  const metadata = book.packaging.metadata

  const title = metadata.title?.trim() || file.name.replace(/\.epub$/i, '')
  const author = metadata.creator?.trim() || 'Unknown Author'

  // Try to extract ISBN from identifier
  const identifier = metadata.identifier || ''
  const isbn = extractIsbn(identifier)

  // Try to extract embedded cover image
  let coverBlob: Blob | undefined
  try {
    const coverUrl = await book.coverUrl()
    if (coverUrl) {
      const response = await fetch(coverUrl)
      if (response.ok) {
        coverBlob = await response.blob()
      }
    }
  } catch {
    // silent-catch-ok: cover extraction is best-effort
  }

  // Clean up epub.js resources
  book.destroy()

  return { title, author, isbn, coverBlob }
}

/**
 * Extract ISBN-10 or ISBN-13 from an identifier string.
 * Returns undefined if no valid ISBN pattern is found.
 */
function extractIsbn(identifier: string): string | undefined {
  if (!identifier) return undefined

  // ISBN-13 pattern
  const isbn13 = identifier.match(/(?:978|979)\d{10}/)
  if (isbn13) return isbn13[0]

  // ISBN-10 pattern
  const isbn10 = identifier.match(/\d{9}[\dXx]/)
  if (isbn10) return isbn10[0]

  // Check if the identifier itself looks like an ISBN (stripping hyphens)
  const cleaned = identifier.replace(/[-\s]/g, '')
  if (/^(?:978|979)\d{10}$/.test(cleaned)) return cleaned
  if (/^\d{9}[\dXx]$/.test(cleaned)) return cleaned

  return undefined
}
