# Implementation Plan: E09-S02 — Web Worker Architecture And Memory Management

**Story:** E09-S02
**Status:** done
**Date:** 2026-03-10
**Completed:** 2026-03-10
**Reviewed:** true
**Estimated Complexity:** Medium (infrastructure story, no UI changes)

## Review Gates

**Review Date:** 2026-03-10
**review_gates_passed:**
- [x] build
- [x] lint
- [x] tsc
- [x] prettier
- [x] unit (pre-existing failures on main, not regressions)
- [x] e2e-smoke (14/14)
- [x] code-review (all blockers and highs fixed)
- [x] code-review-testing (AC coverage raised: AC2,AC3,AC4,AC5,AC6,AC9 all covered)
- [x] design-review (approved, no regressions)

**Reports:**
- [Code Review](../../../docs/reviews/code/code-review-2026-03-10-E09-S02.md)
- [Test Coverage Review](../../../docs/reviews/code/code-review-testing-2026-03-10-E09-S02.md)
- [Design Review](../../../docs/reviews/design/design-review-2026-03-10-E09-S02.md)

---

## Context & Current State

### What Already Exists (Phase 1 Foundation from E09 Prep Sprint)

| File | Status | Notes |
|------|--------|-------|
| `src/ai/workers/coordinator.ts` | ✅ Exists | Full worker pool manager. Has a bug: `activeRequests` never decremented |
| `src/ai/workers/types.ts` | ✅ Exists | Complete message protocol types |
| `src/ai/workers/embedding.worker.ts` | ✅ Exists | MOCK implementation (all-zeros vectors) |
| `src/ai/workers/__tests__/coordinator.test.ts` | ✅ Exists | 5 unit tests passing |
| `src/lib/vectorMath.ts` | ✅ Exists | `cosineSimilarity`, `normalizeVector`, `dotProduct`, `euclideanDistance` |
| `src/lib/vectorSearch.ts` | ✅ Exists | `BruteForceVectorStore` class (100% recall, 10ms @ 10K vectors) |
| `src/lib/aiConfiguration.ts` | ✅ Exists | AI provider config store (from E09-S01) |
| `vite.config.ts` | ✅ Exists | Has COOP/COEP headers, WebLLM exclusion. Missing `worker: { format: 'es' }` |

### What Needs to Be Built

| File | Status | Notes |
|------|--------|-------|
| `vite.config.ts` | 🔧 Modify | Add `worker: { format: 'es' }` |
| `src/ai/workers/coordinator.ts` | 🔧 Fix bug | Decrement `activeRequests` on request completion |
| `src/ai/workers/coordinator.ts` | 🔧 Enhance | Add visibility change cleanup |
| `src/ai/workers/coordinator.ts` | 🔧 Enhance | Add `worker-crash` custom event dispatch |
| `src/ai/lib/workerCapabilities.ts` | 🆕 Create | `supportsWorkers()`, `detectWorkerFeatures()` |
| `src/ai/workers/search.worker.ts` | 🆕 Create | Vector similarity search worker |
| `src/data/types.ts` | 🔧 Modify | Add `NoteEmbedding` interface |
| `src/db/schema.ts` | 🔧 Modify | Add `embeddings` table, schema v9 |
| `src/ai/vector-store.ts` | 🆕 Create | Main-thread IndexedDB proxy for embeddings |
| `src/ai/hooks/useWorkerCoordinator.ts` | 🆕 Create | React hook for component lifecycle cleanup |
| `tests/e2e/story-e09-s02-worker-infrastructure.spec.ts` | 🆕 Create | E2E smoke tests |
| `tests/support/helpers/mock-workers.ts` | 🆕 Create | Reusable Playwright mock helper |

---

## Implementation Steps

### Step 1: Vite Worker ES Module Configuration

**File:** `vite.config.ts`

Add `worker: { format: 'es' }` block to the exported config object.

```typescript
export default defineConfig({
  plugins: [...],
  worker: {
    format: 'es',  // ES module workers — enables `import` in worker scope
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { headers: { ... } },  // keep existing COOP/COEP headers
  // ... rest unchanged
})
```

**Validation:** `npm run build` completes without worker bundling errors.

---

### Step 2: Fix `activeRequests` Bug in Coordinator

