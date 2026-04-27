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
  AbsSeries,
  AbsCollection,
  AbsChapter,
} from '@/data/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000

// ─── Result Type ────────────────────────────────────────────────────────────

export type AbsResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }

// ─── URL Helper ─────────────────────────────────────────────────────────────

/** Strip trailing slashes so path concatenation produces a single `/` join. */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

// ─── Internal Helper ────────────────────────────────────────────────────────

/**
 * Shared fetch wrapper for all ABS API calls.
 *
 * Calls the user's ABS server directly from the browser with
 * `Authorization: Bearer <apiKey>`. Requires the ABS server to (a) be
 * reachable from the app's origin (HTTPS when the app is served from HTTPS)
 * and (b) allowlist the app origin via ABS Settings → Security → Allowed
 * Origins. See docs/solutions/integration-issues/2026-04-24-abs-browser-direct-bearer-auth.md.
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

    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, fetchOptions)
    clearTimeout(timeoutId)

    if (response.status === 401) {
      return { ok: false, error: 'Authentication failed. Check your API key.', status: 401 }
    }
    if (response.status === 403) {
      return { ok: false, error: 'Access denied. Your API key may lack permissions.', status: 403 }
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `Server error (${response.status}). Try again later.`,
        status: response.status,
      }
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
    // TypeError from fetch in a browser means the request never reached the
    // server (CORS rejection, DNS failure, connection refused, mixed content
    // block). For HTTPS origins with well-formed URLs, CORS is the most
    // common cause — surface actionable guidance.
    if (err instanceof TypeError) {
      return {
        ok: false,
        error:
          "Could not reach your Audiobookshelf server. If the URL is correct, add this app's origin to your ABS Settings → Security → Allowed Origins.",
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
): Promise<AbsResult<{ serverVersion: string; warning?: string }>> {
  // /ping returns {success:true} without version; POST /api/authorize returns user + server version
  const result = await absApiFetch<{ user: { id: string }; serverSettings?: { version?: string } }>(
    url,
    apiKey,
    '/api/authorize',
    { method: 'POST' }
  )
  if (!result.ok) return result
  const version = result.data.serverSettings?.version ?? 'unknown'
  const [major, minor] = version.split('.').map(Number)
  const warning =
    major < 2 || (major === 2 && minor < 26)
      ? `Server version ${version} is below v2.26.0. Some features (Socket.IO sync) may not work correctly.`
      : undefined
  return { ok: true, data: { serverVersion: version, warning } }
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
 *
 * Defaults to `sort=addedAt&desc=1` so items arrive newest-first,
 * matching the expected "recently added" order in the library view.
 */
