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
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

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
      await syncableWrite('readingQueue', 'put', entry as unknown as SyncableRecord)
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
      await syncableWrite('readingQueue', 'delete', entry.id)
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
      // Sequential awaits — same ordering semantics as the original Dexie
      // transaction, but routed through syncableWrite so each reorder step
      // produces an upload queue entry. fieldMap translates sortOrder → position
      // in the queue payload; Supabase-side the UNIQUE (user_id, position)
      // constraint is DEFERRABLE so the server transaction can tolerate the
      // transient swap state.
      for (const entry of reordered) {
        await syncableWrite('readingQueue', 'put', { ...entry } as unknown as SyncableRecord)
      }
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
    // Snapshot the entries to delete BEFORE the optimistic set() so each
    // row can be routed through syncableWrite (enqueuing a delete per id).
    const entriesToDelete = get().entries.filter(e => e.bookId === bookId)
    set(state => ({
      entries: state.entries.filter(e => e.bookId !== bookId),
    }))
    try {
      for (const entry of entriesToDelete) {
        await syncableWrite('readingQueue', 'delete', entry.id)
      }
    } catch {
      const entries = await db.readingQueue.orderBy('sortOrder').toArray()
      set({ entries })
      toast.error('Failed to remove book from reading queue')
    }
  },
}))
