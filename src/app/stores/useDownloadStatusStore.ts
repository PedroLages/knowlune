/**
 * E97-S04: Zustand store for new-device download lifecycle status.
 *
 * Tracks the two-phase "restoring your data" lifecycle on first sign-in
 * from a new device:
 *
 *   idle → hydrating-p3p4 → downloading-p0p2 → complete
 *                   │                 │
 *                   └──── error ◀─────┘   (reachable from any active phase)
 *
 * This store is orthogonal to `useSyncStatusStore` — the latter describes
 * ambient sync-engine state (`synced | syncing | offline | error`) that
 * fires continuously for the life of the session. This store is scoped to
 * the one-shot new-device restore and is reset on sign-out.
 *
 * Public API contract (do NOT rename fields without coordinating with
 * `NewDeviceDownloadOverlay`, `observedHydrate`, and `useDownloadEngineWatcher`):
 *   status: DownloadStatus
 *   lastError: string | null
 *   startedAt: number | null        — epoch ms when the active phase began
 *
 * Actions:
 *   startHydrating()                — idle|error → hydrating-p3p4 (stamps startedAt)
 *   startDownloadingP0P2()          — hydrating-p3p4 → downloading-p0p2
 *   completeDownloading()           — any active phase → complete
 *   failDownloading(msg)            — any phase → error with message
 *   reset()                         — any phase → idle (clears lastError)
 *
 * Not persisted. Lives for the auth session; reset on SIGNED_OUT.
 *
 * @since E97-S04
 */

import { create } from 'zustand'

export type DownloadStatus = 'idle' | 'hydrating-p3p4' | 'downloading-p0p2' | 'complete' | 'error'

interface DownloadStatusState {
  /** Current lifecycle phase. */
  status: DownloadStatus
  /** Human-readable error message, set when status is 'error'. */
  lastError: string | null
  /** Epoch ms when the current active phase began; null when idle/complete. */
  startedAt: number | null

  /** idle|error → hydrating-p3p4 (phase A). Stamps `startedAt`. */
  startHydrating: () => void
  /** hydrating-p3p4 → downloading-p0p2 (phase B hand-off). */
  startDownloadingP0P2: () => void
  /** Any active phase → complete. */
  completeDownloading: () => void
  /** Any phase → error with the given message. */
  failDownloading: (message: string) => void
  /** Any phase → idle. Clears lastError and startedAt. */
  reset: () => void
}

export const useDownloadStatusStore = create<DownloadStatusState>(set => ({
  status: 'idle',
  lastError: null,
  startedAt: null,

  startHydrating: () =>
    set({
      status: 'hydrating-p3p4',
      lastError: null,
      startedAt: Date.now(),
    }),

  startDownloadingP0P2: () =>
    set(state =>
      // Guard: only advance from hydrating-p3p4 to avoid clobbering terminal states.
      state.status === 'hydrating-p3p4' ? { status: 'downloading-p0p2' } : state
    ),

  completeDownloading: () =>
    set({
      status: 'complete',
      lastError: null,
      startedAt: null,
    }),

  failDownloading: message =>
    set({
      status: 'error',
      lastError: message || 'Download failed',
    }),

  reset: () =>
    set({
      status: 'idle',
      lastError: null,
      startedAt: null,
    }),
}))

// Expose store on window in dev/test builds for E2E tests to drive transitions.
// Tree-shaken in production builds (import.meta.env.PROD is true).
if (!import.meta.env.PROD) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__downloadStatusStore = useDownloadStatusStore
}