export async function fetchLibraryItems(
  url: string,
  apiKey: string,
  libraryId: string,
  options?: { page?: number; limit?: number; sort?: string; desc?: 0 | 1 }
): Promise<AbsResult<{ results: AbsLibraryItem[]; total: number }>> {
  const params = new URLSearchParams({
    page: String(options?.page ?? 0),
    limit: String(options?.limit ?? 50),
    sort: options?.sort ?? 'addedAt',
    desc: String(options?.desc ?? 1),
  })
  return absApiFetch<{ results: AbsLibraryItem[]; total: number }>(
    url,
    apiKey,
    `/api/libraries/${encodeURIComponent(libraryId)}/items?${params}`
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
 * Fetch chapter list for an audiobook item.
 * Calls GET /api/items/{itemId} and extracts chapters from media metadata.
 *
 * @since E103-S01
 */
export async function fetchChapters(
  url: string,
  apiKey: string,
  itemId: string
): Promise<AbsResult<{ chapters: AbsChapter[] }>> {
  const result = await fetchItem(url, apiKey, itemId)
  if (!result.ok) return result
  // ABS embeds chapters in media.chapters on the item response
  const chapters: AbsChapter[] = result.data.media.chapters ?? []
  return { ok: true, data: { chapters } }
}

// ─── Playback Session API ──────────────────────────────────────────────────

/** Response from POST /api/items/{id}/play — creates a playback session */
export interface AbsPlaybackSession {
  id: string
  audioTracks: Array<{
    contentUrl: string
    duration: number
    mimeType: string
  }>
}

/**
 * Create a playback session for an audiobook item.
 * POST /api/items/{itemId}/play — returns audio track URLs for streaming.
 *
 * `forceDirectPlay: true` tells ABS to serve files directly (no HLS transcoding),
 * which produces URLs the HTML5 <audio> element can play natively.
 */
export async function createPlaybackSession(
  baseUrl: string,
  apiKey: string,
  itemId: string
): Promise<AbsResult<AbsPlaybackSession>> {
  return absApiFetch<AbsPlaybackSession>(
    baseUrl,
    apiKey,
    `/api/items/${encodeURIComponent(itemId)}/play`,
    {
      method: 'POST',
      body: {
        deviceInfo: { clientName: 'Knowlune', clientVersion: '1.0' },
        forceDirectPlay: true,
        forceTranscode: false,
      },
    }
  )
}

/**
 * Construct a direct streaming URL from a playback session's contentUrl.
 * The contentUrl from ABS is a relative path like `/s/item/{id}/book.m4b`.
 *
 * `<audio>` elements can't set headers, so the API key rides along as a
 * `?token=` query param (ABS natively supports this for stream endpoints).
 *
 * Pure function — no fetch call.
 */
export function getStreamUrlFromSession(
  baseUrl: string,
  apiKey: string,
  contentUrl: string
): string {
  const path = contentUrl.startsWith('http') ? new URL(contentUrl).pathname : contentUrl
  return `${normalizeBaseUrl(baseUrl)}${path}?token=${encodeURIComponent(apiKey)}`
}

/**
 * Close a playback session. Fire-and-forget — ABS auto-expires idle sessions
 * after ~30 minutes, so missing this call is not critical.
 */
export async function closePlaybackSession(
  baseUrl: string,
  apiKey: string,
  sessionId: string
): Promise<AbsResult<void>> {
  return absApiFetch<void>(baseUrl, apiKey, `/api/session/${encodeURIComponent(sessionId)}/close`, {
    method: 'POST',
  })
}

/**
 * @deprecated Use createPlaybackSession + getStreamUrlFromSession instead.
 * Kept for backward compatibility during migration.
 */
export function getStreamUrl(baseUrl: string, itemId: string, apiKey: string): string {
  return `${normalizeBaseUrl(baseUrl)}/api/items/${encodeURIComponent(itemId)}/play?token=${encodeURIComponent(apiKey)}`
}

/**
 * Get the direct cover image URL for a library item.
 *
 * `<img>` elements can't set headers, so the API key rides along as a
 * `?token=` query param (ABS natively supports this for GET endpoints
 * returning binary content). When apiKey is omitted, the caller is assumed
 * to want a public/unauthenticated cover URL.
 *
 * Pure function — no fetch call.
 */
export function getCoverUrl(baseUrl: string, itemId: string, apiKey?: string): string {
  const base = `${normalizeBaseUrl(baseUrl)}/api/items/${encodeURIComponent(itemId)}/cover`
  return apiKey ? `${base}?token=${encodeURIComponent(apiKey)}` : base
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
  if (!result.ok && result.status === 404) {
    return { ok: true, data: null }
  }
  return result
}

/** Raw shape from GET /api/me `mediaProgress[]` (Audiobookshelf `getOldMediaProgress`) */
function normalizeMeProgressEntry(entry: unknown): AbsProgress | null {
  if (!entry || typeof entry !== 'object') return null
  const e = entry as Record<string, unknown>
  // Podcast episode progress — skip (Knowlune ABS catalog maps books only)
  if (e.episodeId) return null
  const libraryItemId =
    typeof e.libraryItemId === 'string'
      ? e.libraryItemId
      : typeof e.libraryItemId === 'number'
        ? String(e.libraryItemId)
        : undefined
  if (!libraryItemId) return null

  const currentTime =
    typeof e.currentTime === 'number' ? e.currentTime : Number(e.currentTime) || 0
  const duration = typeof e.duration === 'number' ? e.duration : Number(e.duration) || 0
  const progressRaw = e.progress
  const progress =
    typeof progressRaw === 'number'
      ? progressRaw
      : typeof progressRaw === 'string'
        ? Number(progressRaw)
        : duration > 0
          ? Math.min(1, Math.max(0, currentTime / duration))
          : 0
  const isFinished = Boolean(e.isFinished)
  const lastUpdate =
    typeof e.lastUpdate === 'number'
      ? e.lastUpdate
      : typeof e.lastUpdate === 'string'
        ? new Date(e.lastUpdate).getTime()
        : 0
  const id = typeof e.id === 'string' ? e.id : libraryItemId

  return {
    id,
    libraryItemId,
    currentTime,
    duration,
    progress: Number.isFinite(progress) ? progress : 0,
    isFinished,
    lastUpdate,
  }
}

/**
 * Fetch all media progress entries for the authenticated user.
 * Calls GET /api/me and parses `mediaProgress` (Audiobookshelf browser JSON).
 * On missing/empty arrays returns `{ ok: true, data: [] }` — never treats as fatal.
 *
 * @since CE 2026-04-27 — ABS inbound progress sync
 */
export async function fetchAllProgress(
  url: string,
  apiKey: string
): Promise<AbsResult<AbsProgress[]>> {
  const result = await absApiFetch<Record<string, unknown>>(url, apiKey, '/api/me')
  if (!result.ok) {
    // Treat missing /api/me like empty progress — catalog overlay stays best-effort (plan R5)
    if (result.status === 404) {
      return { ok: true, data: [] }
    }
    return result
  }

  const body = result.data
  const rawList = body.mediaProgress
  if (!Array.isArray(rawList)) {
    return { ok: true, data: [] }
  }

  const out: AbsProgress[] = []
  for (const entry of rawList) {
    const normalized = normalizeMeProgressEntry(entry)
    if (normalized) out.push(normalized)
  }
  return { ok: true, data: out }
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
 * Fetch paginated series from a library.
 * Calls GET /api/libraries/{libraryId}/series.
 *
 * @since E102-S02
 */
export async function fetchSeriesForLibrary(
  url: string,
  apiKey: string,
  libraryId: string,
  options?: { page?: number; limit?: number }
): Promise<AbsResult<{ results: AbsSeries[]; total: number }>> {
  const params = new URLSearchParams({
    page: String(options?.page ?? 0),
    limit: String(options?.limit ?? 50),
    sort: 'name',
  })
  return absApiFetch<{ results: AbsSeries[]; total: number }>(
    url,
    apiKey,
    `/api/libraries/${encodeURIComponent(libraryId)}/series?${params}`
  )
}

/**
 * Fetch all collections for a library.
 * Calls GET /api/libraries/{libraryId}/collections (works for all users, not just admin).
 *
 * @since E102-S03
 */
export async function fetchCollections(
  url: string,
  apiKey: string,
  libraryId: string,
  _options?: { page?: number; limit?: number }
): Promise<AbsResult<{ results: AbsCollection[]; total: number }>> {
  // ABS v2: /api/libraries/{id}/collections returns { results: [...], total: N }
  const result = await absApiFetch<{ results: AbsCollection[]; total: number }>(
    url,
    apiKey,
    `/api/libraries/${encodeURIComponent(libraryId)}/collections`
  )
  if (!result.ok) return result
  const collections = result.data.results ?? []
  return { ok: true, data: { results: collections, total: collections.length } }
}

// ─── Socket.IO via Native WebSocket (Engine.IO Protocol) ───────────────────
//
// ABS uses Socket.IO v4 over Engine.IO v4. Rather than importing socket.io-client
// (NFR5: zero new npm deps), we speak the Engine.IO wire protocol directly:
//   - Transport: WebSocket upgrade via /socket.io/?EIO=4&transport=websocket
//   - Auth: Bearer token sent as query param (same as ABS Socket.IO client)
//
// Engine.IO packet type prefixes (first character of each WebSocket frame):
//   0 = open    — server sends JSON config {sid, pingInterval, pingTimeout}
//   1 = close   — graceful shutdown
//   2 = ping    — server sends "2", client must respond "3" (pong)
//   3 = pong    — client response to server ping
//   4 = message — payload follows; Socket.IO frames are wrapped inside type 4
//
// Socket.IO subtypes (second character, only when first char is "4"):
//   0 = CONNECT      — "40" = connect to default namespace; "40{...}" = connect ack
//   1 = DISCONNECT   — "41" = disconnect from namespace
//   2 = EVENT         — "42" + JSON array ["eventName", payload]
//
// Example wire frame: 42["user_media_progress_updated",{...}]
//   "4" = Engine.IO message type, "2" = Socket.IO EVENT subtype,
//   followed by JSON array with event name and payload.
//
// Heartbeat cycle: server sends "2" (ping) every pingInterval ms,
// client must respond "3" (pong) before pingTimeout ms or connection drops.
//
// Reference: https://github.com/socketio/engine.io-protocol
// ABS events: https://github.com/advplyr/audiobookshelf (server/SocketAuthority.js)
// ────────────────────────────────────────────────────────────────────────────

/** Handle returned by connectSocket — caller owns lifecycle via disconnect(). */
export interface AbsSocketConnection {
  /** Underlying WebSocket (for testing/inspection only — use provided methods) */
  ws: WebSocket | null
  /** Whether the Engine.IO handshake completed and socket is ready */
  isConnected: boolean
  /** Gracefully close the connection */
  disconnect: () => void
}

/** Payload shape for ABS progress events received via Socket.IO */
export interface AbsProgressEvent {
  libraryItemId: string
  currentTime: number
  duration: number
  progress: number // 0-1
  isFinished: boolean
}

/**
 * Connect to an ABS server via native WebSocket speaking Engine.IO/Socket.IO protocol.
 *
 * Returns an AbsSocketConnection handle. The caller is responsible for calling
 * disconnect() when done (typically in a useEffect cleanup).
 *
 * @param onReady Called when the Socket.IO handshake completes (connection usable)
 * @param onDisconnect Called when the connection drops (for fallback to REST)
 */
export function connectSocket(
  baseUrl: string,
  apiKey: string,
  callbacks: {
    onReady?: () => void
    onDisconnect?: () => void
  } = {}
): AbsSocketConnection {
  const normalizedBase = baseUrl.replace(/\/+$/, '').replace(/^http/, 'ws')
  const wsUrl = `${normalizedBase}/socket.io/?EIO=4&transport=websocket&token=${encodeURIComponent(apiKey)}`

  const connection: AbsSocketConnection = {
    ws: null,
    isConnected: false,
    disconnect: () => {
      connection.isConnected = false
      clearInterval(pingInterval)
      if (connection.ws && connection.ws.readyState <= WebSocket.OPEN) {
        connection.ws.close()
      }
    },
  }

  let pingInterval: ReturnType<typeof setInterval>
  let pingIntervalMs = 25_000 // Default, overridden by server's open packet

  try {
    const ws = new WebSocket(wsUrl)
    connection.ws = ws

    ws.onopen = () => {
      // Engine.IO handshake: server sends packet type 0 (open) with JSON config
    }

    ws.onmessage = (event: MessageEvent) => {
      const data = typeof event.data === 'string' ? event.data : ''

      // Engine.IO open packet: "0{...}"
      if (data.startsWith('0{')) {
        try {
          const config = JSON.parse(data.slice(1)) as {
            pingInterval?: number
            pingTimeout?: number
          }
          pingIntervalMs = config.pingInterval ?? 25_000
        } catch {
          // silent-catch-ok: use default ping interval
        }

        // Send Socket.IO connect packet for default namespace: "40"
        // Include auth payload with token
        ws.send(`40${JSON.stringify({ token: apiKey })}`)
        return
      }

      // Socket.IO connect ack: "40{...}" — connection established
      if (data === '40' || data.startsWith('40{')) {
        connection.isConnected = true
        // Start Engine.IO heartbeat
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('2') // Engine.IO ping
          }
        }, pingIntervalMs)
        callbacks.onReady?.()
        return
      }

      // Engine.IO pong: "3" — heartbeat response, ignore
      if (data === '3') return

      // Engine.IO ping from server: "2" — respond with pong
      if (data === '2') {
        ws.send('3')
        return
      }
    }

    ws.onerror = () => {
      // WebSocket errors are followed by onclose — handle cleanup there
    }

    ws.onclose = () => {
      const wasConnected = connection.isConnected
      connection.isConnected = false
      clearInterval(pingInterval)
      if (wasConnected) {
        callbacks.onDisconnect?.()
      }
    }
  } catch {
    // silent-catch-ok: WebSocket constructor can throw on invalid URL
    // Caller will see isConnected = false
    console.warn('[ABS Socket] Failed to create WebSocket connection')
  }

  return connection
}

