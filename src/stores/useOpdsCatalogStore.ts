/**
 * Zustand store for OPDS catalog connections.
 *
 * Manages OPDS catalog CRUD with Dexie persistence and Supabase sync.
 * Routes every write through `syncableWrite` (E95-S05) so the catalog row
 * participates in the sync pipeline. Passwords travel separately through the
 * vault-credentials broker — callers pass the password as a separate
 * argument to `addCatalog` / `updateCatalog`, it never lands on the Dexie
 * row, the syncQueue payload, or the Supabase `opds_catalogs` table.
 *
 * ### Nested `auth` flattening (E95-S05)
 *
 * Dexie stores `OpdsCatalog.auth` as a nested object `{ username }`, but
 * Supabase has a flat `auth_username` column. Before calling `syncableWrite`
 * we project `catalog.auth?.username` onto a top-level `authUsername` field
 * on the write payload and omit the nested `auth` object — `toSnakeCase`
 * then produces `auth_username` via the default camelCase conversion
 * (no explicit `fieldMap` entry needed). The download path re-nests
 * `auth_username` back into `auth: { username }` in
 * `src/lib/sync/syncEngine.ts` so Dexie rows keep the nested shape.
 *
 * @module useOpdsCatalogStore
 * @since E88-S01
 * @modified E95-S05 — syncableWrite routing + vault-backed password flow + nested-auth flatten
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { OpdsCatalog } from '@/data/types'
import type { SyncQueueEntry } from '@/db/schema'
import { db } from '@/db/schema'
import { storeCredential, deleteCredential } from '@/lib/vaultCredentials'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import { syncEngine } from '@/lib/sync/syncEngine'
import { tableRegistry } from '@/lib/sync/tableRegistry'
import { toSnakeCase } from '@/lib/sync/fieldMapper'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  invalidateOpdsPassword,
} from '@/lib/credentials/opdsPasswordResolver'
import { emitTelemetry } from '@/lib/credentials/telemetry'

interface OpdsCatalogStoreState {
  catalogs: OpdsCatalog[]
  isLoaded: boolean

  loadCatalogs: () => Promise<void>
  /**
   * Persist a new catalog. `password` is optional — omit or pass undefined
   * for anonymous feeds. On vault failure the Dexie row is NOT written.
   */
  addCatalog: (catalog: OpdsCatalog, password?: string) => Promise<void>
  /**
   * Update a catalog. Pass `password` ONLY when the credential is being
   * rotated; omit to preserve the existing vault entry.
   */
  updateCatalog: (
    id: string,
    updates: Partial<Omit<OpdsCatalog, 'id'>>,
    password?: string,
  ) => Promise<void>
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

  addCatalog: async (catalog: OpdsCatalog, password?: string) => {
    // Vault-first: credentials land in Supabase Vault before the metadata
    // row. On metadata-write failure after a successful vault write, emit
    // `sync.vault.potential_orphan` for the deferred reconciler.
    if (password && password.length > 0) {
      await storeCredential('opds-catalog', catalog.id, password)
      invalidateOpdsPassword(catalog.id)
    }
    try {
      // Dexie gets the nested shape (store stays typed against OpdsCatalog).
      // The sync queue gets the flat shape so Supabase sees `auth_username`.
      await writeOpdsRowAndEnqueue('put', catalog)
      set(state => ({ catalogs: [...state.catalogs, catalog] }))
    } catch (err) {
      if (password) {
        emitTelemetry('sync.vault.potential_orphan', {
          kind: 'opds-catalog',
          id: catalog.id,
          stage: 'add',
        })
      }
      console.error('[OpdsCatalogStore] Failed to add catalog:', err)
      toast.error('Failed to save OPDS catalog.')
      throw err
    }
  },

  updateCatalog: async (
    id: string,
    updates: Partial<Omit<OpdsCatalog, 'id'>>,
    password?: string,
  ) => {
    try {
      if (password && password.length > 0) {
        await storeCredential('opds-catalog', id, password)
        invalidateOpdsPassword(id)
      }
      const existing = get().catalogs.find(c => c.id === id)
      if (!existing) {
        console.warn('[OpdsCatalogStore] updateCatalog: no such catalog', id)
        return
      }
      const { updatedAt: _ignore, ...safeUpdates } = updates as Partial<OpdsCatalog>
      void _ignore
      const merged: OpdsCatalog = { ...existing, ...safeUpdates }
      await writeOpdsRowAndEnqueue('put', merged)
      set(state => ({
        catalogs: state.catalogs.map(c => (c.id === id ? merged : c)),
      }))
    } catch (err) {
      console.error('[OpdsCatalogStore] Failed to update catalog:', err)
      toast.error('Failed to update OPDS catalog.')
    }
  },

  removeCatalog: async (id: string) => {
    try {
      await syncableWrite('opdsCatalogs', 'delete', id)
      set(state => ({ catalogs: state.catalogs.filter(c => c.id !== id) }))
      // Delete credential from Vault after Dexie delete (fire-and-forget)
      invalidateOpdsPassword(id)
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

/**
 * Write an OPDS catalog record to Dexie with the canonical nested
 * `auth: { username }` shape AND enqueue a sync queue entry with the
 * Supabase-flat `auth_username` shape.
 *
 * Implementation notes:
 * - Dexie receives the nested record via `syncableWrite(skipQueue:true)`,
 *   which also stamps `userId` + `updatedAt` so we don't duplicate that
 *   logic.
 * - The queue entry is built by hand: we run the flat-projection (dropping
 *   the nested `auth` key, adding `authUsername`), then `toSnakeCase` it
 *   and insert into `syncQueue`. This mirrors what `syncableWrite` does
 *   internally — see [6] in `src/lib/sync/syncableWrite.ts`.
 * - Engine nudge is explicit because we bypassed the queue insert inside
 *   syncableWrite.
 */
async function writeOpdsRowAndEnqueue(
  operation: 'put',
  record: OpdsCatalog,
): Promise<void> {
  // [1] Write nested shape to Dexie; syncableWrite stamps userId + updatedAt.
  //     skipQueue:true because we'll build the queue entry with the flat
  //     shape (Supabase schema) manually below.
  await syncableWrite(
    'opdsCatalogs',
    operation,
    record as unknown as Record<string, unknown> & { id: string },
    { skipQueue: true },
  )

  // [2] Guard: no queue entry if unauthenticated. Matches syncableWrite's
  //     own behavior at step [4] of its implementation.
  const userId = useAuthStore.getState().user?.id ?? null
  if (!userId) return

  // [3] Look up the stored record to pick up the syncableWrite-stamped
  //     `updatedAt` — we must not re-stamp here (callers must not pre-stamp
  //     per the E93-S02 lesson). Fall back to `new Date()` if the row has
  //     somehow vanished, but log it.
  const stored = (await db.opdsCatalogs.get(record.id)) as OpdsCatalog | undefined
  const now = stored?.updatedAt ?? new Date().toISOString()

  // [4] Build the flat projection: drop nested `auth`, add `authUsername`.
  const { auth, ...rest } = stored ?? record
  const authUsername = auth?.username ?? null
  const flatRecord: Record<string, unknown> = {
    ...(rest as Record<string, unknown>),
    authUsername,
  }

  // [5] Convert to snake_case using the registry entry (defense-in-depth for
  //     vaultFields stripping — the projection should not carry a password,
  //     but if a caller slips one in via cast, toSnakeCase drops it).
  const entry = tableRegistry.find(e => e.dexieTable === 'opdsCatalogs')
  if (!entry) {
    console.error(
      '[useOpdsCatalogStore] Missing tableRegistry entry for opdsCatalogs',
    )
    return
  }
  const payload = toSnakeCase(entry, flatRecord)

  const queueEntry: Omit<SyncQueueEntry, 'id'> = {
    tableName: 'opdsCatalogs',
    recordId: record.id,
    operation,
    payload,
    attempts: 0,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  try {
    await db.syncQueue.add(queueEntry as SyncQueueEntry)
    syncEngine.nudge()
  } catch (err) {
    // silent-catch-ok: queue insert failure is non-fatal — the Dexie write
    // already succeeded. The sync engine's next scan will reconcile.
    console.error(
      '[useOpdsCatalogStore] Queue insert failed — write succeeded, sync deferred:',
      err,
    )
  }
}

// Exported for the unit test — kept out of the default export to avoid
// leaking the helper into the public API.
export const __TEST_ONLY = { writeOpdsRowAndEnqueue }
