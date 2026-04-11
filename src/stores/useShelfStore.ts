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

/** Default shelves created on first load */
const DEFAULT_SHELVES: Omit<Shelf, 'id' | 'createdAt'>[] = [
  { name: 'Favorites', icon: 'Heart', isDefault: true, sortOrder: 0 },
  { name: 'Currently Reading', icon: 'BookOpen', isDefault: true, sortOrder: 1 },
  { name: 'Want to Read', icon: 'Bookmark', isDefault: true, sortOrder: 2 },
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
}

export const useShelfStore = create<ShelfStoreState>((set, get) => ({
  shelves: [],
  bookShelves: [],
  isLoaded: false,

  loadShelves: async () => {
    if (get().isLoaded) return

    let shelves = await db.shelves.toArray()

    // Seed default shelves on first load
    if (shelves.length === 0) {
      const now = new Date().toISOString()
      const defaults: Shelf[] = DEFAULT_SHELVES.map((s, i) => ({
        ...s,
        id: crypto.randomUUID(),
        createdAt: now,
        sortOrder: i,
      }))
      await db.shelves.bulkPut(defaults)
      shelves = defaults
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
      createdAt: new Date().toISOString(),
    }

    try {
      await db.shelves.put(shelf)
      set(state => ({ shelves: [...state.shelves, shelf] }))
      toast.success(`Shelf "${trimmed}" created`)
      return shelf
    } catch {
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
      get().shelves.some(
        s => s.id !== shelfId && s.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      toast.error('A shelf with that name already exists')
      return
    }

    const now = new Date().toISOString()

    // Optimistic update
    set(state => ({
      shelves: state.shelves.map(s =>
        s.id === shelfId ? { ...s, name: trimmed, updatedAt: now } : s
      ),
    }))

    try {
      await db.shelves.update(shelfId, { name: trimmed, updatedAt: now })
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
      await db.transaction('rw', db.shelves, db.bookShelves, async () => {
        await db.bookShelves.where('shelfId').equals(shelfId).delete()
        await db.shelves.delete(shelfId)
      })
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
      addedAt: new Date().toISOString(),
    }

    // Optimistic
    set(state => ({ bookShelves: [...state.bookShelves, entry] }))

    try {
      await db.bookShelves.put(entry)
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
    const entry = get().bookShelves.find(
      bs => bs.bookId === bookId && bs.shelfId === shelfId
    )
    if (!entry) return

    // Optimistic
    set(state => ({
      bookShelves: state.bookShelves.filter(bs => bs.id !== entry.id),
    }))

    try {
      await db.bookShelves.delete(entry.id)
    } catch {
      const bookShelves = await db.bookShelves.toArray()
      set({ bookShelves })
      toast.error('Failed to remove book from shelf')
    }
  },

  getShelvesForBook: (bookId: string) => {
    const { shelves, bookShelves } = get()
    const shelfIds = new Set(
      bookShelves.filter(bs => bs.bookId === bookId).map(bs => bs.shelfId)
    )
    return shelves.filter(s => shelfIds.has(s.id))
  },

  getBooksOnShelf: (shelfId: string) => {
    return get()
      .bookShelves.filter(bs => bs.shelfId === shelfId)
      .map(bs => bs.bookId)
  },

  removeAllBookEntries: async (bookId: string) => {
    set(state => ({
      bookShelves: state.bookShelves.filter(bs => bs.bookId !== bookId),
    }))
    try {
      await db.bookShelves.where('bookId').equals(bookId).delete()
    } catch {
      const bookShelves = await db.bookShelves.toArray()
      set({ bookShelves })
    }
  },
}))
