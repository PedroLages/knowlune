import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isChunkLoadError,
  registerChunkLoadRecovery,
  resetChunkReloadGuard,
} from '@/lib/chunkLoadRecovery'

function dispatchPreloadError(payload: unknown): Event {
  const event = new Event('vite:preloadError', { cancelable: true })
  Object.defineProperty(event, 'payload', { value: payload })
  window.dispatchEvent(event)
  return event
}

describe('chunkLoadRecovery', () => {
  afterEach(() => {
    resetChunkReloadGuard()
  })

  it.each([
    'Failed to fetch dynamically imported module: /assets/Courses-old.js',
    'Importing a module script failed',
    'Expected a JavaScript-or-Wasm module script',
  ])('recognizes chunk load error: %s', message => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true)
  })

  it('ignores unrelated runtime errors', () => {
    expect(isChunkLoadError(new Error('Render failed'))).toBe(false)
  })

  it('prevents the first chunk error and reloads once per route', () => {
    const reload = vi.fn()
    const unregister = registerChunkLoadRecovery(reload)

    const first = dispatchPreloadError(
      new TypeError('Failed to fetch dynamically imported module: /assets/Courses-old.js')
    )
    const second = dispatchPreloadError(
      new TypeError('Failed to fetch dynamically imported module: /assets/Courses-old.js')
    )

    expect(first.defaultPrevented).toBe(true)
    expect(second.defaultPrevented).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)

    unregister()
  })
})
