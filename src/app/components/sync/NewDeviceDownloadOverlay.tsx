/**
 * E97-S04: New-Device Download Overlay.
 *
 * Symmetric counterpart to the E97-S03 Initial Upload Wizard. Shows on first
 * sign-in from a device with an empty Dexie when Supabase already has the
 * user's data to restore. Renders phase-aware progress and a Retry affordance
 * across two phases:
 *
 *   hydrating-p3p4 → downloading-p0p2 → success
 *         │                 │
 *         └── error ◀──────┘
 *
 * Observes the ambient `useDownloadStatusStore` phase machine. Does NOT
 * modify the sync engine — restart semantics live in the engine's own
 * lifecycle hooks.
 *
 * @see docs/plans/2026-04-19-025-feat-e97-s04-new-device-download-experience-plan.md
 * @since E97-S04
 */
import { useEffect, useRef, useState } from 'react'
import { CloudDownload, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'
import { useDownloadProgress } from '@/app/hooks/useDownloadProgress'
import { useDownloadEngineWatcher } from '@/app/hooks/useDownloadEngineWatcher'
import { observedHydrate } from '@/lib/sync/observedHydrate'

type VisualPhase = 'hydrating-p3p4' | 'downloading-p0p2' | 'success' | 'error'

/** Watchdog — if the overlay stays in an active phase this long, surface an error. */
const WATCHDOG_MS = 60_000
/** Delay between `complete` and `onClose()` so the success state is perceptible. */
const SUCCESS_CLOSE_DELAY_MS = 250

const TABLE_LABELS: Record<string, string> = {
  notes: 'notes',
  books: 'books',
  flashcards: 'flashcards',
  contentProgress: 'course progress',
  studySessions: 'study sessions',
  progress: 'lesson progress',
  bookHighlights: 'highlights',
  audioBookmarks: 'audio bookmarks',
  learningPaths: 'learning paths',
  challenges: 'challenges',
  authors: 'authors',
  quizzes: 'quizzes',
}

function humanizeTable(name: string | null): string {
  if (!name) return ''
  return TABLE_LABELS[name] ?? name
}

export interface NewDeviceDownloadOverlayProps {
  open: boolean
  userId: string
  onClose: () => void
}

export function NewDeviceDownloadOverlay({ open, userId, onClose }: NewDeviceDownloadOverlayProps) {
  const storeStatus = useDownloadStatusStore(s => s.status)
  const storeError = useDownloadStatusStore(s => s.lastError)

  // Force a remount of the progress hook on retry so it re-snapshots HEAD counts.
  const [retryNonce, setRetryNonce] = useState(0)

  // Mount watcher and progress hook while the overlay is open.
  // retryNonce is passed as the third argument so the hook re-snapshots HEAD
  // counts and resets all refs on each retry (F1 fix).
  useDownloadEngineWatcher(userId, open)
  const progress = useDownloadProgress(userId, open, retryNonce)

  // Derived visual phase — store drives most of it, with the
  // `useDownloadProgress` all-HEAD-fail error taking precedence.
  const visualPhase = derivePhase(storeStatus, progress.error)

  // Watchdog timer — arms when we enter an active phase, disarms on terminal.
  useEffect(() => {
    if (!open) return
    const isActive = storeStatus === 'hydrating-p3p4' || storeStatus === 'downloading-p0p2'
    if (!isActive) return
    const timer = window.setTimeout(() => {
      // Only fire if still active (no concurrent transition).
      const latest = useDownloadStatusStore.getState().status
      if (latest === 'hydrating-p3p4' || latest === 'downloading-p0p2') {
        useDownloadStatusStore.getState().failDownloading('Taking longer than expected.')
      }
    }, WATCHDOG_MS)
    return () => window.clearTimeout(timer)
  }, [open, storeStatus])

  // Forward the all-HEAD-fail error to the store so Phase A/B observers
  // halt (there is no way to complete without a remote total).
  const headFailedSyncedRef = useRef(false)
  useEffect(() => {
    if (!open) return
    if (progress.error && !headFailedSyncedRef.current) {
      headFailedSyncedRef.current = true
      const current = useDownloadStatusStore.getState().status
      if (current !== 'error' && current !== 'complete') {
        useDownloadStatusStore
          .getState()
          .failDownloading(
            progress.errorMessage ?? 'Could not determine remote totals — check your connection.'
          )
      }
    }
    if (!progress.error) {
      headFailedSyncedRef.current = false
    }
  }, [open, progress.error, progress.errorMessage])

  // Auto-close after success.
  useEffect(() => {
    if (!open) return
    if (storeStatus !== 'complete') return
    // Belt-and-suspenders: wait for processed >= total OR progress.done
    // before closing. A complete store with no remote total still closes.
    if (!progress.done && progress.total > 0 && progress.processed < progress.total) {
      return
    }
    const timer = window.setTimeout(() => {
      onClose()
    }, SUCCESS_CLOSE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [open, storeStatus, progress.done, progress.total, progress.processed, onClose])

  if (!open || !userId) return null

  function handleRetry() {
    setRetryNonce(n => n + 1)
    // Reset store to hydrating-p3p4 so observers pick up the fresh run.
    useDownloadStatusStore.getState().startHydrating()
    // Re-run hydrate. observedHydrate re-stamps phases and re-throws on error,
    // which lands us back in error visual phase (same pattern as first run).
    observedHydrate(userId).catch(err => {
      // silent-catch-ok — error surfaces via useDownloadStatusStore.lastError.
      console.error('[NewDeviceDownloadOverlay] retry hydrate failed:', err)
    })
  }

  const percent = progress.total > 0 ? Math.floor((progress.processed / progress.total) * 100) : 0
  const tableHint = humanizeTable(progress.recentTable)
  const isPartial =
    progress.totalsFailedCount > 0 && progress.totalsFailedCount < progress.totalTables
  const errorMessage =
    storeError ?? progress.errorMessage ?? 'Something went wrong. Please try again.'

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        // Non-dismissible during active phases — user must wait or hit an
        // error with explicit Close.
        if (!isOpen && (visualPhase === 'hydrating-p3p4' || visualPhase === 'downloading-p0p2')) {
          return
        }
        if (!isOpen) onClose()
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        data-testid="new-device-download-overlay"
        data-phase={visualPhase}
      >
        {visualPhase === 'hydrating-p3p4' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CloudDownload
                  className="text-brand size-5 motion-safe:animate-pulse"
                  aria-hidden="true"
                />
                <DialogTitle>Restoring your Knowlune library…</DialogTitle>
              </div>
              <DialogDescription>
                We found your data in the cloud. Hang tight — we&apos;re bringing everything back to
                this device.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Progress value={percent} />
              <p className="text-muted-foreground text-sm" aria-live="polite">
                Restoring {progress.processed} of {progress.total}
                {tableHint ? ` · ${tableHint}` : ''}
                {isPartial ? ' (partial counts)' : ''}
              </p>
            </div>
          </>
        )}

        {visualPhase === 'downloading-p0p2' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CloudDownload
                  className="text-brand size-5 motion-safe:animate-pulse"
                  aria-hidden="true"
                />
                <DialogTitle>Finishing sync — fetching your content…</DialogTitle>
              </div>
              <DialogDescription>
                Your notes and settings are in. Now grabbing the rest of your library — courses,
                books, and progress.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Progress value={percent} />
              <p className="text-muted-foreground text-sm" aria-live="polite">
                Restoring {progress.processed} of {progress.total}
                {tableHint ? ` · ${tableHint}` : ''}
                {isPartial ? ' (partial counts)' : ''}
              </p>
            </div>
          </>
        )}

        {visualPhase === 'success' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-success size-5" aria-hidden="true" />
                <DialogTitle>Welcome back!</DialogTitle>
              </div>
              <DialogDescription>
                Your data is restored. You can start where you left off.
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="brand"
              onClick={onClose}
              data-testid="new-device-download-done"
              autoFocus
            >
              Done
            </Button>
          </>
        )}

        {visualPhase === 'error' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-destructive size-5" aria-hidden="true" />
                <DialogTitle>Restore didn&apos;t finish</DialogTitle>
              </div>
              <DialogDescription>{errorMessage}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="brand"
                className="flex-1"
                onClick={handleRetry}
                data-testid="new-device-download-retry"
                autoFocus
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={onClose}
                data-testid="new-device-download-close"
              >
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Derive the visual phase from the store status and progress-hook error.
 * Progress-hook error takes precedence (we cannot complete without a remote
 * total).
 */
function derivePhase(
  storeStatus: ReturnType<typeof useDownloadStatusStore.getState>['status'],
  headAllFailed: boolean
): VisualPhase {
  if (headAllFailed) return 'error'
  switch (storeStatus) {
    case 'hydrating-p3p4':
      return 'hydrating-p3p4'
    case 'downloading-p0p2':
      return 'downloading-p0p2'
    case 'complete':
      return 'success'
    case 'error':
      return 'error'
    case 'idle':
    default:
      return 'hydrating-p3p4'
  }
}
