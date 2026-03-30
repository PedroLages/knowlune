## Test Coverage Review: E69-S01 — Storage Estimation Service and Overview Card

### AC Coverage Summary

**Acceptance Criteria Coverage:** 2/7 ACs tested (**29%**)

**COVERAGE GATE: BLOCKER (<80%)**

The fix commit added meaningful service-layer unit tests (12 tests across `estimateTableSize` and `getStorageOverview`), but zero component-level tests were added for `StorageManagement.tsx`. Five of the seven ACs are exclusively about component behavior — loading states, warning banners, dismiss interaction, refresh button, API-unavailable fallback, and empty state rendering — and none of those have any test coverage.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Stacked bar chart with 6 category segments, summary line, legend grid | `storageEstimate.test.ts:125-246` (service layer only) | None | Partial |
| 2 | Skeleton placeholders during load, `aria-busy="true"` | None | None | Gap |
| 3 | Amber warning banner (80-94%), dismiss stores in sessionStorage | None | None | Gap |
| 4 | Red critical banner (95%+), `aria-live="assertive"`, "Free Up Space" scroll | None | None | Gap |
| 5 | Refresh button shows spinner, re-fetches estimates | None | None | Gap |
| 6 | Graceful fallback when Storage API unavailable | `storageEstimate.test.ts:147-159` (service layer returns `apiAvailable: false`) | None | Partial |
| 7 | Empty state message when all Dexie tables are empty | `storageEstimate.test.ts:187-203` (service returns zero categories) | None | Partial |

**Coverage**: 0 ACs fully covered | 5 gaps | 2 partial (service only, no rendering test)

Note: AC1 is counted Partial because the service layer tests confirm the data shape (6 categories, correct labels, categorized totals) but no test verifies the chart, summary line, or legend actually render in the DOM. ACs 6 and 7 are Partial for the same reason — the service correctly signals `apiAvailable: false` and zero-byte categories, but no test confirms the component renders the correct UI branches.

---

### Test Quality Findings

#### Blockers (untested ACs — confidence >= 90)

- **(confidence: 98)** AC 2: Loading state (`aria-busy="true"`, skeleton placeholders) has zero test coverage. The component branches to the skeleton render when `loading === true` (line 332-346 of `StorageManagement.tsx`). Suggested test: `StorageManagement.test.tsx` in `src/app/components/settings/__tests__/` — render the component with `getStorageOverview` mocked to a never-resolving promise, assert `aria-busy="true"` is present on the `CardContent`, assert three `Skeleton` elements are in the DOM.

- **(confidence: 98)** AC 3: Warning banner (80-94% usage) has zero test coverage. `QuotaWarningBanner` with `usagePercent = 0.85` should render an element with `role="alert"` and `aria-live="polite"`. Dismiss interaction (click Dismiss → `sessionStorage.getItem('storage-warning-dismissed') === 'true'` → banner gone on re-render) is entirely untested. Suggested test: `StorageManagement.test.tsx` — mock `getStorageOverview` to return `usagePercent: 0.85` with `categorizedTotal > 0`, assert `role="alert"` element is visible, click the Dismiss button, assert the banner is removed from the DOM, assert `sessionStorage` was written.

- **(confidence: 98)** AC 4: Critical banner (>= 95% usage, `aria-live="assertive"`) has zero test coverage. The `QuotaWarningBanner` critical branch and the "Free Up Space" scroll behavior are untested. Suggested test: `StorageManagement.test.tsx` — mock `getStorageOverview` to return `usagePercent: 0.95`, assert `role="alert"` with `aria-live="assertive"`, assert "Free Up Space" button is present (critical banner is not dismissible — no Dismiss button should appear).

- **(confidence: 97)** AC 5: Refresh button behavior has zero test coverage. The spinner (`Loader2` during `refreshing === true`) and re-fetch trigger are untested. Suggested test: `StorageManagement.test.tsx` — render loaded state, click "Refresh" button (aria-label: "Refresh storage estimates"), assert `getStorageOverview` is called a second time, assert the button is disabled during the async operation.

