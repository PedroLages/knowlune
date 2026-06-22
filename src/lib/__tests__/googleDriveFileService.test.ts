import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock variables
const mockGetDriveToken = vi.fn()
const mockRefreshDriveToken = vi.fn()

vi.mock('@/lib/googleDriveToken', () => ({
  getDriveToken: () => mockGetDriveToken(),
  refreshDriveToken: () => mockRefreshDriveToken(),
}))

// Track fetch calls for assertion
const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

import {
  listFolder,
  getFileMetadata,
  buildStreamUrl,
  downloadFileContent,
  isSupportedForImport,
} from '@/lib/googleDriveFileService'

// ── Helpers ──────────────────────────────────────────────────

function makeDriveResponse(
  status: number,
  body: Record<string, unknown>,
  ok?: boolean
): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    statusText: '',
    type: 'basic' as ResponseType,
    url: '',
    clone: () => new Response(),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

// ── isSupportedForImport ────────────────────────────────────

describe('isSupportedForImport', () => {
  it('returns true for video mime types', () => {
    expect(isSupportedForImport('video/mp4')).toBe(true)
    expect(isSupportedForImport('video/webm')).toBe(true)
    expect(isSupportedForImport('video/x-matroska')).toBe(true)
  })

  it('returns true for PDF mime type', () => {
    expect(isSupportedForImport('application/pdf')).toBe(true)
  })

  it('returns true for EPUB mime type', () => {
    expect(isSupportedForImport('application/epub+zip')).toBe(true)
  })

  it('returns true for audio mime types', () => {
    expect(isSupportedForImport('audio/mpeg')).toBe(true)
    expect(isSupportedForImport('audio/mp4')).toBe(true)
    expect(isSupportedForImport('audio/ogg')).toBe(true)
  })

  it('returns false for folders', () => {
    expect(isSupportedForImport('application/vnd.google-apps.folder')).toBe(false)
  })

  it('returns false for unsupported types', () => {
    expect(isSupportedForImport('text/plain')).toBe(false)
    expect(isSupportedForImport('image/jpeg')).toBe(false)
    expect(isSupportedForImport('application/zip')).toBe(false)
  })
})

// ── buildStreamUrl ───────────────────────────────────────────

describe('buildStreamUrl', () => {
  it('returns a media download URL for a valid file ID', () => {
    const url = buildStreamUrl('file-123')
    expect(url).toBe(
      'https://www.googleapis.com/drive/v3/files/file-123?alt=media'
    )
  })

  it('returns null for an empty file ID', () => {
    expect(buildStreamUrl('')).toBeNull()
  })
})

// ── getFileMetadata ──────────────────────────────────────────

describe('getFileMetadata', () => {
  it('returns file metadata on success', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue(
      makeDriveResponse(200, {
        id: 'file-123',
        name: 'course-video.mp4',
        mimeType: 'video/mp4',
        size: 1048576,
        modifiedTime: '2026-06-01T12:00:00Z',
      })
    )

    const result = await getFileMetadata('file-123')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe('file-123')
      expect(result.data.name).toBe('course-video.mp4')
      expect(result.data.mimeType).toBe('video/mp4')
      expect(result.data.size).toBe(1048576)
    }
  })

  it('returns error when no token is available', async () => {
    mockGetDriveToken.mockResolvedValue(null)

    const result = await getFileMetadata('file-123')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('No Google Drive token available')
    }
  })

  it('returns error on 404', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue(
      makeDriveResponse(404, { error: { message: 'File not found' } }, false)
    )

    const result = await getFileMetadata('file-missing')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('not found')
      expect(result.status).toBe(404)
    }
  })

  it('returns scope error on 403 with insufficient scopes', async () => {
    mockGetDriveToken.mockResolvedValue('limited-token')
    fetchMock.mockResolvedValue(
      makeDriveResponse(
        403,
        { error: { message: 'Insufficient scopes for this request' } },
        false
      )
    )

    const result = await getFileMetadata('file-123')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('read scope')
    }
  })
})

