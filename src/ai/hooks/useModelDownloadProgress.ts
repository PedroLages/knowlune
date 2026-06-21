/**
 * useModelDownloadProgress
 *
 * React hook that listens for model-download-progress CustomEvents dispatched
 * by the WorkerCoordinator and surfaces the current download state.
 *
 * This decouples the progress-tracking logic from any UI (toast, status bar,
 * etc.) so it can be reused across components.
 */

import { useEffect, useRef, useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_NAME = 'model-download-progress'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DownloadProgressDetail {
  progress: number
  status: 'download' | 'progress' | 'done'
  file?: string
  loaded?: number
  total?: number
}

export type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error'

export interface DownloadProgressState {
  /** Current progress percentage (0-100), or -1 for indeterminate */
  progress: number
  /** Current status */
  status: DownloadStatus
  /** Error message if status is 'error' */
  error: string | null
  /** Whether any progress event has been received */
  hasStarted: boolean
  /** Whether download has completed (success or error) */
  hasCompleted: boolean
  /** Reset to idle state */
  reset: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useModelDownloadProgress(): DownloadProgressState {
  const [state, setState] = useState<DownloadProgressState>({
    progress: 0,
    status: 'idle',
    error: null,
    hasStarted: false,
    hasCompleted: false,
    reset: () => {},
  })

  const hasCompletedRef = useRef(false)

  const reset = useCallback(() => {
    hasCompletedRef.current = false
    setState({
      progress: 0,
      status: 'idle',
      error: null,
      hasStarted: false,
      hasCompleted: false,
      reset,
    })
  }, [])

  useEffect(() => {
    const handleProgress = (event: Event) => {
      const detail = (event as CustomEvent<DownloadProgressDetail>).detail
      const { progress, status } = detail

      // Guard: ignore events after completion (cache hit on re-mount)
      if (hasCompletedRef.current) return

      if (status === 'done' || progress >= 100) {
        hasCompletedRef.current = true
        setState({
          progress: 100,
          status: 'done',
          error: null,
          hasStarted: true,
          hasCompleted: true,
          reset,
        })
        return
      }

      setState({
        progress,
        status: 'downloading',
        error: null,
        hasStarted: true,
        hasCompleted: false,
        reset,
      })
    }

    window.addEventListener(EVENT_NAME, handleProgress as EventListener)

    return () => {
      window.removeEventListener(EVENT_NAME, handleProgress as EventListener)
    }
  }, [reset])

  return state
}
