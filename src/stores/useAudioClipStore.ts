/**
 * Zustand store for audio clip management (E111-S01).
 *
 * Manages CRUD and DnD reordering for audio clips scoped to a book.
 * Clips represent audio ranges (start + end time) within audiobook chapters.
 *
 * Modeled on useReadingQueueStore (reorder) and useBookmarkStore (optimistic updates).
 *
 * E93-S07: All write operations route through syncableWrite wrapped in
 * persistWithRetry so changes are enqueued for Supabase upload.
 *
 * @module useAudioClipStore
 * @since E111-S01
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import { arrayMove } from '@dnd-kit/sortable'
import type { AudioClip } from '@/data/types'
import { db } from '@/db/schema'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'
import { persistWithRetry } from '@/lib/persistWithRetry'

interface AudioClipStoreState {
  clips: AudioClip[]
  isLoaded: boolean
  loadedBookId: string | null

  loadClips: (bookId: string) => Promise<void>
  addClip: (clip: Omit<AudioClip, 'id' | 'sortOrder' | 'createdAt'>) => Promise<string>
  updateClipTitle: (clipId: string, title: string) => Promise<void>
  deleteClip: (clipId: string) => Promise<void>
  reorderClips: (oldIndex: number, newIndex: number) => Promise<void>
}

export const useAudioClipStore = create<AudioClipStoreState>((set, get) => ({
  clips: [],
  isLoaded: false,
  loadedBookId: null,

  loadClips: async (bookId: string) => {
    // Skip reload if the same book is already loaded
    if (get().isLoaded && get().loadedBookId === bookId) return

    const clips = await db.audioClips.where('bookId').equals(bookId).sortBy('sortOrder')

    set({ clips, isLoaded: true, loadedBookId: bookId })
  },

  addClip: async clipData => {
    const { clips } = get()
    const maxOrder = Math.max(-1, ...clips.map(c => c.sortOrder))

    const clip: AudioClip = {
      id: crypto.randomUUID(),
      sortOrder: maxOrder + 1,
      createdAt: new Date().toISOString(),
      ...clipData,
    }

    // Optimistic append
    set({ clips: [...clips, clip] })

    try {
      await persistWithRetry(() =>
        syncableWrite('audioClips', 'put', clip as unknown as SyncableRecord)
      )
      toast.success('Clip saved')
      return clip.id
    } catch {
      // Rollback on failure
      set({ clips })
      toast.error('Failed to save clip')
      throw new Error('Failed to save clip')
    }
  },

  updateClipTitle: async (clipId: string, title: string) => {
    const { clips } = get()
    const clip = clips.find(c => c.id === clipId)
    if (!clip) return

    const oldTitle = clip.title

    // Optimistic update
    set({ clips: clips.map(c => (c.id === clipId ? { ...c, title } : c)) })

    try {
      const existing = await db.audioClips.get(clipId)
      if (!existing) return
      await persistWithRetry(() =>
        syncableWrite('audioClips', 'put', { ...existing, title } as unknown as SyncableRecord)
      )
    } catch {
      // Rollback on failure
      set({
        clips: get().clips.map(c => (c.id === clipId ? { ...c, title: oldTitle } : c)),
      })
      toast.error('Failed to update clip title')
    }
  },

  deleteClip: async (clipId: string) => {
    const { clips } = get()
    const clipToDelete = clips.find(c => c.id === clipId)

    // Optimistic removal
    set({ clips: clips.filter(c => c.id !== clipId) })

    try {
      await persistWithRetry(() => syncableWrite('audioClips', 'delete', clipId))
    } catch {
      // Rollback on failure
      if (clipToDelete) {
        set({
          clips: [...get().clips, clipToDelete].sort((a, b) => a.sortOrder - b.sortOrder),
        })
      }
      toast.error('Failed to delete clip')
    }
  },

  reorderClips: async (oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return

    const reordered = arrayMove(get().clips, oldIndex, newIndex).map((c, i) => ({
      ...c,
      sortOrder: i,
    }))

    // Optimistic reorder
    set({ clips: reordered })

    try {
      // Expand transaction scope to include db.syncQueue so syncableWrite can
      // insert queue entries inside the transaction without "table not in transaction" errors.
      await db.transaction('rw', db.audioClips, db.syncQueue, async () => {
        for (const clip of reordered) {
          const existing = await db.audioClips.get(clip.id)
          if (existing) {
            await syncableWrite('audioClips', 'put', {
              ...existing,
              sortOrder: clip.sortOrder,
            } as unknown as SyncableRecord)
          }
        }
      })
    } catch {
      const fallback = await db.audioClips
        .where('bookId')
        .equals(get().loadedBookId ?? '')
        .sortBy('sortOrder')
      set({ clips: fallback })
      toast.error('Failed to reorder clips')
    }
  },
}))
