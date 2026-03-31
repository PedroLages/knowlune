import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// Disable dev premium bypass so the real hook logic is exercised
vi.stubEnv('VITE_DEV_PREMIUM', 'false')

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

const mockSupabaseFrom = vi.fn()
const mockGet = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}))

vi.mock('@/db/schema', () => ({
  db: {
    entitlements: {
      get: (...args: unknown[]) => mockGet(...args),
      put: (...args: unknown[]) => mockPut(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

// Must use a factory that returns a real zustand store for hooks
const mockUser = { id: 'user-123' }
let storeState: { user: typeof mockUser | null; initialized: boolean } = {
  user: mockUser,
  initialized: true,
}

vi.mock('@/stores/useAuthStore', () => {
  const useAuthStore = (selector: (s: typeof storeState) => unknown) => selector(storeState)
  useAuthStore.getState = () => storeState
  return { useAuthStore }
})

vi.mock('@/lib/checkout', () => ({
  getCachedEntitlement: vi.fn(),
  cacheEntitlement: vi.fn(),
}))

import {
  useIsPremium,
  isCacheFresh,
  validateEntitlementOnServer,
  clearCachedEntitlement,
  ENTITLEMENT_CACHE_TTL_DAYS,
} from '@/lib/entitlement/isPremium'
import { getCachedEntitlement, cacheEntitlement } from '@/lib/checkout'
import type { CachedEntitlement } from '@/data/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetCachedEntitlement = getCachedEntitlement as ReturnType<typeof vi.fn>
const mockCacheEntitlement = cacheEntitlement as ReturnType<typeof vi.fn>

function makeCachedEntitlement(overrides: Partial<CachedEntitlement> = {}): CachedEntitlement {
  return {
    userId: 'user-123',
    tier: 'premium',
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
    planId: 'plan_monthly',
    expiresAt: '2026-04-25T00:00:00.000Z',
    cachedAt: new Date().toISOString(),
    ...overrides,
  }
}

function mockServerResponse(data: Record<string, unknown> | null, error: unknown = null) {
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  })
}

function mockServerError() {
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockRejectedValue(new Error('Network error')),
      }),
    }),
  })
}

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('ENTITLEMENT_CACHE_TTL_DAYS', () => {
  it('is 7 days', () => {
    expect(ENTITLEMENT_CACHE_TTL_DAYS).toBe(7)
  })
})

describe('isCacheFresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true for cache within TTL', () => {
    const cached = makeCachedEntitlement({
      cachedAt: '2026-03-20T12:00:00.000Z', // 5 days ago
    })
    expect(isCacheFresh(cached)).toBe(true)
  })

  it('returns false for cache beyond TTL', () => {
    const cached = makeCachedEntitlement({
      cachedAt: '2026-03-10T00:00:00.000Z', // 15 days ago
    })
    expect(isCacheFresh(cached)).toBe(false)
  })

  it('returns true for cache exactly at TTL boundary', () => {
    const cached = makeCachedEntitlement({
      cachedAt: '2026-03-18T12:00:00.000Z', // exactly 7 days
    })
    expect(isCacheFresh(cached)).toBe(true)
  })

  it('returns false for cache just past TTL', () => {
    const cached = makeCachedEntitlement({
      cachedAt: '2026-03-18T11:59:59.000Z', // 7 days + 1 second
    })
    expect(isCacheFresh(cached)).toBe(false)
  })
})

describe('validateEntitlementOnServer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns entitlement when server has data', async () => {
    mockServerResponse({
      user_id: 'user-123',
      tier: 'premium',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      plan_id: 'plan_monthly',
      expires_at: '2026-04-25T00:00:00.000Z',
    })

    const result = await validateEntitlementOnServer('user-123')
    expect(result).toEqual({
      userId: 'user-123',
      tier: 'premium',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      planId: 'plan_monthly',
      expiresAt: '2026-04-25T00:00:00.000Z',
      cachedAt: '2026-03-25T12:00:00.000Z',
    })
  })

  it('returns null when server returns error', async () => {
    mockServerResponse(null, { message: 'Not found' })
    const result = await validateEntitlementOnServer('user-123')
    expect(result).toBeNull()
  })

  it('returns null when server returns no data', async () => {
    mockServerResponse(null)
    const result = await validateEntitlementOnServer('user-123')
    expect(result).toBeNull()
  })

  it('handles null optional fields gracefully', async () => {
    mockServerResponse({
      user_id: 'user-123',
      tier: 'premium',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan_id: null,
      expires_at: null,
    })

    const result = await validateEntitlementOnServer('user-123')
    expect(result?.stripeCustomerId).toBeUndefined()
    expect(result?.stripeSubscriptionId).toBeUndefined()
    expect(result?.planId).toBeUndefined()
    expect(result?.expiresAt).toBeUndefined()
  })
})

