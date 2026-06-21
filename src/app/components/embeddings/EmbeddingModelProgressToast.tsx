/**
 * Embedding Model Progress Toast
 *
 * Monitors the embedding model download via a CustomEvent dispatched by the
 * WorkerCoordinator and surfaces progress as a Sonner toast.
 *
 * Uses the useModelDownloadProgress hook from @/ai/hooks/ for the reusable
 * progress-tracking logic.
 *
 * Design decisions:
 * - Uses toast.loading() for the indeterminate state (no progress info yet),
 *   then switches to a regular toast with a progress bar once determinate
 *   progress is available.
 * - Debounces intermediate progress updates to 500ms so rapid file chunks
 *   don't cause visual thrashing (Transformers.js fires per-file progress).
 * - Gates the 15s first-progress timeout on the same warm-up conditions as
 *   App.tsx (supportsWorkers() && deviceMemory >= 4GB) — avoids a false
 *   error toast for users who don't meet the warm-up criteria.
 * - Starts a 120s download stall timeout on the first progress event: if no
 *   'done' event arrives within 120s, the toast transitions to an error.
 * - Subscribes to the 'worker-crash' CustomEvent to surface worker failures
 *   immediately, bypassing the stall timeout.
 * - Shows a success toast ("AI search ready!") on completion.
 * - Returns null (no DOM output) — Sonner renders the toast globally.
 */

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useModelDownloadProgress } from '@/ai/hooks/useModelDownloadProgress'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'
import { Progress } from '@/app/components/ui/progress'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRESS_DEBOUNCE_MS = 500
const FALLBACK_TIMEOUT_MS = 120_000
/** Timeout for first progress event (covers dynamic import hanging) */
const FIRST_PROGRESS_TIMEOUT_MS = 15_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the toast description ReactNode including progress text, a visible
 * progress bar, and fallback information. Only used for determinate progress
 * (progress >= 0).
 */
function buildDescription(progress: number) {
  return (
    <div>
      <div>Downloading AI model... {progress}%</div>
      <Progress value={progress} className="mt-1" showLabel={false} />
      <div className="text-muted-foreground mt-1 text-xs">
        Download continues in background. Keyword search available.
      </div>
    </div>
  )
}

/**
 * Build the toast description ReactNode for indeterminate progress
 * (progress < 0). Shows a spinner indicator instead of a progress bar.
 */
