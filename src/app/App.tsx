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
import { useFontScale } from '@/hooks/useFontScale'
import { useWelcomeWizardStore } from '@/stores/useWelcomeWizardStore'

// Register global error handlers (window.onerror, unhandledrejection)
initErrorTracking()

export default function App() {
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

  // Load vector embeddings from IndexedDB on startup
  useEffect(() => {
    if (supportsWorkers()) {
      vectorStorePersistence
        .loadAll()
        .catch(err => console.error('[App] Vector store init failed:', err))
    }
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
