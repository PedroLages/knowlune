## Test Coverage Review: E68-S02 — Cache API Validation and OpenAI Fallback

### AC Coverage Summary

**Acceptance Criteria Coverage:** 6/8 ACs tested (**75%**)

**COVERAGE GATE: BLOCKER (<80%)** — Must add tests for AC7 and AC8 to reach 80% minimum.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Local available -> uses local, never calls OpenAI | `src/ai/__tests__/embeddingPipeline.fallback.test.ts:134` | None | Partial |
| 2 | Local unavailable + OpenAI key -> fallback to text-embedding-3-small, 384-dim | `src/ai/embeddings/__tests__/openaiProvider.test.ts:55`, `src/ai/__tests__/embeddingPipeline.fallback.test.ts:164` | None | Partial |
| 3 | Local fails + no OpenAI key -> note saved without embedding, warning logged | `src/ai/__tests__/embeddingPipeline.fallback.test.ts:177`, `:189`, `:213` | None | Partial |
| 4 | 401 -> InvalidApiKeyError | `src/ai/embeddings/__tests__/openaiProvider.test.ts:165` | None | Partial |
| 5 | 429 -> exponential backoff (max 3), then throw | `src/ai/embeddings/__tests__/openaiProvider.test.ts:187`, `:204`, `:236` | None | Covered |
| 6 | Dimensions != 384 -> EmbeddingDimensionError, vectors NOT written to store | `src/ai/embeddings/__tests__/openaiProvider.test.ts:141` | None | Partial |
| 7 | Worker crash -> probes caches.has(), surfaces cacheUnavailable flag | None | None | Gap |
| 8 | ONNX backend fails -> reports reason: 'onnx-backend-failed' | None | None | Gap |

**Coverage**: 1/8 ACs fully covered | 5 partial | 2 gaps

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC7: "Worker crash -> probes caches.has(), surfaces cacheUnavailable flag" has no test. The coordinator's `handleWorkerError()` at `src/ai/workers/coordinator.ts:348` probes `caches.has('transformers-cache')` and dispatches a `worker-crash` CustomEvent with a `cacheUnavailable` detail flag. Neither behavior is tested. The existing `coordinator.test.ts:204` test ("rejects pending requests when worker crashes") does not assert on the Cache API probe or the custom event payload.
  - **Suggested test**: Add `it('probes caches.has on worker crash and surfaces cacheUnavailable flag')` in `src/ai/workers/__tests__/coordinator.test.ts` that: (1) mocks `caches.has` with a spy, (2) dispatches a worker error event, (3) asserts `caches.has('transformers-cache')` was called, (4) asserts a `worker-crash` CustomEvent was dispatched with `detail.cacheUnavailable === false` (or matches the mock).

- **(confidence: 90)** AC8: "ONNX backend fails -> reports reason: 'onnx-backend-failed'" has no test. The embedding worker at `src/ai/workers/embedding.worker.ts:162-168` wraps `env.backends.onnx.wasm.numThreads = 1` in a try/catch and throws with `{ reason: 'onnx-backend-failed' }`. There is no test file for the embedding worker (only `search.worker.test.ts` exists).
  - **Suggested test**: Create `src/ai/workers/__tests__/embedding.worker.test.ts` with a test that stubs `env.backends.onnx.wasm.numThreads` to throw and asserts the error carries `reason: 'onnx-backend-failed'`. Alternatively, if the worker's module-level side effects make this impractical, add a pipeline-level test that verifies when `generateEmbeddings` rejects with an error carrying `reason: 'onnx-backend-failed'`, the pipeline surfaces that reason in its telemetry payload (already partially covered by `embeddingPipeline.fallback.test.ts:164` but only tests the mock path, not the actual worker code).

#### High Priority

- **`src/ai/__tests__/embeddingPipeline.fallback.test.ts:134` (confidence: 85)**: Test title says "calls local provider and saves embedding, does not call OpenAI" but the assertion only verifies `generateEmbeddings` was called once. There is no assertion that `getDecryptedApiKeyForProvider` was NOT called or that the OpenAI provider was never invoked. The test comment (line 142-145) acknowledges the ambiguity. **Fix**: Add `expect(getDecryptedApiKeyForProvider).not.toHaveBeenCalled()` (after confirming getAIConfiguration does not call it) to explicitly assert the OpenAI path was never entered.

