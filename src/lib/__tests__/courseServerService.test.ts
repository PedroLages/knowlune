/**
 * Tests for courseServerService (E133-S01).
 *
 * Covers:
 *   - isValidImportUrl: 5 validation branches
 *   - fetchDirectoryListing: 4+ execution branches
 *   - buildFileUrl: URL construction
 *
 * @since CE-2026-06-28
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isValidImportUrl,
  fetchDirectoryListing,
  buildFileUrl,
  verifyConnection,
} from '../courseServerService'

// ───── isValidImportUrl ─────

describe('isValidImportUrl', () => {
  it('rejects empty string', () => {
    const result = isValidImportUrl('')
    expect(result.valid).toBe(false)
    expect('reason' in result && result.reason).toContain('empty')
  })

  it('rejects whitespace-only string', () => {
    const result = isValidImportUrl('   ')
    expect(result.valid).toBe(false)
    expect('reason' in result && result.reason).toContain('empty')
  })

  it('rejects unparseable URL', () => {
    const result = isValidImportUrl('not-a-url')
    expect(result.valid).toBe(false)
    expect('reason' in result && result.reason).toContain('not valid')
  })

  it('rejects unsupported protocol (ftp)', () => {
    const result = isValidImportUrl('ftp://example.com/courses/')
    expect(result.valid).toBe(false)
    expect('reason' in result && result.reason).toContain('protocol')
  })

  it('rejects bare root without path segment', () => {
    const result = isValidImportUrl('http://192.168.1.1')
    expect(result.valid).toBe(false)
    expect('reason' in result && result.reason).toContain('folder path')
  })

  it('accepts valid http URL with path', () => {
    const result = isValidImportUrl('http://192.168.1.1/courses/')
    expect(result.valid).toBe(true)
  })

  it('accepts valid https URL with path', () => {
    const result = isValidImportUrl('https://example.com/AI/Course/')
    expect(result.valid).toBe(true)
  })

  it('accepts deeply nested path', () => {
    const result = isValidImportUrl('https://server.com/a/b/c/d/')
    expect(result.valid).toBe(true)
  })

  it('trims whitespace before validation', () => {
    const result = isValidImportUrl('  http://example.com/path/  ')
    expect(result.valid).toBe(true)
  })
})

// ───── buildFileUrl ─────

describe('buildFileUrl', () => {
  it('joins base URL and relative path with single segment', () => {
    const url = buildFileUrl('http://192.168.1.1', 'Course/01.mp4')
    expect(url).toBe('http://192.168.1.1/Course/01.mp4')
  })

  it('handles spaces in filenames via encoding', () => {
    const url = buildFileUrl('http://example.com', 'My Course/01. Video.mp4')
    expect(url).toContain('01.%20Video.mp4')
  })

  it('handles trailing slash on base URL', () => {
    const url = buildFileUrl('http://example.com/courses/', 'lesson.mp4')
    expect(url).toBe('http://example.com/courses/lesson.mp4')
  })

  it('handles multiple path segments', () => {
    const url = buildFileUrl('http://example.com', 'root/sub/file.mp4')
    expect(url).toBe('http://example.com/root/sub/file.mp4')
  })
})

// ───── fetchDirectoryListing ─────

describe('fetchDirectoryListing', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns directory listing on successful fetch', async () => {
    const mockHtml = `<html><head><title>Index of /courses/</title></head><body>
      <h1>Index of /courses/</h1><hr><pre>
      <a href="../">../</a>
      <a href="Course1/">Course1/</a>  01-Jan-2025 10:00    -
      <a href="video.mp4">video.mp4</a>  01-Jan-2025 10:00   23M
      <a href="doc.pdf">doc.pdf</a>    01-Jan-2025 10:00  1.2M
      </pre><hr></body></html>`

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockHtml),
    } as Response)

    const result = await fetchDirectoryListing('http://example.com/courses/')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.files).toHaveLength(3)
      const dirEntry = result.data.files.find(f => f.type === 'directory')
      expect(dirEntry?.name).toBe('Course1/')
      const videoEntry = result.data.files.find(f => f.type === 'video')
      expect(videoEntry?.name).toBe('video.mp4')
      const pdfEntry = result.data.files.find(f => f.type === 'pdf')
      expect(pdfEntry?.name).toBe('doc.pdf')
    }
  })

  it('returns ok:false on non-200 response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response)

    const result = await fetchDirectoryListing('http://example.com/missing/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('404')
    }
  })

  it('returns ok:false on network error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await fetchDirectoryListing('http://unreachable.example/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Network error')
    }
  })

  it('returns ok:false on timeout', async () => {
    // Use the AbortError constructor which is supported in Node.js 18+
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new DOMException('The operation was aborted', 'AbortError')
    )

    const result = await fetchDirectoryListing('http://slow.example/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('timed out')
    }
  })

  it('normalizes trailing slash on base URL for returned data.url', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(`<html><body><pre>
        <a href="../">../</a>
        <a href="file.mp4">file.mp4</a>
        </pre></body></html>`),
    } as Response)

    const result = await fetchDirectoryListing('http://example.com/courses')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.url).not.toMatch(/\/\/$/)
    }
  })

  it('preserves trailing slash on the actual fetch URL to avoid nginx redirect', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(`<html><body><pre>
        <a href="../">../</a>
        <a href="file.mp4">file.mp4</a>
        </pre></body></html>`),
    } as Response)

    // Input WITH trailing slash — should be preserved in fetch call
    await fetchDirectoryListing('http://example.com/courses/')
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      'http://example.com/courses/',
      expect.objectContaining({ redirect: 'error' })
    )
  })

  it('adds trailing slash to fetch URL when input lacks it', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(`<html><body><pre>
        <a href="../">../</a>
        <a href="file.mp4">file.mp4</a>
        </pre></body></html>`),
    } as Response)

    // Input WITHOUT trailing slash — should add one for fetch
    await fetchDirectoryListing('http://example.com/courses')
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      'http://example.com/courses/',
      expect.objectContaining({ redirect: 'error' })
    )
  })
})

// ───── verifyConnection ─────

describe('verifyConnection', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns reachable on ok response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
    } as Response)

    const result = await verifyConnection('http://example.com/')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.reachable).toBe(true)
    }
  })

  it('returns auth failure on 401', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    const result = await verifyConnection('http://example.com/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Authentication')
    }
  })

  it('sends Bearer token when provided', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
    } as Response)

    await verifyConnection('http://example.com/', 'token-123')
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    )
  })

  it('preserves trailing slash on fetch URL to avoid nginx redirect', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
    } as Response)

    await verifyConnection('http://example.com/courses/')
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      'http://example.com/courses/',
      expect.anything()
    )
  })

  it('returns network error on TypeError', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to connect'))

    const result = await verifyConnection('http://unreachable.example/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('unreachable')
    }
  })
})
