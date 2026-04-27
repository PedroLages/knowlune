import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  testConnection,
  fetchLibraries,
  fetchLibraryItems,
  fetchItem,
  fetchChapters,
  getStreamUrl,
  createPlaybackSession,
  getStreamUrlFromSession,
  closePlaybackSession,
  getCoverUrl,
  searchLibrary,
  fetchProgress,
  fetchAllProgress,
  updateProgress,
  fetchCollections,
  fetchSeriesForLibrary,
  connectSocket,
  onProgressUpdate,
  pushProgressViaSocket,
  isInsecureUrl,
  isMixedContentBlocked,
  type AbsSocketConnection,
} from '@/services/AudiobookshelfService'

// ── Constants ──────────────────────────────────────────────────────

const TEST_URL = 'https://abs.example.com:13378'
const TEST_API_KEY = 'test-api-key-123'

// ── Helpers ────────────────────────────────────────────────────────

function mockFetchJson(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

function mockFetchStatus(status: number) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

// ── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ── testConnection ─────────────────────────────────────────────────

describe('AudiobookshelfService.testConnection', () => {
  it('returns serverVersion on successful authorize', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({ user: { id: 'u1' }, serverSettings: { version: '2.27.0' } })
    )

    const result = await testConnection(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.serverVersion).toBe('2.27.0')
    }
  })

  it('calls ABS directly with Bearer auth header', async () => {
    const fetchMock = mockFetchJson({ user: { id: 'u1' }, serverSettings: { version: '2.27.0' } })
    vi.stubGlobal('fetch', fetchMock)

    await testConnection(TEST_URL, TEST_API_KEY)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${TEST_URL}/api/authorize`)
    expect(options.headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`)
    expect(options.headers['X-ABS-URL']).toBeUndefined()
    expect(options.headers['X-ABS-Token']).toBeUndefined()
  })

  it('strips trailing slash from base URL', async () => {
    const fetchMock = mockFetchJson({ user: { id: 'u1' }, serverSettings: { version: '2.27.0' } })
    vi.stubGlobal('fetch', fetchMock)

    await testConnection(`${TEST_URL}/`, TEST_API_KEY)

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe(`${TEST_URL}/api/authorize`)
  })

  it('returns auth error for 401 response', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(401))

    const result = await testConnection(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Authentication failed. Check your API key.')
    }
  })

  it('returns CORS guidance for TypeError from fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await testConnection(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Allowed Origins')
    }
  })

  it('returns timeout error when request exceeds 10 seconds', async () => {
    // Simulate a fetch that never resolves, so the AbortController fires via setTimeout
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        })
      })
    )

    const resultPromise = testConnection(TEST_URL, TEST_API_KEY)
    // Advance fake timers past the 10-second timeout so setTimeout fires controller.abort()
    await vi.advanceTimersByTimeAsync(10_001)
    const result = await resultPromise

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Connection timed out. Check the URL and try again.')
    }
  })

  it('returns server error for 500 response', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(500))

    const result = await testConnection(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Server error (500). Try again later.')
    }
  })

  it('returns access denied for 403 response', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(403))

    const result = await testConnection(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Access denied. Your API key may lack permissions.')
    }
  })

  it('returns invalid response error for malformed JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not valid json {{{', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )

    const result = await testConnection(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Server returned an invalid response. Check the URL.')
    }
  })
})

// ── fetchLibraries ─────────────────────────────────────────────────

describe('AudiobookshelfService.fetchLibraries', () => {
  it('returns array of libraries on success', async () => {
    const mockLibraries = {
      libraries: [
        { id: 'lib-1', name: 'Audiobooks', mediaType: 'book' },
        { id: 'lib-2', name: 'Podcasts', mediaType: 'podcast' },
      ],
    }
    vi.stubGlobal('fetch', mockFetchJson(mockLibraries))

    const result = await fetchLibraries(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].name).toBe('Audiobooks')
      expect(result.data[1].mediaType).toBe('podcast')
    }
  })

  it('returns auth error for 401 response', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(401))

    const result = await fetchLibraries(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Authentication failed. Check your API key.')
    }
  })
})

// ── fetchLibraryItems ──────────────────────────────────────────────

