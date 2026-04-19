/**
 * E97-S02: Sync Settings Panel.
 *
 * User-facing panel that composes existing sync primitives (useSyncStatusStore,
 * syncEngine, resetLocalData) into a Settings section with:
 *   - Auto-sync toggle (persists via saveSettings, starts/stops engine).
 *   - Status readout: last-sync time, total-synced items, pending upload count.
 *   - "Sync Now" manual trigger (syncEngine.fullSync).
 *   - Destructive "Clear local data and re-sync" escape hatch (resetLocalData).
 *
 * Auth-gated: returns null when no user is signed in. The Settings nav entry
 * for this section remains present in the category list for discoverability,
 * so the empty render is the graceful fallback.
 *
 * @since E97-S02
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Cloud, RefreshCw, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
import { Switch } from '@/app/components/ui/switch'
import { Spinner } from '@/app/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'
import { syncEngine } from '@/lib/sync/syncEngine'
import { resetLocalData } from '@/lib/sync/resetLocalData'
import { tableRegistry } from '@/lib/sync/tableRegistry'
import { getSettings, saveSettings } from '@/lib/settings'
import { useAuthStore } from '@/stores/useAuthStore'
import { db } from '@/db'
import { toastSuccess, toastError } from '@/lib/toastHelpers'
import { classifyError } from '@/lib/sync/classifyError'

/**
 * Count syncable rows across every non-skipped table. Runs Promise.all to
 * parallelize the Dexie count() reads. Returns 0 on error so a Dexie hiccup
 * never prevents the panel from rendering.
 */
async function computeTotalSyncedItems(): Promise<number> {
  try {
    const dbAny = db as unknown as Record<
      string,
      { count: () => Promise<number> } | undefined
    >
    const counts = await Promise.all(
      tableRegistry
        .filter((entry) => !entry.skipSync)
        .map(async (entry) => {
          const table = dbAny[entry.dexieTable]
          if (!table || typeof table.count !== 'function') return 0
          try {
            return await table.count()
          } catch {
            // silent-catch-ok — per-table count failures reduce the aggregate;
            // surfacing each one would spam the user. Total is advisory.
            return 0
          }
        })
    )
    return counts.reduce((sum, n) => sum + n, 0)
  } catch (err) {
    // silent-catch-ok — the count is an advisory readout. A Dexie blip here
    // should not break the panel or spam the user with a toast.
    console.warn('[SyncSection] computeTotalSyncedItems failed:', err)
    return 0
  }
}

