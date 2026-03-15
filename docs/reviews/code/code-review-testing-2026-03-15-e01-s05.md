## Test Coverage Review: E01-S05 — Detect Missing or Relocated Files

### AC Coverage Summary

**Acceptance Criteria Coverage:** 3/4 ACs tested (**75%**)

**COVERAGE GATE:** BLOCKER (<80%)

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | System verifies FileSystemHandle accessibility on course load, non-blocking | `ImportedCourseDetail.test.tsx` — mocks hook, verifies rendering proceeds | `story-e01-s05.spec.ts:73` — verifies `course-content-list` visible + `file-status-*` present | Covered |
| 2 | Missing files show "File not found" badge + toast within 2s | `ImportedCourseDetail.test.tsx:157` — badge text + no link | `story-e01-s05.spec.ts:97,125` — badge visible + toast within `timeout:2000` | Covered |
| 3 | Available files functional, missing files show badge but remain in structure | `ImportedCourseDetail.test.tsx:150` — link href present for available; `ImportedCourseDetail.test.tsx:157` — no link for missing | `story-e01-s05.spec.ts:147` — items remain in DOM + `aria-disabled` + no links BUT only exercises all-missing scenario | **Partial** |
| 4 | Badge removed when file restored on next course load | None | `story-e01-s05.spec.ts:179` — re-navigation triggers re-verification; cannot assert badge removal (test-comment acknowledges this) | **Partial** |

**Coverage**: 2/4 ACs fully covered | 0 gaps | 2 partial

---

### Test Quality Findings

#### Blockers (coverage gate failure)

- **(confidence: 92)** AC3 partial — "available files remain functional alongside missing files" is the defining behaviour of this AC: a mixed-state course where some files are present and some are absent. Neither the E2E spec nor the unit tests exercise this scenario. Every E2E test seeds videos/PDFs **without** a `fileHandle` property, so `verifyFileHandle(null)` returns `'missing'` for all items unconditionally. The unit test at `src/app/pages/__tests__/ImportedCourseDetail.test.tsx:150` sets `v1` to `'available'` and asserts a link exists — this is the closest coverage — but no test simultaneously has one item `'available'` AND another `'missing'` and asserts that the available item is clickable while the missing item shows a badge. Suggested test in `src/app/pages/__tests__/ImportedCourseDetail.test.tsx`: `it('available items remain clickable when sibling items are missing', async () => { mockStatusMap.set('v1', 'available'); mockStatusMap.set('v2', 'missing'); renderDetail(); const v1 = await screen.findByTestId('course-content-item-video-v1'); expect(v1.querySelector('a')).toHaveAttribute('href', '/imported-courses/course-1/lessons/v1'); const v2 = await screen.findByTestId('course-content-item-video-v2'); expect(v2.querySelector('a')).toBeNull(); expect(await screen.findByTestId('file-not-found-badge-v2')).toBeInTheDocument(); })`.

- **(confidence: 92)** AC4 partial — The recovery path ("badge removed when file restored") is explicitly marked as requiring manual testing in the E2E spec comment at line 21-23 and the test at `tests/e2e/story-e01-s05.spec.ts:196-200` only asserts that `file-status-*` indicators are present after re-navigation — it cannot and does not assert that a previously-missing badge is absent. There is no unit test that sets an item to `'missing'`, then changes it to `'available'` (simulating recovery), and asserts the badge disappears. The `useFileStatusVerification` hook's `useEffect` re-runs when `videos` or `pdfs` references change, so the recovery path is exercised by the hook — but it is untested. Suggested test in `src/app/pages/__tests__/ImportedCourseDetail.test.tsx`: start with `mockStatusMap.set('v1', 'missing')`, render, assert badge present, then use `rerender` or update mockStatusMap to `'available'`, re-render, and assert `queryByTestId('file-not-found-badge-v1')` returns `null`.

#### High Priority

- **`tests/e2e/story-e01-s05.spec.ts:180-201` (confidence: 85)** — AC4 E2E test never asserts the badge is removed; it only asserts `file-status-video-1` is visible after re-navigation. The test comment at line 196 explicitly concedes this limitation. While the constraint is real (browser FileSystemHandle cannot be mocked in Playwright), the test currently does not add coverage beyond AC1 — re-verification firing is not meaningfully distinguishable from the initial load test. The AC4 E2E test should at minimum assert `file-not-found-badge-video-1` is still visible (confirming persistence), which it does not do, or the test should be retitled to reflect that it only validates re-verification triggers rather than recovery. Fix: either remove the redundant test and document the AC4 limitation explicitly in a test-coverage note, or assert the badge still exists (`await expect(page.getByTestId('file-not-found-badge-video-1')).toBeVisible()`) to make the re-verification path unambiguous.

- **`src/hooks/useFileStatusVerification.ts` — no unit tests exist (confidence: 82)** — The hook at `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/hooks/useFileStatusVerification.ts` and the utility at `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/lib/fileVerification.ts` are new files with zero direct unit tests. `verifyFileHandle` covers three distinct branches: `handle === null/undefined` → `'missing'`; `queryPermission !== 'granted'` → `'permission-denied'`; `getFile()` throws → `'missing'`; success → `'available'`. None of these branches are directly tested. `verifyFileHandle` is a pure async function and is straightforwardly testable with mocked `FileSystemFileHandle` objects. Suggested location: `src/lib/__tests__/fileVerification.test.ts`. Key cases: null handle returns `'missing'`; denied permission returns `'permission-denied'`; `getFile` throwing returns `'missing'`; successful `getFile` returns `'available'`.

