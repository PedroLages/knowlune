/**
 * Zustand store for book highlight management.
 *
 * Manages highlights for the currently open book. Highlights are persisted
 * to Dexie `bookHighlights` table. The store follows the same pattern as
 * useBookStore — Zustand for in-memory state, Dexie for persistence.
 *
 * @module useHighlightStore
 * @since E85-S01
 */
import { create } from 'zustand'
import type { BookHighlight, HighlightColor } from '@/data/types'
import { db } from '@/db/schema'
import { appEventBus } from '@/lib/eventBus'

interface HighlightStoreState {
  highlights: BookHighlight[]
  selectedHighlightId: string | null
  colorFilter: HighlightColor | 'all'
  isLoaded: boolean
  currentBookId: string | null

  loadHighlightsForBook: (bookId: string) => Promise<void>
  createHighlight: (highlight: BookHighlight) => Promise<void>
  updateHighlight: (
    highlightId: string,
    updates: Partial<Pick<BookHighlight, 'color' | 'note' | 'flashcardId'>>
  ) => Promise<void>
  deleteHighlight: (highlightId: string) => Promise<void>
  setSelectedHighlightId: (id: string | null) => void
  setColorFilter: (color: HighlightColor | 'all') => void
  getFilteredHighlights: () => BookHighlight[]
}

export const useHighlightStore = create<HighlightStoreState>((set, get) => ({
  highlights: [],
  selectedHighlightId: null,
  colorFilter: 'all',
  isLoaded: false,
  currentBookId: null,

  loadHighlightsForBook: async (bookId: string) => {
    // Skip reload if already loaded for same book
    if (get().currentBookId === bookId && get().isLoaded) return

    const highlights = await db.bookHighlights.where('bookId').equals(bookId).sortBy('createdAt')
    set({ highlights, currentBookId: bookId, isLoaded: true })
  },

  createHighlight: async (highlight: BookHighlight) => {
    // Optimistic update
    set(state => ({ highlights: [...state.highlights, highlight] }))

    try {
      await db.bookHighlights.put(highlight)
      appEventBus.emit({
        type: 'highlight:created',
        highlightId: highlight.id,
        bookId: highlight.bookId,
      })
    } catch {
      // Rollback on failure
      set(state => ({
        highlights: state.highlights.filter(h => h.id !== highlight.id),
      }))
      throw new Error('Failed to save highlight')
    }
  },

  updateHighlight: async (highlightId, updates) => {
    const prev = get().highlights.find(h => h.id === highlightId)
    if (!prev) return

    const updatedAt = new Date().toISOString()
    const merged = { ...prev, ...updates, updatedAt }

    // Optimistic update
    set(state => ({
      highlights: state.highlights.map(h => (h.id === highlightId ? merged : h)),
    }))

    try {
      await db.bookHighlights.update(highlightId, { ...updates, updatedAt })
      appEventBus.emit({ type: 'highlight:updated', highlightId, bookId: prev.bookId })
    } catch {
      // Rollback
      set(state => ({
        highlights: state.highlights.map(h => (h.id === highlightId ? prev : h)),
      }))
      throw new Error('Failed to update highlight')
    }
  },

  deleteHighlight: async (highlightId: string) => {
    const highlight = get().highlights.find(h => h.id === highlightId)
    if (!highlight) return

    // Optimistic removal
    set(state => ({
      highlights: state.highlights.filter(h => h.id !== highlightId),
      selectedHighlightId:
        state.selectedHighlightId === highlightId ? null : state.selectedHighlightId,
    }))

    try {
      await db.bookHighlights.delete(highlightId)
      appEventBus.emit({ type: 'highlight:deleted', highlightId, bookId: highlight.bookId })
    } catch {
      // Rollback
      set(state => ({
        highlights: [...state.highlights, highlight],
      }))
      throw new Error('Failed to delete highlight')
    }
  },

  setSelectedHighlightId: id => set({ selectedHighlightId: id }),

  setColorFilter: color => set({ colorFilter: color }),

  getFilteredHighlights: () => {
    const { highlights, colorFilter } = get()
    if (colorFilter === 'all') return highlights
    return highlights.filter(h => h.color === colorFilter)
  },
}))
