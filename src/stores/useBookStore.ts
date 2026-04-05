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
import type { Book, BookStatus } from '@/data/types'
import { db } from '@/db/schema'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { appEventBus } from '@/lib/eventBus'
import { unlockSidebarItem } from '@/app/hooks/useProgressiveDisclosure'

interface BookFilters {
  status?: BookStatus
  search?: string
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
    // Store file if provided
    if (file) {
      const path = await opfsStorageService.storeBookFile(book.id, file)
      if (path !== 'indexeddb') {
        book = { ...book, source: { type: 'local', opfsPath: path } }
      }
    }

    await db.books.put(book)

    set(state => ({ books: [...state.books, book] }))

    // Unlock sidebar item
    unlockSidebarItem('book-imported')

    // Emit event
    appEventBus.emit({ type: 'book:imported', bookId: book.id, title: book.title })
  },

  updateBookStatus: async (bookId: string, status: BookStatus) => {
    // Optimistic update
    set(state => ({
      books: state.books.map(b => (b.id === bookId ? { ...b, status } : b)),
    }))

    try {
      await db.books.update(bookId, { status })
    } catch {
      // Rollback on failure — reload from DB
      const books = await db.books.toArray()
      set({ books })
    }
  },

  deleteBook: async (bookId: string) => {
    // Remove from state first
    set(state => ({
      books: state.books.filter(b => b.id !== bookId),
      selectedBookId: state.selectedBookId === bookId ? null : state.selectedBookId,
    }))

    // Clean up storage and DB
    await opfsStorageService.deleteBookFiles(bookId)
    await db.bookHighlights.where('bookId').equals(bookId).delete()
    await db.books.delete(bookId)

    appEventBus.emit({ type: 'book:deleted', bookId })
  },

  setSelectedBookId: (id: string | null) => set({ selectedBookId: id }),
  setLibraryView: (view: 'grid' | 'list') => set({ libraryView: view }),
  setFilters: (filters: BookFilters) => set({ filters }),
}))