describe('AudiobookshelfService.fetchLibraryItems', () => {
  const mockItemsResponse = {
    results: [
      {
        id: 'item-1',
        ino: 'ino-1',
        media: {
          metadata: {
            title: 'The Hobbit',
            authors: [{ id: 'auth-1', name: 'J.R.R. Tolkien' }],
            narrators: ['Andy Serkis'],
            duration: 39600,
            numChapters: 19,
            description: 'A fantasy classic',
          },
          coverPath: '/covers/item-1.jpg',
          chapters: [{ id: 'ch-1', title: 'An Unexpected Party', start: 0, end: 2100 }],
        },
      },
    ],
    total: 42,
  }

  it('returns paginated results on success', async () => {
    vi.stubGlobal('fetch', mockFetchJson(mockItemsResponse))

    const result = await fetchLibraryItems(TEST_URL, TEST_API_KEY, 'lib-1', {
      page: 0,
      limit: 50,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.results).toHaveLength(1)
      expect(result.data.total).toBe(42)
      expect(result.data.results[0].media.metadata.title).toBe('The Hobbit')
    }
  })

  it('uses default page and limit when options omitted', async () => {
    const fetchMock = mockFetchJson(mockItemsResponse)
    vi.stubGlobal('fetch', fetchMock)

    await fetchLibraryItems(TEST_URL, TEST_API_KEY, 'lib-1')

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('page=0')
    expect(url).toContain('limit=50')
  })

  it('returns CORS error for network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await fetchLibraryItems(TEST_URL, TEST_API_KEY, 'lib-1')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Allowed Origins')
    }
  })
})

// ── fetchItem ──────────────────────────────────────────────────────

describe('AudiobookshelfService.fetchItem', () => {
  it('returns a single item on success', async () => {
    const mockItem = {
      id: 'item-1',
      ino: 'ino-1',
      media: {
        metadata: {
          title: 'Dune',
          authors: [{ id: 'auth-2', name: 'Frank Herbert' }],
          narrators: ['Scott Brick'],
          duration: 79200,
          numChapters: 34,
        },
        chapters: [],
      },
    }
    vi.stubGlobal('fetch', mockFetchJson(mockItem))

    const result = await fetchItem(TEST_URL, TEST_API_KEY, 'item-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.media.metadata.title).toBe('Dune')
    }
  })
})

// ── getStreamUrl ───────────────────────────────────────────────────

describe('AudiobookshelfService.getStreamUrl', () => {
  it('returns direct stream URL with token query param', () => {
    const url = getStreamUrl(TEST_URL, 'item-1', TEST_API_KEY)

    expect(url).toBe(
      `${TEST_URL}/api/items/item-1/play?token=${encodeURIComponent(TEST_API_KEY)}`
    )
    expect(url).not.toContain('/api/abs/proxy')
  })

  it('encodes special characters in API key', () => {
    const specialKey = 'key with spaces & symbols='
    const url = getStreamUrl(TEST_URL, 'item-1', specialKey)

    expect(url).toContain(`token=${encodeURIComponent(specialKey)}`)
    expect(url).not.toContain(' ')
  })
})

// ── createPlaybackSession ─────────────────────────────────────────

