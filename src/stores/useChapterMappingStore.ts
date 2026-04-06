/**
 * Zustand store for chapter mappings (EPUB ↔ audiobook).
 *
 * Manages ChapterMappingRecord CRUD with Dexie persistence.
 * Follows the useOpdsCatalogStore pattern — create<State>((set, get) => ({...}))
 * with isLoaded guard.
 *
 * @module useChapterMappingStore
 * @since E103-S01
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { ChapterMappingRecord } from '@/data/types'
import { db } from '@/db/schema'

interface ChapterMappingStoreState {
  mappings: ChapterMappingRecord[]
  isLoaded: boolean

  loadMappings: () => Promise<void>
  saveMapping: (
    epubBookId: string,
    audioBookId: string,
    record: Omit<ChapterMappingRecord, 'epubBookId' | 'audioBookId'>
  ) => Promise<void>
  getMapping: (epubBookId: string, audioBookId: string) => ChapterMappingRecord | undefined
  deleteMapping: (epubBookId: string, audioBookId: string) => Promise<void>
}

export const useChapterMappingStore = create<ChapterMappingStoreState>((set, get) => ({
  mappings: [],
  isLoaded: false,

  loadMappings: async () => {
    if (get().isLoaded) return
    try {
      const mappings = await db.chapterMappings.toArray()
      set({ mappings, isLoaded: true })
    } catch (err) {
      console.error('[ChapterMappingStore] Failed to load mappings:', err)
      toast.error('Failed to load chapter mappings.')
    }
  },

  saveMapping: async (epubBookId, audioBookId, record) => {
    try {
      const fullRecord: ChapterMappingRecord = {
        epubBookId,
        audioBookId,
        ...record,
      }
      await db.chapterMappings.put(fullRecord)
      set(state => ({
        mappings: [
          ...state.mappings.filter(
            m => !(m.epubBookId === epubBookId && m.audioBookId === audioBookId)
          ),
          fullRecord,
        ],
      }))
    } catch (err) {
      console.error('[ChapterMappingStore] Failed to save mapping:', err)
      toast.error('Failed to save chapter mapping.')
    }
  },

  getMapping: (epubBookId, audioBookId) => {
    return get().mappings.find(m => m.epubBookId === epubBookId && m.audioBookId === audioBookId)
  },

  deleteMapping: async (epubBookId, audioBookId) => {
    try {
      await db.chapterMappings.delete([epubBookId, audioBookId])
      set(state => ({
        mappings: state.mappings.filter(
          m => !(m.epubBookId === epubBookId && m.audioBookId === audioBookId)
        ),
      }))
    } catch (err) {
      console.error('[ChapterMappingStore] Failed to delete mapping:', err)
      toast.error('Failed to remove chapter mapping.')
    }
  },
}))
