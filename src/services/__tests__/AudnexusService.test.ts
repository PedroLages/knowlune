/**
 * Unit tests for AudnexusService.
 *
 * @since E108-S08
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchAudnexus } from '../AudnexusService'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ASIN_HAIL_MARY = 'B08G9PRS1K'

const AUDIBLE_PRODUCT_FULL = {
  asin: ASIN_HAIL_MARY,
  title: 'Project Hail Mary',
  authors: [{ name: 'Andy Weir' }],
  narrators: [{ name: 'Ray Porter' }],
  merchandising_summary: 'A lone astronaut must save Earth.',
  product_images: { '500': 'https://m.media-amazon.com/images/I/audible-cover-500.jpg' },
}

const AUDNEXUS_BOOK_FULL = {
  asin: ASIN_HAIL_MARY,
  title: 'Project Hail Mary',
  authors: [{ name: 'Andy Weir' }],
  narrators: [{ name: 'Ray Porter' }],
  genres: [{ name: 'Science Fiction' }, { name: 'Adventure' }],
  image: 'https://m.media-amazon.com/images/I/audnexus-cover.jpg',
  seriesName: 'Hail Mary',
  seriesPosition: '1',
  description: 'A lone astronaut must save the Earth from the extinction of the human race.',
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

/**
 * Build a mock fetch that sequences through the provided responses in order.
 * Each call consumes one entry; the last entry is reused for any extra calls.
 */
function mockFetchSequence(responses: Array<{ body: unknown; status?: number } | 'network-error'>) {
  const mocks = responses.map(r => {
    if (r === 'network-error') {
      return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    }
    const { body, status = 200 } = r as { body: unknown; status?: number }
    return vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  let callIndex = 0
  return vi.fn().mockImplementation((...args: unknown[]) => {
    const fn = mocks[Math.min(callIndex, mocks.length - 1)]
    callIndex++
    return fn(...args)
  })
}

function mockFetchSingle(body: unknown, status = 200) {
  return mockFetchSequence([{ body, status }])
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('searchAudnexus', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // ── Happy path: title + author ────────────────────────────────────────────

  it('returns full metadata when Audible search succeeds and Audnexus enriches each ASIN', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        // Call 1: Audible catalog search
        { body: { products: [AUDIBLE_PRODUCT_FULL] } },
        // Call 2: Audnexus per-ASIN
        { body: AUDNEXUS_BOOK_FULL },
      ])
    )

    const promise = searchAudnexus({ title: 'Project Hail Mary', author: 'Andy Weir' })
    await vi.runAllTimersAsync()
    const results = await promise

    expect(Array.isArray(results)).toBe(true)
    const items = results as MetadataSearchResult[]
    expect(items).toHaveLength(1)

    const [result] = items
    expect(result.provider).toBe('audnexus')
    expect(result.coverUrl).toBe('https://m.media-amazon.com/images/I/audnexus-cover.jpg')
    expect(result.thumbnailUrl).toBe('https://m.media-amazon.com/images/I/audnexus-cover.jpg')
    expect(result.metadata.title).toBe('Project Hail Mary')
    expect(result.metadata.author).toBe('Andy Weir')
    expect(result.metadata.narrator).toBe('Ray Porter')
    expect(result.metadata.genres).toEqual(['Science Fiction', 'Adventure'])
    expect(result.metadata.series).toBe('Hail Mary')
    expect(result.metadata.seriesSequence).toBe('1')
    expect(result.metadata.asin).toBe(ASIN_HAIL_MARY)
    expect(result.metadata.description).toBe(
      'A lone astronaut must save the Earth from the extinction of the human race.'
    )
  })

  // ── Happy path: direct ASIN lookup ───────────────────────────────────────

  it('skips Audible search when params.asin is provided and goes directly to Audnexus', async () => {
    const fetchMock = mockFetchSingle(AUDNEXUS_BOOK_FULL)
    vi.stubGlobal('fetch', fetchMock)

    const promise = searchAudnexus({
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      asin: ASIN_HAIL_MARY,
    })
    await vi.runAllTimersAsync()
    const results = await promise

    // Only one fetch call — straight to Audnexus, no Audible catalog call.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain(`audnex.us/books/${ASIN_HAIL_MARY}`)

    const items = results as MetadataSearchResult[]
    expect(items).toHaveLength(1)
    expect(items[0].provider).toBe('audnexus')
    expect(items[0].metadata.asin).toBe(ASIN_HAIL_MARY)
    expect(items[0].metadata.narrator).toBe('Ray Porter')
    expect(items[0].metadata.series).toBe('Hail Mary')
  })

  // ── Edge case: Audible returns zero products ──────────────────────────────

  it('returns empty array when Audible search returns no products', async () => {
    vi.stubGlobal('fetch', mockFetchSingle({ products: [] }))

    const promise = searchAudnexus({ title: 'Unknown Title', author: 'Unknown Author' })
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toEqual([])
  })

  // ── Edge case: Audible returns ASINs but Audnexus fails for all ───────────

  it('returns empty array when Audible succeeds but Audnexus fails for all ASINs', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        // Audible catalog: one ASIN
        { body: { products: [AUDIBLE_PRODUCT_FULL] } },
        // Audnexus for that ASIN: not found
        { body: { error: 'Not Found' }, status: 404 },
      ])
    )

    const promise = searchAudnexus({ title: 'Project Hail Mary', author: 'Andy Weir' })
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toEqual([])
  })

  // ── Error path: network timeout ───────────────────────────────────────────

  it('returns empty array when Audible catalog fetch times out (AbortError)', async () => {
    // Simulate a network error (AbortController fires this as an AbortError)
    vi.stubGlobal('fetch', mockFetchNetworkError())

    const promise = searchAudnexus({ title: 'Project Hail Mary', author: 'Andy Weir' })
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toEqual([])
  })

  it('returns empty array when Audnexus fetch times out after a successful Audible search', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        // Audible: success
        { body: { products: [AUDIBLE_PRODUCT_FULL] } },
        // Audnexus: network error
        'network-error',
      ])
    )

    const promise = searchAudnexus({ title: 'Project Hail Mary', author: 'Andy Weir' })
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toEqual([])
  })

  // ── Error path: offline ───────────────────────────────────────────────────

  it('returns { skippedOffline: true } when navigator.onLine is false', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const results = await searchAudnexus({ title: 'Any Book', author: 'Any Author' })

    expect(results).toEqual({ skippedOffline: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not call fetch when offline even with a known ASIN', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const results = await searchAudnexus({
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      asin: ASIN_HAIL_MARY,
    })

    expect(results).toEqual({ skippedOffline: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── Local type alias for test narrowing ───────────────────────────────────────
type MetadataSearchResult = {
  provider: string
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
