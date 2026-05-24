/**
 * fullscreen — Unit tests for exitFullscreenIfActive utility.
 *
 * Verifies:
 * - Calls document.exitFullscreen when fullscreenElement is non-null
 * - No-op when fullscreenElement is null
 * - Handles rejected promise via catch
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { exitFullscreenIfActive } from '../fullscreen'

describe('exitFullscreenIfActive', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // Reset fullscreenElement to default jsdom state (null)
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    })
  })

  it('calls document.exitFullscreen when fullscreenElement is non-null', () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = exitFullscreen

    Object.defineProperty(document, 'fullscreenElement', {
      value: document.createElement('div'),
      writable: true,
      configurable: true,
    })

    exitFullscreenIfActive()

    expect(exitFullscreen).toHaveBeenCalled()
  })

  it('does nothing when fullscreenElement is null', () => {
    const exitFullscreen = vi.fn()
    document.exitFullscreen = exitFullscreen

    exitFullscreenIfActive()

    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it('handles rejected promise via catch without throwing', () => {
    const exitFullscreen = vi.fn().mockRejectedValue(new Error('exit denied'))
    document.exitFullscreen = exitFullscreen

    Object.defineProperty(document, 'fullscreenElement', {
      value: document.createElement('div'),
      writable: true,
      configurable: true,
    })

    expect(() => exitFullscreenIfActive()).not.toThrow()
    expect(exitFullscreen).toHaveBeenCalled()
  })
})
