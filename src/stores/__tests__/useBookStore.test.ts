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
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 't1', tags: ['react', 'js'] }) as never)
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 't2', tags: ['js', 'node'] }) as never)
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

  it('respects source filter when computing counts', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(
        makeBook({
          id: 'lc1',
          status: 'reading',
          source: { type: 'local', opfsPath: '' },
        }) as never
      )
      await useBookStore.getState().importBook(
        makeBook({
          id: 'rc1',
          status: 'reading',
          source: { type: 'remote', url: 'http://abs' },
          absServerId: 'srv-1',
        }) as never
      )
    })

    useBookStore.getState().setFilter('source', 'local')
    const counts = useBookStore.getState().getBookCountByStatus()
    expect(counts.all).toBe(1)
    expect(counts.reading).toBe(1)
  })
})

describe('loadBooks', () => {
  it('loads books from Dexie and sets isLoaded', async () => {
    const { db } = await import('@/db/schema')
    const book = makeBook({ id: 'load-1', title: 'Loaded Book' })
    await db.books.put(book as never)

    await act(async () => {
      await useBookStore.getState().loadBooks()
    })

    const state = useBookStore.getState()
    expect(state.isLoaded).toBe(true)
    expect(state.books).toHaveLength(1)
    expect(state.books[0].title).toBe('Loaded Book')
  })

  it('skips loading if already loaded', async () => {
    const { db } = await import('@/db/schema')
    await db.books.put(makeBook({ id: 'skip-1' }) as never)

    await act(async () => {
      await useBookStore.getState().loadBooks()
    })
    const spy = vi.spyOn(db.books, 'toArray')

    await act(async () => {
      await useBookStore.getState().loadBooks()
    })

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('updateBookPosition', () => {
  it('updates position and progress optimistically', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(makeBook({ id: 'pos-1', progress: 0 }) as never)
    })

    await act(async () => {
      await useBookStore
        .getState()
        .updateBookPosition('pos-1', { type: 'page', pageNumber: 50 }, 50)
    })

    const book = useBookStore.getState().books[0]
    expect(book.progress).toBe(50)
    expect(book.currentPosition).toEqual({ type: 'page', pageNumber: 50 })
  })

  it('persists position to Dexie', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(makeBook({ id: 'pos-2' }) as never)
    })

    await act(async () => {
      await useBookStore
        .getState()
        .updateBookPosition('pos-2', { type: 'cfi', value: 'epubcfi(/6/2)' }, 25)
    })

    const { db } = await import('@/db/schema')
    const record = await db.books.get('pos-2')
    expect(record?.progress).toBe(25)
  })
})

describe('linkBooks', () => {
  it('links two books bidirectionally', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(makeBook({ id: 'link-a', title: 'EPUB' }) as never)
      await useBookStore.getState().importBook(makeBook({ id: 'link-b', title: 'Audio' }) as never)
    })

    await act(async () => {
      await useBookStore.getState().linkBooks('link-a', 'link-b')
    })

    const books = useBookStore.getState().books
    const bookA = books.find(b => b.id === 'link-a')
    const bookB = books.find(b => b.id === 'link-b')
    expect(bookA?.linkedBookId).toBe('link-b')
    expect(bookB?.linkedBookId).toBe('link-a')
  })
})

describe('unlinkBooks', () => {
  it('clears linkedBookId on both books', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(makeBook({ id: 'unl-a' }) as never)
      await useBookStore.getState().importBook(makeBook({ id: 'unl-b' }) as never)
    })

    await act(async () => {
      await useBookStore.getState().linkBooks('unl-a', 'unl-b')
    })
    expect(useBookStore.getState().books.find(b => b.id === 'unl-a')?.linkedBookId).toBe('unl-b')

    await act(async () => {
      await useBookStore.getState().unlinkBooks('unl-a', 'unl-b')
    })

    const books = useBookStore.getState().books
    expect(books.find(b => b.id === 'unl-a')?.linkedBookId).toBeUndefined()
    expect(books.find(b => b.id === 'unl-b')?.linkedBookId).toBeUndefined()
  })
})

