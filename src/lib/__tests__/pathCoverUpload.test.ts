/**
 * pathCoverUpload.test.ts — Supabase storage path + auth for learning path covers.
 *
 * Image decode/resize is exercised with minimal DOM mocks; no network I/O.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { PATH_ID, USER_ID, mockGetUser, mockGetSession, mockRefreshSession, mockUpload, mockRemove, mockGetPublicUrl, mockStorageFrom } =
  vi.hoisted(() => {
    const uid = 'user-uuid-1'
    const pid = 'path-abc'
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: uid } },
      error: null,
    })
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'valid-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    })
    const mockRefreshSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'refreshed-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    })
    const mockUpload = vi.fn().mockResolvedValue({ error: null })
    const mockRemove = vi.fn().mockResolvedValue({ error: null })
    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: {
        publicUrl: `https://example.supabase.co/storage/v1/object/public/learning-path-covers/${uid}/${pid}.jpg`,
      },
    })
    const mockStorageFrom = vi.fn().mockReturnValue({
      upload: mockUpload,
      remove: mockRemove,
      getPublicUrl: mockGetPublicUrl,
    })
    return {
      PATH_ID: pid,
      USER_ID: uid,
      mockGetUser,
      mockGetSession,
      mockRefreshSession,
      mockUpload,
      mockRemove,
      mockGetPublicUrl,
      mockStorageFrom,
    }
  })

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser, getSession: mockGetSession, refreshSession: mockRefreshSession },
    storage: { from: mockStorageFrom },
  },
}))

import { uploadPathCover, deletePathCover } from '@/lib/pathCoverUpload'

function stubImageAndCanvas() {
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 1600
      height = 900
      set src(_v: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
  )

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    drawImage: vi.fn(),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  }) as unknown as CanvasRenderingContext2D)

  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: (blob: Blob | null) => void
  ) {
    callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }))
  })
}

describe('pathCoverUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'valid-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    })
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'refreshed-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    })
    mockUpload.mockResolvedValue({ error: null })
    mockRemove.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl: `https://example.supabase.co/storage/v1/object/public/learning-path-covers/${USER_ID}/${PATH_ID}.jpg`,
      },
    })
    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      remove: mockRemove,
      getPublicUrl: mockGetPublicUrl,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('uploadPathCover', () => {
    it('uploads to user-scoped key {userId}/{pathId}.jpg and returns public URL', async () => {
      stubImageAndCanvas()

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      const url = await uploadPathCover(file, PATH_ID)

      expect(mockGetUser).toHaveBeenCalled()
      expect(mockStorageFrom).toHaveBeenCalledWith('learning-path-covers')
      expect(mockUpload).toHaveBeenCalledWith(
        `${USER_ID}/${PATH_ID}.jpg`,
        expect.any(Blob),
        expect.objectContaining({ contentType: 'image/jpeg' })
      )
      // upsert should NOT be set — pure INSERT
      expect(mockUpload.mock.calls[0][2]).not.toHaveProperty('upsert')
      expect(url).toContain(`${USER_ID}/${PATH_ID}.jpg`)
    })

    it('handles 409 Conflict by deleting and retrying insert', async () => {
      stubImageAndCanvas()

      // First upload returns 409, second succeeds
      mockUpload
        .mockResolvedValueOnce({ error: { message: 'The resource already exists', statusCode: 409 } })
        .mockResolvedValueOnce({ error: null })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      const url = await uploadPathCover(file, PATH_ID)

      // First upload attempt (insert)
      expect(mockUpload).toHaveBeenCalledTimes(2)
      expect(mockUpload).toHaveBeenNthCalledWith(
        1,
        `${USER_ID}/${PATH_ID}.jpg`,
        expect.any(Blob),
        expect.objectContaining({ contentType: 'image/jpeg' })
      )
      // Remove called before retry
      expect(mockRemove).toHaveBeenCalledWith([`${USER_ID}/${PATH_ID}.jpg`])
      // Second upload attempt (re-insert)
      expect(mockUpload).toHaveBeenNthCalledWith(
        2,
        `${USER_ID}/${PATH_ID}.jpg`,
        expect.any(Blob),
        expect.objectContaining({ contentType: 'image/jpeg' })
      )
      expect(url).toContain(`${USER_ID}/${PATH_ID}.jpg`)
    })

    it('throws a user-friendly error when 409 retry remove fails', async () => {
      stubImageAndCanvas()

      mockUpload.mockResolvedValueOnce({ error: { message: 'The resource already exists', statusCode: 409 } })
      mockRemove.mockResolvedValueOnce({ error: { message: 'Remove permission denied', statusCode: 403 } })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow('Please try again')
    })

    it('rejects when user is not authenticated', async () => {
      stubImageAndCanvas()
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no session') })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/Sign in required to upload covers/)
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('rejects unsupported image types before upload', async () => {
      const file = new File([new Uint8Array([1])], 'doc.pdf', { type: 'application/pdf' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/Unsupported image format/)
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('maps 401 to authorized message about session expiry', async () => {
      stubImageAndCanvas()
      mockUpload.mockResolvedValueOnce({ error: { message: 'JWT expired', statusCode: 401 } })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/Session expired/)
    })

    it('maps 403 to forbidden message about server configuration', async () => {
      stubImageAndCanvas()
      mockUpload.mockResolvedValueOnce({ error: { message: 'insufficient permissions', statusCode: 403 } })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/server configuration issue/)
    })

    it('maps 404 to not-configured message', async () => {
      stubImageAndCanvas()
      mockUpload.mockResolvedValueOnce({ error: { message: 'bucket not found', statusCode: 404 } })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/Cover storage not configured/)
    })

    it('maps 413 to too-large message', async () => {
      stubImageAndCanvas()
      mockUpload.mockResolvedValueOnce({ error: { message: 'request too large', statusCode: 413 } })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/under 2 MB/)
    })

    it('throws AUTH_REQUIRED when getSession returns no session', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/Sign in required/)
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('refreshes session when token is near expiry', async () => {
      stubImageAndCanvas()
      // Session near expiry (within 30s)
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'expiring-token', expires_at: Math.floor(Date.now() / 1000) + 5 } },
        error: null,
      })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await uploadPathCover(file, PATH_ID)

      expect(mockRefreshSession).toHaveBeenCalled()
    })

    it('throws AUTH_REQUIRED when session refresh fails', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'expiring-token', expires_at: Math.floor(Date.now() / 1000) + 5 } },
        error: null,
      })
      mockRefreshSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('refresh failed') })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/Sign in required/)
      expect(mockUpload).not.toHaveBeenCalled()
    })
  })

  describe('deletePathCover', () => {
    it('removes object at {userId}/{pathId}.jpg', async () => {
      await deletePathCover(PATH_ID)

      expect(mockGetUser).toHaveBeenCalled()
      expect(mockStorageFrom).toHaveBeenCalledWith('learning-path-covers')
      expect(mockRemove).toHaveBeenCalledWith([`${USER_ID}/${PATH_ID}.jpg`])
    })

    it('swallows errors from remove (non-fatal)', async () => {
      mockRemove.mockResolvedValueOnce({ error: { message: 'not found' } })
      await expect(deletePathCover(PATH_ID)).resolves.toBeUndefined()
    })
  })
})