- **`src/ai/__tests__/embeddingPipeline.fallback.test.ts:164` (confidence: 80)**: The test "calls OpenAI when local provider throws onnx-backend-failed" does not mock `global.fetch`. When `tryOpenAIFallback` instantiates a real `OpenAIEmbeddingProvider` and calls `embed()`, it makes a real `fetch()` call to `https://api.openai.com/v1/embeddings`. In the test environment this either fails (network error, caught by pipeline) or makes a real API call (if network is available). The test passes because `indexNote()` catches all errors, not because the fallback actually succeeds. **Fix**: Mock `global.fetch` in the pipeline test to return a 200 response with 384-dim vectors for these tests, and assert that `fetch` was called with the correct request body and that `vectorStorePersistence.saveEmbedding` was called with the result.

- **No assertion on vector store persistence (confidence: 85)**: Across all 34 tests in the three files, there is zero assertion that `vectorStorePersistence.saveEmbedding()` was called or NOT called. The pipeline's core job is to save embeddings to the store (AC1, AC2) or skip saving (AC3, AC6). Without these assertions, the tests verify orchestration (which providers were called) but not the actual persistence outcome. **Fix**: Add assertions for each scenario: `expect(vectorStorePersistence.saveEmbedding).toHaveBeenCalledWith('note-1', expect.any(Array))` when embedding succeeds, and `.not.toHaveBeenCalled()` when it fails or gracefully degrades.

- **No test for OpenAI error logging (AC4, clause 2) (confidence: 75)**: AC4 states "the error is logged with provider: 'openai' and code: 'invalid_api_key'". The throw behavior is tested at the provider level (openaiProvider.test.ts:165), but the pipeline's logging of this error is untested. The pipeline's `tryOpenAIFallback` (embeddingPipeline.ts:187-208) catches `EmbeddingProviderError` and logs `{ provider: 'openai', code }`. No test verifies this logging. **Fix**: Add a test in `embeddingPipeline.fallback.test.ts` that mocks `fetch` to return 401, local fails, and asserts `console.warn` was called with `{ provider: 'openai', code: 'invalid_api_key' }`.

#### Medium

- **`src/ai/embeddings/__tests__/openaiProvider.test.ts:204` (confidence: 75)**: The exponential backoff test uses real `await` delays (1s + 2s = ~3 seconds). This is the slowest test in the suite. **Fix**: Use `vi.useFakeTimers()` with `vi.advanceTimersByTimeAsync()` to verify the backoff schedule without real waits. The `sleep()` function in the provider uses `setTimeout`, which Vitest's fake timers can control.

- **`src/ai/__tests__/embeddingPipeline.fallback.test.ts` — consent-not-granted path untested (confidence: 80)**: The `isGranted` mock always returns `true` (line 18 of the test file). The `isGrantedForProvider` mock also always returns `true` (line 19). Neither the "ai_embeddings consent not granted" nor the "provider consent not granted" paths are tested. The pipeline code at lines 69-88 has two early-return paths gated on consent that are completely uncovered. **Fix**: Add tests that override the consent mocks to return `false` and assert that neither provider is called and a console.info message is logged with the skip reason.

- **`src/ai/embeddings/__tests__/openaiProvider.test.ts:17` (confidence: 65)**: `global.fetch = mockFetch` is set at module level and never restored. While Vitest provides per-file isolation, this could leak if test files share a worker thread. **Fix**: Use `beforeEach`/`afterEach` to set/restore `global.fetch` for defense-in-depth, consistent with the pattern used in `localProvider.test.ts` for `caches`.

#### Nits

- **Nit** `src/ai/__tests__/embeddingPipeline.fallback.test.ts:236` (confidence: 60): Test accesses mock internals via dynamic `await import('@/stores/useAuthStore')` in the test body and casts to `unknown as { ... __setAuthUser }`. This is fragile — if the mock module format changes, this type cast breaks silently. Consider exporting a test helper from the mock module instead.