describe('clearCachedEntitlement', () => {
  it('calls db.entitlements.delete with userId', async () => {
    mockDelete.mockResolvedValue(undefined)
    await clearCachedEntitlement('user-123')
    expect(mockDelete).toHaveBeenCalledWith('user-123')
  })

  it('does not throw on delete error', async () => {
    mockDelete.mockRejectedValue(new Error('IDB error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(clearCachedEntitlement('user-123')).resolves.toBeUndefined()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Hook tests — use real timers for waitFor compatibility
// ---------------------------------------------------------------------------

describe('useIsPremium', () => {
  beforeEach(() => {
    storeState = { user: mockUser, initialized: true }
    mockGetCachedEntitlement.mockResolvedValue(null)
    mockCacheEntitlement.mockResolvedValue(undefined)
    mockDelete.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns loading=true initially', () => {
    // Don't resolve the cache check yet — hang forever
    mockGetCachedEntitlement.mockReturnValue(new Promise(() => {}))
    mockServerResponse(null)

    const { result } = renderHook(() => useIsPremium())
    expect(result.current.loading).toBe(true)
    expect(result.current.tier).toBe('free')
  })

  it('AC1: online launch — validates and caches entitlement', async () => {
    mockGetCachedEntitlement.mockResolvedValue(null)
    mockServerResponse({
      user_id: 'user-123',
      tier: 'premium',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      plan_id: 'plan_monthly',
      expires_at: '2026-04-25T00:00:00.000Z',
    })

    const { result } = renderHook(() => useIsPremium())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isPremium).toBe(true)
    expect(result.current.tier).toBe('premium')
    expect(mockCacheEntitlement).toHaveBeenCalled()
  })

  it('AC2: offline with fresh cache — honors cached entitlement', async () => {
    const freshCache = makeCachedEntitlement({
      cachedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    })
    mockGetCachedEntitlement.mockResolvedValue(freshCache)
    mockServerError()

    const { result } = renderHook(() => useIsPremium())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isPremium).toBe(true)
    expect(result.current.tier).toBe('premium')
    expect(result.current.error).toBeNull()
  })

  it('AC3: offline with stale cache — disables premium', async () => {
    const staleCache = makeCachedEntitlement({
      cachedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
    })
    mockGetCachedEntitlement.mockResolvedValue(staleCache)
    mockServerError()

    const { result } = renderHook(() => useIsPremium())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isPremium).toBe(false)
    expect(result.current.tier).toBe('free')
    expect(result.current.isStale).toBe(true)
    expect(result.current.error).toContain('outdated')
  })

  it('AC5: cancelled subscription — server returns free tier', async () => {
    const premiumCache = makeCachedEntitlement({ tier: 'premium' })
    mockGetCachedEntitlement.mockResolvedValue(premiumCache)
    mockServerResponse({
      user_id: 'user-123',
      tier: 'free',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: null,
      plan_id: null,
      expires_at: null,
    })

    const { result } = renderHook(() => useIsPremium())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Server said free, so premium should be false
    await waitFor(() => {
      expect(result.current.isPremium).toBe(false)
    })
    expect(result.current.tier).toBe('free')
  })

  it('returns free tier when user is null', async () => {
    storeState = { user: null, initialized: true }

    const { result } = renderHook(() => useIsPremium())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isPremium).toBe(false)
    expect(result.current.tier).toBe('free')
  })

  it('stays loading when auth is not initialized', () => {
    storeState = { user: null, initialized: false }

    const { result } = renderHook(() => useIsPremium())
    expect(result.current.loading).toBe(true)
  })

  it('treats trial tier as premium', async () => {
    mockGetCachedEntitlement.mockResolvedValue(null)
    mockServerResponse({
      user_id: 'user-123',
      tier: 'trial',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan_id: null,
      expires_at: null,
    })

    const { result } = renderHook(() => useIsPremium())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isPremium).toBe(true)
    expect(result.current.tier).toBe('trial')
  })

  it('AC4: auto-revalidates on online event', async () => {
    mockGetCachedEntitlement.mockResolvedValue(null)
    mockServerResponse({
      user_id: 'user-123',
      tier: 'free',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan_id: null,
      expires_at: null,
    })

    const { result } = renderHook(() => useIsPremium())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isPremium).toBe(false)

    // Now simulate coming back online with premium
    mockServerResponse({
      user_id: 'user-123',
      tier: 'premium',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      plan_id: 'plan_monthly',
      expires_at: '2026-04-25T00:00:00.000Z',
    })

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(result.current.isPremium).toBe(true)
    })
  })

  it('AC8: clears cached entitlement when server returns free for previously-premium user', async () => {
    const premiumCache = makeCachedEntitlement({ tier: 'premium' })
    mockGetCachedEntitlement.mockResolvedValue(premiumCache)
    mockServerResponse({
      user_id: 'user-123',
      tier: 'free',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: null,
      plan_id: null,
      expires_at: null,
    })

    const { result } = renderHook(() => useIsPremium())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await waitFor(() => {
      expect(result.current.tier).toBe('free')
    })

    // Cache should have been cleared (explicit denial)
    expect(mockDelete).toHaveBeenCalledWith('user-123')
  })

  it('AC7: network error with no cache — returns free without error', async () => {
    mockGetCachedEntitlement.mockResolvedValue(null)
    mockServerError()

    const { result } = renderHook(() => useIsPremium())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isPremium).toBe(false)
    expect(result.current.tier).toBe('free')
    expect(result.current.error).toBeNull()
  })
})
