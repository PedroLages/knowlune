---
story_id: E68-S02
story_name: 'Cache API Validation and OpenAI Fallback'
status: done
reviewed: true
review_started: 2026-06-22
completed: 2026-06-22
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests-skipped
  - design-review-skipped
  - code-review
  - code-review-testing
  - performance-benchmark-skipped
  - security-review
  - exploratory-qa-skipped
---

# Story 68.2: Cache API Validation and OpenAI Fallback

## Story

As a learner,
I want the embedding pipeline to gracefully fall back to OpenAI when the on-device model fails,
so that semantic search works reliably even when the local model can't load.

## Acceptance Criteria

1. **Given** the on-device Transformers.js model is available **When** `indexNote()` is called **Then** it uses the local provider **And** the OpenAI provider is never called.

2. **Given** the local provider is unavailable (Cache API empty, ONNX backend failed, workers unsupported) **When** the user has configured an OpenAI API key **Then** the pipeline falls back to the OpenAI Embeddings API with `text-embedding-3-small` and `dimensions: 384` **And** returns 384-dim vectors.

3. **Given** the local provider fails and no OpenAI key is configured **When** `indexNote()` is called **Then** the note is saved without an embedding **And** a warning is logged.

4. **Given** the OpenAI API returns a 401 status **When** the embedding request is made **Then** an `InvalidApiKeyError` is thrown **And** the error is logged with `provider: 'openai'` and `code: 'invalid_api_key'`.

5. **Given** the OpenAI API returns a 429 status **When** the embedding request is made **Then** the request is retried with exponential backoff (up to 3 times) **And** if all retries fail, the error is thrown.

6. **Given** the OpenAI API returns embeddings with dimensions != 384 **When** the response is validated **Then** an `EmbeddingDimensionError` is thrown **And** mismatched vectors are NOT written to the vector store.

7. **Given** a worker crashes **When** `handleWorkerError()` processes the crash **Then** it probes `caches.has('transformers-cache')` **And** surfaces a `cacheUnavailable` flag via the crash event detail.

8. **Given** the ONNX backend fails to initialize **When** the worker tries to configure `env.backends.onnx.wasm.numThreads` **Then** it reports `{ reason: 'onnx-backend-failed' }` **And** the error surfaces with the failure reason.

## Tasks / Subtasks

- [x] Task 1: Create `src/ai/embeddings/EmbeddingProvider.ts` (AC: #1)
  - Interface with `embed(texts)`, `isAvailable()`, `name`

- [x] Task 2: Create `src/ai/embeddings/localProvider.ts` (AC: #1, #7)
  - Wraps existing `generateEmbeddings()` from coordinator
  - `isAvailable()` checks Cache API for model files, web worker support

- [x] Task 3: Create `src/ai/embeddings/openaiProvider.ts` (AC: #2, #4, #5, #6)
  - Calls `https://api.openai.com/v1/embeddings` with `text-embedding-3-small` + `dimensions: 384`
  - Validates response dimensions (throws if != 384)
  - Handles 401/403 -> InvalidApiKeyError
  - Handles 429 -> exponential backoff (max 3 retries)
  - Handles network errors -> EmbeddingNetworkError
  - Typed errors carry `provider` and `code` fields

- [x] Task 4: Modify `src/ai/embeddingPipeline.ts` (AC: #1, #2, #3, #8)
  - Inline try-local-then-openai fallback logic
  - Per-request fallback (not sticky)
  - Actionable telemetry: `{ provider, error, reason/code }`
  - Debounced error surface (once per session per error type)

- [x] Task 5: Modify `src/ai/workers/coordinator.ts` (AC: #7)
  - Add Cache API self-check: on worker crash, probe `caches.has('transformers-cache')`
  - Surface `cacheUnavailable` flag via `worker-crash` CustomEvent detail

- [x] Task 6: Modify `src/ai/workers/embedding.worker.ts` (AC: #8)
  - try/catch around ONNX backend init (`env.backends.onnx.wasm.numThreads`)
  - On failure, throw with `{ reason: 'onnx-backend-failed' }`

- [x] Task 7: Create `src/ai/embeddings/__tests__/openaiProvider.test.ts` (AC: #2, #4, #5, #6)

- [x] Task 8: Create `src/ai/embeddings/__tests__/localProvider.test.ts` (AC: #1, #7)

- [x] Task 9: Create `src/ai/__tests__/embeddingPipeline.fallback.test.ts` (AC: #1, #2, #3, #8)

## Dev Notes

### Existing Infrastructure (DO NOT recreate)

- `generateEmbeddings()` at `src/ai/workers/coordinator.ts:488` — public API for local embedding
- `getDecryptedApiKeyForProvider('openai')` at `src/lib/aiConfiguration.ts:714` — decrypts OpenAI API key
- `supportsWorkers()` at `src/ai/lib/workerCapabilities.ts` — detects Web Worker availability
- Transformers.js Cache API usage with cache name `transformers-cache`
- E68-S01: `progress_callback`, `CustomEvent('model-download-progress')` routing

### Critical Implementation Details

- **EmbeddingProvider interface** is ONLY used at the pipeline seam. No factory, no registry. Two providers instantiated explicitly.
- **OpenAI key source**: `getDecryptedApiKeyForProvider('openai')` from `aiConfiguration.ts`. Provider's `isAvailable()` returns `!!key`.
- **Fallback is per-request**, not sticky. Rationale: user may configure OpenAI key after a previous failure; on-device may recover on next session.
- **Errors surface with provider field** so telemetry shows `{ provider: 'openai', code: 'invalid_api_key' }`.

### File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/ai/embeddings/EmbeddingProvider.ts` | CREATE | Minimal interface |
| `src/ai/embeddings/localProvider.ts` | CREATE | Wraps coordinator generateEmbeddings() |
| `src/ai/embeddings/openaiProvider.ts` | CREATE | OpenAI API client with typed errors |
| `src/ai/embeddingPipeline.ts` | MODIFY | Inline fallback logic |
| `src/ai/workers/coordinator.ts` | MODIFY | Cache API self-check on crash |
| `src/ai/workers/embedding.worker.ts` | MODIFY | ONNX backend init try/catch |

### Test Files

| File | Purpose |
|------|---------|
| `src/ai/embeddings/__tests__/openaiProvider.test.ts` | OpenAI provider: happy path, errors, dimension validation |
| `src/ai/embeddings/__tests__/localProvider.test.ts` | Local provider: Cache API checks, worker support |
| `src/ai/__tests__/embeddingPipeline.fallback.test.ts` | Fallback order, telemetry, graceful degradation |

## Implementation Plan

See [plan](../plans/plan-e68-s02-cache-api-validation-and-openai-fallback.md) for implementation approach.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
