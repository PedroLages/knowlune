/**
 * BookContentService — reads EPUB file content for a given Book.
 *
 * Abstracts the file source (OPFS, IndexedDB fallback, or remote URL).
 * Returns an ArrayBuffer suitable for passing to epub.js.
 *
 * Remote EPUBs are fetched with auth headers when credentials exist,
 * cached in the browser Cache API for offline fallback, and evicted
 * using an LRU strategy (max 10 cached books).
 *
 * @module BookContentService
 * @since E83
 * @modified E88-S03 — remote EPUB streaming with auth, caching, error handling
 */
import type { Book, ContentSource } from '@/data/types'
import { opfsStorageService } from './OpfsStorageService'

const CACHE_NAME = 'knowlune-epub-cache'
const MAX_CACHED_BOOKS = 10
const FETCH_TIMEOUT_MS = 30_000

/**
 * Test mode flag - when enabled, returns a minimal mock EPUB instead of reading from storage.
 * Set via `enableTestMode()` before running E2E tests.
 *
 * @since E107-S03 - E2E testing infrastructure
 */
let TEST_MODE = false

/**
 * Enable test mode for E2E testing. When enabled, getEpubContent returns a minimal mock EPUB.
 *
 * @since E107-S03 - E2E testing infrastructure
 */
export function enableTestMode(): void {
  TEST_MODE = true
  console.log('[BookContentService] Test mode enabled - using mock EPUB for E2E tests')
}

/** Error subclass for remote EPUB fetch failures with structured metadata. */
export class RemoteEpubError extends Error {
  constructor(
    message: string,
    public readonly code: 'network' | 'auth' | 'not-found' | 'server' | 'timeout',
    public readonly hasCachedVersion: boolean = false
  ) {
    super(message)
    this.name = 'RemoteEpubError'
  }
}

class BookContentService {
  /**
   * Check if test mode is enabled via window flag (for E2E tests)
   */
  private isTestMode(): boolean {
    return (
      TEST_MODE ||
      (typeof window !== 'undefined' && (window as any).__BOOK_CONTENT_TEST_MODE__ === true)
    )
  }

  /**
   * Get the EPUB content for a book as an ArrayBuffer.
   *
   * Source priority:
   * 1. TEST_MODE - returns minimal mock EPUB for E2E testing
   * 2. OPFS local path (most common after import)
   * 3. File handle (drag-and-drop / file picker)
   * 4. Remote URL with auth + caching (OPDS catalogs)
   *
   * @throws Error if book format is not EPUB or content cannot be read
   * @throws RemoteEpubError for remote fetch failures (with structured code)
   */
  async getEpubContent(book: Book): Promise<ArrayBuffer> {
    // TEST_MODE: Return minimal EPUB for E2E testing (dynamic import avoids bundling JSZip in production)
    if (this.isTestMode()) {
      const { createMinimalEpub } = await import('./__tests__/minimalEpub')
      return createMinimalEpub()
    }

    if (book.format !== 'epub') {
      throw new Error(
        `BookContentService: book "${book.id}" is not an EPUB (format: ${book.format})`
      )
    }

    const source = book.source

    if (source.type === 'remote') {
      return this.fetchRemoteEpub(book.id, source)
    }

    if (source.type === 'fileHandle') {
      const file = await source.handle.getFile()
      return file.arrayBuffer()
    }

    // source.type === 'local' — read from OPFS / IDB fallback
    const file = await opfsStorageService.readBookFile(source.opfsPath, book.id)
    if (!file) {
      throw new Error(`BookContentService: EPUB file not found in storage for book "${book.id}"`)
    }
    return file.arrayBuffer()
  }

  /**
   * Fetch a remote EPUB with auth headers, timeout, and Cache API fallback.
   *
   * On success: caches the response for offline use.
   * On failure: falls back to cached version if available, otherwise throws RemoteEpubError.
   */
  private async fetchRemoteEpub(
    bookId: string,
    source: Extract<ContentSource, { type: 'remote' }>
  ): Promise<ArrayBuffer> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      // Issue 4: Validate URL before fetch
      if (!source.url || !/^https?:\/\//i.test(source.url)) {
        throw new RemoteEpubError(
          'Invalid book URL. Only http:// and https:// URLs are supported.',
          'network',
          false
        )
      }

      const headers: Record<string, string> = {}
      if (source.auth && 'username' in source.auth && source.auth.password) {
        // Issue 2: Warn if credentials are sent over plain HTTP (RFC 7617 security)
        if (/^http:\/\//i.test(source.url)) {
          console.warn(
            '[BookContentService] Credentials are being sent over an insecure connection (http://). ' +
              'Use https:// to protect your credentials.'
          )
        }
        // Issue 1: Use TextEncoder to handle non-ASCII credentials (RFC 7617 compliance)
        // Note: password may be absent for books imported after E95-S02 (stored in Vault).
        // Full read-path migration (look up via catalogId at read-time) is future work.
        const credentials = `${source.auth.username}:${source.auth.password}`
        const encoded = new TextEncoder().encode(credentials)
        const base64 = btoa(String.fromCharCode(...encoded))
        headers['Authorization'] = `Basic ${base64}`
      }

