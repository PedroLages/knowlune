/**
 * Zustand store for vocabulary item management (E109-S01).
 *
 * Manages vocabulary words/phrases saved from book reader text selections.
 * Persisted to Dexie `vocabularyItems` table. Follows the same pattern as
 * useHighlightStore — Zustand for in-memory state, Dexie for persistence.
 *
 * @module useVocabularyStore
 * @since E109-S01
 */
import { create } from 'zustand'
import { toast } from 'sonner'
import type { VocabularyItem } from '@/data/types'
import { db } from '@/db/schema'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'
import { persistWithRetry } from '@/lib/persistWithRetry'

interface VocabularyStoreState {
  items: VocabularyItem[]
  isLoaded: boolean
  currentBookId: string | null
  reviewIndex: number

  /** Load all vocabulary items (optionally filtered by book) */
  loadItems: (bookId?: string) => Promise<void>
  /** Load all vocabulary items across all books */
  loadAllItems: () => Promise<void>
  /** Add a new vocabulary item */
  addItem: (item: VocabularyItem) => Promise<void>
  /** Update an existing vocabulary item */
  updateItem: (
    id: string,
    updates: Partial<Pick<VocabularyItem, 'definition' | 'note' | 'masteryLevel'>>
  ) => Promise<void>
  /** Delete a vocabulary item */
  deleteItem: (id: string) => Promise<void>
  /** Advance mastery level after successful review */
  advanceMastery: (id: string) => Promise<void>
  /** Reset mastery level on failed review */
  resetMastery: (id: string) => Promise<void>
  /** Set review index for flashcard-style navigation */
  setReviewIndex: (index: number) => void
  /** Get items due for review (mastery < 3) */
  getReviewableItems: () => VocabularyItem[]
}

const now = () => new Date().toISOString()

export const useVocabularyStore = create<VocabularyStoreState>((set, get) => ({
  items: [],
  isLoaded: false,
  currentBookId: null,
  reviewIndex: 0,

  loadItems: async (bookId?: string) => {
    const query = bookId
      ? db.vocabularyItems.where('bookId').equals(bookId).sortBy('createdAt')
      : db.vocabularyItems.orderBy('createdAt').toArray()
    const items = await query
    set({ items, currentBookId: bookId ?? null, isLoaded: true })
  },

  loadAllItems: async () => {
    const items = await db.vocabularyItems.orderBy('createdAt').reverse().toArray()
    set({ items, currentBookId: null, isLoaded: true })
  },

  addItem: async (item: VocabularyItem) => {
    set(state => ({ items: [item, ...state.items] }))
    try {
      await persistWithRetry(() =>
        syncableWrite('vocabularyItems', 'put', item as unknown as SyncableRecord)
      )
    } catch {
      // Rollback optimistic update
      set(state => ({ items: state.items.filter(i => i.id !== item.id) }))
      toast.error('Failed to save vocabulary item')
    }
  },

  updateItem: async (id, updates) => {
    const prev = get().items
    const fullUpdates = { ...updates, updatedAt: now() }
    set(state => ({
      items: state.items.map(i => (i.id === id ? { ...i, ...fullUpdates } : i)),
    }))
    try {
      const existing = await db.vocabularyItems.get(id)
      if (!existing) return
      const merged = { ...existing, ...fullUpdates }
      await persistWithRetry(() =>
        syncableWrite('vocabularyItems', 'put', merged as unknown as SyncableRecord)
      )
    } catch {
      set({ items: prev })
      toast.error('Failed to update vocabulary item')
    }
  },

  deleteItem: async (id: string) => {
    const prev = get().items
    set(state => ({ items: state.items.filter(i => i.id !== id) }))
    try {
      await persistWithRetry(() => syncableWrite('vocabularyItems', 'delete', id))
    } catch {
      set({ items: prev })
      toast.error('Failed to delete vocabulary item')
    }
  },

  advanceMastery: async (id: string) => {
    const item = get().items.find(i => i.id === id)
    if (!item || item.masteryLevel >= 3) return
    const prev = get().items
    const newLevel = Math.min(3, item.masteryLevel + 1) as 0 | 1 | 2 | 3
    const timestamp = now()
    const updates = { masteryLevel: newLevel, lastReviewedAt: timestamp, updatedAt: timestamp }
    set(state => ({
      items: state.items.map(i => (i.id === id ? { ...i, ...updates } : i)),
    }))
    try {
      const existing = await db.vocabularyItems.get(id)
      if (!existing) return
      const merged = { ...existing, ...updates }
      await persistWithRetry(() =>
        syncableWrite('vocabularyItems', 'put', merged as unknown as SyncableRecord)
      )
    } catch {
      set({ items: prev })
      toast.error('Failed to update mastery level')
    }
  },

  resetMastery: async (id: string) => {
    const prev = get().items
    const timestamp = now()
    const updates = { masteryLevel: 0 as const, lastReviewedAt: timestamp, updatedAt: timestamp }
    set(state => ({
      items: state.items.map(i => (i.id === id ? { ...i, ...updates } : i)),
    }))
    try {
      const existing = await db.vocabularyItems.get(id)
      if (!existing) return
      const merged = { ...existing, ...updates }
      await persistWithRetry(() =>
        syncableWrite('vocabularyItems', 'put', merged as unknown as SyncableRecord)
      )
    } catch {
      set({ items: prev })
      toast.error('Failed to reset mastery level')
    }
  },

  setReviewIndex: (index: number) => set({ reviewIndex: index }),

  getReviewableItems: () => {
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
    const cutoff = new Date(Date.now() - FOUR_HOURS_MS).toISOString()
    return get()
      .items.filter(i => i.masteryLevel < 3 && (!i.lastReviewedAt || i.lastReviewedAt < cutoff))
      .slice(0, 20)
  },
}))
