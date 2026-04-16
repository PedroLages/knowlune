/**
 * Unit tests for GoogleBooksService.
 *
 * @since E108-S07
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchGoogleBooks } from '../GoogleBooksService'
import type { MetadataSearchResult } from '../CoverSearchService'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VOLUME_FULL = {
  volumeInfo: {
    title: 'Project Hail Mary',
    authors: ['Andy Weir'],
    description: 'A lone astronaut must save the Earth.',
    categories: ['Science Fiction', 'Adventure fiction'],
    industryIdentifiers: [
      { type: 'ISBN_13', identifier: '9780593135204' },
      { type: 'ISBN_10', identifier: '0593135202' },
    ],
    imageLinks: {
      thumbnail: 'http://books.google.com/books/content?id=abc&zoom=1',
      smallThumbnail: 'http://books.google.com/books/content?id=abc&zoom=5',
    },
    seriesInfo: { bookDisplayNumber: '1' },
  },
}

const VOLUME_NO_COVER = {
  volumeInfo: {
    title: 'Invisible Book',
    authors: ['Jane Author'],
    description: 'A book with no cover art.',
    categories: ['Literary Fiction'],
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780000000001' }],
    // imageLinks intentionally absent
  },
}

const VOLUME_NO_CATEGORIES = {
  volumeInfo: {
    title: 'Uncategorized',
    authors: ['John Doe'],
    description: 'A book with no categories.',
    industryIdentifiers: [],
    imageLinks: {
      thumbnail: 'http://books.google.com/books/content?id=xyz&zoom=1',
    },
  },
}

function mockFetchOk(items: unknown[]) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

function mockFetchError() {
  return vi.fn().mockRejectedValue(new Error('Network failure'))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('searchGoogleBooks', () => {
  beforeEach(() => {
    // Default: browser is online
    vi.stubGlobal('navigator', { onLine: true })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // ── Happy path: title + author ──────────────────────────────────────────────

  it('returns mapped results for a title+author search', async () => {
    vi.stubGlobal('fetch', mockFetchOk([VOLUME_FULL]))

    const promise = searchGoogleBooks({ title: 'Project Hail Mary', author: 'Andy Weir' })
    await vi.runAllTimersAsync()
    const results = await promise

    expect(Array.isArray(results)).toBe(true)
    const items = results as MetadataSearchResult[]
    expect(items).toHaveLength(1)

    const [result] = items
    expect(result.provider).toBe('google-books')
    expect(result.metadata.title).toBe('Project Hail Mary')
    expect(result.metadata.author).toBe('Andy Weir')
    expect(result.metadata.description).toBe('A lone astronaut must save the Earth.')
    expect(result.metadata.genres).toEqual(['Science Fiction', 'Adventure fiction'])
    expect(result.metadata.isbn).toBe('9780593135204')
    expect(result.metadata.seriesSequence).toBe('1')
  })

  it('upgrades thumbnail URL from http to https', async () => {
    vi.stubGlobal('fetch', mockFetchOk([VOLUME_FULL]))

    const promise = searchGoogleBooks({ title: 'Project Hail Mary', author: 'Andy Weir' })
    await vi.runAllTimersAsync()
    const results = await promise

    const [result] = results as MetadataSearchResult[]
    expect(result.coverUrl).toMatch(/^https:\/\//)
    expect(result.thumbnailUrl).toMatch(/^https:\/\//)
    expect(result.coverUrl).toContain('zoom=6')
    expect(result.thumbnailUrl).toContain('zoom=1')
  })

  it('upgrades coverUrl to zoom=6 (extraLarge) from zoom=1', async () => {
    vi.stubGlobal('fetch', mockFetchOk([VOLUME_FULL]))

    const promise = searchGoogleBooks({ title: 'Project Hail Mary', author: 'Andy Weir' })
    await vi.runAllTimersAsync()
    const results = await promise

    const [result] = results as MetadataSearchResult[]
    expect(result.coverUrl).toContain('zoom=6')
    expect(result.thumbnailUrl).toContain('zoom=1')
    expect(result.coverUrl).not.toContain('zoom=1')
  })

  it('strips edge=curl from coverUrl and thumbnailUrl', async () => {
    const volumeWithCurl = {
      volumeInfo: {
        ...VOLUME_FULL.volumeInfo,
        imageLinks: {
          thumbnail: 'http://books.google.com/books/content?id=abc&zoom=1&edge=curl&source=gbs_api',
        },
      },
    }
    vi.stubGlobal('fetch', mockFetchOk([volumeWithCurl]))

    const promise = searchGoogleBooks({ title: 'Project Hail Mary', author: 'Andy Weir' })
    await vi.runAllTimersAsync()
    const results = await promise

    const [result] = results as MetadataSearchResult[]
    expect(result.coverUrl).not.toContain('edge=curl')
    expect(result.thumbnailUrl).not.toContain('edge=curl')
    expect(result.coverUrl).toContain('zoom=6')
    expect(result.thumbnailUrl).toContain('zoom=1')
  })

  it('handles thumbnail URL with no edge=curl — URLs unaffected by strip', async () => {
    vi.stubGlobal('fetch', mockFetchOk([VOLUME_FULL]))

    const promise = searchGoogleBooks({ title: 'Project Hail Mary', author: 'Andy Weir' })
    await vi.runAllTimersAsync()
    const results = await promise

    const [result] = results as MetadataSearchResult[]
    // No edge=curl in fixture — strip is a no-op, URLs should still be valid
    expect(result.coverUrl).toContain('zoom=6')
    expect(result.coverUrl).not.toContain('edge=curl')
  })

  // ── Happy path: ISBN search ─────────────────────────────────────────────────

  it('performs ISBN search when isbn is provided and returns results', async () => {
    const fetchMock = mockFetchOk([VOLUME_FULL])
    vi.stubGlobal('fetch', fetchMock)

    const promise = searchGoogleBooks({
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      isbn: '9780593135204',
    })
    await vi.runAllTimersAsync()
    const results = await promise

    // Verify the first fetch used the ISBN query
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('isbn%3A9780593135204')

    expect(Array.isArray(results)).toBe(true)
    const [result] = results as MetadataSearchResult[]
    expect(result.metadata.isbn).toBe('9780593135204')
  })

  it('falls back to title+author search when ISBN returns no results', async () => {
    // First call (ISBN) returns empty, second call (title+author) returns results
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [VOLUME_FULL] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const promise = searchGoogleBooks({
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      isbn: '0000000000000',
    })
    await vi.runAllTimersAsync()
    const results = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(Array.isArray(results)).toBe(true)
    const [result] = results as MetadataSearchResult[]
    expect(result.metadata.title).toBe('Project Hail Mary')
  })

  // ── Edge case: no cover image ───────────────────────────────────────────────

  it('returns coverUrl as undefined when volume has no imageLinks', async () => {
    vi.stubGlobal('fetch', mockFetchOk([VOLUME_NO_COVER]))

    const promise = searchGoogleBooks({ title: 'Invisible Book', author: 'Jane Author' })
    await vi.runAllTimersAsync()
    const results = await promise

    const [result] = results as MetadataSearchResult[]
    expect(result.coverUrl).toBeUndefined()
    expect(result.thumbnailUrl).toBeUndefined()
  })

  // ── Edge case: no categories ────────────────────────────────────────────────

  it('returns genres as undefined when volume has no categories', async () => {
    vi.stubGlobal('fetch', mockFetchOk([VOLUME_NO_CATEGORIES]))

    const promise = searchGoogleBooks({ title: 'Uncategorized', author: 'John Doe' })
    await vi.runAllTimersAsync()
    const results = await promise

    const [result] = results as MetadataSearchResult[]
    expect(result.metadata.genres).toBeUndefined()
  })

  it('returns genres as undefined when categories array is empty', async () => {
    const volumeEmptyCats = {
      volumeInfo: {
        ...VOLUME_NO_CATEGORIES.volumeInfo,
        categories: [],
      },
    }
    vi.stubGlobal('fetch', mockFetchOk([volumeEmptyCats]))

    const promise = searchGoogleBooks({ title: 'Uncategorized', author: 'John Doe' })
    await vi.runAllTimersAsync()
    const results = await promise

    const [result] = results as MetadataSearchResult[]
    expect(result.metadata.genres).toBeUndefined()
  })

  // ── Error path: network failure ─────────────────────────────────────────────

  it('returns empty array when fetch rejects with a network error', async () => {
    vi.stubGlobal('fetch', mockFetchError())

    const promise = searchGoogleBooks({ title: 'Some Book', author: 'Some Author' })
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toEqual([])
  })

  it('returns empty array when the API responds with a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Service Unavailable', { status: 503 }))
    )

    const promise = searchGoogleBooks({ title: 'Some Book', author: 'Some Author' })
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toEqual([])
  })

  // ── Error path: offline ─────────────────────────────────────────────────────

  it('returns skippedOffline sentinel when navigator.onLine is false', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchGoogleBooks({ title: 'Any Book', author: 'Any Author' })

    expect(results).toEqual({ skippedOffline: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
