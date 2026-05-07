/**
 * DownloadManager — singleton service for offline book downloads.
 *
 * Manages streaming download from URL to OPFS with HTTP Range resume,
 * progress tracking, serialized queue, and offlinePath management.
 *
 * @since offline-book-downloads (2026-05-07)
 */

import { db } from '@/db/schema'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { useDownloadStore, type PendingDownloadState } from '@/stores/useDownloadStore'
import { checkStorageQuota } from '@/lib/storageQuotaMonitor'
import type { Book, ContentSource } from '@/data/types'

export type DownloadStatus = 'pending' | 'downloading' | 'downloaded' | 'failed' | 'paused' | 'retrying'

export interface DownloadRecord {
  id: string
  bookId: string
  status: DownloadStatus
  progress: number // bytes downloaded
  totalSize: number // bytes (from Content-Length)
  opfsPath?: string
  originalSource: ContentSource
  checkpoint?: { byteOffset: number; etag?: string }
  error?: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

class DownloadManager {
  private activeController: AbortController | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private initialized = false

  /** Initialize on app mount — reconcile orphaned state, hydrate store. */
  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    try {
      const inFlight = await db.downloads
        .where('status')
        .anyOf(['downloading', 'retrying'])
        .toArray()

      for (const rec of inFlight) {
        await db.downloads.update(rec.id, {
          status: 'paused',
          updatedAt: new Date().toISOString(),
        })
      }

      // Reconcile: books with offlinePath but no downloads record
      const downloadedRecords = await db.downloads
        .where('status')
        .equals('downloaded')
        .toArray()
      const downloadedBookIds = new Set(downloadedRecords.map((r: DownloadRecord) => r.bookId))

      const allBooks = await db.books.toArray()
      for (const book of allBooks) {
        if (book.offlinePath && !downloadedBookIds.has(book.id)) {
          await db.downloads.put({
            id: crypto.randomUUID(),
            bookId: book.id,
            status: 'downloaded',
            progress: book.fileSize ?? 0,
            totalSize: book.fileSize ?? 0,
            opfsPath: book.offlinePath,
            originalSource: book.source,
            retryCount: 0,
            createdAt: book.updatedAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
      }

      // Hydrate Zustand store from Dexie
      const allRecords = await db.downloads.toArray()
      useDownloadStore.getState().hydrate(allRecords)
    } catch (err) {
      console.error('[DownloadManager] initialize failed:', err)
      useDownloadStore.getState().setHydrated(true)
    }
  }

  /** Serialized download flow — resolves the file URL, streams to OPFS. */
  async startDownload(book: Book): Promise<void> {
    await this._requestPersistentStorage()

    const store = useDownloadStore.getState()
    const existing = store.downloads.get(book.id)

    if (existing?.status === 'downloaded') return
    // Explicit guard: never start a second download for the same book
    if (existing?.status === 'downloading' || existing?.status === 'retrying') return

    const hasActive = store.hasActiveDownload()
    if (hasActive) {
      store.setDownloadState(book.id, { status: 'pending', progress: 0, totalSize: 0, retryCount: 0 })
      return
    }

    await this._performDownload(book)
    await this._drainQueue()
  }

  /** Cancel active download for a book. */
  cancelDownload(bookId: string): void {
    const store = useDownloadStore.getState()
    const rec = store.downloads.get(bookId)
    if (rec?.status === 'downloading' || rec?.status === 'retrying') {
      this.activeController?.abort()
      this.activeController = null
      if (this.retryTimer) {
        clearTimeout(this.retryTimer)
        this.retryTimer = null
      }
      store.setDownloadState(bookId, { status: 'paused', error: 'Download cancelled' })
    }
  }

  /** Remove a download — delete OPFS file, clear offlinePath, remove record. */
  async removeDownload(bookId: string): Promise<void> {
    const store = useDownloadStore.getState()
    const rec = store.downloads.get(bookId)
    if (!rec || rec.status !== 'downloaded') return

    try {
      if (rec.opfsPath) {
        await opfsStorageService.deleteBookFiles(bookId)
      }
    } catch (err) {
      console.warn('[DownloadManager] OPFS cleanup failed (non-fatal):', err)
    }

    try {
      const book = await db.books.get(bookId)
      if (book?.offlinePath) {
        await db.books.update(bookId, { offlinePath: null })
      }
    } catch (err) {
      console.warn('[DownloadManager] Book update failed (non-fatal):', err)
    }

    try {
      await db.downloads.where('bookId').equals(bookId).delete()
    } catch (err) {
      console.warn('[DownloadManager] Record delete failed (non-fatal):', err)
    }

    store.removeDownloadState(bookId)
  }

  /** Lookup download state for a book. */
  getDownloadState(bookId: string): PendingDownloadState | undefined {
    return useDownloadStore.getState().downloads.get(bookId)
  }

  /** Get all download records. */
  async getAllDownloads(): Promise<DownloadRecord[]> {
    return db.downloads.toArray()
  }

  /** Resolve the actual download URL for a book. */
  async resolveDownloadUrl(book: Book): Promise<string> {
    if (book.sourceUrl) return book.sourceUrl
    if (book.source.type === 'remote' && book.source.url) return book.source.url
    if (book.fileUrl) return book.fileUrl
    throw new Error('No downloadable URL available for this book')
  }

  // ─── Private ─────────────────────────────────────────────────────────

  /** Request persistent storage on first download to reduce OPFS eviction risk. */
  private async _requestPersistentStorage(): Promise<void> {
    if (typeof navigator.storage?.persist !== 'function') return
    if (localStorage.getItem('knowlune_storage_persist_requested')) return

    try {
      const alreadyPersisted = await navigator.storage.persisted()
      if (alreadyPersisted) {
        localStorage.setItem('knowlune_storage_persist_requested', '1')
        return
      }
      const granted = await navigator.storage.persist()
      console.info(`[DownloadManager] Persistent storage ${granted ? 'granted' : 'denied'}`)
    } catch (err) {
      console.warn('[DownloadManager] persist() failed:', err)
    }
    localStorage.setItem('knowlune_storage_persist_requested', '1')
  }

  private async _performDownload(book: Book): Promise<void> {
    const store = useDownloadStore.getState()
    const bookId = book.id

    // Scope AbortController locally per call frame — avoids cross-retry interference
    const controller = new AbortController()
    this.activeController = controller

    try {
      const url = await this.resolveDownloadUrl(book)

      // Always fetch from scratch (no Range resume — see fix from post-merge review).
      // Resume requires keepExistingData + seek which is incompatible with pipeTo.
      const response = await fetch(url, { signal: controller.signal })

      if (!response.body) {
        throw new Error('Response has no readable body')
      }

      const contentLength = response.headers.get('Content-Length')
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0

      store.setDownloadState(bookId, {
        status: 'downloading',
        progress: 0,
        totalSize,
        retryCount: 0,
      })

      const ext = book.format === 'audiobook' ? '.m4b' : '.epub'
      // Absolute OPFS path matching OpfsStorageService convention for reader compatibility
      const opfsPath = `/knowlune/books/${bookId}/book${ext}`

      // Streaming write to OPFS via createWritable + pipeTo
      const root = await navigator.storage.getDirectory()
      const knowluneDir = await root.getDirectoryHandle('knowlune', { create: true })
      const booksDir = await knowluneDir.getDirectoryHandle('books', { create: true })
      const bookDir = await booksDir.getDirectoryHandle(bookId, { create: true })

      const fileHandle = await bookDir.getFileHandle(`book${ext}`, { create: true })
      const writable = await fileHandle.createWritable()
      await response.body.pipeTo(writable)

      store.setDownloadState(bookId, {
        status: 'downloaded',
        progress: totalSize,
        totalSize,
        opfsPath: opfsPath,
      })

      await db.books.update(bookId, { offlinePath: opfsPath })

      // Trigger quota check after download completes
      checkStorageQuota()

      const record = store.downloads.get(bookId)
      if (record) {
        await db.downloads.put({
          id: record.id,
          bookId,
          status: 'downloaded',
          progress: totalSize,
          totalSize,
          opfsPath: opfsPath,
          originalSource: book.source,
          retryCount: 0,
          createdAt: record.createdAt,
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      const rec = store.downloads.get(bookId)
      const retryCount = (rec?.retryCount ?? 0) + 1
      const maxRetries = 3

      if (retryCount <= maxRetries) {
        store.setDownloadState(bookId, {
          status: 'retrying',
          retryCount,
          error: (err as Error).message,
        })
        // Abortable retry timer — cancelDownload clears this.retryTimer
        const delay = Math.pow(2, retryCount) * 1000
        await new Promise<void>((resolve, reject) => {
          this.retryTimer = setTimeout(() => {
            this.retryTimer = null
            resolve()
          }, delay)
          controller.signal.addEventListener('abort', () => {
            if (this.retryTimer) {
              clearTimeout(this.retryTimer)
              this.retryTimer = null
            }
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
        await this._performDownload(book)
      } else {
        store.setDownloadState(bookId, {
          status: 'failed',
          error: (err as Error).message,
          retryCount,
        })
      }
    } finally {
      // Only clear if this frame's controller is still the active one
      if (this.activeController === controller) {
        this.activeController = null
      }
    }
  }

  private async _drainQueue(): Promise<void> {
    const store = useDownloadStore.getState()
    const pending = store.getPendingDownload()
    if (!pending) return

    const book = await db.books.get(pending.bookId)
    if (book) {
      await this._performDownload(book)
      await this._drainQueue()
    }
  }
}

export const downloadManager = new DownloadManager()
