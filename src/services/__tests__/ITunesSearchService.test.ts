import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchITunes } from '@/services/ITunesSearchService'

// ── Helpers ───────────────────────────────────────────────────────

function makeAudiobookItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    wrapperType: 'audiobook',
    collectionName: 'Project Hail Mary',
    artistName: 'Andy Weir',
    artworkUrl100: 'https://is1.mzstatic.com/image/thumb/cover100x100bb.jpg',
    artworkUrl600: 'https://is1.mzstatic.com/image/thumb/cover600x600bb.jpg',
    primaryGenreName: 'Sci-Fi & Fantasy',
    description: 'A lone astronaut must save the earth.',
    ...overrides,
  }
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

// ── Suite ─────────────────────────────────────────────────────────

describe('ITunesSearchService.searchITunes', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Happy path ─────────────────────────────────────────────────────

  it('returns mapped audiobook results with high-res cover URL and genre', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        resultCount: 1,
        results: [makeAudiobookItem()],
      })
    )

    const results = await searchITunes({ title: 'Project Hail Mary', author: 'Andy Weir' })

    expect(Array.isArray(results)).toBe(true)
    const items = results as Awaited<ReturnType<typeof searchITunes>> & unknown[]
    expect(items).toHaveLength(1)

    const [result] = items as Array<{
      provider: string
      coverUrl?: string
      thumbnailUrl?: string
      metadata: Record<string, unknown>
    }>

    expect(result.provider).toBe('itunes')
    expect(result.coverUrl).toBe('https://is1.mzstatic.com/image/thumb/cover1200x1200bb.jpg')
    expect(result.thumbnailUrl).toBe('https://is1.mzstatic.com/image/thumb/cover100x100bb.jpg')
    expect(result.metadata.title).toBe('Project Hail Mary')
    expect(result.metadata.author).toBe('Andy Weir')
    expect(result.metadata.genres).toEqual(['Sci-Fi & Fantasy'])
    expect(result.metadata.description).toBe('A lone astronaut must save the earth.')
    // iTunes provides no narrator/series/ISBN/ASIN
    expect(result.metadata.narrator).toBeUndefined()
    expect(result.metadata.series).toBeUndefined()
    expect(result.metadata.isbn).toBeUndefined()
    expect(result.metadata.asin).toBeUndefined()
  })

  // Edge cases ─────────────────────────────────────────────────────

  it('filters out non-audiobook entries (wrapperType !== "audiobook")', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        resultCount: 3,
        results: [
          makeAudiobookItem({ collectionName: 'Good Book' }),
          { wrapperType: 'track', collectionName: 'Song', artistName: 'Artist' },
          { wrapperType: 'podcast', collectionName: 'A Podcast', artistName: 'Host' },
        ],
      })
    )

    const results = await searchITunes({ title: 'Good Book', author: 'Someone' })

    expect(Array.isArray(results)).toBe(true)
    const items = results as Array<{ metadata: { title?: string } }>
    expect(items).toHaveLength(1)
    expect(items[0].metadata.title).toBe('Good Book')
  })

  it('falls back to artworkUrl100 for coverUrl when artworkUrl600 is absent', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        resultCount: 1,
        results: [makeAudiobookItem({ artworkUrl600: undefined })],
      })
    )

    const results = await searchITunes({ title: 'Some Book', author: 'Someone' })

    const items = results as Array<{ coverUrl?: string; thumbnailUrl?: string }>
    expect(items[0].coverUrl).toBe('https://is1.mzstatic.com/image/thumb/cover100x100bb.jpg')
    expect(items[0].thumbnailUrl).toBe('https://is1.mzstatic.com/image/thumb/cover100x100bb.jpg')
  })

  it('returns empty array when resultCount is 0', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        resultCount: 0,
        results: [],
      })
    )

    const results = await searchITunes({ title: 'Unknown', author: 'Nobody' })

    expect(results).toEqual([])
  })

  // Error paths ─────────────────────────────────────────────────────

  it('returns empty array when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const results = await searchITunes({ title: 'Some Book', author: 'Someone' })

    expect(results).toEqual([])
  })

  it('returns { skippedOffline: true } when navigator.onLine is false', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await searchITunes({ title: 'Any Book', author: 'Any Author' })

    expect(result).toEqual({ skippedOffline: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
