import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RouterProvider } from 'react-router'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/app/components/ui/sonner'
import { Agentation } from 'agentation'
import { router } from './routes'
import { useSessionStore } from '@/stores/useSessionStore'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { PWAUpdatePrompt } from '@/app/components/PWAUpdatePrompt'
import { PWAInstallBanner } from '@/app/components/PWAInstallBanner'
import { WelcomeWizard } from '@/app/components/WelcomeWizard'
import { initErrorTracking } from '@/lib/errorTracking'
import { vectorStorePersistence } from '@/ai/vector-store'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'
import { refreshStaleMetadata } from '@/lib/youtubeMetadataRefresh'
import { useFontScale } from '@/hooks/useFontScale'
import { useWelcomeWizardStore } from '@/stores/useWelcomeWizardStore'
import { useColorScheme } from '@/hooks/useColorScheme'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useAccessibilityFont } from '@/hooks/useAccessibilityFont'
import { useContentDensity } from '@/hooks/useContentDensity'
import { MotionConfig } from 'motion/react'
import { useAuthLifecycle } from '@/app/hooks/useAuthLifecycle'
import { useSyncLifecycle } from '@/app/hooks/useSyncLifecycle'
import { LinkDataDialog } from '@/app/components/sync/LinkDataDialog'
import { InitialUploadWizard } from '@/app/components/sync/InitialUploadWizard'
import { NewDeviceDownloadOverlay } from '@/app/components/sync/NewDeviceDownloadOverlay'
import { shouldShowInitialUploadWizard } from '@/lib/sync/shouldShowInitialUploadWizard'
import { shouldShowDownloadOverlay } from '@/lib/sync/shouldShowDownloadOverlay'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { initNotificationService, destroyNotificationService } from '@/services/NotificationService'
import { useNotificationPrefsStore } from '@/stores/useNotificationPrefsStore'

// Register global error handlers (window.onerror, unhandledrejection)
initErrorTracking()

export default function App() {
  useColorScheme() // Applies .vibrant class on <html> based on settings (E21-S04)
  const { shouldReduceMotion } = useReducedMotion()
  const { recoverOrphanedSessions } = useSessionStore()
  const { initialize: initWizard } = useWelcomeWizardStore()

  // Apply font scaling from persisted settings
  useFontScale()

  // E51-S03: Apply accessibility font (Atkinson Hyperlegible) if enabled
  useAccessibilityFont()

  // E51-S04: Toggle .spacious class on <html> based on content density setting
  useContentDensity()

  // E51-S02: Toggle .reduce-motion class on <html> based on app setting
  useEffect(() => {
    const root = document.documentElement
    if (shouldReduceMotion) {
      root.classList.add('reduce-motion')
    } else {
      root.classList.remove('reduce-motion')
    }
    return () => root.classList.remove('reduce-motion')
  }, [shouldReduceMotion])

  // AC5: Recover orphaned sessions on app init
  useEffect(() => {
    recoverOrphanedSessions()
  }, [recoverOrphanedSessions])

  // Initialize welcome wizard (shows on first visit only)
  useEffect(() => {
    initWizard()
  }, [initWizard])

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
  const authUser = useAuthStore((s) => s.user)

  const evaluateWizard = useCallback(async (userId: string) => {
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
    [evaluateWizard],
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
    const unsubscribe = useDownloadStatusStore.subscribe((s) => {
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

  // E43-S04: Auth lifecycle hook — session expiry detection, token refresh, settings hydration
  // E92-S08: onUnlinkedDetected defers syncEngine.start() until dialog resolves
  useAuthLifecycle({ onUnlinkedDetected: handleUnlinkedDetected })
  // E92-S07: Sync triggers, offline handling, store refresh registrations
  useSyncLifecycle()

  // Load notification preferences before subscribing to domain events
  useEffect(() => {
    useNotificationPrefsStore.getState().init()
  }, [])

  // E43-S07: Initialize notification service (subscribe to domain events)
  useEffect(() => {
    initNotificationService()
    return () => destroyNotificationService()
  }, [])

  // Load vector embeddings from IndexedDB on startup
  useEffect(() => {
    if (supportsWorkers()) {
      vectorStorePersistence.loadAll().catch(err => {
        // silent-catch-ok — non-critical background initialization
        console.error('[App] Vector store init failed:', err)
      })
    }
  }, [])

  // E28-S12: Background refresh of stale YouTube metadata (non-blocking, rate-limited)
  useEffect(() => {
    refreshStaleMetadata().catch(err => {
      // silent-catch-ok — non-critical background task
      console.warn('[App] YouTube metadata refresh failed:', err)
    })
  }, [])

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <MotionConfig reducedMotion={shouldReduceMotion ? 'always' : 'never'}>
          <RouterProvider router={router} />
          <Toaster />
          <WelcomeWizard />
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
          {import.meta.env.PROD && <PWAUpdatePrompt />}
          <PWAInstallBanner />
          {process.env.NODE_ENV === 'development' && createPortal(<Agentation />, document.body)}
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
