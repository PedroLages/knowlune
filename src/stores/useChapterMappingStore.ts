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
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

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
      const all = await db.chapterMappings.toArray()
      // Filter out soft-deleted records (downloaded from sync or pending upload).
      const mappings = all.filter(m => !m.deleted)
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
      // syncableWrite stamps userId and updatedAt automatically.
      // Cast via unknown: ChapterMappingRecord lacks [key: string]: unknown but satisfies the runtime contract.
      await syncableWrite('chapterMappings', 'put', fullRecord as unknown as SyncableRecord)
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
      const existing = get().mappings.find(
        m => m.epubBookId === epubBookId && m.audioBookId === audioBookId
      )
      if (!existing) return
      // Soft-delete: mark as deleted via syncableWrite so the deletion propagates
      // to other devices. syncableWrite stamps userId and updatedAt.
      await syncableWrite('chapterMappings', 'put', {
        ...existing,
        deleted: true,
      } as unknown as SyncableRecord)
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
