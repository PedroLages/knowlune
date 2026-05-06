/**
 * pathCoverUpload.test.ts — Supabase storage path + auth for learning path covers.
 *
 * Image decode/resize is exercised with minimal DOM mocks; no network I/O.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { PATH_ID, USER_ID, mockGetUser, mockUpload, mockRemove, mockGetPublicUrl, mockStorageFrom } =
  vi.hoisted(() => {
    const uid = 'user-uuid-1'
    const pid = 'path-abc'
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: uid } },
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
      mockUpload,
      mockRemove,
      mockGetPublicUrl,
      mockStorageFrom,
    }
  })

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
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
        expect.objectContaining({ contentType: 'image/jpeg', upsert: true })
      )
      expect(url).toContain(`${USER_ID}/${PATH_ID}.jpg`)
    })

    it('rejects when user is not authenticated', async () => {
      stubImageAndCanvas()
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no session') })

      const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/Authentication required/)
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('rejects unsupported image types before upload', async () => {
      const file = new File([new Uint8Array([1])], 'doc.pdf', { type: 'application/pdf' })
      await expect(uploadPathCover(file, PATH_ID)).rejects.toThrow(/Unsupported image format/)
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