describe('upsertAbsBook', () => {
  it('adds new ABS book to store', async () => {
    const absBook = makeBook({
      id: 'abs-1',
      title: 'ABS Book',
      absServerId: 'srv-1',
      absItemId: 'item-1',
      source: { type: 'remote', url: 'http://abs/item/1' },
    })

    await act(async () => {
      await useBookStore.getState().upsertAbsBook(absBook as never)
    })

    expect(useBookStore.getState().books).toHaveLength(1)
    expect(useBookStore.getState().books[0].title).toBe('ABS Book')
  })

  it('merges with existing book preserving local state', async () => {
    const existing = makeBook({
      id: 'abs-2',
      title: 'Old Title',
      status: 'reading',
      progress: 50,
      absServerId: 'srv-1',
      absItemId: 'item-2',
      source: { type: 'remote', url: 'http://abs/item/2' },
    })

    await act(async () => {
      await useBookStore.getState().importBook(existing as never)
    })

    const updated = makeBook({
      id: 'new-id', // Different ID but same absServerId:absItemId
      title: 'New Title from Server',
      status: 'unread', // Should be overridden by existing
      progress: 0, // Should be overridden by existing
      absServerId: 'srv-1',
      absItemId: 'item-2',
      source: { type: 'remote', url: 'http://abs/item/2' },
    })

    await act(async () => {
      await useBookStore.getState().upsertAbsBook(updated as never)
    })

    const books = useBookStore.getState().books
    expect(books).toHaveLength(1)
    // Title updated from server
    expect(books[0].title).toBe('New Title from Server')
    // Status and progress preserved from local
    expect(books[0].status).toBe('reading')
    expect(books[0].progress).toBe(50)
    // ID preserved from existing
    expect(books[0].id).toBe('abs-2')
  })
})

describe('bulkUpsertAbsBooks', () => {
  it('adds multiple ABS books at once', async () => {
    const books = [
      makeBook({
        id: 'bulk-1',
        title: 'Book 1',
        absServerId: 'srv-1',
        absItemId: 'bi-1',
        source: { type: 'remote', url: 'http://abs/1' },
      }),
      makeBook({
        id: 'bulk-2',
        title: 'Book 2',
        absServerId: 'srv-1',
        absItemId: 'bi-2',
        source: { type: 'remote', url: 'http://abs/2' },
      }),
    ]

    await act(async () => {
      await useBookStore.getState().bulkUpsertAbsBooks(books as never[])
    })

    expect(useBookStore.getState().books).toHaveLength(2)
  })

  it('is a no-op for empty array', async () => {
    await act(async () => {
      await useBookStore.getState().bulkUpsertAbsBooks([])
    })

    expect(useBookStore.getState().books).toHaveLength(0)
  })
})

describe('getFilteredBooks — source filter', () => {
  it('filters by audiobookshelf source', async () => {
    await act(async () => {
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'sf-1', source: { type: 'local', opfsPath: '' } }) as never)
      await useBookStore.getState().importBook(
        makeBook({
          id: 'sf-2',
          source: { type: 'remote', url: 'http://abs' },
          absServerId: 'srv-1',
        }) as never
      )
    })

    useBookStore.getState().setFilter('source', 'audiobookshelf')
    const filtered = useBookStore.getState().getFilteredBooks()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('sf-2')
  })

  it('filters by local source', async () => {
    await act(async () => {
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'lf-1', source: { type: 'local', opfsPath: '' } }) as never)
      await useBookStore.getState().importBook(
        makeBook({
          id: 'lf-2',
          source: { type: 'remote', url: 'http://abs' },
          absServerId: 'srv-1',
        }) as never
      )
    })

    useBookStore.getState().setFilter('source', 'local')
    const filtered = useBookStore.getState().getFilteredBooks()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('lf-1')
  })

  it('filters by search term matching narrator', async () => {
    await act(async () => {
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'n1', title: 'Book', narrator: 'John Smith' }) as never)
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'n2', title: 'Book', narrator: 'Jane Doe' }) as never)
    })

    useBookStore.getState().setFilter('search', 'john')
    const filtered = useBookStore.getState().getFilteredBooks()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('n1')
  })
})

