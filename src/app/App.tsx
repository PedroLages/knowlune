import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/app/components/ui/sonner'
import { Agentation } from 'agentation'
import { router } from './routes'
import { useSessionStore } from '@/stores/useSessionStore'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { PWAUpdatePrompt } from '@/app/components/PWAUpdatePrompt'
import { WelcomeWizard } from '@/app/components/WelcomeWizard'
import { initErrorTracking } from '@/lib/errorTracking'
import { vectorStorePersistence } from '@/ai/vector-store'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'
import { refreshStaleMetadata } from '@/lib/youtubeMetadataRefresh'
import { useFontScale } from '@/hooks/useFontScale'
import { useWelcomeWizardStore } from '@/stores/useWelcomeWizardStore'
import { useColorScheme } from '@/hooks/useColorScheme'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { hydrateSettingsFromSupabase } from '@/lib/settings'

// Register global error handlers (window.onerror, unhandledrejection)
initErrorTracking()

export default function App() {
  useColorScheme() // Applies .vibrant class on <html> based on settings (E21-S04)
  const { recoverOrphanedSessions } = useSessionStore()
  const { initialize: initWizard } = useWelcomeWizardStore()

  // Apply font scaling from persisted settings
  useFontScale()

  // AC5: Recover orphaned sessions on app init
  useEffect(() => {
    recoverOrphanedSessions()
  }, [recoverOrphanedSessions])

  // Initialize welcome wizard (shows on first visit only)
  useEffect(() => {
    initWizard()
  }, [initWizard])

  // E19-S01: Subscribe to Supabase auth state changes (session restore, token refresh, cross-tab sync)
  useEffect(() => {
    if (!supabase) return
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      useAuthStore.getState().setSession(session)
      // Hydrate localStorage settings from Supabase user_metadata on sign-in
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        hydrateSettingsFromSupabase(session.user.user_metadata)
      }
    })
    return () => subscription.unsubscribe()
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
        <RouterProvider router={router} />
        <Toaster />
        <WelcomeWizard />
        {import.meta.env.PROD && <PWAUpdatePrompt />}
        {process.env.NODE_ENV === 'development' && <Agentation />}
      </ThemeProvider>
    </ErrorBoundary>
  )
}
