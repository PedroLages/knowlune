import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRefreshSession = vi.fn()

const { mockUseAuthStoreGetState, mockSupabaseValue } = vi.hoisted(() => {
  const mockGetState = vi.fn()
  // Makes the supabase export dynamic — can be set to null per test
  const mockSupabase = vi.fn(() => ({
    auth: { refreshSession: vi.fn() },
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

import { getDriveToken, refreshDriveToken } from '@/lib/googleDriveToken'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: supabase is configured
  mockSupabaseValue.mockReturnValue({
    auth: { refreshSession: mockRefreshSession },
  })
})

describe('getDriveToken', () => {
  it('returns null when supabase is not configured', async () => {
    mockSupabaseValue.mockReturnValue(null)
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
    mockSupabaseValue.mockReturnValue(null)
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
