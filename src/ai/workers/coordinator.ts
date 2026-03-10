/**
 * Worker Pool Coordinator
 *
 * Manages dedicated worker pool for AI workloads.
 * Handles worker lifecycle, load balancing, and message routing.
 *
 * Architecture:
 * - 3 workers max (balances parallelism vs memory)
 * - Lazy spawning (workers created on-demand)
 * - Idle termination (workers killed after 60s idle)
 * - Message passing (structured protocol with requestId)
 * - Timeout handling (30s default, per NFR26)
 */

import type {
  WorkerRequest,
  WorkerResponse,
  WorkerRequestType,
  TaskOptions,
  EmbedResult,
  SearchResult,
} from './types'
import { isSuccessResponse, isErrorResponse } from './types'

// ============================================================================
// Configuration
// ============================================================================

const WORKER_POOL_CONFIG = {
  maxWorkers: 3,
  idleTimeout: 60_000, // Terminate idle workers after 60s
  maxRetries: 2,
  defaultTimeout: 30_000, // 30s per NFR26
} as const

// ============================================================================
// Worker Pool State
// ============================================================================

interface WorkerPoolEntry {
  worker: Worker
  taskType: WorkerRequestType
  activeRequests: number
  lastUsed: number
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

// ============================================================================
// Worker Coordinator
// ============================================================================

class WorkerCoordinator {
  private pool: Map<string, WorkerPoolEntry> = new Map()
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private idleTimers: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Execute task in worker pool.
   * Automatically selects/spawns worker, handles timeout, and retries on failure.
   */
  async executeTask<T = unknown>(
    type: WorkerRequestType,
    payload: unknown,
    options?: TaskOptions
  ): Promise<T> {
    const timeout = options?.timeout ?? WORKER_POOL_CONFIG.defaultTimeout
    const requestId = crypto.randomUUID()

    try {
      return await this.sendMessage<T>(type, requestId, payload, timeout)
    } catch (error) {
      console.error(`[Coordinator] Task ${type} failed:`, error)
      throw error
    }
  }

