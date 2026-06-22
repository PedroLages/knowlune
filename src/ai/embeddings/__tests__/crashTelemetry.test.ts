/**
 * Unit tests for Worker Crash Telemetry payload shape and Safari fallback
 *
 * Covers:
 * - Happy path: Worker crash event payload contains requestId, provider, error.name
 * - Edge case: Rapid repeat crashes (same requestId) -> dedupe, single event
 * - Error path: Safari-style module worker failure -> fallback succeeds
 * - Integration: Crash during active embed request -> request rejects with typed error
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { coordinator } from '@/ai/workers/coordinator'

// ============================================================================
// Dedup utility (imported from vector-store which has side effects)
// We import these lazily to avoid side-effect conflicts with test setup
// ============================================================================

let isDuplicateCrashFn: (requestId: string) => boolean
let resetCrashDedupCacheFn: () => void

async function loadDedupUtils(): Promise<void> {
  const mod = await import('@/ai/vector-store')
  isDuplicateCrashFn = mod.isDuplicateCrash
  resetCrashDedupCacheFn = mod.resetCrashDedupCache
}

// ============================================================================
// Mock Worker implementations
// ============================================================================

class MockModuleFailingWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  static wasModuleAttempt = false

  constructor(
    public url: string | URL,
    public options?: WorkerOptions
  ) {
    super()
    // Simulate Safari: module workers are not supported
    if (options?.type === 'module') {
      MockModuleFailingWorker.wasModuleAttempt = true
      throw new TypeError('Failed to construct "Worker": Module scripts are not supported.')
    }
  }

  postMessage(message: unknown): void {
    const request = message as { requestId: string; type: string; payload: unknown }

    if (request.type === 'embed') {
      const payload = request.payload as { texts: string[] }
      const embeddings = payload.texts.map(() => new Float32Array(384))

      setTimeout(() => {
        this.dispatchEvent(
          new MessageEvent('message', {
            data: {
              requestId: request.requestId,
              type: 'success',
              result: { embeddings },
            },
          })
        )
      }, 10)
    }
  }

  terminate(): void {}
  addEventListener(type: string, listener: EventListener): void {
    super.addEventListener(type, listener)
  }
  removeEventListener(type: string, listener: EventListener): void {
    super.removeEventListener(type, listener)
  }
}

class CrashableWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  static instance: EventTarget | null = null

  constructor(
    public url: string | URL,
    public options?: WorkerOptions
  ) {
    super()
    CrashableWorker.instance = this
  }

  postMessage(): void {
    /* never responds — will be crashed via onerror */
  }

  terminate(): void {}
  addEventListener(type: string, listener: EventListener): void {
    super.addEventListener(type, listener)
  }
  removeEventListener(type: string, listener: EventListener): void {
    super.removeEventListener(type, listener)
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Worker crash telemetry — event payload shape', () => {
  // Store original globals
  const originalCaches = globalThis.caches

  beforeEach(() => {
    CrashableWorker.instance = null
    // Mock caches.has to return true (cache available) so cacheUnavailable = false
    Object.defineProperty(globalThis, 'caches', {
      value: { has: vi.fn().mockResolvedValue(true) },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    coordinator.terminate()
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  // Happy path: Worker crash event payload contains requestId, provider, error.name, stack
  it('dispatches worker-crash with structured telemetry payload on embed worker crash', async () => {
    global.Worker = CrashableWorker as unknown as typeof Worker

    const taskPromise = coordinator.executeTask('embed', { texts: ['crash-test'] })
    taskPromise.catch(() => {}) // Suppress unhandled rejection

    // Wait for worker to be spawned
    await new Promise(resolve => queueMicrotask(resolve as () => void))
    await new Promise(resolve => setTimeout(resolve, 5))

    expect(CrashableWorker.instance).not.toBeNull()

    const crashEventSpy = vi.fn()
    window.addEventListener('worker-crash', crashEventSpy)

    // Simulate worker crash with a known error
    const crashError = new Error('Model OOM')
    CrashableWorker.instance!.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Model OOM',
        error: crashError,
      })
    )

    // Wait for async crash handler (cache probe, event dispatch)
    await new Promise(resolve => setTimeout(resolve, 10))

    await expect(taskPromise).rejects.toThrow('Worker crashed')

    // Verify event payload structure per R5
    expect(crashEventSpy).toHaveBeenCalledTimes(1)
    const eventArg = crashEventSpy.mock.calls[0][0] as CustomEvent

    expect(eventArg.detail).toMatchObject({
      workerId: 'embed-worker',
      provider: 'local',
      error: 'Error',
      errorMessage: 'Model OOM',
      cacheUnavailable: false,
    })
    // requestId should be a non-empty string, not a comma-joined list
    expect(typeof eventArg.detail.requestId).toBe('string')
    expect(eventArg.detail.requestId).not.toContain(',')
    expect(eventArg.detail.requestId.length).toBeGreaterThan(0)
    // stack should be a string
    expect(typeof eventArg.detail.stack).toBe('string')
    expect(eventArg.detail.stack.length).toBeGreaterThan(0)

    window.removeEventListener('worker-crash', crashEventSpy)
  })

  // Happy path: Worked error shows correct error class name
  it('includes error class name (error.name) for non-Error types like TypeError', async () => {
    global.Worker = CrashableWorker as unknown as typeof Worker

    const taskPromise = coordinator.executeTask('embed', { texts: ['crash-test'] })
    taskPromise.catch(() => {})

    await new Promise(resolve => queueMicrotask(resolve as () => void))
    await new Promise(resolve => setTimeout(resolve, 5))

    const crashEventSpy = vi.fn()
    window.addEventListener('worker-crash', crashEventSpy)

    // Simulate a TypeError crash
    CrashableWorker.instance!.dispatchEvent(
      new ErrorEvent('error', {
        message: 'undefined is not a function',
        error: new TypeError('undefined is not a function'),
      })
    )

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(crashEventSpy).toHaveBeenCalledTimes(1)
    const eventArg = crashEventSpy.mock.calls[0][0] as CustomEvent
    expect(eventArg.detail.error).toBe('TypeError')

    window.removeEventListener('worker-crash', crashEventSpy)
  })

  // Happy path: non-embed worker crash has provider = undefined
  it('sets provider to undefined for non-embed worker types', async () => {
    global.Worker = CrashableWorker as unknown as typeof Worker

    // Mock caches.has
    Object.defineProperty(globalThis, 'caches', {
      value: { has: vi.fn().mockResolvedValue(true) },
      writable: true,
      configurable: true,
    })

    const taskPromise = coordinator.executeTask('search', {
      queryVector: new Float32Array(384),
      topK: 5,
    })
    taskPromise.catch(() => {})

    await new Promise(resolve => queueMicrotask(resolve as () => void))
    await new Promise(resolve => setTimeout(resolve, 5))

    const crashEventSpy = vi.fn()
    window.addEventListener('worker-crash', crashEventSpy)

    CrashableWorker.instance!.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Search worker crashed',
        error: new Error('Search worker crashed'),
      })
    )

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(crashEventSpy).toHaveBeenCalledTimes(1)
    const eventArg = crashEventSpy.mock.calls[0][0] as CustomEvent

    // Search worker crash should not have provider set to 'local'
    // (only embed workers get provider: 'local')
    expect(eventArg.detail.provider).toBeUndefined()

    window.removeEventListener('worker-crash', crashEventSpy)
  })
})

