# Test Coverage Review — E88-S03: Remote EPUB Streaming (2026-04-05)

## AC Coverage Matrix

| AC | Description | Test Coverage | Status |
|----|-------------|---------------|--------|
| AC1 | Remote EPUB fetched via BookContentService, auth headers, loading indicator | `routes remote source to fetch`, `includes Basic auth header`, BookReader loading message | COVERED |
| AC2 | Error on server unreachable, cached fallback offered | `throws RemoteEpubError with code "network"`, `reports hasCachedVersion=true when cache exists`, `reports hasCachedVersion=false` | COVERED |
| AC3 | Local data persistence (highlights, position survive offline) | Not directly tested (relies on pre-existing E84/E85 infrastructure using bookId) | PARTIAL |

## Test Quality Assessment

### Strengths

- **16 unit tests** covering all source type routing, auth header injection, all HTTP error codes (401, 403, 404, 500), network errors, timeout/abort errors, cache read/write, and LRU eviction
- **MockCache** class correctly simulates Cache API behavior including key normalization
- **Proper cleanup**: `beforeEach`/`afterEach` with `vi.useFakeTimers()`, `vi.restoreAllMocks()`, and cache storage clearing
- **Edge cases covered**: non-EPUB format rejection, auth omission when no credentials, cache miss returning null
- **LRU eviction test** verifies oldest entry is removed when exceeding max

### Gaps

**G1 — No E2E test spec** (MEDIUM)

No `tests/e2e/story-e88-s03.spec.ts` file exists. The remote EPUB flow requires a real browser environment to fully validate (Cache API, fetch interception). Unit tests mock everything. An E2E test with MSW or route interception would add confidence.

**G2 — AC3 (local persistence) not directly tested** (LOW)

The story assumes E84/E85 infrastructure stores data by `bookId`. This is verified by inspection but not by a dedicated test. Low risk since existing tests cover this pattern.

**G3 — `handleLoadCached` callback not tested** (MEDIUM)

The React component's cached fallback button handler (`handleLoadCached` in BookReader.tsx) has no test coverage. It has its own error handling path (cache read failure, null check). A unit or integration test for this callback would add confidence.

## Verdict

16/16 unit tests pass. AC coverage is strong for AC1 and AC2. AC3 is partially covered by architecture verification. Missing E2E spec is a gap but not a blocker given the strong unit test suite.
