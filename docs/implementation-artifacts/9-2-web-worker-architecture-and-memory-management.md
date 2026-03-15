---
story_id: E09-S02
story_name: "Web Worker Architecture And Memory Management"
status: done
started: 2026-03-10
completed: 2026-03-11
reviewed: true
review_started: 2026-03-11
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review]
burn_in_validated: false
---

# Story 9.2: Web Worker Architecture And Memory Management

## Story

As a developer building AI features,
I want a complete Web Worker infrastructure with robust memory management,
So that CPU/memory-intensive AI operations run off the main thread without leaking resources or blocking the UI.

## Acceptance Criteria

**Given** the application starts on a browser that supports Web Workers
**When** `coordinator.executeTask()` is called for the first time
**Then** a dedicated worker is spawned lazily (not at startup)
**And** the task executes off the main thread and returns a typed result

**Given** a worker has been idle for 60 seconds with no active requests
**When** the idle timer fires
**Then** the worker is terminated and removed from the pool
**And** the next request for that task type respawns the worker automatically

**Given** the browser tab becomes hidden (`document.hidden === true`)
**When** the `visibilitychange` event fires
**Then** all active workers are terminated to free memory
**And** workers are respawned on demand when the tab becomes visible again

**Given** a worker crashes due to OOM or an unhandled error
**When** the `onerror` event fires on that worker
**Then** all pending requests for the crashed worker are rejected with descriptive error messages
**And** the crashed worker is removed from the pool
**And** the next request for that type spawns a fresh replacement worker

**Given** the application is running on a browser where `typeof Worker === 'undefined'`
**When** the application initializes
**Then** AI-dependent coordinator calls fail gracefully without throwing unhandled errors
**And** a `supportsWorkers()` capability function returns `false` to allow feature gating

**Given** a vector index has been loaded via `executeTask('load-index', { vectors })`
**When** `executeTask('search', { queryVector, topK })` is called
**Then** the search worker returns the top K most similar notes by cosine similarity
**And** results are sorted by score descending

**Given** the application opens IndexedDB for the first time at schema version 9
**When** Dexie runs its migration
**Then** an `embeddings` table exists with `noteId` as primary key and `createdAt` indexed
**And** all data from schema versions 1–8 is preserved without data loss

**Given** the Vite build processes worker files
**When** workers are instantiated at runtime
**Then** they execute as ES module workers (enabling `import` statements in worker scope)
**And** the Vite `worker: { format: 'es' }` config is present in `vite.config.ts`

**Given** a React component that triggers AI tasks
**When** the component unmounts
**Then** a `useWorkerCoordinator` hook terminates only the workers used by that component
**And** a global coordinator singleton remains alive for other components

## Tasks / Subtasks

- [ ] Task 1: Vite Worker ES Module Configuration (AC: 8)
  - [ ] 1.1 Add `worker: { format: 'es' }` to `vite.config.ts`
  - [ ] 1.2 Verify existing COOP/COEP headers are retained
  - [ ] 1.3 Run `npm run build` to confirm no worker bundling errors

- [ ] Task 2: Fix Coordinator `activeRequests` Accounting Bug (AC: 2)
  - [ ] 2.1 Add `activeRequests--` decrement in `resolvePendingRequest` and `rejectPendingRequest`
  - [ ] 2.2 Add `scheduleIdleTermination` call after request completes (not just when started)
  - [ ] 2.3 Update coordinator unit tests to verify idle termination fires after all requests complete

- [ ] Task 3: Visibility Change Memory Management (AC: 3)
  - [ ] 3.1 Add `document.addEventListener('visibilitychange', ...)` in coordinator singleton init
  - [ ] 3.2 Terminate all workers when `document.hidden === true`
  - [ ] 3.3 Guard against SSR (check `typeof document !== 'undefined'`)

- [ ] Task 4: Worker Crash OOM Event Dispatch (AC: 4)
  - [ ] 4.1 Enhance `handleWorkerError` to dispatch `worker-crash` custom event with `{ workerId, error }`
  - [ ] 4.2 Add coordinator `onerror` handler test in unit tests

- [ ] Task 5: Browser Capability Detection (AC: 5)
  - [ ] 5.1 Create `src/ai/lib/workerCapabilities.ts` with `supportsWorkers()`, `supportsModuleWorkers()`, `detectWorkerFeatures()` utilities
  - [ ] 5.2 Update coordinator to use `supportsWorkers()` and throw descriptive error if unsupported
  - [ ] 5.3 Write unit tests for capability detection

- [ ] Task 6: Search Worker Implementation (AC: 6)
  - [ ] 6.1 Create `src/ai/workers/search.worker.ts` with `load-index` and `search` message handlers
  - [ ] 6.2 Use `cosineSimilarity` from `src/lib/vectorMath.ts` for similarity computation
  - [ ] 6.3 Support `topK` parameter (default: 5) with results sorted by score descending
  - [ ] 6.4 Add unit test for search worker via coordinator mock

