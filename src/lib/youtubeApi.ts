/**
 * YouTube Data API v3 Client
 *
 * Fetches video metadata, playlist items, and channel info from YouTube.
 * Features:
 * - Batch requests (up to 50 video IDs per call — 1 quota unit per batch)
 * - Response caching in IndexedDB (youtubeVideoCache table, configurable TTL)
 * - Rate limiting via token bucket (3 req/sec)
 * - Daily quota tracking with midnight PT reset
 * - oEmbed fallback when quota exhausted or API key invalid
 *
 * YouTube API calls go direct from browser (CORS supported) — not proxied.
 *
 * @see E28-S03 — YouTube Data API v3 Client with Rate Limiting
 */

import { toast } from 'sonner'

import type { YouTubeVideoCache, Chapter } from '@/data/types'
import { db } from '@/db/schema'
import { getDecryptedYouTubeApiKey, getCacheTtlMs } from '@/lib/youtubeConfiguration'
import { getYouTubeRateLimiter } from '@/lib/youtubeRateLimiter'
import { recordQuotaUsage, isQuotaExceeded } from '@/lib/youtubeQuotaTracker'

// --- Constants ---

/** YouTube Data API v3 base URL */
const API_BASE = 'https://www.googleapis.com/youtube/v3'

/** Maximum video IDs per batch request (YouTube API limit) */
export const MAX_BATCH_SIZE = 50

/** Maximum playlist items per page (YouTube API limit) */
const MAX_PAGE_SIZE = 50

/** oEmbed endpoint for fallback metadata */
const OEMBED_URL = 'https://www.youtube.com/oembed'

// --- Types ---

/** Result type for API operations */
export type YouTubeApiResult<T> =
  | { ok: true; data: T; fromCache: boolean }
  | { ok: false; error: string; code: YouTubeApiErrorCode }

/** Error codes for YouTube API failures */
export type YouTubeApiErrorCode =
  | 'NO_API_KEY'
  | 'INVALID_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'NOT_FOUND'

/** Playlist item from YouTube Data API */
export interface YouTubePlaylistItem {
  videoId: string
  title: string
  position: number
  thumbnailUrl: string
  channelTitle: string
}

/** oEmbed fallback metadata (limited fields) */
export interface YouTubeOEmbedData {
  title: string
  authorName: string
  authorUrl: string
  thumbnailUrl: string
}

// --- YouTube Data API v3 Response Types ---

interface YouTubeApiVideoResource {
  id: string
  snippet: {
    title: string
    description: string
    channelId: string
    channelTitle: string
    publishedAt: string
    thumbnails: {
      high?: { url: string }
      medium?: { url: string }
      default?: { url: string }
    }
  }
  contentDetails: {
    duration: string // ISO 8601 duration (PT1H2M3S)
  }
}

interface YouTubeApiVideoListResponse {
  items: YouTubeApiVideoResource[]
  pageInfo: { totalResults: number }
}

interface YouTubeApiPlaylistItemResource {
  snippet: {
    title: string
    position: number
    channelTitle: string
    resourceId: { videoId: string }
    thumbnails: {
      high?: { url: string }
      medium?: { url: string }
      default?: { url: string }
    }
  }
}

interface YouTubeApiPlaylistResponse {
  items: YouTubeApiPlaylistItemResource[]
  nextPageToken?: string
  pageInfo: { totalResults: number }
}

// --- Duration Parsing ---

/**
 * Parse ISO 8601 duration (PT1H2M3S) to seconds.
 * YouTube returns durations in this format.
 */
export function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Extract chapter markers from a video description.
 * YouTube chapters are lines matching "HH:MM:SS Title" or "MM:SS Title".
 */
export function extractChapters(description: string): Chapter[] {
  const lines = description.split('\n')
  const chapters: Chapter[] = []
  // Pattern: optional hours, minutes:seconds, followed by text
  const timePattern = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/

  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(timePattern)
    if (match) {
      const hours = parseInt(match[1] || '0', 10)
      const minutes = parseInt(match[2], 10)
      const seconds = parseInt(match[3], 10)
      const time = hours * 3600 + minutes * 60 + seconds
      const title = match[4].trim()
      if (title) {
        chapters.push({ time, title })
      }
    }
  }

  return chapters
}

// --- Cache Operations ---

/**
 * Get cached video metadata from IndexedDB.
 * Returns null if not cached or TTL expired.
 */
