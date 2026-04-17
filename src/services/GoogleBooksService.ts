/**
 * Google Books API service for book metadata and cover fetching.
 *
 * Public API — no authentication required in keyless mode.
 * All requests have a 5-second timeout and are best-effort;
 * failures never block the caller.
 *
 * @module GoogleBooksService
 * @since E108-S07
 */

import type { MetadataSearchResult } from './CoverSearchService'

const TIMEOUT_MS = 5000

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes'

/**
 * Search Google Books by title + author, or by ISBN when provided.
 * Returns an array of results or a sentinel when offline.
 * Never throws.
 */
export async function searchGoogleBooks(params: {
  title: string
  author: string
  isbn?: string
}): Promise<MetadataSearchResult[] | { skippedOffline: true }> {
  // Skip network requests when the browser reports offline status.
  // navigator.onLine can return true behind a captive portal — the try/catch
  // below provides defense-in-depth for those cases.
  if (!navigator.onLine) {
    console.info('[GoogleBooksService] Skipping search — browser reports offline')
    return { skippedOffline: true }
  }

  try {
    // ISBN search returns the most precise match — prefer it when available.
    if (params.isbn) {
      const results = await queryGoogleBooks(`isbn:${params.isbn}`)
      if (results.length > 0) return results
    }

    // Fallback: title + author search.
    const q = `intitle:${params.title} inauthor:${params.author}`
    return await queryGoogleBooks(q)
  } catch {
    // silent-catch-ok: Google Books is best-effort, import proceeds without it
    return []
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function queryGoogleBooks(q: string): Promise<MetadataSearchResult[]> {
  const url = `${BASE_URL}?q=${encodeURIComponent(q)}&maxResults=5`
  const response = await fetchWithTimeout(url)
  if (!response.ok) return []

  const data = await response.json()
  const items: unknown[] = data.items ?? []

  return items.map(mapVolumeToResult).filter(Boolean) as MetadataSearchResult[]
}

interface GoogleBooksVolume {
  volumeInfo?: {
    title?: string
    authors?: string[]
    description?: string
    categories?: string[]
    industryIdentifiers?: Array<{ type: string; identifier: string }>
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    seriesInfo?: {
      bookDisplayNumber?: string
    }
  }
}

function mapVolumeToResult(item: unknown): MetadataSearchResult | null {
  const volume = item as GoogleBooksVolume
  const info = volume?.volumeInfo
  if (!info) return null

  const rawThumbnail = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail
  // Google Books serves thumbnails over HTTP — upgrade to HTTPS.
  const httpsUrl = rawThumbnail ? rawThumbnail.replace(/^http:\/\//, 'https://') : undefined
  // Keep thumbnail at zoom=1 (fast grid previews); strip edge=curl visual artifact.
  const thumbnailUrl = httpsUrl?.replace(/&edge=curl/, '')
  // Request the largest available image (zoom=6 = extraLarge, ~1280px); strip edge=curl.
  const coverUrl = httpsUrl?.replace(/&zoom=\d/, '&zoom=6').replace(/&edge=curl/, '')

  const isbn13 = info.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier

  return {
    provider: 'google-books',
    coverUrl,
    thumbnailUrl,
    metadata: {
      title: info.title,
      author: info.authors?.[0],
      description: info.description,
      genres: info.categories && info.categories.length > 0 ? info.categories : undefined,
      isbn: isbn13,
      seriesSequence: info.seriesInfo?.bookDisplayNumber,
    },
  }
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId))
}
