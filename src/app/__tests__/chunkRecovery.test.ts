/**
 * Tests for the vite:preloadError stale-chunk recovery listener.
 *
 * Tests the initChunkRecovery() function from @/lib/chunkRecovery.
 *
 * Recovery strategy:
 * 1. Prevents the default error handling (synchronous)
 * 2. Purges the failed chunk from SW caches and reloads (first failure)
 * 3. Shows a recovery screen on second failure (no reload loop)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  initChunkRecovery,
  clearRecoveryMarker,
  CHUNK_RECOVERY_KEY,
  RECOVERY_SCREEN_KEY,
} from '@/lib/chunkRecovery'

// Helper to wait for async operations to settle
const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve))

describe('vite:preloadError chunk recovery', () => {
  let replaceSpy: ReturnType<typeof vi.fn>
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sessionStorage.clear()

    // Mock caches API
    Object.defineProperty(window, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue({
          delete: vi.fn().mockResolvedValue(true),
          match: vi.fn().mockResolvedValue(null),
          keys: vi.fn().mockResolvedValue([]),
          put: vi.fn().mockResolvedValue(undefined),
        }),
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
        match: vi.fn().mockResolvedValue(null),
      },
      writable: true,
      configurable: true,
    })

    // Mock service worker registration
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          active: {
            scriptURL: 'https://knowlune.pedrolages.net/sw.js',
            postMessage: vi.fn(),
          },
          waiting: null,
          installing: null,
          update: vi.fn().mockResolvedValue(undefined),
        }),
        ready: Promise.resolve({
          active: { scriptURL: 'https://knowlune.pedrolages.net/sw.js', postMessage: vi.fn() },
        }),
        controller: null,
      },
      writable: true,
      configurable: true,
    })

    // Mock document.getElementById for recovery screen
    const existingRoot = document.getElementById('root')
    if (!existingRoot) {
      const mockRoot = document.createElement('div')
      mockRoot.id = 'root'
      document.body.appendChild(mockRoot)
    }

    // Mock window.location
    replaceSpy = vi.fn()
    reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://knowlune.pedrolages.net/courses',
        replace: replaceSpy,
        reload: reloadSpy,
      },
      writable: true,
      configurable: true,
    })

    // Register the listener
    initChunkRecovery()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  function dispatchPreloadError(): CustomEvent {
    const event = new Event('vite:preloadError') as CustomEvent
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)
    return event
  }

  it('prevents default error behavior synchronously', () => {
    const event = dispatchPreloadError()

    // preventDefault is called synchronously before any async work
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('reloads the page on first preload error (after async cleanup)', async () => {
    dispatchPreloadError()

    // Reload happens after async cache/SW operations
    await flushPromises()

    expect(replaceSpy).toHaveBeenCalledTimes(1)
    const calledUrl = replaceSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain('__reload=')
  })

  it('sets sessionStorage marker on first error', async () => {
    dispatchPreloadError()

    await flushPromises()
    expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).toBe('1')
  })

  it('shows recovery screen on second preload error instead of reloading', async () => {
    // Simulate first error already happened
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')

    dispatchPreloadError()

    await flushPromises()

    // Should NOT have reloaded again
    expect(replaceSpy).not.toHaveBeenCalled()

    // Recovery screen key should be set
    expect(sessionStorage.getItem(RECOVERY_SCREEN_KEY)).toBe('1')

    // Recovery screen should be in the DOM
    const rootEl = document.getElementById('root')
    expect(rootEl?.innerHTML).toContain('Knowlune was updated')
  })

  it('recovery screen Reload Cleanly button clears caches and reloads', async () => {
    // Trigger second failure
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')
    dispatchPreloadError()
    await flushPromises()

    // Click the Reload Cleanly button
    const btn = document.getElementById('recovery-reload-btn')
    expect(btn).not.toBeNull()
    ;(btn as HTMLButtonElement).click()

    await flushPromises()

    // Should have called reload
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('does NOT clear recovery marker on window.load (deferred to App mount)', () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')
    expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).toBe('1')

    window.dispatchEvent(new Event('load'))

    // Marker is NOT cleared on load — it's cleared by clearRecoveryMarker()
    expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).toBe('1')
  })

  it('clears recovery-screen key on window.load', () => {
    sessionStorage.setItem(RECOVERY_SCREEN_KEY, '1')
    expect(sessionStorage.getItem(RECOVERY_SCREEN_KEY)).toBe('1')

    window.dispatchEvent(new Event('load'))

    expect(sessionStorage.getItem(RECOVERY_SCREEN_KEY)).toBeNull()
  })

  it('clearRecoveryMarker() clears both sessionStorage keys', () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')
    sessionStorage.setItem(RECOVERY_SCREEN_KEY, '1')

    clearRecoveryMarker()

    expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).toBeNull()
    expect(sessionStorage.getItem(RECOVERY_SCREEN_KEY)).toBeNull()
  })

  it('recovery screen button clears both sessionStorage keys', async () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')
    sessionStorage.setItem(RECOVERY_SCREEN_KEY, '1')

    dispatchPreloadError()
    await flushPromises()

    const btn = document.getElementById('recovery-reload-btn')
    ;(btn as HTMLButtonElement).click()
    await flushPromises()

    expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).toBeNull()
    expect(sessionStorage.getItem(RECOVERY_SCREEN_KEY)).toBeNull()
  })
})
