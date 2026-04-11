/**
 * Zustand store for reading queue management (E110-S03).
 *
 * Manages an ordered list of books to read next with Dexie persistence.
 * Supports add, remove, reorder (via drag-and-drop), and auto-removal
 * on book completion.
 *
 * @module useReadingQueueStore
 * @since E110-S03
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import { arrayMove } from '@dnd-kit/sortable'
import type { ReadingQueueEntry } from '@/data/types'
import { db } from '@/db/schema'

/** Returns current ISO timestamp — extracted for consistency and testability */
const now = () => new Date().toISOString()

interface ReadingQueueStoreState {
  entries: ReadingQueueEntry[]
  isLoaded: boolean

  loadQueue: () => Promise<void>
  addToQueue: (bookId: string) => Promise<void>
  removeFromQueue: (bookId: string) => Promise<void>
  reorderQueue: (oldIndex: number, newIndex: number) => Promise<void>
  isInQueue: (bookId: string) => boolean
  getQueuedBookIds: () => string[]
  removeAllBookEntries: (bookId: string) => Promise<void>
}

export const useReadingQueueStore = create<ReadingQueueStoreState>((set, get) => ({
  entries: [],
  isLoaded: false,

  loadQueue: async () => {
    if (get().isLoaded) return

    const entries = await db.readingQueue.orderBy('sortOrder').toArray()
    set({ entries, isLoaded: true })
  },

  addToQueue: async (bookId: string) => {
    if (get().entries.some(e => e.bookId === bookId)) {
      return // Already queued, no-op
    }

    const maxOrder = Math.max(-1, ...get().entries.map(e => e.sortOrder))
    const entry: ReadingQueueEntry = {
      id: crypto.randomUUID(),
      bookId,
      sortOrder: maxOrder + 1,
      addedAt: now(),
    }

    // Optimistic append
    set(state => ({ entries: [...state.entries, entry] }))

    try {
      await db.readingQueue.put(entry)
      toast.success('Added to reading queue')
    } catch {
      const entries = await db.readingQueue.orderBy('sortOrder').toArray()
      set({ entries })
      toast.error('Failed to add to reading queue')
    }
  },

  removeFromQueue: async (bookId: string) => {
    const entry = get().entries.find(e => e.bookId === bookId)
    if (!entry) return

    // Optimistic removal
    set(state => ({
      entries: state.entries.filter(e => e.id !== entry.id),
    }))

    try {
      await db.readingQueue.delete(entry.id)
    } catch {
      const entries = await db.readingQueue.orderBy('sortOrder').toArray()
      set({ entries })
      toast.error('Failed to remove from reading queue')
    }
  },

  reorderQueue: async (oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return

    const reordered = arrayMove(get().entries, oldIndex, newIndex).map((e, i) => ({
      ...e,
      sortOrder: i,
    }))

    // Optimistic reorder
    set({ entries: reordered })

    try {
      await db.transaction('rw', db.readingQueue, async () => {
        for (const entry of reordered) {
          await db.readingQueue.update(entry.id, { sortOrder: entry.sortOrder })
        }
      })
    } catch {
      const entries = await db.readingQueue.orderBy('sortOrder').toArray()
      set({ entries })
      toast.error('Failed to reorder reading queue')
    }
  },

  isInQueue: (bookId: string) => {
    return get().entries.some(e => e.bookId === bookId)
  },

  getQueuedBookIds: () => {
    return get().entries.map(e => e.bookId)
  },

  removeAllBookEntries: async (bookId: string) => {
    set(state => ({
      entries: state.entries.filter(e => e.bookId !== bookId),
    }))
    try {
      await db.readingQueue.where('bookId').equals(bookId).delete()
    } catch {
      const entries = await db.readingQueue.orderBy('sortOrder').toArray()
      set({ entries })
      toast.error('Failed to remove book from reading queue')
    }
  },
}))
