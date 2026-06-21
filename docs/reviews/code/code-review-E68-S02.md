# Code Review: E68-S02 — Cache API Validation and OpenAI Fallback

**Branch:** `feature/e68-s02-cache-api-validation-and-openai-fallback`
**Review date:** 2026-06-22
**Reviewer:** Claude Code

---

## Overview

This story implements a two-tier embedding pipeline with local (Transformers.js) and remote (OpenAI API) providers behind an `EmbeddingProvider` interface. The abstraction is minimal and correct — no factory, no registry, two providers instantiated explicitly at the seam. Cache API self-checks in the worker coordinator and ONNX backend initialization error handling in the embedding worker round out the changes.

---

## What Works Well

1. **Clean provider abstraction**: The `EmbeddingProvider` interface has exactly three members (`name`, `embed()`, `isAvailable()`). No over-abstraction. Both providers are instantiated directly in the pipeline rather than through a registry.

2. **Per-request fallback (not sticky)**: The pipeline always tries local first, then OpenAI. This means a user who configures an API key mid-session gets immediate fallback, and the local provider can recover on the next page load.

3. **Debounced error surfacing**: The `errorTypesSurfaced` set in the pipeline prevents repeated console noise for the same error type across multiple note saves. Clean implementation with `markErrorSurfaced()`.

4. **Comprehensive coordinator tests for AC7**: Three test variants cover the `cacheUnavailable` flag: Cache API available (`false`), `caches.has()` returns `false` (`true`), and `typeof caches === 'undefined'` (`true`).

5. **Fixes carried over from prior review findings**: API key is now trimmed in the constructor (`apiKey.trim()`), the cache probe in `handleWorkerError` correctly runs AFTER the rejection loop, and the `embedding.worker.ts` outer catch correctly re-throws the original error instead of a new generic message.

---

## Findings

### HIGH

#### Finding 1: Error reason stripped at worker message boundary — AC8 not met in production

**File:** `src/ai/workers/embedding.worker.ts:296-306`
**Confidence:** 95
**Category:** Correctness, Data Loss

**Description:**
The embedding worker's `initializePipeline` sets a `reason` property on thrown errors (e.g., `reason: 'onnx-backend-failed'`). However, the `onmessage` catch handler (line 296-306) serializes the error as a string into `WorkerErrorResponse.error`, discarding all structured properties:

```typescript
const errorResponse: WorkerErrorResponse = {
  requestId,
  type: 'error',
  error: error instanceof Error ? error.message : 'Unknown error',
  // reason is never included
}
```

The `WorkerErrorResponse` interface (`src/ai/workers/types.ts:37-41`) has no `reason` field — only `error: string`. The coordinator's `routeWorkerMessage` then creates `new Error(response.error)`, producing a plain `Error` object with no `reason` property.

**Impact:**
The pipeline's `tryLocalEmbedding` catch handler always sees `reason === 'unknown'` in production:

```typescript
const reason = (error as Error & { reason?: string }).reason ?? 'unknown'
```

This means telemetry cannot distinguish "ONNX backend failed" from "model download failed" from "cache unavailable." AC 8 states "the error surfaces with the failure reason" — this is not achieved in production.

**Fix required:**
1. Add `reason?: string` to `WorkerErrorResponse` in `src/ai/workers/types.ts`
2. In `embedding.worker.ts:296-306`, extract `reason` from the error object and include it in the error response
3. In `coordinator.ts:149`, when creating the rejection error, attach the `reason` property so it survives to the pipeline catch handler

**~effort:** 15 minutes (add optional field to response type + 3 lines to propagate through the chain)

---

#### Finding 2: No test for successful OpenAI fallback path in pipeline

**File:** `src/ai/__tests__/embeddingPipeline.fallback.test.ts:168-204`
**Confidence:** 95
**Category:** Test Coverage Gap

**Description:**
The describe block "Edge case — local fails, OpenAI fallback succeeds" contains two tests, but neither verifies a successful OpenAI fallback. The `beforeEach` mock sets:

```typescript
globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network not mocked'))
```

