import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

const mockInvoke = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('@/db/schema', () => ({
  db: {
    entitlements: {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      session: { access_token: 'test-token' },
      user: { id: 'user-123' },
    })),
  },
}))

import {
  startCheckout,
  pollEntitlement,
  cacheEntitlement,
  getCachedEntitlement,
} from '@/lib/checkout'
import { useAuthStore } from '@/stores/useAuthStore'
import { db } from '@/db/schema'
import type { CachedEntitlement } from '@/data/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPut = db.entitlements.put as ReturnType<typeof vi.fn>
const mockGet = db.entitlements.get as ReturnType<typeof vi.fn>
const mockDelete = db.entitlements.delete as ReturnType<typeof vi.fn>
const mockGetState = useAuthStore.getState as ReturnType<typeof vi.fn>

function makeCachedEntitlement(overrides: Partial<CachedEntitlement> = {}): CachedEntitlement {
  return {
    userId: 'user-123',
    tier: 'premium',
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
    planId: 'plan_test',
    expiresAt: '2027-01-01T00:00:00.000Z',
    cachedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// startCheckout
// ---------------------------------------------------------------------------

describe('startCheckout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Reset to default state (session + user present)
    mockGetState.mockReturnValue({
      session: { access_token: 'test-token' },
      user: { id: 'user-123' },
    })
  })

  it('returns checkout URL on successful session creation', async () => {
    mockInvoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/pay' }, error: null })

    const result = await startCheckout()
    expect(result).toEqual({ url: 'https://checkout.stripe.com/pay' })
    expect(mockInvoke).toHaveBeenCalledWith('create-checkout', {
      body: { origin: window.location.origin },
    })
  })

  it('returns error when session invoke fails', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Server error') })

    const result = await startCheckout()
    expect(result).toEqual({ error: 'Unable to start checkout. Please try again.' })
  })

  it('returns error when response has no URL', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null })

    const result = await startCheckout()
    expect(result).toEqual({ error: 'Unable to start checkout. Please try again.' })
  })

  it('returns error when response has an error field', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'bad request' } })

    const result = await startCheckout()
    expect(result).toEqual({ error: 'Unable to start checkout. Please try again.' })
  })

  it('returns error when session is null (user not signed in)', async () => {
    mockGetState.mockReturnValue({ session: null, user: null })

    const result = await startCheckout()
    expect(result).toEqual({ error: 'You must be signed in to upgrade.' })
  })
})

// ---------------------------------------------------------------------------
// startCheckout — supabase null
// ---------------------------------------------------------------------------

describe('startCheckout (supabase not configured)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns error when Supabase client is not available', async () => {
    // Temporarily override the supabase mock to return null
    const supabaseMod = await import('@/lib/auth/supabase')
    const original = supabaseMod.supabase

    // @ts-expect-error — overriding readonly for test
    supabaseMod.supabase = null

    // Re-import checkout to pick up the null supabase — but module is cached.
    // The module reads `supabase` at call-time, so we need to reset modules.
    vi.resetModules()

    // Re-mock with null supabase
    vi.doMock('@/lib/auth/supabase', () => ({ supabase: null }))
    vi.doMock('@/db/schema', () => ({
      db: { entitlements: { put: vi.fn(), get: vi.fn(), delete: vi.fn() } },
    }))
    vi.doMock('@/stores/useAuthStore', () => ({
      useAuthStore: {
        getState: vi.fn(() => ({
          session: { access_token: 'test-token' },
          user: { id: 'user-123' },
        })),
      },
    }))

    const { startCheckout: startCheckoutFresh } = await import('@/lib/checkout')
    const result = await startCheckoutFresh()
    expect(result).toEqual({
      error: 'Subscription service is not configured. Please check your Supabase setup.',
    })

    // Restore
    // @ts-expect-error — restoring readonly
    supabaseMod.supabase = original
  })
})

// ---------------------------------------------------------------------------
// pollEntitlement
// ---------------------------------------------------------------------------

