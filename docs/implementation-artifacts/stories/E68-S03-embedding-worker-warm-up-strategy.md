# Story 68.3: Embedding Worker Warm-Up Strategy

Status: ready-for-dev

## Story

As a learner,
I want the AI model to be pre-loaded when I open Knowlune,
so that my first semantic search or note embedding has no noticeable delay.

## Acceptance Criteria

1. **Given** the app has finished initial render **When** 3 seconds have elapsed after bootstrap **Then** the system initiates a warm-up call to the embedding worker **And** the warm-up does not compete with the initial React render or route transitions.

2. **Given** the warm-up is triggered **When** the worker receives a `warm-up` message **Then** the worker initializes the pipeline (loading model if needed) and runs a dummy inference **And** responds with `{ type: 'success', result: { warmed: true } }`.

3. **Given** the warm-up timeout **When** the worker is performing a cold-start download + initialization **Then** the timeout is set to 15 seconds (not the default 5s) to accommodate model download (EC11).

4. **Given** warm-up is triggered on a low-RAM device (`navigator.deviceMemory < 4`) **When** the system detects low memory **Then** warm-up is skipped with a console log `[WarmUp] Low RAM, deferring` (EC8).

5. **Given** warm-up fails (offline, storage full, worker crash) **When** the warm-up promise rejects **Then** the error is silently swallowed (no toast, no user-visible error) **And** the first real embedding request triggers model load as fallback.

6. **Given** the user switches tabs during an active warm-up or model download **When** `visibilitychange` fires with `document.hidden === true` **Then** the worker is NOT terminated (existing idle-termination logic must check for active warm-up) (EC20).

7. **Given** the worker currently only handles `embed` message type **When** a `warm-up` message is received **Then** the worker handles it explicitly instead of returning "Unknown request type" (EC12).

## Tasks / Subtasks

- [ ] Task 1: Add `warm-up` message handler to `embedding.worker.ts` (AC: #2, #7)
  - [ ] Add `'warm-up'` as a recognized message type in the `onmessage` handler
  - [ ] On `warm-up`: call `initializePipeline()`, then run a dummy inference `pipeline(['warmup'], { pooling: 'mean', normalize: true })`
  - [ ] Respond with `{ requestId, type: 'success', result: { warmed: true } }`
  - [ ] Update `WorkerRequestType` in `types.ts` to include `'warm-up'`

- [ ] Task 2: Add `warmUp()` method to coordinator (AC: #1, #3)
  - [ ] Add public `warmUp()` method that calls `executeTask('warm-up', {}, { timeout: 15_000 })`
  - [ ] Use 15-second timeout (EC11) to accommodate cold-start model download
  - [ ] Return `Promise<void>` -- caller doesn't need the result

- [ ] Task 3: Add warm-up effect in `App.tsx` (AC: #1, #4, #5)
  - [ ] `useEffect` with `setTimeout(3000)` to defer warm-up after initial render
  - [ ] Guard with `navigator.deviceMemory` check: skip if `< 4` (EC8)
  - [ ] Call `coordinator.warmUp()` and catch/swallow all errors silently
  - [ ] Clean up timer on unmount via `clearTimeout`

- [ ] Task 4: Protect worker from `visibilitychange` kill during warm-up (AC: #6)
  - [ ] Add `warmUpInProgress` flag to coordinator
  - [ ] Set flag `true` before warm-up, `false` on completion/failure
  - [ ] Modify `visibilitychange` handler at `coordinator.ts:418-424` to check flag before `terminate()`
  - [ ] If warm-up in progress, skip termination and log `[Coordinator] Skipping terminate - warm-up in progress`

- [ ] Task 5: Unit tests (AC: #1-#7)
  - [ ] Test worker handles `warm-up` message type (not "Unknown request type")
  - [ ] Test coordinator `warmUp()` uses 15s timeout
  - [ ] Test low-RAM guard skips warm-up
  - [ ] Test `visibilitychange` does not terminate during warm-up
  - [ ] Test warm-up failure is silently swallowed

## Dev Notes

### Existing Infrastructure

- **Worker message handler** at `embedding.worker.ts:109-121` only accepts `type === 'embed'` and returns error for anything else. Must add `'warm-up'` case.
- **`WorkerRequestType`** at `types.ts:8` is `'embed' | 'search' | 'infer' | 'load-index'`. Add `'warm-up'`.
- **`visibilitychange` handler** at `coordinator.ts:418-424` unconditionally calls `coordinator.terminate()` on tab hide. This will kill any in-progress warm-up or download. Must guard with `warmUpInProgress` flag.
- **`WORKER_POOL_CONFIG.defaultTimeout`** is 5s at `coordinator.ts:34`. Warm-up needs 15s override.
- **`coordinator.spawnWorker()`** at `coordinator.ts:173-217` maps `WorkerRequestType` to worker URLs. `'warm-up'` should use the same `embedding.worker.ts` URL as `'embed'`. Consider routing `warm-up` through the existing `embed` worker ID to avoid spawning a separate worker.

### Critical Implementation Details

- **Worker ID conflict**: The coordinator maps task type to worker ID via `getWorkerId()` at line 356: `${type}-worker`. If `warm-up` gets its own worker ID (`warm-up-worker`), it would spawn a separate worker from the embed worker. Instead, route `warm-up` tasks to the `embed` worker by overriding `getWorkerId` or by having `warmUp()` call `executeTask('embed', ...)` with a special warm-up payload. **Recommended approach**: Add a `warm-up` case in `spawnWorker` that points to `embedding.worker.ts`, and have `getWorkerId('warm-up')` return `'embed-worker'` so it reuses the embed worker instance.
- **`navigator.deviceMemory`** is a Chrome-only API (not available in Firefox/Safari). Guard with `typeof navigator !== 'undefined' && 'deviceMemory' in navigator`. If unavailable, proceed with warm-up (assume sufficient RAM).
- **App.tsx** currently has a `useEffect` for `visibilitychange` cleanup at the app level. The warm-up effect should be a separate `useEffect` to keep concerns separated.

### File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/ai/workers/types.ts` | MODIFY | Add `'warm-up'` to `WorkerRequestType` union |
| `src/ai/workers/embedding.worker.ts` | MODIFY | Add `warm-up` message handler |
| `src/ai/workers/coordinator.ts` | MODIFY | Add `warmUp()` method, `warmUpInProgress` flag, guard `visibilitychange` |
| `src/app/App.tsx` | MODIFY | Add warm-up `useEffect` with 3s delay, low-RAM guard |

### Project Structure Notes

- No new files created -- all modifications to existing files
- `WorkerRequestType` change affects type narrowing across coordinator and workers
- Warm-up in App.tsx should be a standalone `useEffect` (not merged with existing effects)

### References

- [Source: _bmad-output/planning-artifacts/epics-on-device-embeddings.md - Story 68.3]
- [Source: _bmad-output/planning-artifacts/architecture-on-device-embeddings.md - ADR-6: Warm-Up Strategy]
- [Source: src/ai/workers/coordinator.ts:418-424 - visibilitychange handler]
- [Source: src/ai/workers/coordinator.ts:34 - defaultTimeout: 5_000]
- [Source: src/ai/workers/embedding.worker.ts:109-121 - onmessage handler]
- [Source: src/ai/workers/types.ts:8 - WorkerRequestType]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