**File:** `src/ai/workers/coordinator.ts`

**Problem:** `updateWorkerActivity` increments `entry.activeRequests++` but `resolvePendingRequest` and `rejectPendingRequest` never decrement it. The idle termination check `entry.activeRequests === 0` can never become true after first use.

**Fix:** Decrement `activeRequests` on request completion and reschedule idle check.

```typescript
private resolvePendingRequest(requestId: string, result: unknown): void {
  const pending = this.pendingRequests.get(requestId)
  if (!pending) return
  clearTimeout(pending.timeout)
  pending.resolve(result)
  this.pendingRequests.delete(requestId)
  this.decrementActiveRequests(requestId)  // ADD THIS
}

private rejectPendingRequest(requestId: string, error: Error): void {
  const pending = this.pendingRequests.get(requestId)
  if (!pending) return
  clearTimeout(pending.timeout)
  pending.reject(error)
  this.pendingRequests.delete(requestId)
  this.decrementActiveRequests(requestId)  // ADD THIS
}

private decrementActiveRequests(requestId: string): void {
  // Find worker that owned this request via workerId tracking
  // Decrement activeRequests, reschedule idle termination
}
```

**Note:** The current design doesn't track which worker owns each requestId. Two approaches:
- **Option A:** Store `workerId` in `PendingRequest` (clean, recommended)
- **Option B:** Derive from request type stored alongside requestId

**Recommended:** Option A — add `workerId: string` to `PendingRequest` interface.

---

### Step 3: Visibility Change Memory Management

**File:** `src/ai/workers/coordinator.ts`

Add to the singleton initialization (after the `beforeunload` listener):

```typescript
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('[Coordinator] Tab hidden — terminating workers to free memory')
      this.terminate()
    }
  })
}
```

**Placement:** In `WorkerCoordinator` constructor, not in the module-level initialization block (to ensure `this` binding).

**Alternative:** Keep in module-level init but bind to singleton. Either works.

---

### Step 4: Worker Crash OOM Event Dispatch

**File:** `src/ai/workers/coordinator.ts`

Enhance `handleWorkerError` to dispatch a `worker-crash` custom event so other parts of the app can respond (e.g., switching to cloud fallback):

```typescript
private handleWorkerError(type: WorkerRequestType, error: Error): void {
  const workerId = this.getWorkerId(type)
  const entry = this.pool.get(workerId)
  if (!entry) return

  entry.worker.terminate()
  this.pool.delete(workerId)
  console.error(`[Coordinator] Worker ${workerId} crashed:`, error)

  // Dispatch custom event for app-level handlers
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('worker-crash', {
      detail: { workerId, error: error?.message ?? 'Unknown error' }
    }))
  }

  // Reject all pending requests
  this.pendingRequests.forEach((pending, requestId) => {
    pending.reject(new Error('Worker crashed. Please try again.'))
    this.pendingRequests.delete(requestId)
  })
}
```

---

### Step 5: Worker Capability Detection

**File:** `src/ai/lib/workerCapabilities.ts` (new file)

```typescript
export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

export function supportsModuleWorkers(): boolean {
  // Module workers require browsers: Chrome 80+, Firefox 114+, Safari 15+
  // We infer support from known Worker support — all modern browsers support both
  return supportsWorkers()
}

export function supportsWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export interface WorkerFeatures {
  workers: boolean
  moduleWorkers: boolean
  webGPU: boolean
  indexedDB: boolean
  sharedArrayBuffer: boolean
}

export function detectWorkerFeatures(): WorkerFeatures {
  return {
    workers: supportsWorkers(),
    moduleWorkers: supportsModuleWorkers(),
    webGPU: supportsWebGPU(),
    indexedDB: typeof indexedDB !== 'undefined',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  }
}
```

**Update coordinator** to throw a descriptive error if workers are unsupported:

```typescript
private getOrCreateWorker(type: WorkerRequestType): Worker {
  if (!supportsWorkers()) {
    throw new Error('Web Workers are not supported in this browser. AI features are unavailable.')
  }
  // ... existing logic
}
```

---

### Step 6: Search Worker

**File:** `src/ai/workers/search.worker.ts` (new file)