describe('setLibraryView', () => {
  it('switches between grid and list', () => {
    useBookStore.getState().setLibraryView('list')
    expect(useBookStore.getState().libraryView).toBe('list')

    useBookStore.getState().setLibraryView('grid')
    expect(useBookStore.getState().libraryView).toBe('grid')
  })
})

describe('setFilters', () => {
  it('replaces all filters at once', () => {
    useBookStore.getState().setFilters({ status: 'reading', search: 'test' })

    expect(useBookStore.getState().filters).toEqual({ status: 'reading', search: 'test' })
  })
})

describe('getBooksBySeries', () => {
  it('groups books by series name', async () => {
    await act(async () => {
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'gs-1', series: 'Dune', seriesSequence: '1' }) as never)
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'gs-2', series: 'Dune', seriesSequence: '2' }) as never)
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'gs-3', series: 'Foundation', seriesSequence: '1' }) as never)
    })

    const { groups, ungrouped } = useBookStore.getState().getBooksBySeries()

    expect(groups).toHaveLength(2)
    const duneGroup = groups.find(g => g.name === 'Dune')
    expect(duneGroup?.books).toHaveLength(2)
    expect(duneGroup?.total).toBe(2)
    expect(ungrouped).toHaveLength(0)
  })

  it('sorts books within a series by numeric sequence', async () => {
    await act(async () => {
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'seq-3', series: 'TestSeries', seriesSequence: '3' }) as never)
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'seq-1', series: 'TestSeries', seriesSequence: '1' }) as never)
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'seq-2', series: 'TestSeries', seriesSequence: '2' }) as never)
    })

    const { groups } = useBookStore.getState().getBooksBySeries()
    const [group] = groups
    expect(group.books.map(b => b.id)).toEqual(['seq-1', 'seq-2', 'seq-3'])
  })

  it('falls back to localeCompare for non-numeric sequences', async () => {
    await act(async () => {
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'nc-b', series: 'Letters', seriesSequence: 'beta' }) as never)
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'nc-a', series: 'Letters', seriesSequence: 'alpha' }) as never)
    })

    const { groups } = useBookStore.getState().getBooksBySeries()
    const [group] = groups
    // 'alpha' < 'beta' alphabetically
    expect(group.books[0].id).toBe('nc-a')
    expect(group.books[1].id).toBe('nc-b')
  })

  it('puts books without series into ungrouped', async () => {
    await act(async () => {
      await useBookStore
        .getState()
        .importBook(makeBook({ id: 'ug-1', series: 'MySeries' }) as never)
      await useBookStore.getState().importBook(makeBook({ id: 'ug-2' }) as never) // no series
      await useBookStore.getState().importBook(makeBook({ id: 'ug-3' }) as never) // no series
    })

    const { groups, ungrouped } = useBookStore.getState().getBooksBySeries()

    expect(groups).toHaveLength(1)
    expect(ungrouped).toHaveLength(2)
    expect(ungrouped.map(b => b.id).sort()).toEqual(['ug-2', 'ug-3'])
  })

  it('computes completed count and nextUnfinishedId correctly', async () => {
    await act(async () => {
      await useBookStore.getState().importBook(
        makeBook({
          id: 'cu-1',
          series: 'MySeries',
          seriesSequence: '1',
          status: 'finished',
          progress: 100,
        }) as never
      )
      await useBookStore.getState().importBook(
        makeBook({
          id: 'cu-2',
          series: 'MySeries',
          seriesSequence: '2',
          status: 'reading',
          progress: 40,
        }) as never
      )
      await useBookStore.getState().importBook(
        makeBook({
          id: 'cu-3',
          series: 'MySeries',
          seriesSequence: '3',
          status: 'unread',
          progress: 0,
        }) as never
      )
    })

    const { groups } = useBookStore.getState().getBooksBySeries()
    const [group] = groups

    expect(group.completed).toBe(1)
    expect(group.total).toBe(3)
    // cu-1 is finished; cu-2 is next unfinished (first in sequence order)
    expect(group.nextUnfinishedId).toBe('cu-2')
  })
})
