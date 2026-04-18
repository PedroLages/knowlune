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

  /** Set the sync status directly. No side effects. */
  setStatus: (status: SyncStatus) => void
  /** Called by useSyncLifecycle after a successful fullSync(). */
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

  setStatus: (status) => set({ status }),

  markSyncComplete: () =>
    set({
      status: 'synced',
      lastSyncAt: new Date(),
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
