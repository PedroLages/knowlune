/**
 * Tests for server-import helpers in courseImport:
 *   - listServerSubDirectories: 4+ branches
 *   - scanCourseFromSource: 3+ code paths
 *
 * @since CE-2026-06-28
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scanCourseFromSource, listServerSubDirectories } from '../courseImport'
import { db } from '@/db'
import type { ImportedCourse } from '@/data/types'

// Mock global fetch for URL-based operations
const mockFetch = vi.fn()

const AUTOINDEX_HTML = `<html><head><title>Index of /courses/</title></head><body>
  <h1>Index of /courses/</h1><hr><pre>
  <a href="../">../</a>
  <a href="Course1/">Course1/</a>  01-Jan-2025 10:00    -
  <a href="Course2/">Course2/</a>  01-Jan-2025 10:00    -
  </pre><hr></body></html>`

function makeAutoindexResponse(html: string) {
  return { ok: true, text: () => Promise.resolve(html) } as Response
}

// Mock the sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

// Mock the import progress store (needed by scanCourseFolderFromServer)
vi.mock('@/stores/useImportProgressStore', () => ({
  useImportProgressStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector
        ? selector({
            startImport: vi.fn(),
            updateScanProgress: vi.fn(),
            updateProcessingProgress: vi.fn(),
            completeCourse: vi.fn(),
            failCourse: vi.fn(),
            cancelRequested: false,
            confirmCancellation: vi.fn(),
            setDialogOpen: vi.fn(),
          } as Record<string, unknown>)
        : {
            startImport: vi.fn(),
            updateScanProgress: vi.fn(),
            updateProcessingProgress: vi.fn(),
            completeCourse: vi.fn(),
            failCourse: vi.fn(),
            cancelRequested: false,
            confirmCancellation: vi.fn(),
            setDialogOpen: vi.fn(),
          },
    {
      getState: () => ({
        startImport: vi.fn(),
        updateScanProgress: vi.fn(),
        completeCourse: vi.fn(),
        failCourse: vi.fn(),
        cancelRequested: false,
        confirmCancellation: vi.fn(),
        setDialogOpen: vi.fn(),
      }),
    }
  ),
}))

// ───── listServerSubDirectories ─────

describe('listServerSubDirectories', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = mockFetch
    mockFetch.mockReset()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns directories from a valid server URL', async () => {
    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(AUTOINDEX_HTML))
    const result = await listServerSubDirectories('http://example.com/courses/')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].name).toBe('Course1')
      expect(result.data[1].name).toBe('Course2')
    }
  })

  it('returns empty array when no subdirectories exist', async () => {
    mockFetch.mockResolvedValueOnce(
      makeAutoindexResponse(
        `<html><body><pre><a href="../">../</a><a href="file.mp4">file.mp4</a></pre></body></html>`
      )
    )
    const result = await listServerSubDirectories('http://example.com/courses/')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(0)
    }
  })

  it('returns validation error for invalid URL', async () => {
    const result = await listServerSubDirectories('not-a-url')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('not valid')
    }
  })

  it('returns error when fetch fails (network unreachable)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const result = await listServerSubDirectories('http://unreachable.example/courses/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Network error')
    }
  })

  it('returns error when server responds with non-200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response)
    const result = await listServerSubDirectories('http://example.com/error/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('500')
    }
  })

  it('strips trailing slashes from directory names', async () => {
    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(AUTOINDEX_HTML))
    const result = await listServerSubDirectories('http://example.com/courses/')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0].name).not.toMatch(/\/$/)
    }
  })
})

// ───── scanCourseFromSource ─────

describe('scanCourseFromSource', () => {
  const originalFetch = globalThis.fetch

  beforeEach(async () => {
    globalThis.fetch = mockFetch
    mockFetch.mockReset()
    // Clean DB before each test
    await db.importedCourses.clear()
    await db.importedVideos.clear()
    await db.importedPdfs.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // Path: server URL → success
  it('returns success when scanning from server URL', async () => {
    mockFetch.mockResolvedValueOnce(
      makeAutoindexResponse(
        `<html><body><pre><a href="../">../</a><a href="video.mp4">video.mp4</a></pre></body></html>`
      )
    )

    const result = await scanCourseFromSource({
      serverUrl: 'http://example.com/MyCourse/',
      handle: null,
      folderName: 'MyCourse',
    })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.course.name).toBe('MyCourse')
    }
  })

  // Name matches do not block server re-scan; stable serverPath handles upsert later.
  it('rescans a server folder even when a course has the same display name', async () => {
    // Pre-seed a course with the same name
    await db.importedCourses.add({
      id: 'existing-id',
      name: 'MyCourse',
      importedAt: '2025-01-01T00:00:00Z',
      category: '',
      tags: [],
      status: 'not-started',
      videoCount: 0,
      pdfCount: 0,
      directoryHandle: null,
    } satisfies ImportedCourse)

    const result = await scanCourseFromSource({
      serverUrl: 'http://example.com/MyCourse/',
      handle: null,
      folderName: 'MyCourse',
    })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.course.name).toBe('MyCourse')
    }
  })

  // Path: server URL → fetch error (scanCourseFolderFromServer handles this gracefully
  // by returning a ScannedCourse with 0 files; scanCourseFromSource returns success)
  it('returns success with empty course when server scan returns no files', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' } as Response)

    const result = await scanCourseFromSource({
      serverUrl: 'http://example.com/EmptyCourse/',
      handle: null,
      folderName: 'EmptyCourse',
    })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.course.name).toBe('EmptyCourse')
      expect(result.course.videos).toHaveLength(0)
      expect(result.course.pdfs).toHaveLength(0)
    }
  })

  // Path: local handle → success (requires scanCourseFolderFromHandle which reads from filesystem)
  // We mock scanCourseFolderFromHandle via the module mock... but wait, scanCourseFromSource
  // imports scanCourseFolderFromHandle directly. Since we're testing the actual module,
  // we can't easily mock it here without module-level mocks.
  //
  // The handle path is tested through the BulkImportDialog component tests.
  // This unit test confirms the dispatching logic.

  // Path: no source → error
  it('returns error when neither serverUrl nor handle is available', async () => {
    const result = await scanCourseFromSource({
      serverUrl: undefined,
      handle: null,
      folderName: 'NoSource',
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.message).toContain('No source')
    }
  })

  // Path: server URL → fetch rejected (network error) — scanCourseFolderFromServer
  // catches rejected fetches internally and returns a course with 0 files.
  it('returns success with empty course on network rejection', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

    const result = await scanCourseFromSource({
      serverUrl: 'http://example.com/TimeoutCourse/',
      handle: null,
      folderName: 'TimeoutCourse',
    })

    // scanCourseFolderFromServer never throws on fetch failures — it logs and returns empty data
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.course.videos).toHaveLength(0)
    }
  })

  // Path: server URL → cap race (KI-104) — 10 concurrent subdirectories each with 600 files
  // verifies total files collected never exceeds MAX_SERVER_SCAN_FILES (5000)
  it('caps at MAX_SERVER_SCAN_FILES with concurrent subdirs', async () => {
    // Build a root autoindex with 10 subdirectories
    const rootLinks = Array.from(
      { length: 10 },
      (_, i) => `<a href="SubDir${i}/">SubDir${i}/</a>  01-Jan-2025 10:00    -`
    ).join('\n')
    const rootHtml = `<html><body><pre><a href="../">../</a>\n${rootLinks}\n</pre></body></html>`

    // Build per-subdir autoindex with 600 video files each
    function subdirHtml(dirIndex: number): string {
      const fileLinks = Array.from(
        { length: 600 },
        (_, i) =>
          `<a href="video${dirIndex}_${i}.mp4">video${dirIndex}_${i}.mp4</a>  01-Jan-2025 10:00    10M`
      ).join('\n')
      return `<html><body><pre><a href="../">../</a>\n${fileLinks}\n</pre></body></html>`
    }

    // Seed fetch mock:
    // First call: root page
    // Subsequent calls: subdirectories (up to 10 concurrent, may be called fewer after cap)
    const subdirResponses = Array.from({ length: 10 }, (_, i) =>
      makeAutoindexResponse(subdirHtml(i))
    )
    mockFetch.mockResolvedValueOnce(makeAutoindexResponse(rootHtml))
    for (const resp of subdirResponses) {
      mockFetch.mockResolvedValueOnce(resp)
    }

    const result = await scanCourseFromSource({
      serverUrl: 'http://example.com/LargeCourse/',
      handle: null,
      folderName: 'LargeCourse',
    })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.course.videos.length + result.course.pdfs.length).toBeLessThanOrEqual(5000)
      expect(result.course.truncated).toBe(true)
    }
  })
})
