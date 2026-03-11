# Test Coverage Review: E09-S02 — Web Worker Architecture And Memory Management

**Date:** 2026-03-10
**Story:** E09-S02
**Reviewer:** code-review-testing agent
**Branch:** feature/e09-s02-web-worker-architecture-and-memory-management

---

## Summary

**AC Coverage: 3/9 (33%) — BLOCKER** (threshold: ≥80%)

Findings: **14** | Blockers: **5** | High: **3** | Medium: **3** | Nits: **3**

---

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1 | Coordinator spawns worker lazily; task executes off main thread | `coordinator.test.ts:67` | `story-e09-s02.spec.ts:27` | ✅ Covered |
| AC2 | Worker idle 60s → terminated; next request respawns | None | None | ❌ Gap |
| AC3 | Tab hidden → workers terminated; visible → respawned | None | None | ❌ Gap |
| AC4 | Worker crash → pending requests rejected; pool entry removed; fresh replacement spawned | None | None | ❌ Gap |
| AC5 | No Worker API → fails gracefully; `supportsWorkers()` returns `false` | None | None | ❌ Gap |
| AC6 | `load-index` then `search` returns top-K sorted by cosine similarity | None | `story-e09-s02.spec.ts:41` (mock only) | ⚠️ Partial |
| AC7 | Schema v9 has `embeddings` table with `noteId` PK and `createdAt` index | `schema.test.ts:47,64` | `story-e09-s02.spec.ts:9` | ✅ Covered |
| AC8 | Vite `worker: { format: 'es' }` config present; ES module workers instantiate | Config only | None | ⚠️ Partial |
| AC9 | `useWorkerCoordinator` terminates specified workers on unmount; singleton persists | None | None | ❌ Gap |

---

## Blockers

**[TB1] AC2: Zero coverage for idle termination (confidence: 97)**

The idle timer path (`coordinator.ts:294-296`) is the headline fix of this story yet has no test. A worker completing its request should decrement `activeRequests` to 0, fire the 60s idle timer, and terminate.

**Suggested test:** `coordinator idle-termination.test.ts` — use `vi.useFakeTimers()`, call `generateEmbeddings`, advance timers 60,001 ms, assert `getStatus().activeWorkers === 0`, then respawn and assert `activeWorkers === 1`.

---

**[TB2] AC3: Zero coverage for visibility change termination (confidence: 97)**

The `visibilitychange` handler at `coordinator.ts:405-410` is the only guard against memory leaks in background tabs. The E2E spec cannot test this because mock workers ignore `terminate()`.

**Suggested test:** Spawn worker, spy on `global.Worker.prototype.terminate`, dispatch `document.visibilitychange` with `document.hidden = true`, assert `terminate` called and `getStatus().activeWorkers === 0`.

---

**[TB3] AC4: Zero coverage for crash recovery (confidence: 97)**

`handleWorkerError` at `coordinator.ts:302-330` has three behaviors (reject pending, remove from pool, dispatch `worker-crash` event) — none tested. Story task list explicitly required a unit test.

**Suggested test:** Trigger `worker.onerror` on in-flight request, assert promise rejects with `'Worker crashed'`, assert `getStatus().activeWorkers === 0`, assert `window.dispatchEvent` called with `worker-crash`.

---

**[TB4] AC5: Zero coverage for no-Worker fallback (confidence: 95)**

`workerCapabilities.ts` is a new file with zero tests despite story task 5.3 requiring them.

**Suggested test:** Delete `global.Worker`, assert `supportsWorkers()` returns `false`, assert `coordinator.executeTask(...)` throws `'Web Workers are not supported'` (not an unhandled rejection).

---

**[TB5] AC9: Zero coverage for `useWorkerCoordinator` hook (confidence: 93)**

The hook's critical contract — global singleton persists while named worker types are stopped on unmount — is completely unverified.

**Suggested test:** `useWorkerCoordinator.test.tsx` with `@testing-library/react` — render with `terminateOnUnmount: ['search']`, spy on `coordinator.terminateWorkerType`, unmount, assert called with `'search'` but not `'embed'`.

---

## High Priority

**[TH1] AC6 coverage is mock-only (confidence: 85)**

`story-e09-s02.spec.ts:56-58` asserts `result[0].score === 0.95` — a hardcoded value from `MockWorker`. The real `search.worker.ts` brute-force k-NN loop and `cosineSimilarity` from `vectorMath.ts` are never called by any test.

**Fix:** Add a worker unit test dispatching `self.onmessage` directly with two vectors of known similarity and verifying the sorted output.

---

**[TH2] AC8 (Vite ES config) verified only by file inspection (confidence: 83)**

The E2E spec tests coordinator via `page.evaluate` dynamic import, not as a compiled ES module worker. A build-time assertion or an import test constructing `new Worker(new URL(...), { type: 'module' })` without throwing would give real behavioral coverage.

---

**[TH3] `coordinator.test.ts` module-level singleton risks test pollution (confidence: 82)**

`global.Worker` is assigned at module scope, not in `beforeEach`. Pending timers from one test can affect the next. Fix: move `global.Worker` assignment inside `beforeEach`, use `vi.useFakeTimers()`, restore in `afterEach`.

---

## Medium

**[TM1] No test for `createdAt` index queryability — schema.test.ts** (confidence: 75)

AC7 requires `createdAt` indexed. The schema test confirms the table exists but never writes and queries by `createdAt`. Add a `describe('embeddings table (v9)')` block writing and querying a `NoteEmbedding` record.

**[TM2] No v8→v9 migration continuity test (confidence: 73)**

AC7 states "all data from v1-8 preserved." No test seeds v8 data and triggers the v9 upgrade.

**[TM3] `vector-store.ts` has zero unit tests (confidence: 72)**

`bulkSaveEmbeddings`, `loadVectorIndex`, `saveEmbedding`, `deleteEmbedding`, `getEmbedding` — all untested. Suggested: `src/ai/__tests__/vector-store.test.ts` using `fake-indexeddb`.

---

## Nits

- **[TN1]** `story-e09-s02.spec.ts:46` — No `afterEach` teardown calling `coordinator.terminate()` — idle timers can leak between tests (confidence: 60)
- **[TN2]** `story-e09-s02.spec.ts:9` — AC7 schema test runs `mockEmbeddingWorker` unnecessarily; split into separate `describe` blocks (confidence: 55)
- **[TN3]** `coordinator.test.ts:76` — `vi.spyOn` on prototype not restored; add `spy.mockRestore()` (confidence: 50)

---

## Untested Edge Cases

- Search before `load-index` — error path in `search.worker.ts:40-43` never exercised
- Two concurrent `generateEmbeddings` calls — race on `activeRequests` accounting
- `terminateWorkerType` called for non-existent pool entry
- `bulkSaveEmbeddings` with empty array (boundary condition)
- `Float32Array` serialization across `postMessage` boundaries (mock returns new array, real worker transfers)