/**
 * Subscribe to progress update events from ABS via Socket.IO.
 *
 * ABS emits "user_media_progress_updated" when progress changes on the server
 * (e.g., user listened on ABS mobile app).
 *
 * Returns an unsubscribe function.
 */
export function onProgressUpdate(
  connection: AbsSocketConnection,
  handler: (event: AbsProgressEvent) => void
): () => void {
  const listener = (event: MessageEvent) => {
    const data = typeof event.data === 'string' ? event.data : ''

    // Socket.IO event packet: "42["eventName", payload]"
    if (!data.startsWith('42')) return

    try {
      const parsed = JSON.parse(data.slice(2)) as [string, unknown]
      if (!Array.isArray(parsed) || parsed[0] !== 'user_media_progress_updated') return

      const payload = parsed[1] as {
        data?: {
          libraryItemId?: string
          currentTime?: number
          duration?: number
          progress?: number
          isFinished?: boolean
        }
      }

      const progressData = payload?.data ?? (payload as AbsProgressEvent)
      if (
        progressData &&
        typeof progressData.libraryItemId === 'string' &&
        typeof progressData.currentTime === 'number'
      ) {
        handler({
          libraryItemId: progressData.libraryItemId,
          currentTime: progressData.currentTime,
          duration: progressData.duration ?? 0,
          progress: progressData.progress ?? 0,
          isFinished: progressData.isFinished ?? false,
        })
      }
    } catch {
      // silent-catch-ok: malformed event, skip
    }
  }

  connection.ws?.addEventListener('message', listener)
  return () => connection.ws?.removeEventListener('message', listener)
}

