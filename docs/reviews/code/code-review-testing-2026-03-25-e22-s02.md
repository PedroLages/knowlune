# Test Coverage Review: E22-S02 Model Auto-Discovery

**Date:** 2026-03-25
**Story:** E22-S02 — Model Auto-Discovery
**Reviewer:** Claude Opus 4.6 (automated)

## Test Files

- `src/ai/llm/__tests__/ollama-client-models.test.ts` — 8 tests for `fetchModels()`
- `src/lib/__tests__/aiConfiguration-ollama.test.ts` — 7 tests for `formatModelSize()`, `getOllamaSelectedModel()`, persistence

## Acceptance Criteria Coverage

| AC | Description | Unit Tests | E2E Tests |
|----|-------------|-----------|-----------|
| AC1 | GET /api/tags populates model dropdown | `fetches models via proxy by default` | None |
| AC2 | Each model shows name and size | `models[0].size === '2.0 GB'`, `formatModelSize` suite | None |
| AC3 | Selected model persisted in localStorage | `OllamaSettings persistence` suite (3 tests) | None |
| AC4 | Error message on unreachable server | `throws helpful error`, `throws timeout error`, `throws LLMError on HTTP error` | None |
| AC5 | Model list refreshes on URL change | Covered via `lastFetchedUrl` ref logic (tested indirectly) | None |

## Test Quality Assessment

### Strengths

1. **Good error path coverage** — Tests cover HTTP errors, network failures, and timeouts (AC4)
2. **Edge cases covered** — Empty model list, missing models field, trailing slashes in URL
3. **Both connection modes tested** — Proxy (default) and direct connection fetch paths
4. **Instance-to-static delegation verified** — `listModels()` delegates to `fetchModels()`
5. **Size formatting thoroughly tested** — Bytes, KB, MB, GB with decimal precision

### Gaps

1. **No E2E test for this story** — The model picker UI integration (auto-fetch on connect, model selection, error display) is only tested at unit level. Consider adding an E2E test that mocks the `/api/ai/ollama/tags` endpoint and verifies the picker workflow.

2. **No test for AC5 URL change trigger** — The `useEffect` that triggers re-fetch when `serverUrl` changes is not directly tested. The `lastFetchedUrl.current` guard logic should be verified.

3. **No test for auto-select first model** — `OllamaModelPicker.tsx:72-74` auto-selects the first model when none is selected, but this behavior is not unit tested.

## Unit Test Results

- **147 test files, 2403 tests** — All passing
- **0 failures, 0 skipped**

## Verdict

Unit test coverage is solid for the core logic (API parsing, error handling, persistence). The main gap is missing E2E coverage for the UI integration workflow. This is acceptable for a settings-page feature where the Ollama server dependency makes E2E testing complex, but should be considered for future stories.
