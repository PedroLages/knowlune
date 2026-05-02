/**
 * iTunes Search API service for audiobook metadata.
 *
 * Public API with no authentication required; CORS-friendly.
 * All requests have a 5-second timeout and are best-effort only.
 *
 * @module ITunesSearchService
 * @since E83-S10 (multi-provider metadata search)
 */

import type { MetadataSearchResult } from './CoverSearchService'

const TIMEOUT_MS = 5000

/**
 * Search iTunes for audiobook metadata by title and author.
 * Returns an array of results, or a sentinel if the browser is offline.
 * Never throws.
 */
export async function searchITunes(params: {
  title: string
  author: string
}): Promise<MetadataSearchResult[] | { skippedOffline: true }> {
  // Skip network requests when offline — callers can distinguish this
  // sentinel from "fetched but found nothing".
  if (!navigator.onLine) {
    console.info('[ITunesSearchService] Skipping search — browser reports offline')
    return { skippedOffline: true }
  }

  try {
    // Quote the title for an exact phrase match, reducing unrelated results
    const query = [`"${params.title}"`, params.author].filter(Boolean).join(' ')
    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('entity', 'audiobook')
    url.searchParams.set('term', query)
    url.searchParams.set('limit', '5')

    const response = await fetchWithTimeout(url.toString())
    if (!response.ok) return []

    const data = await response.json()
    const results: unknown[] = data?.results ?? []

    return results
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' &&
          item !== null &&
          (item as Record<string, unknown>).wrapperType === 'audiobook'
      )
      .map(item => mapResult(item))
  } catch {
    // silent-catch-ok: iTunes metadata is best-effort, caller proceeds without it
    return []
  }
}

function mapResult(item: Record<string, unknown>): MetadataSearchResult {
  const artworkUrl100 = typeof item.artworkUrl100 === 'string' ? item.artworkUrl100 : undefined
  const artworkUrl600 = typeof item.artworkUrl600 === 'string' ? item.artworkUrl600 : undefined
  const primaryGenreName =
    typeof item.primaryGenreName === 'string' ? item.primaryGenreName : undefined

  // iTunes artwork URLs support arbitrary sizes — replace 600x600 with 1200x1200
  const hiRes = artworkUrl600?.replace('600x600', '1200x1200')

  return {
    provider: 'itunes',
    coverUrl: hiRes ?? artworkUrl600 ?? artworkUrl100,
    thumbnailUrl: artworkUrl100,
    metadata: {
      title: typeof item.collectionName === 'string' ? item.collectionName : undefined,
      author: typeof item.artistName === 'string' ? item.artistName : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      genres: primaryGenreName ? [primaryGenreName] : undefined,
      // iTunes does not provide narrator, series, ISBN, or ASIN data
    },
  }
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId))
}
