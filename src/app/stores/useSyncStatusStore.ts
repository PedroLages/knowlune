/**
 * E92-S07: Zustand store for sync status.
 *
 * Exposes ephemeral sync state that E97-S01/S02 will consume for the cloud
 * icon indicator and the sync settings panel. This store is session-only —
 * it is NOT persisted to Dexie or localStorage.
 *
 * Status transitions (driven by useSyncLifecycle):
 *   'synced'   — initial state and post-successful-sync state
 *   'syncing'  — fullSync() in progress
 *   'offline'  — navigator fired 'offline' event
 *   'error'    — fullSync() threw or online reconnect sync failed
 *
 * Public API contract for E97 (do NOT rename fields without coordinating):
 *   status: SyncStatus
 *   pendingCount: number
 *   lastSyncAt: Date | null
 *   setStatus(s): void
 *   markSyncComplete(): void
 *   refreshPendingCount(): Promise<void>
 */

import { create } from 'zustand'
import { db } from '@/db'

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

interface SyncStatusState {
  /** Current sync status — drives UI indicator in E97-S01 */
  status: SyncStatus
  /** Number of pending entries in syncQueue — drives badge count in E97-S01 */
  pendingCount: number
  /** Timestamp of last completed sync — displayed in E97-S02 settings panel */
  lastSyncAt: Date | null
  /**
   * Human-readable error message from the last sync failure — preserved
   * through subsequent syncing/offline transitions so the indicator can
   * surface it until a successful sync clears it via markSyncComplete().
   */
  lastError: string | null

  /**
   * Set the sync status directly.
   * When status is 'error', errorMessage is stored in lastError (defaults to
   * 'Sync failed' when omitted). All other transitions leave lastError unchanged
   * so the error context is preserved through retry/offline cycles.
   */
  setStatus: (status: SyncStatus, errorMessage?: string) => void
  /**
   * Called by useSyncLifecycle after a successful fullSync().
   * Advances lastSyncAt and clears lastError.
   */
  markSyncComplete: () => void
  /**
   * Query syncQueue for pending entries and update pendingCount.
   * Dexie errors are caught silently — count stays at previous value.
   */
  refreshPendingCount: () => Promise<void>
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  status: 'synced',
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,

  setStatus: (status, errorMessage) =>
    set(status === 'error' ? { status, lastError: errorMessage ?? 'Sync failed' } : { status }),

  markSyncComplete: () =>
    set({
      status: 'synced',
      lastSyncAt: new Date(),
      lastError: null,
    }),

  refreshPendingCount: async () => {
    try {
      const count = await db.syncQueue.where('status').equals('pending').count()
      set({ pendingCount: count })
    } catch (err) {
      // Intentional: Dexie read errors are non-fatal for status display —
      // pendingCount stays at its last known value.
      console.error('[useSyncStatusStore] refreshPendingCount failed:', err)
    }
  },
}))

// Expose store on window in development / test builds so E2E tests can
// directly drive status transitions without relying on fragile dynamic imports.
// Tree-shaken in production builds (import.meta.env.PROD is false in dev/test).
if (!import.meta.env.PROD) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__syncStatusStore = useSyncStatusStore
}
