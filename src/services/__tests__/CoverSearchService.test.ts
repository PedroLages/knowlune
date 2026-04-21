/**
 * Unit tests for CoverSearchService.
 *
 * All provider modules are mocked. Tests verify:
 *   - Format-aware provider selection
 *   - Progressive callback (one call per provider, not batched)
 *   - AbortSignal respected
 *   - Partial failure resilience
 *   - Open Library adapter correctness
 *   - Within-provider deduplication
 *
 * @since E108-S09 (multi-provider metadata search — Unit 5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchCovers, type MetadataSearchResult } from '../CoverSearchService'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../AudnexusService', () => ({
  searchAudnexus: vi.fn(),
}))
vi.mock('../GoogleBooksService', () => ({
  searchGoogleBooks: vi.fn(),
}))
vi.mock('../ITunesSearchService', () => ({
  searchITunes: vi.fn(),
}))
vi.mock('../OpenLibraryService', () => ({
  fetchOpenLibraryMetadata: vi.fn(),
}))

import { searchAudnexus } from '../AudnexusService'
import { searchGoogleBooks } from '../GoogleBooksService'
import { searchITunes } from '../ITunesSearchService'
import { fetchOpenLibraryMetadata } from '../OpenLibraryService'

const mockSearchAudnexus = vi.mocked(searchAudnexus)
const mockSearchGoogleBooks = vi.mocked(searchGoogleBooks)
const mockSearchITunes = vi.mocked(searchITunes)
const mockFetchOpenLibraryMetadata = vi.mocked(fetchOpenLibraryMetadata)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUDNEXUS_RESULT: MetadataSearchResult = {
  provider: 'audnexus',
  coverUrl: 'https://audnexus.example.com/cover.jpg',
  thumbnailUrl: 'https://audnexus.example.com/cover.jpg',
  metadata: { title: 'Dune', author: 'Frank Herbert', asin: 'B002V1O7K6', narrator: 'Scott Brick' },
}

const ITUNES_RESULT: MetadataSearchResult = {
  provider: 'itunes',
  coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/abc/100x100bb.jpg',
  thumbnailUrl: 'https://is1-ssl.mzstatic.com/image/thumb/abc/100x100bb.jpg',
  metadata: { title: 'Dune', author: 'Frank Herbert' },
}

const GOOGLE_RESULT: MetadataSearchResult = {
  provider: 'google-books',
  coverUrl: 'https://books.google.com/cover.jpg',
  thumbnailUrl: 'https://books.google.com/cover.jpg',
  metadata: { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
}

const OPEN_LIBRARY_RAW = {
  coverUrl: 'https://covers.openlibrary.org/b/id/12345-L.jpg',
  description: 'A science-fiction epic.',
  subjects: ['Science fiction', 'Ecology'],
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('searchCovers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Happy path: audiobook format ──────────────────────────────────────────

  it('audiobook format: queries all 4 providers and calls onResults once per provider', async () => {
    mockSearchAudnexus.mockResolvedValue([AUDNEXUS_RESULT])
    mockSearchITunes.mockResolvedValue([ITUNES_RESULT])
    mockSearchGoogleBooks.mockResolvedValue([GOOGLE_RESULT])
    mockFetchOpenLibraryMetadata.mockResolvedValue(OPEN_LIBRARY_RAW)

    const onResults = vi.fn()
    searchCovers({ title: 'Dune', author: 'Frank Herbert' }, 'audiobook', onResults)

    // Let all promises settle
    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(4))

    // Each provider reported independently (not batched)
    const allCalls = onResults.mock.calls.map(call => call[0] as MetadataSearchResult[])
    const providers = allCalls.flatMap(results => results.map(r => r.provider))
    expect(providers).toContain('audnexus')
    expect(providers).toContain('itunes')
    expect(providers).toContain('google-books')
    expect(providers).toContain('open-library')
  })

  it('audiobook format: Audnexus receives asin when provided', async () => {
    mockSearchAudnexus.mockResolvedValue([AUDNEXUS_RESULT])
    mockSearchITunes.mockResolvedValue([])
    mockSearchGoogleBooks.mockResolvedValue([])
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers(
      { title: 'Dune', author: 'Frank Herbert', asin: 'B002V1O7K6' },
      'audiobook',
      onResults
    )

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(4))

    expect(mockSearchAudnexus).toHaveBeenCalledWith({
      title: 'Dune',
      author: 'Frank Herbert',
      asin: 'B002V1O7K6',
    })
  })

  // ── Happy path: ebook format ──────────────────────────────────────────────

  it('epub format: only queries Google Books and Open Library', async () => {
    mockSearchGoogleBooks.mockResolvedValue([GOOGLE_RESULT])
    mockFetchOpenLibraryMetadata.mockResolvedValue(OPEN_LIBRARY_RAW)

    const onResults = vi.fn()
    searchCovers({ title: 'Dune', author: 'Frank Herbert' }, 'epub', onResults)

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(2))

    expect(mockSearchAudnexus).not.toHaveBeenCalled()
    expect(mockSearchITunes).not.toHaveBeenCalled()
    expect(mockSearchGoogleBooks).toHaveBeenCalled()
    expect(mockFetchOpenLibraryMetadata).toHaveBeenCalled()
  })

  it('pdf format: only queries Google Books and Open Library', async () => {
    mockSearchGoogleBooks.mockResolvedValue([GOOGLE_RESULT])
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers({ title: 'Dune', author: 'Frank Herbert' }, 'pdf', onResults)

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(2))

    expect(mockSearchAudnexus).not.toHaveBeenCalled()
    expect(mockSearchITunes).not.toHaveBeenCalled()
  })

  it('mobi format: only queries Google Books and Open Library', async () => {
    mockSearchGoogleBooks.mockResolvedValue([GOOGLE_RESULT])
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers({ title: 'Dune', author: 'Frank Herbert' }, 'mobi', onResults)

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(2))

    expect(mockSearchAudnexus).not.toHaveBeenCalled()
    expect(mockSearchITunes).not.toHaveBeenCalled()
  })

  // ── Progressive callback ──────────────────────────────────────────────────

  it('calls onResults independently for each provider as they resolve (not batched)', async () => {
    // Use manually-controlled promises so we can verify partial progress
    let resolveAudnexus!: (v: MetadataSearchResult[]) => void
    let resolveITunes!: (v: MetadataSearchResult[]) => void
    let resolveGoogle!: (v: MetadataSearchResult[]) => void
    let resolveOpenLib!: (v: {
      coverUrl?: string
      description?: string
      subjects?: string[]
    }) => void

    mockSearchAudnexus.mockReturnValue(
      new Promise(res => {
        resolveAudnexus = res
      })
    )
    mockSearchITunes.mockReturnValue(
      new Promise(res => {
        resolveITunes = res
      })
    )
    mockSearchGoogleBooks.mockReturnValue(
      new Promise(res => {
        resolveGoogle = res
      })
    )
    mockFetchOpenLibraryMetadata.mockReturnValue(
      new Promise(res => {
        resolveOpenLib = res
      })
    )

    const onResults = vi.fn()
    searchCovers({ title: 'Dune', author: 'Frank Herbert' }, 'audiobook', onResults)

    // No calls yet — all providers pending
    expect(onResults).toHaveBeenCalledTimes(0)

    // Resolve Audnexus first
    resolveAudnexus([AUDNEXUS_RESULT])
    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(1))
    expect(onResults.mock.calls[0][0][0].provider).toBe('audnexus')

    // Resolve iTunes second
    resolveITunes([ITUNES_RESULT])
    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(2))
    expect(onResults.mock.calls[1][0][0].provider).toBe('itunes')

    // Resolve Google Books third
    resolveGoogle([GOOGLE_RESULT])
    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(3))
    expect(onResults.mock.calls[2][0][0].provider).toBe('google-books')

    // Resolve Open Library last
    resolveOpenLib(OPEN_LIBRARY_RAW)
    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(4))
    expect(onResults.mock.calls[3][0][0].provider).toBe('open-library')
  })

  // ── AbortSignal respected ─────────────────────────────────────────────────

  it('does not call onResults for providers that resolve after abort', async () => {
    const controller = new AbortController()

    let resolveAudnexus!: (v: MetadataSearchResult[]) => void
    let resolveITunes!: (v: MetadataSearchResult[]) => void

    mockSearchAudnexus.mockReturnValue(
      new Promise(res => {
        resolveAudnexus = res
      })
    )
    mockSearchITunes.mockReturnValue(
      new Promise(res => {
        resolveITunes = res
      })
    )
    mockSearchGoogleBooks.mockResolvedValue([GOOGLE_RESULT])
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers(
      { title: 'Dune', author: 'Frank Herbert' },
      'audiobook',
      onResults,
      controller.signal
    )

    // Let Google Books and Open Library resolve first
    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(2))

    // Abort — future results should be dropped
    controller.abort()

    // Now resolve the remaining two providers
    resolveAudnexus([AUDNEXUS_RESULT])
    resolveITunes([ITUNES_RESULT])

    // Give microtasks a chance to run
    await new Promise(r => setTimeout(r, 0))

    // onResults should still only have been called twice (Google + Open Library)
    expect(onResults).toHaveBeenCalledTimes(2)
  })

  // ── Partial failure resilience ────────────────────────────────────────────

  it('still calls onResults for healthy providers when one throws', async () => {
    mockSearchAudnexus.mockRejectedValue(new Error('Audnexus network error'))
    mockSearchITunes.mockResolvedValue([ITUNES_RESULT])
    mockSearchGoogleBooks.mockResolvedValue([GOOGLE_RESULT])
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers({ title: 'Dune', author: 'Frank Herbert' }, 'audiobook', onResults)

    // 3 providers succeed (Audnexus fails → empty callback), 4 calls total
    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(4))

    const allResults = onResults.mock.calls.flatMap(call => call[0] as MetadataSearchResult[])
    expect(allResults.some(r => r.provider === 'itunes')).toBe(true)
    expect(allResults.some(r => r.provider === 'google-books')).toBe(true)
  })

  it('does not throw when all providers reject', async () => {
    mockSearchAudnexus.mockRejectedValue(new Error('error'))
    mockSearchITunes.mockRejectedValue(new Error('error'))
    mockSearchGoogleBooks.mockRejectedValue(new Error('error'))
    mockFetchOpenLibraryMetadata.mockRejectedValue(new Error('error'))

    const onResults = vi.fn()

    // Should not throw
    expect(() =>
      searchCovers({ title: 'Dune', author: 'Frank Herbert' }, 'audiobook', onResults)
    ).not.toThrow()

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(4))

    // All four calls should have delivered empty arrays
    for (const call of onResults.mock.calls) {
      expect(call[0]).toEqual([])
    }
  })

  // ── All providers empty ───────────────────────────────────────────────────

  it('calls onResults 4 times with empty arrays when all providers return nothing', async () => {
    mockSearchAudnexus.mockResolvedValue([])
    mockSearchITunes.mockResolvedValue([])
    mockSearchGoogleBooks.mockResolvedValue([])
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers({ title: 'Unknown Book', author: 'Unknown Author' }, 'audiobook', onResults)

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(4))

    for (const call of onResults.mock.calls) {
      expect(call[0]).toEqual([])
    }
  })

  // ── Open Library adapter ──────────────────────────────────────────────────

  it('Open Library adapter: maps coverUrl and subjects to MetadataSearchResult correctly', async () => {
    mockSearchAudnexus.mockResolvedValue([])
    mockSearchITunes.mockResolvedValue([])
    mockSearchGoogleBooks.mockResolvedValue([])
    mockFetchOpenLibraryMetadata.mockResolvedValue({
      coverUrl: 'https://covers.openlibrary.org/b/id/99999-L.jpg',
      description: 'A classic novel.',
      subjects: ['Classic fiction', 'Victorian era'],
    })

    const onResults = vi.fn()
    searchCovers(
      { title: 'Great Expectations', author: 'Charles Dickens', isbn: '9780141439563' },
      'audiobook',
      onResults
    )

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(4))

    // Find the Open Library call
    const olCall = onResults.mock.calls.find(
      call => (call[0] as MetadataSearchResult[])[0]?.provider === 'open-library'
    )
    expect(olCall).toBeDefined()

    const [result] = olCall![0] as MetadataSearchResult[]
    expect(result.provider).toBe('open-library')
    expect(result.coverUrl).toBe('https://covers.openlibrary.org/b/id/99999-L.jpg')
    expect(result.thumbnailUrl).toBe('https://covers.openlibrary.org/b/id/99999-L.jpg')
    expect(result.metadata.description).toBe('A classic novel.')
    expect(result.metadata.genres).toEqual(['Classic fiction', 'Victorian era'])
    expect(result.metadata.isbn).toBe('9780141439563')
  })

  it('Open Library adapter: returns empty array for skippedOffline sentinel', async () => {
    mockSearchGoogleBooks.mockResolvedValue([])
    mockFetchOpenLibraryMetadata.mockResolvedValue({ skippedOffline: true })

    const onResults = vi.fn()
    searchCovers({ title: 'Any Book', author: 'Any Author' }, 'epub', onResults)

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(2))

    // Open Library call should deliver empty array
    const olCall = onResults.mock.calls.find(call => {
      const results = call[0] as MetadataSearchResult[]
      return results.length === 0
    })
    expect(olCall).toBeDefined()
    expect(olCall![0]).toEqual([])
  })

  it('Open Library adapter: returns empty array when result has no content', async () => {
    mockSearchGoogleBooks.mockResolvedValue([])
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers({ title: 'Empty Book', author: 'Nobody' }, 'epub', onResults)

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(2))

    // Both calls should deliver empty arrays
    for (const call of onResults.mock.calls) {
      expect(call[0]).toEqual([])
    }
  })

  // ── Deduplication (within-provider) ──────────────────────────────────────

  it('deduplicates results with identical ISBN within the same provider batch', async () => {
    const duplicateIsbn = '9780441013593'
    const resultA: MetadataSearchResult = {
      provider: 'google-books',
      coverUrl: 'https://books.google.com/coverA.jpg',
      thumbnailUrl: 'https://books.google.com/coverA.jpg',
      metadata: { title: 'Dune', author: 'Frank Herbert', isbn: duplicateIsbn },
    }
    const resultB: MetadataSearchResult = {
      provider: 'google-books',
      coverUrl: 'https://books.google.com/coverB.jpg',
      thumbnailUrl: 'https://books.google.com/coverB.jpg',
      metadata: { title: 'Dune (Special Edition)', author: 'Frank Herbert', isbn: duplicateIsbn },
    }

    mockSearchGoogleBooks.mockResolvedValue([resultA, resultB])
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers({ title: 'Dune', author: 'Frank Herbert' }, 'epub', onResults)

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(2))

    const googleCall = onResults.mock.calls.find(call =>
      (call[0] as MetadataSearchResult[]).some(r => r.provider === 'google-books')
    )
    expect(googleCall).toBeDefined()
    // Only the first occurrence of the duplicate ISBN should survive
    expect(googleCall![0]).toHaveLength(1)
    expect((googleCall![0] as MetadataSearchResult[])[0].metadata.title).toBe('Dune')
  })

  it('deduplicates results with identical ASIN within the same provider batch', async () => {
    const duplicateAsin = 'B002V1O7K6'
    const resultA: MetadataSearchResult = {
      provider: 'audnexus',
      coverUrl: 'https://audnexus.example.com/coverA.jpg',
      thumbnailUrl: 'https://audnexus.example.com/coverA.jpg',
      metadata: { title: 'Dune', asin: duplicateAsin },
    }
    const resultB: MetadataSearchResult = {
      provider: 'audnexus',
      coverUrl: 'https://audnexus.example.com/coverB.jpg',
      thumbnailUrl: 'https://audnexus.example.com/coverB.jpg',
      metadata: { title: 'Dune Unabridged', asin: duplicateAsin },
    }

    mockSearchAudnexus.mockResolvedValue([resultA, resultB])
    mockSearchITunes.mockResolvedValue([])
    mockSearchGoogleBooks.mockResolvedValue([])
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers({ title: 'Dune', author: 'Frank Herbert' }, 'audiobook', onResults)

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(4))

    const audnexusCall = onResults.mock.calls.find(call =>
      (call[0] as MetadataSearchResult[]).some(r => r.provider === 'audnexus')
    )
    expect(audnexusCall).toBeDefined()
    expect(audnexusCall![0]).toHaveLength(1)
  })

  it('caps results at 5 per provider even when more are returned', async () => {
    const manyResults: MetadataSearchResult[] = Array.from({ length: 8 }, (_, i) => ({
      provider: 'google-books' as const,
      coverUrl: `https://books.google.com/cover${i}.jpg`,
      thumbnailUrl: `https://books.google.com/cover${i}.jpg`,
      metadata: { title: `Book ${i}`, isbn: `978000000000${i}` },
    }))

    mockSearchGoogleBooks.mockResolvedValue(manyResults)
    mockFetchOpenLibraryMetadata.mockResolvedValue({})

    const onResults = vi.fn()
    searchCovers({ title: 'Anything', author: 'Anyone' }, 'epub', onResults)

    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(2))

    const googleCall = onResults.mock.calls.find(call =>
      (call[0] as MetadataSearchResult[]).some(r => r.provider === 'google-books')
    )
    expect(googleCall).toBeDefined()
    expect(googleCall![0]).toHaveLength(5)
  })
})
