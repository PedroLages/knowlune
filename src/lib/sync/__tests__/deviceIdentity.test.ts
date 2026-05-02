/**
 * deviceIdentity.test.ts — unit tests for getDeviceId() UUID persistence.
 *
 * @module deviceIdentity
 * @since E92-S04
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDeviceId, DEVICE_ID_KEY } from '../deviceIdentity'

// UUID v4 format: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('getDeviceId', () => {
  beforeEach(() => {
    // Clear localStorage before each test to ensure isolation.
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('generates a UUID v4 on first call when localStorage is empty', () => {
    const id = getDeviceId()
    expect(UUID_V4_REGEX.test(id)).toBe(true)
  })

  it('persists the generated UUID to localStorage on first call', () => {
    const id = getDeviceId()
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(id)
  })

  it('returns the same value on subsequent calls (reads from localStorage)', () => {
    const first = getDeviceId()
    const second = getDeviceId()
    expect(first).toBe(second)
  })

  it('calls crypto.randomUUID() exactly once across two calls', () => {
    const spy = vi.spyOn(crypto, 'randomUUID')
    getDeviceId()
    getDeviceId()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('uses the value already in localStorage if set externally', () => {
    const preloaded = '12345678-1234-4abc-a234-123456789012'
    localStorage.setItem(DEVICE_ID_KEY, preloaded)
    const id = getDeviceId()
    expect(id).toBe(preloaded)
  })

  it('does not call crypto.randomUUID() if localStorage already has a value', () => {
    localStorage.setItem(DEVICE_ID_KEY, '12345678-1234-4abc-a234-123456789012')
    const spy = vi.spyOn(crypto, 'randomUUID')
    getDeviceId()
    expect(spy).not.toHaveBeenCalled()
  })
})
