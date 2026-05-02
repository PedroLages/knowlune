/**
 * CoverSearchService — unified metadata aggregator across all providers.
 *
 * Fires each provider independently and delivers results progressively via
 * the `onResults` callback. Does NOT use Promise.allSettled — each provider
 * resolves on its own schedule so the UI can update incrementally.
 *
 * Provider priority per format:
 *   audiobook → Audnexus, iTunes, Google Books, Open Library
 *   epub/pdf/mobi → Google Books, Open Library
 *
 * @module CoverSearchService
 * @since E108-S09 (multi-provider metadata search — Unit 5)
 */

import { searchAudnexus } from './AudnexusService'
import { searchGoogleBooks } from './GoogleBooksService'
import { searchITunes } from './ITunesSearchService'
import { fetchOpenLibraryMetadata } from './OpenLibraryService'

// ── Canonical type (re-exported as the single source of truth) ────────────────

export interface MetadataSearchResult {
  provider: 'google-books' | 'open-library' | 'audnexus' | 'itunes'
  coverUrl?: string
  thumbnailUrl?: string
  metadata: {
    title?: string
    author?: string
    narrator?: string
    description?: string
    genres?: string[]
    series?: string
    seriesSequence?: string
    isbn?: string
    asin?: string
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search for book covers and metadata across all relevant providers.
 *
 * Results are delivered progressively — `onResults` is called once per
 * provider as each one settles. If the `signal` is aborted before a provider
 * resolves, that provider's results are silently dropped.
 *
 * Returns a Promise that resolves when all providers have settled, so callers
 * can react to completion without a fixed timeout.
 *
 * @param query   Title, author, and optional identifiers to search by
 * @param format  Book format — controls which providers are queried
 * @param onResults  Callback invoked per provider with that provider's results
 * @param signal  Optional AbortSignal to cancel in-flight result delivery
 */
export async function searchCovers(
  query: { title: string; author: string; isbn?: string; asin?: string },
  format: 'audiobook' | 'epub' | 'pdf' | 'mobi',
  onResults: (results: MetadataSearchResult[]) => void,
  signal?: AbortSignal
): Promise<void> {
  const deliver = (provider: string, results: MetadataSearchResult[]) => {
    if (signal?.aborted) return
    console.info(`[CoverSearch] ${provider}: ${results.length} results`, results)
    onResults(results)
  }

  const promises: Promise<void>[] = []

  if (format === 'audiobook') {
    // Priority order: Audnexus → iTunes → Google Books → Open Library
    promises.push(
      searchAudnexus({ title: query.title, author: query.author, asin: query.asin })
        .then(raw => deliver('audnexus', normalizeAndDedup(toArray(raw))))
        .catch(e => {
          console.warn('[CoverSearch] audnexus error:', e)
          deliver('audnexus', [])
        }),
      searchITunes({ title: query.title, author: query.author })
        .then(raw => deliver('itunes', normalizeAndDedup(toArray(raw))))
        .catch(e => {
          console.warn('[CoverSearch] itunes error:', e)
          deliver('itunes', [])
        }),
      searchGoogleBooks({ title: query.title, author: query.author, isbn: query.isbn })
        .then(raw => deliver('google-books', normalizeAndDedup(toArray(raw))))
        .catch(e => {
          console.warn('[CoverSearch] google-books error:', e)
          deliver('google-books', [])
        }),
      searchOpenLibrary({ title: query.title, author: query.author, isbn: query.isbn })
        .then(results => deliver('open-library', normalizeAndDedup(results)))
        .catch(e => {
          console.warn('[CoverSearch] open-library error:', e)
          deliver('open-library', [])
        })
    )
  } else {
    // epub / pdf / mobi: Google Books first, then Open Library
    promises.push(
      searchGoogleBooks({ title: query.title, author: query.author, isbn: query.isbn })
        .then(raw => deliver('google-books', normalizeAndDedup(toArray(raw))))
        .catch(e => {
          console.warn('[CoverSearch] google-books error:', e)
          deliver('google-books', [])
        }),
      searchOpenLibrary({ title: query.title, author: query.author, isbn: query.isbn })
        .then(results => deliver('open-library', normalizeAndDedup(results)))
        .catch(e => {
          console.warn('[CoverSearch] open-library error:', e)
          deliver('open-library', [])
        })
    )
  }

  await Promise.allSettled(promises)
}

// ── Open Library adapter ──────────────────────────────────────────────────────

/**
 * Adapt Open Library's single-result shape into the canonical array form.
 * Returns 0 or 1 items depending on whether the fetch produced a coverUrl.
 */
async function searchOpenLibrary(params: {
  title: string
  author: string
  isbn?: string
}): Promise<MetadataSearchResult[]> {
  const result = await fetchOpenLibraryMetadata(params)

  // Offline sentinel or empty result — return nothing
  if ('skippedOffline' in result && result.skippedOffline) return []
  if (!result.coverUrl && !result.description && !result.subjects) return []

  return [
    {
      provider: 'open-library',
      coverUrl: result.coverUrl,
      thumbnailUrl: result.coverUrl,
      metadata: {
        description: result.description,
        genres: result.subjects && result.subjects.length > 0 ? result.subjects : undefined,
        isbn: params.isbn,
      },
    },
  ]
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Convert a provider's return value (array or offline sentinel) to an array.
 * Skipped-offline sentinels are treated as empty — callers still get a
 * callback invocation so they can update loading state.
 */
function toArray(raw: MetadataSearchResult[] | { skippedOffline: true }): MetadataSearchResult[] {
  if (!Array.isArray(raw)) return []
  return raw
}

/**
 * Remove duplicates within a single provider's result set.
 * Deduplication key: exact ISBN or ASIN match.
 * Also caps at 5 results per provider as a safety net.
 */
function normalizeAndDedup(results: MetadataSearchResult[]): MetadataSearchResult[] {
  const seenIsbn = new Set<string>()
  const seenAsin = new Set<string>()
  const deduped: MetadataSearchResult[] = []

  for (const result of results) {
    const isbn = result.metadata.isbn
    const asin = result.metadata.asin

    if (isbn && seenIsbn.has(isbn)) continue
    if (asin && seenAsin.has(asin)) continue

    if (isbn) seenIsbn.add(isbn)
    if (asin) seenAsin.add(asin)

    deduped.push(result)
    if (deduped.length >= 5) break
  }

  return deduped
}
