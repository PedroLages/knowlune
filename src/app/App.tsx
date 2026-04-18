import { useCallback, useEffect, useState } from 'react'
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

  // Stable callback — useAuthLifecycle's dependency array includes this.
  // useCallback with [] ensures the effect never re-registers unnecessarily.
  const handleUnlinkedDetected = useCallback((userId: string) => {
    setLinkDialogUserId(userId)
  }, [])

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
              onResolved={() => setLinkDialogUserId(null)}
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
