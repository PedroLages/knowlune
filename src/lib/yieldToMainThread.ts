/**
 * yieldToMainThread — cooperative scheduling utility
 *
 * Yields control to the browser's main thread so pending paint, input events,
 * and microtasks can be processed. Use between chunks of synchronous work
 * (e.g. bulk IndexedDB writes, large array transformations) to prevent
 * "Page Unresponsive" dialogs and long-task warnings.
 *
 * Uses `scheduler.yield()` (Chromium 115+, returns a Promise) when available.
 * Falls back to `setTimeout(0)` (macrotask) for Safari, Firefox, and older
 * browsers.
 *
 * Call sites:
 *   - Between bulk Dexie writes in persistScannedCourse
 *   - Between courses in the BulkImportDialog import loop
 *   - After expensive manifest/array transformations
 *   - Between scan batches
 */

export function yieldToMainThread(): Promise<void> {
  if (typeof (globalThis as any).scheduler?.yield === 'function') {
    return (globalThis as any).scheduler.yield() as Promise<void>
  }
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

// ---------------------------------------------------------------------------
// Performance observer (development only)
// ---------------------------------------------------------------------------

let _longTaskObserver: PerformanceObserver | null = null

/**
 * Start observing long tasks (>50ms) on the main thread.
 * Logs a warning for each task that exceeds the threshold.
 * No-op when `PerformanceObserver` is unavailable (SSR, Node).
 *
 * Called from BulkImportDialog when diagnostics are enabled
 * (`VITE_IMPORT_DIAGNOSTICS=true`).
 */
export function observeLongTasks(): void {
  if (typeof PerformanceObserver === 'undefined') return
  if (_longTaskObserver) return // already observing

  try {
    _longTaskObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn(
            `[LongTask] ${entry.duration.toFixed(0)}ms — ${entry.name || '(anonymous)'}`
          )
        }
      }
    })
    _longTaskObserver.observe({ type: 'longtask', buffered: true })
  } catch {
    // Some browsers throw on 'longtask' type — silently ignore
  }
}

/**
 * Stop the long-task observer. Call on cleanup.
 */
export function disconnectLongTaskObserver(): void {
  if (_longTaskObserver) {
    _longTaskObserver.disconnect()
    _longTaskObserver = null
  }
}