async function getCachedVideo(videoId: string): Promise<YouTubeVideoCache | null> {
  try {
    const cached = await db.youtubeVideoCache.get(videoId)
    if (!cached) return null

    // Check TTL expiry
    const now = new Date().toISOString()
    if (cached.expiresAt <= now) {
      // TTL expired — delete stale entry
      await db.youtubeVideoCache.delete(videoId)
      return null
    }

    return cached
  } catch (error) {
    console.warn('[YouTubeApi] Cache read failed for', videoId, error)
    return null
  }
}

/**
 * Get multiple cached videos from IndexedDB.
 * Returns a Map of videoId -> cached data (only non-expired entries).
 */
async function getCachedVideos(videoIds: string[]): Promise<Map<string, YouTubeVideoCache>> {
  const result = new Map<string, YouTubeVideoCache>()
  try {
    const cached = await db.youtubeVideoCache.bulkGet(videoIds)
    const now = new Date().toISOString()
    const expired: string[] = []

    for (const entry of cached) {
      if (!entry) continue
      if (entry.expiresAt <= now) {
        expired.push(entry.videoId)
      } else {
        result.set(entry.videoId, entry)
      }
    }

    // Clean up expired entries
    if (expired.length > 0) {
      await db.youtubeVideoCache.bulkDelete(expired)
    }
  } catch (error) {
    console.warn('[YouTubeApi] Bulk cache read failed:', error)
  }
  return result
}

/**
 * Store video metadata in the cache with TTL.
 */
async function cacheVideo(video: YouTubeVideoCache): Promise<void> {
  try {
    await db.youtubeVideoCache.put(video)
  } catch (error) {
    console.warn('[YouTubeApi] Cache write failed for', video.videoId, error)
  }
}

/**
 * Store multiple video metadata entries in the cache.
 */
async function cacheVideos(videos: YouTubeVideoCache[]): Promise<void> {
  try {
    await db.youtubeVideoCache.bulkPut(videos)
  } catch (error) {
    console.warn('[YouTubeApi] Bulk cache write failed:', error)
  }
}

// --- API Helpers ---

/**
 * Get the best thumbnail URL from a thumbnails object.
 */
function getBestThumbnail(thumbnails: YouTubeApiVideoResource['snippet']['thumbnails']): string {
  return thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || ''
}

/**
 * Convert a YouTube API video resource to our cache format.
 */
function toVideoCache(resource: YouTubeApiVideoResource): YouTubeVideoCache {
  const now = new Date().toISOString()
  const ttlMs = getCacheTtlMs()
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()

  return {
    videoId: resource.id,
    title: resource.snippet.title,
    description: resource.snippet.description,
    channelId: resource.snippet.channelId,
    channelTitle: resource.snippet.channelTitle,
    thumbnailUrl: getBestThumbnail(resource.snippet.thumbnails),
    duration: parseIsoDuration(resource.contentDetails.duration),
    publishedAt: resource.snippet.publishedAt,
    chapters: extractChapters(resource.snippet.description),
    fetchedAt: now,
    expiresAt,
  }
}

/**
 * Make a rate-limited fetch to the YouTube Data API.
 * Handles 429 responses with exponential backoff.
 */
async function apiFetch(url: string): Promise<Response> {
  const limiter = getYouTubeRateLimiter()
  return limiter.executeWithRetry(() => fetch(url))
}

/**
 * Classify a YouTube API error response.
 */
function classifyApiError(
  status: number,
  body: string
): { error: string; code: YouTubeApiErrorCode } {
  if (status === 400) {
    if (body.includes('API key not valid') || body.includes('keyInvalid')) {
      return {
        error: 'Invalid YouTube API key. Check your configuration in Settings.',
        code: 'INVALID_API_KEY',
      }
    }
    return { error: 'Bad request to YouTube API.', code: 'INVALID_RESPONSE' }
  }
  if (status === 403) {
    if (body.includes('quotaExceeded') || body.includes('dailyLimitExceeded')) {
      return { error: 'YouTube API daily quota exceeded.', code: 'QUOTA_EXCEEDED' }
    }
    return {
      error: 'YouTube API access forbidden. Check API key permissions.',
      code: 'INVALID_API_KEY',
    }
  }
  if (status === 404) {
    return { error: 'YouTube resource not found.', code: 'NOT_FOUND' }
  }
  if (status === 429) {
    return { error: 'YouTube API rate limit exceeded after retries.', code: 'QUOTA_EXCEEDED' }
  }
  return { error: `YouTube API error (HTTP ${status}).`, code: 'NETWORK_ERROR' }
}