describe('AudiobookshelfService.createPlaybackSession', () => {
  it('sends POST to /api/items/{id}/play with correct body', async () => {
    const mockSession = {
      id: 'session-1',
      audioTracks: [
        { contentUrl: '/s/item/item-1/book.m4b', duration: 1800, mimeType: 'audio/mp4' },
      ],
    }
    globalThis.fetch = mockFetchJson(mockSession)

    const result = await createPlaybackSession(TEST_URL, TEST_API_KEY, 'item-1')

    expect(globalThis.fetch).toHaveBeenCalledOnce()
    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(`${TEST_URL}/api/items/item-1/play`)
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`)
    const body = JSON.parse(options.body)
    expect(body.forceDirectPlay).toBe(true)
    expect(body.deviceInfo.clientName).toBe('Knowlune')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.audioTracks[0].contentUrl).toBe('/s/item/item-1/book.m4b')
    }
  })
})

// ── getStreamUrlFromSession ───────────────────────────────────────

describe('AudiobookshelfService.getStreamUrlFromSession', () => {
  it('constructs direct URL from relative contentUrl with token query param', () => {
    const url = getStreamUrlFromSession(TEST_URL, TEST_API_KEY, '/s/item/item-1/book.m4b')

    expect(url).toBe(
      `${TEST_URL}/s/item/item-1/book.m4b?token=${encodeURIComponent(TEST_API_KEY)}`
    )
    expect(url).not.toContain('/api/abs/proxy')
  })

  it('extracts pathname from absolute contentUrl', () => {
    const url = getStreamUrlFromSession(
      TEST_URL,
      TEST_API_KEY,
      'https://abs.example.com:13378/s/item/item-1/book.m4b'
    )

    expect(url).toBe(
      `${TEST_URL}/s/item/item-1/book.m4b?token=${encodeURIComponent(TEST_API_KEY)}`
    )
    expect(url).not.toContain('/api/abs/proxy')
  })

  it('strips trailing slash from base URL', () => {
    const url = getStreamUrlFromSession(`${TEST_URL}/`, TEST_API_KEY, '/s/item/x/book.m4b')
    expect(url).toBe(`${TEST_URL}/s/item/x/book.m4b?token=${encodeURIComponent(TEST_API_KEY)}`)
  })
})

// ── closePlaybackSession ──────────────────────────────────────────

describe('AudiobookshelfService.closePlaybackSession', () => {
  it('sends POST to /api/session/{id}/close', async () => {
    globalThis.fetch = mockFetchJson(undefined)

    await closePlaybackSession(TEST_URL, TEST_API_KEY, 'session-1')

    expect(globalThis.fetch).toHaveBeenCalledOnce()
    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(`${TEST_URL}/api/session/session-1/close`)
    expect(options.method).toBe('POST')
  })
})

// ── getCoverUrl ────────────────────────────────────────────────────

describe('AudiobookshelfService.getCoverUrl', () => {
  it('returns direct cover URL with token query param', () => {
    const url = getCoverUrl(TEST_URL, 'item-1', TEST_API_KEY)

    expect(url).toBe(
      `${TEST_URL}/api/items/item-1/cover?token=${encodeURIComponent(TEST_API_KEY)}`
    )
    expect(url).not.toContain('/api/abs/proxy')
  })

  it('strips trailing slash from base URL', () => {
    const url = getCoverUrl(`${TEST_URL}/`, 'item-1', TEST_API_KEY)
    expect(url).toBe(
      `${TEST_URL}/api/items/item-1/cover?token=${encodeURIComponent(TEST_API_KEY)}`
    )
  })

  it('omits token query param when apiKey is undefined', () => {
    const url = getCoverUrl(TEST_URL, 'item-1')
    expect(url).toBe(`${TEST_URL}/api/items/item-1/cover`)
    expect(url).not.toContain('token=')
  })

  it('encodes special characters in apiKey', () => {
    const specialKey = 'key/with+special=chars'
    const url = getCoverUrl(TEST_URL, 'item-1', specialKey)
    expect(url).toContain(`token=${encodeURIComponent(specialKey)}`)
  })
})

// ── searchLibrary ──────────────────────────────────────────────────

describe('AudiobookshelfService.searchLibrary', () => {
  it('returns search results on success', async () => {
    const mockSearchResponse = {
      book: [
        {
          id: 'item-1',
          ino: 'ino-1',
          media: {
            metadata: {
              title: 'The Hobbit',
              authors: [{ id: 'auth-1', name: 'J.R.R. Tolkien' }],
              narrators: ['Andy Serkis'],
              duration: 39600,
              numChapters: 19,
            },
            chapters: [],
          },
        },
      ],
    }
    vi.stubGlobal('fetch', mockFetchJson(mockSearchResponse))

    const result = await searchLibrary(TEST_URL, TEST_API_KEY, 'lib-1', 'hobbit')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.book).toHaveLength(1)
      expect(result.data.book[0].media.metadata.title).toBe('The Hobbit')
    }
  })

  it('encodes search query in URL', async () => {
    const fetchMock = mockFetchJson({ book: [] })
    vi.stubGlobal('fetch', fetchMock)

    await searchLibrary(TEST_URL, TEST_API_KEY, 'lib-1', 'lord of the rings')

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('q=lord%20of%20the%20rings')
  })
})

// ── fetchProgress ──────────────────────────────────────────────────

describe('AudiobookshelfService.fetchProgress', () => {
  it('returns progress data on success', async () => {
    const mockProgress = {
      id: 'prog-1',
      currentTime: 3600,
      duration: 39600,
      progress: 0.091,
      isFinished: false,
      lastUpdate: 1712345678000,
    }
    vi.stubGlobal('fetch', mockFetchJson(mockProgress))

    const result = await fetchProgress(TEST_URL, TEST_API_KEY, 'item-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data!.currentTime).toBe(3600)
      expect(result.data!.progress).toBe(0.091)
    }
  })

  it('returns null data for 404 (no progress yet)', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(404))

    const result = await fetchProgress(TEST_URL, TEST_API_KEY, 'new-item')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toBeNull()
    }
  })

  it('returns auth error for 401 response', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(401))

    const result = await fetchProgress(TEST_URL, TEST_API_KEY, 'item-1')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Authentication failed. Check your API key.')
    }
  })

  it('returns CORS error for network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await fetchProgress(TEST_URL, TEST_API_KEY, 'item-1')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Allowed Origins')
    }
  })

  it('returns timeout error when request exceeds 10 seconds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        })
      })
    )

    const resultPromise = fetchProgress(TEST_URL, TEST_API_KEY, 'item-1')
    await vi.advanceTimersByTimeAsync(10_001)
    const result = await resultPromise

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Connection timed out. Check the URL and try again.')
    }
  })
})

// ── fetchAllProgress ───────────────────────────────────────────────

describe('AudiobookshelfService.fetchAllProgress', () => {
  it('parses mediaProgress entries from GET /api/me', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({
        id: 'user-1',
        mediaProgress: [
          {
            id: 'mp-1',
            libraryItemId: 'item-a',
            currentTime: 120,
            duration: 3600,
            progress: 0.033,
            isFinished: false,
            lastUpdate: 1712345678000,
          },
        ],
      })
    )

    const result = await fetchAllProgress(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].libraryItemId).toBe('item-a')
      expect(result.data[0].currentTime).toBe(120)
      expect(result.data[0].lastUpdate).toBe(1712345678000)
    }
  })

  it('returns empty array when mediaProgress is missing', async () => {
    vi.stubGlobal('fetch', mockFetchJson({ id: 'user-1', username: 'u' }))

    const result = await fetchAllProgress(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual([])
    }
  })

  it('skips podcast episode progress rows', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({
        mediaProgress: [
          {
            id: 'mp-pod',
            libraryItemId: 'pod-item',
            episodeId: 'ep-1',
            currentTime: 60,
            duration: 600,
            progress: 0.1,
            isFinished: false,
            lastUpdate: 1712345678000,
          },
          {
            id: 'mp-book',
            libraryItemId: 'book-item',
            currentTime: 30,
            duration: 3000,
            progress: 0.01,
            isFinished: false,
            lastUpdate: 1712345678001,
          },
        ],
      })
    )

    const result = await fetchAllProgress(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].libraryItemId).toBe('book-item')
    }
  })

  it('propagates 401 from absApiFetch', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(401))

    const result = await fetchAllProgress(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
    }
  })
})

// ── updateProgress ─────────────────────────────────────────────────

describe('AudiobookshelfService.updateProgress', () => {
  it('sends PATCH request with progress body', async () => {
    // PATCH returns 200 with empty body
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })))

    const progress = {
      currentTime: 7200,
      duration: 39600,
      progress: 0.182,
      isFinished: false,
    }
    const result = await updateProgress(TEST_URL, TEST_API_KEY, 'item-1', progress)

    expect(result.ok).toBe(true)

    const fetchMock = vi.mocked(globalThis.fetch)
    const [, options] = fetchMock.mock.calls[0]
    expect(options!.method).toBe('PATCH')
    expect(JSON.parse(options!.body as string)).toEqual(progress)
  })

  it('returns auth error for 401 response', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(401))

    const progress = { currentTime: 100, duration: 3600, progress: 0.028, isFinished: false }
    const result = await updateProgress(TEST_URL, TEST_API_KEY, 'item-1', progress)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Authentication failed. Check your API key.')
    }
  })

  it('returns CORS error for network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const progress = { currentTime: 100, duration: 3600, progress: 0.028, isFinished: false }
    const result = await updateProgress(TEST_URL, TEST_API_KEY, 'item-1', progress)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Allowed Origins')
    }
  })
})

// ── fetchCollections ───────────────────────────────────────────────

describe('AudiobookshelfService.fetchCollections', () => {
  it('returns array of collections on success', async () => {
    // ABS GET /api/libraries/{id}/collections returns { results: [...], total: N }
    const mockResponse = {
      results: [
        {
          id: 'c1',
          libraryId: 'lib-1',
          name: 'Philosophy',
          description: 'Philosophy books',
          books: [
            { id: 'b1', media: { metadata: { title: 'Meditations' } } },
            { id: 'b2', media: { metadata: { title: 'Republic' } } },
          ],
        },
        {
          id: 'c2',
          libraryId: 'lib-1',
          name: 'History',
          books: [{ id: 'b3', media: { metadata: { title: 'Sapiens' } } }],
        },
      ],
      total: 2,
    }
    vi.stubGlobal('fetch', mockFetchJson(mockResponse))

    const result = await fetchCollections(TEST_URL, TEST_API_KEY, 'lib-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.results).toHaveLength(2)
      expect(result.data.results[0].name).toBe('Philosophy')
      expect(result.data.results[0].books).toHaveLength(2)
      expect(result.data.results[1].name).toBe('History')
    }
  })

  it('returns auth error for 401 response', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(401))

    const result = await fetchCollections(TEST_URL, TEST_API_KEY, 'lib-1')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Authentication failed. Check your API key.')
    }
  })

  it('returns CORS error for network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await fetchCollections(TEST_URL, TEST_API_KEY, 'lib-1')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Allowed Origins')
    }
  })
})

// ── isInsecureUrl ────────────────────────────────────────────────────

describe('AudiobookshelfService.isInsecureUrl', () => {
  it('returns true for HTTP URLs', () => {
    expect(isInsecureUrl('http://192.168.1.50:13378')).toBe(true)
  })

  it('returns false for HTTPS URLs', () => {
    expect(isInsecureUrl('https://abs.example.com')).toBe(false)
  })

  it('returns false for invalid URLs', () => {
    expect(isInsecureUrl('not-a-url')).toBe(false)
  })
})

// ── isMixedContentBlocked ─────────────────────────────────────────────

describe('AudiobookshelfService.isMixedContentBlocked', () => {
  it('blocks http ABS URL when app is served over https', () => {
    expect(isMixedContentBlocked('http://192.168.1.50:13378', 'https:')).toBe(true)
  })

  it('allows https ABS URL when app is served over https', () => {
    expect(isMixedContentBlocked('https://abs.example.com', 'https:')).toBe(false)
  })

  it('allows http ABS URL in dev (app served over http)', () => {
    expect(isMixedContentBlocked('http://192.168.1.50:13378', 'http:')).toBe(false)
  })

  it('returns false for invalid URLs (falls through to other validation)', () => {
    expect(isMixedContentBlocked('not a url', 'https:')).toBe(false)
  })
})

// ── fetchChapters ─────────────────────────────────────────────────

describe('AudiobookshelfService.fetchChapters', () => {
  it('extracts chapters from item response', async () => {
    const mockItem = {
      id: 'item-1',
      ino: 'ino-1',
      media: {
        metadata: { title: 'Test', authors: [], narrators: [], duration: 100, numChapters: 2 },
        chapters: [
          { id: 'ch1', title: 'Chapter 1', start: 0, end: 50 },
          { id: 'ch2', title: 'Chapter 2', start: 50, end: 100 },
        ],
      },
    }
    vi.stubGlobal('fetch', mockFetchJson(mockItem))

    const result = await fetchChapters(TEST_URL, TEST_API_KEY, 'item-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(2)
      expect(result.data.chapters[0].title).toBe('Chapter 1')
    }
  })

  it('returns empty chapters array when item has no chapters', async () => {
    const mockItem = {
      id: 'item-1',
      ino: 'ino-1',
      media: {
        metadata: { title: 'Test', authors: [], narrators: [], duration: 100, numChapters: 0 },
      },
    }
    vi.stubGlobal('fetch', mockFetchJson(mockItem))

    const result = await fetchChapters(TEST_URL, TEST_API_KEY, 'item-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.chapters).toEqual([])
    }
  })

  it('propagates errors from fetchItem', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(401))

    const result = await fetchChapters(TEST_URL, TEST_API_KEY, 'item-1')
    expect(result.ok).toBe(false)
  })
})

// ── fetchSeriesForLibrary ─────────────────────────────────────────

describe('AudiobookshelfService.fetchSeriesForLibrary', () => {
  it('returns series results on success', async () => {
    const mockResponse = {
      results: [{ id: 's1', name: 'Lord of the Rings', books: [] }],
      total: 1,
    }
    vi.stubGlobal('fetch', mockFetchJson(mockResponse))

    const result = await fetchSeriesForLibrary(TEST_URL, TEST_API_KEY, 'lib-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.results).toHaveLength(1)
      expect(result.data.results[0].name).toBe('Lord of the Rings')
    }
  })

  it('includes sort=name in request URL', async () => {
    const fetchMock = mockFetchJson({ results: [], total: 0 })
    vi.stubGlobal('fetch', fetchMock)

    await fetchSeriesForLibrary(TEST_URL, TEST_API_KEY, 'lib-1')

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('sort=name')
  })
})

// ── testConnection version warning ────────────────────────────────

describe('AudiobookshelfService.testConnection version warning', () => {
  it('includes warning for server version below 2.26.0', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({ user: { id: 'u1' }, serverSettings: { version: '2.25.0' } })
    )

    const result = await testConnection(TEST_URL, TEST_API_KEY)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.warning).toContain('below v2.26.0')
    }
  })

  it('no warning for server version >= 2.26.0', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({ user: { id: 'u1' }, serverSettings: { version: '2.26.0' } })
    )

    const result = await testConnection(TEST_URL, TEST_API_KEY)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.warning).toBeUndefined()
    }
  })
})

// ── connectSocket ─────────────────────────────────────────────────

describe('AudiobookshelfService.connectSocket', () => {
  // We capture the created ws instance by intercepting the constructor
  let createdWs: Record<string, unknown>

  beforeEach(() => {
    const mockSend = vi.fn()
    const mockClose = vi.fn()

    vi.stubGlobal(
      'WebSocket',
      vi.fn(function (this: Record<string, unknown>) {
        this.send = mockSend
        this.close = mockClose
        this.readyState = 1
        this.addEventListener = vi.fn()
        this.removeEventListener = vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        createdWs = this
      })
    )
    ;(WebSocket as unknown as { OPEN: number }).OPEN = 1
  })

  it('creates WebSocket with correct URL format', () => {
    connectSocket(TEST_URL, TEST_API_KEY)
    expect(WebSocket).toHaveBeenCalledWith(
      expect.stringContaining('wss://abs.example.com:13378/socket.io/')
    )
  })

  it('includes token in WebSocket URL', () => {
    connectSocket(TEST_URL, TEST_API_KEY)
    expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining(`token=${TEST_API_KEY}`))
  })

  it('returns connection handle with disconnect method', () => {
    const conn = connectSocket(TEST_URL, TEST_API_KEY)
    expect(conn.disconnect).toBeInstanceOf(Function)
    expect(conn.isConnected).toBe(false)
  })

  it('sends Socket.IO connect packet on Engine.IO open', () => {
    connectSocket(TEST_URL, TEST_API_KEY)
    const handler = createdWs.onmessage as (e: { data: string }) => void
    handler({ data: '0{"pingInterval":25000,"pingTimeout":20000}' })
    expect(createdWs.send).toHaveBeenCalledWith(expect.stringContaining('40'))
  })

  it('marks connected on Socket.IO ack', () => {
    const onReady = vi.fn()
    const conn = connectSocket(TEST_URL, TEST_API_KEY, { onReady })

    const handler = createdWs.onmessage as (e: { data: string }) => void
    handler({ data: '0{"pingInterval":25000}' })
    handler({ data: '40' })

    expect(conn.isConnected).toBe(true)
    expect(onReady).toHaveBeenCalled()
  })

  it('responds to server ping with pong', () => {
    connectSocket(TEST_URL, TEST_API_KEY)
    const handler = createdWs.onmessage as (e: { data: string }) => void
    handler({ data: '2' })
    expect(createdWs.send).toHaveBeenCalledWith('3')
  })

  it('disconnect closes WebSocket', () => {
    const conn = connectSocket(TEST_URL, TEST_API_KEY)
    conn.disconnect()
    expect(createdWs.close).toHaveBeenCalled()
  })

  it('calls onDisconnect when connected socket closes', () => {
    const onDisconnect = vi.fn()
    const conn = connectSocket(TEST_URL, TEST_API_KEY, { onDisconnect })

    const handler = createdWs.onmessage as (e: { data: string }) => void
    handler({ data: '0{"pingInterval":25000}' })
    handler({ data: '40' })
    expect(conn.isConnected).toBe(true)

    // Simulate close
    ;(createdWs.onclose as () => void)()
    expect(onDisconnect).toHaveBeenCalled()
    expect(conn.isConnected).toBe(false)
  })

  it('handles WebSocket constructor failure gracefully', () => {
    vi.stubGlobal(
      'WebSocket',
      vi.fn(() => {
        throw new Error('Invalid URL')
      })
    )
    const conn = connectSocket('invalid://url', TEST_API_KEY)
    expect(conn.isConnected).toBe(false)
  })
})

// ── pushProgressViaSocket ─────────────────────────────────────────

describe('AudiobookshelfService.pushProgressViaSocket', () => {
  it('sends Socket.IO event packet when connected', () => {
    const mockWs = { send: vi.fn(), readyState: 1 }
    const conn: AbsSocketConnection = {
      ws: mockWs as unknown as WebSocket,
      isConnected: true,
      disconnect: vi.fn(),
    }
    ;(WebSocket as unknown as { OPEN: number }).OPEN = 1

    pushProgressViaSocket(conn, 'item-1', {
      currentTime: 100,
      duration: 3600,
      progress: 0.028,
      isFinished: false,
    })

    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('42'))
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('update_media_progress'))
  })

  it('does nothing when not connected', () => {
    const mockWs = { send: vi.fn(), readyState: 1 }
    const conn: AbsSocketConnection = {
      ws: mockWs as unknown as WebSocket,
      isConnected: false,
      disconnect: vi.fn(),
    }

    pushProgressViaSocket(conn, 'item-1', {
      currentTime: 100,
      duration: 3600,
      progress: 0.028,
      isFinished: false,
    })

    expect(mockWs.send).not.toHaveBeenCalled()
  })
})

// ── onProgressUpdate ──────────────────────────────────────────────

describe('AudiobookshelfService.onProgressUpdate', () => {
  it('registers and invokes handler for progress events', () => {
    const addEventListener = vi.fn()
    const conn: AbsSocketConnection = {
      ws: { addEventListener, removeEventListener: vi.fn() } as unknown as WebSocket,
      isConnected: true,
      disconnect: vi.fn(),
    }

    const handler = vi.fn()
    onProgressUpdate(conn, handler)

    expect(addEventListener).toHaveBeenCalledWith('message', expect.any(Function))

    // Simulate a progress event
    const listener = addEventListener.mock.calls[0][1]
    listener({
      data: '42["user_media_progress_updated",{"data":{"libraryItemId":"item-1","currentTime":100,"duration":3600,"progress":0.028,"isFinished":false}}]',
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        libraryItemId: 'item-1',
        currentTime: 100,
      })
    )
  })

  it('returns unsubscribe function', () => {
    const removeEventListener = vi.fn()
    const conn: AbsSocketConnection = {
      ws: { addEventListener: vi.fn(), removeEventListener } as unknown as WebSocket,
      isConnected: true,
      disconnect: vi.fn(),
    }

    const unsub = onProgressUpdate(conn, vi.fn())
    unsub()

    expect(removeEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('ignores non-progress events', () => {
    const addEventListener = vi.fn()
    const conn: AbsSocketConnection = {
      ws: { addEventListener, removeEventListener: vi.fn() } as unknown as WebSocket,
      isConnected: true,
      disconnect: vi.fn(),
    }

    const handler = vi.fn()
    onProgressUpdate(conn, handler)

    const listener = addEventListener.mock.calls[0][1]
    listener({ data: '42["some_other_event",{}]' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores non-Socket.IO messages', () => {
    const addEventListener = vi.fn()
    const conn: AbsSocketConnection = {
      ws: { addEventListener, removeEventListener: vi.fn() } as unknown as WebSocket,
      isConnected: true,
      disconnect: vi.fn(),
    }

    const handler = vi.fn()
    onProgressUpdate(conn, handler)

    const listener = addEventListener.mock.calls[0][1]
    listener({ data: '3' }) // pong
    listener({ data: '0{"pingInterval":25000}' }) // open

    expect(handler).not.toHaveBeenCalled()
  })
})
