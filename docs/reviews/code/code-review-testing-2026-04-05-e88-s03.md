# Test Coverage Review — E88-S03: Remote EPUB Streaming (2026-04-05, Round 2)

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

**G1 — No test for URL validation (Fix 4)** — MEDIUM

The URL validation code path at BookContentService.ts:87-93 (rejects non-http/https URLs) has no test coverage. Should test with `javascript:alert(1)`, `file:///etc/passwd`, empty string, and `ftp://` URLs.

**G2 — No test for non-ASCII credentials (Fix 1)** — LOW

The UTF-8 TextEncoder path at BookContentService.ts:105-107 has no test with non-ASCII characters. The test at line 126-139 uses ASCII-only credentials.

**G3 — No test for HTTP insecure warning (Fix 2)** — LOW

The console.warn for HTTP URLs with credentials at BookContentService.ts:98-103 has no test verifying the warning fires.

**G4 — No E2E test spec** (LOW — pre-existing, noted in Round 1)

No `tests/e2e/story-e88-s03.spec.ts`. Remote EPUB flow requires mock OPDS server. Documented as intentionally skipped.

**G5 — `handleLoadCached` callback not tested** (LOW — pre-existing, noted in Round 1)

BookReader.tsx cached fallback handler has no integration test. Acceptable given unit test coverage of the underlying service method.

### Test Isolation

- Proper `beforeEach`/`afterEach` cleanup
- Fake timers correctly used
- No cross-test state leakage

## Verdict

16/16 unit tests pass. AC coverage strong for AC1/AC2, partial for AC3. 1 MEDIUM gap (URL validation test missing), 4 LOW gaps. No blockers.