// --- Public API ---

/**
 * Fetch metadata for a single YouTube video.
 *
 * Returns cached data if available and within TTL.
 * Falls back to oEmbed if quota is exhausted or API key is invalid.
 *
 * @param videoId - YouTube video ID (11 characters)
 * @returns Video metadata result
 */
export async function getVideoMetadata(
  videoId: string
): Promise<YouTubeApiResult<YouTubeVideoCache>> {
  // Check cache first
  const cached = await getCachedVideo(videoId)
  if (cached) {
    return { ok: true, data: cached, fromCache: true }
  }

  // Check quota before making API call
  if (isQuotaExceeded()) {
    return tryOEmbedFallback(videoId)
  }

  // Get API key
  const apiKey = await getDecryptedYouTubeApiKey()
  if (!apiKey) {
    return {
      ok: false,
      error: 'YouTube API key not configured. Go to Settings to add one.',
      code: 'NO_API_KEY',
    }
  }

  // Fetch from YouTube Data API v3
  const url = `${API_BASE}/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`

  try {
    const response = await apiFetch(url)

    if (!response.ok) {
      const body = await response.text()
      const err = classifyApiError(response.status, body)

      // Fallback to oEmbed for quota/key errors
      if (err.code === 'QUOTA_EXCEEDED' || err.code === 'INVALID_API_KEY') {
        return tryOEmbedFallback(videoId)
      }

      return { ok: false, ...err }
    }

    // Track quota usage (1 unit for videos.list)
    recordQuotaUsage(1)

    const data = (await response.json()) as YouTubeApiVideoListResponse
    if (!data.items || data.items.length === 0) {
      return { ok: false, error: `Video "${videoId}" not found on YouTube.`, code: 'NOT_FOUND' }
    }

    const video = toVideoCache(data.items[0])
    await cacheVideo(video)

    return { ok: true, data: video, fromCache: false }
  } catch (error) {
    console.error('[YouTubeApi] Network error fetching video:', error)
    // Try oEmbed as network fallback
    return tryOEmbedFallback(videoId)
  }
}

/**
 * Fetch metadata for multiple YouTube videos in batches.
 *
 * Batches up to 50 video IDs per API call (1 quota unit per batch).
 * Returns cached data for previously fetched videos.
 *
 * @param videoIds - Array of YouTube video IDs
 * @returns Map of videoId -> metadata result
 */
export async function getVideoMetadataBatch(
  videoIds: string[]
): Promise<Map<string, YouTubeApiResult<YouTubeVideoCache>>> {
  const results = new Map<string, YouTubeApiResult<YouTubeVideoCache>>()
  if (videoIds.length === 0) return results

  // Deduplicate
  const uniqueIds = [...new Set(videoIds)]

  // Check cache for all IDs
  const cachedMap = await getCachedVideos(uniqueIds)
  const uncachedIds: string[] = []

  for (const id of uniqueIds) {
    const cached = cachedMap.get(id)
    if (cached) {
      results.set(id, { ok: true, data: cached, fromCache: true })
    } else {
      uncachedIds.push(id)
    }
  }

  // If all cached, return early
  if (uncachedIds.length === 0) return results

  // Check quota
  if (isQuotaExceeded()) {
    for (const id of uncachedIds) {
      const fallback = await tryOEmbedFallback(id)
      results.set(id, fallback)
    }
    return results
  }

  // Get API key
  const apiKey = await getDecryptedYouTubeApiKey()
  if (!apiKey) {
    for (const id of uncachedIds) {
      results.set(id, { ok: false, error: 'YouTube API key not configured.', code: 'NO_API_KEY' })
    }
    return results
  }

  // Batch fetch in groups of MAX_BATCH_SIZE
  for (let i = 0; i < uncachedIds.length; i += MAX_BATCH_SIZE) {
    const batch = uncachedIds.slice(i, i + MAX_BATCH_SIZE)
    const batchResult = await fetchVideoBatch(batch, apiKey)

    for (const [id, result] of batchResult) {
      results.set(id, result)
    }
  }

  return results
}

