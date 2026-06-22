/**
 * Tests for driveFileAccessService.
 *
 * Covers cache hit, cache miss + online streaming, offline error,
 * and 401 token refresh scenarios.
 *
 * @see E77b-S03
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  resolveFileUrl,
  clearDriveCache,
  DriveFileOfflineError,
  DriveFileNotFoundError,
} from '@/lib/driveFileAccessService'
import * as googleDriveToken from '@/lib/googleDriveToken'
import * as googleDriveFileService from '@/lib/googleDriveFileService'

// ── Mocks ───────────────────────────────────────────────────────

const mockFileId = 'drive-file-id-123'
const mockDriveUrl = 'https://www.googleapis.com/drive/v3/files/drive-file-id-123?alt=media'

// OPFS mock: /knowlune/drive-cache/{fileId}
const mockCacheDir = new Map<string, Blob>()

function setupOpfsMock(): void {
  const fileHandleMock = {
    getFile: vi.fn().mockImplementation(async () => {
      const blob = mockCacheDir.get(mockFileId)
      if (!blob) throw new DOMException('File not found', 'NotFoundError')
      return new File([blob], mockFileId)
    }),
    createWritable: vi.fn().mockImplementation(async () => {
      const chunks: BlobPart[] = []
      return {
        write: vi.fn().mockImplementation(async (chunk: BlobPart) => {
          chunks.push(chunk)
        }),
        close: vi.fn().mockImplementation(async () => {
          const blob = new Blob(chunks)
          mockCacheDir.set(mockFileId, blob)
        }),
      }
    }),
  }

  const cacheDirHandle = {
    getFileHandle: vi
      .fn()
      .mockImplementation(async (_name: string, _options?: { create?: boolean }) => {
        return fileHandleMock
      }),
    removeEntry: vi.fn().mockImplementation(async (_name: string) => {
      mockCacheDir.delete(_name)
    }),
  }

  const knowluneDirHandle = {
    getDirectoryHandle: vi
      .fn()
      .mockImplementation(async (_name: string, _options?: { create?: boolean }) => {
        if (_name === 'drive-cache') return cacheDirHandle
        throw new DOMException('Not found', 'NotFoundError')
      }),
    removeEntry: vi.fn().mockImplementation(async (_name: string) => {
      if (_name === 'drive-cache') {
        mockCacheDir.clear()
      }
    }),
  }

  const rootDirHandle = {
    getDirectoryHandle: vi
      .fn()
      .mockImplementation(async (_name: string, _options?: { create?: boolean }) => {
        return knowluneDirHandle
      }),
  }

  const getDirectoryMock = vi.fn().mockResolvedValue(rootDirHandle)

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      storage: {
        getDirectory: getDirectoryMock,
      },
      onLine: true,
    },
    writable: true,
    configurable: true,
  })
}

function mockGetDriveToken(token: string | null): void {
  vi.spyOn(googleDriveToken, 'getDriveToken').mockResolvedValue(token)
}

function mockRefreshDriveToken(token: string | null): void {
  vi.spyOn(googleDriveToken, 'refreshDriveToken').mockResolvedValue(token)
}

function mockBuildStreamUrl(): void {
  vi.spyOn(googleDriveFileService, 'buildStreamUrl').mockImplementation(
    (fileId: string) => `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  )
}

// ── Setup / Teardown ───────────────────────────────────────────

beforeEach(() => {
  mockCacheDir.clear()
  vi.clearAllMocks()
  mockBuildStreamUrl()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────

describe('resolveFileUrl', () => {
  describe('cache hit', () => {
    it('returns a blob URL when the file is cached in OPFS', async () => {
      // Arrange: seed the cache with a mock video blob
      const videoData = new Blob(['mock-video-content'], { type: 'video/mp4' })
      mockCacheDir.set(mockFileId, videoData)
      setupOpfsMock()

      // Act
      const url = await resolveFileUrl(mockFileId)

      // Assert
      expect(url).toBeTruthy()
      expect(url).toMatch(/^blob:/)
      URL.revokeObjectURL(url)
    })
  })

  describe('cache miss + online', () => {
    it('fetches from Drive, caches to OPFS, and returns a blob URL', async () => {
      // Arrange: empty cache, online, valid token
      setupOpfsMock()
      mockGetDriveToken('valid-token-123')
      mockRefreshDriveToken('refreshed-token-456')

      const videoContent = 'streamed-video-content'
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(videoContent, {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        })
      )

      // First call: fetches from Drive, returns blob URL
      const url = await resolveFileUrl(mockFileId)
      expect(url).toBeTruthy()
      expect(url).toMatch(/^blob:/)

      // Verify the fetch was called with the correct Drive URL and auth header
      expect(fetch).toHaveBeenCalledWith(
        mockDriveUrl,
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token-123' },
        })
      )

      URL.revokeObjectURL(url)

      // Wait for background cache write to complete, then verify cache
      await vi.waitFor(() => {
        const cachedBlob = mockCacheDir.get(mockFileId)
        expect(cachedBlob).toBeTruthy()
        // Verify it's a real Blob with content
        expect(cachedBlob!.size).toBeGreaterThan(0)
      })

      // Second call: returns from cache without re-fetching
      fetchMock.mockClear()
      const cachedUrl = await resolveFileUrl(mockFileId)
      expect(cachedUrl).toMatch(/^blob:/)
      expect(fetchMock).not.toHaveBeenCalled()
      URL.revokeObjectURL(cachedUrl)
    })

    it('refreshes token on 401 and retries the fetch', async () => {
      // Arrange
      setupOpfsMock()
      mockGetDriveToken('expired-token')
      mockRefreshDriveToken('fresh-token-789')

      const fetchMock = vi.spyOn(globalThis, 'fetch')
      // First call returns 401
      fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      // Second call succeeds with refreshed token
      fetchMock.mockResolvedValueOnce(
        new Response('video-content-after-refresh', {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        })
      )

      // Act
      const url = await resolveFileUrl(mockFileId)

      // Assert
      expect(url).toMatch(/^blob:/)

      // Verify refreshDriveToken was called
      expect(googleDriveToken.refreshDriveToken).toHaveBeenCalledOnce()

      // Verify the retried fetch used the refreshed token
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        mockDriveUrl,
        expect.objectContaining({
          headers: { Authorization: 'Bearer fresh-token-789' },
        })
      )

      URL.revokeObjectURL(url)
    })

    it('returns a blob URL even if the OPFS cache write fails (non-fatal)', async () => {
      // Arrange: empty cache, online, valid token
      setupOpfsMock()
      mockGetDriveToken('valid-token')

      const videoContent = 'streaming-content'
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(videoContent, {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        })
      )

      // Make getDirectory fail on the second call (during writeToOpfsCache)
      // First call is for getFromOpfsCache (cache check); second is for the
      // background OPFS write — if that fails, the blob URL is still returned.
      // Use direct assignment (not vi.spyOn) to avoid wrapping a vi.fn()
      // in another spy, which causes infinite recursion in vitest internals.
      let getDirCallCount = 0
      const originalGetDir = navigator.storage.getDirectory
      navigator.storage.getDirectory = async () => {
        getDirCallCount++
        if (getDirCallCount === 2) {
          throw new Error('Simulated OPFS write failure')
        }
        return originalGetDir()
      }

      // Act
      const url = await resolveFileUrl(mockFileId)

      // Assert: blob URL is returned despite cache write failure
      expect(url).toMatch(/^blob:/)

      // Verify the cache was NOT populated (write failed)
      await vi.waitFor(() => {
        expect(mockCacheDir.has(mockFileId)).toBe(false)
      })

      URL.revokeObjectURL(url)
    })

    it('handles 404 from Drive by throwing DriveFileNotFoundError', async () => {
      // Arrange
      setupOpfsMock()
      mockGetDriveToken('valid-token')

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      )

      // Act & Assert
      await expect(resolveFileUrl(mockFileId)).rejects.toThrow(DriveFileNotFoundError)
    })
  })

  describe('cache miss + offline', () => {
    it('throws DriveFileOfflineError when offline and not cached', async () => {
      // Arrange: empty cache, offline
      setupOpfsMock()
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      // Build stream URL mock is already set in beforeEach
      mockGetDriveToken('valid-token')

      // Act & Assert
      await expect(resolveFileUrl(mockFileId)).rejects.toThrow(DriveFileOfflineError)
    })
  })

  describe('missing token', () => {
    it('throws DriveFileNotFoundError when no Drive token is available', async () => {
      // Arrange: empty cache, online, no token
      setupOpfsMock()
      mockGetDriveToken(null)

      // Act & Assert
      await expect(resolveFileUrl(mockFileId)).rejects.toThrow(DriveFileNotFoundError)
    })
  })

  describe('network error', () => {
    it('throws a generic error on non-OK Drive response', async () => {
      // Arrange
      setupOpfsMock()
      mockGetDriveToken('valid-token')

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Server Error', { status: 500 })
      )

      // Act & Assert
      await expect(resolveFileUrl(mockFileId)).rejects.toThrow(/^Drive download failed: 500/)
    })

    it('throws a generic error when buildStreamUrl returns null', async () => {
      // Arrange
      vi.spyOn(googleDriveFileService, 'buildStreamUrl').mockReturnValue(null)
      setupOpfsMock()
      mockGetDriveToken('valid-token')

      // Act & Assert
      await expect(resolveFileUrl('')).rejects.toThrow(
        'Could not build download URL for Drive file'
      )
    })
  })
})

describe('clearDriveCache', () => {
  it('removes a specific file from the OPFS cache', async () => {
    // Arrange: seed cache with a file
    const videoData = new Blob(['cached-content'])
    mockCacheDir.set(mockFileId, videoData)
    setupOpfsMock()

    // Verify it's cached
    const url = await resolveFileUrl(mockFileId)
    expect(url).toMatch(/^blob:/)
    URL.revokeObjectURL(url)

    // Act: clear cache for this file
    await clearDriveCache(mockFileId)

    // Assert: cache is empty — another resolve should fail (offline)
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    await expect(resolveFileUrl(mockFileId)).rejects.toThrow(DriveFileOfflineError)
  })

  it('clears all cached files when called without a fileId (bulk clear)', async () => {
    // Arrange: seed cache
    const videoData = new Blob(['cached-content'])
    mockCacheDir.set(mockFileId, videoData)
    setupOpfsMock()

    // Verify it's cached
    const url = await resolveFileUrl(mockFileId)
    expect(url).toMatch(/^blob:/)
    URL.revokeObjectURL(url)

    // Act: bulk clear (no fileId)
    await clearDriveCache()

    // Assert: cache is empty — resolving while offline should fail
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    await expect(resolveFileUrl(mockFileId)).rejects.toThrow(DriveFileOfflineError)
  })
})

/**
 * Hook-level tests for useDriveFileUrl are intentionally omitted.
 *
 * The hook is a thin React wrapper around resolveFileUrl — the core
 * resolution logic, error handling, and edge cases are all exercised
 * by the service-layer tests above. Hook-specific concerns (effect
 * lifecycle, cancellation-in-flight, retryKey re-resolution) would
 * require React Testing Library with a renderHook setup.
 *
 * @see E77b-S03 for future work if hook-level tests become necessary.
 */
