/**
 * Zustand store for Audiobookshelf server connections.
 *
 * Manages Audiobookshelf server CRUD with Dexie persistence. Routes every
 * write through `syncableWrite` (E95-S05) so the server row participates in
 * the Supabase sync pipeline. Credentials travel separately through the
 * vault-credentials broker — `apiKey` is accepted as an out-of-band argument
 * on `addServer` / `updateServer` and never touches the Dexie row or the
 * Supabase `audiobookshelf_servers` table.
 *
 * @module useAudiobookshelfStore
 * @since E101-S02
 * @modified E95-S05 — syncableWrite routing + vault-backed credential flow
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { AudiobookshelfServer, AbsSeries, AbsCollection } from '@/data/types'
import { db } from '@/db/schema'
import * as AudiobookshelfService from '@/services/AudiobookshelfService'
import { useBookStore } from '@/stores/useBookStore'
import { storeCredentialWithStatus, deleteCredential } from '@/lib/vaultCredentials'

/**
 * Thrown by `addServer` / `updateServer` when the Vault write fails because
 * the user is not signed into Supabase. Callers (the Save handler) catch
 * this specifically to render an actionable "Sign in to save" toast without
 * writing an orphan Dexie row.
 */
export class VaultUnauthenticatedError extends Error {
  constructor(message = 'Sign in to save credentials') {
    super(message)
    this.name = 'VaultUnauthenticatedError'
  }
}
import { syncableWrite } from '@/lib/sync/syncableWrite'
import { getAbsApiKey, invalidateAbsApiKey } from '@/lib/credentials/absApiKeyResolver'
import { emitTelemetry } from '@/lib/credentials/telemetry'

/** TTL for supplementary data (collections, series) — 5 minutes */
const SUPPLEMENTARY_CACHE_TTL = 5 * 60 * 1000

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
  seriesLoadedAt: Record<string, number> // timestamp-based TTL cache

  // Collections browsing (E102-S03) — in-memory only, not persisted to Dexie
  collections: AbsCollection[]
  isLoadingCollections: boolean
  collectionsLoadedAt: Record<string, number> // timestamp-based TTL cache

  loadServers: () => Promise<void>
  /**
   * Persist a new server. `apiKey` is stored in Supabase Vault first; on
   * vault failure the Dexie row is NOT written (no partial state). On a
   * successful vault write followed by a failed metadata write, the vault
   * entry is orphaned and logged via `sync.vault.potential_orphan` telemetry
   * for a future reconciler.
   */
  addServer: (server: AudiobookshelfServer, apiKey: string) => Promise<void>
  /**
   * Update a server. Pass `apiKey` ONLY when the credential is actually
   * changing; the empty / omitted case preserves the existing vault entry.
   */
  updateServer: (
    id: string,
    updates: Partial<Omit<AudiobookshelfServer, 'id'>>,
    apiKey?: string
  ) => Promise<void>
  removeServer: (id: string) => Promise<void>
  getServerById: (id: string) => AudiobookshelfServer | undefined
  enqueueSyncItem: (item: Omit<SyncQueueItem, 'enqueuedAt'>) => void
  flushSyncQueue: () => Promise<void>
  loadSeries: (serverId: string, libraryId: string) => Promise<void>
  loadCollections: (serverId: string) => Promise<void>
}