- **`src/hooks/useFileStatusVerification.ts:63-67` (confidence: 78)** — The `Promise.allSettled` rejection branch sets `verified.set('unknown', 'missing')` — the key `'unknown'` is a literal string, not the item's actual `id`. If a settlement ever rejects, the resulting status entry is keyed to the string `'unknown'` rather than the affected item's id, silently losing the association. There is no test that exercises a rejected promise from `verifyFileHandle`, so this bug path is untested. Suggested assertion: a test that causes `verifyFileHandle` to throw (via a mock that rejects) should verify that the affected item's `data-testid` shows a badge, not that a phantom `'unknown'` key appears.

#### Medium

- **`tests/e2e/story-e01-s05.spec.ts` — no `afterEach` cleanup (confidence: 72)** — The spec has a `beforeEach` that seeds `localStorage` but has no `afterEach` to clear the seeded IndexedDB data (imported courses, videos, PDFs). Other specs in the suite use `indexedDB.clearAll()` or equivalent patterns in `afterEach`. Without cleanup, test data from one run may persist and interfere when tests run more than once against the same browser context (e.g., in burn-in). Fix: add `test.afterEach(async ({ indexedDB }) => { await indexedDB.clearAll() })` or equivalent.

- **`tests/e2e/story-e01-s05.spec.ts:25-63` — inline test data instead of factory (confidence: 65)** — `TEST_VIDEOS` and `TEST_PDFS` are defined as inline literal arrays rather than using a factory. The `imported-course-factory.ts` factory is already imported and used for `TEST_COURSE`, but no equivalent video/PDF factories exist yet. This inconsistency leaves video/PDF test data without the realistic values and uniqueness guarantees a factory would provide. Note: no video/PDF factory currently exists in `tests/support/fixtures/factories/`, so this is a gap in the factory infrastructure rather than a test authoring choice. Medium severity because the hardcoded IDs (`'video-1'`, `'pdf-1'`) are deterministic and unlikely to collide in a single-context run.

- **`src/app/pages/__tests__/ImportedCourseDetail.test.tsx` — `permission-denied` state not unit-tested (confidence: 68)** — The `FileStatusBadge` component renders a distinct "Permission needed" badge when `status === 'permission-denied'` (see `src/app/pages/ImportedCourseDetail.tsx:27-38`). No unit test sets any item to `'permission-denied'` and asserts `data-testid="file-permission-badge-v1"` is rendered with the correct text. This is a distinct AC state described in the story design guidance. Suggested test: `it('permission-denied items show permission badge', async () => { mockStatusMap.set('v1', 'permission-denied'); renderDetail(); expect(await screen.findByTestId('file-permission-badge-v1')).toHaveTextContent(/permission needed/i); })`.

#### Nits

- **Nit** `tests/e2e/story-e01-s05.spec.ts:180` (confidence: 55): The test describe label "AC4: Re-verification on course reload" and the test name "should re-verify file status on each course load" overstate what is actually verified. The test confirms that status indicators render after a second navigation, not that re-verification occurred. A more accurate name would be "status indicators persist across navigations (recovery requires manual test)".

- **Nit** `src/app/pages/__tests__/ImportedCourseDetail.test.tsx:113` (confidence: 50): `beforeEach` resets `mockStatusMap` to all `'available'` correctly, but the `storeState` reset on line 111 only resets `importedCourses`. If a future test modifies other `storeState` fields (e.g., `isImporting`), those changes would leak into subsequent tests. Consider spreading a `DEFAULT_STORE_STATE` constant in `beforeEach` rather than restoring individual fields.

---

### Edge Cases to Consider

- **`verifyFileHandle` with a stale handle after browser restart**: The real-world scenario where a handle was granted in a previous session but the browser cleared permissions is represented by `queryPermission` returning `'prompt'` (not `'denied'`). The current implementation treats anything that is not `'granted'` as `'permission-denied'`. A test should confirm `'prompt'` results in `'permission-denied'` rather than falling through to `getFile()`.

- **Empty course (no videos, no PDFs)**: `useFileStatusVerification` returns early on line 33 when `items.length === 0`. There is no test that loads a course with zero content items and verifies that no toast fires and no badges appear. The unit test `renders content list container` at line 180 of `ImportedCourseDetail.test.tsx` renders with content, not without.

- **Single missing file vs multiple missing files toast copy**: The toast message uses `count === 1 ? 'file' : 'files'` (see `src/hooks/useFileStatusVerification.ts:76`). No test verifies the singular form — all E2E tests seed two videos plus one PDF (all missing), so the plural branch is always exercised.

- **PDF `permission-denied` state**: The PDF rendering path in `ImportedCourseDetail.tsx:157` checks `isMissing = status === 'missing'` and does not handle `permission-denied` for the opacity class. A `permission-denied` PDF would render at `opacity-75` (the "not missing" branch) rather than `opacity-50`. No test catches this inconsistency between video and PDF unavailability handling.

- **Toast deduplication across rapid navigations**: `toastFiredRef` resets to `false` on each `useEffect` invocation. If a user navigates away and back quickly, two toasts could fire. The `ignore` flag prevents double `setStatusMap` calls, but `toastFiredRef.current = false` at line 37 runs synchronously before the async `verifyAll()` completes, so a rapid re-mount would reset the ref and allow a second toast. No test exercises this race.

---

ACs: 2 covered / 4 total (2 partial) | Findings: 10 | Blockers: 2 | High: 3 | Medium: 3 | Nits: 2