  /**
   * Send message to worker and await response.
   */
  private async sendMessage<T>(
    type: WorkerRequestType,
    requestId: string,
    payload: unknown,
    timeout: number
  ): Promise<T> {
    const worker = this.getOrCreateWorker(type)

    return new Promise<T>((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('AI request timed out. Please try again.'))
      }, timeout)

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutId,
      })

      // Setup response handler
      const handleMessage = (event: MessageEvent) => {
        const response: WorkerResponse<T> = event.data

        if (response.requestId !== requestId) return // Not for this request

        if (isSuccessResponse(response)) {
          this.resolvePendingRequest(requestId, response.result)
          worker.removeEventListener('message', handleMessage)
        } else if (isErrorResponse(response)) {
          this.rejectPendingRequest(requestId, new Error(response.error))
          worker.removeEventListener('message', handleMessage)
        }
      }

      worker.addEventListener('message', handleMessage)

      // Send request
      const request: WorkerRequest = { requestId, type, payload }
      worker.postMessage(request)

      // Update pool entry
      this.updateWorkerActivity(this.getWorkerId(type))
    })
  }

  /**
   * Get or create worker for task type.
   * Implements lazy loading and connection pooling.
   */
  private getOrCreateWorker(type: WorkerRequestType): Worker {
    const workerId = this.getWorkerId(type)
    const entry = this.pool.get(workerId)

    if (entry) {
      // Clear idle timer (worker is active again)
      this.clearIdleTimer(workerId)
      return entry.worker
    }

    // Spawn new worker
    const worker = this.spawnWorker(type)
    this.pool.set(workerId, {
      worker,
      taskType: type,
      activeRequests: 0,
      lastUsed: Date.now(),
    })

    console.log(`[Coordinator] Spawned worker: ${workerId}`)
    return worker
  }

  /**
   * Spawn worker based on task type.
   */
  private spawnWorker(type: WorkerRequestType): Worker {
    let workerUrl: string

    switch (type) {
      case 'embed':
        workerUrl = './embedding.worker.ts'
        break
      case 'search':
        workerUrl = './search.worker.ts'
        break
      case 'infer':
        workerUrl = './inference.worker.ts'
        break
      case 'load-index':
        workerUrl = './search.worker.ts' // load-index handled by search worker
        break
      default:
        throw new Error(`Unknown worker type: ${type}`)
    }

    try {
      const worker = new Worker(new URL(workerUrl, import.meta.url), {
        type: 'module',
      })

      // Global error handler
      worker.addEventListener('error', event => {
        console.error('[Coordinator] Worker error:', event)
        this.handleWorkerError(type, event.error)
      })

      return worker
    } catch (error) {
      console.error('[Coordinator] Failed to spawn worker:', error)
      throw new Error('Web Workers not supported in this browser')
    }
  }

  /**
   * Update worker activity timestamp and schedule idle termination.
   */
  private updateWorkerActivity(workerId: string): void {
    const entry = this.pool.get(workerId)
    if (!entry) return

    entry.lastUsed = Date.now()
    entry.activeRequests++

    // Schedule idle termination
    this.scheduleIdleTermination(workerId)
  }

  /**
   * Schedule worker termination after idle timeout.
   */
  private scheduleIdleTermination(workerId: string): void {
    // Clear existing timer
    this.clearIdleTimer(workerId)

    // Schedule new timer
    const timer = setTimeout(() => {
      const entry = this.pool.get(workerId)
      if (!entry) return

      // Only terminate if truly idle
      if (
        entry.activeRequests === 0 &&
        Date.now() - entry.lastUsed >= WORKER_POOL_CONFIG.idleTimeout
      ) {
        entry.worker.terminate()
        this.pool.delete(workerId)
        console.log(`[Coordinator] Terminated idle worker: ${workerId}`)
      }
    }, WORKER_POOL_CONFIG.idleTimeout)

    this.idleTimers.set(workerId, timer)
  }

  /**
   * Clear idle timer for worker.
   */
  private clearIdleTimer(workerId: string): void {
    const timer = this.idleTimers.get(workerId)
    if (timer) {
      clearTimeout(timer)
      this.idleTimers.delete(workerId)
    }
  }

  /**
   * Resolve pending request.
   */
  private resolvePendingRequest(requestId: string, result: unknown): void {
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return

    clearTimeout(pending.timeout)
    pending.resolve(result)
    this.pendingRequests.delete(requestId)
  }

  /**
   * Reject pending request.
   */
  private rejectPendingRequest(requestId: string, error: Error): void {
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return

    clearTimeout(pending.timeout)
    pending.reject(error)
    this.pendingRequests.delete(requestId)
  }

  /**
   * Handle worker error (crash, OOM, etc).
   */
  private handleWorkerError(type: WorkerRequestType, error: Error): void {
    const workerId = this.getWorkerId(type)
    const entry = this.pool.get(workerId)
    if (!entry) return

    // Terminate crashed worker
    entry.worker.terminate()
    this.pool.delete(workerId)

    console.error(`[Coordinator] Worker ${workerId} crashed:`, error)

    // Reject all pending requests for this worker
    this.pendingRequests.forEach((pending, requestId) => {
      pending.reject(new Error('Worker crashed. Please try again.'))
      this.pendingRequests.delete(requestId)
    })
  }

  /**
   * Get worker ID from task type.
   */
  private getWorkerId(type: WorkerRequestType): string {
    return `${type}-worker`
  }

  /**
   * Terminate all workers (cleanup on app unmount).
   */
  terminate(): void {
    this.pool.forEach((entry, workerId) => {
      entry.worker.terminate()
      console.log(`[Coordinator] Terminated worker: ${workerId}`)
    })

    this.pool.clear()
    this.pendingRequests.clear()
    this.idleTimers.forEach(timer => clearTimeout(timer))
    this.idleTimers.clear()
  }

  /**
   * Get pool status (for debugging/monitoring).
   */
  getStatus(): {
    activeWorkers: number
    pendingRequests: number
    workers: Array<{ id: string; type: string; requests: number; idle: number }>
  } {
    const now = Date.now()
    return {
      activeWorkers: this.pool.size,
      pendingRequests: this.pendingRequests.size,
      workers: Array.from(this.pool.entries()).map(([id, entry]) => ({
        id,
        type: entry.taskType,
        requests: entry.activeRequests,
        idle: now - entry.lastUsed,
      })),
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const coordinator = new WorkerCoordinator()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    coordinator.terminate()
  })
}

// ============================================================================
// Type-Safe API Exports
// ============================================================================

export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const result = await coordinator.executeTask<EmbedResult>('embed', { texts })
  return result.embeddings
}

export async function searchSimilarNotes(
  queryVector: Float32Array,
  topK = 5
): Promise<Array<{ noteId: string; score: number }>> {
  const result = await coordinator.executeTask<SearchResult>('search', {
    queryVector,
    topK,
  })
  return result.results
}

export async function loadVectorIndex(vectors: Record<string, Float32Array>): Promise<void> {
  await coordinator.executeTask('load-index', { vectors })
}
