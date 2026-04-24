/**
 * Edge Function URL helper.
 * Returns the full URL for a Knowlune Supabase Edge Function.
 *
 * Base URL can be overridden with VITE_API_BASE_URL (e.g., to target
 * a staging project). Defaults to `${VITE_SUPABASE_URL}/functions/v1`.
 */

const ENV_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '')
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '')

function resolveBase(): string {
  if (ENV_BASE) return ENV_BASE
  if (SUPABASE_URL) return `${SUPABASE_URL}/functions/v1`
  // Dev fallback: use relative /functions/v1 (Vite proxy can forward if configured).
  return '/functions/v1'
}

export function apiUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const base = resolveBase()
  const cleanPath = path.replace(/^\/+/, '')
  const url = `${base}/${cleanPath}`
  if (!query) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const qsStr = qs.toString()
  return qsStr ? `${url}?${qsStr}` : url
}
