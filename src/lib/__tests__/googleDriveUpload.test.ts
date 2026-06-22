import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  uploadBackupToDrive,
  DriveQuotaError,
  DrivePermissionError,
  DriveNetworkError,
} from '@/lib/googleDriveUpload'

// ── Mocks ────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────

/**
 * Create a minimal Blob-like object that also has `.text()`.
 * jsdom Blob does not implement `.text()`, so we wrap it.
 */
function makeBlob(content: string): Blob {
  const blob = new Blob([content], { type: 'application/json' })
  // Add text() for environments that don't support it (e.g. jsdom)
  if (!('text' in blob)) {
    Object.defineProperty(blob, 'text', {
      value: () => Promise.resolve(content),
      writable: false,
    })
  }
  return blob
}

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

// ── Tests ────────────────────────────────────────────────────

describe('uploadBackupToDrive', () => {
  it('uploads successfully with a valid token', async () => {
    mockGetDriveToken.mockResolvedValue('google-token-abc')
    fetchMock.mockResolvedValue(
      makeDriveResponse(200, {
        id: 'file-123',
        webViewLink: 'https://drive.google.com/file/d/file-123/view',
      })
    )

    const result = await uploadBackupToDrive(makeBlob('{"test":true}'), 'backup.json')

    expect(result).toEqual({
      fileId: 'file-123',
      webViewLink: 'https://drive.google.com/file/d/file-123/view',
    })

    // Verify the multipart request shape
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('uploadType=multipart')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer google-token-abc')
    expect(options.headers['Content-Type']).toContain('multipart/related')
    expect(options.body).toContain('backup.json')
    expect(options.body).toContain('{"test":true}')
  })

  it('throws DrivePermissionError when getDriveToken returns null', async () => {
    mockGetDriveToken.mockResolvedValue(null)

    await expect(
      uploadBackupToDrive(makeBlob('{}'), 'backup.json')
    ).rejects.toThrow(DrivePermissionError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retries on 401 after refreshing the token', async () => {
    mockGetDriveToken.mockResolvedValue('stale-token')
    mockRefreshDriveToken.mockResolvedValue('fresh-token')

    // First call returns 401, second succeeds
    fetchMock
      .mockResolvedValueOnce(makeDriveResponse(401, { message: 'Unauthorized' }, false))
      .mockResolvedValueOnce(
        makeDriveResponse(200, {
          id: 'file-456',
          webViewLink: 'https://drive.google.com/file/d/file-456/view',
        })
      )

    const result = await uploadBackupToDrive(makeBlob('{}'), 'backup.json')

    expect(result).toEqual({
      fileId: 'file-456',
      webViewLink: 'https://drive.google.com/file/d/file-456/view',
    })

    expect(mockRefreshDriveToken).toHaveBeenCalledTimes(1)
    // Second request should use the refreshed token
    const secondAuth = fetchMock.mock.calls[1][1].headers.Authorization
    expect(secondAuth).toBe('Bearer fresh-token')
  })

  it('throws DrivePermissionError when 401 and token refresh yields null', async () => {
    mockGetDriveToken.mockResolvedValue('stale-token')
    mockRefreshDriveToken.mockResolvedValue(null)

    fetchMock.mockResolvedValueOnce(makeDriveResponse(401, { message: 'Unauthorized' }, false))

    await expect(
      uploadBackupToDrive(makeBlob('{}'), 'backup.json')
    ).rejects.toThrow(DrivePermissionError)
  })

  it('throws DriveQuotaError on 403 with quota message', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')

    fetchMock.mockResolvedValueOnce(
      makeDriveResponse(
        403,
        { message: 'Storage quota exceeded. Free up space in Google Drive.' },
        false
      )
    )

    await expect(
      uploadBackupToDrive(makeBlob('{}'), 'backup.json')
    ).rejects.toThrow(DriveQuotaError)
  })

  it('throws DrivePermissionError on 403 with permission message', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')

    fetchMock.mockResolvedValueOnce(
      makeDriveResponse(
        403,
        { message: 'Access denied. The user does not have permission to perform this action.' },
        false
      )
    )

    await expect(
      uploadBackupToDrive(makeBlob('{}'), 'backup.json')
    ).rejects.toThrow(DrivePermissionError)
  })

  it('throws DrivePermissionError on 403 with generic message', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')

    fetchMock.mockResolvedValueOnce(
      makeDriveResponse(403, { message: 'Forbidden' }, false)
    )

    await expect(
      uploadBackupToDrive(makeBlob('{}'), 'backup.json')
    ).rejects.toThrow(DrivePermissionError)
  })

  it('retries on network failure with backoff', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')

    // Network error on first call, success on second
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        makeDriveResponse(200, {
          id: 'file-789',
          webViewLink: 'https://drive.google.com/file/d/file-789/view',
        })
      )

    const result = await uploadBackupToDrive(makeBlob('{}'), 'backup.json')

    expect(result).toEqual({
      fileId: 'file-789',
      webViewLink: 'https://drive.google.com/file/d/file-789/view',
    })

    // Should have called fetch twice
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws DriveNetworkError after both network attempts fail', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      uploadBackupToDrive(makeBlob('{}'), 'backup.json')
    ).rejects.toThrow(DriveNetworkError)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('passes AbortSignal to fetch', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue(
      makeDriveResponse(200, {
        id: 'file-abc',
        webViewLink: 'https://drive.google.com/file/d/file-abc/view',
      })
    )

    const controller = new AbortController()
    await uploadBackupToDrive(makeBlob('{}'), 'backup.json', controller.signal)

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
  })

  it('builds a proper multipart body with the filename', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue(
      makeDriveResponse(200, {
        id: 'file-xyz',
        webViewLink: 'https://drive.google.com/file/d/file-xyz/view',
      })
    )

    await uploadBackupToDrive(makeBlob('{"hello":"world"}'), 'my-backup.knowlune.json')

    const body = fetchMock.mock.calls[0][1].body as string
    // Metadata part should contain the name
    expect(body).toContain('"my-backup.knowlune.json"')
    // Content part should contain the blob data
    expect(body).toContain('{"hello":"world"}')
    // Boundary markers
    expect(body).toContain('-------knowlune-backup-boundary')
    // Should end with the boundary terminator
    expect(body.trim()).toContain('-------knowlune-backup-boundary--')
  })
})
