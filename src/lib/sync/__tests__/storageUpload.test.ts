/**
 * storageUpload.test.ts — Unit tests for uploadBlob.
 *
 * All Supabase storage calls are mocked; no network I/O.
 *
 * @module storageUpload.test
 * @since E94-S04
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock factories — must use vi.hoisted() so they're available inside
// vi.mock() factories (which are hoisted before imports).
// ---------------------------------------------------------------------------

const { mockUpload, mockGetPublicUrl, mockStorageFrom } = vi.hoisted(() => {
  const mockUpload = vi.fn().mockResolvedValue({ error: null })
  const mockGetPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: 'https://cdn.supabase.co/storage/v1/object/public/bucket/path' },
  })
  const mockStorageFrom = vi.fn().mockReturnValue({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  })
  return { mockUpload, mockGetPublicUrl, mockStorageFrom }
})

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    storage: { from: mockStorageFrom },
  },
}))

import { uploadBlob } from '../storageUpload'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlob(sizeBytes: number, type = 'image/jpeg'): Blob {
  return new Blob([new Uint8Array(sizeBytes)], { type })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('uploadBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.supabase.co/storage/v1/object/public/course-thumbnails/user1/course1/thumbnail.jpg' },
    })
    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    })
  })

  it('happy path: blob under size limit calls storage.from with correct bucket', async () => {
    const blob = makeBlob(100)
    await uploadBlob('course-thumbnails', 'user1/course1/thumbnail.jpg', blob, {
      maxSizeBytes: 500_000,
    })
    expect(mockStorageFrom).toHaveBeenCalledWith('course-thumbnails')
  })

  it('happy path: upload called with upsert:true', async () => {
    const blob = makeBlob(100)
    await uploadBlob('course-thumbnails', 'user1/course1/thumbnail.jpg', blob, {
      maxSizeBytes: 500_000,
    })
    expect(mockUpload).toHaveBeenCalledWith(
      'user1/course1/thumbnail.jpg',
      blob,
      expect.objectContaining({ upsert: true }),
    )
  })

  it('happy path: returns {url, path} from getPublicUrl', async () => {
    const blob = makeBlob(100)
    const result = await uploadBlob('course-thumbnails', 'user1/course1/thumbnail.jpg', blob, {
      maxSizeBytes: 500_000,
    })
    expect(result).toEqual({
      url: 'https://cdn.supabase.co/storage/v1/object/public/course-thumbnails/user1/course1/thumbnail.jpg',
      path: 'user1/course1/thumbnail.jpg',
    })
  })

  it('edge case: blob.size exactly equal to maxSizeBytes proceeds (boundary is exclusive: > not >=)', async () => {
    const blob = makeBlob(500_000)
    await expect(
      uploadBlob('course-thumbnails', 'user1/course1/thumbnail.jpg', blob, {
        maxSizeBytes: 500_000,
      }),
    ).resolves.toBeDefined()
    expect(mockUpload).toHaveBeenCalled()
  })

  it('error path: blob.size exceeds maxSizeBytes throws RangeError before upload call', async () => {
    const blob = makeBlob(500_001)
    await expect(
      uploadBlob('course-thumbnails', 'user1/course1/thumbnail.jpg', blob, {
        maxSizeBytes: 500_000,
      }),
    ).rejects.toThrow(RangeError)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('error path: blob.size exceeds maxSizeBytes — storage.from is never called', async () => {
    const blob = makeBlob(1_000_001)
    await expect(
      uploadBlob('avatars', 'user1/author1/photo.jpg', blob, { maxSizeBytes: 1_000_000 }),
    ).rejects.toThrow()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('error path: Supabase upload returns error object → throws', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'storage quota exceeded' } })
    const blob = makeBlob(100)
    await expect(
      uploadBlob('course-thumbnails', 'user1/course1/thumbnail.jpg', blob),
    ).rejects.toThrow('storage quota exceeded')
  })

  it('happy path: no maxSizeBytes option — upload proceeds for any blob size', async () => {
    const blob = makeBlob(1000)
    await expect(uploadBlob('book-files', 'user1/book1/book.epub', blob)).resolves.toBeDefined()
    expect(mockUpload).toHaveBeenCalled()
  })
})
