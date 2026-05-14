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
   * Write a ReadableStream to a book file in OPFS, falling back to IndexedDB
   * when OPFS is unavailable. Supports an optional progress callback that
   * receives the cumulative bytes written on each chunk.
   *
   * Returns the storage path ('indexeddb' in fallback mode, or the full
   * OPFS path in direct mode).
   *
   * In fallback mode the stream is written to IndexedDB incrementally as
   * individual chunk records (book.epub.part.NNNNNN) to avoid buffering the
   * entire file in memory. A metadata record (book.epub.meta) tracks the
   * total chunk count for reassembly on read.
   */
  async storeStreamToBookFile(
    bookId: string,
    filename: string,
    stream: ReadableStream<Uint8Array>,
    onProgress?: (bytesWritten: number) => void
  ): Promise<string> {
    await this.init()

    if (this._useIndexedDBFallback) {
      const reader = stream.getReader()
      let totalBytes = 0
      let chunkIndex = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // Write each chunk to IDB as a separate record — no in-memory buffering
        const paddedIdx = String(chunkIndex).padStart(6, '0')
        await db.bookFiles.put({
          bookId,
          filename: `${filename}.part.${paddedIdx}`,
          blob: new Blob([value]),
        })
        chunkIndex++
        totalBytes += value.byteLength
        onProgress?.(totalBytes)
      }

      // Write metadata record with total chunk count for reassembly
      await db.bookFiles.put({
        bookId,
        filename: `${filename}.meta`,
        blob: new Blob([JSON.stringify({ totalChunks: chunkIndex })]),
      })

      return 'indexeddb'
    }

    const opfsPath = `/${OPFS_ROOT}/${BOOKS_DIR}/${bookId}/${filename}`
    const bookDir = await this.getBookDir(bookId)
    const fileHandle = await bookDir.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()

    if (onProgress) {
      // Insert a TransformStream to intercept bytes for progress reporting
      const transform = new TransformStream()
      const transformWriter = transform.writable.getWriter()
      const reader = stream.getReader()
      let bytesWritten = 0

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytesWritten += value.byteLength
          await transformWriter.write(value)
          onProgress(bytesWritten)
        }
        await transformWriter.close()
      }

      await Promise.all([pump(), transform.readable.pipeTo(writable)])
    } else {
      await stream.pipeTo(writable)
    }

    return opfsPath
  }

  /**
   * Read a book file. In OPFS mode, reads from the given path.
   * In fallback mode, reads from IndexedDB.
   */
  async readBookFile(opfsPath: string, bookId: string): Promise<File | null> {
    await this.init()

    if (this._useIndexedDBFallback) {
      const records = await db.bookFiles.where('bookId').equals(bookId).toArray()
      if (records.length === 0) return null

      // Check for chunked format (has .meta fingerprint)
      const metaRecord = records.find(r => r.filename.endsWith('.meta'))
      if (metaRecord) {
        const metaText = await metaRecord.blob.text()
        const meta = JSON.parse(metaText)
        const totalChunks: number = meta.totalChunks ?? 0
        const blobs: Blob[] = []
        for (let i = 0; i < totalChunks; i++) {
          const paddedIdx = String(i).padStart(6, '0')
          const chunk = records.find(r => r.filename.endsWith(`.part.${paddedIdx}`))
          if (chunk) blobs.push(chunk.blob)
        }
        // Derive original filename from .meta record name
        const originalFilename = metaRecord.filename.replace(/\.meta$/, '')
        if (blobs.length === 0) return null
        return new File(blobs as BlobPart[], originalFilename)
      }

      // Legacy single-record format (pre-chunked migration)
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
   * Store a cover image for a book.
   * Returns the OPFS path or 'indexeddb' when in fallback mode.
   */
  async storeCoverFile(bookId: string, blob: Blob): Promise<string> {
    await this.init()

    const filename = 'cover.jpg'

    if (this._useIndexedDBFallback) {
      const file = new File([blob], filename, { type: blob.type })
      await db.bookFiles.put({ bookId, filename, blob: file })
      return 'indexeddb'
    }

    const bookDir = await this.getBookDir(bookId)
    const fileHandle = await bookDir.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()

    return `/${OPFS_ROOT}/${BOOKS_DIR}/${bookId}/${filename}`
  }

  /**
   * Read a cover image as an object URL. Caller must revoke when done.
   */
  async getCoverUrl(bookId: string): Promise<string | null> {
    await this.init()

    if (this._useIndexedDBFallback) {
      const records = await db.bookFiles
        .where('bookId')
        .equals(bookId)
        .filter(r => r.filename === 'cover.jpg')
        .toArray()
      if (records.length === 0) return null
      return URL.createObjectURL(records[0].blob)
    }

    try {
      const bookDir = await this.getBookDir(bookId)
      const fileHandle = await bookDir.getFileHandle('cover.jpg')
      const file = await fileHandle.getFile()
      return URL.createObjectURL(file)
    } catch {
      // silent-catch-ok: cover may not exist
      return null
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
