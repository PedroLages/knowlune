# Epic 9 Web Worker Architecture Design

**Version:** 1.0
**Date:** 2026-03-10
**Status:** Design Proposal
**Author:** Architecture Team
**Epic:** Epic 9 - AI Infrastructure & Platform

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Worker Pool Management](#worker-pool-management)
4. [Message Passing Protocol](#message-passing-protocol)
5. [State Synchronization](#state-synchronization)
6. [Memory Management](#memory-management)
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Integration with Existing Stack](#integration-with-existing-stack)
9. [Testing Strategy](#testing-strategy)
10. [Performance Characteristics](#performance-characteristics)
11. [Migration Path](#migration-path)

---

## Executive Summary

Epic 9 requires AI workloads (embedding generation, vector search, LLM inference) to run off the main thread to prevent UI freezing. This document defines a **worker-based architecture** using Web Workers with the following key characteristics:

**Design Principles:**
- **3-worker pool** (embed, search, infer) with lazy initialization
- **Structured message protocol** with requestId-based async tracking
- **Zero-copy transfers** via Transferable objects for large data
- **Graceful degradation** when workers unavailable (fallback to main thread with throttling)
- **Memory ceiling**: 3GB total across all workers with auto-downgrade
- **Integration**: Workers access Dexie via Comlink proxies, Zustand via serialized snapshots

**Architecture Decision:**
- ✅ **Dedicated workers** (1 per task type) vs shared worker pool
- ✅ **Direct postMessage** for simple payloads, **Comlink** for complex async APIs
- ✅ **IndexedDB access in workers** via Comlink-wrapped Dexie instances
- ✅ **Event-driven state sync** from workers → Zustand (one-way flow)

---

## Architecture Overview

### 1.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Main Thread                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐       ┌──────────────────┐                    │
│  │  React UI       │       │  Zustand Stores  │                    │
│  │  Components     │◄──────┤  (useNoteStore)  │                    │
│  └────────┬────────┘       └────────┬─────────┘                    │
│           │                         │                               │
│           │ AI requests             │ State updates                 │
│           ▼                         ▼                               │
│  ┌─────────────────────────────────────────────┐                   │
│  │     WorkerCoordinator (Singleton)           │                   │
│  │  - Task routing & load balancing            │                   │
│  │  - RequestId tracking (async promises)      │                   │
│  │  - Worker lifecycle (spawn/idle/terminate)  │                   │
│  │  - Timeout & retry logic                    │                   │
│  └────────┬────────────────────────────────────┘                   │
│           │                                                          │
│           │ postMessage({ requestId, type, payload })               │
│           │                                                          │
├───────────┼──────────────────────────────────────────────────────────┤
│           │                   Worker Boundary                        │
├───────────┼──────────────────────────────────────────────────────────┤
│           │                                                          │
│  ┌────────▼──────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Embedding Worker  │  │  Search Worker   │  │ Inference Worker │ │
│  │ (embed)           │  │  (search,        │  │ (infer)          │ │
│  │                   │  │   load-index)    │  │                  │ │
│  │ - Transformers.js │  │ - MeMemo HNSW    │  │ - WebLLM         │ │
│  │ - all-MiniLM-L6-v2│  │ - Vector index   │  │ - Llama/Phi-3    │ │
│  │ - 384-dim vectors │  │ - Cosine search  │  │ - Streaming      │ │
│  │                   │  │                  │  │                  │ │
│  │ Comlink Proxy:    │  │ Comlink Proxy:   │  │ Comlink Proxy:   │ │
│  │ ┌───────────────┐ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │ │
│  │ │ Dexie (notes) │ │  │ │ Dexie (notes)│ │  │ │ Dexie (notes)│ │ │
│  │ └───────────────┘ │  │ └──────────────┘ │  │ └──────────────┘ │ │
│  └───────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      IndexedDB (ElearningDB)                         │
│  - Notes (full-text + embeddings)                                    │
│  - Courses (metadata)                                                │
│  - Vector index (serialized HNSW graph)                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 Worker Types & Responsibilities

| Worker Type | Task Types | Library | Memory Budget | Idle Timeout |
|-------------|------------|---------|---------------|--------------|
| **Embedding** | `embed` | @xenova/transformers (23MB model) | ~150MB | 60s |
| **Search** | `search`, `load-index` | MeMemo HNSW | ~100MB (10k vectors) | 60s |
| **Inference** | `infer` | @mlc-ai/web-llm (664MB-1.3GB model) | ~2GB | 60s |

**Total Memory Ceiling:** 3GB (per NFR26 - Epic 9)

### 1.3 Worker Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                     Worker Lifecycle                              │
└──────────────────────────────────────────────────────────────────┘

[Not Spawned]
      │
      │ First task request
      ▼
[Spawning] ──► [Initializing] ──► [Ready]
      │             │                │
      │ Fail        │ Timeout        │ Task request
      ▼             ▼                ▼
[Error] ──────────────────────► [Active] ◄────┐
                                     │         │
                                     │ Idle    │ New task
                                     ▼         │
                                 [Idle] ───────┘
                                     │
                                     │ 60s timeout
                                     ▼
                              [Terminated]
```

**State Transitions:**
1. **Not Spawned** → **Spawning**: First task request arrives
2. **Spawning** → **Initializing**: Worker.postMessage() succeeds
3. **Initializing** → **Ready**: Worker responds to "ping" message
4. **Ready** → **Active**: Processing task
5. **Active** → **Idle**: Task complete, no pending requests
6. **Idle** → **Terminated**: 60s timeout expires
7. **Error** (any state): Worker crashes, OOM, or unhandled error

---

## Worker Pool Management

### 2.1 Pool Configuration

```typescript
const WORKER_POOL_CONFIG = {
  maxWorkers: 3,              // 1 per task type (embed, search, infer)
  idleTimeout: 60_000,        // Terminate idle workers after 60s
  maxRetries: 2,              // Retry failed tasks twice
  defaultTimeout: 30_000,     // 30s task timeout (per NFR26)
  maxConcurrentTasks: 1,      // 1 task per worker (no queueing)
} as const
```

### 2.2 Lazy Worker Spawning

Workers are **not** created on app load. Instead, they spawn on-demand when the first task arrives:

```typescript
class WorkerCoordinator {
  private pool: Map<string, WorkerPoolEntry> = new Map()

  private getOrCreateWorker(type: WorkerRequestType): Worker {
    const workerId = this.getWorkerId(type) // e.g., "embed-worker"
    const entry = this.pool.get(workerId)

    if (entry) {
      this.clearIdleTimer(workerId) // Reactivate idle worker
      return entry.worker
    }

    // Spawn new worker (lazy)
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
        workerUrl = './search.worker.ts' // Reuse search worker
        break
      default:
        throw new Error(`Unknown worker type: ${type}`)
    }

    try {
      const worker = new Worker(new URL(workerUrl, import.meta.url), {
        type: 'module', // ES module support
      })

      worker.addEventListener('error', (event) => {
        console.error('[Coordinator] Worker error:', event)
        this.handleWorkerError(type, event.error)
      })

      return worker
    } catch (error) {
      console.error('[Coordinator] Failed to spawn worker:', error)
      throw new Error('Web Workers not supported in this browser')
    }
  }
}
```

**Rationale:**
- **Memory savings**: Don't load 23MB embedding model until user creates first note
- **Startup performance**: Main thread stays responsive on app load
- **Browser compatibility**: Worker support detected lazily (fail gracefully)

### 2.3 Idle Worker Termination

Workers auto-terminate after 60s of inactivity to reclaim memory:

```typescript
private scheduleIdleTermination(workerId: string): void {
  this.clearIdleTimer(workerId) // Clear existing timer

  const timer = setTimeout(() => {
    const entry = this.pool.get(workerId)
    if (!entry) return

    // Only terminate if truly idle (no active requests)
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
```

**Memory Impact:**
- Embedding worker: ~150MB reclaimed after 60s idle
- Inference worker: ~2GB reclaimed after 60s idle (critical for mobile)

### 2.4 Load Balancing

**Strategy: Dedicated workers (no load balancing)**

Each task type maps to exactly 1 worker. No queuing or round-robin needed.

**Rationale:**
- **Simplicity**: No queue management, priority logic, or starvation concerns
- **Memory predictability**: Always know exactly which models are loaded
- **Task isolation**: Embedding worker crash doesn't affect search worker

**Alternative considered (rejected):**
- Shared worker pool (3 generic workers, any task type)
  - ❌ Requires dynamically loading models in each worker (memory waste)
  - ❌ Queue management complexity (priority, FIFO, starvation)
  - ❌ Less predictable memory usage

---

## Message Passing Protocol

### 3.1 Message Structure

All worker communication uses a **structured protocol** with `requestId` for async tracking:

```typescript
// ============================================================================
// Request (Main → Worker)
// ============================================================================

interface WorkerRequest<T = unknown> {
  requestId: string      // UUID for tracking async requests
  type: WorkerRequestType // 'embed' | 'search' | 'infer' | 'load-index'
  payload: T             // Task-specific data
  timeout?: number       // Override default 30s timeout
}

// ============================================================================
// Response (Worker → Main)
// ============================================================================

type WorkerResponse<T = unknown> =
  | WorkerSuccessResponse<T>
  | WorkerErrorResponse
  | WorkerStreamChunk
  | WorkerProgressUpdate

interface WorkerSuccessResponse<T> {
  requestId: string
  type: 'success'
  result: T
}

interface WorkerErrorResponse {
  requestId: string
  type: 'error'
  error: string // Human-readable error message
}

interface WorkerStreamChunk {
  requestId: string
  type: 'stream-chunk' | 'stream-end'
  chunk?: string // Only present for 'stream-chunk'
}

interface WorkerProgressUpdate {
  type: 'download-progress'
  progress: number // 0-100 (for model downloads)
}
```

### 3.2 Request/Response Flow

```typescript
// ============================================================================
// Main Thread: Send request and await response
// ============================================================================

async function sendMessage<T>(
  type: WorkerRequestType,
  payload: unknown,
  timeout: number
): Promise<T> {
  const worker = this.getOrCreateWorker(type)
  const requestId = crypto.randomUUID()

  return new Promise<T>((resolve, reject) => {
    // 1. Set timeout
    const timeoutId = setTimeout(() => {
      this.pendingRequests.delete(requestId)
      reject(new Error('AI request timed out. Please try again.'))
    }, timeout)

    // 2. Store pending request
    this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutId })

    // 3. Setup response handler
    const handleMessage = (event: MessageEvent) => {
      const response: WorkerResponse<T> = event.data

      if (response.requestId !== requestId) return // Not our response

      if (response.type === 'success') {
        clearTimeout(timeoutId)
        resolve(response.result)
        this.pendingRequests.delete(requestId)
        worker.removeEventListener('message', handleMessage)
      } else if (response.type === 'error') {
        clearTimeout(timeoutId)
        reject(new Error(response.error))
        this.pendingRequests.delete(requestId)
        worker.removeEventListener('message', handleMessage)
      }
    }

    worker.addEventListener('message', handleMessage)

    // 4. Send request
    const request: WorkerRequest = { requestId, type, payload }
    worker.postMessage(request)
  })
}
```

```typescript
// ============================================================================
// Worker: Receive request, process, and respond
// ============================================================================

self.onmessage = async (e: MessageEvent) => {
  const request = e.data as WorkerRequest<EmbedPayload>
  const { requestId, type, payload } = request

  if (type !== 'embed') {
    const errorResponse: WorkerErrorResponse = {
      requestId,
      type: 'error',
      error: `Unknown request type: ${type}`,
    }
    self.postMessage(errorResponse)
    return
  }

  try {
    const { texts } = payload
    const embeddings = await generateEmbeddings(texts)

    const successResponse: WorkerSuccessResponse<EmbedResult> = {
      requestId,
      type: 'success',
      result: { embeddings },
    }

    self.postMessage(successResponse)
  } catch (error) {
    const errorResponse: WorkerErrorResponse = {
      requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    self.postMessage(errorResponse)
  }
}
```

### 3.3 Transferable Objects (Zero-Copy)

For large data (embeddings, vectors), use **Transferable objects** to avoid copying:

```typescript
// ============================================================================
// Main → Worker: Transfer Float32Array (zero-copy)
// ============================================================================

const queryVector = new Float32Array(384) // 384-dim vector
const request: WorkerRequest = {
  requestId: crypto.randomUUID(),
  type: 'search',
  payload: { queryVector, topK: 5 },
}

worker.postMessage(request, [queryVector.buffer]) // Transfer ownership
// ⚠️ queryVector is now detached (can't access from main thread)
```

```typescript
// ============================================================================
// Worker → Main: Transfer embeddings (zero-copy)
// ============================================================================

const embeddings = await generateEmbeddings(texts) // Float32Array[]
const result: EmbedResult = { embeddings }

const buffers = embeddings.map(e => e.buffer)
self.postMessage(
  { requestId, type: 'success', result },
  buffers // Transfer all Float32Array buffers
)
```

**Performance Impact:**
- **Without transfer**: 10k vectors (10k × 384 × 4 bytes = 15MB) → ~50ms copy time
- **With transfer**: ~0ms (ownership transfer, no copy)

### 3.4 Streaming Responses (LLM Inference)

For long-running tasks (LLM text generation), use streaming:

```typescript
// ============================================================================
// Worker: Stream inference chunks back to main thread
// ============================================================================

async function streamInference(requestId: string, prompt: string) {
  const stream = await llmEngine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || ''

    // Send chunk
    self.postMessage({
      requestId,
      type: 'stream-chunk',
      chunk: text,
    } as WorkerStreamChunk)
  }

  // Signal end
  self.postMessage({
    requestId,
    type: 'stream-end',
  } as WorkerStreamChunk)
}
```

```typescript
// ============================================================================
// Main: Handle streaming responses
// ============================================================================

async function streamInfer(
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  const worker = this.getOrCreateWorker('infer')
  const requestId = crypto.randomUUID()

  return new Promise<void>((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      const response = event.data

      if (response.requestId !== requestId) return

      if (response.type === 'stream-chunk') {
        onChunk(response.chunk) // Update UI incrementally
      } else if (response.type === 'stream-end') {
        resolve()
        worker.removeEventListener('message', handleMessage)
      } else if (response.type === 'error') {
        reject(new Error(response.error))
        worker.removeEventListener('message', handleMessage)
      }
    }

    worker.addEventListener('message', handleMessage)
    worker.postMessage({ requestId, type: 'infer', payload: { prompt, stream: true } })
  })
}
```

---

## State Synchronization

### 4.1 Architecture Pattern: One-Way Data Flow

**Problem:** Workers need to read from Dexie and update Zustand stores, but:
- Workers can't directly access main-thread objects (no shared memory)
- Zustand stores live on main thread only
- Dexie IndexedDB is accessible from both threads

**Solution: Event-driven one-way flow**

```
Worker reads from Dexie ──► Worker processes data ──► Worker posts result
                                                             │
                                                             ▼
Main thread receives result ──► Main thread updates Zustand
                                                             │
                                                             ▼
                                            React components re-render
```

### 4.2 Dexie Access in Workers (via Comlink)

**Option 1: Direct Dexie Access (Recommended)**

Workers instantiate their own Dexie connection:

```typescript
// ============================================================================
// Worker: Direct Dexie access
// ============================================================================

import Dexie from 'dexie'
import type { Note } from '@/data/types'

const db = new Dexie('ElearningDB') as Dexie & {
  notes: EntityTable<Note, 'id'>
}

db.version(8).stores({
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
})

// Worker can now query IndexedDB directly
const notes = await db.notes.where({ courseId }).toArray()
```

**Pros:**
- ✅ Simple (no proxy layer)
- ✅ Full Dexie API available
- ✅ No serialization overhead

**Cons:**
- ⚠️ Schema must stay in sync between main/worker (mitigated by shared types)

**Option 2: Comlink Proxy (Future Enhancement)**

If workers need complex main-thread APIs (e.g., Zustand subscriptions):

```typescript
// ============================================================================
// Main Thread: Expose Dexie via Comlink
// ============================================================================

import { expose } from 'comlink'

const dbApi = {
  getNotes: (courseId: string) => db.notes.where({ courseId }).toArray(),
  addNote: (note: Note) => db.notes.add(note),
}

expose(dbApi)
```

```typescript
// ============================================================================
// Worker: Call Dexie via Comlink proxy
// ============================================================================

import { wrap } from 'comlink'

const dbApi = wrap(self) // Wrap main thread as proxy
const notes = await dbApi.getNotes('course-123') // Async RPC call
```

**Verdict:** Use **Option 1** (direct access) for Epic 9. Defer Comlink to Epic 9B if needed.

### 4.3 Zustand Updates from Workers

Workers **cannot** directly update Zustand stores. Instead, use event-driven pattern:

```typescript
// ============================================================================
// Worker: Post result to main thread
// ============================================================================

const embeddings = await generateEmbeddings(texts)

// Send result back to coordinator
self.postMessage({
  requestId,
  type: 'success',
  result: { embeddings },
})

// Optionally: Dispatch custom event for side effects
self.postMessage({
  type: 'embedding-complete',
  noteId: 'note-123',
  embedding: embeddings[0],
})
```

```typescript
// ============================================================================
// Main Thread: Listen for worker events and update Zustand
// ============================================================================

worker.addEventListener('message', (event) => {
  const response = event.data

  if (response.type === 'embedding-complete') {
    // Update Zustand store
    useNoteStore.getState().updateNoteEmbedding(response.noteId, response.embedding)
  }
})
```

**Alternative: Custom event bus**

```typescript
// ============================================================================
// Main Thread: Listen for custom events
// ============================================================================

window.addEventListener('embedding-indexed', ((event: CustomEvent) => {
  const { noteId, embedding } = event.detail
  useNoteStore.getState().updateNoteEmbedding(noteId, embedding)
}) as EventListener)
```

### 4.4 State Snapshot Pattern (Worker Reads)

If workers need Zustand state (rare), serialize snapshot via postMessage:

```typescript
// ============================================================================
// Main Thread: Send Zustand snapshot to worker
// ============================================================================

const currentNotes = useNoteStore.getState().notes // Serialize state
worker.postMessage({
  requestId: crypto.randomUUID(),
  type: 'embed',
  payload: {
    texts: currentNotes.map(n => n.content),
  },
})
```

**⚠️ Important:** Never send non-serializable data (functions, Proxies, DOM nodes) to workers.

---

## Memory Management

### 5.1 Memory Budget (3GB Ceiling)

| Component | Budget | Justification |
|-----------|--------|---------------|
| **Embedding Worker** | 150MB | all-MiniLM-L6-v2 model (23MB) + WASM runtime (50MB) + buffers |
| **Search Worker** | 100MB | HNSW index (10k vectors × 384 × 4 bytes ≈ 15MB) + graph overhead |
| **Inference Worker** | 2GB | Llama 3.2 1B model (664MB) or Phi-3.5 (1.3GB) + WebGPU buffers |
| **Main Thread** | 750MB | React UI, Dexie, Zustand, video player, PDF viewer |
| **Total** | 3GB | Per NFR26 - Epic 9 |

### 5.2 Memory Monitoring

Track worker memory usage via `performance.memory` (Chrome DevTools API):

```typescript
// ============================================================================
// Worker: Report memory usage periodically
// ============================================================================

setInterval(() => {
  if ('memory' in performance) {
    const usage = (performance as any).memory.usedJSHeapSize / 1024 / 1024
    self.postMessage({
      type: 'memory-report',
      usage: Math.round(usage), // MB
    })
  }
}, 10_000) // Report every 10s
```

```typescript
// ============================================================================
// Main Thread: Aggregate worker memory
// ============================================================================

let workerMemory = { embed: 0, search: 0, infer: 0 }

worker.addEventListener('message', (event) => {
  if (event.data.type === 'memory-report') {
    workerMemory[event.data.workerId] = event.data.usage

    const totalWorkerMemory = Object.values(workerMemory).reduce((a, b) => a + b, 0)

    if (totalWorkerMemory > 3000) {
      console.warn('[Memory] Worker memory exceeds 3GB ceiling:', totalWorkerMemory)
      // Trigger auto-downgrade (see 5.3)
    }
  }
})
```

### 5.3 Auto-Downgrade Strategy

When memory exceeds 3GB, downgrade models to smaller variants:

```typescript
// ============================================================================
// Memory pressure handling
// ============================================================================

const MODEL_TIERS = {
  high: {
    embedding: 'all-MiniLM-L6-v2',   // 384-dim, 23MB
    llm: 'Llama-3.2-1B-Instruct',    // 664MB
  },
  medium: {
    embedding: 'all-MiniLM-L6-v2',   // Same (no smaller variant)
    llm: 'Phi-3.5-mini-instruct',    // 1.3GB (paradoxically larger - skip)
  },
  low: {
    embedding: 'all-MiniLM-L6-v2',   // Same
    llm: 'disabled',                 // Fall back to cloud API
  },
}

async function handleMemoryPressure() {
  console.warn('[Memory] Pressure detected, downgrading to cloud API fallback')

  // Terminate inference worker
  const inferWorker = this.pool.get('infer-worker')
  if (inferWorker) {
    inferWorker.worker.terminate()
    this.pool.delete('infer-worker')
  }

  // Switch to cloud API (via ai SDK)
  useAIStore.getState().setProvider('cloud')
}
```

**Fallback Tiers:**
1. **WebGPU local** (Llama 3.2 1B) - Best UX, 2GB memory
2. **Ollama localhost** (if running) - Good UX, 0MB browser memory
3. **Cloud API** (Anthropic/OpenAI) - Requires API key, costs money, privacy concerns

### 5.4 Transferable Objects vs Cloning

Prefer **Transferable** for large data to avoid memory duplication:

```typescript
// ❌ BAD: postMessage clones data (2x memory usage)
const embeddings = new Float32Array(10_000 * 384) // 15MB
worker.postMessage({ embeddings }) // Clone = 15MB main + 15MB worker = 30MB total

// ✅ GOOD: Transfer ownership (1x memory usage)
const embeddings = new Float32Array(10_000 * 384) // 15MB
worker.postMessage({ embeddings }, [embeddings.buffer]) // Transfer = 15MB worker only
// ⚠️ embeddings is now detached on main thread
```

**Transferable Types:**
- `ArrayBuffer`
- `MessagePort`
- `ImageBitmap`
- `OffscreenCanvas`

**Non-Transferable (must clone):**
- Plain objects `{}`
- Strings
- Numbers
- Arrays of primitives

### 5.5 Model Caching Strategy

**IndexedDB Cache:**
- Transformers.js: Auto-caches models in IndexedDB (via @xenova/transformers)
- WebLLM: Auto-caches models in IndexedDB (via @mlc-ai/web-llm)
- MeMemo HNSW: Manual cache (serialize index to IndexedDB)

```typescript
// ============================================================================
// Cache HNSW index in IndexedDB
// ============================================================================

async function saveVectorIndex(index: HNSWIndex) {
  const serialized = index.serialize() // Returns ArrayBuffer
  await db.vectorCache.put({
    id: 'hnsw-index-v1',
    data: serialized,
    createdAt: new Date().toISOString(),
  })
}

async function loadVectorIndex(): Promise<HNSWIndex | null> {
  const cached = await db.vectorCache.get('hnsw-index-v1')
  if (!cached) return null

  const index = HNSWIndex.deserialize(cached.data)
  return index
}
```

**Storage Quota Management:**
- Request persistent storage: `navigator.storage.persist()`
- Monitor quota: `navigator.storage.estimate()`
- Evict old caches if quota exceeded

---

## Error Handling & Recovery

### 6.1 Error Categories

| Error Type | Example | Recovery Strategy |
|------------|---------|-------------------|
| **Worker Crash** | OOM, segfault, infinite loop | Terminate worker, retry task once, then fallback to cloud API |
| **Timeout** | Task exceeds 30s | Cancel task, show user-facing error, offer retry |
| **Model Load Failure** | Network error, quota exceeded | Show error toast, offer manual retry, cache for offline |
| **Invalid Payload** | Wrong data type, missing field | Throw error immediately (developer mistake) |
| **Browser Unsupported** | No Web Worker support | Fallback to main thread (throttled), show banner |

### 6.2 Worker Crash Handling

```typescript
// ============================================================================
// Coordinator: Handle worker crash
// ============================================================================

private handleWorkerError(type: WorkerRequestType, error: Error): void {
  const workerId = this.getWorkerId(type)
  const entry = this.pool.get(workerId)
  if (!entry) return

  console.error(`[Coordinator] Worker ${workerId} crashed:`, error)

  // 1. Terminate crashed worker
  entry.worker.terminate()
  this.pool.delete(workerId)

  // 2. Reject all pending requests for this worker
  this.pendingRequests.forEach((pending, requestId) => {
    pending.reject(new Error('Worker crashed. Please try again.'))
    this.pendingRequests.delete(requestId)
  })

  // 3. Show user-facing error
  window.dispatchEvent(
    new CustomEvent('worker-crash', {
      detail: { workerId, error: error.message },
    })
  )
}
```

```typescript
// ============================================================================
// React: Listen for worker crashes
// ============================================================================

useEffect(() => {
  const handleCrash = ((event: CustomEvent) => {
    const { workerId, error } = event.detail
    toast.error(`AI service crashed: ${error}. Switching to cloud fallback.`, {
      action: {
        label: 'Retry',
        onClick: () => coordinator.restartWorker(workerId),
      },
    })
  }) as EventListener

  window.addEventListener('worker-crash', handleCrash)
  return () => window.removeEventListener('worker-crash', handleCrash)
}, [])
```

### 6.3 Timeout Handling

Every task has a 30s default timeout (per NFR26):

```typescript
async executeTask<T>(
  type: WorkerRequestType,
  payload: unknown,
  options?: TaskOptions
): Promise<T> {
  const timeout = options?.timeout ?? WORKER_POOL_CONFIG.defaultTimeout

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      this.pendingRequests.delete(requestId)
      reject(new Error('AI request timed out. Please try again.'))
    }, timeout)

    // ... rest of implementation
  })
}
```

**User-facing errors:**
- "AI request timed out. Please try again."
- Offer retry button in toast

### 6.4 Retry Logic

Retry failed tasks up to 2 times with exponential backoff:

```typescript
async function executeWithRetry<T>(
  type: WorkerRequestType,
  payload: unknown,
  maxRetries = 2
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await coordinator.executeTask<T>(type, payload)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.warn(`[Coordinator] Task failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error)

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * 2 ** attempt, 5000) // 1s, 2s, 4s max
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw lastError
}
```

### 6.5 Graceful Degradation

If workers fail consistently, fallback to main thread (throttled):

```typescript
async function generateEmbeddingsWithFallback(texts: string[]): Promise<Float32Array[]> {
  try {
    // Try worker first
    return await coordinator.executeTask<Float32Array[]>('embed', { texts })
  } catch (error) {
    console.warn('[Coordinator] Worker failed, falling back to main thread:', error)

    // Fallback to main thread (throttled to avoid UI freeze)
    const embeddings: Float32Array[] = []
    for (const text of texts) {
      const embedding = await generateEmbeddingMainThread(text)
      embeddings.push(embedding)

      // Yield to main thread every 5 embeddings
      if (embeddings.length % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    return embeddings
  }
}
```

**⚠️ Warning:** Main thread fallback should be **throttled** to prevent UI freezing.

---

## Integration with Existing Stack

### 7.1 Zustand Integration

Workers **cannot** directly access Zustand stores. Use event-driven updates:

```typescript
// ============================================================================
// src/stores/useNoteStore.ts
// ============================================================================

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],

  // Existing methods...
  saveNote: async (note: Note) => {
    // 1. Save to Dexie (optimistic update)
    await db.notes.put(note)
    set({ notes: [...get().notes.filter(n => n.id !== note.id), note] })

    // 2. Generate embedding in worker (async)
    generateEmbeddings([note.content])
      .then(([embedding]) => {
        // 3. Update note with embedding
        return db.notes.update(note.id, { embedding })
      })
      .then(() => {
        // 4. Notify search worker to re-index
        window.dispatchEvent(
          new CustomEvent('note-indexed', { detail: { noteId: note.id } })
        )
      })
      .catch(error => {
        console.error('[NoteStore] Failed to generate embedding:', error)
        toast.error('AI indexing failed. Search may be incomplete.')
      })
  },
}))
```

### 7.2 Dexie Integration

Workers access Dexie directly (see Section 4.2):

```typescript
// ============================================================================
// src/ai/workers/embedding.worker.ts
// ============================================================================

import Dexie from 'dexie'
import type { Note } from '@/data/types'

const db = new Dexie('ElearningDB') as Dexie & {
  notes: EntityTable<Note, 'id'>
}

db.version(8).stores({
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
})

// Worker can query Dexie directly
const notes = await db.notes.where({ courseId }).toArray()
```

**Schema Sync Strategy:**
1. Share types via `@/data/types`
2. Workers use same schema version as main thread
3. No migrations in workers (read-only access recommended)

### 7.3 React Component Integration

React components call worker coordinator via type-safe API:

```typescript
// ============================================================================
// src/app/pages/Notes.tsx
// ============================================================================

import { generateEmbeddings, searchSimilarNotes } from '@/ai/workers/coordinator'

function NotesPage() {
  const [searchResults, setSearchResults] = useState<Note[]>([])

  async function handleSearch(query: string) {
    try {
      // 1. Generate query embedding
      const [queryVector] = await generateEmbeddings([query])

      // 2. Search vector index
      const results = await searchSimilarNotes(queryVector, 10)

      // 3. Fetch notes from Dexie
      const noteIds = results.map(r => r.noteId)
      const notes = await db.notes.bulkGet(noteIds)

      setSearchResults(notes.filter(Boolean) as Note[])
    } catch (error) {
      toast.error('Search failed. Please try again.')
      console.error('[NotesPage] Search error:', error)
    }
  }

  return (
    <div>
      <SearchBar onSearch={handleSearch} />
      <NoteList notes={searchResults} />
    </div>
  )
}
```

### 7.4 API Compatibility Layer

Provide consistent API regardless of execution context (worker vs main thread):

```typescript
// ============================================================================
// src/ai/embeddings.ts - Public API
// ============================================================================

export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  if (supportsWorkers()) {
    // Use worker
    return coordinator.executeTask<Float32Array[]>('embed', { texts })
  } else {
    // Fallback to main thread
    return generateEmbeddingsMainThread(texts)
  }
}

function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined'
}
```

---

## Testing Strategy

### 8.1 Unit Tests (Vitest)

Test coordinator logic without actual workers:

```typescript
// ============================================================================
// src/ai/workers/__tests__/coordinator.test.ts
// ============================================================================

import { describe, it, expect, vi } from 'vitest'
import { coordinator } from '../coordinator'

// Mock Worker constructor
global.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  terminate: vi.fn(),
}))

describe('WorkerCoordinator', () => {
  it('spawns worker on first task', async () => {
    const task = coordinator.executeTask('embed', { texts: ['hello'] })

    expect(global.Worker).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('embedding.worker') }),
      { type: 'module' }
    )
  })

  it('reuses worker for subsequent tasks', async () => {
    await coordinator.executeTask('embed', { texts: ['hello'] })
    await coordinator.executeTask('embed', { texts: ['world'] })

    expect(global.Worker).toHaveBeenCalledTimes(1) // Only spawned once
  })

  it('times out after 30s', async () => {
    const task = coordinator.executeTask('embed', { texts: ['test'] }, { timeout: 100 })

    await expect(task).rejects.toThrow('AI request timed out')
  })
})
```

### 8.2 Integration Tests (Playwright)

Test worker communication in real browser:

```typescript
// ============================================================================
// tests/e2e/ai-workers.spec.ts
// ============================================================================

import { test, expect } from '@playwright/test'

test('embedding worker generates vectors', async ({ page }) => {
  await page.goto('/notes')

  // Create note
  await page.fill('[data-testid="note-editor"]', 'Machine learning fundamentals')
  await page.click('[data-testid="save-note"]')

  // Wait for embedding generation (worker async)
  await page.waitForFunction(() => {
    return window.localStorage.getItem('embedding-complete') === 'true'
  })

  // Verify note is searchable
  await page.fill('[data-testid="search-input"]', 'ML basics')
  await page.keyboard.press('Enter')

  await expect(page.getByText('Machine learning fundamentals')).toBeVisible()
})
```

### 8.3 Worker Mocking Strategy

For E2E tests, mock worker responses to ensure determinism:

```typescript
// ============================================================================
// tests/support/helpers/mock-workers.ts
// ============================================================================

export async function mockEmbeddingWorker(page: Page) {
  await page.addInitScript(() => {
    // Override Worker constructor
    const OriginalWorker = window.Worker

    window.Worker = class MockWorker extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)

        // Intercept postMessage and respond with mock data
        this.postMessage = (message: any) => {
          const { requestId, type, payload } = message

          if (type === 'embed') {
            // Return deterministic fake embeddings
            const embeddings = payload.texts.map(() => new Float32Array(384))

            setTimeout(() => {
              this.dispatchEvent(
                new MessageEvent('message', {
                  data: {
                    requestId,
                    type: 'success',
                    result: { embeddings },
                  },
                })
              )
            }, 100) // Simulate async delay
          }
        }
      }
    } as any
  })
}
```

### 8.4 Performance Testing

Benchmark worker performance vs main thread:

```typescript
// ============================================================================
// tests/performance/embedding-benchmark.ts
// ============================================================================

import { generateEmbeddings } from '@/ai/workers/coordinator'

async function benchmarkEmbeddings() {
  const texts = Array.from({ length: 100 }, (_, i) => `Test text ${i}`)

  // Worker-based
  const workerStart = performance.now()
  await generateEmbeddings(texts)
  const workerTime = performance.now() - workerStart

  // Main thread
  const mainStart = performance.now()
  await generateEmbeddingsMainThread(texts)
  const mainTime = performance.now() - mainStart

  console.log('Worker time:', workerTime, 'ms')
  console.log('Main thread time:', mainTime, 'ms')
  console.log('Speedup:', (mainTime / workerTime).toFixed(2) + 'x')
}
```

**Expected Results:**
- Worker time: ~5000ms (100 texts × 50ms)
- Main thread time: ~8000ms (includes UI blocking)
- Speedup: ~1.6x

---

## Performance Characteristics

### 9.1 Latency Benchmarks (Target)

| Operation | Worker | Main Thread | Delta |
|-----------|--------|-------------|-------|
| **Embed single text** | 50ms | 50ms | 0ms (no parallelism benefit) |
| **Embed 100 texts** | 5000ms | 8000ms | -37% (worker wins - no UI blocking) |
| **Vector search (10k vectors)** | 20ms | 30ms | -33% (worker wins - SIMD optimization) |
| **LLM inference (500 tokens)** | 15s | N/A | Worker-only (too slow for main thread) |
| **Worker spawn** | 150ms | N/A | One-time cost |
| **Model download (Llama 1B)** | 60s | N/A | One-time cost, cached after |

### 9.2 Memory Benchmarks (Target)

| Scenario | Main Thread | Workers | Total |
|----------|-------------|---------|-------|
| **Idle (no workers)** | 150MB | 0MB | 150MB |
| **Embedding worker loaded** | 150MB | 150MB | 300MB |
| **All workers loaded** | 150MB | 2.25GB | 2.4GB |
| **Peak (LLM inference)** | 200MB | 2.5GB | 2.7GB |

### 9.3 Throughput Targets

- **Embedding generation**: 20 texts/second (batched)
- **Vector search**: 100 queries/second (cached index)
- **LLM inference**: 30 tokens/second (streaming)

### 9.4 Optimization Opportunities

**Batch Processing:**
```typescript
// ❌ BAD: Process notes one-by-one (100 tasks = 100 worker messages)
for (const note of notes) {
  await generateEmbeddings([note.content])
}

// ✅ GOOD: Batch process (1 task = 1 worker message)
const embeddings = await generateEmbeddings(notes.map(n => n.content))
```

**Debounce Search:**
```typescript
// ❌ BAD: Search on every keystroke (100 queries if user types 100 chars)
<input onChange={(e) => handleSearch(e.target.value)} />

// ✅ GOOD: Debounce search by 300ms
const debouncedSearch = useDebouncedCallback(handleSearch, 300)
<input onChange={(e) => debouncedSearch(e.target.value)} />
```

**Lazy Load Models:**
```typescript
// ❌ BAD: Load all models on app start
await Promise.all([
  loadEmbeddingModel(),
  loadSearchIndex(),
  loadLLMModel(),
])

// ✅ GOOD: Load models on-demand
// Models auto-load when first task arrives (see Section 2.2)
```

---

## Migration Path

### 10.1 Phase 1: Foundation (Epic 9 Stories 1-3)

**Goal:** Establish worker infrastructure without AI features

**Deliverables:**
1. Worker coordinator with lifecycle management
2. Message protocol types and validators
3. Mock workers (no real AI models)
4. E2E test mocks
5. Error handling and fallback patterns

**Code Changes:**
- Create `src/ai/workers/coordinator.ts`
- Create `src/ai/workers/types.ts`
- Create `src/ai/workers/embedding.worker.ts` (mock only)
- Update `vite.config.ts` with worker support

**Validation:**
- Unit tests for coordinator
- E2E tests with mock workers
- No production AI workloads yet

### 10.2 Phase 2: Embedding Integration (Epic 9 Story 4)

**Goal:** Add real embedding generation (Transformers.js)

**Deliverables:**
1. Replace mock embedding worker with Transformers.js
2. Integrate with note-taking flow
3. Test with 10k notes
4. Monitor memory usage

**Code Changes:**
- Install `@xenova/transformers`
- Implement real `generateEmbeddings()` in worker
- Update `useNoteStore.saveNote()` to generate embeddings
- Add memory monitoring

**Validation:**
- Embedding generation < 50ms per text
- Memory usage < 150MB
- No UI freezing during batch processing

### 10.3 Phase 3: Vector Search (Epic 9 Story 5)

**Goal:** Add semantic search via HNSW index

**Deliverables:**
1. Create search worker with MeMemo HNSW
2. Implement `searchSimilarNotes()` API
3. Add search UI to notes page
4. Cache index in IndexedDB

**Code Changes:**
- Install MeMemo (or equivalent HNSW library)
- Create `src/ai/workers/search.worker.ts`
- Implement vector search in notes page
- Add index persistence

**Validation:**
- Search latency < 20ms for 10k vectors
- Index rebuild < 5s
- Cache persistence works offline

### 10.4 Phase 4: LLM Inference (Epic 9B Story 1)

**Goal:** Add local LLM for summaries and Q&A

**Deliverables:**
1. Create inference worker with WebLLM
2. Implement streaming API
3. Add model download progress UI
4. Test with video summaries

**Code Changes:**
- Install `@mlc-ai/web-llm`
- Create `src/ai/workers/inference.worker.ts`
- Add streaming response handling
- Implement fallback to cloud API

**Validation:**
- Model loads < 60s (cached < 5s)
- Inference throughput > 30 tokens/s
- Streaming UX smooth (no stuttering)
- Memory usage < 2GB

### 10.5 Rollback Plan

If workers cause production issues:

**Rollback Strategy:**
1. Add feature flag: `ENABLE_AI_WORKERS=false`
2. Fallback to main thread (throttled)
3. Show banner: "AI features temporarily disabled due to performance issues"

**Code:**
```typescript
const USE_WORKERS = import.meta.env.VITE_ENABLE_AI_WORKERS !== 'false'

export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  if (USE_WORKERS && supportsWorkers()) {
    return coordinator.executeTask('embed', { texts })
  } else {
    return generateEmbeddingsMainThread(texts)
  }
}
```

**Monitoring:**
- Track worker crash rate via Sentry
- Monitor `worker-crash` events
- Alert if crash rate > 5% of sessions

---

## Appendix A: Code Examples

### A.1 Complete Embedding Worker

```typescript
// ============================================================================
// src/ai/workers/embedding.worker.ts
// ============================================================================

import { pipeline, env } from '@xenova/transformers'
import type {
  WorkerRequest,
  WorkerSuccessResponse,
  WorkerErrorResponse,
  EmbedPayload,
  EmbedResult,
} from './types'

// Configure Transformers.js
env.allowLocalModels = false
env.backends.onnx.wasm.numThreads = 1 // CRITICAL: 1 thread per worker

let embeddingPipeline: any = null

async function initializePipeline() {
  if (!embeddingPipeline) {
    console.log('[EmbeddingWorker] Loading model: all-MiniLM-L6-v2')

    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      device: 'wasm',
    })

    console.log('[EmbeddingWorker] Model loaded successfully')
  }

  return embeddingPipeline
}

async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const pipeline = await initializePipeline()
  const result = await pipeline(texts, { pooling: 'mean', normalize: true })
  return result.data // 384-dim vectors
}

self.onmessage = async (e: MessageEvent) => {
  const request = e.data as WorkerRequest<EmbedPayload>
  const { requestId, type, payload } = request

  if (type !== 'embed') {
    const errorResponse: WorkerErrorResponse = {
      requestId,
      type: 'error',
      error: `Unknown request type: ${type}`,
    }
    self.postMessage(errorResponse)
    return
  }

  try {
    const { texts } = payload

    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Invalid payload: texts must be non-empty array')
    }

    const embeddings = await generateEmbeddings(texts)

    const successResponse: WorkerSuccessResponse<EmbedResult> = {
      requestId,
      type: 'success',
      result: { embeddings },
    }

    self.postMessage(successResponse)
  } catch (error) {
    console.error('[EmbeddingWorker] Error:', error)

    const errorResponse: WorkerErrorResponse = {
      requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }

    self.postMessage(errorResponse)
  }
}

self.addEventListener('error', (event) => {
  console.error('[EmbeddingWorker] Unhandled error:', event)
  self.close()
})

export {}
```

### A.2 React Hook for Worker Tasks

```typescript
// ============================================================================
// src/app/hooks/useWorkerTask.ts
// ============================================================================

import { useState, useCallback } from 'react'
import { coordinator } from '@/ai/workers/coordinator'
import type { WorkerRequestType } from '@/ai/workers/types'

interface UseWorkerTaskOptions {
  onSuccess?: (result: unknown) => void
  onError?: (error: Error) => void
}

export function useWorkerTask<T>(
  taskType: WorkerRequestType,
  options?: UseWorkerTaskOptions
) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<T | null>(null)

  const execute = useCallback(
    async (payload: unknown) => {
      setIsLoading(true)
      setError(null)

      try {
        const res = await coordinator.executeTask<T>(taskType, payload)
        setResult(res)
        options?.onSuccess?.(res)
        return res
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        options?.onError?.(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [taskType, options]
  )

  return { execute, isLoading, error, result }
}
```

**Usage:**
```typescript
function NotesPage() {
  const { execute, isLoading } = useWorkerTask<Float32Array[]>('embed')

  async function handleSaveNote(content: string) {
    const [embedding] = await execute({ texts: [content] })
    // ... save note with embedding
  }

  return <button onClick={() => handleSaveNote('test')} disabled={isLoading}>Save</button>
}
```

---

## Appendix B: Browser Compatibility Matrix

| Feature | Chrome | Edge | Safari | Firefox | Fallback |
|---------|--------|------|--------|---------|----------|
| **Web Workers** | 4+ | 10+ | 4+ | 3.5+ | Main thread (throttled) |
| **ES Modules in Workers** | 80+ | 80+ | 15+ | 114+ | Bundle worker script |
| **Transferable Objects** | 13+ | 12+ | 6+ | 18+ | Clone (slower) |
| **WebAssembly** | 57+ | 16+ | 11+ | 52+ | Cloud API fallback |
| **WebGPU** | 113+ | 113+ | 17+ | ❌ | WebAssembly (CPU) |
| **IndexedDB in Workers** | 38+ | 79+ | 10+ | 37+ | Message main thread |

**Detection:**
```typescript
export function detectWorkerSupport() {
  return {
    workers: typeof Worker !== 'undefined',
    moduleWorkers: 'type' in new Worker('', { type: 'module' }),
    transferable: typeof ArrayBuffer !== 'undefined',
    webAssembly: typeof WebAssembly !== 'undefined',
    webGPU: 'gpu' in navigator,
    indexedDB: typeof indexedDB !== 'undefined',
  }
}
```

---

## Appendix C: Memory Profiling Guide

**Chrome DevTools:**
1. Open DevTools → Performance → Memory
2. Start recording
3. Trigger AI workload (e.g., generate embeddings)
4. Take heap snapshot
5. Compare snapshots to detect leaks

**Worker Memory Inspection:**
```javascript
// In worker context
if ('memory' in performance) {
  const mem = performance.memory
  console.log('Heap size:', mem.usedJSHeapSize / 1024 / 1024, 'MB')
  console.log('Heap limit:', mem.jsHeapSizeLimit / 1024 / 1024, 'MB')
}
```

**Memory Leak Indicators:**
- Heap size grows after each task and never drops
- Worker termination doesn't free memory
- Total memory exceeds 3GB ceiling

**Debugging Tools:**
- `about:memory` (Chrome) - Per-process memory usage
- Safari Web Inspector → Timelines → Memory
- Firefox DevTools → Performance → Memory

---

## Conclusion

This architecture provides a **scalable, maintainable foundation** for Epic 9's AI features with the following benefits:

✅ **Performance:** Offloads AI workloads to dedicated workers, preventing UI freezing
✅ **Memory:** 3GB ceiling with auto-downgrade and idle termination
✅ **Reliability:** Graceful degradation, retry logic, and fallback patterns
✅ **Developer Experience:** Type-safe API, structured protocol, clear error messages
✅ **Testability:** Mock workers for E2E tests, unit tests for coordinator logic

**Next Steps:**
1. Review with team for feedback
2. Implement Phase 1 (foundation) in Epic 9 Story 1
3. Validate with benchmarks before Phase 2
4. Monitor production metrics (crash rate, memory usage)

---

**Document Status:** ✅ Ready for Review
**Last Updated:** 2026-03-10
**Reviewers:** Epic 9 Team
**Approval Required:** Tech Lead, Product Owner
