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
 *   lastError: string | null
 *   setStatus(s, error?): void
 *   markSyncComplete(): void
 *   refreshPendingCount(): Promise<void>
 */

import { create } from 'zustand'
import { db } from '@/db'

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

/** Default user-safe error message when classification does not produce one. */
const DEFAULT_ERROR_MESSAGE = 'Sync failed'

interface SyncStatusState {
  /** Current sync status — drives UI indicator in E97-S01 */
  status: SyncStatus
  /** Number of pending entries in syncQueue — drives badge count in E97-S01 */
  pendingCount: number
  /** Timestamp of last completed sync — displayed in E97-S02 settings panel */
  lastSyncAt: Date | null
  /**
   * Last user-safe classified error message — drives the error panel in
   * E97-S01's SyncStatusIndicator popover. Cleared by markSyncComplete.
   * Intentionally NOT cleared by setStatus('syncing') so that an interim
   * Retry click preserves the prior diagnostic until the retry actually
   * succeeds.
   */
  lastError: string | null

  /**
   * Set the sync status directly. When status is 'error', the optional
   * `error` argument is persisted to `lastError` (falling back to a generic
   * message). For non-error statuses, `lastError` is preserved so a transient
   * retry-click does not wipe the prior diagnostic.
   */
  setStatus: (status: SyncStatus, error?: string) => void
  /** Called by useSyncLifecycle after a successful fullSync(). Clears lastError. */
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

  setStatus: (status, error) => {
    if (status === 'error') {
      set({ status, lastError: error ?? DEFAULT_ERROR_MESSAGE })
    } else {
      // Intentional: lastError is NOT cleared on 'syncing'/'offline'/'synced'
      // via setStatus. Only markSyncComplete clears it, so that a Retry's
      // interim 'syncing' state keeps the prior error visible until success.
      set({ status })
    }
  },

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
