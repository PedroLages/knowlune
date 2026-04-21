/**
 * Audnexus service for audiobook metadata via a two-step lookup:
 *   1. Search Audible catalog to resolve ASINs from title+author
 *   2. Fetch rich metadata per ASIN from the Audnexus API
 *
 * If the book already has an ASIN, step 1 is skipped entirely.
 *
 * Note: The Audible catalog endpoint is CORS-restricted in the browser. Fetch
 * errors at that step are silently swallowed; a backend proxy (Unit 8) is the
 * intended path for browser-direct calls.
 *
 * All requests have a 5-second timeout. Failures are best-effort — never throw.
 *
 * @module AudnexusService
 * @since E108-S08 (multi-provider metadata search)
 */

import type { MetadataSearchResult } from './CoverSearchService'

const TIMEOUT_MS = 5000

/**
 * Search for audiobook metadata via Audnexus (backed by Audible data).
 *
 * When `params.asin` is provided the Audible catalog search is skipped and
 * Audnexus is queried directly, which is both faster and avoids the CORS
 * restriction on the Audible endpoint.
 *
 * Returns an array of {@link MetadataSearchResult} or an offline sentinel.
 * Never throws.
 */
export async function searchAudnexus(params: {
  title: string
  author: string
  asin?: string // if provided, skip Audible search and go directly to Audnexus
}): Promise<MetadataSearchResult[] | { skippedOffline: true }> {
  // Skip network requests when the browser reports offline status.
  // navigator.onLine can return true behind a captive portal — the try/catch
  // below provides defence-in-depth for those cases.
  if (!navigator.onLine) {
    console.info('[AudnexusService] Skipping search — browser reports offline')
    return { skippedOffline: true }
  }

  try {
    // Fast path: known ASIN — skip Audible catalog entirely.
    if (params.asin) {
      const result = await fetchAudnexusMetadata(params.asin)
      return result ? [result] : []
    }

    // Step 1: resolve ASINs from the Audible catalog.
    const asins = await searchAudibleCatalog(params.title, params.author)
    if (asins.length === 0) return []

    // Step 2: enrich each ASIN with Audnexus metadata (up to 5).
    const results = await Promise.all(asins.slice(0, 5).map(asin => fetchAudnexusMetadata(asin)))

    return results.filter(Boolean) as MetadataSearchResult[]
  } catch {
    // silent-catch-ok: Audnexus is best-effort, caller proceeds without it
    return []
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Audible catalog search — resolves title+author to a list of ASINs.
 *
 * Uses the Express backend proxy (`/api/audible/proxy`) because the Audible
 * catalog endpoint blocks browser-direct requests via CORS.
 */
async function searchAudibleCatalog(title: string, author: string): Promise<string[]> {
  const params = new URLSearchParams({ title, author, num_results: '5' })
  const url = `/api/audible/proxy?${params}`

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) return []

    const data = await response.json()
    const products = Array.isArray(data?.products) ? (data.products as AudibleProduct[]) : []
    return products.map(p => p.asin).filter(Boolean)
  } catch {
    // silent-catch-ok: Audible catalog search is best-effort
    return []
  }
}

/**
 * Fetch rich audiobook metadata from Audnexus for a given ASIN.
 * Returns `null` when the fetch fails or the ASIN is not found.
 */
async function fetchAudnexusMetadata(asin: string): Promise<MetadataSearchResult | null> {
  try {
    const response = await fetchWithTimeout(`https://api.audnex.us/books/${asin}`)
    if (!response.ok) return null

    const data: AudnexusBook = await response.json()
    return mapAudnexusBook(data)
  } catch {
    // silent-catch-ok: Audnexus per-ASIN fetch is best-effort
    return null
  }
}

// ── Type definitions ──────────────────────────────────────────────────────────

interface AudibleProduct {
  asin: string
  title?: string
  authors?: Array<{ name: string }>
  narrators?: Array<{ name: string }>
  merchandising_summary?: string
  product_images?: Record<string, string>
}

interface AudnexusBook {
  asin?: string
  title?: string
  authors?: Array<{ name: string }>
  narrators?: Array<{ name: string }>
  genres?: Array<{ asin?: string; name: string }>
  image?: string
  seriesName?: string
  seriesPosition?: string
  description?: string
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapAudnexusBook(book: AudnexusBook): MetadataSearchResult {
  const genres = book.genres && book.genres.length > 0 ? book.genres.map(g => g.name) : undefined

  return {
    provider: 'audnexus',
    coverUrl: book.image,
    thumbnailUrl: book.image,
    metadata: {
      title: book.title,
      author: book.authors?.[0]?.name,
      narrator: book.narrators?.[0]?.name,
      description: book.description,
      genres,
      series: book.seriesName,
      seriesSequence: book.seriesPosition,
      asin: book.asin,
    },
  }
}

// ── Fetch utility ─────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId))
}
