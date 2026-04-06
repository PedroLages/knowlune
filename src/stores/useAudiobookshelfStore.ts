/**
 * Zustand store for Audiobookshelf server connections.
 *
 * Manages Audiobookshelf server CRUD with Dexie persistence.
 * Follows the same pattern as useOpdsCatalogStore.ts — create<State>((set, get) => ({...}))
 * with isLoaded guard.
 *
 * @module useAudiobookshelfStore
 * @since E101-S02
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { AudiobookshelfServer, AbsSeries } from '@/data/types'
import { db } from '@/db/schema'
import * as AudiobookshelfService from '@/services/AudiobookshelfService'

/** Queued progress sync item — in-memory only (session-scoped, lost on refresh) */
export interface SyncQueueItem {
  serverId: string
  itemId: string
  payload: { currentTime: number; duration: number; progress: number; isFinished: boolean }
  enqueuedAt: string // ISO timestamp for debugging
}

interface AudiobookshelfStoreState {
  servers: AudiobookshelfServer[]
  isLoaded: boolean
  pendingSyncQueue: SyncQueueItem[]

  // Series browsing (E102-S02) — in-memory only, not persisted to Dexie
  series: AbsSeries[]
  isLoadingSeries: boolean
  seriesLoaded: boolean

  loadServers: () => Promise<void>
  addServer: (server: AudiobookshelfServer) => Promise<void>
  updateServer: (id: string, updates: Partial<Omit<AudiobookshelfServer, 'id'>>) => Promise<void>
  removeServer: (id: string) => Promise<void>
  getServerById: (id: string) => AudiobookshelfServer | undefined
  enqueueSyncItem: (item: Omit<SyncQueueItem, 'enqueuedAt'>) => void
  flushSyncQueue: () => Promise<void>
  loadSeries: (serverId: string, libraryId: string) => Promise<void>
}

export const useAudiobookshelfStore = create<AudiobookshelfStoreState>((set, get) => ({
  servers: [],
  isLoaded: false,
  pendingSyncQueue: [],
  series: [],
  isLoadingSeries: false,
  seriesLoaded: false,

  loadServers: async () => {
    if (get().isLoaded) return
    try {
      const servers = await db.audiobookshelfServers.toArray()
      set({ servers, isLoaded: true })
    } catch (err) {
      console.error('[AudiobookshelfStore] Failed to load servers:', err)
      toast.error('Failed to load Audiobookshelf servers.')
    }
  },

  addServer: async (server: AudiobookshelfServer) => {
    try {
      await db.audiobookshelfServers.add(server)
      set(state => ({ servers: [...state.servers, server] }))
    } catch (err) {
      console.error('[AudiobookshelfStore] Failed to add server:', err)
      toast.error('Failed to save Audiobookshelf server.')
      throw err
    }
  },

  updateServer: async (id: string, updates: Partial<Omit<AudiobookshelfServer, 'id'>>) => {
    try {
      await db.audiobookshelfServers.update(id, updates)
      set(state => ({
        servers: state.servers.map(s => (s.id === id ? { ...s, ...updates } : s)),
      }))

      // Flush pending sync queue when server transitions to 'connected' (E102-S01)
      if (updates.status === 'connected' && get().pendingSyncQueue.length > 0) {
        // Fire-and-forget — silent, never blocks the updateServer caller
        get()
          .flushSyncQueue()
          .catch(() => {}) // silent-catch-ok: flush is best-effort, failures stay in queue
      }
    } catch (err) {
      console.error('[AudiobookshelfStore] Failed to update server:', err)
      toast.error('Failed to update Audiobookshelf server.')
      throw err
    }
  },

  removeServer: async (id: string) => {
    try {
      await db.audiobookshelfServers.delete(id)
      set(state => ({ servers: state.servers.filter(s => s.id !== id) }))
    } catch (err) {
      console.error('[AudiobookshelfStore] Failed to remove server:', err)
      toast.error('Failed to remove Audiobookshelf server.')
    }
  },

  getServerById: (id: string) => {
    return get().servers.find(s => s.id === id)
  },

  enqueueSyncItem: (item: Omit<SyncQueueItem, 'enqueuedAt'>) => {
    const queueItem: SyncQueueItem = { ...item, enqueuedAt: new Date().toISOString() }
    set(state => ({
      pendingSyncQueue: [
        // Replace any existing entry for the same itemId (keep latest)
        ...state.pendingSyncQueue.filter(q => q.itemId !== item.itemId),
        queueItem,
      ],
    }))
  },

  flushSyncQueue: async () => {
    const queue = get().pendingSyncQueue
    if (queue.length === 0) return

    const remaining: SyncQueueItem[] = []

    for (const item of queue) {
      const server = get().servers.find(s => s.id === item.serverId)
      if (!server) {
        // Server removed — discard queued item
        continue
      }

      const result = await AudiobookshelfService.updateProgress(
        server.url,
        server.apiKey,
        item.itemId,
        item.payload
      )

      if (!result.ok) {
        // Still failing — keep in queue for next flush
        remaining.push(item)
      }
    }

    set({ pendingSyncQueue: remaining })
  },

  loadSeries: async (serverId: string, libraryId: string) => {
    if (get().seriesLoaded) return
    const server = get().servers.find(s => s.id === serverId)
    if (!server) return

    set({ isLoadingSeries: true })
    try {
      const allSeries: import('@/data/types').AbsSeries[] = []
      let page = 0
      const limit = 50

      // Fetch first page to get total
      const firstResult = await AudiobookshelfService.fetchSeriesForLibrary(
        server.url,
        server.apiKey,
        libraryId,
        { page, limit }
      )
      if (!firstResult.ok) {
        toast.error(`Failed to load series: ${firstResult.error}`)
        set({ isLoadingSeries: false })
        return
      }

      allSeries.push(...firstResult.data.results)
      const total = firstResult.data.total

      // Fetch remaining pages
      while ((page + 1) * limit < total) {
        page++
        const nextResult = await AudiobookshelfService.fetchSeriesForLibrary(
          server.url,
          server.apiKey,
          libraryId,
          { page, limit }
        )
        if (!nextResult.ok) break
        allSeries.push(...nextResult.data.results)
      }

      set({ series: allSeries, seriesLoaded: true, isLoadingSeries: false })
    } catch (err) {
      console.error('[AudiobookshelfStore] Failed to load series:', err)
      toast.error('Failed to load series from Audiobookshelf.')
      set({ isLoadingSeries: false })
    }
  },
}))
