/**
 * PWAUpdatePrompt — surfaces a non-blocking banner when the service worker
 * detects a new version is available, allowing the user to reload immediately
 * or defer the update.
 *
 * Behavior:
 * - Listens for needRefresh via useRegisterSW
 * - Polls for SW updates every hour (onRegisteredSW interval)
 * - Shows a fixed bottom banner with "Reload" and "Later" actions
 * - Dismissing hides the banner without reloading (SW update deferred to next visit)
 * - Reload triggers service worker skipWaiting and page reload
 *
 * @since E120-S02
 */

import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/app/components/ui/button'

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Poll for SW updates every hour
        setInterval(() => registration.update(), 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('[PWA] SW registration error:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border bg-card p-4 shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">New version available</p>
          <p className="text-xs text-muted-foreground">Reload to get the latest features.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="brand" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
        </div>
      </div>
    </div>
  )
}
