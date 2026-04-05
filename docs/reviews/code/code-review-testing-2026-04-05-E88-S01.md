## Test Coverage Review -- E88-S01 OPDS Catalog Connection (2026-04-05)

### Acceptance Criteria Coverage

| AC | Description | Unit Tests | E2E Tests | Coverage |
|----|-------------|-----------|-----------|----------|
| AC1 | Validate OPDS catalog URL via DOMParser | OpdsService.test.ts: 6 tests (valid feed, empty feed, HTML rejected, invalid XML, CORS error, timeout) | None | GOOD |
| AC2 | Save catalog with name and optional auth | OpdsService.test.ts: auth header tests (2 tests) + Store CRUD via Dexie | None | ADEQUATE |
| AC3 | Error messages for invalid/unreachable | OpdsService.test.ts: 401, 403, 500, CORS, timeout, invalid XML (6 tests) | None | GOOD |
| AC4 | Manage multiple OPDS connections | Store has add/update/remove methods (tested indirectly via schema tests) | None | PARTIAL |

### Test Quality Assessment

**OpdsService.test.ts (11 tests) -- GOOD**
- Tests use `vi.stubGlobal('fetch', ...)` to mock fetch responses -- clean isolation
- All error paths tested: network error, CORS, timeout, 401, 403, 500, invalid XML, HTML
- Tests verify discriminated union contract (checks both `ok` and the specific error/meta)
- Auth header encoding verified with `btoa()` assertion
- Uses `vi.useFakeTimers()` and `vi.useRealTimers()` properly

**schema-checkpoint.test.ts (4 tests) -- GOOD**
- Validates checkpoint version matches expected (39)
- Validates table list includes `opdsCatalogs`
- Cross-checks migration-created schema vs checkpoint-created schema
- Good regression guard for schema drift

### Gaps Identified

#### MEDIUM -- No E2E test for OPDS catalog workflow (confidence: 85)
No `tests/e2e/story-e88-s01.spec.ts` exists. While the service is well unit-tested, the full user flow (open dialog, fill form, test connection, save, edit, delete) has no automated E2E coverage. The dialog interactions were verified manually via Playwright MCP during design review, but this leaves a regression risk.

#### MEDIUM -- No unit tests for useOpdsCatalogStore (confidence: 80)
The Zustand store has 5 methods (loadCatalogs, addCatalog, updateCatalog, removeCatalog, getCatalogById) with Dexie persistence, but no dedicated unit test file. The store methods are indirectly tested through the schema checkpoint test confirming the table exists, but CRUD operations, error handling (toast.error calls), and the isLoaded guard are untested.

#### LOW -- No test for URL input validation (confidence: 70)
The service accepts any string URL. There is no test verifying behavior with malformed URLs (e.g., empty string, relative paths, non-HTTP protocols). The fetch API would throw/reject for these, but explicit tests would document the expected behavior.

### Verdict: ADEQUATE
Unit test coverage for the service layer is strong (11 tests covering all error paths and the happy path). The main gaps are E2E tests for the dialog workflow and unit tests for the Zustand store CRUD operations. These are acceptable for a first story in the epic -- recommend adding E2E coverage when the catalog browsing feature lands (E88-S02).
