/**
 * Tests for scanCourseFolderFromServer in courseImport (KI-108).
 *
 * Covers:
 *   - Happy path: flat directory with mixed file types
 *   - Truncated: 6000+ files across multiple directories -> capped at 5000
 *   - Empty directory: no files
 *   - Error path: fetch returns non-ok response
 *   - Network error: fetch rejection
 *   - Dedup paths: same file URL appearing in multiple directories
 *   - serverId passthrough
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scanCourseFolderFromServer } from '@/lib/courseImport'

// Helper: create a vitest-compatible Response from autoindex HTML
function makeAutoindexResponse(html: string): Response {
  return { ok: true, text: () => Promise.resolve(html) } as Response
}

// Mock the import progress store (needed by scanCourseFolderFromServer which
// calls useImportProgressStore.getState() during the BFS traversal loop).
vi.mock('@/stores/useImportProgressStore', () => ({
  useImportProgressStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector
        ? selector({
            startImport: vi.fn(),
            updateScanProgress: vi.fn(),
            completeCourse: vi.fn(),
            cancelRequested: false,
            confirmCancellation: vi.fn(),
          } as Record<string, unknown>)
        : {
            startImport: vi.fn(),
            updateScanProgress: vi.fn(),
            completeCourse: vi.fn(),
            cancelRequested: false,
            confirmCancellation: vi.fn(),
          },
    {
      getState: () => ({
        startImport: vi.fn(),
        updateScanProgress: vi.fn(),
        completeCourse: vi.fn(),
        cancelRequested: false,
        confirmCancellation: vi.fn(),
      }),
    }
  ),
}))

describe('scanCourseFolderFromServer', () => {
  const mockFetch = vi.fn()
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = mockFetch
    mockFetch.mockReset()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ── Happy path ─────────────────────────────────────────────────

  it('returns ScannedCourse with videos, pdfs, and images from a flat directory (happy path)', async () => {
    const html = `<html><head><title>Index of /MyCourse/</title></head><body>
<h1>Index of /MyCourse/</h1><hr><pre>
<a href="../">../</a>
<a href="intro.mp4">intro.mp4</a>                01-Jan-2025 10:00   20M
<a href="lesson1.mp4">lesson1.mp4</a>              01-Jan-2025 10:00   30M
<a href="notes.pdf">notes.pdf</a>                01-Jan-2025 10:00  500K
<a href="cover.jpg">cover.jpg</a>                01-Jan-2025 10:00  100K
</pre><hr></body></html>`

    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(html))

    const result = await scanCourseFolderFromServer('http://example.com/MyCourse/')

    expect(result.name).toBe('MyCourse')
    expect(result.source).toBe('server')
    expect(result.videos).toHaveLength(2)
    expect(result.pdfs).toHaveLength(1)
    expect(result.images).toHaveLength(1)
    expect(result.truncated).toBeUndefined()
    expect(result.directoryHandle).toBeNull()
    expect(result.serverPath).toBe('MyCourse')
  })

  // ── Truncated / file cap ───────────────────────────────────────

  it('sets truncated flag when file count reaches MAX_SERVER_SCAN_FILES cap', async () => {
    // Root with 10 subdirectories
    const rootLinks = Array.from(
      { length: 10 },
      (_, i) => `<a href="SubDir${i}/">SubDir${i}/</a>  01-Jan-2025 10:00    -`
    ).join('\n')
    const rootHtml = `<html><body><pre><a href="../">../</a>\n${rootLinks}\n</pre></body></html>`

    function subdirHtml(dirIndex: number): string {
      const fileLinks = Array.from(
        { length: 600 },
        (_, i) =>
          `<a href="video${dirIndex}_${i}.mp4">video${dirIndex}_${i}.mp4</a>  01-Jan-2025 10:00    10M`
      ).join('\n')
      return `<html><body><pre><a href="../">../</a>\n${fileLinks}\n</pre></body></html>`
    }

    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(rootHtml))
    for (let i = 0; i < 10; i++) {
      mockFetch.mockResolvedValueOnce(makeAutoindexResponse(subdirHtml(i)))
    }

    const result = await scanCourseFolderFromServer('http://example.com/LargeCourse/')

    expect(result.name).toBe('LargeCourse')
    expect(result.videos.length).toBeLessThanOrEqual(5000)
    // 10 dirs x 600 files = 6000 total files, but cap is 5000 -> truncated
    expect(result.truncated).toBe(true)
  })

  // ── Empty directory ────────────────────────────────────────────

  it('returns empty ScannedCourse for empty directory with only parent link', async () => {
    const html = `<html><body><pre><a href="../">../</a></pre></body></html>`
    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(html))

    const result = await scanCourseFolderFromServer('http://example.com/EmptyCourse/')

    expect(result.name).toBe('EmptyCourse')
    expect(result.videos).toHaveLength(0)
    expect(result.pdfs).toHaveLength(0)
    expect(result.images).toHaveLength(0)
    expect(result.truncated).toBeUndefined()
  })

  // ── Error paths ────────────────────────────────────────────────

  it('handles HTTP error fetch gracefully (non-ok response)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response)

    const result = await scanCourseFolderFromServer('http://example.com/NotFound/')

    // Function should not throw -- returns course with 0 files
    expect(result.name).toBe('NotFound')
    expect(result.videos).toHaveLength(0)
    expect(result.pdfs).toHaveLength(0)
  })

  it('handles network error fetch gracefully (rejected promise)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await scanCourseFolderFromServer('http://example.com/Unreachable/')

    expect(result.name).toBe('Unreachable')
    expect(result.videos).toHaveLength(0)
    expect(result.pdfs).toHaveLength(0)
  })

  // ── Dedup ──────────────────────────────────────────────────────

  it('deduplicates files with same canonical URL across directories', async () => {
    // Root with two subdirectories
    const rootHtml = `<html><body><pre><a href="../">../</a>
<a href="dir1/">dir1/</a>  01-Jan-2025 10:00    -
<a href="dir2/">dir2/</a>  01-Jan-2025 10:00    -
</pre></body></html>`

    // Both directories list the same file via absolute URL (simulating symlinks).
    // Absolute hrefs override the baseUrl in parseAutoindex, so both resolve to
    // the exact same canonical URL -> second occurrence is deduplicated.
    const sharedFileUrl = 'http://example.com/DedupCourse/shared/video1.mp4'
    const dirHtml = `<html><body><pre><a href="../">../</a>
<a href="${sharedFileUrl}">video1.mp4</a>  01-Jan-2025 10:00    10M
</pre></body></html>`

    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(rootHtml))
    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(dirHtml))
    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(dirHtml))

    const result = await scanCourseFolderFromServer('http://example.com/DedupCourse/')

    // Only 1 video total (the duplicate from dir2 was skipped)
    expect(result.videos).toHaveLength(1)
  })

  // ── serverId passthrough ───────────────────────────────────────

  it('passes serverId through to the returned ScannedCourse', async () => {
    const html = `<html><body><pre><a href="../">../</a>
<a href="video1.mp4">video1.mp4</a>  01-Jan-2025 10:00    10M
</pre></body></html>`

    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(html))

    const result = await scanCourseFolderFromServer(
      'http://example.com/ServerIdCourse/',
      'server-abc-123'
    )

    expect(result.serverId).toBe('server-abc-123')
  })
})
