/**
 * Worker Crash Telemetry
 *
 * Subscribes to the `worker-crash` CustomEvent and logs structured telemetry
 * to the console. Uses the deduplication guard from vector-store.ts to avoid
 * logging duplicate events for repeated crashes with the same requestId.
 *
 * Telemetry payload includes:
 * - requestId: The ID of the request that was in-flight when the crash occurred
 * - provider: The provider type ('local' for on-device embedding workers)
 * - error: The error class name (e.g., 'Error', 'TypeError')
 * - errorMessage: Human-readable error message
 * - stack: Error stack trace (if available)
 * - workerId: The ID of the crashed worker
 * - cacheUnavailable: Whether the transformers model cache was available
 *
 * Called once on app startup (from App.tsx).
 *
 * Returns an unsubscribe function for cleanup.
 */

import { isDuplicateCrash } from '@/ai/vector-store'

export interface WorkerCrashPayload {
  workerId: string
  requestId: string
  provider?: string
  error: string
  errorMessage: string
  stack?: string
  cacheUnavailable: boolean
}

export function initWorkerCrashTelemetry(): () => void {
  function handleCrash(event: Event): void {
    const detail = (event as CustomEvent<WorkerCrashPayload>).detail
    if (!detail) return

    // Deduplicate: skip if we've seen this requestId within the dedup window
    if (isDuplicateCrash(detail.requestId)) {
      console.debug('[WorkerCrashTelemetry] Skipping duplicate crash event:', detail.requestId)
      return
    }

    console.warn('[WorkerCrashTelemetry] Worker crash detected:', {
      requestId: detail.requestId,
      provider: detail.provider ?? 'unknown',
      error: detail.error,
      errorMessage: detail.errorMessage,
      stack: detail.stack ?? '(no stack)',
      workerId: detail.workerId,
      cacheUnavailable: detail.cacheUnavailable,
    })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('worker-crash', handleCrash)
  }

  // Return unsubscribe function
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('worker-crash', handleCrash)
    }
  }
}
