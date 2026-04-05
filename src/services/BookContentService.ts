/**
 * BookContentService — reads EPUB file content for a given Book.
 *
 * Abstracts the file source (OPFS, IndexedDB fallback, or remote URL).
 * Returns an ArrayBuffer suitable for passing to epub.js.
 *
 * @module BookContentService
 */
import type { Book } from '@/data/types'
import { opfsStorageService } from './OpfsStorageService'

class BookContentService {
  /**
   * Get the EPUB content for a book as an ArrayBuffer.
   *
   * Source priority:
   * 1. OPFS local path (most common after import)
   * 2. IndexedDB fallback (via opfsStorageService)
   * 3. Remote URL (future OPDS support)
   *
   * @throws Error if book format is not EPUB or content cannot be read
   */
  async getEpubContent(book: Book): Promise<ArrayBuffer> {
    if (book.format !== 'epub') {
      throw new Error(
        `BookContentService: book "${book.id}" is not an EPUB (format: ${book.format})`
      )
    }

    const source = book.source

    if (source.type === 'remote') {
      const response = await fetch(source.url)
      if (!response.ok) {
        throw new Error(`BookContentService: failed to fetch remote EPUB — ${response.status}`)
      }
      return response.arrayBuffer()
    }

    if (source.type === 'fileHandle') {
      const file = await source.handle.getFile()
      return file.arrayBuffer()
    }

    // source.type === 'local' — read from OPFS / IDB fallback
    const file = await opfsStorageService.readBookFile(source.opfsPath, book.id)
    if (!file) {
      throw new Error(`BookContentService: EPUB file not found in storage for book "${book.id}"`)
    }
    return file.arrayBuffer()
  }
}

export const bookContentService = new BookContentService()
