## Code Review: E68-S02 — Cache API Validation and OpenAI Fallback

### What Works Well

1. **Clean provider abstraction**: The `EmbeddingProvider` interface is minimal with only `embed()`, `isAvailable()`, and `name`. No factory, no registry -- two providers instantiated at the seam. This restraint keeps the abstraction cost near-zero while enabling the fallback chain.

2. **Per-request fallback (not sticky)**: The pipeline always tries local first, then OpenAI. This means a user who configures an OpenAI key mid-session gets immediate fallback, and on-device recovery on the next session also works without stale state.

3. **Debounced error surfacing**: The `errorTypesSurfaced` set prevents flooding the console with duplicate telemetry for the same error type. Clean implementation with `markErrorSurfaced()` returning a boolean for the "first time" signal.

---

### Findings

#### High Priority

- **`src/ai/workers/embedding.worker.ts:238-248` (confidence: 90) [Correctness] error-reason-stripped**: The outer `catch` in `initializePipeline` catches errors with a `reason` property (`onnx-backend-failed`, `cache-unavailable`, `model-load-failed`) but then throws a new generic `Error('Unable to load AI model. Check your internet connection.')` that strips the `reason` property.

  **Why matters for learners**: The pipeline's `tryLocalEmbedding` catch (`embeddingPipeline.ts:135-136`) attempts to extract `reason` from the error for telemetry, but gets `'unknown'` in every production failure. This violates AC #8's requirement that "the error surfaces with the failure reason" -- the reason is buried in a worker console log and never reaches the pipeline's structured telemetry. As a result, operators can't distinguish "ONNX backend failed" from "model download failed" from "cache unavailable" in production.

  **Fix**: Either (a) re-throw the original error instead of creating a new one, or (b) carry the original error as a `cause` and propagate `reason` through the worker's error response protocol. The simplest fix is changing `throw new Error(...)` to `throw error` -- the generic message was intended for user-facing errors but the pipeline already handles this gracefully with its own logging.

  **~effort**: 5 minutes (1 line change).

  **Risk**: Low -- the error is already caught by the worker's `onmessage` handler which extracts `.message`. Re-throwing the original preserves the message and adds the `reason` property. No consumer reads `error.message` expecting the generic string.

#### Medium

- **`src/ai/workers/coordinator.ts:360-398` (confidence: 85) [Architecture] cache-probe-blocks-rejection**: The Cache API probe (`await caches.has('transformers-cache')`) at lines 363-371 runs BEFORE the pending request rejection loop at lines 393-398. The comment at line 361-362 claims this is "async but non-blocking -- fire and forget so the rejection of pending requests is not delayed," but the code contradicts this: the `await` blocks execution, delaying rejection of pending requests until the Cache API probe completes.

  **Why matters**: If `caches.has()` is slow (e.g., Cache API lock contention, IndexedDB pressure under memory stress), the pipeline's pending requests are held in limbo longer than necessary. The pipeline may timeout (default 5s) with a misleading timeout error while waiting for a cache probe, masking the actual worker crash error.

  **Fix**: Move the cache probe block (lines 360-371) to AFTER the rejection loop (after line 398). Or, make it truly fire-and-forget by calling it without `await` and updating `cacheAvailable` later (though the event dispatch happens synchronously, so this is trickier -- prefer the reorder).

  **~effort**: 5 minutes (move 12 lines).

- **`src/ai/__tests__/embeddingPipeline.fallback.test.ts:152-153, 216-218` (confidence: 90) [Testing] test-masks-propagation-issue**: The tests for AC #8 mock `generateEmbeddings` with errors that directly carry a `reason` property (e.g., `Object.assign(new Error('...'), { reason: 'onnx-backend-failed' })`), because the mock bypasses the worker entirely. These tests pass, but in production the real error chain from worker to pipeline strips the `reason` (see finding 1 above). The tests verify a scenario that doesn't match production behavior, masking the propagation bug.

  **Why matters**: If a developer relies on these green tests as evidence that AC #8 is met, they will be misled. The `reason` field is never populated in production. The telemetry log `expect.objectContaining({ reason: 'onnx-backend-failed' })` will always fail against a real error chain.

  **Fix**: After fixing finding 1 (re-throw the original error in the worker), add a test that imports the actual pipeline and verifies that the `reason` property survives the full cycle through a real (not mocked) `generateEmbeddings` rejection. In the short term, add a comment to the existing tests noting that they test the pipeline's extraction logic only, not the propagation chain.

  **~effort**: 15 minutes (add an integration-style test that validates reason propagation).

#### Low

- **`src/ai/embeddings/openaiProvider.ts:118` (confidence: 85) [Correctness] api-key-not-trimmed**: The constructor stores `this.apiKey = apiKey` without trimming, but `isAvailable()` at line 128 checks `this.apiKey.trim().length > 0`. `embed()` at line 173 sends `Authorization: Bearer ${this.apiKey}` with the untrimmed key. If a user's configured API key has leading or trailing whitespace, `isAvailable()` returns `true` but the API call fails with 401 because `"Bearer   sk-abc"` (with leading space) is invalid.

  Why: User-friendly API key input handling. Leading/trailing whitespace in copied keys is a common source of "works in dev, not in prod" bugs.

  Fix: `this.apiKey = apiKey.trim()` in the constructor.

  **~effort**: 2 minutes.

#### Nits

- **Nit** `src/ai/embeddingPipeline.ts:175-178` (confidence: 95) [Maintainability]: The `isAvailable()` call on the OpenAI provider is dead code. At line 169, `if (!apiKey) return null` already guarantees the key is truthy (non-null, non-empty string). `isAvailable()` checks `typeof this.apiKey === 'string' && this.apiKey.trim().length > 0`, which will always be `true` at this point. Remove the `isAvailable()` check, or add a comment explaining why it exists as a defensive guard.

  **~effort**: 2 minutes.

---

### Recommendations

1. Fix the error reason propagation in `embedding.worker.ts:238-248` first (finding 1 -- HIGH). This is the only finding with a correctness impact on AC #8, and fixing it also automatically makes the test gap less critical.
2. Reorder the cache probe in `coordinator.ts:360-398` (finding 2 -- MEDIUM) for correctness of intent.
3. Trim the API key in `openaiProvider.ts:118` (finding 3 -- LOW) as a quick hygiene fix.
4. Remove the redundant `isAvailable()` call (Nit) if you're touching that code path anyway.

---
Issues found: 5 | Blockers: 0 | High: 1 | Medium: 2 | Low: 1 | Nits: 1
Confidence: avg 89 | >= 90: 3 | 70-89: 2 | < 70: 0
