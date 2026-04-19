/**
 * E97-S01: Classify a thrown error from syncEngine.fullSync() / nudge() into
 * a short, user-safe message. Raw Supabase/Dexie error details are intentionally
 * NOT shown to users — they get logged via console.error at the call site.
 *
 * Buckets:
 *   - "Network error"     — fetch failures, CORS, no connectivity
 *   - "Sign-in expired"   — 401/403, JWT expired
 *   - "Server error"      — 5xx server-side failures
 *   - "Sync failed"       — default fallback
 */

type ErrorLike = {
  message?: unknown
  status?: unknown
  statusCode?: unknown
  code?: unknown
}

export function classifyError(err: unknown): string {
  if (err === null || err === undefined) return 'Sync failed'

  const e = (typeof err === 'object' ? err : {}) as ErrorLike
  const rawMessage = typeof e.message === 'string' ? e.message : String(err)
  const message = rawMessage.toLowerCase()

  const status =
    typeof e.status === 'number'
      ? e.status
      : typeof e.statusCode === 'number'
        ? e.statusCode
        : undefined

  // Auth-expired signals (check before network since "401" could appear in a
  // message that also mentions fetch).
  if (
    status === 401 ||
    status === 403 ||
    message.includes('jwt') ||
    message.includes('unauthorized') ||
    message.includes('sign-in') ||
    message.includes('signin') ||
    message.includes('sign in')
  ) {
    return 'Sign-in expired'
  }

  // Server-side 5xx.
  if (typeof status === 'number' && status >= 500 && status < 600) {
    return 'Server error'
  }
  if (/\b5\d{2}\b/.test(rawMessage)) {
    return 'Server error'
  }

  // Network-level failures.
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('failed to load') ||
    message.includes('offline') ||
    message.includes('cors') ||
    e.code === 'ECONNREFUSED' ||
    e.code === 'ENOTFOUND'
  ) {
    return 'Network error'
  }

  return 'Sync failed'
}
