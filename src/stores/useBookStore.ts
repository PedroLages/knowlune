/**
 * Zustand store for book library management.
 *
 * Manages books state with Dexie persistence and OPFS file storage.
 * Follows the same pattern as useCourseStore.ts — create<State>((set, get) => ({...}))
 * with isLoaded guard.
 *
 * @module useBookStore
 * @since E83-S01
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { Book, BookStatus } from '@/data/types'
import { db } from '@/db/schema'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { appEventBus } from '@/lib/eventBus'
import { unlockSidebarItem } from '@/app/hooks/useProgressiveDisclosure'

export interface BookFilters {
  status?: BookStatus | 'all'
  search?: string
  source?: 'all' | 'local' | 'audiobookshelf'
}

interface BookStoreState {
  books: Book[]
  selectedBookId: string | null
  libraryView: 'grid' | 'list'
  filters: BookFilters
  isLoaded: boolean

  loadBooks: () => Promise<void>
  importBook: (book: Book, file?: File) => Promise<void>
  updateBookStatus: (bookId: string, status: BookStatus) => Promise<void>
  deleteBook: (bookId: string) => Promise<void>
  setSelectedBookId: (id: string | null) => void
  setLibraryView: (view: 'grid' | 'list') => void
  setFilters: (filters: BookFilters) => void
  setFilter: (key: keyof BookFilters, value: string | undefined) => void
  getFilteredBooks: () => Book[]
  updateBookMetadata: (
    bookId: string,
    updates: Partial<Pick<Book, 'title' | 'author' | 'isbn' | 'description' | 'tags' | 'coverUrl'>>
  ) => Promise<void>
  updateBookPosition: (
    bookId: string,
    position: import('@/data/types').ContentPosition,
    progress: number
  ) => Promise<void>
  linkBooks: (bookIdA: string, bookIdB: string) => Promise<void>
  upsertAbsBook: (book: Book) => Promise<void>
  bulkUpsertAbsBooks: (books: Book[]) => Promise<void>
  getAllTags: () => string[]
  getBookCountByStatus: () => Record<'all' | BookStatus, number>
}

export const useBookStore = create<BookStoreState>((set, get) => ({
  books: [],
  selectedBookId: null,
  libraryView: 'grid',
  filters: {},
  isLoaded: false,

  loadBooks: async () => {
    if (get().isLoaded) return
    const books = await db.books.toArray()
    set({ books, isLoaded: true })
  },

  importBook: async (book: Book, file?: File) => {
    try {
      // Store file if provided
      if (file) {
        const path = await opfsStorageService.storeBookFile(book.id, file)
        if (path === 'indexeddb') {
          book = { ...book, source: { type: 'local', opfsPath: 'indexeddb' } }
        } else {
          book = { ...book, source: { type: 'local', opfsPath: path } }
        }
      }

      await db.books.put(book)

      // Filter-then-append to prevent duplicate IDs in memory
      set(state => ({
        books: [...state.books.filter(b => b.id !== book.id), book],
      }))

      // Unlock sidebar item
      unlockSidebarItem('book-imported')

      // Emit event
      appEventBus.emit({ type: 'book:imported', bookId: book.id, title: book.title })
    } catch {
      toast.error('Failed to import book')
    }
  },

  updateBookStatus: async (bookId: string, status: BookStatus) => {
    const finishedAt = status === 'finished' ? new Date().toISOString() : undefined
    const updates: Partial<{ status: BookStatus; finishedAt: string }> = { status }
    if (finishedAt) updates.finishedAt = finishedAt

    // Optimistic update
    set(state => ({
      books: state.books.map(b => (b.id === bookId ? { ...b, ...updates } : b)),
    }))

    try {
      await db.books.update(bookId, updates)
      // Emit book:finished so reading goal store can check yearly goal
      if (status === 'finished' && finishedAt) {
        appEventBus.emit({ type: 'book:finished', bookId, finishedAt })
      }
    } catch {
      // Rollback on failure — reload from DB
      const books = await db.books.toArray()
      set({ books })
      toast.error('Failed to update book status')
    }
  },

  deleteBook: async (bookId: string) => {
    // Guard against double-delete
    const book = get().books.find(b => b.id === bookId)
    if (!book) return

    const title = book.title

    // Optimistic removal from local state
    set(state => ({
      books: state.books.filter(b => b.id !== bookId),
      selectedBookId: state.selectedBookId === bookId ? null : state.selectedBookId,
    }))

    try {
      // Cascade deletion order: highlights → book record → OPFS files (best-effort)
      await db.bookHighlights.where('bookId').equals(bookId).delete()
      await db.books.delete(bookId)

      // OPFS cleanup is best-effort — partial cleanup is acceptable (AC4)
      try {
        await opfsStorageService.deleteBookFiles(bookId)
      } catch {
        // silent-catch-ok: OPFS failure is non-fatal — Dexie records already cleaned
        toast.warning('Book removed but some files may not have been cleaned up')
      }

      toast.success(`${title} removed from your library`)
      appEventBus.emit({ type: 'book:deleted', bookId })
    } catch {
      // Dexie failure — rollback optimistic update
      const books = await db.books.toArray()
      set({ books })
      toast.error('Failed to delete book')
    }
  },

  setSelectedBookId: (id: string | null) => set({ selectedBookId: id }),
  setLibraryView: (view: 'grid' | 'list') => set({ libraryView: view }),
  setFilters: (filters: BookFilters) => set({ filters }),
  setFilter: (key, value) =>
    set(state => ({
      filters: {
        ...state.filters,
        // 'all' is the UI sentinel meaning "no filter" — store as undefined so
        // getFilteredBooks() doesn't need to special-case it
        [key]: value === 'all' ? undefined : value,
      },
    })),

  getFilteredBooks: () => {
    const { books, filters } = get()
    let result = books

    // Source filter (applied first)
    if (filters.source === 'audiobookshelf') {
      result = result.filter(b => b.source.type === 'remote' && !!b.absServerId)
    } else if (filters.source === 'local') {
      result = result.filter(b => b.source.type === 'local' || b.source.type === 'fileHandle')
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      result = result.filter(b => b.status === filters.status)
    }

    // Search filter (includes narrator)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(
        b =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.narrator?.toLowerCase().includes(q) ?? false)
      )
    }
    return result
  },

  updateBookMetadata: async (bookId, updates) => {
    const prev = get().books.find(b => b.id === bookId)
    if (!prev) return

    const merged = { ...prev, ...updates, updatedAt: new Date().toISOString() }

    // Optimistic update
    set(state => ({
      books: state.books.map(b => (b.id === bookId ? merged : b)),
    }))

    try {
      await db.books.update(bookId, { ...updates, updatedAt: merged.updatedAt })
      toast.success('Book details updated')
    } catch {
      // Rollback on failure — reload from DB
      const books = await db.books.toArray()
      set({ books })
      toast.error('Failed to update book details')
    }
  },

  updateBookPosition: async (bookId, position, progress) => {
    const now = new Date().toISOString()
    // Capture previous state for targeted rollback
    const prevBook = get().books.find(b => b.id === bookId)
    // Optimistic Zustand update
    set(state => ({
      books: state.books.map(b =>
        b.id === bookId ? { ...b, currentPosition: position, progress, lastOpenedAt: now } : b
      ),
    }))
    try {
      await db.books.update(bookId, {
        currentPosition: position,
        progress,
        lastOpenedAt: now,
      } as Parameters<typeof db.books.update>[1])
    } catch (err) {
      console.error('[BookStore] Failed to update position:', err)
      // Rollback only the affected book using captured previous state
      if (prevBook) {
        set(state => ({
          books: state.books.map(b => (b.id === bookId ? prevBook : b)),
        }))
      }
      toast.error('Failed to save reading position')
    }
  },

  linkBooks: async (bookIdA, bookIdB) => {
    const now = new Date().toISOString()
    // Capture previous state for targeted rollback
    const prevBookA = get().books.find(b => b.id === bookIdA)
    const prevBookB = get().books.find(b => b.id === bookIdB)
    // Optimistic update: set linkedBookId on both books
    set(state => ({
      books: state.books.map(b => {
        if (b.id === bookIdA) return { ...b, linkedBookId: bookIdB, updatedAt: now }
        if (b.id === bookIdB) return { ...b, linkedBookId: bookIdA, updatedAt: now }
        return b
      }),
    }))
    try {
      // Wrap both updates in a single transaction for atomicity
      await db.transaction('rw', db.books, async () => {
        await db.books.update(bookIdA, { linkedBookId: bookIdB, updatedAt: now } as Parameters<
          typeof db.books.update
        >[1])
        await db.books.update(bookIdB, { linkedBookId: bookIdA, updatedAt: now } as Parameters<
          typeof db.books.update
        >[1])
      })
    } catch (err) {
      console.error('[BookStore] Failed to link books:', err)
      // Rollback only the affected books using captured previous state
      set(state => ({
        books: state.books.map(b => {
          if (b.id === bookIdA && prevBookA) return prevBookA
          if (b.id === bookIdB && prevBookB) return prevBookB
          return b
        }),
      }))
      toast.error('Failed to link book formats')
    }
  },

  upsertAbsBook: async (book: Book) => {
    try {
      // Build Map for O(1) lookup instead of linear scan
      const absKeyMap = new Map<string, Book>()
      for (const b of get().books) {
        if (b.absServerId && b.absItemId) {
          absKeyMap.set(`${b.absServerId}:${b.absItemId}`, b)
        }
      }
      const existing = absKeyMap.get(`${book.absServerId}:${book.absItemId}`)
      const merged: Book = existing
        ? {
            ...book,
            id: existing.id,
            status: existing.status,
            progress: existing.progress,
            currentPosition: existing.currentPosition,
            lastOpenedAt: existing.lastOpenedAt,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
          }
        : book

      await db.books.put(merged)
      set(state => ({
        books: [...state.books.filter(b => b.id !== merged.id), merged],
      }))
    } catch {
      toast.error('Failed to sync audiobook from server')
    }
  },

  bulkUpsertAbsBooks: async (newBooks: Book[]) => {
    if (newBooks.length === 0) return
    try {
      // Build Map<absServerId:absItemId, Book> for O(1) dedup lookup
      const absKeyMap = new Map<string, Book>()
      for (const b of get().books) {
        if (b.absServerId && b.absItemId) {
          absKeyMap.set(`${b.absServerId}:${b.absItemId}`, b)
        }
      }

      const mergedBooks: Book[] = newBooks.map(book => {
        const existing = absKeyMap.get(`${book.absServerId}:${book.absItemId}`)
        return existing
          ? {
              ...book,
              id: existing.id,
              status: existing.status,
              progress: existing.progress,
              currentPosition: existing.currentPosition,
              lastOpenedAt: existing.lastOpenedAt,
              createdAt: existing.createdAt,
              updatedAt: new Date().toISOString(),
            }
          : book
      })

      // Single bulk IDB write instead of N individual puts
      await db.books.bulkPut(mergedBooks)

      // Single state update instead of N re-renders
      const mergedIds = new Set(mergedBooks.map(b => b.id))
      set(state => ({
        books: [...state.books.filter(b => !mergedIds.has(b.id)), ...mergedBooks],
      }))
    } catch {
      toast.error('Failed to sync audiobooks from server')
    }
  },

  getAllTags: () => {
    const { books } = get()
    const tagSet = new Set<string>()
    for (const b of books) {
      for (const t of b.tags) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
  },

  getBookCountByStatus: () => {
    const { books, filters } = get()
    // Respect current source filter when computing status counts
    let filtered = books
    if (filters.source === 'audiobookshelf') {
      filtered = filtered.filter(b => b.source.type === 'remote' && !!b.absServerId)
    } else if (filters.source === 'local') {
      filtered = filtered.filter(b => b.source.type === 'local' || b.source.type === 'fileHandle')
    }
    const counts: Record<string, number> = { all: filtered.length }
    for (const b of filtered) {
      counts[b.status] = (counts[b.status] || 0) + 1
    }
    return counts as Record<'all' | BookStatus, number>
  },
}))
