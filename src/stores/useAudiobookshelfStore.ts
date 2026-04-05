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

interface AudiobookshelfStoreState {
  servers: AudiobookshelfServer[]
  isLoaded: boolean

  loadServers: () => Promise<void>
  addServer: (server: AudiobookshelfServer) => Promise<void>
  updateServer: (id: string, updates: Partial<Omit<AudiobookshelfServer, 'id'>>) => Promise<void>
  removeServer: (id: string) => Promise<void>
  getServerById: (id: string) => AudiobookshelfServer | undefined
}

export const useAudiobookshelfStore = create<AudiobookshelfStoreState>((set, get) => ({
  servers: [],
  isLoaded: false,

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
}))
