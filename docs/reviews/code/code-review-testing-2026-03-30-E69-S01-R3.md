## Test Coverage Review: E69-S01 — Storage Estimation Service & Overview Card (R3)

**Review round:** R3 (addresses all R1 blockers)
**Previous verdict:** BLOCKER — 0/7 ACs fully covered (0%), 6 blockers
**This round:** All 6 R1 blockers resolved; full component test suite added

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 7/7 ACs tested (**100%**)

**COVERAGE GATE: PASS (>=80%)**

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Stacked bar chart with 6 segments, summary line, legend grid | `StorageManagement.test.tsx:138-192`, `storageEstimate.test.ts:142-262` | None | Covered |
| 2 | Skeleton placeholders during load, `aria-busy="true"` | `StorageManagement.test.tsx:121-132` | None | Covered |
| 3 | Amber warning banner (80-94%), dismiss to sessionStorage | `StorageManagement.test.tsx:198-247` | None | Covered |
| 4 | Red critical banner (95%+), `aria-live="assertive"`, Free Up Space scroll | `StorageManagement.test.tsx:253-305` | None | Covered |
| 5 | Refresh button shows spinner, re-fetches estimates | `StorageManagement.test.tsx:311-334` | None | Covered |
| 6 | Graceful fallback when Storage API unavailable | `StorageManagement.test.tsx:340-352`, `storageEstimate.test.ts:163-175` | None | Covered |
| 7 | Empty state when all Dexie tables empty | `StorageManagement.test.tsx:358-379`, `storageEstimate.test.ts:203-219` | None | Covered |

**Coverage**: 7/7 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers

None. All R1 blockers resolved.

#### High Priority

- **`src/app/components/settings/__tests__/StorageManagement.test.tsx:198-211` (confidence: 82)**: The amber warning banner test (AC3) asserts the text content and the dismiss button are present, but does not assert `role="alert"` is set on the banner element nor `aria-live="polite"`. AC3 explicitly requires `role="alert"` and `aria-live="polite"`. The critical banner test at line 268-281 does assert `aria-live="assertive"`, creating an asymmetry. The missing assertion means a regression that removes `role="alert"` or `aria-live="polite"` from the amber banner would go undetected. Fix: add `expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite')` inside the `shows amber warning when usage is between 80-94%` test after the banner text assertion.

- **`src/app/components/settings/__tests__/StorageManagement.test.tsx:311-334` (confidence: 78)**: The refresh button test (AC5) verifies `getStorageOverview` is called twice and the updated percentage renders. It does not assert the button is disabled or a spinner is present during the in-flight refresh. The AC states "a loading spinner appears on the button". The implementation uses `refreshing` state to swap `RefreshCw` for `Loader2` and sets `disabled={refreshing}` on the button. A test that only observes the final resolved state cannot catch a regression that removes the spinner or fails to disable the button. Fix: intercept mid-flight — mock `getStorageOverview` the second time to return a controlled promise, click refresh, assert `screen.getByRole('button', { name: /refresh storage estimates/i })` has `disabled` attribute before resolving.

#### Medium

- **`src/app/components/settings/__tests__/StorageManagement.test.tsx:283-305` (confidence: 72)**: The "Free Up Space" scroll test targets an element with `id="data-management"`. The story AC4 specifies scrolling to the "cleanup section", and the dev notes reference `#cleanup-actions`. The implementation uses `document.getElementById('data-management')` (line 104 of `StorageManagement.tsx`), and the test mirrors this — so the test is internally consistent. However, if the target element ID changes in the Settings page layout, the test will still pass (it creates its own `div#data-management` in the test DOM). Consider adding a `data-testid="cleanup-scroll-target"` to the actual Settings page element so the test can assert the scroll target exists in the real page structure rather than fabricating it.

- **`src/app/components/settings/__tests__/StorageManagement.test.tsx:111-114` (confidence: 68)**: `beforeEach` clears both `vi.clearAllMocks()` and `sessionStorage.clear()`. The test at line 213 (dismiss flow) relies on a clean sessionStorage, which this handles correctly. However, there is no `afterEach` cleanup for the DOM element appended at line 289 (`document.body.appendChild(target)`) — the test removes it at line 304, but only on the happy path. If an assertion before `document.body.removeChild(target)` fails, the element leaks into subsequent tests. Fix: move the cleanup to an `afterEach` or wrap the DOM manipulation in a `try/finally` block.

