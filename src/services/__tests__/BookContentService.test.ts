import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { bookContentService, RemoteEpubError } from '@/services/BookContentService'
import type { Book, ContentSource } from '@/data/types'

// ── Helpers ──────────────────────────────────────────────────────

function makeBook(sourceOverride: ContentSource, id = 'book-1'): Book {
  return {
    id,
    title: 'Test Book',
    author: 'Test Author',
    format: 'epub',
    status: 'reading',
    tags: [],
    chapters: [],
    source: sourceOverride,
    progress: 0,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

function makeRemoteBook(
  url = 'https://calibre.local/opds/download/1/epub',
  auth?: { username: string; password: string },
  id = 'book-remote-1'
): Book {
  return makeBook({ type: 'remote', url, auth }, id)
}

const MOCK_EPUB_BUFFER = new ArrayBuffer(100)

/** Stub fetch to return a Response with the given options. */
function stubFetch(body: BodyInit | null, status = 200, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue(new Response(body, { status, headers }))
}

// Stub Cache API (not available in jsdom/node)
class MockCache {
  private store = new Map<string, Response>()

  /** Normalize keys: strip the fake base URL prefix added by keys(). */
  private normalizeKey(key: string | Request): string {
    const raw = typeof key === 'string' ? key : key.url
    // Strip the fake origin we add in keys() so lookups match
    return raw.replace('https://cache.local', '')
  }

  async match(key: string | Request) {
    return this.store.get(this.normalizeKey(key)) ?? undefined
  }

  async put(key: string | Request, response: Response) {
    this.store.set(this.normalizeKey(key), response.clone())
  }

  async delete(key: string | Request) {
    return this.store.delete(this.normalizeKey(key))
  }

  async keys() {
    // Cache API returns Request objects — use a fake origin so Node's Request() accepts the URL
    return Array.from(this.store.keys()).map(k => new Request(`https://cache.local${k}`))
  }
}

const mockCacheStorage: Record<string, MockCache> = {}

function setupCacheApi() {
  vi.stubGlobal('caches', {
    open: vi.fn(async (name: string) => {
      if (!mockCacheStorage[name]) {
        mockCacheStorage[name] = new MockCache()
      }
      return mockCacheStorage[name]
    }),
  })
}

function clearCacheStorage() {
  for (const key of Object.keys(mockCacheStorage)) {
    delete mockCacheStorage[key]
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('BookContentService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setupCacheApi()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    clearCacheStorage()
  })

  describe('getEpubContent — routing by source type', () => {
    it('throws for non-EPUB format', async () => {
      const book = {
        ...makeBook({ type: 'local', opfsPath: '/books/test.epub' }),
        format: 'pdf' as const,
      }
      await expect(bookContentService.getEpubContent(book as Book)).rejects.toThrow('not an EPUB')
    })

    it('routes remote source to fetch', async () => {
      vi.stubGlobal('fetch', stubFetch(MOCK_EPUB_BUFFER))

      const book = makeRemoteBook()
      const result = await bookContentService.getEpubContent(book)

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(fetch).toHaveBeenCalledWith(
        'https://calibre.local/opds/download/1/epub',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })

  describe('remote fetch — auth headers', () => {
    it('includes Basic auth header when credentials exist', async () => {
      vi.stubGlobal('fetch', stubFetch(MOCK_EPUB_BUFFER))

      const book = makeRemoteBook('https://calibre.local/opds/download/1/epub', {
        username: 'admin',
        password: 'secret',
      })
      await bookContentService.getEpubContent(book)

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${btoa('admin:secret')}`,
          }),
        })
      )
    })

    it('omits auth header when no credentials', async () => {
      vi.stubGlobal('fetch', stubFetch(MOCK_EPUB_BUFFER))

      const book = makeRemoteBook()
      await bookContentService.getEpubContent(book)

      const callHeaders = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers
      expect(callHeaders).not.toHaveProperty('Authorization')
    })
  })

  describe('remote fetch — error handling', () => {
    it('throws RemoteEpubError with code "auth" for 401', async () => {
      vi.stubGlobal('fetch', stubFetch(null, 401))

      const book = makeRemoteBook()
      try {
        await bookContentService.getEpubContent(book)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RemoteEpubError)
        expect((err as RemoteEpubError).code).toBe('auth')
        expect((err as RemoteEpubError).message).toContain('Authentication failed')
      }
    })

    it('throws RemoteEpubError with code "auth" for 403', async () => {
      vi.stubGlobal('fetch', stubFetch(null, 403))

      const book = makeRemoteBook()
      try {
        await bookContentService.getEpubContent(book)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RemoteEpubError)
        expect((err as RemoteEpubError).code).toBe('auth')
      }
    })

    it('throws RemoteEpubError with code "not-found" for 404', async () => {
      vi.stubGlobal('fetch', stubFetch(null, 404))

      const book = makeRemoteBook()
      try {
        await bookContentService.getEpubContent(book)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RemoteEpubError)
        expect((err as RemoteEpubError).code).toBe('not-found')
        expect((err as RemoteEpubError).message).toContain('not found on server')
      }
    })

    it('throws RemoteEpubError with code "server" for 500', async () => {
      vi.stubGlobal('fetch', stubFetch(null, 500))

      const book = makeRemoteBook()
      try {
        await bookContentService.getEpubContent(book)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RemoteEpubError)
        expect((err as RemoteEpubError).code).toBe('server')
      }
    })

    it('throws RemoteEpubError with code "network" for TypeError (CORS/network)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      const book = makeRemoteBook()
      try {
        await bookContentService.getEpubContent(book)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RemoteEpubError)
        expect((err as RemoteEpubError).code).toBe('network')
        expect((err as RemoteEpubError).message).toContain('Could not reach')
      }
    })

    it('throws RemoteEpubError with code "timeout" for AbortError', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'))
      )

      const book = makeRemoteBook()
      try {
        await bookContentService.getEpubContent(book)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RemoteEpubError)
        expect((err as RemoteEpubError).code).toBe('timeout')
      }
    })
  })

  describe('remote fetch — caching', () => {
    it('caches EPUB after successful fetch', async () => {
      const buffer = new ArrayBuffer(50)
      vi.stubGlobal('fetch', stubFetch(buffer))

      const book = makeRemoteBook()
      await bookContentService.getEpubContent(book)

      // Wait for the async cache write (best-effort)
      await vi.advanceTimersByTimeAsync(0)

      const cached = await bookContentService.getCachedEpub(book.id)
      expect(cached).toBeInstanceOf(ArrayBuffer)
    })

    it('reports hasCachedVersion=true when cache exists on fetch failure', async () => {
      // Pre-populate cache
      await bookContentService.cacheEpub('book-remote-1', new ArrayBuffer(10))

      // Now fail the fetch
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      const book = makeRemoteBook()
      try {
        await bookContentService.getEpubContent(book)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RemoteEpubError)
        expect((err as RemoteEpubError).hasCachedVersion).toBe(true)
      }
    })

    it('reports hasCachedVersion=false when no cache exists', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      const book = makeRemoteBook('https://calibre.local/dl/2/epub', undefined, 'no-cache-book')
      try {
        await bookContentService.getEpubContent(book)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RemoteEpubError)
        expect((err as RemoteEpubError).hasCachedVersion).toBe(false)
      }
    })

    it('getCachedEpub returns null for uncached book', async () => {
      const result = await bookContentService.getCachedEpub('nonexistent')
      expect(result).toBeNull()
    })

    it('hasCachedEpub returns false for uncached book', async () => {
      const result = await bookContentService.hasCachedEpub('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('cache eviction — LRU', () => {
    it('evicts oldest entries when cache exceeds MAX_CACHED_BOOKS (10)', async () => {
      // Cache 11 books with staggered timestamps
      for (let i = 0; i < 11; i++) {
        // Advance time so X-Cached-At headers differ
        vi.setSystemTime(new Date(2026, 0, 1, 0, i, 0))
        await bookContentService.cacheEpub(`book-${i}`, new ArrayBuffer(10))
      }

      // Book 0 (oldest) should have been evicted
      const evicted = await bookContentService.hasCachedEpub('book-0')
      expect(evicted).toBe(false)

      // Book 10 (newest) should still exist
      const kept = await bookContentService.hasCachedEpub('book-10')
      expect(kept).toBe(true)

      // Book 1 (second oldest) should still exist (10 total = books 1-10)
      const secondOldest = await bookContentService.hasCachedEpub('book-1')
      expect(secondOldest).toBe(true)
    })
  })
})
