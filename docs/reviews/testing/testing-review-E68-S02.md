# Testing Coverage Review: E68-S02 (Cache API Validation and OpenAI Fallback)

**Date**: 2026-06-22
**Branch**: `feature/e68-s02-cache-api-validation-and-openai-fallback`
**Reviewer**: Claude Code (testing-reviewer agent)

## Summary

- **4 test files, 54 tests, all passing**
- **8 acceptance criteria**: 7 fully covered, 1 partially covered (AC2 pipeline-level happy path)
- **Edge cases**: 15+ edge cases covered across provider, pipeline, and coordinator levels
- **Test quality**: Isolated, deterministic, uses proper mocking patterns
- **Coverage assessment**: ~94% -- above the 80% threshold. No blockers.

---

## AC Coverage Table

| AC | Description | Status | Tests | Verdict |
|----|------------|--------|-------|---------|
| **1** | Local available -> uses local, never calls OpenAI | **COVERED** | `pipeline.fallback:153` (local succeeds, OpenAI key not read, embedding saved); `localProvider:134,144` (delegates to coordinator) | Three tests at both pipeline and provider levels confirm local-only path. |
| **2** | Local unavailable + OpenAI key -> text-embedding-3-small, 384-dim | **PARTIAL** | `openaiProvider:60` (correct model, dimensions, auth headers); `pipeline.fallback:169,193` (key is read, fallback attempted) | Provider-level codec is verified (request body, 384-dim output). Pipeline tests confirm key is read and fallback is attempted, but OpenAI **fetch is always mocked to reject** in pipeline tests -- there is no pipeline-level test where OpenAI succeeds and the embedding is saved via fallback. |
| **3** | Local fails + no OpenAI key -> saved without embedding, warning logged | **COVERED** | `pipeline.fallback:208` (key is null, returns gracefully); `pipeline.fallback:222` (key decryption fails); `pipeline.fallback:235` (both providers fail, no throw); `pipeline.fallback:251` (warning logged with `provider: 'local'`) | Three graceful-degradation scenarios plus telemetry verification. |
| **4** | 401 -> InvalidApiKeyError | **COVERED** | `openaiProvider:168,185` (401 and 403 both throw InvalidApiKeyError) | Both 401 and 403 covered. Error carries `provider: 'openai'` and `code: 'invalid_api_key'`. |
| **5** | 429 -> exponential backoff, max 3, then throw | **COVERED** | `openaiProvider:198` (429 throws EmbeddingRateLimitError); `openaiProvider:217` (429x2 then success with fake timers); `openaiProvider:258` (all 4 attempts exhausted) | All sub-cases: rate-limit-throws, retry-then-succeeds, max-retries-exhausted. Fake timers properly advance through backoff delays. |
| **6** | Dimensions != 384 -> EmbeddingDimensionError, NOT written | **COVERED** | `openaiProvider:144` (512-dim response throws EmbeddingDimensionError); `pipeline.fallback:271` (pipeline catches and logs OpenAI errors with code) | Provider-level: explicit dimension mismatch test. Pipeline-level: all OpenAI errors are caught, logged, and saveEmbedding is not called. Verified indirectly by the "both providers fail" tests. |
| **7** | Worker crash -> probes caches.has(), cacheUnavailable flag in event detail | **COVERED** | `coordinator:247` (cache available, flag=false); `coordinator:327` (caches.has returns false, flag=true); `coordinator:392` (Cache API undefined, flag=true) | Three variants cover cache-available, cache-unavailable (false), and Cache-API-absent (undefined). Event detail includes `workerId`, `error`, `cacheUnavailable`, `provider`. |
| **8** | ONNX backend fails -> reason: 'onnx-backend-failed' | **COVERED** | `coordinator:449` (worker error response carries reason); `pipeline.fallback:193` (pipeline receives and logs reason); `pipeline.fallback:251` (telemetry includes `reason: 'onnx-backend-failed'`) | Both coordinator and pipeline levels verify the reason is preserved and surfaced in telemetry. |

---

## Detailed Findings

### Test Inventory

| File | Tests | Coverage Scope |
|------|-------|---------------|
| `src/ai/embeddings/__tests__/openaiProvider.test.ts` | **19** | OpenAPI provider: happy path, dimension validation, HTTP errors (401, 403, 429, 500, network), error properties |
| `src/ai/embeddings/__tests__/localProvider.test.ts` | **7** | Local provider: Cache API checks (5 variants), embed delegation (2 variants) |
| `src/ai/__tests__/embeddingPipeline.fallback.test.ts` | **11** | Pipeline fallback order: local succeeds, OpenAI fallback, graceful degradation, telemetry, consent gates |
| `src/ai/workers/__tests__/coordinator.test.ts` | **17** | Worker pool lifecycle + 4 new E68-S02 tests: AC7 (3 variants), AC8 (1 test) |
| **Total** | **54** | All passing |

### Gap: AC2 Pipeline-Level Happy Path

**What is missing**: There is no integration-level test in `embeddingPipeline.fallback.test.ts` that:
1. Mocks `generateEmbeddings` to reject (local fails)
2. Mocks `getDecryptedApiKeyForProvider` to return a key
3. Mocks `globalThis.fetch` to return a **successful** OpenAI response
4. Asserts that `vectorStorePersistence.saveEmbedding` is called with the 384-dim vector