- [ ] Task 7: Dexie Schema Version 9 — Embeddings Table (AC: 7)
  - [ ] 7.1 Add `NoteEmbedding` interface to `src/data/types.ts`
  - [ ] 7.2 Add `embeddings` table to `db` type declaration in `src/db/schema.ts`
  - [ ] 7.3 Add `db.version(9).stores({ embeddings: 'noteId, createdAt', ... all existing tables })` migration
  - [ ] 7.4 Verify no data loss by running migration against existing data

- [ ] Task 8: Vector Store Proxy (Main-Thread IndexedDB Access) (AC: 7)
  - [ ] 8.1 Create `src/ai/vector-store.ts` with `loadVectorIndex()` and `saveEmbedding()` functions
  - [ ] 8.2 `loadVectorIndex()` returns `Record<string, Float32Array>` from Dexie `embeddings` table
  - [ ] 8.3 `saveEmbedding(noteId, embedding, model)` persists a single embedding
  - [ ] 8.4 `bulkSaveEmbeddings()` for batch persistence with batch-yield pattern

- [ ] Task 9: `useWorkerCoordinator` React Hook (AC: 9)
  - [ ] 9.1 Create `src/ai/hooks/useWorkerCoordinator.ts` hook
  - [ ] 9.2 Hook returns coordinator reference and registers component cleanup on unmount
  - [ ] 9.3 Accept optional `terminateOnUnmount: WorkerRequestType[]` to terminate specific workers

- [ ] Task 10: E2E Smoke Test for Worker Infrastructure (AC: 1–6)
  - [ ] 10.1 Create `tests/e2e/story-e09-s02-worker-infrastructure.spec.ts`
  - [ ] 10.2 Test: mock Worker API, verify coordinator spawns worker and returns embedding result
  - [ ] 10.3 Test: verify search worker returns top-K results with correct ordering
  - [ ] 10.4 Test: verify Dexie schema v9 embeddings table is accessible from the page

## Implementation Notes

**Architecture Decisions**:
- `coordinator.ts` (singleton) manages all worker lifecycle — components don't create workers directly
- `useWorkerCoordinator` hook provides React lifecycle integration without replacing the singleton
- Search worker uses brute-force k-NN (from `vectorSearch.ts` decisions in E09 research) — no HNSW
- Workers access Dexie via main-thread proxy pattern, NOT by opening their own Dexie connections (avoids version conflicts)
- Visibility change cleanup is aggressive (terminate on hide) — workers respawn in <200ms, acceptable trade-off vs memory leak over long tab sessions

**Bug Fix Required**:
- Coordinator `activeRequests` is incremented in `updateWorkerActivity` but never decremented
- This permanently disables idle termination after first request
- Fix: decrement in `resolvePendingRequest` + `rejectPendingRequest`, then schedule idle check

**Dependencies**:
- No new npm packages required for this story
- `@xenova/transformers` install is deferred to E09-S03 (embedding pipeline)
- `src/lib/vectorMath.ts` and `src/lib/vectorSearch.ts` already exist from E09 prep sprint

## Testing Notes

**Test Strategy**:
- Vitest unit tests for coordinator (fixing existing + new tests for idle termination, crash recovery, visibility)
- Vitest unit tests for search worker (via mock coordinator pattern)
- Vitest unit tests for `workerCapabilities.ts` (jsdom environment)
- Playwright E2E smoke tests: verify worker infrastructure works end-to-end in browser context
- E2E tests use mock Worker API (no real Transformers.js model required)

**Key Test Patterns**:
- Mock `global.Worker` in Vitest (already done in coordinator.test.ts)
- Use `page.addInitScript()` in Playwright to inject mock Worker before navigation
- Use `tests/support/helpers/mock-workers.ts` (create this helper) for reusable Playwright mocks

**No Timing Tests** — all worker tests are deterministic (mock workers respond in <10ms)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

### Pre-Implementation Research Findings

**Bug in Phase 1 foundation — `activeRequests` never decremented:**
`coordinator.ts` increments `activeRequests` in `updateWorkerActivity` but never decrements it in `resolvePendingRequest` / `rejectPendingRequest`. The idle termination check `entry.activeRequests === 0` can never become true after the first request. Fix: add `workerId` to `PendingRequest` and decrement on resolution/rejection.

**Workers cannot safely open their own Dexie connections:**
Risk of schema version conflicts and concurrent write contention. Correct pattern: main thread owns all IndexedDB access, workers receive data snapshots via `postMessage`. `vector-store.ts` implements this proxy.

**Visibility change cleanup trade-off:**
Terminating workers on tab hide frees ~30MB (embedding model + vector index). Workers respawn in <200ms — acceptable memory/latency trade-off for tabs hidden for extended periods.

*Additional lessons will be documented as implementation proceeds.*

## Implementation Plan

See [e09-s02-web-worker-architecture-memory-management.md](plans/e09-s02-web-worker-architecture-memory-management.md) for the detailed implementation plan.
