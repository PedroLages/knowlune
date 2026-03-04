import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/app/components/ui/sonner'
import { router } from './routes'
import { useSessionStore } from '@/stores/useSessionStore'

export default function App() {
  const { recoverOrphanedSessions } = useSessionStore()

  // AC5: Recover orphaned sessions on app init
  useEffect(() => {
    recoverOrphanedSessions()
  }, [recoverOrphanedSessions])

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  )
}
