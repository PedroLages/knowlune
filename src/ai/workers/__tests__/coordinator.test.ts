/**
 * Worker Coordinator Tests
 *
 * Tests worker pool management, message passing, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { coordinator, generateEmbeddings, warmUpEmbeddingModel } from '../coordinator'

// ============================================================================
// Mock Worker implementation
// ============================================================================

class MockWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  constructor(
    public url: string | URL,
    public options?: WorkerOptions
  ) {
    super()
  }

  postMessage(message: unknown): void {
    // Simulate worker response asynchronously
    setTimeout(() => {
      const request = message as { requestId: string; type: string; payload: unknown }

      if (request.type === 'embed') {
        const payload = request.payload as { texts: string[] }
        const embeddings = payload.texts.map(() => new Float32Array(384))

        this.dispatchEvent(
          new MessageEvent('message', {
            data: {
              requestId: request.requestId,
              type: 'success',
              result: { embeddings },
            },
          })
        )
      }
    }, 10)
  }

  terminate(): void {
    // No-op for mock
  }

  addEventListener(type: string, listener: EventListener): void {
    super.addEventListener(type, listener)
  }

  removeEventListener(type: string, listener: EventListener): void {
    super.removeEventListener(type, listener)
  }
}

global.Worker = MockWorker as unknown as typeof Worker

// ============================================================================
// Tests
// ============================================================================

describe('WorkerCoordinator', () => {
  beforeEach(() => {
    global.Worker = MockWorker as unknown as typeof Worker
    coordinator.terminate()
  })

  afterEach(() => {
    coordinator.terminate()
    vi.useRealTimers()
    global.Worker = MockWorker as unknown as typeof Worker
  })

  it('should spawn worker on first task', async () => {
    const embeddings = await generateEmbeddings(['test text'])

    expect(embeddings).toHaveLength(1)
    expect(embeddings[0]).toBeInstanceOf(Float32Array)
    expect(embeddings[0].length).toBe(384)
  })

  it('should reuse worker for subsequent tasks', async () => {
    const spy = vi.spyOn(MockWorker.prototype, 'postMessage')

    await generateEmbeddings(['test1'])
    await generateEmbeddings(['test2'])

    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })

  it('should handle batch embedding requests', async () => {
    const texts = ['text1', 'text2', 'text3', 'text4', 'text5']
    const embeddings = await generateEmbeddings(texts)

    expect(embeddings).toHaveLength(5)
    embeddings.forEach(embedding => {
      expect(embedding).toBeInstanceOf(Float32Array)
      expect(embedding.length).toBe(384)
    })
  })

  it('should timeout after specified duration', async () => {
    class NeverRespondingWorker extends EventTarget {
      postMessage(): void {
        // Never send response
      }
      terminate(): void {}
      addEventListener(type: string, listener: EventListener): void {
        super.addEventListener(type, listener)
      }
      removeEventListener(type: string, listener: EventListener): void {
        super.removeEventListener(type, listener)
      }
    }
    global.Worker = NeverRespondingWorker as unknown as typeof Worker

    await expect(
      coordinator.executeTask('embed', { texts: ['slow'] }, { timeout: 100 })
    ).rejects.toThrow('AI request timed out')
  })

  it('should report pool status', async () => {
    await generateEmbeddings(['test'])

    const status = coordinator.getStatus()

    expect(status.activeWorkers).toBeGreaterThan(0)
    expect(status.workers).toHaveLength(status.activeWorkers)
    expect(status.workers[0]).toMatchObject({
      id: expect.stringContaining('worker'),
      type: 'embed',
    })
  })

  // AC2: Idle termination after 60s
  it('AC2: terminates idle worker after 60s and respawns on next request', async () => {
    vi.useFakeTimers()

    // Spawn worker with a task
    const taskPromise = generateEmbeddings(['test'])
    await vi.advanceTimersByTimeAsync(15) // let mock respond (10ms delay)
    await taskPromise

    expect(coordinator.getStatus().activeWorkers).toBe(1)

    // Advance past 60s idle timeout — decrementActiveRequests schedules this
    await vi.advanceTimersByTimeAsync(60_001)

    expect(coordinator.getStatus().activeWorkers).toBe(0)

    // Next request should respawn the worker
    vi.useRealTimers()
    const embeddings = await generateEmbeddings(['respawn test'])
    expect(embeddings).toHaveLength(1)
    expect(coordinator.getStatus().activeWorkers).toBe(1)
  })

  // AC3: Visibility change terminates workers
  it('AC3: terminates workers when tab becomes hidden', async () => {
    await generateEmbeddings(['test'])
    expect(coordinator.getStatus().activeWorkers).toBe(1)

    // Simulate tab hidden
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(coordinator.getStatus().activeWorkers).toBe(0)

    // Restore
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true })
  })

  // AC3: terminate() rejects pending requests (B1 fix)
  it('AC3/B1: terminate() rejects in-flight requests instead of hanging', async () => {
    class NeverRespondingWorker extends EventTarget {
      postMessage(): void {}
      terminate(): void {}
      addEventListener(type: string, listener: EventListener): void {
        super.addEventListener(type, listener)
      }
      removeEventListener(type: string, listener: EventListener): void {
        super.removeEventListener(type, listener)
      }
    }
    global.Worker = NeverRespondingWorker as unknown as typeof Worker

    const taskPromise = coordinator.executeTask('embed', { texts: ['stuck'] })

    // Wait a tick for the worker to be spawned and request to be registered
    await new Promise(resolve => queueMicrotask(resolve as () => void))

    // Terminate while request is in-flight (simulates tab hide or page unload)
    coordinator.terminate()

    await expect(taskPromise).rejects.toThrow('Worker terminated')
  })

  // AC4: Worker crash rejects pending requests
  it('AC4: rejects pending requests when worker crashes', async () => {
    let workerInstance: EventTarget | null = null

    class CrashableWorker extends EventTarget {
      constructor(_url: string | URL, _options?: WorkerOptions) {
        super()
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        workerInstance = this
      }
      postMessage(): void {
        // Never responds normally — will be crashed via onerror
      }
      terminate(): void {}
      addEventListener(type: string, listener: EventListener): void {
        super.addEventListener(type, listener)
      }
      removeEventListener(type: string, listener: EventListener): void {
        super.removeEventListener(type, listener)
      }
    }
    global.Worker = CrashableWorker as unknown as typeof Worker

    const taskPromise = coordinator.executeTask('embed', { texts: ['crash-test'] })

    // Wait for worker to be spawned and registered
    await new Promise(resolve => queueMicrotask(resolve as () => void))
    await new Promise(resolve => setTimeout(resolve, 5))

    expect(workerInstance).not.toBeNull()

    // Simulate a worker crash via the error event
    workerInstance!.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Out of memory',
        error: new Error('Out of memory'),
      })
    )

    await expect(taskPromise).rejects.toThrow('Worker crashed')
    expect(coordinator.getStatus().activeWorkers).toBe(0)
  })

  // AC7: Worker crash probes Cache API and surfaces cacheUnavailable flag
  it('AC7: probes caches.has on worker crash and surfaces cacheUnavailable in CustomEvent', async () => {
    let workerInstance: EventTarget | null = null

    class CrashableWorker extends EventTarget {
      constructor(_url: string | URL, _options?: WorkerOptions) {
        super()
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        workerInstance = this
      }
      postMessage(): void {
        // Never responds — will be crashed via onerror
      }
      terminate(): void {}
      addEventListener(type: string, listener: EventListener): void {
        super.addEventListener(type, listener)
      }
      removeEventListener(type: string, listener: EventListener): void {
        super.removeEventListener(type, listener)
      }
    }
    global.Worker = CrashableWorker as unknown as typeof Worker

    // Mock caches.has to return true (cache available)
    const cacheHasSpy = vi.fn().mockResolvedValue(true)
    Object.defineProperty(globalThis, 'caches', {
      value: { has: cacheHasSpy },
      writable: true,
      configurable: true,
    })

    const taskPromise = coordinator.executeTask('embed', { texts: ['crash-test'] })
    taskPromise.catch(() => {}) // Suppress unhandled rejection; crash event rejects before expect below

    await new Promise(resolve => queueMicrotask(resolve as () => void))
    await new Promise(resolve => setTimeout(resolve, 5))

    expect(workerInstance).not.toBeNull()

    // Listen for worker-crash CustomEvent
    const crashEventSpy = vi.fn()
    window.addEventListener('worker-crash', crashEventSpy)

    // Simulate a worker crash via the error event
    workerInstance!.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Out of memory',
        error: new Error('Out of memory'),
      })
    )

    // Wait for the async crash handler including cache probe
    await new Promise(resolve => setTimeout(resolve, 10))

    await expect(taskPromise).rejects.toThrow('Worker crashed')
    expect(coordinator.getStatus().activeWorkers).toBe(0)

    // Verify caches.has was probed with the transformers cache name
    expect(cacheHasSpy).toHaveBeenCalledWith('transformers-cache')

    // Verify worker-crash event was dispatched with cacheUnavailable flag
    expect(crashEventSpy).toHaveBeenCalledTimes(1)
    const eventArg = crashEventSpy.mock.calls[0][0] as CustomEvent
    expect(eventArg.detail).toMatchObject({
      workerId: 'embed-worker',
      cacheUnavailable: false,
      provider: 'local',
    })
    expect(eventArg.detail.error).toBe('Out of memory')

    window.removeEventListener('worker-crash', crashEventSpy)

    // Clean up caches mock
    Object.defineProperty(globalThis, 'caches', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  })

  // AC7 variant: cache unavailable case
  it('AC7: sets cacheUnavailable=true when caches.has returns false', async () => {
    let workerInstance: EventTarget | null = null

    class CrashableWorker extends EventTarget {
      constructor(_url: string | URL, _options?: WorkerOptions) {
        super()
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        workerInstance = this
      }
      postMessage(): void {
        /* noop */
      }
      terminate(): void {}
      addEventListener(type: string, listener: EventListener): void {
        super.addEventListener(type, listener)
      }
      removeEventListener(type: string, listener: EventListener): void {
        super.removeEventListener(type, listener)
      }
    }
    global.Worker = CrashableWorker as unknown as typeof Worker

    // Mock caches.has to return false (cache unavailable)
    const cacheHasSpy = vi.fn().mockResolvedValue(false)
    Object.defineProperty(globalThis, 'caches', {
      value: { has: cacheHasSpy },
      writable: true,
      configurable: true,
    })

    const taskPromise = coordinator.executeTask('embed', { texts: ['crash-test'] })
    taskPromise.catch(() => {}) // Suppress unhandled rejection; crash event rejects before expect below

    await new Promise(resolve => queueMicrotask(resolve as () => void))
    await new Promise(resolve => setTimeout(resolve, 5))

    const crashEventSpy = vi.fn()
    window.addEventListener('worker-crash', crashEventSpy)

    workerInstance!.dispatchEvent(
      new ErrorEvent('error', {
        message: 'OOM',
        error: new Error('OOM'),
      })
    )

    await new Promise(resolve => setTimeout(resolve, 10))

    await expect(taskPromise).rejects.toThrow('Worker crashed')

    // Verify cacheUnavailable is true because caches.has returned false
    expect(crashEventSpy).toHaveBeenCalledTimes(1)
    const eventArg = crashEventSpy.mock.calls[0][0] as CustomEvent
    expect(eventArg.detail.cacheUnavailable).toBe(true)

    window.removeEventListener('worker-crash', crashEventSpy)

    Object.defineProperty(globalThis, 'caches', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  })

  // AC7 variant: cache unavailable when caches is undefined
  it('AC7: sets cacheUnavailable=true when Cache API is not available', async () => {
    let workerInstance: EventTarget | null = null

    class CrashableWorker extends EventTarget {
      constructor(_url: string | URL, _options?: WorkerOptions) {
        super()
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        workerInstance = this
      }
      postMessage(): void {
        /* noop */
      }
      terminate(): void {}
      addEventListener(type: string, listener: EventListener): void {
        super.addEventListener(type, listener)
      }
      removeEventListener(type: string, listener: EventListener): void {
        super.removeEventListener(type, listener)
      }
    }
    global.Worker = CrashableWorker as unknown as typeof Worker

    // Remove caches entirely (typeof caches === 'undefined')
    Object.defineProperty(globalThis, 'caches', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const taskPromise = coordinator.executeTask('embed', { texts: ['crash-test'] })
    taskPromise.catch(() => {}) // Suppress unhandled rejection; crash event rejects before expect below

    await new Promise(resolve => queueMicrotask(resolve as () => void))
    await new Promise(resolve => setTimeout(resolve, 5))

    const crashEventSpy = vi.fn()
    window.addEventListener('worker-crash', crashEventSpy)

    workerInstance!.dispatchEvent(
      new ErrorEvent('error', {
        message: 'OOM',
        error: new Error('OOM'),
      })
    )

    await new Promise(resolve => setTimeout(resolve, 10))

    await expect(taskPromise).rejects.toThrow('Worker crashed')

    expect(crashEventSpy).toHaveBeenCalledTimes(1)
    const eventArg = crashEventSpy.mock.calls[0][0] as CustomEvent
    expect(eventArg.detail.cacheUnavailable).toBe(true)

    window.removeEventListener('worker-crash', crashEventSpy)
  })

  // AC8: ONNX backend failure must report { reason: 'onnx-backend-failed' }
  it('AC8: preserves onnx-backend-failed reason in worker error response', async () => {
    class OnnxFailingWorker extends EventTarget {
      constructor(_url: string | URL, _options?: WorkerOptions) {
        super()
      }
      postMessage(message: unknown): void {
        const request = message as { requestId: string }
        // Simulate worker sending an error response carrying onnx-backend-failed
        setTimeout(() => {
          this.dispatchEvent(
            new MessageEvent('message', {
              data: {
                requestId: request.requestId,
                type: 'error',
                error: 'ONNX backend initialization failed',
                reason: 'onnx-backend-failed',
              },
            })
          )
        }, 5)
      }
      terminate(): void {}
      addEventListener(type: string, listener: EventListener): void {
        super.addEventListener(type, listener)
      }
      removeEventListener(type: string, listener: EventListener): void {
        super.removeEventListener(type, listener)
      }
    }
    global.Worker = OnnxFailingWorker as unknown as typeof Worker

    await expect(coordinator.executeTask('embed', { texts: ['test'] })).rejects.toThrow(
      'ONNX backend initialization failed'
    )
  })

  // AC5: Graceful degradation without Worker support
  it('AC5: throws gracefully when Worker API is unavailable', async () => {
    // @ts-expect-error simulate no Worker support
    delete global.Worker

    await expect(coordinator.executeTask('embed', { texts: ['test'] })).rejects.toThrow(
      'Web Workers are not supported'
    )
  })

  // E68-S01: Download progress events dispatched as CustomEvent
  // AC5: Real Transformers.js progress_callback events lack a requestId,
  // so the test must NOT include requestId in the progress message.
  it('E68-S01: dispatches model-download-progress CustomEvent from worker progress messages (no requestId)', async () => {
    class ProgressReportingWorker extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: ErrorEvent) => void) | null = null

      constructor(
        public url: string | URL,
        public options?: WorkerOptions
      ) {
        super()
      }

      postMessage(message: unknown): void {
        const request = message as { requestId: string; type: string }

        // First send a progress update WITHOUT requestId, mimicking real
        // Transformers.js progress_callback behaviour (AC5).
        setTimeout(() => {
          this.dispatchEvent(
            new MessageEvent('message', {
              data: {
                // NOTE: no requestId — real progress_callback lacks it
                type: 'download-progress',
                status: 'progress',
                progress: 42,
                file: 'model.onnx',
                loaded: 4200000,
                total: 10000000,
              },
            })
          )
        }, 5)

        // Then send success response with requestId
        setTimeout(() => {
          const payload = (request as unknown as { payload: { texts: string[] } }).payload
          const embeddings = payload.texts.map(() => new Float32Array(384))

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

      terminate(): void {}
      addEventListener(type: string, listener: EventListener): void {
        super.addEventListener(type, listener)
      }
      removeEventListener(type: string, listener: EventListener): void {
        super.removeEventListener(type, listener)
      }
    }

    global.Worker = ProgressReportingWorker as unknown as typeof Worker

    const progressSpy = vi.fn()
    window.addEventListener('model-download-progress', progressSpy)

    await generateEmbeddings(['test progress'])

    // Should have received the progress event despite lacking requestId
    // (routeWorkerMessage checks isDownloadProgress BEFORE the requestId guard)
    expect(progressSpy).toHaveBeenCalledTimes(1)
    const eventArg = progressSpy.mock.calls[0][0] as CustomEvent
    expect(eventArg.detail).toMatchObject({
      progress: 42,
      status: 'progress',
      file: 'model.onnx',
    })

    window.removeEventListener('model-download-progress', progressSpy)
  })

  // E68-S01: warmUp() sends an embed request with a single space
  it('E68-S01: warmUpEmbeddingModel sends a no-op embed request', async () => {
    const spy = vi.spyOn(MockWorker.prototype, 'postMessage')

    await warmUpEmbeddingModel()

    // Worker should have received one message — verify by scanning all calls
    // instead of only checking the first, to stay resilient if warmUp ever
    // adds retry logic.
    expect(spy).toHaveBeenCalledTimes(1)
    const messages = spy.mock.calls.map(call => call[0]) as Array<{
      type: string
      payload: { texts: string[] }
    }>
    const embedMessage = messages.find(m => m.type === 'embed' && m.payload?.texts?.includes(' '))
    expect(embedMessage).toBeDefined()
    expect(embedMessage!.payload.texts).toEqual([' '])

    spy.mockRestore()
  })

  // E68-S01: warmUp() does not throw on error
  it('E68-S01: warmUpEmbeddingModel handles errors gracefully', async () => {
    class FailingWorker extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: ErrorEvent) => void) | null = null

      constructor(
        public url: string | URL,
        public options?: WorkerOptions
      ) {
        super()
      }

      postMessage(message: unknown): void {
        const request = message as { requestId: string }

        // Respond with error to trigger the catch in warmUp
        setTimeout(() => {
          this.dispatchEvent(
            new MessageEvent('message', {
              data: {
                requestId: request.requestId,
                type: 'error',
                error: 'Model download failed',
              },
            })
          )
        }, 5)
      }
      terminate(): void {}
      addEventListener(type: string, listener: EventListener): void {
        super.addEventListener(type, listener)
      }
      removeEventListener(type: string, listener: EventListener): void {
        super.removeEventListener(type, listener)
      }
    }
    global.Worker = FailingWorker as unknown as typeof Worker

    // Should not throw — warm up is best-effort
    await expect(warmUpEmbeddingModel()).resolves.toBeUndefined()
  })
})