/**
 * Push a progress update to ABS via Socket.IO.
 *
 * Emits the "update_media_progress" event which ABS server listens for.
 * This is a fire-and-forget operation — no ack expected.
 */
export function pushProgressViaSocket(
  connection: AbsSocketConnection,
  itemId: string,
  progress: { currentTime: number; duration: number; progress: number; isFinished: boolean }
): void {
  if (!connection.isConnected || !connection.ws || connection.ws.readyState !== WebSocket.OPEN)
    return

  // Socket.IO event packet: "42" + JSON array
  const packet = JSON.stringify([
    'update_media_progress',
    {
      libraryItemId: itemId,
      ...progress,
    },
  ])
  connection.ws.send(`42${packet}`)
}

// ─── MediaSession API ──────────────────────────────────────────────────────
//
// Populates the OS lock-screen / notification media card with audiobook
// metadata and wires hardware/software media key handlers back to the
// AudiobookshelfService playback model.
//
// MediaSession is only available in secure contexts (HTTPS / localhost) and
// is not universally supported (e.g., Safari ≤14, some older Androids).
// A feature-detect guard wraps every call.
// ─────────────────────────────────────────────────────────────────────────────

/** Track metadata consumed by setMediaSession. */
export interface MediaTrack {
  title: string
  author: string
  bookTitle: string
  coverUrl: string
}