function buildIndeterminateDescription() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span>Downloading AI model...</span>
      </div>
      <div className="text-muted-foreground mt-1 text-xs">
        Download continues in background. Keyword search available.
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmbeddingModelProgressToast() {
  const { progress, hasStarted, hasCompleted } = useModelDownloadProgress()
  const toastIdRef = useRef<string | number | null>(null)
  const lastUpdateRef = useRef(0)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep ref in sync with hook state so timeout callbacks see the latest value
  const hasCompletedRef = useRef(false)
  hasCompletedRef.current = hasCompleted

  // Track whether warm-up was actually attempted (used to guard the
  // worker-crash handler from showing errors for unrelated crashes)
  const warmupAttemptedRef = useRef(false)

  // ==========================================================================
  // Completion handler — fires when hasCompleted transitions to true
  // ==========================================================================
  useEffect(() => {
    if (!hasCompleted) return

    // Cancel all timers
    if (firstProgressTimerRef.current) {
      clearTimeout(firstProgressTimerRef.current)
      firstProgressTimerRef.current = null
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }

    // Dismiss progress toast and show success
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current)
      toastIdRef.current = null
    }
    toast.success('AI search ready!', {
      description: 'The semantic search model has been loaded.',
      duration: 4000,
    })
  }, [hasCompleted])

  // ==========================================================================
  // Progress handler — fires when progress, hasStarted, or hasCompleted change
  // ==========================================================================
  useEffect(() => {
    if (!hasStarted || hasCompleted) return

    const isIndeterminate = progress < 0
    warmupAttemptedRef.current = true

    if (!toastIdRef.current) {
      // ---- First progress event ----
      // Cancel the first-progress timeout since we got a progress event
      if (firstProgressTimerRef.current) {
        clearTimeout(firstProgressTimerRef.current)
        firstProgressTimerRef.current = null
      }

      if (isIndeterminate) {
        // Indeterminate: show a toast with spinner in description.
        // Uses toast() (not toast.loading()) so Skip button and close button
        // persist when progress becomes determinate (Sonner cannot update a
        // loading toast's action buttons).
        toastIdRef.current = toast('Downloading AI Model', {
          description: buildIndeterminateDescription(),
          duration: Infinity,
          action: {
            label: 'Skip',
            onClick: () => {
              if (toastIdRef.current) {
                toast.dismiss(toastIdRef.current)
                toastIdRef.current = null
              }
              if (firstProgressTimerRef.current) {
                clearTimeout(firstProgressTimerRef.current)
                firstProgressTimerRef.current = null
              }
              if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current)
                fallbackTimerRef.current = null
              }
            },
          },
        })
      } else {
        // Determinate: show a toast with progress bar and skip button
        toastIdRef.current = toast('Downloading AI Model', {
          description: buildDescription(progress),
          duration: Infinity,
          action: {
            label: 'Skip',
            onClick: () => {
              if (toastIdRef.current) {
                toast.dismiss(toastIdRef.current)
                toastIdRef.current = null
              }
              if (firstProgressTimerRef.current) {
                clearTimeout(firstProgressTimerRef.current)
                firstProgressTimerRef.current = null
              }
              if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current)
                fallbackTimerRef.current = null
              }
            },
          },
        })
      }
      lastUpdateRef.current = Date.now()

      // Start fallback timer for mid-download stalls
      fallbackTimerRef.current = setTimeout(() => {
        if (toastIdRef.current) {
          toast.error('Semantic search unavailable', {
            id: toastIdRef.current,
            description:
              'The AI model could not be downloaded. Check your connection and reload the page.',
            duration: 8000,
          })
          toastIdRef.current = null
        }
        fallbackTimerRef.current = null
      }, FALLBACK_TIMEOUT_MS)
      return
    }

    // ---- Subsequent events ----
    // If still indeterminate, keep the spinner indicator — nothing to update
    if (isIndeterminate) return

    // Debounce: skip updates that arrive too close together
    const now = Date.now()
    if (now - lastUpdateRef.current < PROGRESS_DEBOUNCE_MS) return
    lastUpdateRef.current = now

    toast('Downloading AI Model', {
      id: toastIdRef.current,
      description: buildDescription(progress),
    })
  }, [progress, hasStarted, hasCompleted])

  // ==========================================================================
  // First-progress timeout (gated on warm-up conditions)
  // ==========================================================================
  useEffect(() => {
    const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory
    const shouldAttemptWarmup =
      supportsWorkers() && (deviceMemory === undefined || deviceMemory >= 4)

    // Don't start the timeout if warm-up is known to be skipped or already done
    if (!shouldAttemptWarmup || hasCompletedRef.current) return

    warmupAttemptedRef.current = true

    firstProgressTimerRef.current = setTimeout(() => {
      if (!toastIdRef.current && !hasCompletedRef.current) {
        toast.error('Semantic search unavailable', {
          description:
            'The AI model download did not start. Check your connection and reload the page.',
          duration: 8000,
        })
      }
      firstProgressTimerRef.current = null
    }, FIRST_PROGRESS_TIMEOUT_MS)

    return () => {
      if (firstProgressTimerRef.current) {
        clearTimeout(firstProgressTimerRef.current)
        firstProgressTimerRef.current = null
      }
    }
  }, [])

  // ==========================================================================
  // Worker crash handler — surfaces failures immediately
  // ==========================================================================
  useEffect(() => {
    const handleWorkerCrash = (event: Event) => {
      // Only react if we were actually waiting for a download and
      // a toast is visible (avoids false errors when warm-up was never
      // attempted — happens in isolation tests and on low-memory devices)
      if (!toastIdRef.current || !warmupAttemptedRef.current || hasCompletedRef.current) return

      const detail = (event as CustomEvent<{ workerId: string; error: string }>).detail
      const errorMsg = detail?.error ?? 'Unknown error'

      // Cancel pending timers
      if (firstProgressTimerRef.current) {
        clearTimeout(firstProgressTimerRef.current)
        firstProgressTimerRef.current = null
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }

      const description = `The AI model download failed: ${errorMsg}. Check your connection and reload the page.`

      if (toastIdRef.current) {
        toast.error('Semantic search unavailable', {
          id: toastIdRef.current,
          description,
          duration: 8000,
        })
        toastIdRef.current = null
      } else {
        toast.error('Semantic search unavailable', {
          description,
          duration: 8000,
        })
      }
    }

    window.addEventListener('worker-crash', handleWorkerCrash)
    return () => window.removeEventListener('worker-crash', handleWorkerCrash)
  }, [])

  // ==========================================================================
  // Unmount cleanup (always registered regardless of warm-up conditions)
  // ==========================================================================
  useEffect(() => {
    return () => {
      if (firstProgressTimerRef.current) {
        clearTimeout(firstProgressTimerRef.current)
        firstProgressTimerRef.current = null
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current)
        toastIdRef.current = null
      }
    }
  }, [])

  return null
}
