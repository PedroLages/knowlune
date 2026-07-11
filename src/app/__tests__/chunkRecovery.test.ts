/**
 * Tests for the vite:preloadError stale-chunk recovery listener in main.tsx.
 *
 * The listener is registered before React renders. When Vite detects a failed
 * dynamic import(), it dispatches a vite:preloadError event. The listener:
 * 1. Prevents the default error handling
 * 2. Reloads the page once (guarded by sessionStorage)
 * 3. After successful load, clears the sessionStorage marker
 *
 * These tests simulate the event flow without actually navigating.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CHUNK_RECOVERY_KEY = 'knowlune-chunk-recovery'

describe('vite:preloadError chunk recovery', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://knowlune.pedrolages.net/courses',
        replace: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reloads the page exactly once on first preload error', () => {
    const replaceSpy = vi.spyOn(window.location, 'replace')
    const event = new Event('vite:preloadError')
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() })

    window.dispatchEvent(event)

    expect(replaceSpy).toHaveBeenCalledTimes(1)
    const calledUrl = replaceSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain('__reload=')
  })

  it('does not reload on second preload error (loop guard)', () => {
    const replaceSpy = vi.spyOn(window.location, 'replace')

    // First error — should reload
    const event1 = new Event('vite:preloadError')
    Object.defineProperty(event1, 'preventDefault', { value: vi.fn() })
    window.dispatchEvent(event1)
    expect(replaceSpy).toHaveBeenCalledTimes(1)

    // Second error — should NOT reload (sessionStorage key already set)
    const event2 = new Event('vite:preloadError')
    Object.defineProperty(event2, 'preventDefault', { value: vi.fn() })
    window.dispatchEvent(event2)
    expect(replaceSpy).toHaveBeenCalledTimes(1) // still only 1
  })

  it('clears the sessionStorage marker on successful load', () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')
    expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).toBe('1')

    window.dispatchEvent(new Event('load'))

    expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).toBeNull()
  })

  it('allows recovery reload after successful page load (cleared marker)', () => {
    const replaceSpy = vi.spyOn(window.location, 'replace')

    // First error cycle
    const event1 = new Event('vite:preloadError')
    Object.defineProperty(event1, 'preventDefault', { value: vi.fn() })
    window.dispatchEvent(event1)
    expect(replaceSpy).toHaveBeenCalledTimes(1)

    // Simulate successful load (clears the marker)
    window.dispatchEvent(new Event('load'))

    // Second error cycle — should trigger another reload (marker was cleared)
    const event2 = new Event('vite:preloadError')
    Object.defineProperty(event2, 'preventDefault', { value: vi.fn() })
    window.dispatchEvent(event2)
    expect(replaceSpy).toHaveBeenCalledTimes(2)
  })

  it('prevents default error behavior', () => {
    const preventDefaultSpy = vi.fn()
    const event = new Event('vite:preloadError')
    Object.defineProperty(event, 'preventDefault', { value: preventDefaultSpy })

    window.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
  })
})
