/**
 * E97-S03: Initial Upload Wizard.
 *
 * One-time modal shown on first sign-in per `{device, userId}` to explain the
 * initial sync upload, show bounded progress from the sync coordinator, and
 * offer "Skip for now" or "Retry" affordances. The coordinator owns the
 * queue snapshot, follow-up phase, and serialized engine run.
 *
 * State machine:
 *   intro ── Start ──▶ uploading ── coordinator complete ──▶ success
 *     │                   │
 *     │                   └── status='error' ──▶ error ── Retry ──▶ uploading
 *     └── Skip ──▶ (closed, dismissal flag)        └── Close ──▶ (closed)
 *
 * @see docs/plans/2026-04-19-024-feat-e97-s03-initial-upload-wizard-plan.md
 * @since E97-S03
 */
import { useEffect, useRef, useState } from 'react'
import { useLiveRegion } from '@/app/hooks/useLiveRegion'
import { CloudUpload, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { syncCoordinator } from '@/lib/sync/syncCoordinator'
import { useInitialUploadProgress } from '@/app/hooks/useInitialUploadProgress'
import { wizardCompleteKey, wizardDismissedKey } from '@/lib/sync/shouldShowInitialUploadWizard'
import { toastSuccess } from '@/lib/toastHelpers'
import { markAccountRepairComplete } from '@/lib/sync/repairAccountData'

type Phase = 'intro' | 'uploading' | 'success' | 'error'

/** Humanized labels for common Dexie table names. Unknown tables fall back to the raw name. */
const TABLE_LABELS: Record<string, string> = {
  notes: 'notes',
  books: 'books',
  flashcards: 'flashcards',
  contentProgress: 'course progress',
  studySessions: 'study sessions',
  progress: 'lesson progress',
  bookHighlights: 'highlights',
  audioBookmarks: 'audio bookmarks',
}

function humanizeTable(name: string | null): string {
  if (!name) return ''
  return TABLE_LABELS[name] ?? name
}

export interface InitialUploadWizardProps {
  open: boolean
  userId: string
  onClose: () => void
}

export function InitialUploadWizard({ open, userId, onClose }: InitialUploadWizardProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const { announce } = useLiveRegion()

  // Only poll syncQueue while we are actually in the uploading phase.
  const progress = useInitialUploadProgress(userId, open && phase === 'uploading')

  const fastPathAppliedRef = useRef(false)
  const successWrittenRef = useRef(false)

  // Fast-path: if sync is already in progress on mount, skip intro.
  useEffect(() => {
    if (!open || !userId) {
      fastPathAppliedRef.current = false
      successWrittenRef.current = false
      setPhase('intro')
      return
    }
    if (fastPathAppliedRef.current) return
    fastPathAppliedRef.current = true
    const currentProgress = syncCoordinator.getInitialUploadProgress()
    if (
      syncCoordinator.isInitialUploadActive ||
      currentProgress.phase === 'original' ||
      currentProgress.phase === 'additional'
    ) {
      setPhase('uploading')
    }
  }, [open, userId])

  // Coordinator progress transitions → dialog transitions. The wizard never
  // infers completion from a mutable global pending count.
  useEffect(() => {
    if (!open || !userId) return
    if (progress.phase === 'error' && phase === 'uploading') {
      announce(`Upload failed. ${progress.error?.message ?? 'Please try again.'}`)
      setPhase('error')
    }
    if (progress.phase === 'complete' && phase === 'uploading' && !successWrittenRef.current) {
      if (progress.total === 0) {
        onClose()
        return
      }
      successWrittenRef.current = true
      try {
        localStorage.setItem(wizardCompleteKey(userId), new Date().toISOString())
        localStorage.removeItem(wizardDismissedKey(userId))
      } catch (err) {
        // silent-catch-ok — flag write is best-effort; worst case the wizard
        // shows once more next sign-in and auto-writes on the short-circuit path.
        console.error('[InitialUploadWizard] localStorage write failed:', err)
      }
      void markAccountRepairComplete(userId).catch(err => {
        console.error('[InitialUploadWizard] account repair completion marker failed:', err)
      })
      toastSuccess.saved('Initial upload complete')
      announce('Upload complete. Your data is safely backed up.')
      setPhase('success')
    }
  }, [progress.phase, progress.error, progress.total, phase, open, userId, announce, onClose])

  if (!open || !userId) return null

  function handleStart() {
    announce('Uploading your data. Please wait.')
    setPhase('uploading')
    syncCoordinator.startInitialUpload({ userId }).catch(err => {
      console.error('[InitialUploadWizard] initial upload failed:', err)
    })
  }

  function handleSkip() {
    try {
      localStorage.setItem(wizardDismissedKey(userId), new Date().toISOString())
    } catch (err) {
      // silent-catch-ok — dismissal is best-effort UX; if it fails the wizard
      // will simply reappear next render, which is safer than blocking close.
      console.error('[InitialUploadWizard] dismissal flag write failed:', err)
    }
    onClose()
  }

  function handleRetry() {
    announce('Uploading your data. Please wait.')
    setPhase('uploading')
    syncCoordinator.startInitialUpload({ userId, rebuildFailed: true }).catch(err => {
      console.error('[InitialUploadWizard] retry initial upload failed:', err)
    })
  }

  const percent = progress.total > 0 ? Math.floor((progress.processed / progress.total) * 100) : 0
  const tableHint = humanizeTable(progress.recentTable)
  const isAdditionalPhase = progress.phase === 'additional'
  const progressCopy = isAdditionalPhase
    ? progress.processed === 0
      ? `Original upload complete. Saving ${progress.total} additional changes`
      : `Original upload complete. Saving ${progress.processed} of ${progress.total} additional changes`
    : `Uploading ${progress.processed} of ${progress.total} original items`
  const errorMessage =
    progress.failures[0]?.message ??
    progress.error?.message ??
    'Something went wrong. Please try again.'

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        // Prevent radix auto-close on escape/overlay click during upload —
        // user must explicitly Skip or Close.
        if (!isOpen && phase === 'uploading') return
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="initial-upload-wizard" data-phase={phase}>
        {phase === 'intro' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CloudUpload className="text-brand size-5" aria-hidden="true" />
                <DialogTitle>Back up your learning data</DialogTitle>
              </div>
              <DialogDescription>
                We'll upload your notes, progress, and other data to your Knowlune account so it's
                safe and available across your devices.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="brand"
                className="flex-1"
                onClick={handleStart}
                data-testid="initial-upload-start"
                autoFocus
              >
                Start upload
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={handleSkip}
                data-testid="initial-upload-skip"
              >
                Skip for now
              </Button>
            </div>
          </>
        )}

        {phase === 'uploading' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CloudUpload className="text-brand size-5 animate-pulse" aria-hidden="true" />
                <DialogTitle>Uploading your data…</DialogTitle>
              </div>
              <DialogDescription>
                This can take a moment depending on how much data you have. You can keep using
                Knowlune while it runs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Progress value={percent} />
              <p className="text-muted-foreground text-sm" aria-hidden="true">
                {progressCopy}
                {tableHint ? ` · ${tableHint}` : ''}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={handleSkip}
                data-testid="initial-upload-skip"
              >
                Skip for now
              </Button>
            </div>
          </>
        )}

        {phase === 'success' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-success size-5" aria-hidden="true" />
                <DialogTitle>All set!</DialogTitle>
              </div>
              <DialogDescription>
                Your data is safely backed up. It will stay in sync across your devices
                automatically.
              </DialogDescription>
            </DialogHeader>
            <Button variant="brand" onClick={onClose} data-testid="initial-upload-done" autoFocus>
              Done
            </Button>
          </>
        )}

        {phase === 'error' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-destructive size-5" aria-hidden="true" />
                <DialogTitle>Upload didn't finish</DialogTitle>
              </div>
              <DialogDescription>{errorMessage}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="brand"
                className="flex-1"
                onClick={handleRetry}
                data-testid="initial-upload-retry"
                autoFocus
              >
                Retry
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={onClose}
                data-testid="initial-upload-close"
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