/** Action handlers wired to the OS media card. All are optional. */
export interface MediaSessionHandlers {
  play?: () => void
  pause?: () => void
  seekBackward?: (details: MediaSessionActionDetails) => void
  seekForward?: (details: MediaSessionActionDetails) => void
  previousTrack?: () => void
  nextTrack?: () => void
  seekTo?: (details: MediaSessionActionDetails) => void
}

/**
 * Set OS lock-screen / notification media card metadata and register action
 * handlers for the given track.
 *
 * Feature-detects navigator.mediaSession — safe to call in all environments.
 * Call clearMediaSession() when playback stops.
 *
 * @since E120-S02
 */
export function setMediaSession(track: MediaTrack, handlers: MediaSessionHandlers = {}): void {
  if (!('mediaSession' in navigator) || !navigator.mediaSession) return

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.author,
    album: track.bookTitle,
    artwork: /^https?:\/\//i.test(track.coverUrl)
      ? [{ src: track.coverUrl, sizes: '512x512', type: 'image/png' }]
      : [],
  })

  const trySet = (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null
  ) => {
    try {
      navigator.mediaSession!.setActionHandler(action, handler)
    } catch {
      // action not supported by this browser — silent-catch-ok
    }
  }

  trySet('play', handlers.play ?? null)
  trySet('pause', handlers.pause ?? null)
  trySet('seekbackward', handlers.seekBackward ?? null)
  trySet('seekforward', handlers.seekForward ?? null)
  trySet('previoustrack', handlers.previousTrack ?? null)
  trySet('nexttrack', handlers.nextTrack ?? null)
  trySet('seekto', handlers.seekTo ?? null)
}

/**
 * Clear the OS media card metadata and unregister all action handlers.
 * Call when playback stops or the player unmounts.
 *
 * @since E120-S02
 */
export function clearMediaSession(): void {
  if (!('mediaSession' in navigator) || !navigator.mediaSession) return

  navigator.mediaSession.metadata = null
  const actions: MediaSessionAction[] = [
    'play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack', 'seekto',
  ]
  for (const action of actions) {
    try {
      navigator.mediaSession.setActionHandler(action, null)
    } catch {
      // action not supported by this browser — silent-catch-ok
    }
  }
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

/**
 * Returns true if an HTTP ABS URL cannot be reached from the current app
 * origin due to browser mixed-content rules — i.e. the app is served over
 * HTTPS and the target is plain HTTP.
 *
 * `appProtocol` is injected for testability; defaults to
 * `window.location.protocol` at call time.
 *
 * Dev (`http://localhost:5173`) is unaffected: `appProtocol === 'http:'`
 * returns false for every target.
 */
export function isMixedContentBlocked(
  absUrl: string,
  appProtocol: string = typeof window !== 'undefined' ? window.location.protocol : 'http:'
): boolean {
  return appProtocol === 'https:' && isInsecureUrl(absUrl)
}
