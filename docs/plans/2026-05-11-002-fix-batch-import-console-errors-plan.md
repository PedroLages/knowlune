---
title: Fix Console Errors During Batch Course Import
type: fix
status: active
date: 2026-05-11
---

# Fix Console Errors During Batch Course Import

## Overview

When importing a batch of courses in the learning-tracks page, the console fills with errors. Four distinct issues are addressed: sync engine opaque errors on progress records with null compound PK fields, embedding worker crash cascades, poor worker error diagnostics, and browser extension noise leaking into the app's unhandled rejection handler.

## Problem Frame

During batch course import via `BulkImportDialog` → `batchImportTrackCourses()`:

1. **Sync engine progress error**: Downloaded `video_progress` rows from Supabase may have null `course_id` or `video_id`. The `_getLocalRecord` function builds compound key values `[courseId, videoId]` and passes them to Dexie's `.where().equals()` — null values produce opaque `DataError` / `ConstraintError` exceptions. The outer per-record catch logs the confusing message `[syncEngine] Error applying record from "progress": r` (the `r` is a minified Dexie error string).

2. **Embedding worker crash cascade**: `persistScannedCourse()` fires `generateCourseEmbeddingAfterImport()` after each import. The embedding worker loads `@xenova/transformers` with the `all-MiniLM-L6-v2` model. If model download or WASM initialization fails, the worker crashes. The coordinator's `handleWorkerError` deletes the crashed worker from the pool, but the backfill loop (and per-course import hooks) keep retrying — spawning a fresh worker for each remaining course, which crashes identically. N courses → N identical error messages.

3. **Worker crash diagnostics**: When the worker crashes, `event.error` is null for cross-origin/WASM errors, so the coordinator logs just `[Coordinator] Worker error: Event` with no actionable information. The worker's own `error` event handler calls `self.close()` without posting an error response, leaving the coordinator's pending request hanging until timeout.

4. **Extension noise**: `window.onunhandledrejection` (set by `errorTracking.ts`) captures all promise rejections including those from browser extensions (`background.js`, `serviceWorker.js`). These fill the console with unactionable `Uncaught (in promise)` messages.

## Requirements Trace

- R1. Sync engine must gracefully skip (warn, not error) records with null compound PK fields instead of throwing opaque Dexie errors
- R2. Embedding backfill must stop retrying after consecutive worker crashes instead of producing N identical errors
- R3. Worker crash errors must include diagnostic information (filename, line number) for root-cause identification
- R4. Global unhandled rejection handler must filter known browser extension noise

## Scope Boundaries

- Only console error reduction — no changes to core sync, embedding, or import algorithms; only safety mechanisms around failure handling (circuit breaker and validation guards)
- No timeout or fallback additions to embedding pipeline (separate concern, deferred)
- No changes to the worker pool architecture or model loading strategy
- Browser extension errors that remain unfiltered by Fix D are out of scope

### Deferred to Separate Tasks

- Add embedding timeout with fallback to token-based search (follows `note-qa-embedding-fallback` pattern from docs/solutions): future iteration
- Add worker pool circuit breaker to coordinator (prevent infinite crash-respawn): future iteration

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncEngine.ts` — `_applyRecord` (line 830), `_getLocalRecord` (line 678), `_applyMonotonic` (line 733), per-record catch in `_doDownload` (line 1099)
- `src/lib/sync/syncableWrite.ts` — compound PK validation at lines 110-125 (mirrors what the download path needs)
- `src/lib/sync/tableRegistry.ts` — `progress` entry at line 159: `compoundPkFields: ['courseId', 'videoId']`, `conflictStrategy: 'monotonic'`
- `src/ai/workers/coordinator.ts` — `spawnWorker` (line 173), `handleWorkerError` (line 309)
- `src/ai/workers/embedding.worker.ts` — `initializePipeline` (line 80), `self.addEventListener('error')` (line 176)
- `src/ai/courseEmbeddingService.ts` — `backfillCourseEmbeddings` loop (line 142)
- `src/lib/errorTracking.ts` — `initErrorTracking` sets `window.onunhandledrejection` (line 75)
- `src/lib/courseImport.ts` — `persistScannedCourse` triggers embedding after import (line 715)

### Institutional Learnings

- **compound-pk-recordid-synthesis** (docs/solutions/best-practices/): Compound PK tables need synthesized `recordId` using `` delimiter. Both upload and download paths must agree on PK structure.
- **note-qa-embedding-fallback** (docs/solutions/runtime-errors/): Embedding worker hangs need timeouts (5s `Promise.race`) with fallback to token search. The pattern is in `src/lib/noteQA.ts`.
- **track-import-consolidation-lessons** (docs/solutions/developer-experience/): Every `await` in a dialog action handler needs try-catch with user-facing error feedback. Batch import path bypasses per-course progress store and needs its own error recovery.
- **shell-error-signaling-split-transport-from-parse** (docs/solutions/best-practices/): Distinguish transport-level failures from content-level failures — separate signals prevent misdiagnosis.

## Key Technical Decisions

- **Compound PK guard placement**: Add validation in `_applyRecord` before `_getLocalRecord` is called, not inside `_getLocalRecord` itself. This catches all three compound PK code paths (soft-delete, lookup, and put) in one location and mirrors the `syncableWrite.ts` validation pattern.
- **Consecutive failure threshold**: 3. One transient failure is normal (network blip during model download), two might be bad luck, three in a row indicates a persistent problem. The counter resets on success so transient issues don't accumulate.
- **Worker error diagnostics**: Use `event.filename`, `event.lineno`, `event.colno` from the `ErrorEvent` — these are populated even when `event.error` is null for cross-origin errors. Post an error response from the worker before closing so the coordinator can reject cleanly.
- **Extension noise filter**: Check the rejection reason's message and stack for known extension URL patterns (`chrome-extension://`, `background.js`, `serviceWorker.js`, `runtime.lastError`) rather than origin-based filtering, since extension rejections often don't have a usable origin.

