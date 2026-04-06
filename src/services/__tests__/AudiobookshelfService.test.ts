import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  testConnection,
  fetchLibraries,
  fetchLibraryItems,
  fetchItem,
  getStreamUrl,
  getCoverUrl,
  searchLibrary,
  fetchProgress,
  updateProgress,
  isInsecureUrl,
} from '@/services/AudiobookshelfService'

// ── Constants ──────────────────────────────────────────────────────

const TEST_URL = 'http://abs.local:13378'
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
  it('returns serverVersion on successful ping', async () => {
    vi.stubGlobal('fetch', mockFetchJson({ success: true, version: '2.27.0' }))

    const result = await testConnection(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.serverVersion).toBe('2.27.0')
    }
  })

  it('sends Bearer authorization header', async () => {
    const fetchMock = mockFetchJson({ success: true, version: '2.27.0' })
    vi.stubGlobal('fetch', fetchMock)

    await testConnection(TEST_URL, TEST_API_KEY)

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`)
  })

  it('returns auth error for 401 response', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(401))

    const result = await testConnection(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Authentication failed. Check your API key.')
    }
  })

  it('returns CORS error for TypeError from fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await testConnection(TEST_URL, TEST_API_KEY)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Could not connect to server. Check the URL and CORS settings.')
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
      expect(result.error).toBe('Could not connect to server. Check the URL and CORS settings.')
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
  it('returns correctly formatted stream URL with token parameter', () => {
    const url = getStreamUrl(TEST_URL, 'item-1', TEST_API_KEY)

    expect(url).toBe(`${TEST_URL}/api/items/item-1/play?token=${encodeURIComponent(TEST_API_KEY)}`)
  })

  it('encodes special characters in API key', () => {
    const specialKey = 'key with spaces & symbols='
    const url = getStreamUrl(TEST_URL, 'item-1', specialKey)

    expect(url).toContain(`token=${encodeURIComponent(specialKey)}`)
    expect(url).not.toContain(' ')
  })
})

// ── getCoverUrl ────────────────────────────────────────────────────

describe('AudiobookshelfService.getCoverUrl', () => {
  it('returns correctly formatted cover URL', () => {
    const url = getCoverUrl(TEST_URL, 'item-1')

    expect(url).toBe(`${TEST_URL}/api/items/item-1/cover`)
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
      updatedAt: 1712345678000,
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
      expect(result.error).toContain('Could not connect')
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
      expect(result.error).toContain('Could not connect')
    }
  })
})

// ── isInsecureUrl ──────────────────────────────────────────────────

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