export function SyncSection() {
  const user = useAuthStore((s) => s.user)
  const status = useSyncStatusStore((s) => s.status)
  const lastSyncAt = useSyncStatusStore((s) => s.lastSyncAt)
  const pendingCount = useSyncStatusStore((s) => s.pendingCount)
  const lastError = useSyncStatusStore((s) => s.lastError)

  // Local preference mirror — rehydrated on settingsUpdated so external writes
  // (other sections, other tabs) do not leave this toggle stale.
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return getSettings().autoSyncEnabled !== false
  })
  const [busy, setBusy] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )

  // Refresh the local preference mirror from localStorage on external changes.
  useEffect(() => {
    function onSettingsUpdate() {
      setAutoSyncEnabled(getSettings().autoSyncEnabled !== false)
    }
    window.addEventListener('settingsUpdated', onSettingsUpdate)
    return () => window.removeEventListener('settingsUpdated', onSettingsUpdate)
  }, [])

  // Track online/offline for the Sync Now disabled state + tooltip.
  useEffect(() => {
    function onOnline() {
      setIsOffline(false)
    }
    function onOffline() {
      setIsOffline(true)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Recompute item count on mount and every time a sync completes
  // (lastSyncAt advances in markSyncComplete). This avoids a live per-table
  // subscription at the cost of a short delay between commit and display.
  useEffect(() => {
    let cancelled = false
    void computeTotalSyncedItems().then((count) => {
      if (!cancelled) setTotalItems(count)
    })
    return () => {
      cancelled = true
    }
  }, [lastSyncAt])

  // Refresh pendingCount immediately when the panel mounts so the user sees
  // a current number instead of whatever the last lifecycle tick recorded.
  // Also re-refresh when lastSyncAt advances (post-sync) or when the tab
  // becomes visible again (F5: pendingCount can grow while auto-sync is paused).
  useEffect(() => {
    void useSyncStatusStore.getState().refreshPendingCount()
  }, [lastSyncAt])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void useSyncStatusStore.getState().refreshPendingCount()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const relativeLastSync = useMemo(() => {
    if (!lastSyncAt) return 'Never synced'
    try {
      return `Last synced ${formatDistanceToNow(lastSyncAt, { addSuffix: true })}`
    } catch {
      // silent-catch-ok — formatDistanceToNow only throws on invalid Date;
      // fall back to a neutral label rather than blowing up the render.
      return 'Last sync unknown'
    }
  }, [lastSyncAt])

  const handleToggle = useCallback(
    (next: boolean) => {
      setAutoSyncEnabled(next)
      saveSettings({ autoSyncEnabled: next })
      // Broadcast so the lifecycle hook (and any other listeners) react.
      window.dispatchEvent(new Event('settingsUpdated'))
      if (!user) return
      try {
        if (next) {
          void syncEngine.start(user.id).catch((err) => {
            console.error('[SyncSection] start after toggle failed:', err)
            toastError.saveFailed(classifyError(err))
          })
        } else {
          syncEngine.stop()
        }
      } catch (err) {
        // silent-catch-ok — the preference is already persisted; surface engine
        // transition errors only in the console. The user's intent (toggle)
        // succeeded from their perspective.
        console.error('[SyncSection] toggle engine transition failed:', err)
      }
    },
    [user]
  )

  const handleSyncNow = useCallback(async () => {
    if (busy) return
    if (useSyncStatusStore.getState().status === 'syncing') return
    setBusy(true)
    try {
      useSyncStatusStore.getState().setStatus('syncing')
      await syncEngine.fullSync()
      useSyncStatusStore.getState().markSyncComplete()
      void useSyncStatusStore.getState().refreshPendingCount()
      // Recompute item count — fullSync may have downloaded new rows.
      void computeTotalSyncedItems().then(setTotalItems)
      toastSuccess.saved('Sync complete')
    } catch (err) {
      console.error('[SyncSection] Sync Now failed:', err)
      const message = classifyError(err)
      useSyncStatusStore.getState().setStatus('error', message)
      toastError.saveFailed(message)
    } finally {
      setBusy(false)
    }
  }, [busy])

  const handleConfirmReset = useCallback(async () => {
    if (isResetting) return
    setIsResetting(true)
    try {
      await resetLocalData(user?.id ?? null)
      void computeTotalSyncedItems().then(setTotalItems)
      void useSyncStatusStore.getState().refreshPendingCount()
      toastSuccess.reset('Local data')
    } catch (err) {
      console.error('[SyncSection] resetLocalData failed:', err)
      toastError.saveFailed(classifyError(err))
    } finally {
      setIsResetting(false)
      setResetDialogOpen(false)
    }
  }, [isResetting, user?.id])

  // Auth gate — when signed out, render nothing. The nav entry is always
  // visible for discoverability; the empty render is the graceful fallback.
  if (!user) return null

  const syncNowDisabled = busy || status === 'syncing' || isOffline
  const isSyncing = busy || status === 'syncing'

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6" data-testid="sync-section">
        {/* Auto-sync + status */}
        <Card>
          <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-brand-soft p-2">
                <Cloud className="size-5 text-brand" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-display">Cloud Sync</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Keep your library in sync across devices
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Auto-sync toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <label
                  htmlFor="auto-sync-toggle"
                  className="text-sm font-medium cursor-pointer"
                >
                  Auto-sync
                </label>
                <p className="text-xs text-muted-foreground">
                  Automatically upload changes and download updates while online
                </p>
              </div>
              <Switch
                id="auto-sync-toggle"
                checked={autoSyncEnabled}
                onCheckedChange={handleToggle}
                aria-label="Toggle automatic cloud sync"
                data-testid="auto-sync-switch"
              />
            </div>

            <Separator />

            {/* Status readout */}
            <div className="space-y-2" data-testid="sync-status-readout">
              <div className="flex items-center gap-2 text-sm">
                {isSyncing ? (
                  <Spinner className="size-4 text-brand" aria-hidden="true" />
                ) : (
                  <RefreshCw
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                {lastSyncAt ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-muted-foreground"
                        data-testid="sync-last-sync"
                      >
                        {relativeLastSync}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{lastSyncAt.toISOString()}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span
                    className="text-muted-foreground"
                    data-testid="sync-last-sync"
                  >
                    Never synced
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                <span data-testid="sync-total-items">{totalItems.toLocaleString()}</span>{' '}
                items synced &middot;{' '}
                <span data-testid="sync-pending-count">{pendingCount}</span> pending upload
              </p>
              {status === 'error' && lastError && (
                <p
                  className="text-xs text-destructive flex items-center gap-1.5"
                  data-testid="sync-last-error"
                  role="alert"
                >
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                  {lastError}
                </p>
              )}
            </div>

            <Separator />

            {/* Sync Now */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Sync Now</p>
                <p className="text-xs text-muted-foreground">
                  Force an immediate upload + download cycle
                </p>
              </div>
              {isOffline ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* Wrap disabled button in span so the tooltip still fires on hover */}
                    <span className="inline-flex">
                      <Button
                        variant="brand"
                        onClick={handleSyncNow}
                        disabled
                        className="gap-2 min-h-[44px]"
                        aria-label="Sync now"
                        data-testid="sync-now-button"
                      >
                        {isSyncing ? (
                          <Spinner className="size-4" />
                        ) : (
                          <RefreshCw className="size-4" aria-hidden="true" />
                        )}
                        Sync Now
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>You&apos;re offline</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="brand"
                  onClick={handleSyncNow}
                  disabled={syncNowDisabled}
                  className="gap-2 min-h-[44px]"
                  aria-label="Sync now"
                  data-testid="sync-now-button"
                >
                  {isSyncing ? (
                    <Spinner className="size-4" />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden="true" />
                  )}
                  Sync Now
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Danger zone — clear local data and re-sync */}
        <Card
          className="border-destructive/30"
          data-testid="sync-danger-zone"
        >
          <CardHeader className="border-b border-destructive/20 bg-destructive/5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-display text-destructive">Danger Zone</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Escape hatch for recovering from local data corruption
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  Clear local data and re-sync
                </p>
                <p className="text-xs text-muted-foreground">
                  Wipes every locally stored record and re-downloads everything from the cloud.
                  Any un-synced pending writes will be lost.
                </p>
              </div>
              <AlertDialog
                open={resetDialogOpen}
                onOpenChange={(open) => !isResetting && setResetDialogOpen(open)}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="gap-2 min-h-[44px] shrink-0"
                    aria-label="Clear local data and re-sync from cloud"
                    data-testid="sync-reset-button"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Clear & Re-sync
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear local data and re-sync?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This wipes every note, bookmark, book, flashcard, and progress record
                      stored on this device, then re-downloads the data from the cloud.
                      Any changes that have not finished syncing will be lost. This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {isResetting && (
                    <div
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                      data-testid="sync-reset-progress"
                      role="status"
                    >
                      <Spinner className="size-4" aria-hidden="true" />
                      Restoring from cloud&hellip;
                    </div>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault()
                        void handleConfirmReset()
                      }}
                      disabled={isResetting}
                      className="bg-destructive hover:bg-destructive/90"
                      data-testid="sync-reset-confirm"
                    >
                      Clear & Re-sync
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
