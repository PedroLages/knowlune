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
import { storeCredential, deleteCredential } from '@/lib/vaultCredentials'

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
      // Store password in Vault before Dexie write (must be awaited — Vault write completes first)
      if (catalog.auth?.password) {
        await storeCredential('opds-catalog', catalog.id, catalog.auth.password)
      }
      // Strip password from Dexie record — credentials live in Vault (E95-S02)
      const dexieRecord: OpdsCatalog = {
        ...catalog,
        auth: catalog.auth ? { username: catalog.auth.username } : undefined,
      }
      await db.opdsCatalogs.put(dexieRecord)
      set(state => ({ catalogs: [...state.catalogs, dexieRecord] }))
    } catch (err) {
      console.error('[OpdsCatalogStore] Failed to add catalog:', err)
      toast.error('Failed to save OPDS catalog.')
    }
  },

  updateCatalog: async (id: string, updates: Partial<Omit<OpdsCatalog, 'id'>>) => {
    try {
      // Store password in Vault before Dexie write (must be awaited — Vault write completes first)
      if (updates.auth?.password) {
        await storeCredential('opds-catalog', id, updates.auth.password)
      }
      // Strip password from Dexie updates — credentials live in Vault (E95-S02)
      const dexieUpdates: Partial<Omit<OpdsCatalog, 'id'>> = {
        ...updates,
        auth: updates.auth ? { username: updates.auth.username } : updates.auth,
      }
      await db.opdsCatalogs.update(id, dexieUpdates)
      set(state => ({
        catalogs: state.catalogs.map(c => (c.id === id ? { ...c, ...dexieUpdates } : c)),
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
      // Delete credential from Vault after Dexie delete (fire-and-forget)
      void deleteCredential('opds-catalog', id).catch(err => {
        // silent-catch-ok — Dexie delete already succeeded; Vault cleanup is best-effort
        console.warn('[OpdsCatalogStore] Vault deleteCredential failed for catalog:', id, err)
      })
    } catch (err) {
      console.error('[OpdsCatalogStore] Failed to remove catalog:', err)
      toast.error('Failed to remove OPDS catalog.')
    }
  },

  getCatalogById: (id: string) => {
    return get().catalogs.find(c => c.id === id)
  },
}))
