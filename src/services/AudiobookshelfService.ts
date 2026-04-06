/**
 * Audiobookshelf REST API wrapper.
 *
 * Typed, pure-function service for communicating with an Audiobookshelf server.
 * Mirrors the OpdsService pattern: discriminated union returns, AbortController
 * timeouts, and user-friendly error messages. No class, no singleton, no stored state.
 *
 * @module AudiobookshelfService
 * @since E101-S01
 */

import type {
  AbsLibrary,
  AbsLibraryItem,
  AbsItem,
  AbsSearchResult,
  AbsProgress,
} from '@/data/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000

// ─── Result Type ────────────────────────────────────────────────────────────

export type AbsResult<T> = { ok: true; data: T } | { ok: false; error: string }

// ─── Internal Helper ────────────────────────────────────────────────────────

/**
 * Shared fetch wrapper for all ABS API calls.
 * Adds Bearer auth, AbortController timeout, and maps errors to user-friendly messages.
 */
async function absApiFetch<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<AbsResult<T>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const hasBody = options?.body !== undefined
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    }

    const fetchOptions: RequestInit = {
      method: options?.method ?? 'GET',
      signal: controller.signal,
      headers,
    }

    if (hasBody) {
      fetchOptions.body = JSON.stringify(options!.body)
    }

    const normalizedBase = baseUrl.replace(/\/+$/, '')
    const response = await fetch(`${normalizedBase}${path}`, fetchOptions)
    clearTimeout(timeoutId)

    if (response.status === 401) {
      return { ok: false, error: 'Authentication failed. Check your API key.' }
    }
    if (response.status === 403) {
      return { ok: false, error: 'Access denied. Your API key may lack permissions.' }
    }
    if (!response.ok) {
      return { ok: false, error: `Server error (${response.status}). Try again later.` }
    }

    // Handle empty response bodies (e.g., PATCH 200 with no content)
    const text = await response.text()
    const data = text ? (JSON.parse(text) as T) : (undefined as T)
    return { ok: true, data }
    // eslint-disable-next-line error-handling/no-silent-catch -- returns discriminated error result instead of throwing
  } catch (err: unknown) {
    clearTimeout(timeoutId)

    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out. Check the URL and try again.' }
    }
    if (err instanceof SyntaxError) {
      return { ok: false, error: 'Server returned an invalid response. Check the URL.' }
    }
    if (err instanceof TypeError) {
      return {
        ok: false,
        error: 'Could not connect to server. Check the URL and CORS settings.',
      }
    }
    return { ok: false, error: 'Could not connect to server. Check the URL and try again.' }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Test connectivity to an Audiobookshelf server.
 * Calls GET /api/ping and returns the server version on success.
 */
export async function testConnection(
  url: string,
  apiKey: string
): Promise<AbsResult<{ serverVersion: string }>> {
  const result = await absApiFetch<{ success: boolean; version: string }>(url, apiKey, '/api/ping')
  if (!result.ok) return result
  return { ok: true, data: { serverVersion: result.data.version } }
}

/**
 * Fetch all libraries from the server.
 * Calls GET /api/libraries.
 */
export async function fetchLibraries(
  url: string,
  apiKey: string
): Promise<AbsResult<AbsLibrary[]>> {
  const result = await absApiFetch<{ libraries: AbsLibrary[] }>(url, apiKey, '/api/libraries')
  if (!result.ok) return result
  return { ok: true, data: result.data.libraries }
}

/**
 * Fetch paginated items from a library.
 * Calls GET /api/libraries/{libraryId}/items.
 */
export async function fetchLibraryItems(
  url: string,
  apiKey: string,
  libraryId: string,
  options?: { page?: number; limit?: number }
): Promise<AbsResult<{ results: AbsLibraryItem[]; total: number }>> {
  const page = options?.page ?? 0
  const limit = options?.limit ?? 50
  return absApiFetch<{ results: AbsLibraryItem[]; total: number }>(
    url,
    apiKey,
    `/api/libraries/${encodeURIComponent(libraryId)}/items?page=${page}&limit=${limit}`
  )
}

/**
 * Fetch a single library item by ID.
 * Calls GET /api/items/{itemId}.
 */
export async function fetchItem(
  url: string,
  apiKey: string,
  itemId: string
): Promise<AbsResult<AbsItem>> {
  return absApiFetch<AbsItem>(url, apiKey, `/api/items/${encodeURIComponent(itemId)}`)
}

/**
 * Get the direct streaming URL for an audiobook item.
 * Uses query parameter authentication (required for HTML5 <audio> elements
 * which cannot send custom Authorization headers).
 *
 * Pure function — no fetch call.
 */
export function getStreamUrl(baseUrl: string, itemId: string, apiKey: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  return `${normalizedBase}/api/items/${encodeURIComponent(itemId)}/play?token=${encodeURIComponent(apiKey)}`
}

/**
 * Get the cover image URL for a library item.
 * Pure function — no fetch call.
 */
export function getCoverUrl(baseUrl: string, itemId: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  return `${normalizedBase}/api/items/${encodeURIComponent(itemId)}/cover`
}

/**
 * Search a library for items matching a query.
 * Calls GET /api/libraries/{libraryId}/search.
 */
export async function searchLibrary(
  url: string,
  apiKey: string,
  libraryId: string,
  query: string
): Promise<AbsResult<AbsSearchResult>> {
  return absApiFetch<AbsSearchResult>(
    url,
    apiKey,
    `/api/libraries/${encodeURIComponent(libraryId)}/search?q=${encodeURIComponent(query)}`
  )
}

/**
 * Fetch user's listening progress for an item.
 * Calls GET /api/me/progress/{itemId}.
 * Returns null data on 404 (no progress yet — treat as position 0, not an error).
 *
 * @since E101-S01 (stub) → E102-S01 (wired, 404 handling)
 */
export async function fetchProgress(
  url: string,
  apiKey: string,
  itemId: string
): Promise<AbsResult<AbsProgress | null>> {
  const result = await absApiFetch<AbsProgress>(
    url,
    apiKey,
    `/api/me/progress/${encodeURIComponent(itemId)}`
  )
  // 404 = no progress yet — return null data, not an error
  if (!result.ok && result.error.includes('(404)')) {
    return { ok: true, data: null }
  }
  return result
}

/**
 * Update user's listening progress for an item.
 * Calls PATCH /api/me/progress/{itemId}.
 * Returns AbsResult<void> since PATCH returns 200 with empty body.
 *
 * @since E101-S01 (stub) → E102-S01 (wired)
 */
export async function updateProgress(
  url: string,
  apiKey: string,
  itemId: string,
  progress: { currentTime: number; duration: number; progress: number; isFinished: boolean }
): Promise<AbsResult<void>> {
  return absApiFetch<void>(url, apiKey, `/api/me/progress/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: progress,
  })
}

/**
 * Returns true if the given URL uses HTTP (not HTTPS).
 * Used to warn users when API keys may be sent unencrypted.
 */
export function isInsecureUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'http:'
  } catch {
    // silent-catch-ok — invalid URL simply means not insecure
    return false
  }
}
