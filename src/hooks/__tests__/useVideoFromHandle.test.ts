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

let createObjectURLSpy: ReturnType<typeof vi.spyOn>
let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
let createCallCount: number

beforeEach(() => {
  createCallCount = 0
  createObjectURLSpy = vi
    .spyOn(URL, 'createObjectURL')
    .mockImplementation(() => `blob:mock-url-${++createCallCount}`)
  revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
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

  it('returns loading state when handle is undefined (not yet available)', () => {
    const { result } = renderHook(() => useVideoFromHandle(undefined))
    expect(result.current.error).toBeNull()
    expect(result.current.blobUrl).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('does not set file-not-found error when transitioning from undefined to valid handle', async () => {
    const handle = makeHandle()
    const { result, rerender } = renderHook(
      ({ h }: { h: FileSystemFileHandle | null | undefined }) => useVideoFromHandle(h),
      { initialProps: { h: undefined as FileSystemFileHandle | null | undefined } }
    )

    // Phase 1: undefined handle
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.blobUrl).toBeNull()

    // Phase 2: transition to valid handle — error must never be 'file-not-found'
    rerender({ h: handle })

    // Immediately after rerender, the sync part of load() sets error to null,
    // so 'file-not-found' should never appear at any observable state
    expect(result.current.error).not.toBe('file-not-found')

    // Phase 3: final success state
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.blobUrl).toBe('blob:mock-url-1')
  })

  it('creates blob URL when permission is already granted', async () => {
    const handle = makeHandle()
    const { result } = renderHook(() => useVideoFromHandle(handle))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.blobUrl).toBe('blob:mock-url-1')
    expect(result.current.error).toBeNull()
    expect(createObjectURLSpy).toHaveBeenCalledOnce()
  })

  it('requests permission when not yet granted and succeeds', async () => {
    const handle = makeHandle({
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
    const { result } = renderHook(() => useVideoFromHandle(handle))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' })
    expect(result.current.blobUrl).toBe('blob:mock-url-1')
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
    expect(createObjectURLSpy).not.toHaveBeenCalled()
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

    await waitFor(() => expect(result.current.blobUrl).toBe('blob:mock-url-1'))

    unmount()

    // Revocation is deferred to a macrotask (setTimeout 0) so it only fires
    // on genuine unmount, not on useEffect dependency-change re-runs.
    await new Promise(r => setTimeout(r, 10))

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url-1')
  })

  it('revokes previous blob URL when handle changes', async () => {
    const handle1 = makeHandle()
    const handle2 = makeHandle()

    const { result, rerender } = renderHook(
      ({ h }: { h: FileSystemFileHandle }) => useVideoFromHandle(h),
      { initialProps: { h: handle1 } }
    )

    await waitFor(() => expect(result.current.blobUrl).toBe('blob:mock-url-1'))

    rerender({ h: handle2 })

    await waitFor(() => expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url-1'))
  })

  it('regenerates blob URL when retryKey changes', async () => {
    const handle = makeHandle()
    type TestProps = { h: FileSystemFileHandle; rk?: number }
    const { result, rerender } = renderHook<ReturnType<typeof useVideoFromHandle>, TestProps>(
      ({ h, rk }) => useVideoFromHandle(h, rk),
      { initialProps: { h: handle } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.blobUrl).toBe('blob:mock-url-1')

    // Increment retryKey — should revoke old blob URL and create a new one
    createObjectURLSpy.mockClear()
    rerender({ h: handle, rk: 1 })

    await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1))
    expect(result.current.blobUrl).toBe('blob:mock-url-2')
  })

  it('revokes previous blob URL via helper when transitioning from valid to undefined', async () => {
    const handle = makeHandle()
    const { result, rerender } = renderHook(
      ({ h }: { h: FileSystemFileHandle | null | undefined }) => useVideoFromHandle(h),
      { initialProps: { h: handle as FileSystemFileHandle | null | undefined } }
    )

    await waitFor(() => expect(result.current.blobUrl).toBe('blob:mock-url-1'))

    rerender({ h: undefined })

    // The undefined branch calls revokePreviousBlobUrl(prev) synchronously
    // inside the setState updater, which must revoke the old blob URL.
    await waitFor(() => expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url-1'))
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.blobUrl).toBeNull()
  })

  it('revokes previous blob URL via helper when transitioning from valid to null', async () => {
    const handle = makeHandle()
    const { result, rerender } = renderHook(
      ({ h }: { h: FileSystemFileHandle | null | undefined }) => useVideoFromHandle(h),
      { initialProps: { h: handle as FileSystemFileHandle | null | undefined } }
    )

    await waitFor(() => expect(result.current.blobUrl).toBe('blob:mock-url-1'))

    rerender({ h: null })

    // The null branch calls revokePreviousBlobUrl(prev) synchronously
    // inside the setState updater, which must revoke the old blob URL.
    await waitFor(() => expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url-1'))
    expect(result.current.error).toBe('file-not-found')
    expect(result.current.loading).toBe(false)
    expect(result.current.blobUrl).toBeNull()
  })
})
