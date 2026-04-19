/**
 * E97-S01: Sync Status Indicator for the app header.
 *
 * Zero-prop Zustand consumer that renders:
 *   - A single icon trigger (44×44 min touch target) colored by sync status.
 *   - An optional badge showing the pending queue depth.
 *   - A Popover with last-sync time, queue depth copy, and (when status is
 *     'error') a Retry now button that invokes the shared runFullSync() utility.
 *
 * See `docs/plans/2026-04-19-021-feat-e97-s01-sync-status-indicator-header-plan.md`.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  Loader2,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { useSyncStatusStore, type SyncStatus } from '@/app/stores/useSyncStatusStore'
import { runFullSync } from '@/lib/sync/runFullSync'

interface StatusConfigEntry {
  /** Icon for the trigger in steady state. Spinner overrides this when syncing. */
  icon: LucideIcon
  /** Design-token text color class (never hardcoded Tailwind colors). */
  colorClass: string
  /** Short label surfaced in the Popover header and aria-label template. */
  label: string
  /** Body copy shown in the Popover when there is no error to display. */
  copy: string
}

const STATUS_CONFIG: Record<SyncStatus, StatusConfigEntry> = {
  synced: {
    icon: CheckCircle2,
    colorClass: 'text-success',
    label: 'Synced',
    copy: 'All changes saved to the cloud.',
  },
  syncing: {
    icon: Loader2, // overridden by reduced-motion fallback below
    colorClass: 'text-brand',
    label: 'Syncing',
    copy: 'Uploading your latest changes.',
  },
  error: {
    icon: TriangleAlert,
    colorClass: 'text-destructive',
    label: 'Sync error',
    copy: 'We hit a problem syncing your latest changes.',
  },
  offline: {
    icon: CloudOff,
    colorClass: 'text-muted-foreground',
    label: 'Offline',
    copy: "You're offline. Changes will sync when you reconnect.",
  },
}

function formatQueueCopy(pendingCount: number): string {
  if (pendingCount <= 0) return 'All changes saved'
  if (pendingCount === 1) return '1 change waiting to upload'
  return `${pendingCount} changes waiting to upload`
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    // Some older browsers only expose addListener/removeListener.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
    mql.addListener(handler)
    return () => mql.removeListener(handler)
  }, [])

  return reduced
}

export function SyncStatusIndicator(): React.ReactElement {
  const status = useSyncStatusStore((s) => s.status)
  const pendingCount = useSyncStatusStore((s) => s.pendingCount)
  const lastSyncAt = useSyncStatusStore((s) => s.lastSyncAt)
  const lastError = useSyncStatusStore((s) => s.lastError)

  const [open, setOpen] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const prevStatusRef = useRef<SyncStatus>(status)
  const [liveMessage, setLiveMessage] = useState('')

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.synced

  // Derived aria-label — silent on normal sync flips; live region (below)
  // only speaks when we transition INTO error/offline, to avoid chatty
  // announcements on every 30s nudge cycle.
  const ariaLabel = useMemo(() => {
    const countSuffix =
      pendingCount > 0
        ? ` ${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} pending.`
        : ''
    return `Sync status: ${config.label}.${countSuffix}`
  }, [config.label, pendingCount])

  // Announce only on transitions INTO error or offline (R4 chatty-SR mitigation).
  useEffect(() => {
    const prev = prevStatusRef.current
    if (prev !== status && (status === 'error' || status === 'offline')) {
      setLiveMessage(
        status === 'error'
          ? `Sync error: ${lastError ?? 'Sync failed'}.`
          : "You're offline. Changes will sync when you reconnect."
      )
    }
    prevStatusRef.current = status
  }, [status, lastError])

  // Refresh pending count when the Popover opens so the displayed number is fresh.
  useEffect(() => {
    if (!open) return
    void useSyncStatusStore.getState().refreshPendingCount()
  }, [open])

  // Retry handler — guarded against racing the periodic/online fullSync. If
  // the engine is already syncing, early return so we don't stamp a duplicate
  // setStatus and corrupt the lifecycle.
  // The setStatus/fullSync/markSyncComplete/catch pattern is shared with
  // SyncSection.handleSyncNow via runFullSync() to avoid duplication.
  async function handleRetry(): Promise<void> {
    const current = useSyncStatusStore.getState().status
    if (current === 'syncing') return // race guard: already in-flight

    try {
      await runFullSync()
    } catch (message) {
      // runFullSync() already called setStatus('error', message) and re-threw
      // the classified string. We just need to surface it to the user.
      console.error('[SyncStatusIndicator] Retry fullSync failed:', message)
      toast.error(message as string)
      // Refresh badge so it reflects actual queue depth after failed retry.
      await useSyncStatusStore.getState().refreshPendingCount()
    }
  }

  // Icon selection:
  // - For `syncing`: use the Loader2 spinner. Tailwind's `motion-reduce:animate-none`
  //   would strip the animation but keep the spinner shape, which still *looks*
  //   like it should be moving. To be maximally conservative with WCAG 2.3.3
  //   (Animation from Interactions) we swap to a static Cloud icon when
  //   prefers-reduced-motion is set, rather than rendering a still spinner or
  //   a pulsing dot (pulse animations can also trigger vestibular sensitivities).
  // - For every other status: use the configured static icon.
  const TriggerIcon: LucideIcon =
    status === 'syncing' ? (reducedMotion ? Cloud : Loader2) : config.icon

  const showSpinnerAnimation = status === 'syncing' && !reducedMotion

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Polite live region: announces only on transitions into error/offline.
          Placed OUTSIDE the button so it doesn't override the native button
          role or produce chatty SR announcements on every 30s nudge cycle. */}
      <span className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </span>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          data-testid="sync-status-indicator"
          data-sync-status={status}
          className="relative inline-flex items-center justify-center size-11 min-h-[44px] min-w-[44px] rounded-md hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <TriggerIcon
            className={`size-5 ${config.colorClass} ${
              showSpinnerAnimation ? 'animate-spin motion-reduce:animate-none' : ''
            }`}
            aria-hidden="true"
            data-testid="sync-status-icon"
          />
          {pendingCount > 0 && (
            <Badge
              variant="secondary"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[10px] font-semibold tabular-nums"
              aria-hidden="true"
              data-testid="sync-status-badge"
            >
              {pendingCount > 99 ? '99+' : pendingCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TriggerIcon
              className={`size-4 ${config.colorClass} ${
                showSpinnerAnimation ? 'animate-spin motion-reduce:animate-none' : ''
              }`}
              aria-hidden="true"
            />
            <p className="font-semibold text-sm">{config.label}</p>
          </div>

          <p className="text-sm text-muted-foreground">{config.copy}</p>

          <dl className="text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Last sync</dt>
              <dd
                className="text-foreground"
                title={lastSyncAt ? lastSyncAt.toISOString() : undefined}
              >
                {lastSyncAt
                  ? formatDistanceToNow(lastSyncAt, { addSuffix: true })
                  : 'Not synced yet'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Pending</dt>
              <dd className="text-foreground">{formatQueueCopy(pendingCount)}</dd>
            </div>
          </dl>

          {status === 'error' && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-2"
            >
              <p className="text-sm text-destructive">{lastError ?? 'Sync failed'}</p>
              <Button
                variant="brand"
                size="sm"
                onClick={handleRetry}
                disabled={false}
                aria-disabled={false}
                aria-label="Retry sync now"
                className="w-full gap-2"
                data-testid="sync-retry-button"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry now
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