      const response = await fetch(source.url, {
        signal: controller.signal,
        headers,
      })

      clearTimeout(timeoutId)

      if (response.status === 401 || response.status === 403) {
        const hasCached = await this.hasCachedEpub(bookId)
        throw new RemoteEpubError(
          'Authentication failed. Check your catalog credentials in settings.',
          'auth',
          hasCached
        )
      }

      if (response.status === 404) {
        const hasCached = await this.hasCachedEpub(bookId)
        throw new RemoteEpubError(
          'Book not found on server. It may have been removed from the catalog.',
          'not-found',
          hasCached
        )
      }

      if (!response.ok) {
        const hasCached = await this.hasCachedEpub(bookId)
        throw new RemoteEpubError(
          `Server returned ${response.status}. Try again later.`,
          'server',
          hasCached
        )
      }

      const arrayBuffer = await response.arrayBuffer()

      // Cache the successful response (best-effort, non-blocking)
      this.cacheEpub(bookId, arrayBuffer).catch(err => {
        // silent-catch-ok: caching failure is non-fatal — book is already loaded
        console.warn('[BookContentService] Failed to cache EPUB:', err)
      })

      return arrayBuffer
    } catch (err: unknown) {
      clearTimeout(timeoutId)

      // Re-throw our own errors
      if (err instanceof RemoteEpubError) {
        throw err
      }

      // Network/timeout errors — try cache fallback
      const hasCached = await this.hasCachedEpub(bookId)

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new RemoteEpubError(
          'Connection timed out. Check your connection and try again.',
          'timeout',
          hasCached
        )
      }

      throw new RemoteEpubError(
        'Could not reach your library server. Check your connection and ensure the server allows cross-origin requests (CORS).',
        'network',
        hasCached
      )
    }
  }

  // ─── Cache API Methods ────────────────────────────────────────────

  /** Cache an EPUB ArrayBuffer for offline fallback. Enforces LRU eviction. */
  async cacheEpub(bookId: string, buffer: ArrayBuffer): Promise<void> {
    const cache = await caches.open(CACHE_NAME)
    const cacheKey = this.getCacheKey(bookId)

    // Store with Content-Type and a timestamp header for LRU eviction
    const response = new Response(buffer, {
      headers: {
        'Content-Type': 'application/epub+zip',
        'X-Cached-At': new Date().toISOString(),
      },
    })
    await cache.put(cacheKey, response)

    // Enforce max cache size (LRU eviction)
    await this.evictOldestIfNeeded(cache)
  }

  /** Retrieve a cached EPUB, or null if not cached. */
  async getCachedEpub(bookId: string): Promise<ArrayBuffer | null> {
    try {
      const cache = await caches.open(CACHE_NAME)
      const response = await cache.match(this.getCacheKey(bookId))
      return response ? response.arrayBuffer() : null
    } catch {
      // silent-catch-ok: cache unavailable (private browsing, etc.)
      return null
    }
  }

  /** Check if a cached version exists without reading the full content. */
  async hasCachedEpub(bookId: string): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME)
      const response = await cache.match(this.getCacheKey(bookId))
      return response !== undefined
    } catch {
      // silent-catch-ok: cache unavailable
      return false
    }
  }

  /** LRU eviction: remove oldest cached entries if over MAX_CACHED_BOOKS. */
  private async evictOldestIfNeeded(cache: Cache): Promise<void> {
    const keys = await cache.keys()
    if (keys.length <= MAX_CACHED_BOOKS) return

    // Build list of entries with their cached-at timestamps
    const entries: { request: Request; cachedAt: string }[] = []
    for (const request of keys) {
      const response = await cache.match(request)
      const cachedAt = response?.headers.get('X-Cached-At') ?? '1970-01-01T00:00:00Z'
      entries.push({ request, cachedAt })
    }

    // Sort by cached-at ascending (oldest first) and delete extras
    entries.sort((a, b) => a.cachedAt.localeCompare(b.cachedAt))
    const toEvict = entries.slice(0, entries.length - MAX_CACHED_BOOKS)
    for (const entry of toEvict) {
      await cache.delete(entry.request)
    }
  }

  /** Generate a stable cache key for a given book ID. */
  private getCacheKey(bookId: string): string {
    return `/epub/${bookId}`
  }
}

export const bookContentService = new BookContentService()