describe('pollEntitlement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
    mockGetState.mockReturnValue({
      session: { access_token: 'test-token' },
      user: { id: 'user-123' },
    })
    mockPut.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function mockSupabaseQuery(response: { data: unknown; error: unknown }) {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(response),
        }),
      }),
    })
  }

  it('returns premium entitlement when tier changes to premium during polling', async () => {
    const premiumData = {
      user_id: 'user-123',
      tier: 'premium',
      stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_test',
      plan_id: 'plan_test',
      expires_at: '2027-01-01T00:00:00.000Z',
    }
    mockSupabaseQuery({ data: premiumData, error: null })

    const promise = pollEntitlement(10_000, 2_000)
    // First poll fires immediately (no wait before first try)
    const result = await promise

    expect(result).not.toBeNull()
    expect(result!.tier).toBe('premium')
    expect(result!.userId).toBe('user-123')
    expect(mockPut).toHaveBeenCalled() // Should cache the result
  })

  it('returns null after timeout when tier remains free', async () => {
    mockSupabaseQuery({
      data: { user_id: 'user-123', tier: 'free' },
      error: null,
    })

    const promise = pollEntitlement(5_000, 2_000)

    // Advance time past all polling intervals + timeout
    // Poll 1: immediate, then 2s wait, poll 2, then 2s wait, poll 3 — beyond 5s deadline
    await vi.advanceTimersByTimeAsync(2_000) // After first poll + wait
    await vi.advanceTimersByTimeAsync(2_000) // After second poll + wait
    await vi.advanceTimersByTimeAsync(2_000) // Past deadline

    const result = await promise
    expect(result).toBeNull()
  })

  it('continues polling after transient network error', async () => {
    const singleFn = vi.fn()
    // First call rejects (transient error)
    singleFn.mockRejectedValueOnce(new Error('Network error'))
    // Second call succeeds with premium
    singleFn.mockResolvedValueOnce({
      data: {
        user_id: 'user-123',
        tier: 'premium',
        stripe_customer_id: 'cus_test',
        stripe_subscription_id: null,
        plan_id: null,
        expires_at: null,
      },
      error: null,
    })

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: singleFn,
        }),
      }),
    })

    const promise = pollEntitlement(10_000, 2_000)

    // First poll fails, waits 2s, then second poll succeeds
    await vi.advanceTimersByTimeAsync(2_000)

    const result = await promise
    expect(result).not.toBeNull()
    expect(result!.tier).toBe('premium')
  })

  it('returns null immediately when AbortSignal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    mockSupabaseQuery({
      data: { user_id: 'user-123', tier: 'free' },
      error: null,
    })

    const result = await pollEntitlement(10_000, 2_000, controller.signal)
    // The first query fires before the signal check in the while body,
    // but on the second iteration the abort is checked. However, the very first
    // thing in the while loop is the signal check, so it should return null
    // after the first poll attempt (which returns free, not premium).
    expect(result).toBeNull()
  })

  it('aborts mid-poll when signal fires', async () => {
    const controller = new AbortController()

    mockSupabaseQuery({
      data: { user_id: 'user-123', tier: 'free' },
      error: null,
    })

    const promise = pollEntitlement(30_000, 2_000, controller.signal)

    // Let first poll execute (returns free) then wait
    await vi.advanceTimersByTimeAsync(1_000)
    controller.abort()
    await vi.advanceTimersByTimeAsync(2_000)

    const result = await promise
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// cacheEntitlement
// ---------------------------------------------------------------------------

describe('cacheEntitlement', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('writes entitlement to db.entitlements', async () => {
    mockPut.mockResolvedValue(undefined)
    const ent = makeCachedEntitlement()

    await cacheEntitlement(ent)
    expect(mockPut).toHaveBeenCalledWith(ent)
  })

  it('handles IndexedDB errors gracefully (logs, does not throw)', async () => {
    mockPut.mockRejectedValue(new Error('IDB write error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Should not throw
    await expect(cacheEntitlement(makeCachedEntitlement())).resolves.toBeUndefined()
    expect(consoleSpy).toHaveBeenCalledWith('Failed to cache entitlement:', expect.any(Error))
  })
})

// ---------------------------------------------------------------------------
// getCachedEntitlement
// ---------------------------------------------------------------------------

describe('getCachedEntitlement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns cached value within 7-day TTL', async () => {
    // Set "now" to a known time
    vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'))

    const ent = makeCachedEntitlement({
      cachedAt: '2026-03-20T12:00:00.000Z', // 5 days ago — within 7-day TTL
    })
    mockGet.mockResolvedValue(ent)

    const result = await getCachedEntitlement('user-123')
    expect(result).toEqual(ent)
  })

  it('returns null and deletes entry when cachedAt is older than 7 days', async () => {
    vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'))

    const ent = makeCachedEntitlement({
      cachedAt: '2026-03-10T00:00:00.000Z', // 15+ days ago — expired
    })
    mockGet.mockResolvedValue(ent)
    mockDelete.mockResolvedValue(undefined)

    const result = await getCachedEntitlement('user-123')
    expect(result).toBeNull()
    expect(mockDelete).toHaveBeenCalledWith('user-123')
  })

  it('returns null when no cached entry exists', async () => {
    mockGet.mockResolvedValue(undefined)

    const result = await getCachedEntitlement('user-123')
    expect(result).toBeNull()
  })

  it('returns null on IndexedDB read error', async () => {
    mockGet.mockRejectedValue(new Error('IDB read error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await getCachedEntitlement('user-123')
    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalled()
  })
})