describe('Crash deduplication — rapid repeat crashes', () => {
  beforeEach(async () => {
    await loadDedupUtils()
    resetCrashDedupCacheFn()
  })

  it('rejects duplicate crash events with the same requestId within dedup window', async () => {
    await loadDedupUtils()
    resetCrashDedupCacheFn()

    const requestId = 'test-request-123'

    // First call should return false (not a duplicate)
    expect(isDuplicateCrashFn(requestId)).toBe(false)

    // Second call within dedup window should return true (duplicate)
    expect(isDuplicateCrashFn(requestId)).toBe(true)
  })

  it('allows different requestIds independently', async () => {
    await loadDedupUtils()
    resetCrashDedupCacheFn()

    expect(isDuplicateCrashFn('request-1')).toBe(false)
    expect(isDuplicateCrashFn('request-2')).toBe(false)
  })

  it('clears dedup cache on resetCrashDedupCache', async () => {
    await loadDedupUtils()
    resetCrashDedupCacheFn()

    expect(isDuplicateCrashFn('request-1')).toBe(false)
    // After reset, the same requestId should not be treated as duplicate
    resetCrashDedupCacheFn()
    expect(isDuplicateCrashFn('request-1')).toBe(false)
  })
})

describe('Safari module-worker fallback', () => {
  const originalCaches = globalThis.caches

  beforeEach(() => {
    MockModuleFailingWorker.wasModuleAttempt = false
    Object.defineProperty(globalThis, 'caches', {
      value: { has: vi.fn().mockResolvedValue(true) },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    coordinator.terminate()
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('falls back to classic worker when module worker construction throws TypeError (Safari)', async () => {
    global.Worker = MockModuleFailingWorker as unknown as typeof Worker

    // Should succeed despite initial module worker failure
    const result = await coordinator.executeTask<{ embeddings: Float32Array[] }>('embed', {
      texts: ['test safari fallback'],
    })

    expect(result.embeddings).toHaveLength(1)
    // Verify that the module worker was attempted first
    expect(MockModuleFailingWorker.wasModuleAttempt).toBe(true)
  })
})

describe('Crash integration with embedding pipeline', () => {
  const originalCaches = globalThis.caches

  beforeEach(() => {
    CrashableWorker.instance = null
    Object.defineProperty(globalThis, 'caches', {
      value: { has: vi.fn().mockResolvedValue(true) },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    coordinator.terminate()
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('rejects pending embed request with typed error when worker crashes', async () => {
    global.Worker = CrashableWorker as unknown as typeof Worker

    // Start an embed task
    const taskPromise = coordinator.executeTask('embed', { texts: ['crash-test'] })

    // Wait for worker to register
    await new Promise(resolve => queueMicrotask(resolve as () => void))
    await new Promise(resolve => setTimeout(resolve, 5))

    // Crash it
    CrashableWorker.instance!.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Model OOM',
        error: new Error('Model OOM'),
      })
    )

    // Request should reject with a meaningful error
    await expect(taskPromise).rejects.toThrow('Worker crashed')
  })
})
