/**
 * Worker Coordinator Tests
 *
 * Tests worker pool management, message passing, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { coordinator, generateEmbeddings } from '../coordinator'

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

  // AC5: Graceful degradation without Worker support
  it('AC5: throws gracefully when Worker API is unavailable', async () => {
    // @ts-expect-error simulate no Worker support
    delete global.Worker

    await expect(coordinator.executeTask('embed', { texts: ['test'] })).rejects.toThrow(
      'Web Workers are not supported'
    )
  })
})
