/**
 * Zustand store for OPDS catalog connections.
 *
 * Manages OPDS catalog CRUD with Dexie persistence.
 * Follows the same pattern as useBookStore.ts — create<State>((set, get) => ({...}))
 * with isLoaded guard.
 *
 * @module useOpdsCatalogStore
 * @since E88-S01
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { OpdsCatalog } from '@/data/types'
import { db } from '@/db/schema'

interface OpdsCatalogStoreState {
  catalogs: OpdsCatalog[]
  isLoaded: boolean

  loadCatalogs: () => Promise<void>
  addCatalog: (catalog: OpdsCatalog) => Promise<void>
  updateCatalog: (id: string, updates: Partial<Omit<OpdsCatalog, 'id'>>) => Promise<void>
  removeCatalog: (id: string) => Promise<void>
  getCatalogById: (id: string) => OpdsCatalog | undefined
}

export const useOpdsCatalogStore = create<OpdsCatalogStoreState>((set, get) => ({
  catalogs: [],
  isLoaded: false,

  loadCatalogs: async () => {
    if (get().isLoaded) return
    try {
      const catalogs = await db.opdsCatalogs.toArray()
      set({ catalogs, isLoaded: true })
    } catch (err) {
      console.error('[OpdsCatalogStore] Failed to load catalogs:', err)
      toast.error('Failed to load OPDS catalogs.')
    }
  },

  addCatalog: async (catalog: OpdsCatalog) => {
    try {
      await db.opdsCatalogs.put(catalog)
      set(state => ({ catalogs: [...state.catalogs, catalog] }))
    } catch (err) {
      console.error('[OpdsCatalogStore] Failed to add catalog:', err)
      toast.error('Failed to save OPDS catalog.')
    }
  },

  updateCatalog: async (id: string, updates: Partial<Omit<OpdsCatalog, 'id'>>) => {
    try {
      await db.opdsCatalogs.update(id, updates)
      set(state => ({
        catalogs: state.catalogs.map(c => (c.id === id ? { ...c, ...updates } : c)),
      }))
    } catch (err) {
      console.error('[OpdsCatalogStore] Failed to update catalog:', err)
      toast.error('Failed to update OPDS catalog.')
    }
  },

  removeCatalog: async (id: string) => {
    try {
      await db.opdsCatalogs.delete(id)
      set(state => ({ catalogs: state.catalogs.filter(c => c.id !== id) }))
    } catch (err) {
      console.error('[OpdsCatalogStore] Failed to remove catalog:', err)
      toast.error('Failed to remove OPDS catalog.')
    }
  },

  getCatalogById: (id: string) => {
    return get().catalogs.find(c => c.id === id)
  },
}))
