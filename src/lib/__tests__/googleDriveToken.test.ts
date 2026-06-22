import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockRefreshSession = vi.fn()
const mockSignInWithOAuth = vi.fn()

const { mockUseAuthStoreGetState, mockSupabaseValue } = vi.hoisted(() => {
  const mockGetState = vi.fn()
  // Makes the supabase export dynamic — can be set to null per test
  const mockSupabase = vi.fn(() => ({
    auth: { refreshSession: vi.fn(), signInWithOAuth: vi.fn() },
  }))
  return {
    mockUseAuthStoreGetState: mockGetState,
    mockSupabaseValue: mockSupabase,
  }
})

// Dynamic mock: vi.mock is hoisted, but the getter defers to mockSupabaseValue
vi.mock('@/lib/auth/supabase', () => ({
  get supabase() {
    return mockSupabaseValue()
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: () => mockUseAuthStoreGetState(),
  },
}))

import { getDriveToken, refreshDriveToken, hasDriveReadScope, requestDriveReadScope, clearDriveReadFlag } from '@/lib/googleDriveToken'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // Default: supabase is configured
  mockSupabaseValue.mockReturnValue({
    auth: { refreshSession: mockRefreshSession, signInWithOAuth: mockSignInWithOAuth },
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getDriveToken', () => {
  it('returns null when supabase is not configured', async () => {
    mockSupabaseValue.mockReturnValue(null as never)
    const result = await getDriveToken()
    expect(result).toBeNull()
  })

  it('returns null when no session exists', async () => {
    mockUseAuthStoreGetState.mockReturnValue({ session: null })
    const result = await getDriveToken()
    expect(result).toBeNull()
  })

  it('returns provider_token when session has one', async () => {
    mockUseAuthStoreGetState.mockReturnValue({
      session: { provider_token: 'google-token-123' },
    })
    const result = await getDriveToken()
    expect(result).toBe('google-token-123')
    expect(mockRefreshSession).not.toHaveBeenCalled()
  })

  it('returns null when session has no provider_token and refresh also lacks one', async () => {
    mockUseAuthStoreGetState.mockReturnValue({
      session: { provider_token: null },
    })
    mockRefreshSession.mockResolvedValue({
      data: { session: { provider_token: null } },
      error: null,
    })

    const result = await getDriveToken()
    expect(result).toBeNull()
    expect(mockRefreshSession).toHaveBeenCalledTimes(1)
  })

  it('returns null when session has no provider_token and refresh has error', async () => {
    mockUseAuthStoreGetState.mockReturnValue({
      session: { provider_token: null },
    })
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Not authenticated' },
    })

    const result = await getDriveToken()
    expect(result).toBeNull()
    expect(mockRefreshSession).toHaveBeenCalledTimes(1)
  })

  it('returns provider_token after refresh succeeds', async () => {
    mockUseAuthStoreGetState.mockReturnValue({
      session: { provider_token: null },
    })
    mockRefreshSession.mockResolvedValue({
      data: { session: { provider_token: 'refreshed-token' } },
      error: null,
    })

    const result = await getDriveToken()
    expect(result).toBe('refreshed-token')
    expect(mockRefreshSession).toHaveBeenCalledTimes(1)
  })
})

describe('refreshDriveToken', () => {
  it('returns null when supabase is not configured', async () => {
    mockSupabaseValue.mockReturnValue(null as never)
    const result = await refreshDriveToken()
    expect(result).toBeNull()
  })

  it('returns provider_token after successful refresh', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { provider_token: 'fresh-token' } },
      error: null,
    })

    const result = await refreshDriveToken()
    expect(result).toBe('fresh-token')
    expect(mockRefreshSession).toHaveBeenCalledTimes(1)
  })

  it('returns null when refresh error occurs', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Refresh failed' },
    })

    const result = await refreshDriveToken()
    expect(result).toBeNull()
  })

  it('returns null when refreshed session has no provider_token', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { provider_token: null } },
      error: null,
    })

    const result = await refreshDriveToken()
    expect(result).toBeNull()
  })
})

describe('requestDriveReadScope', () => {
  it('calls signInWithOAuth with drive.readonly scope', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null })

    await requestDriveReadScope()

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes:
          'email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  })

  it('does nothing when supabase is not configured', async () => {
    mockSupabaseValue.mockReturnValue(null as never)
    await requestDriveReadScope()
    expect(mockSignInWithOAuth).not.toHaveBeenCalled()
  })
})

describe('hasDriveReadScope', () => {
  it('returns false when no token is available', async () => {
    mockUseAuthStoreGetState.mockReturnValue({
      session: { provider_token: null },
    })
    mockRefreshSession.mockResolvedValue({
      data: { session: { provider_token: null } },
      error: null,
    })

    const result = await hasDriveReadScope()
    expect(result).toBe(false)
  })

  it('returns true when localStorage flag is set and token exists', async () => {
    localStorage.setItem('knowlune_drive_read_granted', 'true')
    mockUseAuthStoreGetState.mockReturnValue({
      session: { provider_token: 'valid-token' },
    })

    const result = await hasDriveReadScope()
    expect(result).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns true after successful API verification', async () => {
    mockUseAuthStoreGetState.mockReturnValue({
      session: { provider_token: 'valid-token' },
    })
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { displayName: 'Test' } }),
      headers: new Headers(),
      redirected: false,
      statusText: 'OK',
      type: 'basic' as ResponseType,
      url: '',
      clone: () => new Response(),
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      text: () => Promise.resolve(''),
    } as unknown as Response)

    const result = await hasDriveReadScope()
    expect(result).toBe(true)
    expect(localStorage.getItem('knowlune_drive_read_granted')).toBe('true')
  })

  it('returns false when API returns 403', async () => {
    mockUseAuthStoreGetState.mockReturnValue({
      session: { provider_token: 'limited-token' },
    })
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { message: 'Insufficient scopes' } }),
      headers: new Headers(),
      redirected: false,
      statusText: 'Forbidden',
      type: 'basic' as ResponseType,
      url: '',
      clone: () => new Response(),
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      text: () => Promise.resolve(''),
    } as unknown as Response)

    const result = await hasDriveReadScope()
    expect(result).toBe(false)
    expect(localStorage.getItem('knowlune_drive_read_granted')).toBeNull()
  })

  it('returns false on network error', async () => {
    mockUseAuthStoreGetState.mockReturnValue({
      session: { provider_token: 'valid-token' },
    })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await hasDriveReadScope()
    expect(result).toBe(false)
  })
})

describe('clearDriveReadFlag', () => {
  it('removes the drive read granted flag from localStorage', () => {
    localStorage.setItem('knowlune_drive_read_granted', 'true')
    expect(localStorage.getItem('knowlune_drive_read_granted')).toBe('true')

    clearDriveReadFlag()
    expect(localStorage.getItem('knowlune_drive_read_granted')).toBeNull()
  })
})
