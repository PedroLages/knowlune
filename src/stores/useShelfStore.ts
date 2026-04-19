/**
 * Zustand store for shelf management (E110-S01).
 *
 * Manages virtual shelves and book-shelf associations with Dexie persistence.
 * Default shelves are pre-created on first load.
 *
 * @module useShelfStore
 * @since E110-S01
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { Shelf, BookShelfEntry } from '@/data/types'
import { db } from '@/db/schema'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

/** Returns current ISO timestamp — extracted for consistency and testability */
const now = () => new Date().toISOString()

/** Default shelves created on first load — fixed IDs for E2E test reliability */
const DEFAULT_SHELVES: Shelf[] = [
  {
    id: 'shelf-favorites',
    name: 'Favorites',
    icon: 'Heart',
    isDefault: true,
    sortOrder: 0,
    createdAt: '',
  },
  {
    id: 'shelf-currently-reading',
    name: 'Currently Reading',
    icon: 'BookOpen',
    isDefault: true,
    sortOrder: 1,
    createdAt: '',
  },
  {
    id: 'shelf-want-to-read',
    name: 'Want to Read',
    icon: 'Bookmark',
    isDefault: true,
    sortOrder: 2,
    createdAt: '',
  },
]

interface ShelfStoreState {
  shelves: Shelf[]
  bookShelves: BookShelfEntry[]
  isLoaded: boolean

  loadShelves: () => Promise<void>
  createShelf: (name: string) => Promise<Shelf | null>
  renameShelf: (shelfId: string, name: string) => Promise<void>
  deleteShelf: (shelfId: string) => Promise<void>
  addBookToShelf: (bookId: string, shelfId: string) => Promise<void>
  removeBookFromShelf: (bookId: string, shelfId: string) => Promise<void>
  getShelvesForBook: (bookId: string) => Shelf[]
  getBooksOnShelf: (shelfId: string) => string[]
  removeAllBookEntries: (bookId: string) => Promise<void>
  getSortedShelves: () => Shelf[]
}

