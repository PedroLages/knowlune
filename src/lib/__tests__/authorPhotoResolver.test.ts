import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolvePhotoHandle, revokePhotoUrl, clearPhotoCache } from '../authorPhotoResolver'

describe('authorPhotoResolver', () => {
  beforeEach(() => {
    clearPhotoCache()
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:photo-url')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  describe('resolvePhotoHandle', () => {
    it('returns null when permission is not granted', async () => {
      const handle = {
        queryPermission: vi.fn(() => Promise.resolve('denied')),
        getFile: vi.fn(),
      } as unknown as FileSystemFileHandle

      const result = await resolvePhotoHandle(handle)
      expect(result).toBeNull()
    })

    it('returns object URL when permission is granted', async () => {
      const handle = {
        queryPermission: vi.fn(() => Promise.resolve('granted')),
        getFile: vi.fn(() => Promise.resolve(new Blob())),
      } as unknown as FileSystemFileHandle

      const result = await resolvePhotoHandle(handle)
      expect(result).toBe('blob:photo-url')
    })

    it('returns cached URL on second call', async () => {
      const handle = {
        queryPermission: vi.fn(() => Promise.resolve('granted')),
        getFile: vi.fn(() => Promise.resolve(new Blob())),
      } as unknown as FileSystemFileHandle

      await resolvePhotoHandle(handle)
      const result = await resolvePhotoHandle(handle)
      expect(result).toBe('blob:photo-url')
      expect(handle.getFile).toHaveBeenCalledTimes(1) // cached
    })

    it('returns null on error', async () => {
      const handle = {
        queryPermission: vi.fn(() => Promise.reject(new Error('Not found'))),
      } as unknown as FileSystemFileHandle

      const result = await resolvePhotoHandle(handle)
      expect(result).toBeNull()
    })
  })

  describe('revokePhotoUrl', () => {
    it('revokes URL and clears cache for handle', async () => {
      const handle = {
        queryPermission: vi.fn(() => Promise.resolve('granted')),
        getFile: vi.fn(() => Promise.resolve(new Blob())),
      } as unknown as FileSystemFileHandle

      await resolvePhotoHandle(handle)
      revokePhotoUrl(handle)

      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-url')
    })

    it('is a no-op for unknown handles', () => {
      const handle = {} as FileSystemFileHandle
      revokePhotoUrl(handle) // should not throw
      expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('clearPhotoCache', () => {
    it('revokes all cached URLs', async () => {
      const handle = {
        queryPermission: vi.fn(() => Promise.resolve('granted')),
        getFile: vi.fn(() => Promise.resolve(new Blob())),
      } as unknown as FileSystemFileHandle

      await resolvePhotoHandle(handle)
      clearPhotoCache()

      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-url')
    })
  })
})