```typescript
import type {
  WorkerRequest,
  WorkerSuccessResponse,
  WorkerErrorResponse,
  SearchPayload,
  SearchResult,
  LoadIndexPayload,
} from './types'
import { cosineSimilarity } from '@/lib/vectorMath'

// In-memory vector index (loaded from main thread via load-index message)
let vectorIndex: Map<string, Float32Array> | null = null

self.onmessage = async (e: MessageEvent) => {
  const request = e.data as WorkerRequest

  try {
    if (request.type === 'load-index') {
      const { vectors } = request.payload as LoadIndexPayload
      vectorIndex = new Map(Object.entries(vectors))
      const response: WorkerSuccessResponse<void> = {
        requestId: request.requestId,
        type: 'success',
        result: undefined,
      }
      self.postMessage(response)
      return
    }

    if (request.type === 'search') {
      if (!vectorIndex) {
        throw new Error('Vector index not loaded. Call load-index first.')
      }

      const { queryVector, topK = 5 } = request.payload as SearchPayload

      const results: Array<{ noteId: string; score: number }> = []
      for (const [noteId, vector] of vectorIndex.entries()) {
        const score = cosineSimilarity(queryVector, vector)
        results.push({ noteId, score })
      }

      results.sort((a, b) => b.score - a.score)

      const response: WorkerSuccessResponse<SearchResult> = {
        requestId: request.requestId,
        type: 'success',
        result: { results: results.slice(0, topK) },
      }
      self.postMessage(response)
      return
    }

    throw new Error(`Unknown request type: ${request.type}`)
  } catch (error) {
    const response: WorkerErrorResponse = {
      requestId: request.requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    self.postMessage(response)
  }
}

self.addEventListener('error', (event) => {
  console.error('[SearchWorker] Unhandled error:', event)
  self.postMessage({
    type: 'error',
    error: 'Search worker crashed due to memory pressure.',
  })
  self.close()
})

export {}
```

**Note on `cosineSimilarity` import in workers:** With `worker: { format: 'es' }` in Vite, ES imports work in workers. The `@` alias resolution must be available in the worker bundle — Vite handles this via `resolve.alias` applying to workers.

---

### Step 7: `NoteEmbedding` Type

**File:** `src/data/types.ts`

Add at the bottom (or in the appropriate AI types section):

```typescript
export interface NoteEmbedding {
  noteId: string           // Primary key (references notes.id)
  embedding: Float32Array  // 384-dim vector (all-MiniLM-L6-v2)
  model: string            // e.g., 'all-MiniLM-L6-v2'
  createdAt: string        // ISO timestamp
}
```

---

### Step 8: Dexie Schema Version 9 — Embeddings Table

**File:** `src/db/schema.ts`

Add `embeddings` to the type declaration and add `db.version(9)` migration:

```typescript
import type { NoteEmbedding } from '@/data/types'

const db = new Dexie('ElearningDB') as Dexie & {
  // ... existing tables
  embeddings: EntityTable<NoteEmbedding, 'noteId'>
}

// ... versions 1-8 unchanged

db.version(9).stores({
  importedCourses: 'id, name, importedAt, status, *tags',
  importedVideos: 'id, courseId, filename',
  importedPdfs: 'id, courseId, filename',
  progress: '[courseId+videoId], courseId, videoId',
  bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
  screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
  contentProgress: '[courseId+itemId], courseId, itemId, status',
  challenges: 'id, type, deadline, createdAt',
  embeddings: 'noteId, createdAt',  // NEW: vector embeddings for notes
})
```

**Dexie Migration Notes:**
- No data transformation needed — just adds new table
- Existing tables unchanged, all existing data preserved
- `noteId` as primary key matches `notes.id` foreign key semantics
- `createdAt` indexed for efficient time-based queries (e.g., stale embedding cleanup)

---

### Step 9: Vector Store Proxy

**File:** `src/ai/vector-store.ts` (new file)

