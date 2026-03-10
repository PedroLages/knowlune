import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/app/components/ui/sonner'
import { Agentation } from 'agentation'
import { router } from './routes'
import { useSessionStore } from '@/stores/useSessionStore'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { initErrorTracking } from '@/lib/errorTracking'

// Register global error handlers (window.onerror, unhandledrejection)
initErrorTracking()

export default function App() {
  const { recoverOrphanedSessions } = useSessionStore()

  // AC5: Recover orphaned sessions on app init
  useEffect(() => {
    recoverOrphanedSessions()
  }, [recoverOrphanedSessions])

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <RouterProvider router={router} />
        <Toaster />
        {process.env.NODE_ENV === 'development' && <Agentation />}
      </ThemeProvider>
    </ErrorBoundary>
  )
}