- **`src/lib/__tests__/storageEstimate.test.ts:101-109` (confidence: 65)**: The `uses custom sampleSize parameter` test asserts `table.limit` was called with `3` but does not assert the computed size. This tests the call interface rather than the computation outcome. The result value is not examined — a bug that uses the sampleSize parameter for limiting but ignores it in the average calculation would pass this test. Low risk in practice because other tests cover the averaging path, but the test intent is incomplete. Fix: add `expect(size).toBeGreaterThan(0)` or compute the expected value from the rows and assert it.

#### Nits

- **Nit `src/app/components/settings/__tests__/StorageManagement.test.tsx:59-97`**: Both `createMockOverview` and `createEmptyOverview` inline all 6 category entries with explicit object literals. If the `StorageCategory` type or `CategoryEstimate` shape changes, both helpers need updating in lockstep. Consider deriving `createEmptyOverview` from `createMockOverview({ categories: [...all zeros], categorizedTotal: 0 })` to reduce duplication.

- **Nit `src/app/components/settings/__tests__/StorageManagement.test.tsx:370-380`**: The `empty state has Browse Courses link` test queries the link twice (`screen.getByRole('link', { name: /Browse Courses/i })` at lines 376 and 379). Assign the result to a variable on first query and reuse it for the `toHaveAttribute` assertion.

- **Nit `src/lib/__tests__/storageEstimate.test.ts:265-277`**: The `clamps usagePercent to max 1.0` test passes `usagePercent: 1.5` from `mockGetStorageEstimate`, which the implementation clamps via `Math.min(1, ...)`. The test correctly asserts `overview.usagePercent === 1`. No issue — this is a clean boundary test.

---

### Edge Cases to Consider

1. **Warning banner inside empty state at high usage.** The component at line 383-405 of `StorageManagement.tsx` renders the `QuotaWarningBanner` inside the empty state branch when `usagePercent >= 0.8`. This compound state (no Knowlune data but browser is nearly full) is not tested. A test should mock `getStorageOverview` returning `{ categorizedTotal: 0, usagePercent: 0.85 }` and assert both the empty state message and the warning banner are visible simultaneously. This was identified as a design review BLOCKER in R1 (the bug was fixed), but there is still no regression test to prevent it from recurring.

2. **Dismiss state survives a refresh within the same session.** The `warningDismissed` React state is set to `true` on dismiss and is never reset by `handleRefresh`. After dismiss + refresh, the banner should remain hidden. No test verifies this cross-interaction path. A test should: (1) render at 85%, (2) click Dismiss, (3) click Refresh, (4) confirm the warning banner does not reappear after the refresh resolves.

3. **Concurrent refresh clicks.** `handleRefresh` guards with `if (refreshing) return`. No test verifies a second rapid click results in exactly one `getStorageOverview` call. A test using `userEvent.setup()` + two clicks in sequence (without awaiting between them) would verify the guard.

4. **`sessionStorage` access throws.** The component catches `sessionStorage` exceptions at lines 281-284 and 310-313. No test exercises these paths. The component should not crash and should default to `warningDismissed: false` when sessionStorage is unavailable. A test should stub `sessionStorage.getItem` to throw and confirm the warning banner still renders.

5. **Warning banner at exact 0.8 boundary does NOT appear below it.** `usagePercent: 0.799` should produce no banner. A test exists confirming no banner below 80% (`usagePercent: 0.5`), but there is no test at the boundary itself (0.7999). The `Math.round` display logic (which rounds 79.99% to "80%") combined with the `>= 0.8` gate creates a narrow range where the displayed text says "80%" but no banner appears. Low risk, but a boundary test at `0.799` would be more precise than `0.5`.

6. **`getStorageOverview` returns after unmount.** The `cancelled` flag in the `useEffect` (line 266 of `StorageManagement.tsx`) prevents stale `setOverview` calls after unmount. This guard is untested. A test should unmount the component before the mock resolves and confirm no state update warnings appear in the console.

---

### R1 to R3 Delta

All 6 R1 blockers were resolved by the addition of `src/app/components/settings/__tests__/StorageManagement.test.tsx` (402 lines, 18 tests). Coverage moved from 0/7 (0%) to 7/7 (100%). The service-layer suite in `src/lib/__tests__/storageEstimate.test.ts` was also materially improved: blob-size path tests (lines 111-138), boundary clamping tests (lines 265-307), and the `categorizedTotal`/`totalUsage` divergence test (lines 309-324) were all added in this round.

The remaining findings are quality improvements, not AC gaps. The story is no longer blocked on test coverage.

---

ACs: 7 covered / 7 total | Findings: 8 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 3