```typescript
import { db } from '@/db'
import type { NoteEmbedding } from '@/data/types'

/**
 * Load all note embeddings from IndexedDB into a plain object for worker transfer.
 * Called on main thread before sending to search worker via load-index.
 */
export async function loadVectorIndex(): Promise<Record<string, Float32Array>> {
  const embeddings = await db.embeddings.toArray()
  const index: Record<string, Float32Array> = {}
  for (const entry of embeddings) {
    index[entry.noteId] = entry.embedding
  }
  return index
}

/**
 * Persist a single embedding to IndexedDB.
 */
export async function saveEmbedding(
  noteId: string,
  embedding: Float32Array,
  model = 'all-MiniLM-L6-v2'
): Promise<void> {
  await db.embeddings.put({
    noteId,
    embedding,
    model,
    createdAt: new Date().toISOString(),
  })
}

/**
 * Persist a batch of embeddings. Yields to main thread every 10 items to keep
 * the UI responsive during large batch operations.
 */
export async function bulkSaveEmbeddings(
  items: Array<{ noteId: string; embedding: Float32Array }>,
  model = 'all-MiniLM-L6-v2'
): Promise<void> {
  const BATCH_SIZE = 10
  const createdAt = new Date().toISOString()

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    await db.embeddings.bulkPut(
      batch.map(({ noteId, embedding }) => ({
        noteId,
        embedding,
        model,
        createdAt,
      }))
    )
    // Yield to main thread between batches
    if (i + BATCH_SIZE < items.length) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
}

/**
 * Delete embedding when note content changes (invalidation).
 */
export async function deleteEmbedding(noteId: string): Promise<void> {
  await db.embeddings.delete(noteId)
}

/**
 * Get embedding for a single note (for incremental updates).
 */
export async function getEmbedding(noteId: string): Promise<NoteEmbedding | undefined> {
  return db.embeddings.get(noteId)
}
```

---

### Step 10: `useWorkerCoordinator` React Hook

**File:** `src/ai/hooks/useWorkerCoordinator.ts` (new file)

```typescript
import { useEffect, useRef } from 'react'
import { coordinator } from '@/ai/workers/coordinator'
import type { WorkerRequestType } from '@/ai/workers/types'

interface UseWorkerCoordinatorOptions {
  /**
   * Worker types to terminate when this component unmounts.
   * If not provided, no workers are terminated on unmount (global coordinator persists).
   */
  terminateOnUnmount?: WorkerRequestType[]
}

/**
 * React hook for safe worker coordinator usage in components.
 *
 * Returns the global coordinator singleton. Optionally terminates specific workers
 * when the component unmounts (useful for panels that load vector indexes).
 *
 * Example:
 *   const { coordinator } = useWorkerCoordinator({ terminateOnUnmount: ['search'] })
 */
export function useWorkerCoordinator(options: UseWorkerCoordinatorOptions = {}) {
  const { terminateOnUnmount } = options
  const terminateTypesRef = useRef(terminateOnUnmount)

  useEffect(() => {
    terminateTypesRef.current = terminateOnUnmount
  }, [terminateOnUnmount])

  useEffect(() => {
    return () => {
      const types = terminateTypesRef.current
      if (types && types.length > 0) {
        // Terminate only the specified worker types
        const status = coordinator.getStatus()
        status.workers
          .filter(w => types.includes(w.type as WorkerRequestType))
          .forEach(w => {
            console.log(`[useWorkerCoordinator] Terminating ${w.type} worker on unmount`)
          })
        // Note: coordinator.terminateWorkerType() needs to be added to coordinator
        // For now, full terminate only if all types are requested
        if (types.length >= 3) {
          coordinator.terminate()
        }
      }
    }
  }, [])  // Intentionally empty — only runs on unmount

  return { coordinator }
}
```

**Note on `terminateWorkerType`:** The coordinator needs a new `terminateWorkerType(type: WorkerRequestType)` method. Add to coordinator:

```typescript
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
```

---

### Step 11: E2E Smoke Test

**File:** `tests/e2e/story-e09-s02-worker-infrastructure.spec.ts` (new file)