- **Nit** `src/ai/__tests__/embeddingPipeline.fallback.test.ts:134` (confidence: 50): The test comment at line 142 says "we focus on generateEmbeddings being the sole embedding attempt" — this is an acknowledged gap in the test itself. The comment should either be removed once the `expect(getDecryptedApiKeyForProvider).not.toHaveBeenCalled()` assertion is added, or kept as a TODO reference to this review.

### Edge Cases to Consider

| Scenario | Tested? | Where |
|----------|---------|-------|
| Empty texts array -> [] | Yes | openaiProvider.test.ts:133 |
| All-whitespace texts filtered | Yes | openaiProvider.test.ts:113 |
| Multiple texts (2+) | Yes | openaiProvider.test.ts:93, localProvider.test.ts:144 |
| Cache API unavailable (undefined) | Yes | localProvider.test.ts:58 |
| Partial cache (some files missing) | Yes | localProvider.test.ts:91 |
| Cache API throws (quota exceeded) | Yes | localProvider.test.ts:116 |
| Workers unsupported | Yes | localProvider.test.ts:51 |
| 401 -> InvalidApiKeyError | Yes | openaiProvider.test.ts:165 |
| 403 -> InvalidApiKeyError | Yes | openaiProvider.test.ts:176 |
| 429 -> retry & succeed (2 retries) | Yes | openaiProvider.test.ts:204 |
| 429 -> max retries exhausted | Yes | openaiProvider.test.ts:236 |
| 500 -> EmbeddingProviderError | Yes | openaiProvider.test.ts:266 |
| Network failure -> EmbeddingNetworkError | Yes | openaiProvider.test.ts:254 |
| Fetch timeout (AbortError) | Yes | openaiProvider.test.ts:260 |
| Dimension != 384 -> EmbeddingDimensionError | Yes | openaiProvider.test.ts:141 |
| User not logged in -> skip | Yes | embeddingPipeline.fallback.test.ts:234 |
| Local unavailable -> skip | Yes | embeddingPipeline.fallback.test.ts:177 |
| No OpenAI key -> graceful degradation | Yes | embeddingPipeline.fallback.test.ts:177 |
| OpenAI key decryption fails | Yes | embeddingPipeline.fallback.test.ts:189 |
| Both providers fail -> no throw | Yes | embeddingPipeline.fallback.test.ts:200 |
| Telemetry on local failure | Yes | embeddingPipeline.fallback.test.ts:213 |
| **Ai_embeddings consent NOT granted** | **No** | Pipeline lines 69-72 — `isGranted` returns false, but mock always returns true |
| **Provider consent NOT granted** | **No** | Pipeline lines 74-83 — `isGrantedForProvider` returns false, but mock always returns true |
| **Worker crash -> caches.has probe** | **No** | Coordinator lines 364-367 — untested |
| **Worker crash -> cacheUnavailable flag** | **No** | Coordinator lines 377-388 — untested |
| **ONNX backend init failure in actual worker** | **No** | Worker lines 162-168 — untested |
| **stripHtml on empty content -> early return** | **No** | Pipeline line 57 — minor but uncovered |
| **Vector store save/not-save assertions** | **No** | No test asserts saveEmbedding was called or not called |

### Summary

**ACs**: 6 covered / 8 total | **Findings**: 11 | **Blockers**: 2 | **High**: 4 | **Medium**: 3 | **Nits**: 2

### Route to BLOCKER Resolution

1. **Add AC7 test**: Extend `src/ai/workers/__tests__/coordinator.test.ts` with a test that asserts `caches.has('transformers-cache')` is probed and `worker-crash` event carries `cacheUnavailable` detail on worker crash.
2. **Add AC8 test**: Create `src/ai/workers/__tests__/embedding.worker.test.ts` testing ONNX backend init failure surfaces `reason: 'onnx-backend-failed'`, OR add pipeline test that exercises the reason through the mock boundary.
3. **Fix AC1 assertion gap**: Add explicit `expect(getDecryptedApiKeyForProvider).not.toHaveBeenCalled()` in the local-success test.
4. **Mock fetch in pipeline fallback tests** so the OpenAI call path is actually exercised and verified end-to-end.
5. **Add saveEmbedding assertions** across all pipeline tests to verify the persistence outcome matches the AC.
