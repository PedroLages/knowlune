/**
 * Lightweight error tracking infrastructure for LevelUp.
 * Stores errors in an in-memory ring buffer and logs them
 * in a structured format. Designed as the foundation for
 * future external integrations (Sentry, etc.).
 */

export interface ErrorEntry {
  timestamp: string
  context: string
  message: string
  stack?: string
  raw?: unknown
}

const MAX_ENTRIES = 50
const errorLog: ErrorEntry[] = []

function formatTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Report and store a structured error.
 */
export function reportError(error: unknown, context = 'Unknown'): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  const entry: ErrorEntry = {
    timestamp: formatTimestamp(),
    context,
    message,
    stack,
    raw: error,
  }

  // Ring buffer: drop oldest when full
  if (errorLog.length >= MAX_ENTRIES) {
    errorLog.shift()
  }
  errorLog.push(entry)

  console.error(`[Knowlune:Error] ${entry.timestamp} | ${context} | ${message}`)
}

/**
 * Retrieve a copy of the current error log.
 */
export function getErrorLog(): ReadonlyArray<ErrorEntry> {
  return [...errorLog]
}

/**
 * Clear all stored errors.
 */
export function clearErrorLog(): void {
  errorLog.length = 0
}

/**
 * Register global handlers for non-React errors.
 * Call once at app startup.
 */
export function initErrorTracking(): void {
  window.onerror = (
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ) => {
    reportError(error ?? message, `GlobalError${source ? ` @ ${source}:${lineno}:${colno}` : ''}`)
  }

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    reportError(event.reason, 'UnhandledPromiseRejection')
  }
}
