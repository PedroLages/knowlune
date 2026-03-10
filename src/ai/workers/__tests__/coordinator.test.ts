/**
 * Worker Coordinator Tests
 *
 * Tests worker pool management, message passing, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { coordinator, generateEmbeddings } from '../coordinator'

// Mock Worker API (Vitest runs in Node.js, no native Worker support)
global.Worker = class MockWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  constructor(
    public url: string | URL,
    public options?: WorkerOptions
  ) {
    super()
  }

  postMessage(message: unknown): void {
    // Simulate worker response after 10ms
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
} as unknown as typeof Worker

describe('WorkerCoordinator', () => {
  beforeEach(() => {
    // Reset coordinator state
    coordinator.terminate()
  })

  afterEach(() => {
    coordinator.terminate()
  })

  it('should spawn worker on first task', async () => {
    const embeddings = await generateEmbeddings(['test text'])

    expect(embeddings).toHaveLength(1)
    expect(embeddings[0]).toBeInstanceOf(Float32Array)
    expect(embeddings[0].length).toBe(384)
  })

  it('should reuse worker for subsequent tasks', async () => {
    const spy = vi.spyOn(global.Worker.prototype, 'postMessage')

    await generateEmbeddings(['test1'])
    await generateEmbeddings(['test2'])

    expect(spy).toHaveBeenCalledTimes(2)
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
    // Create a worker that never responds
    global.Worker = class SlowWorker extends EventTarget {
      postMessage(): void {
        // Never send response
      }
      terminate(): void {}
    } as unknown as typeof Worker

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
})
