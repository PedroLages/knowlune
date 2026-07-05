/**
 * Tests for usePushSubscription hook.
 *
 * @module usePushSubscription.test
 * @since E61-S01
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { toast } from 'sonner'

// Mock virtual:pwa-register/react before importing the hook
// Create a mock registration with pushManager.getSubscription
function createMockRegistration(): ServiceWorkerRegistration {
  return {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(null),
    },
  } as unknown as ServiceWorkerRegistration
}

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn((options?: { onRegisteredSW?: (...args: unknown[]) => void }) => {
    // Call onRegisteredSW to trigger registration capture
    if (options?.onRegisteredSW) {
      options.onRegisteredSW('/sw.js', createMockRegistration())
    }
    return {
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    }
  }),
}))

// Mock pushManager functions
vi.mock('@/lib/pushManager', () => ({
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
  getPushPermissionState: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

import { usePushSubscription } from '../usePushSubscription'
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushPermissionState,
} from '@/lib/pushManager'

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Default: environment supports push
    Object.defineProperty(globalThis, 'navigator', {
      value: { serviceWorker: {} },
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'window', {
      value: { PushManager: class PushManager {} },
      configurable: true,
      writable: true,
    })
    vi.mocked(getPushPermissionState).mockReturnValue('granted')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Initial state ──

  it('returns initial state with isSubscribed false when no existing subscription', () => {
    const { result } = renderHook(() => usePushSubscription())

    expect(result.current.isSubscribed).toBe(false)
    expect(result.current.permissionState).toBe('granted')
  })

  it('returns permissionState: unsupported when ServiceWorker or PushManager is not available', () => {
    // Remove ServiceWorker support
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => usePushSubscription())

    expect(result.current.permissionState).toBe('unsupported')
    expect(result.current.isSubscribed).toBe(false)
  })

  // ── subscribe ──

  it('subscribe calls subscribeToPush and updates isSubscribed on success', async () => {
    const mockSubscription = { endpoint: 'https://example.com/push' }
    vi.mocked(subscribeToPush).mockResolvedValue({
      ok: true,
      data: mockSubscription as unknown as PushSubscription,
    })

    const { result } = renderHook(() => usePushSubscription())

    await act(async () => {
      await result.current.subscribe()
    })

    expect(subscribeToPush).toHaveBeenCalled()
    expect(result.current.isSubscribed).toBe(true)
  })

  it('subscribe shows toast.error when subscribeToPush returns error', async () => {
    vi.mocked(subscribeToPush).mockResolvedValue({
      ok: false,
      error: { code: 'SUBSCRIPTION_FAILED', message: 'Subscription failed' },
    })

    const { result } = renderHook(() => usePushSubscription())

    await act(async () => {
      await result.current.subscribe()
    })

    expect(toast.error).toHaveBeenCalledWith('Subscription failed')
    expect(result.current.isSubscribed).toBe(false)
  })

  // ── unsubscribe ──

  it('unsubscribe calls unsubscribeFromPush and updates isSubscribed on success', async () => {
    // First subscribe to set up the subscription
    const mockSubscription = { endpoint: 'https://example.com/push' }
    vi.mocked(subscribeToPush).mockResolvedValue({
      ok: true,
      data: mockSubscription as unknown as PushSubscription,
    })
    vi.mocked(unsubscribeFromPush).mockResolvedValue({ ok: true, data: undefined })

    const { result } = renderHook(() => usePushSubscription())

    await act(async () => {
      await result.current.subscribe()
    })
    expect(result.current.isSubscribed).toBe(true)

    await act(async () => {
      await result.current.unsubscribe()
    })

    expect(unsubscribeFromPush).toHaveBeenCalled()
    expect(result.current.isSubscribed).toBe(false)
  })

  it('unsubscribe shows toast.error when unsubscribeFromPush returns error', async () => {
    // First subscribe
    const mockSubscription = { endpoint: 'https://example.com/push' }
    vi.mocked(subscribeToPush).mockResolvedValue({
      ok: true,
      data: mockSubscription as unknown as PushSubscription,
    })
    vi.mocked(unsubscribeFromPush).mockResolvedValue({
      ok: false,
      error: { code: 'UNSUBSCRIBE_FAILED', message: 'Unsubscribe failed' },
    })

    const { result } = renderHook(() => usePushSubscription())

    await act(async () => {
      await result.current.subscribe()
    })

    await act(async () => {
      await result.current.unsubscribe()
    })

    expect(toast.error).toHaveBeenCalledWith('Unsubscribe failed')
    expect(result.current.isSubscribed).toBe(true) // still subscribed
  })

  // ── Edge cases ──

  it('component unmounts without errors', () => {
    const { unmount } = renderHook(() => usePushSubscription())
    expect(() => unmount()).not.toThrow()
  })

  it('handles unsupported environment gracefully', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => usePushSubscription())

    // Calling subscribe in unsupported environment should not throw
    expect(async () => {
      await act(async () => {
        await result.current.subscribe()
      })
    }).not.toThrow()
  })
})
