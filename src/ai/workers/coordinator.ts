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
 * - Timeout handling (5s default, per NFR26)
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
import { supportsWorkers } from '@/ai/lib/workerCapabilities'

// ============================================================================
// Configuration
// ============================================================================

const WORKER_POOL_CONFIG = {
  maxWorkers: 3,
  idleTimeout: 60_000, // Terminate idle workers after 60s
  maxRetries: 2,
  defaultTimeout: 5_000, // 5s per NFR26
  modelLoadTimeout: 10_000, // 10s for model loading (NFR26)
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
  workerId: string // tracks which worker owns this request for activeRequests decrement
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
   * The worker's message router (set up in spawnWorker) dispatches the response
   * to the correct pending request via requestId lookup.
   */
  private async sendMessage<T>(
    type: WorkerRequestType,
    requestId: string,
    payload: unknown,
    timeout: number
  ): Promise<T> {
    const worker = this.getOrCreateWorker(type)
    const workerId = this.getWorkerId(type)

    return new Promise<T>((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        this.decrementActiveRequests(workerId)
        reject(new Error('AI request timed out. Please try again.'))
      }, timeout)

      // Store pending request (with workerId for activeRequests tracking)
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutId,
        workerId,
      })

      // Send request — the persistent onmessage router in spawnWorker handles the response
      const request: WorkerRequest = { requestId, type, payload }
      worker.postMessage(request)

      // Update pool entry
      this.updateWorkerActivity(workerId)
    })
  }

  /**
   * Route incoming worker message to the correct pending request by requestId.
   * Set once per worker in spawnWorker — replaces per-request event listeners.
   */
  private routeWorkerMessage(event: MessageEvent): void {
    const response = event.data as WorkerResponse<unknown>
    if (!response?.requestId) return

    if (isSuccessResponse(response)) {
      this.resolvePendingRequest(response.requestId, response.result)
    } else if (isErrorResponse(response)) {
      this.rejectPendingRequest(response.requestId, new Error(response.error))
    }
  }

  /**
   * Get or create worker for task type.
   * Implements lazy loading and connection pooling.
   */
  private getOrCreateWorker(type: WorkerRequestType): Worker {
    if (!supportsWorkers()) {
      throw new Error('Web Workers are not supported in this browser. AI features are unavailable.')
    }

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

      // Persistent message router — single listener routes all responses by requestId
      worker.addEventListener('message', (event: MessageEvent) => {
        this.routeWorkerMessage(event)
      })

      // Global error handler — event.error can be null in cross-origin/security errors
      worker.addEventListener('error', event => {
        console.error('[Coordinator] Worker error:', event)
        this.handleWorkerError(
          type,
          event.error ?? new Error(event.message ?? 'Unknown worker error')
        )
      })

      return worker
    } catch (error) {
      console.error('[Coordinator] Failed to spawn worker:', error)
      throw new Error('Web Workers not supported in this browser')
    }
  }

  /**
   * Update worker activity timestamp and increment active request count.
   * Idle termination is scheduled by decrementActiveRequests when count reaches 0.
   */
  private updateWorkerActivity(workerId: string): void {
    const entry = this.pool.get(workerId)
    if (!entry) return

    entry.lastUsed = Date.now()
    entry.activeRequests++
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
   * Resolve pending request and decrement worker's active request count.
   */
  private resolvePendingRequest(requestId: string, result: unknown): void {
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return

    clearTimeout(pending.timeout)
    pending.resolve(result)
    this.pendingRequests.delete(requestId)
    this.decrementActiveRequests(pending.workerId)
  }

  /**
   * Reject pending request and decrement worker's active request count.
   */
  private rejectPendingRequest(requestId: string, error: Error): void {
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return

    clearTimeout(pending.timeout)
    pending.reject(error)
    this.pendingRequests.delete(requestId)
    this.decrementActiveRequests(pending.workerId)
  }

  /**
   * Decrement activeRequests counter and reschedule idle termination.
   */
  private decrementActiveRequests(workerId: string): void {
    const entry = this.pool.get(workerId)
    if (!entry) return

    entry.activeRequests = Math.max(0, entry.activeRequests - 1)
    this.scheduleIdleTermination(workerId)
  }

  /**
   * Handle worker error (crash, OOM, etc).
   * Dispatches 'worker-crash' custom event for app-level handlers (e.g., cloud fallback).
   */
  private handleWorkerError(type: WorkerRequestType, error: Error): void {
    const workerId = this.getWorkerId(type)
    const entry = this.pool.get(workerId)
    if (!entry) return

    // Terminate crashed worker
    entry.worker.terminate()
    this.pool.delete(workerId)
    this.clearIdleTimer(workerId)

    console.error(`[Coordinator] Worker ${workerId} crashed:`, error)

    // Dispatch custom event so other parts of the app can respond (e.g., switch to cloud fallback)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('worker-crash', {
          detail: { workerId, error: error?.message ?? 'Unknown error' },
        })
      )
    }

    // Reject all pending requests for this worker
    this.pendingRequests.forEach((pending, requestId) => {
      if (pending.workerId === workerId) {
        pending.reject(new Error('Worker crashed. Please try again.'))
        this.pendingRequests.delete(requestId)
      }
    })
  }

  /**
   * Terminate a specific worker type (useful for component unmount cleanup).
   */
  terminateWorkerType(type: WorkerRequestType): void {
    const workerId = this.getWorkerId(type)
    const entry = this.pool.get(workerId)
    if (entry) {
      entry.worker.terminate()
      this.pool.delete(workerId)
      this.clearIdleTimer(workerId)
      console.log(`[Coordinator] Manually terminated worker: ${workerId}`)
    }
  }

  /**
   * Get worker ID from task type.
   */
  private getWorkerId(type: WorkerRequestType): string {
    return `${type}-worker`
  }

  /**
   * Terminate all workers (cleanup on app unmount or tab hide).
   * Rejects all pending requests so callers don't hang indefinitely.
   */
  terminate(): void {
    this.pool.forEach((entry, workerId) => {
      entry.worker.terminate()
      console.log(`[Coordinator] Terminated worker: ${workerId}`)
    })
    this.pool.clear()

    // Reject all in-flight requests — callers must not hang after terminate()
    this.pendingRequests.forEach(pending => {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Worker terminated'))
    })
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

// Free memory when tab is hidden (tab switch, minimize, etc.)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('[Coordinator] Tab hidden — terminating workers to free memory')
      coordinator.terminate()
    }
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
