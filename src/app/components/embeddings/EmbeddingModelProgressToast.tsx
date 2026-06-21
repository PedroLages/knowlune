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
 * - Debounces intermediate progress events to 500ms so rapid file chunks
 *   don't cause visual thrashing (Transformers.js fires per-file progress).
 * - Uses a 15s first-progress timeout on mount: if no progress event arrives
 *   within 15s (e.g. dynamic import hangs), shows an error.
 * - Uses a 120s download stall timeout (started on first progress event):
 *   if no 'done' event arrives within 120s, the toast transitions to an error.
 * - Shows a success toast ("AI search ready!") on completion.
 * - Supports indeterminate progress (progress < 0) by showing "..." instead of
 *   a percentage.
 * - Returns null (no DOM output) — Sonner renders the toast globally.
 */

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { DownloadProgressDetail } from '@/ai/hooks/useModelDownloadProgress'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRESS_DEBOUNCE_MS = 500
const FALLBACK_TIMEOUT_MS = 120_000
/** Timeout for first progress event (covers dynamic import hanging) */
const FIRST_PROGRESS_TIMEOUT_MS = 15_000
const EVENT_NAME = 'model-download-progress'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmbeddingModelProgressToast() {
  const toastIdRef = useRef<string | number | null>(null)
  const lastUpdateRef = useRef(0)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCompletedRef = useRef(false)

  useEffect(() => {
    const handleProgress = (event: Event) => {
      const detail = (event as CustomEvent<DownloadProgressDetail>).detail
      const { progress, status } = detail

      // Guard against stale events after completion
      if (hasCompletedRef.current) return

      // === Completion ===
      if (status === 'done' || progress >= 100) {
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

        hasCompletedRef.current = true
        return
      }

      // Do not show a new toast if one already completed (cache hit on re-mount)
      if (hasCompletedRef.current) return

      // Build progress display string: handle indeterminate case
      const progressDisplay =
        progress < 0
          ? 'Loading semantic search model...'
          : `Loading semantic search model... ${progress}%`

      // First progress event — always create the toast immediately
      if (!toastIdRef.current) {
        toastIdRef.current = toast('Downloading AI Model', {
          description: progressDisplay,
          duration: Infinity,
          closeButton: true,
        })
        lastUpdateRef.current = Date.now()

        // Cancel the first-progress timeout since we got a progress event
        if (firstProgressTimerRef.current) {
          clearTimeout(firstProgressTimerRef.current)
          firstProgressTimerRef.current = null
        }

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

      // === Debounce subsequent progress updates ===
      const now = Date.now()
      if (now - lastUpdateRef.current < PROGRESS_DEBOUNCE_MS) return
      lastUpdateRef.current = now

      toast('Downloading AI Model', {
        id: toastIdRef.current,
        description: progressDisplay,
      })
    }

    // Start first-progress timeout immediately on mount
    // If no progress event arrives within this window, show an error
    // (covers cases where the dynamic import hangs before the first callback)
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

    window.addEventListener(EVENT_NAME, handleProgress as EventListener)

    return () => {
      window.removeEventListener(EVENT_NAME, handleProgress as EventListener)
      if (firstProgressTimerRef.current) {
        clearTimeout(firstProgressTimerRef.current)
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
      }
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current)
      }
    }
  }, [])

  return null
}
