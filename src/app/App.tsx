import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RouterProvider } from 'react-router'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/app/components/ui/sonner'
import { Agentation } from 'agentation'
import { router } from './routes'
import { useSessionStore } from '@/stores/useSessionStore'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { PWAInstallBanner } from '@/app/components/PWAInstallBanner'
import { WelcomeWizard } from '@/app/components/WelcomeWizard'
import { initErrorTracking } from '@/lib/errorTracking'
import { vectorStorePersistence } from '@/ai/vector-store'
import { embeddingPipeline } from '@/ai/embeddingPipeline'
import { initWorkerCrashTelemetry } from '@/ai/workers/workerCrashTelemetry'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'
import { EmbeddingModelProgressToast } from '@/app/components/embeddings/EmbeddingModelProgressToast'
import { refreshStaleMetadata } from '@/lib/youtubeMetadataRefresh'
import { useFontScale } from '@/hooks/useFontScale'
import { useWelcomeWizardStore } from '@/stores/useWelcomeWizardStore'
import { useColorScheme } from '@/hooks/useColorScheme'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useAccessibilityFont } from '@/hooks/useAccessibilityFont'
import { useContentDensity } from '@/hooks/useContentDensity'
import { MotionConfig } from 'motion/react'
import { SyncUXShell } from '@/app/components/sync/SyncUXShell'
import { initNotificationService, destroyNotificationService } from '@/services/NotificationService'
import { useNotificationPrefsStore } from '@/stores/useNotificationPrefsStore'

// Register global error handlers (window.onerror, unhandledrejection)
initErrorTracking()

export default function App() {
  useColorScheme() // Applies .vibrant class on <html> based on settings (E21-S04)
  const { shouldReduceMotion } = useReducedMotion()
  const { initialize: initWizard } = useWelcomeWizardStore()

  // Chunk recovery: clear the recovery marker after the app renders
  // successfully. We use a timeout to ensure at least one lazy route has
  // had a chance to load. The key is only removed from sessionStorage if
  // the app hasn't crashed (i.e., this effect runs = React rendered).
  useEffect(() => {
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null
    import('@/lib/chunkRecovery').then(({ clearRecoveryMarker }) => {
      cleanupTimer = setTimeout(() => {
        clearRecoveryMarker()
      }, 3000) // Give lazy routes time to load before clearing
    })
    return () => {
      if (cleanupTimer !== null) clearTimeout(cleanupTimer)
    }
  }, [])

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

  // AC5: Recover orphaned sessions on app init (getState avoids subscribing App to heartbeat churn)
  useEffect(() => {
    void useSessionStore.getState().recoverOrphanedSessions()
  }, [])

  // Initialize welcome wizard (shows on first visit only)
  useEffect(() => {
    initWizard()
  }, [initWizard])

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

  // E68-S03: Initialize worker crash telemetry subscriber.
  // Subscribes to 'worker-crash' CustomEvent and logs structured telemetry.
  // Deduplicates repeated crashes with the same requestId.
  useEffect(() => {
    const unsubscribe = initWorkerCrashTelemetry()
    return () => unsubscribe()
  }, [])

  // E68-S01: Pre-warm the embedding model after a brief idle period so the first
  // real embed request is instant. Gated on deviceMemory >= 4GB (skips warm-up
  // on low-memory devices to avoid OOM). Uses requestIdleCallback to avoid
  // competing with initial page render and data loading.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!supportsWorkers()) return

      const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory

      // Skip warm-up if we know the device has < 4GB RAM.
      // If deviceMemory is undefined (unsupported browser), proceed conservatively.
      if (deviceMemory !== undefined && deviceMemory < 4) {
        console.log('[App] Skipping embedding warm-up: deviceMemory < 4GB')
        return
      }

      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          embeddingPipeline.warmUp().catch(() => {
            // Best-effort — silent catch
          })
        })
      } else {
        // Fallback for browsers without requestIdleCallback
        embeddingPipeline.warmUp().catch(() => {
          // Best-effort — silent catch
        })
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <MotionConfig reducedMotion={shouldReduceMotion ? 'always' : 'never'}>
          <SyncUXShell>
            <RouterProvider router={router} />
            <Toaster style={{ zIndex: 51 }} />
            <EmbeddingModelProgressToast />
            <WelcomeWizard />
            <PWAInstallBanner />
            {process.env.NODE_ENV === 'development' &&
              !__PLAYWRIGHT_TEST__ &&
              createPortal(<Agentation />, document.body)}
          </SyncUXShell>
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
