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
import type { Book, BookStatus, ContentSource, LocalSeriesGroup } from '@/data/types'
import { db } from '@/db/schema'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { useShelfStore } from '@/stores/useShelfStore'
import { useReadingQueueStore } from '@/stores/useReadingQueueStore'
import { appEventBus } from '@/lib/eventBus'
import { unlockSidebarItem } from '@/app/hooks/useProgressiveDisclosure'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import type { SyncableRecord } from '@/lib/sync/syncableWrite'
import { useAuthStore, selectIsGuestMode } from '@/stores/useAuthStore'

/**
 * Decomposes the Book.source discriminated union into flat serializable fields
 * for Supabase upload. The `source` field itself is stripped from the upload
 * payload by the table registry (E94-S02).
 */
function decomposeSource(source: ContentSource): { sourceType: string; sourceUrl: string | null } {
  if (source.type === 'remote') {
    return { sourceType: 'remote', sourceUrl: source.url }
  }
  if (source.type === 'fileHandle') {
    // FileSystemFileHandle is non-serializable — URL is not available
    return { sourceType: 'fileHandle', sourceUrl: null }
  }
  // 'local' — opfsPath is a local path, not a network URL
  return { sourceType: 'local', sourceUrl: null }
}

export type SortOption = 'recent' | 'title-asc' | 'author-asc' | 'progress' | 'duration'

export interface BookFilters {
  status?: BookStatus | 'all'
  search?: string
  source?: 'all' | 'local' | 'audiobookshelf'
  sort?: SortOption
  format?: string[] // multi-select format filter (e.g. ['audiobook', 'epub'])
  authors?: string[] // multi-select author filter
  genre?: string // genre filter (E108-S05)
  shelfId?: string // shelf filter (E110-S01)
}

interface BookStoreState {
  books: Book[]
  selectedBookId: string | null
  libraryView: 'grid' | 'list'
  localSeriesView: boolean
  filters: BookFilters
  isLoaded: boolean

  loadBooks: () => Promise<void>
  importBook: (book: Book, file?: File) => Promise<{ error?: { code: string; modality: string } }>
  updateBookStatus: (bookId: string, status: BookStatus) => Promise<void>
  deleteBook: (bookId: string) => Promise<void>
  setSelectedBookId: (id: string | null) => void
  setLibraryView: (view: 'grid' | 'list') => void
  setLocalSeriesView: (value: boolean) => void
  setFilters: (filters: BookFilters) => void
  setFilter: (key: keyof BookFilters, value: string | string[] | undefined) => void
  getFilteredBooks: () => Book[]
  updateBookMetadata: (
    bookId: string,
    updates: Partial<
      Pick<
        Book,
        | 'title'
        | 'author'
        | 'isbn'
        | 'asin'
        | 'narrator'
        | 'description'
        | 'tags'
        | 'coverUrl'
        | 'genre'
        | 'series'
        | 'seriesSequence'
      >
    >
  ) => Promise<void>
  updateBookPosition: (
    bookId: string,
    position: import('@/data/types').ContentPosition,
    progress?: number
  ) => Promise<void>
  updateBookLastOpenedAt: (bookId: string, lastOpenedAt?: string) => Promise<void>
  updateBookPlaybackSpeed: (bookId: string, speed: number) => Promise<void>
  linkBooks: (bookIdA: string, bookIdB: string) => Promise<void>
  unlinkBooks: (bookIdA: string, bookIdB: string) => Promise<void>
  upsertAbsBook: (book: Book) => Promise<void>
  bulkUpsertAbsBooks: (books: Book[]) => Promise<{ removedCount: number }>
  getAllTags: () => string[]
  getAllAuthors: () => string[]
  getBookCountByStatus: () => Record<'all' | BookStatus, number>
  getBooksBySeries: () => { groups: LocalSeriesGroup[]; ungrouped: Book[] }
}

