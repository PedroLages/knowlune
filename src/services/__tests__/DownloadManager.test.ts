/**
 * Unit tests: DownloadManager
 *
 * Covers download lifecycle: happy path, cancel, retry, queue serialization,
 * error handling, initialization reconciliation, and persistent storage request.
 *
 * @since offline-book-downloads gaps (2026-05-14)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Book } from '@/data/types'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_BOOK: Book = {
  id: 'book-1',
  title: 'Test Book',
  author: 'Test Author',
  format: 'ebook',
  status: 'unread',
  source: { type: 'remote', url: 'https://example.com/book.epub' },
  sourceType: 'remote',
  sourceUrl: 'https://example.com/book.epub',
  fileSize: 1000,
  chapters: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as Book

const MOCK_AUDIOBOOK: Book = {
  ...MOCK_BOOK,
  id: 'book-2',
  title: 'Test Audiobook',
  format: 'audiobook',
  sourceUrl: 'https://example.com/book.m4b',
} as unknown as Book

// ---------------------------------------------------------------------------
// Mock Dexie db
// ---------------------------------------------------------------------------

const mockDownloadsTable = {
  where: vi.fn(),
  put: vi.fn().mockResolvedValue('record-id'),
  update: vi.fn().mockResolvedValue(1),
  toArray: vi.fn().mockResolvedValue([]),
}

const mockBooksTable = {
  get: vi.fn().mockResolvedValue(null),
  update: vi.fn().mockResolvedValue(1),
  toArray: vi.fn().mockResolvedValue([]),
}

vi.mock('@/db/schema', () => ({
  db: {
    downloads: mockDownloadsTable,
    books: mockBooksTable,
  },
}))

// ---------------------------------------------------------------------------
// Mock OpfsStorageService
// ---------------------------------------------------------------------------

const mockStoreStreamToBookFile = vi.fn().mockResolvedValue('/knowlune/books/book-1/book.epub')
const mockDeleteBookFiles = vi.fn().mockResolvedValue(undefined)

vi.mock('@/services/OpfsStorageService', () => ({
  opfsStorageService: {
    storeStreamToBookFile: mockStoreStreamToBookFile,
    deleteBookFiles: mockDeleteBookFiles,
  },
}))

// ---------------------------------------------------------------------------
// Reactive mock for Zustand download store
// ---------------------------------------------------------------------------
// The mock store state is reactive: setDownloadState updates the internal
// downloads Map, and hasActiveDownload / getPendingDownload read from it,
// so queue-drain and active-download guards reflect real state changes.

function createMockStoreState() {
  const downloads = new Map<string, unknown>()

  return {
    downloads,
    setDownloadState: vi.fn((bookId: string, state: Record<string, unknown>) => {
      const existing = downloads.get(bookId) || {}
      downloads.set(bookId, { ...existing, ...state })
    }),
    removeDownloadState: vi.fn((bookId: string) => {
      downloads.delete(bookId)
    }),
    hasActiveDownload: vi.fn(() => {
      for (const rec of downloads.values()) {
        const r = rec as Record<string, unknown>
        if (r.status === 'downloading' || r.status === 'retrying') return true
      }
      return false
    }),
    getPendingDownload: vi.fn(() => {
      for (const rec of downloads.values()) {
        const r = rec as Record<string, unknown>
        if (r.status === 'pending') return r
      }
      return null
    }),
    hydrate: vi.fn(),
    setHydrated: vi.fn(),
  }
}

let mockStoreState = createMockStoreState()

vi.mock('@/stores/useDownloadStore', () => ({
  useDownloadStore: {
    getState: vi.fn().mockReturnValue(mockStoreState),
  },
}))

// ---------------------------------------------------------------------------
// Mock lib/storageQuotaMonitor
// ---------------------------------------------------------------------------

const mockCheckStorageQuota = vi.fn()
vi.mock('@/lib/storageQuotaMonitor', () => ({
  checkStorageQuota: mockCheckStorageQuota,
}))

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let downloadManager: typeof import('@/services/DownloadManager').downloadManager

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetModules()

  // Re-mock after resetModules
  vi.doMock('@/db/schema', () => ({
    db: {
      downloads: {
        where: vi.fn().mockReturnValue({
          anyOf: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
            delete: vi.fn().mockResolvedValue(0),
          }),
        }),
        put: vi.fn().mockResolvedValue('record-id'),
        update: vi.fn().mockResolvedValue(1),
        toArray: vi.fn().mockResolvedValue([]),
      },
      books: {
        get: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(1),
        toArray: vi.fn().mockResolvedValue([]),
      },
    },
  }))

  vi.doMock('@/services/OpfsStorageService', () => ({
    opfsStorageService: {
      storeStreamToBookFile: mockStoreStreamToBookFile,
      deleteBookFiles: mockDeleteBookFiles,
    },
  }))

  vi.doMock('@/stores/useDownloadStore', () => ({
    useDownloadStore: {
      getState: vi.fn().mockReturnValue(mockStoreState),
    },
  }))

  vi.doMock('@/lib/storageQuotaMonitor', () => ({
    checkStorageQuota: mockCheckStorageQuota,
  }))

  // Reset mock store state with a fresh reactive instance
  mockStoreState = createMockStoreState()

  // Reset mock functions
  mockStoreStreamToBookFile.mockReset()
  mockStoreStreamToBookFile.mockResolvedValue('/knowlune/books/book-1/book.epub')
  mockDeleteBookFiles.mockReset()
  mockDeleteBookFiles.mockResolvedValue(undefined)
  mockCheckStorageQuota.mockReset()

  // Import fresh module to get fresh singleton
  const mod = await import('@/services/DownloadManager')
  downloadManager = mod.downloadManager
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DownloadManager', () => {
  // ─── resolveDownloadUrl ─────────────────────────────────────────────────

  describe('resolveDownloadUrl', () => {
    it('returns sourceUrl when available', async () => {
      const url = await downloadManager.resolveDownloadUrl(MOCK_BOOK)
      expect(url).toBe('https://example.com/book.epub')
    })

    it('returns source.url when sourceUrl is absent', async () => {
      const book = { ...MOCK_BOOK, sourceUrl: undefined, source: { type: 'remote', url: 'https://alt.example/book.epub' } } as unknown as Book
      const url = await downloadManager.resolveDownloadUrl(book)
      expect(url).toBe('https://alt.example/book.epub')
    })

    it('returns fileUrl as fallback', async () => {
      const book = { ...MOCK_BOOK, sourceUrl: undefined, source: { type: 'local' }, fileUrl: 'https://file.example/book.epub' } as unknown as Book
      const url = await downloadManager.resolveDownloadUrl(book)
      expect(url).toBe('https://file.example/book.epub')
    })

    it('throws when no URL is available', async () => {
      const book = { ...MOCK_BOOK, sourceUrl: undefined, source: { type: 'local' } } as unknown as Book
      await expect(downloadManager.resolveDownloadUrl(book)).rejects.toThrow('No downloadable URL')
    })
  })

  // ─── startDownload — happy path ─────────────────────────────────────────

  describe('startDownload', () => {
    it('returns early when book is already downloaded', async () => {
      mockStoreState.downloads.set('book-1', {
        id: 'dl-1',
        bookId: 'book-1',
        status: 'downloaded',
        progress: 1000,
        totalSize: 1000,
        retryCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })

      await downloadManager.startDownload(MOCK_BOOK)

      // Should not have initiated any download
      const calls = mockStoreState.setDownloadState.mock.calls
      const downloadingCalls = calls.filter((c: unknown[]) => {
        const args = c[1] as Record<string, unknown>
        return args?.status === 'downloading'
      })
      expect(downloadingCalls).toHaveLength(0)
    })

    it('returns early when download is already in progress', async () => {
      mockStoreState.downloads.set('book-1', {
        id: 'dl-1',
        bookId: 'book-1',
        status: 'downloading',
        progress: 100,
        totalSize: 1000,
        retryCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })

      await downloadManager.startDownload(MOCK_BOOK)

      // Should not start a second download for same book
      expect(mockStoreState.setDownloadState).not.toHaveBeenCalled()
    })

    it('enqueues as pending when another download is active', async () => {
      // Seed an active download so the reactive mock detects it
      mockStoreState.downloads.set('other-book', {
        id: 'dl-active',
        bookId: 'other-book',
        status: 'downloading',
        progress: 100,
        totalSize: 1000,
        retryCount: 0,
      })

      await downloadManager.startDownload(MOCK_BOOK)

      expect(mockStoreState.setDownloadState).toHaveBeenCalledWith('book-1', {
        status: 'pending',
        progress: 0,
        totalSize: 0,
        retryCount: 0,
      })
    })

    it('calls fetch and writes stream on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]))
            controller.close()
          },
        }),
        headers: new Map([['Content-Length', '1000']]),
      })
      vi.stubGlobal('fetch', mockFetch)
      vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

      // Mock persistent storage already requested
      vi.stubGlobal('localStorage', {
        getItem: vi.fn().mockReturnValue('1'),
        setItem: vi.fn(),
      })

      await downloadManager.startDownload(MOCK_BOOK)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/book.epub',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(mockStoreStreamToBookFile).toHaveBeenCalled()
      expect(mockCheckStorageQuota).toHaveBeenCalled()
    })

    it('handles empty response body as error with retries', async () => {
      vi.useFakeTimers()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        body: null,
        headers: new Map(),
      }))
      vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

      const promise = downloadManager.startDownload(MOCK_BOOK)
      // Advance past all retry delays: 2s + 4s + 8s = 14s
      await vi.advanceTimersByTimeAsync(16000)
      await promise
      vi.useRealTimers()

      const calls = mockStoreState.setDownloadState.mock.calls
      const statuses = calls.map((c: unknown[]) => {
        const args = c[1] as Record<string, unknown>
        return args.status as string
      })
      expect(statuses.filter((s: string) => s === 'retrying').length).toBeGreaterThanOrEqual(1)
      expect(statuses).toContain('failed')
    })

    it('handles fetch failure with retries and ultimately fails', async () => {
      vi.useFakeTimers()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))
      vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })
      vi.stubGlobal('localStorage', {
        getItem: vi.fn().mockReturnValue('1'),
        setItem: vi.fn(),
      })

      const promise = downloadManager.startDownload(MOCK_BOOK)
      await vi.advanceTimersByTimeAsync(16000)
      await promise
      vi.useRealTimers()

      const calls = mockStoreState.setDownloadState.mock.calls
      const lastCall = calls[calls.length - 1]
      const lastArgs = lastCall[1] as Record<string, unknown>
      expect(lastArgs.status).toBe('failed')
      expect(lastArgs.error).toBe('Network failure')
    })

    it('uses .m4b extension for audiobooks', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]))
            controller.close()
          },
        }),
        headers: new Map([['Content-Length', '2000']]),
      })
      vi.stubGlobal('fetch', mockFetch)
      vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })
      vi.stubGlobal('localStorage', {
        getItem: vi.fn().mockReturnValue('1'),
        setItem: vi.fn(),
      })

      mockStoreStreamToBookFile.mockResolvedValue('/knowlune/books/book-2/book.m4b')

      await downloadManager.startDownload(MOCK_AUDIOBOOK)

      expect(mockStoreStreamToBookFile).toHaveBeenCalledWith(
        'book-2',
        'book.m4b',
        expect.any(Object),
        expect.any(Function),
      )
    })

    it('processes queued downloads in FIFO order', async () => {
      const book1 = { ...MOCK_BOOK, id: 'book-1' }
      const book2 = {
        ...MOCK_BOOK,
        id: 'book-2',
        sourceUrl: 'https://example.com/book2.epub',
      }
      const book3 = {
        ...MOCK_BOOK,
        id: 'book-3',
        sourceUrl: 'https://example.com/book3.epub',
      }

      // Mock fetch so _performDownload succeeds for all books
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1]))
            controller.close()
          },
        }),
        headers: new Map([['Content-Length', '100']]),
      })
      vi.stubGlobal('fetch', mockFetch)
      vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })
      vi.stubGlobal('localStorage', {
        getItem: vi.fn().mockReturnValue('1'),
        setItem: vi.fn(),
      })

      // Seed two pending downloads already in the store (book-2, book-3)
      mockStoreState.downloads.set('book-2', {
        id: 'dl-2',
        bookId: 'book-2',
        status: 'pending',
        progress: 0,
        totalSize: 0,
        retryCount: 0,
      })
      mockStoreState.downloads.set('book-3', {
        id: 'dl-3',
        bookId: 'book-3',
        status: 'pending',
        progress: 0,
        totalSize: 0,
        retryCount: 0,
      })

      // Mock db.books.get to resolve pending bookIds to Book objects
      const { db } = await import('@/db/schema')
      vi.mocked(db.books.get).mockImplementation(async (_equalityCriterias: { [key: string]: any }) => {
        if (id === 'book-2') return book2 as any
        if (id === 'book-3') return book3 as any
        return null
      })

      await downloadManager.startDownload(book1)

      // Extract the order books entered 'downloading' status
      const calls = mockStoreState.setDownloadState.mock.calls
      const downloadingCalls = calls.filter(
        (c: unknown[]) => (c[1] as Record<string, unknown>)?.status === 'downloading',
      )
      const bookIds = downloadingCalls.map((c: unknown[]) => c[0])

      expect(bookIds).toEqual(['book-1', 'book-2', 'book-3'])
    })
  })

  // ─── cancelDownload ────────────────────────────────────────────────────

  describe('cancelDownload', () => {
    it('sets paused status for downloading state', () => {
      mockStoreState.downloads.set('book-1', {
        id: 'dl-1',
        bookId: 'book-1',
        status: 'downloading',
        progress: 500,
        totalSize: 1000,
        retryCount: 0,
      })

      downloadManager.cancelDownload('book-1')

      expect(mockStoreState.setDownloadState).toHaveBeenCalledWith('book-1', {
        status: 'paused',
        error: 'Download cancelled',
      })
    })

    it('does nothing for non-active (downloaded) downloads', () => {
      mockStoreState.downloads.set('book-1', {
        id: 'dl-1',
        bookId: 'book-1',
        status: 'downloaded',
        progress: 1000,
        totalSize: 1000,
      })

      downloadManager.cancelDownload('book-1')

      expect(mockStoreState.setDownloadState).not.toHaveBeenCalled()
    })
  })

  // ─── removeDownload ────────────────────────────────────────────────────

  describe('removeDownload', () => {
    it('cleans up OPFS, Dexie, and store for downloaded book', async () => {
      mockStoreState.downloads.set('book-1', {
        id: 'dl-1',
        bookId: 'book-1',
        status: 'downloaded',
        progress: 1000,
        totalSize: 1000,
        opfsPath: '/knowlune/books/book-1/book.epub',
        retryCount: 0,
      })

      const { db } = await import('@/db/schema')
      vi.mocked(db.books.get).mockResolvedValue({ ...MOCK_BOOK, offlinePath: '/knowlune/books/book-1/book.epub' } as any)

      await downloadManager.removeDownload('book-1')

      expect(mockDeleteBookFiles).toHaveBeenCalledWith('book-1')
      expect(db.books.update).toHaveBeenCalledWith('book-1', { offlinePath: null })
      expect(mockStoreState.removeDownloadState).toHaveBeenCalledWith('book-1')
    })

    it('does nothing if download not in downloaded state', async () => {
      mockStoreState.downloads.set('book-1', {
        id: 'dl-1',
        bookId: 'book-1',
        status: 'failed',
        progress: 0,
        totalSize: 1000,
        retryCount: 3,
      })

      await downloadManager.removeDownload('book-1')

      expect(mockDeleteBookFiles).not.toHaveBeenCalled()
      expect(mockStoreState.removeDownloadState).not.toHaveBeenCalled()
    })

    it('handles OPFS cleanup failure gracefully', async () => {
      mockStoreState.downloads.set('book-1', {
        id: 'dl-1',
        bookId: 'book-1',
        status: 'downloaded',
        progress: 1000,
        totalSize: 1000,
        opfsPath: '/knowlune/books/book-1/book.epub',
        retryCount: 0,
      })

      mockDeleteBookFiles.mockRejectedValue(new Error('OPFS error'))

      const { db } = await import('@/db/schema')
      vi.mocked(db.books.get).mockResolvedValue({ ...MOCK_BOOK, offlinePath: '/knowlune/books/book-1/book.epub' } as any)

      await expect(downloadManager.removeDownload('book-1')).resolves.toBeUndefined()
      expect(mockStoreState.removeDownloadState).toHaveBeenCalledWith('book-1')
    })
  })

  // ─── getDownloadState ──────────────────────────────────────────────────

  describe('getDownloadState', () => {
    it('returns download state for a known book', () => {
      mockStoreState.downloads.set('book-1', {
        id: 'dl-1',
        bookId: 'book-1',
        status: 'downloaded',
        progress: 1000,
        totalSize: 1000,
        retryCount: 0,
      })

      const state = downloadManager.getDownloadState('book-1')
      expect(state).toBeDefined()
      expect(state?.status).toBe('downloaded')
    })

    it('returns undefined for unknown book', () => {
      const state = downloadManager.getDownloadState('nonexistent')
      expect(state).toBeUndefined()
    })
  })

  // ─── getAllDownloads ───────────────────────────────────────────────────

  describe('getAllDownloads', () => {
    it('returns all download records from Dexie', async () => {
      const mockRecords = [
        { id: 'dl-1', bookId: 'book-1', status: 'downloaded' },
        { id: 'dl-2', bookId: 'book-2', status: 'pending' },
      ]
      const { db } = await import('@/db/schema')
      vi.mocked(db.downloads.toArray).mockResolvedValue(mockRecords as any)

      const records = await downloadManager.getAllDownloads()
      expect(records).toHaveLength(2)
    })
  })

  // ─── initialize ────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('marks in-flight downloads as paused', async () => {
      const { db } = await import('@/db/schema')

      // Mock where chain for in-flight query
      vi.mocked(db.downloads.where).mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 'dl-1', bookId: 'book-1', status: 'downloading' },
          ]),
        }),
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(0),
        }),
      } as any)

      vi.mocked(db.downloads.toArray).mockResolvedValue([])
      vi.mocked(db.books.toArray).mockResolvedValue([])

      await downloadManager.initialize()

      expect(db.downloads.update).toHaveBeenCalledWith('dl-1', {
        status: 'paused',
        updatedAt: expect.any(String),
      })
    })

    it('reconciles orphaned offlinePath records', async () => {
      const { db } = await import('@/db/schema')

      // Return empty in-flight, one downloaded record
      vi.mocked(db.downloads.where).mockReturnValue({
        anyOf: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 'dl-2', bookId: 'book-2', status: 'downloaded' },
          ]),
          delete: vi.fn().mockResolvedValue(0),
        }),
      } as any)

      vi.mocked(db.books.toArray).mockResolvedValue([
        { ...MOCK_BOOK, id: 'book-1', offlinePath: '/knowlune/books/book-1/book.epub', fileSize: 1000 },
        { ...MOCK_BOOK, id: 'book-2', offlinePath: '/knowlune/books/book-2/book.epub', fileSize: 2000 },
      ] as any)

      vi.mocked(db.downloads.toArray).mockResolvedValue([
        { id: 'dl-2', bookId: 'book-2', status: 'downloaded' },
      ] as any)

      await downloadManager.initialize()

      // Should create a download record for book-1 (has offlinePath but no record)
      expect(db.downloads.put).toHaveBeenCalledWith(expect.objectContaining({
        bookId: 'book-1',
        status: 'downloaded',
      }))
    })
  })

  // ─── Persistent storage request ────────────────────────────────────────

  describe('persistent storage request', () => {
    it('requests persistent storage on first download', async () => {
      vi.useFakeTimers()

      const mockPersist = vi.fn().mockResolvedValue(true)
      const mockPersisted = vi.fn().mockResolvedValue(false)

      vi.stubGlobal('navigator', {
        storage: {
          persist: mockPersist,
          persisted: mockPersisted,
          estimate: vi.fn(),
        },
      })
      vi.stubGlobal('localStorage', {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
      })
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ignore')))
      vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

      const promise = downloadManager.startDownload(MOCK_BOOK)
      await vi.advanceTimersByTimeAsync(16000)
      await promise
      vi.useRealTimers()

      expect(mockPersisted).toHaveBeenCalled()
      expect(mockPersist).toHaveBeenCalled()
    })

    it('skips persist request if already flagged', async () => {
      vi.useFakeTimers()

      const mockPersist = vi.fn()

      vi.stubGlobal('navigator', {
        storage: {
          persist: mockPersist,
          estimate: vi.fn(),
        },
      })
      vi.stubGlobal('localStorage', {
        getItem: vi.fn().mockReturnValue('1'),
        setItem: vi.fn(),
      })
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ignore')))
      vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

      const promise = downloadManager.startDownload(MOCK_BOOK)
      await vi.advanceTimersByTimeAsync(16000)
      await promise
      vi.useRealTimers()

      expect(mockPersist).not.toHaveBeenCalled()
    })
  })
})