Since the fetch mock always rejects, the OpenAI call path always fails. The tests only verify that `getDecryptedApiKeyForProvider` was called (proving the pipeline *attempted* the fallback), but:
- There is no assertion that `fetch` was called with the correct request body (`text-embedding-3-small`, `dimensions: 384`)
- There is no assertion that `vectorStorePersistence.saveEmbedding` is called when OpenAI succeeds
- The test assertions at lines 189 and 202 explicitly note "saveEmbedding not called because OpenAI fetch is mocked to fail"

**Impact:**
The entire "OpenAI fallback succeeds" acceptance criterion (AC 2) has no end-to-end test. A regression that breaks successful OpenAI embedding would not be caught.

**Fix required:**
Add a test that mocks `global.fetch` to return a 200 response with valid 384-dim embeddings, then asserts:
- `fetch` was called with the correct URL, method, headers, and body
- `vectorStorePersistence.saveEmbedding` was called with the correct note ID and embedding vector

**~effort:** 15 minutes

---

### MEDIUM

#### Finding 3: AC8 test in coordinator is misleading — tests error message, not reason propagation

**File:** `src/ai/workers/__tests__/coordinator.test.ts:448-483`
**Confidence:** 90
**Category:** Test Quality

**Description:**
The test "AC8: preserves onnx-backend-failed reason in worker error response" claims to test reason preservation but only verifies:

```typescript
await expect(coordinator.executeTask('embed', { texts: ['test'] })).rejects.toThrow(
  'ONNX backend initialization failed'
)
```

The mock worker sends a `reason` field in its response data (`reason: 'onnx-backed-failed'` at line 464), but the coordinator's `routeWorkerMessage` ignores it (the `WorkerErrorResponse` type has no `reason` field). The test passes because the error message string matches, not because the reason property was preserved.

**Impact:**
The test creates a false sense of security. The misleading test name combined with green status makes it appear AC8 is properly tested, when in practice the reason property is always stripped in production (see Finding 1).

**Fix required:**
Either rename the test to accurately describe what it tests (e.g., "propagates ONNX error message from worker to coordinator"), or fix the error propagation chain first and then add a proper assertion on the reason property.

**~effort:** 2 minutes (rename) or combined with Finding 1 fix

---

#### Finding 4: Misleading test describe block — "fallback succeeds" but tests only "fallback is attempted"

**File:** `src/ai/__tests__/embeddingPipeline.fallback.test.ts:168-204`
**Confidence:** 85
**Category:** Test Quality

**Description:**
The describe block at line 168 reads "Edge case — local fails, OpenAI fallback succeeds," but neither test within it verifies a successful OpenAI response. The test at line 169 says "reads OpenAI key when local provider fails" (accurate) and the test at line 193 says "calls OpenAI when local provider throws onnx-backend-failed" (inaccurate — it only verifies the key was read, not that OpenAI was actually called and succeeded).

**Impact:**
Engineers reading the test output will believe the successful fallback path is covered when it is not. This can mask regressions introduced by future changes to the pipeline.

**Fix required:**
Rename the describe block and tests to accurately reflect what they verify (e.g., "local fails, OpenAI fallback is attempted"). Add proper tests for the success path (see Finding 2).

**~effort:** 2 minutes (rename)

---

### LOW

#### Finding 5: `cacheUnavailable` flag dispatched but never consumed

**File:** `src/ai/workers/coordinator.ts:389-399`
**Confidence:** 85
**Category:** Unused Data

**Description:**
The `worker-crash` CustomEvent detail now includes a `cacheUnavailable` boolean flag. However, the only listener for this event (`EmbeddingModelProgressToast.tsx:266-301`) does not read this field. The `cacheUnavailable` flag is dispatched to `window` but never acted upon by any component.

**Impact:**
The flag adds to the event contract but has zero runtime effect. This is acceptable per the story scope (AC7 only requires that the flag is surfaced in the event detail), but if the flag is not consumed within the next few stories, it becomes dead code.

**Recommendation:**
Add a consumer for `cacheUnavailable` in the UI (e.g., adjust the error toast message based on whether the cache is unavailable vs. a transient crash: "model cannot load in this browser" vs. "model download failed, retrying").

**~effort:** N/A (recommendation only)

---

#### Finding 6: No test for `EmbeddingPipeline.removeNote()`

**File:** `src/ai/embeddingPipeline.ts:226-232`
**Confidence:** 90
**Category:** Test Coverage Gap

