/**
 * E92-S07: Zustand store for sync status.
 *
 * Exposes ephemeral sync state that E97-S01/S02 will consume for the cloud
 * icon indicator and the sync settings panel. This store is session-only —
 * it is NOT persisted to Dexie.
 *
 * `lastSyncAt` is persisted to localStorage so the indicator shows the last
 * known sync time across page reloads instead of "Not synced yet".
 *
 * Status transitions (driven by useSyncLifecycle):
 *   'synced'   — initial state and post-successful-sync state
 *   'syncing'  — fullSync() in progress
 *   'offline'  — navigator fired 'offline' event
 *   'error'    — fullSync() threw or online reconnect sync failed
 *
 * Phase transitions (driven by syncEngine.onPhaseChange callback):
 *   'idle'       → 'uploading' → 'downloading' → 'applying' → 'refreshing' → 'idle'
 *
 * Public API contract (do NOT rename fields without coordinating):
 *   status: SyncStatus
 *   phase: SyncPhase
 *   pendingCount: number
 *   lastSyncAt: Date | null
 *   lastError: string | null
 *   elapsedSeconds: number
 *   setStatus(s): void
 *   setPhase(p): void
 *   markSyncComplete(): void
 *   refreshPendingCount(): Promise<void>
 *   tickElapsed(): void
 */

import { create } from 'zustand'
import { db } from '@/db'

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

/**
 * Granular sub-phase within the 'syncing' status. Surfaced to the UI indicator
 * so the user sees accurate copy during each stage of a full sync cycle.
 */
export type SyncPhase = 'idle' | 'uploading' | 'downloading' | 'applying' | 'refreshing'

/** localStorage key for persisting `lastSyncAt` across page reloads. */
const LAST_SYNC_STORAGE_KEY = 'sync:lastSyncAt'

function persistLastSyncAt(date: Date | null): void {
  try {
    if (date) {
      localStorage.setItem(LAST_SYNC_STORAGE_KEY, date.toISOString())
    } else {
      localStorage.removeItem(LAST_SYNC_STORAGE_KEY)
    }
  } catch {
    // localStorage may be blocked by privacy settings — non-fatal.
  }
}

function readPersistedLastSyncAt(): Date | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_STORAGE_KEY)
    return raw ? new Date(raw) : null
  } catch {
    return null
  }
}

interface SyncStatusState {
  /** Current sync status — drives UI indicator in E97-S01 */
  status: SyncStatus
  /** Granular sub-phase within 'syncing' — controls indicator body copy */
  phase: SyncPhase
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
   * Seconds elapsed since the current sync cycle started — updated by
   * a heartbeat interval in SyncStatusIndicator. Used by the elapsed-time
   * display and stall detection.
   */
  elapsedSeconds: number

  /**
   * Set the sync status directly.
   * When status is 'error', errorMessage is stored in lastError (defaults to
   * 'Sync failed' when omitted). All other transitions leave lastError unchanged
   * so the error context is preserved through retry/offline cycles.
   */
  setStatus: (status: SyncStatus, errorMessage?: string) => void
  /**
   * Set the sync sub-phase. No-op when status is not 'syncing' — phase is
   * only meaningful during an active sync cycle.
   */
  setPhase: (phase: SyncPhase) => void
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
  /**
   * Increment elapsedSeconds by 1. Called by a 1 s heartbeat interval
   * while status === 'syncing'.
   */
  tickElapsed: () => void
}

export const useSyncStatusStore = create<SyncStatusState>(set => ({
  status: 'synced',
  phase: 'idle',
  pendingCount: 0,
  lastSyncAt: readPersistedLastSyncAt(),
  lastError: null,
  elapsedSeconds: 0,

  setStatus: (status, errorMessage) =>
    set({
      status,
      ...(status === 'error' ? { lastError: errorMessage ?? 'Sync failed' } : {}),
      // Reset phase and elapsed on transitions out of 'syncing'.
      ...(status !== 'syncing' ? { phase: 'idle' as SyncPhase, elapsedSeconds: 0 } : {}),
    }),

  setPhase: (phase) =>
    set(s => {
      // Only update phase during an active sync.
      if (s.status !== 'syncing') return {}
      return { phase }
    }),

  markSyncComplete: () => {
    const now = new Date()
    persistLastSyncAt(now)
    set({
      status: 'synced',
      phase: 'idle',
      lastSyncAt: now,
      lastError: null,
      elapsedSeconds: 0,
    })
  },

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

  tickElapsed: () =>
    set(s => {
      if (s.status !== 'syncing') return {}
      return { elapsedSeconds: s.elapsedSeconds + 1 }
    }),
}))

// Expose store on window in development / test builds so E2E tests can
// directly drive status transitions without relying on fragile dynamic imports.
// Tree-shaken in production builds (import.meta.env.PROD is false in dev/test).
if (!import.meta.env.PROD) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__syncStatusStore = useSyncStatusStore
}
