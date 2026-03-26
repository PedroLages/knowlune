import { useState, useEffect, useCallback, useRef } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from './ui/button'

const DISMISSED_KEY = 'pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * PWA install banner — shows a non-intrusive CTA at the bottom of the screen
 * when the browser fires `beforeinstallprompt`. Respects user dismissal via localStorage.
 */
export function PWAInstallBanner() {
  const [visible, setVisible] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return

    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handlePrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  const handleInstall = useCallback(async () => {
    const prompt = deferredPrompt.current
    if (!prompt) return

    await prompt.prompt()
    const { outcome } = await prompt.userChoice

    if (outcome === 'accepted') {
      setVisible(false)
    }
    deferredPrompt.current = null
  }, [])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setVisible(false)
    deferredPrompt.current = null
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg sm:bottom-6 sm:left-auto sm:right-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
          <Download className="size-5 text-brand-soft-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Install Knowlune</p>
          <p className="text-xs text-muted-foreground">
            Add to your home screen for quick access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="brand" size="sm" onClick={handleInstall}>
            Install
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
