# Implementation Plan: E68-S02 — Cache API Validation & OpenAI Fallback

## Context

The on-device embedding model (Transformers.js) can fail for several reasons: Cache API
unavailable (private browsing), ONNX backend initialization failure (low memory, browser
incompatibility), or corrupted model files. When the local model fails, users with an
OpenAI API key should have a seamless fallback. This story adds a minimal
`EmbeddingProvider` seam, a local provider wrapping existing infrastructure, an OpenAI
provider, and inline fallback logic in the pipeline.

## Implementation Steps

### Step 1: Create `src/ai/embeddings/EmbeddingProvider.ts`
- Minimal interface with `embed(texts)`, `isAvailable()`, `name`
- No factory, no registry — two providers instantiated explicitly at the pipeline seam

### Step 2: Create `src/ai/embeddings/localProvider.ts`
- Wraps existing `generateEmbeddings()` from coordinator.ts
- `isAvailable()` checks: web workers support, Cache API availability, model files present
- Cache API check: opens `transformers-cache`, verifies 3 critical model files

### Step 3: Create `src/ai/embeddings/openaiProvider.ts`
- Calls `https://api.openai.com/v1/embeddings` with `text-embedding-3-small` + `dimensions: 384`
- Validates response: each embedding must be exactly 384 dimensions
- Error handling:
  - 401/403 → `InvalidApiKeyError`
  - 429 → exponential backoff (max 3 retries), then `EmbeddingRateLimitError`
  - Network errors → `EmbeddingNetworkError`
  - Dimension mismatch → `EmbeddingDimensionError`
- All errors carry `provider` and `code` for actionable telemetry

### Step 4: Modify `src/ai/embeddingPipeline.ts`
- Inline fallback logic: try local → try OpenAI → log telemetry
- Per-request fallback (not sticky)
- Debounced error surfacing (once per error type per session)
- Preserves existing consent gates (E119-S08, E119-S09)

### Step 5: Modify `src/ai/workers/coordinator.ts`
- `handleWorkerError()` now async — probes `caches.has('transformers-cache')` on crash
- Surface `cacheUnavailable` flag via `worker-crash` CustomEvent detail
- Add `requestId` telemetry to crash detail

### Step 6: Modify `src/ai/workers/embedding.worker.ts`
- try/catch around `env.backends.onnx.wasm.numThreads` assignment
- try/catch around pipeline initialization with reason detection
- Throw with `{ reason: 'onnx-backend-failed' | 'cache-unavailable' | 'model-load-failed' }`

### Step 7-9: Test files
- `src/ai/embeddings/__tests__/openaiProvider.test.ts` — 19 tests covering happy path, errors, retries
- `src/ai/embeddings/__tests__/localProvider.test.ts` — 7 tests covering Cache API checks, availability
- `src/ai/__tests__/embeddingPipeline.fallback.test.ts` — 8 tests covering fallback order, telemetry, consent

## Files Changed

| File | Action |
|------|--------|
| `src/ai/embeddings/EmbeddingProvider.ts` | CREATE |
| `src/ai/embeddings/localProvider.ts` | CREATE |
| `src/ai/embeddings/openaiProvider.ts` | CREATE |
| `src/ai/embeddingPipeline.ts` | MODIFY |
| `src/ai/workers/coordinator.ts` | MODIFY |
| `src/ai/workers/embedding.worker.ts` | MODIFY |
| `src/ai/embeddings/__tests__/openaiProvider.test.ts` | CREATE |
| `src/ai/embeddings/__tests__/localProvider.test.ts` | CREATE |
| `src/ai/__tests__/embeddingPipeline.fallback.test.ts` | CREATE |
| `docs/implementation-artifacts/stories/E68-S02-cache-api-validation-and-openai-fallback.md` | CREATE |
| `docs/implementation-artifacts/sprint-status.yaml` | MODIFY |

## Verification

- `npm run build` — production build succeeds
- `npx vitest run src/ai/` — all 583 AI tests pass
- Coverage: 34 new tests across 3 test files

## Risk Assessment

- **Low risk**: All changes are additive or wrap existing infrastructure
- **OpenAI API key access**: Uses existing `getDecryptedApiKeyForProvider()` pattern
- **No new dependencies**: Uses native `fetch()` for OpenAI API calls
