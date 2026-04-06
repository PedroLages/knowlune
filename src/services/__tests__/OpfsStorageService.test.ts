import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Dexie db
// ---------------------------------------------------------------------------

vi.mock('@/db/schema', () => ({
  db: {
    bookFiles: {
      put: vi.fn().mockResolvedValue(undefined),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(0),
          filter: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    },
  },
}))

// ---------------------------------------------------------------------------
// Reset service singleton between tests
// ---------------------------------------------------------------------------

let opfsStorageService: typeof import('@/services/OpfsStorageService').opfsStorageService

beforeEach(async () => {
  vi.restoreAllMocks()
  // Re-import to get fresh singleton (reset _initialized and _useIndexedDBFallback)
  vi.resetModules()

  // Re-mock db after resetModules
  vi.doMock('@/db/schema', () => ({
    db: {
      bookFiles: {
        put: vi.fn().mockResolvedValue(undefined),
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
            delete: vi.fn().mockResolvedValue(0),
            filter: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      },
    },
  }))

  const mod = await import('@/services/OpfsStorageService')
  opfsStorageService = mod.opfsStorageService
})

// ---------------------------------------------------------------------------
// isOpfsAvailable
// ---------------------------------------------------------------------------

describe('OpfsStorageService.isOpfsAvailable', () => {
  it('returns true when navigator.storage.getDirectory exists', () => {
    vi.stubGlobal('navigator', {
      storage: { getDirectory: vi.fn(), estimate: vi.fn() },
    })
    expect(opfsStorageService.isOpfsAvailable()).toBe(true)
  })

  it('returns false when navigator.storage is undefined', () => {
    vi.stubGlobal('navigator', {})
    expect(opfsStorageService.isOpfsAvailable()).toBe(false)
  })

  it('returns false when navigator is undefined', () => {
    vi.stubGlobal('navigator', undefined)
    expect(opfsStorageService.isOpfsAvailable()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// IndexedDB fallback mode
// ---------------------------------------------------------------------------

describe('IndexedDB fallback mode', () => {
  beforeEach(() => {
    // Simulate no OPFS
    vi.stubGlobal('navigator', {})
  })

  it('storeBookFile returns "indexeddb" in fallback mode', async () => {
    const { db: mockDb } = await import('@/db/schema')
    const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' })
    const path = await opfsStorageService.storeBookFile('book-1', file)

    expect(path).toBe('indexeddb')
    expect(mockDb.bookFiles.put).toHaveBeenCalled()
  })

  it('readBookFile reads from IndexedDB in fallback mode', async () => {
    const { db: mockDb } = await import('@/db/schema')
    vi.mocked(mockDb.bookFiles.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { bookId: 'book-1', filename: 'book.epub', blob: new Blob(['data']) },
        ]),
        delete: vi.fn(),
        filter: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      }),
    } as never)

    const file = await opfsStorageService.readBookFile('indexeddb', 'book-1')
    expect(file).not.toBeNull()
    expect(file?.name).toBe('book.epub')
  })

  it('readBookFile returns null when no records in fallback', async () => {
    const file = await opfsStorageService.readBookFile('indexeddb', 'nonexistent')
    expect(file).toBeNull()
  })

  it('deleteBookFiles deletes from IndexedDB in fallback', async () => {
    const { db: mockDb } = await import('@/db/schema')
    await opfsStorageService.deleteBookFiles('book-1')
    expect(mockDb.bookFiles.where).toHaveBeenCalled()
  })

  it('storeCoverFile returns "indexeddb" in fallback mode', async () => {
    const blob = new Blob(['image'], { type: 'image/jpeg' })
    const path = await opfsStorageService.storeCoverFile('book-1', blob)
    expect(path).toBe('indexeddb')
  })

  it('getCoverUrl returns null when no cover in fallback', async () => {
    const url = await opfsStorageService.getCoverUrl('book-1')
    expect(url).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// OPFS mode (real OPFS APIs available)
// ---------------------------------------------------------------------------

describe('OPFS mode', () => {
  let mockWritable: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }
  let mockFileHandle: {
    getFile: ReturnType<typeof vi.fn>
    createWritable: ReturnType<typeof vi.fn>
  }
  let mockBookDir: {
    getFileHandle: ReturnType<typeof vi.fn>
  }
  let mockBooksDir: {
    getDirectoryHandle: ReturnType<typeof vi.fn>
    removeEntry: ReturnType<typeof vi.fn>
  }
  let mockKnowluneDir: { getDirectoryHandle: ReturnType<typeof vi.fn> }
  let mockRoot: { getDirectoryHandle: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockWritable = { write: vi.fn(), close: vi.fn() }
    mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(new File(['content'], 'book.epub')),
      createWritable: vi.fn().mockResolvedValue(mockWritable),
    }
    mockBookDir = {
      getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
    }
    mockBooksDir = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockBookDir),
      removeEntry: vi.fn(),
    }
    mockKnowluneDir = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockBooksDir),
    }
    mockRoot = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockKnowluneDir),
    }

    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: vi.fn().mockResolvedValue(mockRoot),
        estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
      },
    })
  })

  it('storeBookFile returns OPFS path', async () => {
    const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' })
    const path = await opfsStorageService.storeBookFile('book-1', file)

    expect(path).toBe('/knowlune/books/book-1/book.epub')
    expect(mockWritable.write).toHaveBeenCalledWith(file)
    expect(mockWritable.close).toHaveBeenCalled()
  })

  it('storeCoverFile returns OPFS path', async () => {
    const blob = new Blob(['image'], { type: 'image/jpeg' })
    const path = await opfsStorageService.storeCoverFile('book-1', blob)

    expect(path).toBe('/knowlune/books/book-1/cover.jpg')
    expect(mockWritable.write).toHaveBeenCalled()
  })

  it('deleteBookFiles calls removeEntry with recursive', async () => {
    await opfsStorageService.deleteBookFiles('book-1')
    expect(mockBooksDir.removeEntry).toHaveBeenCalledWith('book-1', { recursive: true })
  })

  it('deleteBookFiles handles missing directory gracefully', async () => {
    mockBooksDir.removeEntry.mockRejectedValue(new Error('Not found'))
    await expect(opfsStorageService.deleteBookFiles('missing')).resolves.toBeUndefined()
  })

  it('readBookFile returns file from OPFS path', async () => {
    const file = await opfsStorageService.readBookFile(
      '/knowlune/books/book-1/book.epub',
      'book-1'
    )
    expect(file).not.toBeNull()
  })

  it('readBookFile returns null for invalid path', async () => {
    const file = await opfsStorageService.readBookFile('/short', 'book-1')
    expect(file).toBeNull()
  })

  it('readBookFile returns null when file not found', async () => {
    mockRoot.getDirectoryHandle.mockRejectedValue(new Error('Not found'))
    const file = await opfsStorageService.readBookFile(
      '/knowlune/books/book-1/book.epub',
      'book-1'
    )
    expect(file).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getStorageEstimate
// ---------------------------------------------------------------------------

describe('OpfsStorageService.getStorageEstimate', () => {
  it('returns usage and quota when available', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: vi.fn(),
        estimate: vi.fn().mockResolvedValue({ usage: 1000, quota: 1_000_000 }),
      },
    })

    const estimate = await opfsStorageService.getStorageEstimate()
    expect(estimate).toEqual({ usage: 1000, quota: 1_000_000 })
  })

  it('returns null when navigator is undefined', async () => {
    vi.stubGlobal('navigator', undefined)
    const estimate = await opfsStorageService.getStorageEstimate()
    expect(estimate).toBeNull()
  })

  it('returns null when estimate throws', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: vi.fn(),
        estimate: vi.fn().mockRejectedValue(new Error('Unavailable')),
      },
    })

    const estimate = await opfsStorageService.getStorageEstimate()
    expect(estimate).toBeNull()
  })

  it('defaults usage/quota to 0 when undefined', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: vi.fn(),
        estimate: vi.fn().mockResolvedValue({}),
      },
    })

    const estimate = await opfsStorageService.getStorageEstimate()
    expect(estimate).toEqual({ usage: 0, quota: 0 })
  })
})