export const useAudiobookshelfStore = create<AudiobookshelfStoreState>((set, get) => ({
  servers: [],
  isLoaded: false,
  pendingSyncQueue: [],
  series: [],
  isLoadingSeries: false,
  seriesLoadedAt: {},
  collections: [],
  isLoadingCollections: false,
  collectionsLoadedAt: {},

  loadServers: async () => {
    if (get().isLoaded) return
    try {
      const servers = await db.audiobookshelfServers.toArray()
      set({ servers, isLoaded: true })

      // Hydrate Series and Collections from Dexie (v60 cache) so the tabs
      // render instantly on cold page reload before any network fetch
      // completes. TTL cache in `loadSeries` / `loadCollections` still gates
      // refetches independently. Fire-and-forget: hydration failure is silent.
      try {
        const [cachedSeries, cachedCollections] = await Promise.all([
          db.absSeries.toArray(),
          db.absCollections.toArray(),
        ])
        if (cachedSeries.length > 0 || cachedCollections.length > 0) {
          set({
            series: cachedSeries,
            collections: cachedCollections,
          })
        }
      } catch (err) {
        // silent-catch-ok — Dexie cache is an optimization; network will refill.
        console.warn('[AudiobookshelfStore] Dexie hydration for series/collections failed:', err)
      }
    } catch (err) {
      console.error('[AudiobookshelfStore] Failed to load servers:', err)
      toast.error('Failed to load Audiobookshelf servers.')
    }
  },

  addServer: async (server: AudiobookshelfServer, apiKey: string) => {
    // Vault-first: if the vault write fails, we must not write the metadata
    // row (no partial state). Previously the legacy `storeCredential` was
    // non-throwing, so an unauthenticated save silently dropped the key and
    // the downstream sync surfaced a misleading "API key missing" toast. We
    // now branch on the discriminated result and throw a typed error so the
    // UI can render actionable messaging before writing Dexie.
    const vaultResult = await storeCredentialWithStatus('abs-server', server.id, apiKey)
    if (!vaultResult.ok) {
      if (vaultResult.reason === 'unauthenticated') {
        throw new VaultUnauthenticatedError()
      }
      toast.error('Could not save Audiobookshelf API key', {
        description: vaultResult.message ?? 'Vault write failed. Try again.',
      })
      throw new Error(vaultResult.message ?? 'Vault write failed')
    }
    // Invalidate the resolver cache so the first consumer reads the fresh key.
    invalidateAbsApiKey(server.id)
    try {
      await syncableWrite(
        'audiobookshelfServers',
        'add',
        server as unknown as Record<string, unknown> & { id: string }
      )
      set(state => ({ servers: [...state.servers, server] }))
    } catch (err) {
      // Metadata write failed after vault write succeeded — the vault entry
      // is orphaned (no Dexie / Supabase row references it). Log for the
      // deferred reconciler and surface an error toast.
      emitTelemetry('sync.vault.potential_orphan', {
        kind: 'abs-server',
        id: server.id,
        stage: 'add',
      })
      console.error('[AudiobookshelfStore] Failed to add server:', err)
      toast.error('Failed to save Audiobookshelf server.')
      throw err
    }
  },

  updateServer: async (
    id: string,
    updates: Partial<Omit<AudiobookshelfServer, 'id'>>,
    apiKey?: string
  ) => {
    try {
      if (apiKey && apiKey.length > 0) {
        const vaultResult = await storeCredentialWithStatus('abs-server', id, apiKey)
        if (!vaultResult.ok) {
          if (vaultResult.reason === 'unauthenticated') {
            throw new VaultUnauthenticatedError()
          }
          throw new Error(vaultResult.message ?? 'Vault write failed')
        }
        invalidateAbsApiKey(id)
      }
      const existing = get().servers.find(s => s.id === id)
      if (!existing) {
        console.warn('[AudiobookshelfStore] updateServer: no such server', id)
        return
      }
      // syncableWrite stamps userId + updatedAt — callers must not pre-stamp.
      const { updatedAt: _ignore, ...safeUpdates } = updates
      void _ignore
      const nextRecord: AudiobookshelfServer = { ...existing, ...safeUpdates }
      await syncableWrite(
        'audiobookshelfServers',
        'put',
        nextRecord as unknown as Record<string, unknown> & { id: string }
      )
      set(state => ({
        servers: state.servers.map(s => (s.id === id ? { ...s, ...safeUpdates } : s)),
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
      // VaultUnauthenticatedError is surfaced by the Save handler with a
      // specific "Sign in to save" toast — suppress the generic one so the
      // user does not see two toasts for the same failure.
      if (!(err instanceof VaultUnauthenticatedError)) {
        toast.error('Failed to update Audiobookshelf server.')
      }
      throw err
    }
  },

  removeServer: async (id: string) => {
    try {
      // Remove all books associated with this server from Dexie and memory.
      // `absServerId` is not indexed on the books table, so fall back to
      // `.filter()` if the `.where()` call throws on a strict IndexedDB
      // implementation (fake-indexeddb rejects unindexed `where`; real
      // browsers perform a silent table scan).
      let absBooks: Array<{ id: string }> = []
      try {
        absBooks = await db.books.where('absServerId').equals(id).toArray()
      } catch {
        // silent-catch-ok: fall back to full-table filter. Rare; only affects
        // tests against strict IndexedDB polyfills.
        absBooks = (await db.books
          .filter(b => (b as unknown as { absServerId?: string }).absServerId === id)
          .toArray()) as Array<{ id: string }>
      }
      if (absBooks.length > 0) {
        await db.books.bulkDelete(absBooks.map(b => b.id))
      }
      // Drop cached series/collections for this server (v60 cache).
      try {
        const staleSeries = await db.absSeries
          .filter(s => (s as unknown as { serverId?: string }).serverId === id)
          .toArray()
        const staleCollections = await db.absCollections
          .filter(c => (c as unknown as { serverId?: string }).serverId === id)
          .toArray()
        if (staleSeries.length > 0) await db.absSeries.bulkDelete(staleSeries.map(s => s.id))
        if (staleCollections.length > 0)
          await db.absCollections.bulkDelete(staleCollections.map(c => c.id))
      } catch (err) {
        // silent-catch-ok — cleanup is best-effort; orphaned cache rows are harmless.
        console.warn('[AudiobookshelfStore] Failed to drop cached series/collections:', err)
      }
      await syncableWrite('audiobookshelfServers', 'delete', id)
      set(state => ({
        servers: state.servers.filter(s => s.id !== id),
        // Clear collections/series for this server
        collections: state.collections.filter(c => c.libraryId !== id),
        collectionsLoadedAt: { ...state.collectionsLoadedAt, [id]: 0 },
        seriesLoadedAt: { ...state.seriesLoadedAt, [id]: 0 },
      }))
      // Refresh the book store so the UI reflects the deletion
      await useBookStore.getState().loadBooks()
      // Delete credential from Vault after Dexie delete (fire-and-forget).
      invalidateAbsApiKey(id)
      void deleteCredential('abs-server', id).catch(err => {
        // silent-catch-ok — Dexie delete already succeeded; Vault cleanup is best-effort
        console.warn('[AudiobookshelfStore] Vault deleteCredential failed for server:', id, err)
      })
      toast.success(`Server removed along with ${absBooks.length} synced books`)
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

      const apiKey = await getAbsApiKey(server.id)
      if (!apiKey) {
        remaining.push(item)
        continue
      }

      const result = await AudiobookshelfService.updateProgress(
        server.url,
        apiKey,
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
    // TTL cache guard — skip if loaded within last 5 minutes
    const loadedAt = get().seriesLoadedAt[serverId]
    if (loadedAt && Date.now() - loadedAt < SUPPLEMENTARY_CACHE_TTL) return
    // In-flight dedup — skip if already loading
    if (get().isLoadingSeries) return
    const server = get().servers.find(s => s.id === serverId)
    if (!server) return
    const apiKey = await getAbsApiKey(server.id)
    if (!apiKey) return

    set({ isLoadingSeries: true })
    try {
      const allSeries: import('@/data/types').AbsSeries[] = []
      let page = 0
      const limit = 50

      // Fetch first page to get total
      const firstResult = await AudiobookshelfService.fetchSeriesForLibrary(
        server.url,
        apiKey,
        libraryId,
        { page, limit }
      )
      if (!firstResult.ok) {
        // silent-catch-ok — series is supplementary, don't toast on rate-limit or transient errors
        console.warn('[AudiobookshelfStore] Failed to load series:', firstResult.error)
        // Cache failure to prevent retry hammering (wait TTL before retrying)
        set({
          isLoadingSeries: false,
          seriesLoadedAt: { ...get().seriesLoadedAt, [serverId]: Date.now() },
        })
        return
      }

      allSeries.push(...firstResult.data.results)
      const total = firstResult.data.total

      // Fetch remaining pages
      while ((page + 1) * limit < total) {
        page++
        const nextResult = await AudiobookshelfService.fetchSeriesForLibrary(
          server.url,
          apiKey,
          libraryId,
          { page, limit }
        )
        if (!nextResult.ok) break
        allSeries.push(...nextResult.data.results)
      }

      // Persist to Dexie (v60) — local-only cache. Stamp serverId + libraryId
      // so the Series tab can source-filter on reload. Fire-and-forget: a
      // Dexie failure must not break the in-memory render.
      try {
        const stamped = allSeries.map(s => ({ ...s, serverId, libraryId }))
        await db.absSeries.bulkPut(
          stamped as unknown as import('@/data/types').AbsSeries[]
        )
      } catch (err) {
        // silent-catch-ok — Dexie persistence is an optimization; network is authoritative.
        console.warn('[AudiobookshelfStore] Failed to persist series to Dexie:', err)
      }

      set({
        series: allSeries,
        seriesLoadedAt: { ...get().seriesLoadedAt, [serverId]: Date.now() },
        isLoadingSeries: false,
      })
    } catch (err) {
      // silent-catch-ok — series is supplementary, don't toast on rate-limit or transient errors
      console.warn('[AudiobookshelfStore] Failed to load series:', err)
      set({
        isLoadingSeries: false,
        seriesLoadedAt: { ...get().seriesLoadedAt, [serverId]: Date.now() },
      })
    }
  },

  loadCollections: async (serverId: string) => {
    // TTL cache guard — skip if loaded within last 5 minutes
    const loadedAt = get().collectionsLoadedAt[serverId]
    if (loadedAt && Date.now() - loadedAt < SUPPLEMENTARY_CACHE_TTL) return
    // In-flight dedup — skip if already loading
    if (get().isLoadingCollections) return
    const server = get().servers.find(s => s.id === serverId)
    if (!server) return
    const apiKey = await getAbsApiKey(server.id)
    if (!apiKey) return

    set({ isLoadingCollections: true })
    try {
      // GET /api/collections returns all collections in a single response (no pagination)
      const result = await AudiobookshelfService.fetchCollections(server.url, apiKey)
      if (!result.ok) {
        // silent-catch-ok — collections are supplementary, don't toast on rate-limit or transient errors
        console.warn('[AudiobookshelfStore] Failed to load collections:', result.error)
        set({
          isLoadingCollections: false,
          collectionsLoadedAt: { ...get().collectionsLoadedAt, [serverId]: Date.now() },
        })
        return
      }

      // Persist to Dexie (v60) — local-only cache. Stamp serverId so the
      // Collections tab can source-filter on reload. AbsCollection already
      // carries its own libraryId. Fire-and-forget.
      try {
        const stamped = result.data.results.map(c => ({ ...c, serverId }))
        await db.absCollections.bulkPut(
          stamped as unknown as import('@/data/types').AbsCollection[]
        )
      } catch (err) {
        // silent-catch-ok — Dexie persistence is an optimization; network is authoritative.
        console.warn('[AudiobookshelfStore] Failed to persist collections to Dexie:', err)
      }

      set({
        collections: result.data.results,
        collectionsLoadedAt: { ...get().collectionsLoadedAt, [serverId]: Date.now() },
        isLoadingCollections: false,
      })
    } catch (err) {
      // silent-catch-ok — collections are supplementary, don't toast on rate-limit or transient errors
      console.warn('[AudiobookshelfStore] Failed to load collections:', err)
      set({
        isLoadingCollections: false,
        collectionsLoadedAt: { ...get().collectionsLoadedAt, [serverId]: Date.now() },
      })
    }
  },
}))
