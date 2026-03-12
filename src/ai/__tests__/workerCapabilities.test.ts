/**
 * Unit tests for workerCapabilities
 *
 * AC7: Toggle hidden when Worker API unavailable; text search continues normally
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

// Store original so we can restore after each test
const originalWorker = global.Worker

describe('supportsWorkers — AC7', () => {
  afterEach(() => {
    // Restore Worker global
    global.Worker = originalWorker
  })

  it('returns true when Worker is available', async () => {
    global.Worker = class MockWorker {} as unknown as typeof Worker
    vi.resetModules()
    const { supportsWorkers } = await import('../lib/workerCapabilities')
    expect(supportsWorkers()).toBe(true)
  })

  it('returns false when Worker is undefined', async () => {
    // @ts-expect-error intentionally removing Worker for test
    delete global.Worker
    vi.resetModules()
    const { supportsWorkers } = await import('../lib/workerCapabilities')
    expect(supportsWorkers()).toBe(false)
  })
})