The existing tests at lines 169 and 193 mock fetch to **reject** (via the default mock at line 137: `vi.fn().mockRejectedValue(new Error('Network not mocked'))`), so they only verify that the key is read and the fallback is *attempted*, not that it *succeeds*.

**Risk**: Low. The provider-level test (`openaiProvider.test.ts:60`) thoroughly validates that the OpenAI provider returns correct 384-dim vectors. A pipeline-level happy-path test would guard against a regression where the pipeline drops the result between `tryOpenAIFallback` returning and `saveEmbedding` being called.

**Recommendation**: Add one pipeline test with a successful OpenAI fetch mock:

```
it('saves embedding via OpenAI fallback when local fails', async () => {
  vi.mocked(generateEmbeddings).mockRejectedValue(
    Object.assign(new Error('ONNX init failed'), { reason: 'onnx-backend-failed' })
  )
  vi.mocked(getDecryptedApiKeyForProvider).mockResolvedValue('sk-test-key')
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      object: 'list',
      data: [{ object: 'embedding', index: 0, embedding: new Array(384).fill(0.1) }],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 4, total_tokens: 4 },
    }),
  })
  await pipeline.indexNote(makeNote())
  expect(vectorStorePersistence.saveEmbedding).toHaveBeenCalledWith(
    'note-1',
    expect.arrayContaining([expect.any(Number)])
  )
})
```

### Edge Cases Covered

| Edge Case | Test File | Line |
|-----------|-----------|------|
| OpenAI key is empty string | `openaiProvider.test.ts` | 48 |
| OpenAI key is only whitespace | `openaiProvider.test.ts` | 53 |
| Empty/whitespace texts filtered before API call | `openaiProvider.test.ts` | 118, 136 |
| All texts empty -> returns empty, never calls API | `openaiProvider.test.ts` | 136 |
| Multiple embeddings returned | `openaiProvider.test.ts` | 98 |
| Network timeout (DOMException AbortError) | `openaiProvider.test.ts` | 284 |
| 500 Internal Server Error | `openaiProvider.test.ts` | 290 |
| Retry after 429, then success | `openaiProvider.test.ts` | 217 |
| Max retries exhausted | `openaiProvider.test.ts` | 258 |
| Cache API unavailable (undefined) | `localProvider.test.ts` | 58 |
| Cache partial (some model files missing) | `localProvider.test.ts` | 91 |
| Cache API throws | `localProvider.test.ts` | 116 |
| Workers not supported | `localProvider.test.ts` | 51 |
| Key decryption fails (rejected Promise) | `pipeline.fallback.test.ts` | 222 |
| Both providers fail | `pipeline.fallback.test.ts` | 235 |
| User not logged in (skip) | `pipeline.fallback.test.ts` | 296 |
| ai_embeddings consent not granted | `pipeline.fallback.test.ts` | 316 |
| Provider consent not granted | `pipeline.fallback.test.ts` | 326 |
| Cache API undefined at crash time | `coordinator.test.ts` | 392 |
| caches.has returns false | `coordinator.test.ts` | 327 |
| Error properties carry provider + code | `openaiProvider.test.ts` | 306, 314, 321 |

### Quality Assessment

**Mocking**: 
- `openaiProvider.test.ts` mocks `global.fetch` at module scope with `vi.fn()` -- clean pattern.
- `localProvider.test.ts` uses `Object.defineProperty` on `globalThis.caches` with proper `afterEach` restoration -- avoids cross-test leakage.
- `pipeline.fallback.test.ts` saves and restores `globalThis.caches`, `globalThis.Worker`, and `globalThis.fetch` in `beforeEach`/`afterEach` -- thorough isolation.
- `coordinator.test.ts` uses inline mock `Worker` subclasses for each scenario -- avoids complex setup at the cost of some boilerplate repetition.

**Determinism**: No `Date.now()` or `new Date()` calls in tests. Time-dependent behavior (429 backoff, idle termination, timeouts) uses `vi.useFakeTimers()` with `vi.advanceTimersByTimeAsync()`. Clean.

**Isolation**: Each test file uses `vi.clearAllMocks()` in `beforeEach`. The pipeline test also calls `vi.resetModules()` and re-imports the Dexie schema for clean IndexedDB state. No shared mutable state between tests.

**Assertions**: Tests use specific assertions (`toHaveBeenCalledWith` with expected arguments) rather than vague `toHaveBeenCalled()`. One exception: `coordinator.test.ts` line 160 uses `vi.useRealTimers()` within a test body (in a `it` block) instead of in `afterEach` -- this is acceptable for the specific test pattern but deviates from the general cleanup pattern.

## Verdict

**Coverage: ~94% (7.5/8 ACs). No blockers.**

All acceptance criteria are addressed. The only notable gap is the pipeline-level happy path for AC2 (local fails, OpenAI succeeds, embedding saved), which is a medium-priority addition. All error states (401, 429, 503, network, dimension mismatch, worker crash, ONNX failure, Cache API absence, missing key, decryption failure, missing consent, missing auth) have corresponding tests.

Contributing 4 new E68-S02 tests to `coordinator.test.ts` (AC7: 3 variants, AC8: 1 test) alongside the existing AC2/AC4/AC5 worker tests from prior stories.
