import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useVideoFromHandle } from '../useVideoFromHandle'

function makeHandle(overrides: Partial<FileSystemFileHandle> = {}): FileSystemFileHandle {
  return {
    kind: 'file',
    name: 'test-video.mp4',
    queryPermission: vi.fn().mockResolvedValue('granted'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    getFile: vi.fn().mockResolvedValue(new File([''], 'test-video.mp4', { type: 'video/mp4' })),
    isSameEntry: vi.fn(),
    ...overrides,
  } as unknown as FileSystemFileHandle
}

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useVideoFromHandle', () => {
  it('returns error when handle is null', () => {
    const { result } = renderHook(() => useVideoFromHandle(null))
    expect(result.current.error).toBe('file-not-found')
    expect(result.current.blobUrl).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('returns error when handle is undefined', () => {
    const { result } = renderHook(() => useVideoFromHandle(undefined))
    expect(result.current.error).toBe('file-not-found')
    expect(result.current.blobUrl).toBeNull()
  })

  it('creates blob URL when permission is already granted', async () => {
    const handle = makeHandle()
    const { result } = renderHook(() => useVideoFromHandle(handle))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.blobUrl).toBe('blob:mock-url')
    expect(result.current.error).toBeNull()
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
  })

  it('requests permission when not yet granted and succeeds', async () => {
    const handle = makeHandle({
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
    const { result } = renderHook(() => useVideoFromHandle(handle))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' })
    expect(result.current.blobUrl).toBe('blob:mock-url')
    expect(result.current.error).toBeNull()
  })

  it('returns permission-denied error when user denies request', async () => {
    const handle = makeHandle({
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    })
    const { result } = renderHook(() => useVideoFromHandle(handle))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('permission-denied')
    expect(result.current.blobUrl).toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('returns file-not-found error when getFile throws', async () => {
    const handle = makeHandle({
      getFile: vi.fn().mockRejectedValue(new DOMException('File not found', 'NotFoundError')),
    })
    const { result } = renderHook(() => useVideoFromHandle(handle))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('file-not-found')
    expect(result.current.blobUrl).toBeNull()
  })

  it('revokes blob URL on unmount (AC-6 cleanup)', async () => {
    const handle = makeHandle()
    const { result, unmount } = renderHook(() => useVideoFromHandle(handle))

    await waitFor(() => expect(result.current.blobUrl).toBe('blob:mock-url'))

    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('revokes previous blob URL when handle changes', async () => {
    const handle1 = makeHandle()
    const handle2 = makeHandle()

    const { result, rerender } = renderHook(
      ({ h }: { h: FileSystemFileHandle }) => useVideoFromHandle(h),
      { initialProps: { h: handle1 } }
    )

    await waitFor(() => expect(result.current.blobUrl).toBe('blob:mock-url'))

    rerender({ h: handle2 })

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'))
  })
})