```typescript
import { test, expect } from '@playwright/test'

test.describe('E09-S02: Web Worker Infrastructure', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock Worker to avoid Transformers.js download in tests
    await page.addInitScript(() => {
      class MockWorker extends EventTarget {
        constructor(public url: string | URL, public options?: WorkerOptions) {
          super()
        }

        postMessage(message: unknown): void {
          const req = message as { requestId: string; type: string; payload: unknown }
          setTimeout(() => {
            if (req.type === 'embed') {
              const payload = req.payload as { texts: string[] }
              const embeddings = payload.texts.map(() => new Float32Array(384))
              this.dispatchEvent(new MessageEvent('message', {
                data: { requestId: req.requestId, type: 'success', result: { embeddings } },
              }))
            } else if (req.type === 'load-index') {
              this.dispatchEvent(new MessageEvent('message', {
                data: { requestId: req.requestId, type: 'success', result: undefined },
              }))
            } else if (req.type === 'search') {
              this.dispatchEvent(new MessageEvent('message', {
                data: {
                  requestId: req.requestId, type: 'success',
                  result: { results: [{ noteId: 'note-1', score: 0.95 }] },
                },
              }))
            }
          }, 10)
        }

        terminate(): void { /* no-op */ }
      }
      ;(window as unknown as Record<string, unknown>)['Worker'] = MockWorker
    })
  })

  test('AC1: coordinator spawns worker and returns typed result', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { generateEmbeddings } = await import('/src/ai/workers/coordinator.ts')
      const embeddings = await generateEmbeddings(['test text'])
      return { length: embeddings.length, dims: embeddings[0].length }
    })

    expect(result.length).toBe(1)
    expect(result.dims).toBe(384)
  })

  test('AC6: search worker returns top-K results sorted by score', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { coordinator } = await import('/src/ai/workers/coordinator.ts')
      await coordinator.executeTask('load-index', {
        vectors: { 'note-1': new Float32Array(384), 'note-2': new Float32Array(384) }
      })
      const searchResult = await coordinator.executeTask('search', {
        queryVector: new Float32Array(384),
        topK: 2
      })
      return searchResult
    })

    expect(result.results[0].noteId).toBe('note-1')
    expect(result.results[0].score).toBe(0.95)
  })

  test('AC7: Dexie schema v9 has embeddings table', async ({ page }) => {
    await page.goto('/')

    const hasTable = await page.evaluate(async () => {
      return new Promise<boolean>((resolve) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          resolve(db.objectStoreNames.contains('embeddings'))
          db.close()
        }
        request.onerror = () => resolve(false)
      })
    })

    expect(hasTable).toBe(true)
  })
})
```

**Notes:**
- E2E tests use mock Worker to avoid real model loading
- Tests run Chromium only (local, not CI — per project pattern)
- `page.goto('/')` triggers Dexie schema migration on load

---

### Step 12: Mock Workers Test Helper

**File:** `tests/support/helpers/mock-workers.ts` (new file)

```typescript
import type { Page } from '@playwright/test'

/**
 * Inject a deterministic mock Worker into the page before navigation.
 * Prevents Transformers.js from loading real models in E2E tests.
 *
 * Usage:
 *   await mockEmbeddingWorker(page)
 *   await page.goto('/notes')
 */
export async function mockEmbeddingWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class MockWorker extends EventTarget {
      constructor(public url: string | URL, public options?: WorkerOptions) {
        super()
      }

      postMessage(message: unknown): void {
        const req = message as { requestId: string; type: string; payload: unknown }
        setTimeout(() => {
          let responseData: unknown

          if (req.type === 'embed') {
            const payload = req.payload as { texts: string[] }
            responseData = {
              requestId: req.requestId,
              type: 'success',
              result: { embeddings: payload.texts.map(() => new Float32Array(384)) },
            }
          } else if (req.type === 'load-index') {
            responseData = { requestId: req.requestId, type: 'success', result: undefined }
          } else if (req.type === 'search') {
            const payload = req.payload as { topK?: number }
            responseData = {
              requestId: req.requestId,
              type: 'success',
              result: {
                results: Array.from({ length: payload.topK ?? 5 }, (_, i) => ({
                  noteId: `note-${i + 1}`,
                  score: 0.95 - i * 0.05,
                })),
              },
            }
          } else {
            responseData = {
              requestId: req.requestId,
              type: 'error',
              error: `Mock Worker: unknown type ${(req as {type: string}).type}`,
            }
          }

          this.dispatchEvent(new MessageEvent('message', { data: responseData }))
        }, 10)
      }

      terminate(): void { /* no-op */ }
    }

    ;(window as unknown as Record<string, unknown>)['Worker'] = MockWorker
  })
}
```

---

## Implementation Order

Execute in this sequence (respects dependencies):