export const useShelfStore = create<ShelfStoreState>((set, get) => ({
  shelves: [],
  bookShelves: [],
  isLoaded: false,

  loadShelves: async () => {
    if (get().isLoaded) return

    let shelves = await db.shelves.toArray()

    // Seed default shelves on first load — use fixed IDs so tests can rely on them
    const existingIds = new Set(shelves.map(s => s.id))
    const missing = DEFAULT_SHELVES.filter(s => !existingIds.has(s.id))
    if (missing.length > 0) {
      const timestamp = now()
      const toInsert = missing.map(s => ({ ...s, createdAt: s.createdAt || timestamp }))
      await db.shelves.bulkPut(toInsert)
      shelves = await db.shelves.toArray()
    }

    const bookShelves = await db.bookShelves.toArray()
    set({ shelves, bookShelves, isLoaded: true })
  },

  createShelf: async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Shelf name cannot be empty')
      return null
    }

    // Check for duplicate names (case-insensitive)
    if (get().shelves.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('A shelf with that name already exists')
      return null
    }

    const maxOrder = Math.max(0, ...get().shelves.map(s => s.sortOrder))
    const shelf: Shelf = {
      id: crypto.randomUUID(),
      name: trimmed,
      isDefault: false,
      sortOrder: maxOrder + 1,
      createdAt: now(),
    }

    // Optimistic update
    set(state => ({ shelves: [...state.shelves, shelf] }))

    try {
      await syncableWrite('shelves', 'put', shelf as unknown as SyncableRecord)
      toast.success(`Shelf "${trimmed}" created`)
      return shelf
    } catch {
      set(state => ({ shelves: state.shelves.filter(s => s.id !== shelf.id) }))
      toast.error('Failed to create shelf')
      return null
    }
  },

  renameShelf: async (shelfId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Shelf name cannot be empty')
      return
    }

    const shelf = get().shelves.find(s => s.id === shelfId)
    if (!shelf) return

    if (shelf.isDefault) {
      toast.error('Default shelves cannot be renamed')
      return
    }

    // Check for duplicate names (case-insensitive), excluding self
    if (
      get().shelves.some(s => s.id !== shelfId && s.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      toast.error('A shelf with that name already exists')
      return
    }

    const timestamp = now()

    // Optimistic update
    set(state => ({
      shelves: state.shelves.map(s =>
        s.id === shelfId ? { ...s, name: trimmed, updatedAt: timestamp } : s
      ),
    }))

    try {
      // Fetch-then-put pattern — syncableWrite doesn't support partial updates.
      // We need the full record so the uploaded payload isn't a partial patch.
      const existing = await db.shelves.get(shelfId)
      if (!existing) {
        // Row vanished between optimistic update and Dexie read; bail cleanly.
        const shelves = await db.shelves.toArray()
        set({ shelves })
        return
      }
      await syncableWrite('shelves', 'put', {
        ...existing,
        name: trimmed,
        updatedAt: timestamp,
      } as unknown as SyncableRecord)
      toast.success(`Shelf renamed to "${trimmed}"`)
    } catch {
      const shelves = await db.shelves.toArray()
      set({ shelves })
      toast.error('Failed to rename shelf')
    }
  },

  deleteShelf: async (shelfId: string) => {
    const shelf = get().shelves.find(s => s.id === shelfId)
    if (!shelf) return

    if (shelf.isDefault) {
      toast.error('Default shelves cannot be deleted')
      return
    }

    // Optimistic removal
    set(state => ({
      shelves: state.shelves.filter(s => s.id !== shelfId),
      bookShelves: state.bookShelves.filter(bs => bs.shelfId !== shelfId),
    }))

    try {
      // syncableWrite does not support multi-table transactions. Delete the
      // child bookShelves rows first (each routed through syncableWrite so
      // Supabase sees the cascade), then delete the shelf itself. If any
      // individual delete fails, the catch rollbacks the optimistic UI state.
      const memberships = await db.bookShelves.where('shelfId').equals(shelfId).toArray()
      for (const entry of memberships) {
        await syncableWrite('bookShelves', 'delete', entry.id)
      }
      await syncableWrite('shelves', 'delete', shelfId)
      toast.success(`Shelf "${shelf.name}" deleted`)
    } catch {
      const shelves = await db.shelves.toArray()
      const bookShelves = await db.bookShelves.toArray()
      set({ shelves, bookShelves })
      toast.error('Failed to delete shelf')
    }
  },

  addBookToShelf: async (bookId: string, shelfId: string) => {
    // Check if already on shelf
    if (get().bookShelves.some(bs => bs.bookId === bookId && bs.shelfId === shelfId)) {
      return // Already there, no-op
    }

    const entry: BookShelfEntry = {
      id: crypto.randomUUID(),
      bookId,
      shelfId,
      addedAt: now(),
    }

    // Optimistic
    set(state => ({ bookShelves: [...state.bookShelves, entry] }))

    try {
      await syncableWrite('bookShelves', 'put', entry as unknown as SyncableRecord)
      const shelf = get().shelves.find(s => s.id === shelfId)
      if (shelf) {
        toast.success(`Added to "${shelf.name}"`)
      }
    } catch {
      set(state => ({
        bookShelves: state.bookShelves.filter(bs => bs.id !== entry.id),
      }))
      toast.error('Failed to add book to shelf')
    }
  },

  removeBookFromShelf: async (bookId: string, shelfId: string) => {
    const entry = get().bookShelves.find(bs => bs.bookId === bookId && bs.shelfId === shelfId)
    if (!entry) return

    // Optimistic
    set(state => ({
      bookShelves: state.bookShelves.filter(bs => bs.id !== entry.id),
    }))

    try {
      await syncableWrite('bookShelves', 'delete', entry.id)
      const shelf = get().shelves.find(s => s.id === shelfId)
      if (shelf) toast.success(`Removed from "${shelf.name}"`)
    } catch {
      const bookShelves = await db.bookShelves.toArray()
      set({ bookShelves })
      toast.error('Failed to remove book from shelf')
    }
  },

  getShelvesForBook: (bookId: string) => {
    const { shelves, bookShelves } = get()
    const shelfIds = new Set(bookShelves.filter(bs => bs.bookId === bookId).map(bs => bs.shelfId))
    return shelves.filter(s => shelfIds.has(s.id))
  },

  getBooksOnShelf: (shelfId: string) => {
    return get()
      .bookShelves.filter(bs => bs.shelfId === shelfId)
      .map(bs => bs.bookId)
  },

  removeAllBookEntries: async (bookId: string) => {
    // Snapshot the entries to delete BEFORE the optimistic set() so we can
    // route each through syncableWrite (which enqueues a delete per id).
    const entriesToDelete = get().bookShelves.filter(bs => bs.bookId === bookId)
    set(state => ({
      bookShelves: state.bookShelves.filter(bs => bs.bookId !== bookId),
    }))
    try {
      for (const entry of entriesToDelete) {
        await syncableWrite('bookShelves', 'delete', entry.id)
      }
    } catch {
      const bookShelves = await db.bookShelves.toArray()
      set({ bookShelves })
      toast.error('Failed to remove book from shelves')
    }
  },

  getSortedShelves: () => {
    return [...get().shelves].sort((a, b) => a.sortOrder - b.sortOrder)
  },
}))
