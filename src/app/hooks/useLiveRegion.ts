/**
 * useLiveRegion — Centralised accessibility live-region hook.
 *
 * Provides a single `announce(message, politeness?)` API backed by two
 * canonical DOM spans owned by SyncUXShell. All sync-UX components that
 * previously maintained their own `aria-live` regions now route through this
 * hook instead.
 *
 * Architecture:
 *   - LiveRegionContext holds the `announce` function created in SyncUXShell.
 *   - `useLiveRegion()` reads the context and returns `{ announce }`.
 *   - Outside a SyncUXShell provider, `announce` is a no-op with a dev warning.
 *
 * Requirements: R1, R3, R4 (E97-S01-refactor)
 *
 * @since refactor/consolidate-aria-live-useliveregion
 */

import { createContext, useContext } from 'react'

// ─── Context shape ────────────────────────────────────────────────────────────

export type LiveRegionPoliteness = 'polite' | 'assertive'

export interface LiveRegionContextValue {
  announce: (message: string, politeness?: LiveRegionPoliteness) => void
}

/**
 * LiveRegionContext — provided by SyncUXShell; null outside the provider tree.
 */
export const LiveRegionContext = createContext<LiveRegionContextValue | null>(null)

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useLiveRegion — returns `{ announce }` from the nearest SyncUXShell provider.
 *
 * Graceful degradation: if called outside a SyncUXShell (e.g., in tests that
 * render a component in isolation), `announce` is a no-op and a `console.warn`
 * is emitted in development builds. No exceptions are thrown.
 *
 * Usage:
 *   const { announce } = useLiveRegion()
 *   announce('Sync recovered. All changes saved.') // polite (default)
 *   announce('Critical failure', 'assertive')
 */
export function useLiveRegion(): LiveRegionContextValue {
  const ctx = useContext(LiveRegionContext)

  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn(
        '[useLiveRegion] called outside SyncUXShell; announcements are no-ops. ' +
          'Wrap the component tree in SyncUXShell or provide a LiveRegionContext in tests.'
      )
    }
    return { announce: () => {} }
  }

  return ctx
}