export const useBookStore = create<BookStoreState>((set, get) => ({
  books: [],
  selectedBookId: null,
  libraryView: 'grid',
  localSeriesView: false,
  filters: {},
  isLoaded: false,

  loadBooks: async () => {
    if (get().isLoaded) return
    const books = await db.books.toArray()
    set({ books, isLoaded: true })
  },

  importBook: async (book: Book, file?: File) => {
    // Guest cap: 1 audiobook and 1 EPUB per guest session
    if (selectIsGuestMode(useAuthStore.getState())) {
      const guestSessionId = sessionStorage.getItem('knowlune-guest-id')
      const modality = book.format === 'epub' ? 'epub' : 'audiobook'
      const existing = await db.books
        .filter(r => r.userId === null && r.guestSessionId === guestSessionId && r.format === book.format)
        .count()
      if (existing >= 1) return { error: { code: 'GUEST_CAP_EXCEEDED', modality } }
    }

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

      // Decompose source union into flat serializable fields before upload (E94-S02)
      const { sourceType, sourceUrl } = decomposeSource(book.source)
      const bookWithFlats: Book = { ...book, sourceType, sourceUrl }
      // Use 'put' (upsert) to match original db.books.put() semantics — importBook
      // is called for both initial import and re-import of the same book ID.
      await syncableWrite('books', 'put', bookWithFlats as unknown as SyncableRecord)

      // Filter-then-append to prevent duplicate IDs in memory
      set(state => ({
        books: [...state.books.filter(b => b.id !== book.id), bookWithFlats],
      }))

      // Unlock sidebar item
      unlockSidebarItem('book-imported')

      // Emit event
      appEventBus.emit({ type: 'book:imported', bookId: book.id, title: book.title })
    } catch {
      toast.error('Failed to import book')
    }
    return {}
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
      const current = await db.books.get(bookId)
      if (current) {
        await syncableWrite('books', 'put', { ...current, ...updates } as unknown as SyncableRecord)
      }
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
      // Cascade deletion order: shelf entries → queue entries → highlights → book record → OPFS files (best-effort)
      // intentional cross-store cascade — shelf/queue cleanup on book delete
      await useShelfStore.getState().removeAllBookEntries(bookId)
      await useReadingQueueStore.getState().removeAllBookEntries(bookId)
      // bookHighlights are wired separately by useHighlightStore (E93-S06) — direct Dexie call is correct here
      await db.bookHighlights.where('bookId').equals(bookId).delete()
      await syncableWrite('books', 'delete', bookId)

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
  setLocalSeriesView: (value: boolean) => set({ localSeriesView: value }),
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
          (b.author ?? '').toLowerCase().includes(q) ||
          (b.narrator?.toLowerCase().includes(q) ?? false)
      )
    }

    // Format filter
    if (filters.format && filters.format.length > 0) {
      result = result.filter(b => filters.format!.includes(b.format))
    }

    // Author filter
    if (filters.authors && filters.authors.length > 0) {
      const authorSet = new Set(filters.authors.map(a => a.toLowerCase()))
      result = result.filter(b => authorSet.has((b.author ?? '').toLowerCase()))
    }

    // Genre filter (E108-S05)
    if (filters.genre) {
      if (filters.genre === 'Unset') {
        result = result.filter(b => !b.genre)
      } else {
        result = result.filter(b => b.genre === filters.genre)
      }
    }

    // Shelf filter (E110-S01)
    if (filters.shelfId) {
      const bookIds = new Set(useShelfStore.getState().getBooksOnShelf(filters.shelfId))
      result = result.filter(b => bookIds.has(b.id))
    }

    // Sort
    const sortKey = filters.sort || 'recent'
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case 'title-asc':
          return a.title.localeCompare(b.title)
        case 'author-asc':
          return (a.author ?? '').localeCompare(b.author ?? '')
        case 'progress':
          return (b.progress ?? 0) - (a.progress ?? 0)
        case 'duration':
          return (b.totalDuration ?? 0) - (a.totalDuration ?? 0)
        case 'recent':
        default: {
          const dateA = a.lastOpenedAt || a.createdAt || ''
          const dateB = b.lastOpenedAt || b.createdAt || ''
          return dateB.localeCompare(dateA)
        }
      }
    })

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
      await syncableWrite('books', 'put', merged as unknown as SyncableRecord)
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
    const nextProgress = progress ?? prevBook?.progress
    // Optimistic Zustand update
    set(state => ({
      books: state.books.map(b =>
        b.id === bookId
          ? {
              ...b,
              currentPosition: position,
              ...(nextProgress !== undefined && { progress: nextProgress }),
              lastOpenedAt: now,
            }
          : b
      ),
    }))
    try {
      const current = await db.books.get(bookId)
      if (current) {
        await syncableWrite('books', 'put', {
          ...current,
          currentPosition: position,
          ...(nextProgress !== undefined && { progress: nextProgress }),
          lastOpenedAt: now,
        } as unknown as SyncableRecord)
      }
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

  updateBookLastOpenedAt: async (bookId, lastOpenedAt) => {
    const now = lastOpenedAt ?? new Date().toISOString()
    const prevBook = get().books.find(b => b.id === bookId)

    set(state => ({
      books: state.books.map(b => (b.id === bookId ? { ...b, lastOpenedAt: now } : b)),
    }))

    try {
      const current = await db.books.get(bookId)
      if (current) {
        await syncableWrite('books', 'put', { ...current, lastOpenedAt: now } as unknown as SyncableRecord)
      }
    } catch (err) {
      console.error('[BookStore] Failed to update lastOpenedAt:', err)
      if (prevBook) {
        set(state => ({
          books: state.books.map(b => (b.id === bookId ? prevBook : b)),
        }))
      }
    }
  },

  updateBookPlaybackSpeed: async (bookId, speed) => {
    if (!isFinite(speed) || speed < 0.5 || speed > 3.0) {
      console.error('[BookStore] Invalid playback speed rejected:', speed)
      return
    }
    const now = new Date().toISOString()
    const prevBook = get().books.find(b => b.id === bookId)
    // Optimistic update
    set(state => ({
      books: state.books.map(b =>
        b.id === bookId ? { ...b, playbackSpeed: speed, updatedAt: now } : b
      ),
    }))
    try {
      const current = await db.books.get(bookId)
      if (current) {
        // skipQueue: true — playback speed is a high-churn preference with low sync value.
        // Dexie is updated locally without creating a sync queue entry.
        await syncableWrite(
          'books',
          'put',
          { ...current, playbackSpeed: speed, updatedAt: now } as unknown as SyncableRecord,
          { skipQueue: true }
        )
      }
    } catch (err) {
      console.error('[BookStore] Failed to save playback speed:', err)
      // Rollback only the affected book
      if (prevBook) {
        set(state => ({
          books: state.books.map(b => (b.id === bookId ? prevBook : b)),
        }))
      }
      toast.error('Failed to save playback speed')
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
      // Sequential syncableWrite — each book gets its own queue entry.
      // Atomicity across both books is sacrificed; each link update is individually
      // meaningful so partial success is acceptable (E94-S02 tradeoff).
      const currentA = await db.books.get(bookIdA)
      const currentB = await db.books.get(bookIdB)
      if (currentA) {
        await syncableWrite('books', 'put', {
          ...currentA,
          linkedBookId: bookIdB,
          updatedAt: now,
        } as unknown as SyncableRecord)
      }
      if (currentB) {
        await syncableWrite('books', 'put', {
          ...currentB,
          linkedBookId: bookIdA,
          updatedAt: now,
        } as unknown as SyncableRecord)
      }
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

  unlinkBooks: async (bookIdA, bookIdB) => {
    const now = new Date().toISOString()
    // Capture previous state for targeted rollback
    const prevBookA = get().books.find(b => b.id === bookIdA)
    const prevBookB = get().books.find(b => b.id === bookIdB)
    // Optimistic update: clear linkedBookId on both books
    set(state => ({
      books: state.books.map(b => {
        if (b.id === bookIdA) return { ...b, linkedBookId: undefined, updatedAt: now }
        if (b.id === bookIdB) return { ...b, linkedBookId: undefined, updatedAt: now }
        return b
      }),
    }))
    try {
      // Sequential syncableWrite — each book gets its own queue entry (E94-S02 tradeoff)
      const currentA = await db.books.get(bookIdA)
      const currentB = await db.books.get(bookIdB)
      if (currentA) {
        await syncableWrite('books', 'put', {
          ...currentA,
          linkedBookId: undefined,
          updatedAt: now,
        } as unknown as SyncableRecord)
      }
      if (currentB) {
        await syncableWrite('books', 'put', {
          ...currentB,
          linkedBookId: undefined,
          updatedAt: now,
        } as unknown as SyncableRecord)
      }
    } catch (err) {
      console.error('[BookStore] Failed to unlink books:', err)
      // Rollback only the affected books using captured previous state
      set(state => ({
        books: state.books.map(b => {
          if (b.id === bookIdA && prevBookA) return prevBookA
          if (b.id === bookIdB && prevBookB) return prevBookB
          return b
        }),
      }))
      toast.error('Failed to unlink book formats')
    }
  },

  upsertAbsBook: async (book: Book) => {
    // E94-S02: ABS sync is excluded from syncableWrite wiring. ABS paths are
    // server-authoritative bulk operations that require a merge/purge pattern
    // (bulkPut + bulkDelete) incompatible with per-record syncableWrite.
    // A dedicated E94+ story will wire ABS sync with the correct reconciliation strategy.
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
    // E94-S02: ABS sync is excluded from syncableWrite wiring — same rationale as
    // upsertAbsBook above. Kept as direct Dexie writes intentionally.
    if (newBooks.length === 0) return { removedCount: 0 }
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

      // Purge local books whose absItemId no longer exists on the server
      const incomingServerIds = new Set(newBooks.map(b => b.absServerId))
      const incomingAbsKeys = new Set(newBooks.map(b => `${b.absServerId}:${b.absItemId}`))
      const staleBooks = get().books.filter(
        b =>
          b.absServerId &&
          b.absItemId &&
          incomingServerIds.has(b.absServerId) &&
          !incomingAbsKeys.has(`${b.absServerId}:${b.absItemId}`)
      )
      if (staleBooks.length > 0) {
        await db.books.bulkDelete(staleBooks.map(b => b.id))
      }

      // Single bulk IDB write instead of N individual puts
      await db.books.bulkPut(mergedBooks)

      // Single state update — add merged, remove stale
      const mergedIds = new Set(mergedBooks.map(b => b.id))
      const staleIds = new Set(staleBooks.map(b => b.id))
      set(state => ({
        books: [
          ...state.books.filter(b => !mergedIds.has(b.id) && !staleIds.has(b.id)),
          ...mergedBooks,
        ],
      }))

      return { removedCount: staleBooks.length }
    } catch {
      toast.error('Failed to sync audiobooks from server')
      return { removedCount: 0 }
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

  getAllAuthors: () => {
    const { books } = get()
    const authorSet = new Set<string>()
    for (const b of books) {
      if (!b.author) continue
      // Split multi-author strings ("Author A, Author B" or "Author A & Author B")
      for (const name of b.author.split(/,\s*|\s+&\s+/)) {
        const trimmed = name.trim()
        if (trimmed) authorSet.add(trimmed)
      }
    }
    return Array.from(authorSet).sort()
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

  getBooksBySeries: () => {
    const allBooks = get().books
    const filteredBooks = get().getFilteredBooks()

    // Build series map from ALL books for true progress counts (ADV-2).
    // Key is normalized to lowercase to prevent case-sensitivity duplicates (ADV-5).
    const seriesMap = new Map<string, { displayName: string; books: Book[] }>()

    for (const book of allBooks) {
      if (book.series) {
        const key = book.series.trim().toLowerCase()
        const existing = seriesMap.get(key)
        if (existing) {
          existing.books.push(book)
        } else {
          seriesMap.set(key, { displayName: book.series, books: [book] })
        }
      }
    }

    // Ungrouped: filtered books with no series metadata
    const ungrouped: Book[] = filteredBooks.filter(b => !b.series)

    // Only show series that have at least one book matching the current filter
    const visibleSeriesKeys = new Set(
      filteredBooks.filter(b => b.series).map(b => b.series!.trim().toLowerCase())
    )

    const groups: LocalSeriesGroup[] = []
    for (const [key, { displayName, books }] of seriesMap) {
      if (!visibleSeriesKeys.has(key)) continue

      // Sort by sequence number (null/missing or non-numeric go to end, then localeCompare)
      const sorted = [...books].sort((a, b) => {
        const rawA = a.seriesSequence != null ? parseFloat(a.seriesSequence) : NaN
        const rawB = b.seriesSequence != null ? parseFloat(b.seriesSequence) : NaN
        const seqA = isNaN(rawA) ? Infinity : rawA
        const seqB = isNaN(rawB) ? Infinity : rawB
        if (seqA !== seqB) return seqA - seqB
        // Both non-numeric or equal numeric — fall back to localeCompare on raw string
        return (a.seriesSequence ?? '').localeCompare(b.seriesSequence ?? '')
      })

      const completed = sorted.filter(b => b.status === 'finished' || b.progress >= 100).length

      // Next unfinished: first in sequence order where not finished
      let nextUnfinishedId: string | null = null
      for (const b of sorted) {
        if (b.status !== 'finished' && b.progress < 100) {
          nextUnfinishedId = b.id
          break
        }
      }

      groups.push({
        name: displayName,
        books: sorted,
        completed,
        total: sorted.length,
        nextUnfinishedId,
      })
    }

    // Sort groups alphabetically by name
    groups.sort((a, b) => a.name.localeCompare(b.name))

    return { groups, ungrouped }
  },
}))