## Implementation Units

- [ ] **Fix A: Add compound PK validation guard in sync engine download path**

**Goal:** Prevent opaque Dexie errors when downloaded records have null compound PK fields

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Test: `src/lib/sync/__tests__/syncEngine.download.test.ts`

**Approach:**
- Add a validation block at the top of `_applyRecord`, after the table-existence check and before the soft-delete guard
- Check `entry.compoundPkFields` — if any field value is `null` or `undefined` in the record, log a warning and return early
- This protects all compound-PK tables: `progress` (`[courseId, videoId]`), `sessionItems` (`[courseId, itemId]`), `bookEpubAudioMaps` (`[epubBookId, audioBookId]`)

**Patterns to follow:**
- `src/lib/sync/syncableWrite.ts:110-125` — equivalent validation in the write/upload path
- `src/lib/sync/syncEngine.ts:847-866` — soft-delete guard (same structural pattern: early return after validation)

**Test scenarios:**
- Happy path: Record with valid `courseId` and `videoId` applies normally via `_applyMonotonic`
- Happy path: Non-compound-PK table record applies normally (guard does not interfere)
- Edge case: Record with `courseId: null, videoId: 'abc'` is skipped with a warning, not an error
- Edge case: Record with `courseId: undefined, videoId: undefined` is skipped with a warning
- Edge case: Record with valid compound PK where one field is `0` (falsy but valid) passes the guard (`!= null` check)

**Verification:**
- Sync engine download log shows `[syncEngine] Skipping record in "progress": missing compound PK field(s): courseId` instead of `[syncEngine] Error applying record from "progress": r`
- Valid records continue to apply without false positives

---

- [ ] **Fix C: Add consecutive failure breaker to embedding backfill**

**Goal:** Prevent cascading identical errors when the embedding worker is persistently broken

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/ai/courseEmbeddingService.ts`
- Test: `src/ai/__tests__/courseEmbeddingService.test.ts`

**Approach:**
- Add a `consecutiveFailures` counter and `MAX_CONSECUTIVE_FAILURES = 3` constant in `backfillCourseEmbeddings`
- Increment on each failure, reset to 0 on success
- When threshold is reached, break the loop with a `console.warn` noting how many courses were skipped
- The existing per-course error log stays unchanged — only the loop-breaking logic is new

**Patterns to follow:**
- `src/lib/sync/syncEngine.ts:1099-1107` — per-record try/catch with continue-on-error (same "log and continue" philosophy, this adds a circuit breaker)

**Test scenarios:**
- Happy path: All courses embed successfully → `processed: N, failed: 0`
- Edge case: One transient failure, then success → counter resets, loop continues normally
- Edge case: Three consecutive failures → loop breaks, warning logged, `failed: 3`, remaining courses skipped
- Error path: Worker permanently broken → only 3 errors logged (not N), abort warning includes skip count

**Verification:**
- With 10 courses and a broken embedding worker, only 3 `[CourseEmbedding] Backfill failed` messages appear plus one abort warning (not 10 failures)
- Normal backfill with a working worker completes all courses

---

- [ ] **Fix B: Improve embedding worker error diagnostics**

**Goal:** Surface actionable diagnostic information when the embedding worker crashes

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/ai/workers/embedding.worker.ts`
- Modify: `src/ai/workers/coordinator.ts`
- Test: `src/ai/workers/__tests__/coordinator.test.ts`

**Approach:**
- In `embedding.worker.ts`: Track the `requestId` from the last received message at module scope so the error handler can include it. Replace the bare `self.addEventListener('error', ...)` handler that calls `self.close()` with one that posts an error response to the coordinator first, including the error message, filename, line number, and the tracked `requestId` (so `routeWorkerMessage` can route the rejection to the correct pending request)
- In `coordinator.ts`: Include `event.filename`, `event.lineno`, `event.colno` in the console error log so WASM/cross-origin crashes are traceable even when `event.error` is null