// ── listFolder ─────────────────────────────────────────────────

describe('listFolder', () => {
  const mockFiles = [
    { id: 'folder-1', name: 'Course Materials', mimeType: 'application/vnd.google-apps.folder' },
    { id: 'file-1', name: 'intro.mp4', mimeType: 'video/mp4', size: 5000000, modifiedTime: '2026-06-01T12:00:00Z' },
    { id: 'file-2', name: 'slides.pdf', mimeType: 'application/pdf', size: 2000000, modifiedTime: '2026-06-01T12:00:00Z' },
  ]

  it('returns files and folders inside a Drive folder', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue(
      makeDriveResponse(200, { files: mockFiles })
    )

    const result = await listFolder('root')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.files).toHaveLength(3)
      expect(result.data.files[0].name).toBe('Course Materials')
    }

    // Verify the API URL includes the query parameters
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('q=')
    expect(url).toContain('trashed')
    expect(url).toContain('pageSize=100')
    expect(url).toContain('fields=')
  })

  it('passes pageToken when provided', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue(
      makeDriveResponse(200, {
        files: [{ id: 'file-3', name: 'more.pdf', mimeType: 'application/pdf' }],
        nextPageToken: 'next-page-abc',
      })
    )

    const result = await listFolder('root', 'prev-page-token')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.nextPageToken).toBe('next-page-abc')
    }

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('pageToken=')
  })

  it('returns error when no token is available', async () => {
    mockGetDriveToken.mockResolvedValue(null)

    const result = await listFolder('root')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('No Google Drive token available')
    }
  })

  it('retries on 401 after token refresh', async () => {
    mockGetDriveToken.mockResolvedValue('stale-token')
    mockRefreshDriveToken.mockResolvedValue('fresh-token')

    fetchMock
      .mockResolvedValueOnce(makeDriveResponse(401, { error: { message: 'Unauthorized' } }, false))
      .mockResolvedValueOnce(makeDriveResponse(200, { files: mockFiles }))

    const result = await listFolder('root')

    expect(result.ok).toBe(true)
    expect(mockRefreshDriveToken).toHaveBeenCalledTimes(1)

    // Second request should use the refreshed token
    const secondAuth = fetchMock.mock.calls[1][1].headers.Authorization
    expect(secondAuth).toBe('Bearer fresh-token')
  })

  it('rate limit error returns ok:false', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue(
      makeDriveResponse(429, { error: { message: 'Rate limit exceeded' } }, false)
    )

    const result = await listFolder('root')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('rate limit')
    }
  })
})

// ── downloadFileContent ────────────────────────────────────────

describe('downloadFileContent', () => {
  it('returns the response when fetch succeeds', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    const fakeResponse = makeDriveResponse(200, {})
    fetchMock.mockResolvedValue(fakeResponse)

    const result = await downloadFileContent('file-123')

    expect(result).not.toBeNull()

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('files/file-123?alt=media')
  })

  it('returns null when no token is available', async () => {
    mockGetDriveToken.mockResolvedValue(null)

    const result = await downloadFileContent('file-123')

    expect(result).toBeNull()
  })

  it('retries on 401 with refreshed token', async () => {
    mockGetDriveToken.mockResolvedValue('stale-token')
    mockRefreshDriveToken.mockResolvedValue('fresh-token')

    fetchMock
      .mockResolvedValueOnce(makeDriveResponse(401, { error: { message: 'Unauthorized' } }, false))
      .mockResolvedValueOnce(makeDriveResponse(200, {}))

    const result = await downloadFileContent('file-123')

    expect(result).not.toBeNull()
    expect(mockRefreshDriveToken).toHaveBeenCalledTimes(1)

    const secondAuth = fetchMock.mock.calls[1][1].headers.Authorization
    expect(secondAuth).toBe('Bearer fresh-token')
  })

  it('passes AbortSignal to fetch', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue(makeDriveResponse(200, {}))

    const controller = new AbortController()
    await downloadFileContent('file-123', controller.signal)

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
  })
})