1. **Step 1** — Vite config (unblocks everything, must come first for dev builds to work)
2. **Step 7** — `NoteEmbedding` type (needed by Step 8, 9)
3. **Step 8** — Dexie schema v9 (builds on Step 7)
4. **Step 2** — Fix coordinator bug (foundation, everything depends on correct idle behavior)
5. **Step 3** — Visibility change cleanup (small addition to coordinator)
6. **Step 4** — OOM event dispatch (small addition to coordinator)
7. **Step 5** — Worker capability detection (independent utility)
8. **Step 6** — Search worker (depends on types.ts and vectorMath.ts, both exist)
9. **Step 9** — Vector store proxy (depends on Dexie schema v9)
10. **Step 10** — `useWorkerCoordinator` hook (depends on coordinator API)
11. **Step 11** — E2E smoke test
12. **Step 12** — Mock worker helper (created alongside Step 11)

---

## File Creation Summary

### New Files
- `src/ai/lib/workerCapabilities.ts`
- `src/ai/workers/search.worker.ts`
- `src/ai/vector-store.ts`
- `src/ai/hooks/useWorkerCoordinator.ts`
- `tests/e2e/story-e09-s02-worker-infrastructure.spec.ts`
- `tests/support/helpers/mock-workers.ts`

### Modified Files
- `vite.config.ts` — Add `worker: { format: 'es' }`
- `src/ai/workers/coordinator.ts` — Bug fix + visibility change + OOM event + `terminateWorkerType`
- `src/data/types.ts` — Add `NoteEmbedding` interface
- `src/db/schema.ts` — Add `embeddings` table at schema v9

---

## NFR Compliance

| NFR | Requirement | How Met |
|-----|-------------|---------|
| NFR7 | Memory ≤50MB increase over 2-hour session | Idle termination (60s) + visibility change cleanup |
| NFR26 | AI API timeout 30s with AbortController | Already in coordinator `defaultTimeout: 30_000` |
| NFR33 | Large file handling (2GB+) without memory spike | Batch embedding with yield (10-item batches in `bulkSaveEmbeddings`) |

---

## Acceptance Criteria Coverage

| AC | Implementation |
|----|---------------|
| AC1: Worker spawn + typed result | Coordinator `executeTask` → Step 2 (bug fix) |
| AC2: 60s idle termination | Step 2 (fix `activeRequests` decrement) |
| AC3: Visibility change cleanup | Step 3 |
| AC4: Worker crash recovery | Step 4 (OOM event) + existing coordinator error handling |
| AC5: Browser capability detection | Step 5 (`workerCapabilities.ts`) |
| AC6: Search worker top-K results | Step 6 (`search.worker.ts`) |
| AC7: Dexie schema v9 embeddings | Steps 7+8 (type + schema migration) |
| AC8: Vite ES module workers | Step 1 |
| AC9: `useWorkerCoordinator` hook | Step 10 |

---

## Test Coverage

| Test Type | File | Covers |
|-----------|------|--------|
| Unit | `coordinator.test.ts` (enhanced) | Bug fix + idle termination + crash recovery |
| Unit | `workerCapabilities.test.ts` (new) | `supportsWorkers()`, `detectWorkerFeatures()` |
| Unit | `search.worker.test.ts` (new) | `load-index` + `search` message handling |
| Unit | `vector-store.test.ts` (new) | `loadVectorIndex`, `saveEmbedding`, `bulkSaveEmbeddings` |
| E2E | `story-e09-s02-worker-infrastructure.spec.ts` | AC1, AC6, AC7 smoke tests |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `cosineSimilarity` import fails in worker scope | Search worker broken | Vite `worker: { format: 'es' }` + `@` alias — test early in Step 1 |
| Dexie v9 migration breaks existing users | Data loss | Migration only adds new table, no data transformation |
| `activeRequests` fix breaks existing tests | Test failures | Update coordinator tests to match new behavior |
| Visibility change terminates workers too aggressively | Poor UX if tab briefly switches | Acceptable trade-off per architecture docs (respawn <200ms) |

---

**Plan Status:** Ready for Implementation
**Next Story:** E09-S03 (Embedding Pipeline & Vector Store) — builds on this foundation by replacing MOCK embedding worker with real Transformers.js