/**
 * Fetch a batch of video IDs from the YouTube Data API.
 * Internal helper — handles a single batch of up to 50 IDs.
 */
async function fetchVideoBatch(
  videoIds: string[],
  apiKey: string
): Promise<Map<string, YouTubeApiResult<YouTubeVideoCache>>> {
  const results = new Map<string, YouTubeApiResult<YouTubeVideoCache>>()
  const idsParam = videoIds.join(',')
  const url = `${API_BASE}/videos?part=snippet,contentDetails&id=${encodeURIComponent(idsParam)}&key=${encodeURIComponent(apiKey)}`

  try {
    const response = await apiFetch(url)

    if (!response.ok) {
      const body = await response.text()
      const err = classifyApiError(response.status, body)

      // Fallback for quota/key errors
      if (err.code === 'QUOTA_EXCEEDED' || err.code === 'INVALID_API_KEY') {
        for (const id of videoIds) {
          const fallback = await tryOEmbedFallback(id)
          results.set(id, fallback)
        }
        return results
      }

      for (const id of videoIds) {
        results.set(id, { ok: false, ...err })
      }
      return results
    }

    // Track quota (1 unit per batch call)
    recordQuotaUsage(1)

    const data = (await response.json()) as YouTubeApiVideoListResponse
    const videosToCache: YouTubeVideoCache[] = []
    const foundIds = new Set<string>()

    for (const item of data.items) {
      const video = toVideoCache(item)
      videosToCache.push(video)
      foundIds.add(item.id)
      results.set(item.id, { ok: true, data: video, fromCache: false })
    }

    // Cache all fetched videos
    if (videosToCache.length > 0) {
      await cacheVideos(videosToCache)
    }

    // Mark missing videos as NOT_FOUND
    for (const id of videoIds) {
      if (!foundIds.has(id)) {
        results.set(id, { ok: false, error: `Video "${id}" not found.`, code: 'NOT_FOUND' })
      }
    }
  } catch (error) {
    console.error('[YouTubeApi] Network error in batch fetch:', error)
    for (const id of videoIds) {
      results.set(id, {
        ok: false,
        error: 'Network error fetching video metadata.',
        code: 'NETWORK_ERROR',
      })
    }
  }

  return results
}

/**
 * Fetch all items from a YouTube playlist with pagination.
 *
 * Paginates through all pages (50 items per page, 1 quota unit per page).
 * Returns videos in playlist order.
 *
 * @param playlistId - YouTube playlist ID
 * @returns Array of playlist items in playlist order
 */
export async function getPlaylistItems(
  playlistId: string
): Promise<YouTubeApiResult<YouTubePlaylistItem[]>> {
  // Check quota
  if (isQuotaExceeded()) {
    toast.warning('YouTube API quota exceeded — cannot fetch playlist contents.')
    return { ok: false, error: 'YouTube API daily quota exceeded.', code: 'QUOTA_EXCEEDED' }
  }

  // Get API key
  const apiKey = await getDecryptedYouTubeApiKey()
  if (!apiKey) {
    return { ok: false, error: 'YouTube API key not configured.', code: 'NO_API_KEY' }
  }

  const allItems: YouTubePlaylistItem[] = []
  let pageToken: string | undefined

  // Paginate through all pages
  do {
    const url = buildPlaylistUrl(playlistId, apiKey, pageToken)

    try {
      const response = await apiFetch(url)

      if (!response.ok) {
        const body = await response.text()
        const err = classifyApiError(response.status, body)
        return { ok: false, ...err }
      }

      // Track quota (1 unit per page)
      recordQuotaUsage(1)

      const data = (await response.json()) as YouTubeApiPlaylistResponse

      for (const item of data.items) {
        const videoId = item.snippet.resourceId.videoId
        // Skip deleted/private videos (they have empty titles)
        if (!videoId || !item.snippet.title) continue

        allItems.push({
          videoId,
          title: item.snippet.title,
          position: item.snippet.position,
          thumbnailUrl: getBestThumbnail(item.snippet.thumbnails),
          channelTitle: item.snippet.channelTitle,
        })
      }

      pageToken = data.nextPageToken
    } catch (error) {
      console.error('[YouTubeApi] Network error fetching playlist page:', error)
      return { ok: false, error: 'Network error fetching playlist.', code: 'NETWORK_ERROR' }
    }
  } while (pageToken)

  // Sort by position to ensure playlist order
  allItems.sort((a, b) => a.position - b.position)

  return { ok: true, data: allItems, fromCache: false }
}

