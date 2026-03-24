import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/app/components/ui/sonner'
import { Agentation } from 'agentation'
import { router } from './routes'
import { useSessionStore } from '@/stores/useSessionStore'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { PWAUpdatePrompt } from '@/app/components/PWAUpdatePrompt'
import { initErrorTracking } from '@/lib/errorTracking'
import { vectorStorePersistence } from '@/ai/vector-store'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'
import { useColorScheme } from '@/hooks/useColorScheme'

// Register global error handlers (window.onerror, unhandledrejection)
initErrorTracking()

export default function App() {
  useColorScheme() // Applies .vibrant class on <html> based on settings (E21-S04)
  const { recoverOrphanedSessions } = useSessionStore()

  // AC5: Recover orphaned sessions on app init
  useEffect(() => {
    recoverOrphanedSessions()
  }, [recoverOrphanedSessions])

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
        {import.meta.env.PROD && <PWAUpdatePrompt />}
        {process.env.NODE_ENV === 'development' && <Agentation />}
      </ThemeProvider>
    </ErrorBoundary>
  )
}
