/**
 * OPFS (Origin Private File System) storage service for book files.
 *
 * Stores book files in the browser's private filesystem for fast offline access.
 * Falls back to IndexedDB blob storage when OPFS is unavailable.
 *
 * Directory layout: /knowlune/books/{bookId}/book.epub
 *                   /knowlune/books/{bookId}/cover.jpg
 *
 * @module OpfsStorageService
 * @since E83-S01
 */

import { db } from '@/db/schema'

const OPFS_ROOT = 'knowlune'
const BOOKS_DIR = 'books'

class OpfsStorageService {
  private _useIndexedDBFallback = false
  private _initialized = false

  /** Check whether OPFS is available in this browser. */
  isOpfsAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.storage !== 'undefined' &&
      typeof navigator.storage.getDirectory === 'function'
    )
  }

  /** Initialize — detect OPFS availability and set fallback mode. */
  private async init(): Promise<void> {
    if (this._initialized) return

    if (!this.isOpfsAvailable()) {
      console.warn(
        '[OpfsStorageService] OPFS unavailable, using IndexedDB fallback — expect slower file operations'
      )
      this._useIndexedDBFallback = true
    }

    this._initialized = true
  }

  /** Get a directory handle for a book's storage folder. */
  private async getBookDir(bookId: string): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory()
    const knowluneDir = await root.getDirectoryHandle(OPFS_ROOT, { create: true })
    const booksDir = await knowluneDir.getDirectoryHandle(BOOKS_DIR, { create: true })
    return booksDir.getDirectoryHandle(bookId, { create: true })
  }

  /**
   * Store a book file (epub, pdf, etc.) for a given bookId.
   * Returns the OPFS path or 'indexeddb' when in fallback mode.
   */
  async storeBookFile(bookId: string, file: File): Promise<string> {
    await this.init()

    if (this._useIndexedDBFallback) {
      await db.bookFiles.put({ bookId, filename: file.name, blob: file })
      return 'indexeddb'
    }

    const bookDir = await this.getBookDir(bookId)
    const fileHandle = await bookDir.getFileHandle(file.name, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(file)
    await writable.close()

    return `/${OPFS_ROOT}/${BOOKS_DIR}/${bookId}/${file.name}`
  }

  /**
   * Read a book file. In OPFS mode, reads from the given path.
   * In fallback mode, reads from IndexedDB.
   */
  async readBookFile(opfsPath: string, bookId?: string): Promise<File | null> {
    await this.init()

    if (this._useIndexedDBFallback) {
      if (!bookId) return null
      const records = await db.bookFiles.where('bookId').equals(bookId).toArray()
      if (records.length === 0) return null
      const record = records[0]
      return new File([record.blob], record.filename)
    }

    try {
      // Parse path: /knowlune/books/{bookId}/{filename}
      const parts = opfsPath.split('/').filter(Boolean)
      if (parts.length < 4) return null

      const root = await navigator.storage.getDirectory()
      let dir: FileSystemDirectoryHandle = root
      for (const segment of parts.slice(0, -1)) {
        dir = await dir.getDirectoryHandle(segment)
      }
      const filename = parts[parts.length - 1]
      const fileHandle = await dir.getFileHandle(filename)
      return (await fileHandle.getFile()) as File
    } catch {
      // silent-catch-ok: file may not exist
      return null
    }
  }

  /**
   * Delete all files for a book.
   */
  async deleteBookFiles(bookId: string): Promise<void> {
    await this.init()

    if (this._useIndexedDBFallback) {
      await db.bookFiles.where('bookId').equals(bookId).delete()
      return
    }

    try {
      const root = await navigator.storage.getDirectory()
      const knowluneDir = await root.getDirectoryHandle(OPFS_ROOT)
      const booksDir = await knowluneDir.getDirectoryHandle(BOOKS_DIR)
      await booksDir.removeEntry(bookId, { recursive: true })
    } catch {
      // silent-catch-ok: directory may not exist
    }
  }

  /**
   * Get storage estimate (quota and usage).
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null

    try {
      const estimate = await navigator.storage.estimate()
      return {
        usage: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
      }
    } catch {
      // silent-catch-ok: storage estimate not available
      return null
    }
  }
}

/** Singleton instance */
export const opfsStorageService = new OpfsStorageService()
