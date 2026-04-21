/**
 * SyncUXShell — E98 (refactor extracted from App.tsx, 2026-04-21)
 *
 * Co-locates all sync/onboarding UX so App.tsx stays a pure provider + router shell.
 *
 * Responsibilities:
 *   1. Owns the 4 floaters: LinkDataDialog, InitialUploadWizard,
 *      NewDeviceDownloadOverlay, CredentialSetupBanner.
 *   2. Hosts the gating state machine that enforces mutual exclusion:
 *      link → upload → overlay → banner.
 *   3. Wires the two sync lifecycle hooks (useAuthLifecycle, useSyncLifecycle)
 *      and consumes useAuthStore for the authed userId.
 *   4. Wraps `children` in MissingCredentialsProvider so routed pages and the
 *      Toaster remain context consumers (unchanged from pre-refactor scope).
 *   5. Exposes dev/test shim `window.__forceDownloadOverlay` for E2E tests
 *      (story-97-04); tree-shaken in production builds.
 *
 * Invariants (do not rearrange the effects below):
 *   - The 4 gating effects execute in a specific render-cycle order
 *     (link → upload → overlay → sign-out reset). Splitting or reordering
 *     can cause the overlay to flash before the wizard gate evaluates, or
 *     vice versa.
 *   - evaluationInFlightRef / downloadEvaluationInFlightRef guard against
 *     same-tick double-evaluation from the onResolved path racing the
 *     useAuthStore.user effect.
 *   - Overlay mount is deferred 2s so fast restores never flash (E97-S04).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuthLifecycle } from '@/app/hooks/useAuthLifecycle'
import { useSyncLifecycle } from '@/app/hooks/useSyncLifecycle'
import { LinkDataDialog } from '@/app/components/sync/LinkDataDialog'
import { InitialUploadWizard } from '@/app/components/sync/InitialUploadWizard'
import { NewDeviceDownloadOverlay } from '@/app/components/sync/NewDeviceDownloadOverlay'
import { CredentialSetupBanner } from '@/app/components/sync/CredentialSetupBanner'
import { MissingCredentialsProvider } from '@/app/hooks/useMissingCredentials'
import { shouldShowInitialUploadWizard } from '@/lib/sync/shouldShowInitialUploadWizard'
import { shouldShowDownloadOverlay } from '@/lib/sync/shouldShowDownloadOverlay'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { LiveRegionContext, type LiveRegionPoliteness } from '@/app/hooks/useLiveRegion'

interface SyncUXShellProps {
  children: ReactNode
}

export function SyncUXShell({ children }: SyncUXShellProps) {
  // ─── Live region refs (Unit 2: refactor/consolidate-aria-live-useliveregion) ──
  // Two canonical spans owned by SyncUXShell; consumers call announce() instead
  // of managing their own aria-live regions.
  const politeRef = useRef<HTMLSpanElement>(null)
  const assertiveRef = useRef<HTMLSpanElement>(null)
  // Pending timer IDs — cancelled on unmount to avoid setState-after-unmount.
  const lrTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const announce = useCallback((message: string, politeness: LiveRegionPoliteness = 'polite') => {
    if (!message) return
    const spanRef = politeness === 'assertive' ? assertiveRef : politeRef
    const span = spanRef.current
    if (!span) return

    // WAI-ARIA clear→set pattern: clear first so repeat messages are picked up.
    span.textContent = ''
    const setTimer = setTimeout(() => {
      span.textContent = message
      // Reset to empty after ≥150 ms so the region does not become stale.
      const resetTimer = setTimeout(() => {
        span.textContent = ''
      }, 150)
      lrTimersRef.current.push(resetTimer)
    }, 10)
    lrTimersRef.current.push(setTimer)
  }, [])

  // Cancel all pending live-region timers on unmount.
  useEffect(() => {
    const timers = lrTimersRef
    return () => {
      timers.current.forEach(id => clearTimeout(id))
    }
  }, [])

  // E92-S08: State for the non-dismissible "link your data" dialog shown on first sign-in
  // when the device has local records not yet linked to the signed-in account.
  const [linkDialogUserId, setLinkDialogUserId] = useState<string | null>(null)

  // E97-S03: State for the first-run initial-upload wizard. Mounts only when
  // `shouldShowInitialUploadWizard(userId)` resolves true; never co-appears with
  // LinkDataDialog (the wizard evaluation is deferred until link dialog resolves).
  const [uploadWizardUserId, setUploadWizardUserId] = useState<string | null>(null)
  // E97-S04: State for the new-device download overlay. Mounts only when
  // `shouldShowDownloadOverlay(userId)` resolves true AND a 2s defer timer
  // has elapsed (so fast restores never flash). Mutually exclusive with
  // LinkDataDialog and InitialUploadWizard by construction — those imply
  // local data exists, which short-circuits the predicate.
  const [downloadOverlayUserId, setDownloadOverlayUserId] = useState<string | null>(null)
  const [deferredOverlayReady, setDeferredOverlayReady] = useState(false)
  // Guard against double-evaluation on the same render cycle. Both the
  // `onResolved` path (LinkDataDialog closed) and the `useAuthStore.user`
  // effect can race on the same tick — we coordinate via this ref so only
  // one evaluation runs at a time for a given userId.
  const evaluationInFlightRef = useRef<string | null>(null)
  const downloadEvaluationInFlightRef = useRef<string | null>(null)
  const authUser = useAuthStore(s => s.user)

  const evaluateWizard = useCallback(async (userId: string) => {
    // __suppressSyncOverlays shim: test-only flag set before auth injection
    // to prevent wizard/overlay mounts intercepting pointer events (story-97-02).
    if ((window as Record<string, unknown>).__suppressSyncOverlays) return
    if (!userId) return
    if (evaluationInFlightRef.current === userId) return
    evaluationInFlightRef.current = userId
    try {
      const show = await shouldShowInitialUploadWizard(userId)
      if (show) setUploadWizardUserId(userId)
    } catch (err) {
      // silent-catch-ok — detection is best-effort; on failure we simply do
      // not show the wizard. Next sign-in will retry.
      console.error('[App] shouldShowInitialUploadWizard failed:', err)
    } finally {
      evaluationInFlightRef.current = null
    }
  }, [])

  // Stable callback — useAuthLifecycle's dependency array includes this.
  // useCallback with [] ensures the effect never re-registers unnecessarily.
  const handleUnlinkedDetected = useCallback((userId: string) => {
    setLinkDialogUserId(userId)
  }, [])

  // Callback fired when LinkDataDialog resolves. Evaluates the wizard gate
  // AFTER the dialog-induced backfill enqueues rows.
  const handleLinkDialogResolved = useCallback(
    (userId: string) => {
      setLinkDialogUserId(null)
      void evaluateWizard(userId)
    },
    [evaluateWizard]
  )

  // Fast-path trigger: when the user becomes authenticated and no link dialog
  // is in flight, evaluate the wizard gate. The guard ref prevents this from
  // double-firing against the onResolved path.
  useEffect(() => {
    if (!authUser || linkDialogUserId) return
    if (uploadWizardUserId) return
    void evaluateWizard(authUser.id)
  }, [authUser, linkDialogUserId, uploadWizardUserId, evaluateWizard])

  // E97-S04: New-device download overlay gate.
  const evaluateDownloadOverlay = useCallback(async (userId: string) => {
    // __suppressSyncOverlays shim: test-only flag to prevent overlay mounting.
    if ((window as Record<string, unknown>).__suppressSyncOverlays) return
    if (!userId) return
    if (downloadEvaluationInFlightRef.current === userId) return
    downloadEvaluationInFlightRef.current = userId
    try {
      const show = await shouldShowDownloadOverlay(userId)
      if (show) setDownloadOverlayUserId(userId)
    } catch (err) {
      // silent-catch-ok — detection is best-effort; on failure we simply do
      // not show the overlay. Next sign-in will retry.
      console.error('[App] shouldShowDownloadOverlay failed:', err)
    } finally {
      downloadEvaluationInFlightRef.current = null
    }
  }, [])

  // Kick off overlay evaluation once authed and both the link dialog and
  // upload wizard are clear. Overlay is mutually exclusive with those — if
  // either implies local data, the overlay predicate short-circuits.
  useEffect(() => {
    if (!authUser || linkDialogUserId || uploadWizardUserId) return
    if (downloadOverlayUserId) return
    void evaluateDownloadOverlay(authUser.id)
  }, [
    authUser,
    linkDialogUserId,
    uploadWizardUserId,
    downloadOverlayUserId,
    evaluateDownloadOverlay,
  ])

  // 2s deferred mount: once the predicate resolves true, wait before
  // rendering the overlay. If the store reaches `complete` before the
  // timer fires, clear the timer and never mount visually (R4).
  useEffect(() => {
    if (!downloadOverlayUserId) {
      setDeferredOverlayReady(false)
      return
    }
    // Check initial state — the store may already be `complete` (e.g.,
    // super-fast engine path) by the time this effect runs.
    if (useDownloadStatusStore.getState().status === 'complete') {
      setDownloadOverlayUserId(null)
      setDeferredOverlayReady(false)
      return
    }
    // Subscribe to the store — if we reach `complete` before the timer,
    // short-circuit out so nothing flashes.
    let fired = false
    const timer = window.setTimeout(() => {
      if (!fired) setDeferredOverlayReady(true)
    }, 2000)
    const unsubscribe = useDownloadStatusStore.subscribe(s => {
      if (s.status === 'complete') {
        fired = true
        window.clearTimeout(timer)
        setDownloadOverlayUserId(null)
        setDeferredOverlayReady(false)
      }
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [downloadOverlayUserId])

  // Reset overlay state on sign-out so it doesn't bleed between users.
  useEffect(() => {
    if (authUser) return
    setDownloadOverlayUserId(null)
    setDeferredOverlayReady(false)
  }, [authUser])

  // Dev/test-only hook: expose a force-mount shim for E2E tests so they can
  // exercise the overlay without requiring a seeded Supabase account. Tree-
  // shaken in production builds.
  useEffect(() => {
    if (import.meta.env.PROD) return // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__forceDownloadOverlay = (userId: string | null) => {
      setDownloadOverlayUserId(userId)
      setDeferredOverlayReady(Boolean(userId))
    }
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__forceDownloadOverlay
    }
  }, [])

  // Dev/test-only hook: expose suppress shim for E2E tests that need to inject
  // a fake auth user without triggering wizard/overlay mounts. The flag must be
  // set BEFORE the auth store mutation (story-97-02 beforeEach). Tree-shaken in
  // production builds.
  useEffect(() => {
    if (import.meta.env.PROD) return // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__suppressSyncOverlays = false
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__suppressSyncOverlays
    }
  }, [])

  // E43-S04: Auth lifecycle hook — session expiry detection, token refresh, settings hydration
  // E92-S08: onUnlinkedDetected defers syncEngine.start() until dialog resolves
  useAuthLifecycle({ onUnlinkedDetected: handleUnlinkedDetected })
  // E92-S07: Sync triggers, offline handling, store refresh registrations
  useSyncLifecycle()

  return (
    <LiveRegionContext.Provider value={{ announce }}>
      <MissingCredentialsProvider>
        {/* Canonical polite live region — role="status" implies aria-live="polite".
            No redundant aria-live attribute per WAI-ARIA implicit roles spec.
            All sync-UX announcements route through announce() rather than each
            component owning its own aria-live span. */}
        <span className="sr-only" role="status" ref={politeRef} />
        {/* Canonical assertive live region — role="alert" implies aria-live="assertive"
            and aria-atomic="true". Used for urgent announcements only. */}
        <span className="sr-only" role="alert" ref={assertiveRef} />
        {children}
        {/* E92-S08: Non-dismissible dialog on first sign-in with pre-existing local data */}
        {linkDialogUserId && (
          <LinkDataDialog
            open={true}
            userId={linkDialogUserId}
            onResolved={() => handleLinkDialogResolved(linkDialogUserId)}
          />
        )}
        {/* E97-S03: Initial upload wizard — first-run backup explainer. */}
        <InitialUploadWizard
          open={uploadWizardUserId !== null && linkDialogUserId === null}
          userId={uploadWizardUserId ?? ''}
          onClose={() => setUploadWizardUserId(null)}
        />
        {/* E97-S04: New-device download overlay — first-run restore UI. */}
        {downloadOverlayUserId && deferredOverlayReady && (
          <NewDeviceDownloadOverlay
            open
            userId={downloadOverlayUserId}
            onClose={() => {
              setDownloadOverlayUserId(null)
              setDeferredOverlayReady(false)
            }}
          />
        )}
        {/* E97-S05: Credential setup banner — surfaces missing per-device credentials
             after first sync. z-index=40 renders below the S04 overlay (z-50).
             Gated on lastSyncAt so it never flashes on new-device sign-in. */}
        <CredentialSetupBanner />
      </MissingCredentialsProvider>
    </LiveRegionContext.Provider>
  )
}