- **(confidence: 96)** AC 6: API-unavailable fallback renders the correct text ("Storage estimation is not available in this browser") — zero component rendering test. Service test at line 147 confirms `apiAvailable: false` is returned; the component branch at line 365-376 of `StorageManagement.tsx` is untested. Suggested test: `StorageManagement.test.tsx` — mock `getStorageOverview` to return `{ apiAvailable: false, ... }`, assert the fallback message text is visible, assert no bar chart or legend is rendered.

- **(confidence: 96)** AC 7: Empty state text ("No learning data stored yet. Import a course to get started!") is untested at the component level. Service test at line 187 confirms zero-byte categories are returned; the empty-state JSX branch at line 382-404 of `StorageManagement.tsx` is untested. Suggested test: `StorageManagement.test.tsx` — mock `getStorageOverview` to return `{ categorizedTotal: 0, categories: [...all zeros] }`, assert the empty state message is visible, assert the "Browse Courses" link is rendered.

#### High Priority

- **`src/lib/__tests__/storageEstimate.test.ts:1-308` (confidence: 85)**: `formatFileSize` (the byte-formatting function used throughout the component's summary line and legend cells) is tested in `src/lib/__tests__/format.test.ts:242-270` as a pre-existing utility. However, `storageEstimate.ts` originally defined its own `formatBytes()` per the story spec (Tasks 1.2 and 9.1), and the implementation instead delegates to `formatFileSize` from `src/lib/format.ts`. The unit tests in `storageEstimate.test.ts` contain no tests for any formatting function. If the import in `StorageManagement.tsx` is changed or `formatFileSize` is refactored, the E69-S01 story has no formatting-specific regression coverage. The existing `format.test.ts` coverage is sufficient for the utility itself, but the gap means AC1's "formatted size" requirement is only incidentally covered. This is an acceptable risk given `format.test.ts` has 7 focused tests (including 0 bytes, KB, MB, GB, negative input), but reviewers should be aware there is no test asserting the component renders "~500 MB of ~2 GB (25%)".

- **`src/app/components/settings/StorageManagement.tsx:350-361` (confidence: 80)**: The error state branch (`error && !overview`) renders "Unable to estimate storage. Try refreshing." but has no test. This is the state reached when `getStorageOverview()` throws (not when `apiAvailable` is false). The code review feedback already flagged this as a HIGH issue. A test should mock `getStorageOverview` to `mockRejectedValue(new Error('IDB error'))` and assert the error message is visible and the Refresh button is rendered.

- **`src/app/components/settings/StorageManagement.tsx:382-404` (confidence: 78)**: The empty state with a high `usagePercent` (>= 0.8) is a reachable and important edge case: `categorizedTotal === 0` with `usagePercent >= 0.8` should show BOTH the warning banner and the empty state message simultaneously. The component handles this at lines 386-390 via a conditional `QuotaWarningBanner` render inside the empty state branch. This compound state is completely untested and was previously flagged as a BLOCKER in the design review ("Warning/critical banners unreachable when Dexie tables empty" — that bug was fixed, but no regression test was added to prevent it from regressing).

#### Medium

- **`src/lib/__tests__/storageEstimate.test.ts:101-109` (confidence: 72)**: The `uses custom sampleSize parameter` test (line 101) asserts that `table.limit` was called with the correct value but does not assert the returned size is computed correctly with that custom sample. This tests the call interface rather than the computation outcome. The test at line 91 (`handles tables with fewer rows than sampleSize`) is stronger in this regard, but a combined test asserting both the call and the result would be more robust.

- **`src/lib/__tests__/storageEstimate.test.ts` (confidence: 65)**: No test covers the `estimateTableSize` behavior for a table where `count > 0` but `sample.length === 0` (line 69 of `storageEstimate.ts` returns 0). This is a theoretical gap — if `count()` and `limit().toArray()` become inconsistent — but the mock infrastructure already has `createMockTable` and `createEmptyMockTable` helpers that could be combined to create this scenario.

- **`src/lib/__tests__/storageEstimate.test.ts:55-57` (confidence: 60)**: `beforeEach(() => vi.clearAllMocks())` is present and correct. However, the module-level `mockTable` and `mockGetStorageEstimate` variables are declared at the top of the file (lines 5-16) and mutated via `mockImplementation`/`mockReturnValue` within tests. This is standard Vitest pattern and is safe because `vi.clearAllMocks()` resets all mock state between tests. No isolation issue exists, but the `getStorageOverview — edge cases` describe block at line 249 does not reset `mockTable` to a common baseline before each test in that group — each test manually calls `mockTable.mockReturnValue(createEmptyMockTable())` which is sufficient.

#### Nits

- **Nit `src/lib/__tests__/storageEstimate.test.ts:111-122` (confidence: 55)**: The `uses Blob.size for rows containing Blob fields` test verifies the Blob-size path but uses `new Blob(['x'.repeat(500)])` directly. The test would be more representative if it used a realistic field name that matches the actual thumbnail storage shape (e.g., `{ id: '1', data: blob }` rather than `{ id: '1', thumbnail: blob }`), since the implementation iterates `Object.values()` — field name does not matter, but it would make intent clearer.

- **Nit `src/lib/__tests__/storageEstimate.test.ts:297-308` (confidence: 50)**: The `STORAGE_CATEGORIES` test verifies the exported constant equals the expected array. This is a reasonable smoke test, but since `STORAGE_CATEGORIES` is derived directly from `Object.keys(CATEGORY_MAP)`, the test would provide more value if it also confirmed that each category key in `STORAGE_CATEGORIES` has a corresponding entry in the `CATEGORY_MAP` (i.e., tests the mapping contract, not just the key names).

---

### Edge Cases to Consider

1. **Dismiss state persists across refresh, not across sessions.** The `warningDismissed` state is read from `sessionStorage` on mount and set on dismiss. If the user clicks Refresh, `warningDismissed` stays `true` in React state — the warning does not reappear after refresh within the same session. This is intentional per AC3, but no test verifies that a refresh does NOT reset the dismiss state.

2. **Concurrent refresh clicks.** `handleRefresh` guards with `if (refreshing) return` (line 293 of `StorageManagement.tsx`). No test verifies that a second click while refreshing is a no-op (i.e., `getStorageOverview` is called exactly once despite two rapid clicks).

3. **Warning banner at exactly 80% vs 79.9%.** The boundary `usagePercent >= 0.8` in `QuotaWarningBanner` is the threshold for the amber warning. The service-layer edge case test at line 250 confirms `usagePercent: 0.8` is returned correctly from `getStorageOverview`, but no component test verifies the banner appears at exactly 0.8 and does not appear at 0.799. The component uses `Math.round(usagePercent * 100)` for display but the conditional uses the raw float — a value like `0.7999` would not show the banner even though it rounds to "80%", which could confuse users.

4. **`sessionStorage` unavailability.** The component catches `sessionStorage` exceptions (lines 281-284 and 310-313). No test exercises this path — a test should stub `sessionStorage` to throw and confirm the component does not crash and the warning is shown in its default (non-dismissed) state.

5. **`getStorageOverview` returns after the component unmounts.** The `useEffect` uses a `cancelled` flag. No test verifies that calling `setOverview` is skipped when the component unmounts before the async call resolves. This is a memory-leak / stale-update guard that is a standard pattern in this codebase but lacks a targeted test.

6. **`CategoryBreakdownLegend` with all zero-byte categories but `categorizedTotal === 0`.** The legend `nonEmpty` filter (line 217 of `StorageManagement.tsx`) returns an empty array, causing the legend to return `null`. No test covers this — it is implicitly tested by the empty state path, but the legend component itself is never directly tested.

---

ACs: 0 covered / 7 total | Findings: 13 | Blockers: 6 | High: 3 | Medium: 3 | Nits: 2
