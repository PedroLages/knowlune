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

import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/app/components/ui/button'

export function PWAUpdatePrompt() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [protocolBlocked, setProtocolBlocked] = useState(false)

  useEffect(() => {
    let active = true
    const checkVersion = async () => {
      try {
        const response = await fetch(
          `/version.json?sync-check=${encodeURIComponent(__APP_VERSION__)}`,
          {
            cache: 'no-store',
            headers: { 'cache-control': 'no-cache' },
          }
        )
        if (!response.ok) return
        const remote = (await response.json()) as { syncProtocol?: number }
        if (active && Number(remote.syncProtocol ?? 0) > __SYNC_PROTOCOL_VERSION__) {
          setProtocolBlocked(true)
        }
      } catch (error) {
        // silent-catch-ok — update checks are best effort and must not block the app.
        console.error('[PWA] version check failed:', error)
      }
    }

    void checkVersion()
    const interval = setInterval(checkVersion, 5 * 60 * 1000)
    const handleRefresh = () => void checkVersion()
    window.addEventListener('focus', handleRefresh)
    window.addEventListener('online', handleRefresh)
    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener('online', handleRefresh)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [])

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        if (intervalRef.current !== null) clearInterval(intervalRef.current)
        // Poll for SW updates every five minutes; version checks below use the
        // same cadence so protocol changes cannot remain stale for an hour.
        intervalRef.current = setInterval(() => registration.update(), 5 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('[PWA] SW registration error:', error)
    },
  })

  if (protocolBlocked) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-background/95 p-6">
        <div
          role="alertdialog"
          aria-modal="true"
          className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl"
        >
          <h2 className="text-lg font-semibold">Reload required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This app version cannot safely sync your courses. Reload to continue syncing.
          </p>
          <Button
            className="mt-5 w-full"
            variant="brand"
            onClick={() => {
              void updateServiceWorker(true)
              window.location.reload()
            }}
          >
            Reload now
          </Button>
        </div>
      </div>
    )
  }

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
