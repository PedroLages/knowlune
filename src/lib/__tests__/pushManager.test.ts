/**
 * Tests for pushManager.ts — push notification subscription management.
 *
 * @module pushManager.test
 * @since E61-S01
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  urlBase64ToUint8Array,
  getPushPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
} from '../pushManager'

// A known valid VAPID public key (generated via web-push)
const TEST_VAPID_KEY =
  'BM5un7mxzsfStWgO9VnFbckDmM1-aMo7iMCpZt46h1nUcz_QeVKzGQ5b07Rb4EG-oLLRp5FzcvEsEBH40RiYNCA'

describe('urlBase64ToUint8Array', () => {
  it('converts a valid VAPID public key to a Uint8Array', () => {
    const result = urlBase64ToUint8Array(TEST_VAPID_KEY)
    expect(result).toBeInstanceOf(Uint8Array)
    // Each base64 character encodes ~6 bits; a 172-char key decodes to 129 bytes
    // 172 characters -> (172 * 6) / 8 = 129 bytes
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces deterministic output for the same input', () => {
    const a = urlBase64ToUint8Array(TEST_VAPID_KEY)
    const b = urlBase64ToUint8Array(TEST_VAPID_KEY)
    expect(a).toEqual(b)
  })

  it('produces known byte values for a simple base64url string', () => {
    // base64url("Hello") = "SGVsbG8" → bytes [72, 101, 108, 108, 111]
    const result = urlBase64ToUint8Array('SGVsbG8')
    expect(Array.from(result)).toEqual([72, 101, 108, 108, 111])
  })

  it('handles empty string', () => {
    const result = urlBase64ToUint8Array('')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(0)
  })

  it('handles keys with padding characters (base64url vs base64)', () => {
    // A key ending with base64url characters that need padding
    const shortKey = 'YSB0ZXN0IGtleQ'
    const result = urlBase64ToUint8Array(shortKey)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('getPushPermissionState', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    // Ensure PushManager exists on window (jsdom doesn't have it)
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      configurable: true,
      writable: true,
    })
    ;(globalThis as any).PushManager = class PushManager {}
  })

  it('returns "granted" when Notification.permission is "granted"', () => {
    // Simulate granted permission
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted' },
      configurable: true,
      writable: true,
    })
    expect(getPushPermissionState()).toBe('granted')
  })

  it('returns "denied" when Notification.permission is "denied"', () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'denied' },
      configurable: true,
      writable: true,
    })
    expect(getPushPermissionState()).toBe('denied')
  })

  it('returns "default" when Notification.permission is "default"', () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'default' },
      configurable: true,
      writable: true,
    })
    expect(getPushPermissionState()).toBe('default')
  })

  it('returns "unsupported" when Notification API is missing', () => {
    const originalNotification = globalThis.Notification
    delete (globalThis as any).Notification
    expect(getPushPermissionState()).toBe('unsupported')
    // Restore
    ;(globalThis as any).Notification = originalNotification
  })

  it('returns "unsupported" when PushManager is missing from window', () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted' },
      configurable: true,
      writable: true,
    })

    const originalPushManager = (globalThis as any).PushManager
    delete (globalThis as any).PushManager
    expect(getPushPermissionState()).toBe('unsupported')
    // Restore
    ;(globalThis as any).PushManager = originalPushManager
  })
})

describe('subscribeToPush', () => {
  const mockSubscribe = vi.fn()

  const mockRegistration = {
    pushManager: {
      subscribe: mockSubscribe,
    },
  } as unknown as ServiceWorkerRegistration

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', TEST_VAPID_KEY)

    // Ensure PushManager and Notification exist
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted' },
      configurable: true,
      writable: true,
    })
    if (typeof globalThis.PushManager === 'undefined') {
      ;(globalThis as any).PushManager = class PushManager {}
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns subscription on success', async () => {
    const mockSubscription = { endpoint: 'https://example.com/push' }
    mockSubscribe.mockResolvedValue(mockSubscription)

    const result = await subscribeToPush(mockRegistration)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toBe(mockSubscription)
    }
    expect(mockSubscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    })
  })

  it('returns error when PushManager is not available', async () => {
    const result = await subscribeToPush({} as ServiceWorkerRegistration)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('API_NOT_SUPPORTED')
    }
  })

  it('returns error when permission is denied', async () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'denied' },
      configurable: true,
      writable: true,
    })

    const result = await subscribeToPush(mockRegistration)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PERMISSION_DENIED')
    }
  })

  it('returns error when VITE_VAPID_PUBLIC_KEY is not set', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', undefined)

    const result = await subscribeToPush(mockRegistration)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_VAPID_KEY')
    }
  })

  it('returns error when pushManager.subscribe throws', async () => {
    mockSubscribe.mockRejectedValue(new Error('Network error'))

    const result = await subscribeToPush(mockRegistration)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('SUBSCRIPTION_FAILED')
    }
  })
})

describe('unsubscribeFromPush', () => {
  const mockUnsubscribe = vi.fn()

  const mockSubscription = {
    unsubscribe: mockUnsubscribe,
  } as unknown as PushSubscription

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns success on unsubscription', async () => {
    mockUnsubscribe.mockResolvedValue(undefined)

    const result = await unsubscribeFromPush(mockSubscription)

    expect(result.ok).toBe(true)
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('returns error when unsubscribe throws', async () => {
    mockUnsubscribe.mockRejectedValue(new Error('Unsubscribe failed'))

    const result = await unsubscribeFromPush(mockSubscription)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUBSCRIBE_FAILED')
    }
  })
})