**Description:**
The `removeNote()` method is exported and callable but has no unit test. It delegates to `vectorStorePersistence.removeEmbedding()` with error logging, which is straightforward, but still uncovered.

**Impact:**
A regression that breaks `removeEmbedding` call forwarding would not be caught.

**Fix optional:** Add a simple test that mocks `vectorStorePersistence.removeEmbedding`, calls `pipeline.removeNote('note-1')`, and asserts the mock was called with the correct argument.

**~effort:** 5 minutes

---

#### Finding 7: No pipeline-level test for `warmUp()` error handling

**File:** `src/ai/embeddingPipeline.ts:221-223`
**Confidence:** 80
**Category:** Test Coverage Gap

**Description:**
The `warmUp()` method delegates to `warmUpEmbeddingModel()` without a try/catch, relying on the caller (App.tsx) to handle errors. The coordinator's `warmUp()` method does have an internal try/catch, so errors should not propagate, but there's no test at the pipeline level that verifies this contract.

**Impact:**
If a future change modifies `warmUpEmbeddingModel()` to throw unexpectedly, the pipeline's `warmUp()` could throw, and no pipeline-level test would catch it.

**Fix optional:** Add a test injecting a `warmUpEmbeddingModel` rejection and asserting that `pipeline.warmUp()` resolves without throwing.

**~effort:** 5 minutes

---

### NIT

#### Finding 8: Pipeline test comment documents known gap but uses no `skip`/`todo` marker

**File:** `src/ai/__tests__/embeddingPipeline.fallback.test.ts:171-178`
**Confidence:** 85
**Category:** Test Maintainability

**Description:**
Line 171-178 has a detailed comment explaining that the `reason` property is lost at the worker message boundary in production, and that the test only validates the pipeline's extraction logic, not the real propagation chain. This is valuable documentation, but the test itself passes with green status, creating no signal that this gap exists.

**Recommendation:** Add `it.fails` or `it.skip` with the gap documentation, or add a `todo` reference to the tracking issue/story. Better yet, fix the propagation issue (Finding 1) so the comment becomes outdated.

**~effort:** 1 minute

---

#### Finding 9: AC8 test mock includes type-violating `reason` field

**File:** `src/ai/workers/__tests__/coordinator.test.ts:464`
**Confidence:** 90
**Category:** Test Hygiene

**Description:**
The AC8 test mock worker response at line 460-465 includes `reason: 'onnx-backed-failed'` in the response data, but `WorkerErrorResponse` has no `reason` field. This is technically a type violation masked by the test mock's structure (the mock worker extends `EventTarget` directly and bypasses the type system).

**Recommendation:** Either remove the unused `reason` field from the mock to align with the actual type contract, or add `reason` to `WorkerErrorResponse` and fix the propagation chain (Finding 1).

**~effort:** 1 minute

---

### Previously Reviewed Findings (Status)

| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| Error reason stripped in worker's outer catch | HIGH | **FIXED** | Line 243-244 now re-throws original error |
| Cache probe blocks pending request rejection | MEDIUM | **FIXED** | Rejection loop moved before cache probe |
| API key not trimmed in constructor | LOW | **FIXED** | `apiKey.trim()` in constructor |
| Redundant `isAvailable()` call | NIT | **FIXED** | Code comment explains why it's skipped |

---

## Summary

**Issues found: 9** | **Blockers: 0** | **High: 2** | **Medium: 2** | **Low: 3** | **NIT: 2**

The code quality is generally high. Both HIGH findings center on the error reason propagation chain: the `reason` property set in `embedding.worker.ts:initializePipeline` is stripped before reaching the pipeline's telemetry, and there is no test that validates a successful OpenAI fallback response end-to-end. The medium findings are secondary effects of these same root causes (misleading test names and assertions).

### Recommended Fix Priority

1. **Fix error reason propagation** (Finding 1) — three minimal changes across `types.ts`, `embedding.worker.ts`, and `coordinator.ts`. This closes the gap between AC 8's requirement and production behavior, and also resolves Findings 3, 8, and 9.

2. **Add OpenAI success-pipeline test** (Finding 2) — mock `fetch` to return valid 384-dim embeddings, verify `saveEmbedding` was called. This closes the test coverage gap for AC 2.

3. **Rename misleading tests** (Findings 3, 4) — ensure test names and describe blocks accurately reflect what they verify, especially after the propagation fix.