/**
 * Build a playlist items URL with pagination support.
 */
function buildPlaylistUrl(playlistId: string, apiKey: string, pageToken?: string): string {
  let url = `${API_BASE}/playlistItems?part=snippet&maxResults=${MAX_PAGE_SIZE}&playlistId=${encodeURIComponent(playlistId)}&key=${encodeURIComponent(apiKey)}`
  if (pageToken) {
    url += `&pageToken=${encodeURIComponent(pageToken)}`
  }
  return url
}

// --- oEmbed Fallback ---

/**
 * Fetch basic metadata via YouTube oEmbed (no API key required).
 * Used as fallback when quota is exhausted or API key is invalid.
 *
 * oEmbed returns limited data: title, author_name, thumbnail_url.
 * Duration, description, chapters, and channel ID are not available.
 */
async function tryOEmbedFallback(videoId: string): Promise<YouTubeApiResult<YouTubeVideoCache>> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const url = `${OEMBED_URL}?url=${encodeURIComponent(videoUrl)}&format=json`
    const response = await fetch(url)

    if (!response.ok) {
      return {
        ok: false,
        error: 'Video not found and oEmbed fallback failed.',
        code: 'NOT_FOUND',
      }
    }

    const data = (await response.json()) as {
      title: string
      author_name: string
      author_url: string
      thumbnail_url: string
    }

    toast.warning('YouTube API quota exceeded — showing limited metadata')

    const now = new Date().toISOString()
    const ttlMs = getCacheTtlMs()
    const expiresAt = new Date(Date.now() + ttlMs).toISOString()

    const fallbackVideo: YouTubeVideoCache = {
      videoId,
      title: data.title,
      description: '', // Not available via oEmbed
      channelId: '', // Not available via oEmbed
      channelTitle: data.author_name,
      thumbnailUrl: data.thumbnail_url,
      duration: 0, // Not available via oEmbed
      publishedAt: '', // Not available via oEmbed
      chapters: [], // Not available via oEmbed
      fetchedAt: now,
      expiresAt,
    }

    // Cache the fallback data too
    await cacheVideo(fallbackVideo)

    return { ok: true, data: fallbackVideo, fromCache: false }
  } catch (error) {
    console.error('[YouTubeApi] oEmbed fallback failed:', error)
    return {
      ok: false,
      error: 'Failed to fetch video metadata. Check your network connection.',
      code: 'NETWORK_ERROR',
    }
  }
}

/**
 * Fetch oEmbed data directly (for use when API key is not configured).
 *
 * @param videoId - YouTube video ID
 * @returns oEmbed metadata or error
 */
export async function getOEmbedMetadata(
  videoId: string
): Promise<YouTubeApiResult<YouTubeOEmbedData>> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const url = `${OEMBED_URL}?url=${encodeURIComponent(videoUrl)}&format=json`
    const response = await fetch(url)

    if (!response.ok) {
      return { ok: false, error: 'Video not found via oEmbed.', code: 'NOT_FOUND' }
    }

    const data = (await response.json()) as {
      title: string
      author_name: string
      author_url: string
      thumbnail_url: string
    }

    return {
      ok: true,
      data: {
        title: data.title,
        authorName: data.author_name,
        authorUrl: data.author_url,
        thumbnailUrl: data.thumbnail_url,
      },
      fromCache: false,
    }
  } catch (error) {
    console.error('[YouTubeApi] oEmbed request failed:', error)
    return {
      ok: false,
      error: 'Network error fetching oEmbed data.',
      code: 'NETWORK_ERROR',
    }
  }
}

/**
 * Clear the entire video cache (for maintenance/debugging).
 * @internal
 */
export async function clearVideoCache(): Promise<void> {
  await db.youtubeVideoCache.clear()
}

/**
 * Get cache statistics (for diagnostics UI).
 */
export async function getCacheStats(): Promise<{ count: number; oldestFetchedAt: string | null }> {
  const count = await db.youtubeVideoCache.count()
  if (count === 0) return { count, oldestFetchedAt: null }

  const all = await db.youtubeVideoCache.orderBy('expiresAt').first()
  return { count, oldestFetchedAt: all?.fetchedAt ?? null }
}
