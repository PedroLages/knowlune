/**
 * PWA Install Banner — prompts users to install the app when
 * the browser fires the `beforeinstallprompt` event.
 *
 * Behavior:
 * - Listens for `beforeinstallprompt` and captures the deferred prompt
 * - Shows a banner with Install and Dismiss actions
 * - Dismissal is persisted in localStorage
 * - Does not show in standalone mode (already installed)
 * - Cleans up event listener on unmount
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/app/components/ui/button'
import { X } from 'lucide-react'

const DISMISSED_KEY = 'pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: string }>
}

export function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  const isStandalone =
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

  const handleBeforeInstallPrompt = useCallback(
    (e: Event) => {
      e.preventDefault()

      // Don't show if already dismissed or in standalone mode
      if (localStorage.getItem(DISMISSED_KEY) || isStandalone) {
        return
      }

      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setShowBanner(true)
    },
    [isStandalone]
  )

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [handleBeforeInstallPrompt])

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current
    if (!prompt) return

    await prompt.prompt()
    deferredPromptRef.current = null
    setShowBanner(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div
      role="banner"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border bg-card p-4 shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Install Knowlune</p>
          <p className="text-xs text-muted-foreground">
            Add to your home screen for the best experience
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="brand" onClick={handleInstall}>
            Install
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
