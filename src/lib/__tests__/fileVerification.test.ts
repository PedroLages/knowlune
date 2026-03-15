import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyFileHandle } from '../fileVerification'

function createMockHandle(
  overrides: {
    queryPermission?: () => Promise<PermissionState>
    getFile?: () => Promise<File>
  } = {}
): FileSystemFileHandle {
  return {
    queryPermission:
      overrides.queryPermission ?? (() => Promise.resolve('granted' as PermissionState)),
    getFile: overrides.getFile ?? (() => Promise.resolve(new File([], 'test.mp4'))),
    kind: 'file',
    name: 'test.mp4',
    isSameEntry: vi.fn(),
    createWritable: vi.fn(),
    createSyncAccessHandle: vi.fn(),
  } as unknown as FileSystemFileHandle
}

describe('verifyFileHandle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns "missing" for null handle', async () => {
    expect(await verifyFileHandle(null)).toBe('missing')
  })

  it('returns "missing" for undefined handle', async () => {
    expect(await verifyFileHandle(undefined)).toBe('missing')
  })

  it('returns "available" when permission granted and getFile succeeds', async () => {
    const handle = createMockHandle()
    expect(await verifyFileHandle(handle)).toBe('available')
  })

  it('returns "permission-denied" when queryPermission returns "denied"', async () => {
    const handle = createMockHandle({
      queryPermission: () => Promise.resolve('denied' as PermissionState),
    })
    expect(await verifyFileHandle(handle)).toBe('permission-denied')
  })

  it('returns "permission-denied" when queryPermission returns "prompt"', async () => {
    const handle = createMockHandle({
      queryPermission: () => Promise.resolve('prompt' as PermissionState),
    })
    expect(await verifyFileHandle(handle)).toBe('permission-denied')
  })

  it('returns "missing" and logs warning when getFile throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const handle = createMockHandle({
      getFile: () => Promise.reject(new DOMException('File not found', 'NotFoundError')),
    })

    expect(await verifyFileHandle(handle)).toBe('missing')
    expect(warnSpy).toHaveBeenCalledWith(
      'File handle verification failed:',
      expect.any(DOMException)
    )
  })

  it('returns "missing" and logs warning when queryPermission throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const handle = createMockHandle({
      queryPermission: () => Promise.reject(new Error('Permission check failed')),
    })

    expect(await verifyFileHandle(handle)).toBe('missing')
    expect(warnSpy).toHaveBeenCalledWith('File handle verification failed:', expect.any(Error))
  })
})
