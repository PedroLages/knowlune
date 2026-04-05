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
 * Validate ISBN-10 check digit (modulo 11).
 */
function isValidIsbn10(isbn: string): boolean {
  if (isbn.length !== 10) return false
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(isbn[i], 10)
    if (isNaN(digit)) return false
    sum += digit * (10 - i)
  }
  const last = isbn[9].toUpperCase()
  sum += last === 'X' ? 10 : parseInt(last, 10)
  return sum % 11 === 0
}

/**
 * Validate ISBN-13 check digit (modulo 10).
 */
function isValidIsbn13(isbn: string): boolean {
  if (isbn.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(isbn[i], 10)
    if (isNaN(digit)) return false
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return sum % 10 === 0
}

/**
 * Extract ISBN-10 or ISBN-13 from an identifier string.
 * Returns undefined if no valid ISBN pattern is found.
 * Validates check digits to reduce false positives.
 */
function extractIsbn(identifier: string): string | undefined {
  if (!identifier) return undefined

  // ISBN-13 pattern
  const isbn13 = identifier.match(/(?:978|979)\d{10}/)
  if (isbn13 && isValidIsbn13(isbn13[0])) return isbn13[0]

  // ISBN-10 pattern (anchored with word boundary to reduce false positives)
  const isbn10 = identifier.match(/\b\d{9}[\dXx]\b/)
  if (isbn10 && isValidIsbn10(isbn10[0])) return isbn10[0]

  // Check if the identifier itself looks like an ISBN (stripping hyphens)
  const cleaned = identifier.replace(/[-\s]/g, '')
  if (/^(?:978|979)\d{10}$/.test(cleaned) && isValidIsbn13(cleaned))
    return cleaned
  if (/^\d{9}[\dXx]$/.test(cleaned) && isValidIsbn10(cleaned)) return cleaned

  return undefined
}
