/**
 * Worker Capabilities Tests (AC5)
 *
 * Tests graceful degradation when Worker API is unavailable.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supportsWorkers, detectWorkerFeatures } from '../workerCapabilities'

// Node.js has no native Worker — provide a minimal stub for tests that expect it present
class StubWorker {}

describe('workerCapabilities', () => {
  beforeEach(() => {
    // Default: Worker is available
    global.Worker = StubWorker as unknown as typeof Worker
  })

  afterEach(() => {
    global.Worker = StubWorker as unknown as typeof Worker
  })

  it('supportsWorkers returns true when Worker is available', () => {
    expect(supportsWorkers()).toBe(true)
  })

  it('AC5: supportsWorkers returns false when Worker is undefined', () => {
    // @ts-expect-error simulate no Worker support
    delete global.Worker

    expect(supportsWorkers()).toBe(false)
  })

  it('AC5: detectWorkerFeatures reports workers: false when Worker is undefined', () => {
    // @ts-expect-error simulate no Worker support
    delete global.Worker

    const features = detectWorkerFeatures()
    expect(features.workers).toBe(false)
    expect(features.moduleWorkers).toBe(false)
  })

  it('detectWorkerFeatures reports workers: true when Worker is defined', () => {
    const features = detectWorkerFeatures()
    expect(features.workers).toBe(true)
    expect(typeof features.indexedDB).toBe('boolean')
    expect(typeof features.sharedArrayBuffer).toBe('boolean')
  })
})
