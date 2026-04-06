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
import type { AudiobookshelfServer } from '@/data/types'
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

  loadServers: () => Promise<void>
  addServer: (server: AudiobookshelfServer) => Promise<void>
  updateServer: (id: string, updates: Partial<Omit<AudiobookshelfServer, 'id'>>) => Promise<void>
  removeServer: (id: string) => Promise<void>
  getServerById: (id: string) => AudiobookshelfServer | undefined
  enqueueSyncItem: (item: Omit<SyncQueueItem, 'enqueuedAt'>) => void
  flushSyncQueue: () => Promise<void>
}

export const useAudiobookshelfStore = create<AudiobookshelfStoreState>((set, get) => ({
  servers: [],
  isLoaded: false,
  pendingSyncQueue: [],

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
          .catch(() => {})
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
}))
