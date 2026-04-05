/**
 * Unit tests for useBookStore — book library Zustand store.
 *
 * Tests importBook, deleteBook, updateBookStatus, updateBookMetadata,
 * getFilteredBooks, getAllTags, and getBookCountByStatus.
 *
 * @since E83-S01
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'

// Mock OPFS service — OPFS is not available in Node/jsdom
vi.mock('@/services/OpfsStorageService', () => ({
  opfsStorageService: {
    storeBookFile: vi.fn().mockResolvedValue('/knowlune/books/test-id/book.epub'),
    deleteBookFiles: vi.fn().mockResolvedValue(undefined),
    getStorageEstimate: vi.fn().mockResolvedValue({ usage: 100_000, quota: 1_000_000 }),
    readBookFile: vi.fn().mockResolvedValue(null),
    storeCoverFile: vi.fn().mockResolvedValue('/knowlune/books/test-id/cover.jpg'),
    getCoverUrl: vi.fn().mockResolvedValue(null),
  },
}))

// Mock progressive disclosure
vi.mock('@/app/hooks/useProgressiveDisclosure', () => ({
  unlockSidebarItem: vi.fn(),
}))

// Mock event bus
vi.mock('@/lib/eventBus', () => ({
  appEventBus: { emit: vi.fn() },
}))

let useBookStore: (typeof import('@/stores/useBookStore'))['useBookStore']

function makeBook(overrides: Record<string, unknown> = {}) {
  return {
    id: `book-${Math.random().toString(36).slice(2)}`,
    title: 'Test Book',
    author: 'Test Author',
    format: 'epub',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '' },
    coverUrl: '',
    progress: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  // Re-apply mocks after module reset
  vi.doMock('@/services/OpfsStorageService', () => ({
    opfsStorageService: {
      storeBookFile: vi.fn().mockResolvedValue('/knowlune/books/test-id/book.epub'),
      deleteBookFiles: vi.fn().mockResolvedValue(undefined),
      getStorageEstimate: vi.fn().mockResolvedValue({ usage: 100_000, quota: 1_000_000 }),
      readBookFile: vi.fn().mockResolvedValue(null),
      storeCoverFile: vi.fn().mockResolvedValue('/knowlune/books/test-id/cover.jpg'),
      getCoverUrl: vi.fn().mockResolvedValue(null),
    },
  }))
  vi.doMock('@/app/hooks/useProgressiveDisclosure', () => ({
    unlockSidebarItem: vi.fn(),
  }))
  vi.doMock('@/lib/eventBus', () => ({
    appEventBus: { emit: vi.fn() },
  }))
  const mod = await import('@/stores/useBookStore')
  useBookStore = mod.useBookStore
})

describe('useBookStore initial state', () => {
  it('starts with empty books and isLoaded false', () => {
    const state = useBookStore.getState()
    expect(state.books).toEqual([])
    expect(state.isLoaded).toBe(false)
    expect(state.libraryView).toBe('grid')
  })
})

describe('importBook', () => {
  it('adds a book to the store and persists to Dexie', async () => {
    const book = makeBook({ id: 'import-1', title: 'Imported Book' })

    await act(async () => {
      await useBookStore.getState().importBook(book as never)
    })

    const state = useBookStore.getState()
    expect(state.books).toHaveLength(1)
    expect(state.books[0].title).toBe('Imported Book')

    // Verify Dexie persistence
    const { db } = await import('@/db/schema')
    const all = await db.books.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('import-1')
  })

  it('prevents duplicate IDs in memory', async () => {
    const book = makeBook({ id: 'dup-1', title: 'First' })

    await act(async () => {
      await useBookStore.getState().importBook(book as never)
    })

    const updated = makeBook({ id: 'dup-1', title: 'Updated' })
    await act(async () => {
      await useBookStore.getState().importBook(updated as never)
    })

    expect(useBookStore.getState().books).toHaveLength(1)
    expect(useBookStore.getState().books[0].title).toBe('Updated')
  })
})

describe('deleteBook', () => {
  it('removes book from store and Dexie', async () => {
    const book = makeBook({ id: 'del-1', title: 'To Delete' })

    await act(async () => {
      await useBookStore.getState().importBook(book as never)
    })
    expect(useBookStore.getState().books).toHaveLength(1)

    await act(async () => {
      await useBookStore.getState().deleteBook('del-1')
    })

    expect(useBookStore.getState().books).toHaveLength(0)

    const { db } = await import('@/db/schema')
    const all = await db.books.toArray()
    expect(all).toHaveLength(0)
  })

  it('is a no-op for non-existent book ID', async () => {
    await act(async () => {
      await useBookStore.getState().deleteBook('nonexistent')
    })
    expect(useBookStore.getState().books).toHaveLength(0)
  })

  it('clears selectedBookId when deleting selected book', async () => {
    const book = makeBook({ id: 'sel-1' })

    await act(async () => {
      await useBookStore.getState().importBook(book as never)
      useBookStore.getState().setSelectedBookId('sel-1')
    })

    expect(useBookStore.getState().selectedBookId).toBe('sel-1')

    await act(async () => {
      await useBookStore.getState().deleteBook('sel-1')
    })

    expect(useBookStore.getState().selectedBookId).toBeNull()
  })
})

describe('updateBookStatus', () => {
  it('updates status optimistically in store', async () => {
    const book = makeBook({ id: 'status-1', status: 'unread' })

    await act(async () => {
      await useBookStore.getState().importBook(book as never)
    })

    await act(async () => {
      await useBookStore.getState().updateBookStatus('status-1', 'reading')
    })

    expect(useBookStore.getState().books[0].status).toBe('reading')

    const { db } = await import('@/db/schema')
    const record = await db.books.get('status-1')
    expect(record?.status).toBe('reading')
  })
})

describe('updateBookMetadata', () => {
  it('updates title and author', async () => {
    const book = makeBook({ id: 'meta-1', title: 'Old', author: 'Old Author' })

    await act(async () => {
      await useBookStore.getState().importBook(book as never)
    })

    await act(async () => {
      await useBookStore.getState().updateBookMetadata('meta-1', {
        title: 'New Title',
        author: 'New Author',
      })
    })

    const updated = useBookStore.getState().books[0]
    expect(updated.title).toBe('New Title')
    expect(updated.author).toBe('New Author')
  })

  it('is a no-op for non-existent book', async () => {
    await act(async () => {
      await useBookStore.getState().updateBookMetadata('nope', { title: 'X' })
    })
    expect(useBookStore.getState().books).toHaveLength(0)
  })
})

describe('getFilteredBooks', () => {
  it('filters by status', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(makeBook({ id: 'f1', status: 'reading' }) as never)
      await useBookStore.getState().importBook(makeBook({ id: 'f2', status: 'finished' }) as never)
    })

    useBookStore.getState().setFilter('status', 'reading')
    const filtered = useBookStore.getState().getFilteredBooks()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('f1')
  })

  it('filters by search term (title)', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(makeBook({ id: 's1', title: 'TypeScript' }) as never)
      await useBookStore.getState().importBook(makeBook({ id: 's2', title: 'Python' }) as never)
    })

    useBookStore.getState().setFilter('search', 'type')
    const filtered = useBookStore.getState().getFilteredBooks()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('s1')
  })

  it('returns all books when status is "all"', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(makeBook({ id: 'a1', status: 'reading' }) as never)
      await useBookStore.getState().importBook(makeBook({ id: 'a2', status: 'finished' }) as never)
    })

    useBookStore.getState().setFilter('status', 'all')
    expect(useBookStore.getState().getFilteredBooks()).toHaveLength(2)
  })
})

describe('getAllTags', () => {
  it('returns sorted unique tags', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(makeBook({ id: 't1', tags: ['react', 'js'] }) as never)
      await useBookStore.getState().importBook(makeBook({ id: 't2', tags: ['js', 'node'] }) as never)
    })

    expect(useBookStore.getState().getAllTags()).toEqual(['js', 'node', 'react'])
  })
})

describe('getBookCountByStatus', () => {
  it('returns counts per status plus all', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(makeBook({ id: 'c1', status: 'reading' }) as never)
      await useBookStore.getState().importBook(makeBook({ id: 'c2', status: 'reading' }) as never)
      await useBookStore.getState().importBook(makeBook({ id: 'c3', status: 'finished' }) as never)
    })

    const counts = useBookStore.getState().getBookCountByStatus()
    expect(counts.all).toBe(3)
    expect(counts.reading).toBe(2)
    expect(counts.finished).toBe(1)
  })
})