**Patterns to follow:**
- `src/ai/workers/coordinator.ts:173-216` — existing `spawnWorker` error handling structure
- `src/ai/workers/embedding.worker.ts:80-114` — existing `initializePipeline` error handling (try/catch with clean message)

**Test scenarios:**
- Error path: Worker crashes with a WASM error → coordinator log includes `at embedding.worker.ts:95:12` location
- Error path: Worker crash with null `event.error` → falls back to `event.message` with location info
- Integration: Pending request for the crashed worker is rejected with a meaningful error message (not left hanging)
- Happy path: Normal embedding flow still works (worker boots, loads model, generates embeddings)

**Verification:**
- Block the worker module in DevTools Network tab, trigger an embed → console shows `[Coordinator] Worker error at .../embedding.worker.ts:42:5: Failed to load module script`
- Pending request is rejected cleanly (no hanging promise)

---

- [ ] **Fix D: Filter browser extension noise from global unhandled rejection handler**

**Goal:** Remove unactionable browser extension errors from the app's console output

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/lib/errorTracking.ts`
- Test: `src/lib/__tests__/errorTracking.test.ts`

**Approach:**
- In the `onunhandledrejection` handler within `initErrorTracking`, check the rejection reason against known extension patterns
- If the reason's message contains any of the known extension patterns (`background.js`, `serviceWorker.js`, `runtime.lastError`, `No tab with id`, `chrome-extension://`, `moz-extension://`) — call `event.preventDefault()` and return silently (substring match, not exact match)
- Real app errors continue to be logged as before

**Patterns to follow:**
- `src/lib/errorTracking.ts:75-89` — existing handler structure

**Test scenarios:**
- Edge case: `Promise.reject(new Error('background.js error'))` → suppressed, no console output from handler
- Edge case: `Promise.reject(new Error('real app error'))` → logged as `[Knowlune:Error] UnhandledPromiseRejection`
- Edge case: Extension error with `chrome-extension://abc123/background.js` in message → suppressed
- Edge case: Non-Error rejection reason (string, number) → still processed correctly

**Verification:**
- Dispatch a fake extension rejection in console: `new Promise((_, r) => r(new Error('background.js:2'))` → no app error log
- Dispatch a real app rejection: `new Promise((_, r) => r(new Error('legitimate bug')))` → `[Knowlune:Error]` log appears
- Run batch import → extension noise is gone from console

## System-Wide Impact

- **Interaction graph:** Fix A (sync engine) is called from `_doDownload` which runs on sync cycle triggers (auth state change, store refresh, write nudge). Fix B (worker diagnostics) modifies the worker error path in coordinator.ts and embedding.worker.ts. Fix C (backfill breaker) is called from `main.tsx` startup via `backfillCourseEmbeddings`. Fix D (error tracking) runs at app bootstrap.
- **Error propagation:** All fixes add graceful degradation (warn + skip) rather than changing existing error propagation. No new error paths are introduced.
- **Unchanged invariants:** Valid sync records apply identically. Successful embeddings process identically. Worker pool lifecycle is unchanged (crash → terminate → respawn pattern preserved, only diagnostics improve). Existing `[Knowlune:Error]` log format preserved for real app errors.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Fix A false positive: valid record with falsy-but-valid PK (e.g., `courseId: ''`) incorrectly skipped | Use `!= null` check (not `!record[f]`) to only reject null/undefined, not empty strings or 0 |
| Fix B requestId not available: error handler can't route the rejection to the correct pending request | Track last received `requestId` at module scope in the worker so the error handler always has access (detailed in Fix B approach) |
| Fix C threshold too low: transient network blip causes 3 failures and aborts prematurely | Counter resets on any success; 3 consecutive failures for embedding (which uses a cached model after first load) strongly indicates persistent failure |
| Fix D too aggressive: legitimate app error containing a filter pattern in its message is suppressed | Patterns are specific substrings (`background.js`, `serviceWorker.js`, `runtime.lastError`, `No tab with id`, `chrome-extension://`, `moz-extension://`) — highly unlikely in legitimate app errors |

## Sources & References

- **Relevant solutions:**
  - `docs/solutions/best-practices/compound-pk-recordid-synthesis-in-syncable-write-2026-04-19.md`
  - `docs/solutions/runtime-errors/note-qa-embedding-fallback-2026-04-28.md`
  - `docs/solutions/developer-experience/track-import-consolidation-lessons-2026-05-10.md`
  - `docs/solutions/best-practices/shell-error-signaling-split-transport-from-parse-2026-04-24.md`
- **Related code:**
  - `src/lib/sync/syncEngine.ts`
  - `src/lib/sync/syncableWrite.ts`
  - `src/lib/sync/tableRegistry.ts`
  - `src/ai/workers/coordinator.ts`
  - `src/ai/workers/embedding.worker.ts`
  - `src/ai/courseEmbeddingService.ts`
  - `src/lib/errorTracking.ts`
