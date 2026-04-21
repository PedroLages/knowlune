/**
 * useMissingCredentials — E97-S05 Unit 2
 *
 * React hook that subscribes to three data sources (auth, OPDS catalogs,
 * ABS servers), runs the credential status aggregator, and returns
 * { missing, statusByKey, loading }.
 *
 * Lifecycle:
 * - First evaluation is gated on useSyncStatusStore.lastSyncAt !== null to
 *   prevent a flash on new-device sign-in before the first sync completes (AC1).
 * - Event-driven refreshes fire on `ai-configuration-updated` and Zustand
 *   store deltas — always on, regardless of visibility.
 * - Visibility-gated 120s fallback polling: interval is installed only when
 *   the tab is visible and cleared on hidden; one immediate pass fires on
 *   visibility resume. No interval stacking across rapid toggles.
 *
 * Call-volume budget (documented here per plan requirement):
 *   ≤ 8 Edge Function calls per 120s while visible,
 *   0 while hidden,
 *   1 immediate on visibility resume,
 *   plus event-driven refreshes on user action.
 * Any future change that violates this budget requires a code comment + plan note.
 *
 * @module useMissingCredentials
 * @since E97-S05
 */

import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useOpdsCatalogStore } from '@/stores/useOpdsCatalogStore'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'
import { getAIConfiguration } from '@/lib/aiConfiguration'
import { aggregateCredentialStatus } from '@/lib/credentials/credentialStatus'
import type { MissingCredential, CredentialStatus } from '@/lib/credentials/credentialStatus'

/** 120s fallback polling interval (see call-volume budget comment above). */
const POLL_INTERVAL_MS = 120_000

export interface MissingCredentialsResult {
  missing: MissingCredential[]
  statusByKey: Record<string, CredentialStatus>
  loading: boolean
}

export function useMissingCredentials(): MissingCredentialsResult {
  const user = useAuthStore(s => s.user)
  const catalogs = useOpdsCatalogStore(s => s.catalogs)
  const servers = useAudiobookshelfStore(s => s.servers)
  const lastSyncAt = useSyncStatusStore(s => s.lastSyncAt)

  const [missing, setMissing] = useState<MissingCredential[]>([])
  const [statusByKey, setStatusByKey] = useState<Record<string, CredentialStatus>>({})
  const [loading, setLoading] = useState(true)

  // Stable ref to current catalogs/servers so the interval callback doesn't
  // capture stale state.
  const catalogsRef = useRef(catalogs)
  const serversRef = useRef(servers)
  const userRef = useRef(user)
  const lastSyncAtRef = useRef(lastSyncAt)
  // Ref to track the interval so we can clear/reinstall without stacking.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep refs in sync with latest values
  useEffect(() => { catalogsRef.current = catalogs }, [catalogs])
  useEffect(() => { serversRef.current = servers }, [servers])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { lastSyncAtRef.current = lastSyncAt }, [lastSyncAt])

  /**
   * Core aggregation function. Reads current snapshot from refs so it can be
   * called from the interval callback without capturing stale state.
   */
  const runAggregate = useRef(async () => {
    const currentUser = userRef.current
    const currentLastSyncAt = lastSyncAtRef.current

    // Auth gate: no user → return empty
    if (!currentUser) {
      setMissing([])
      setStatusByKey({})
      setLoading(false)
      return
    }

    // First-sync gate: block evaluation until first sync completes
    if (currentLastSyncAt === null) {
      setLoading(true)
      return
    }

    try {
      const aiConfig = getAIConfiguration()
      const result = await aggregateCredentialStatus({
        catalogs: catalogsRef.current,
        servers: serversRef.current,
        aiConfig,
      })
      setMissing(result.missing)
      setStatusByKey(result.statusByKey)
      setLoading(false)
    } catch {
      // silent-catch-ok: aggregator is non-throwing; this is a safety net.
      // Leave state unchanged so the UI doesn't flicker.
      setLoading(false)
    }
  })

  // ── Main effect: subscriptions + initial run ─────────────────────────────

  useEffect(() => {
    let destroyed = false

    // Helper to safely call aggregate (guards post-unmount state updates)
    const safeAggregate = () => {
      if (!destroyed) {
        void runAggregate.current()
      }
    }

    // Initial pass
    safeAggregate()

    // Listen for AI config changes (same-tab and cross-tab)
    function onAiConfigUpdated() {
      safeAggregate()
    }
    window.addEventListener('ai-configuration-updated', onAiConfigUpdated)

    // Visibility-gated 120s polling
    function clearPollInterval() {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    function startPollInterval() {
      clearPollInterval()
      intervalRef.current = setInterval(safeAggregate, POLL_INTERVAL_MS)
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        // One immediate pass on visibility resume, then reinstall interval
        safeAggregate()
        startPollInterval()
      } else {
        // Hidden: clear interval to stop Edge Function calls
        clearPollInterval()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    // Start interval immediately if tab is currently visible
    if (document.visibilityState === 'visible') {
      startPollInterval()
    }

    return () => {
      destroyed = true
      clearPollInterval()
      window.removeEventListener('ai-configuration-updated', onAiConfigUpdated)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [
    // Re-register when auth or first-sync gate changes
    user,
    lastSyncAt,
  ])

  // ── Zustand store subscription effects ──────────────────────────────────

  // Re-aggregate when OPDS catalog list changes
  useEffect(() => {
    if (!userRef.current || lastSyncAtRef.current === null) return
    void runAggregate.current()
  }, [catalogs])

  // Re-aggregate when ABS server list changes
  useEffect(() => {
    if (!userRef.current || lastSyncAtRef.current === null) return
    void runAggregate.current()
  }, [servers])

  return { missing, statusByKey, loading }
}
