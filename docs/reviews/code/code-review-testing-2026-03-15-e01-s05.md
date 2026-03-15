## Test Coverage Review: E01-S05 — Detect Missing or Relocated Files

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | System verifies FileSystemHandle accessibility on course load (non-blocking) | `ImportedCourseDetail.test.tsx:125` (renders items with status indicators) | `story-e01-s05.spec.ts:73` (UI renders without blocking, file-status testids visible) | Covered |
| 2 | Missing files display "File not found" badge + toast notification within 2 seconds | `ImportedCourseDetail.test.tsx:157` (badge present, no link) | `story-e01-s05.spec.ts:97` (badge visible), `story-e01-s05.spec.ts:125` (toast within 2000ms) | Covered |
| 3 | Available files remain functional alongside missing files | `ImportedCourseDetail.test.tsx:186` (available link href correct, missing has no link, badge present) | `story-e01-s05.spec.ts:147` (all items visible, aria-disabled, no anchor tag on missing) | Covered |
| 4 | Badge removed when file is recovered on next course load | `ImportedCourseDetail.test.tsx:200` (re-render with available status clears badge) | `story-e01-s05.spec.ts:180` (re-verify on return navigation, file-status indicators still present) | Partial |

**Coverage**: 3/4 ACs fully covered | 0 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four acceptance criteria have at least one test. Coverage gate passes.

---

#### High Priority

**`tests/e2e/story-e01-s05.spec.ts:179-202` (confidence: 82)**: AC4's E2E test does not verify badge removal on recovery. The test comment at line 197 explicitly acknowledges this: "With real handles, recovery would clear them (manual test required)." The test only confirms that `file-status-video-1` and `file-status-video-2` exist on second load — it does not assert the badge is absent when a handle becomes valid. The unit test at `ImportedCourseDetail.test.tsx:200` covers this path by simulating a status change from `missing` to `available` via `mockStatusMap`, which is sound. However, the E2E leg of AC4 is untestable with the current seeding approach (no real FileSystemHandle in test data), and the test as written provides no behavioral signal beyond "the page loaded again." The test comment documents this as intentional, but AC4's E2E coverage is effectively a structural assertion only.

Fix: Accept the constraint as documented — this is an honest representation of the browser API limitation. The unit test at line 200 provides the behavioral assertion. Add a comment in the E2E test explicitly stating that AC4 badge-removal behavior is fully covered by the unit test, so the gap is documented rather than silently missed.

**`src/app/pages/__tests__/ImportedCourseDetail.test.tsx` (confidence: 78)**: The `useFileStatusVerification` hook — the central piece of AC1 and AC2 — has no dedicated unit tests. Its toast emission, `toastFiredRef` deduplication guard, `Promise.allSettled` rejected-branch handling, and cleanup `ignore` flag are all exercised only indirectly through `ImportedCourseDetail` with the hook mocked out entirely (`vi.mock('@/hooks/useFileStatusVerification')`). The mock at line 10 bypasses every behavior in `src/hooks/useFileStatusVerification.ts`. The `src/lib/__tests__/toastHelpers.test.ts` file tests general toast helpers but does not touch the file-verification toast.

Fix: Add `src/hooks/__tests__/useFileStatusVerification.test.ts` with at minimum:
- Verifies toast fires with correct count and filenames when items have null handles.
- Verifies toast fires exactly once (not twice) when the hook re-renders due to dependency array change.
- Verifies `ignore` flag prevents state update after unmount.
- Verifies rejected `Promise.allSettled` branch maps item to `missing` status.

**`src/lib/fileVerification.ts` has no unit tests (confidence: 90)**: The `verifyFileHandle` utility is the lowest-level function in this feature and handles three distinct branches: `null/undefined` handle returns `missing`; `queryPermission` returning non-`granted` returns `permission-denied`; `getFile()` throwing returns `missing` with `console.warn`. None of these paths have a dedicated unit test. The function is small but branchy — each branch is mockable with a simple `FileSystemFileHandle` stub.

Fix: Add `src/lib/__tests__/fileVerification.test.ts` with:
- `verifyFileHandle(null)` returns `'missing'`.
- `verifyFileHandle(undefined)` returns `'missing'`.
- Handle where `queryPermission` returns `'denied'` returns `'permission-denied'`.
- Handle where `queryPermission` returns `'granted'` and `getFile()` resolves returns `'available'`.
- Handle where `getFile()` throws returns `'missing'` and calls `console.warn`.

---

#### Medium

**`tests/e2e/story-e01-s05.spec.ts:66-93` (confidence: 72)**: AC1 asserts non-blocking behavior via "course structure renders" (`course-content-list` visible), but the test only seeds videos and omits PDFs. This means `file-status-pdf-1` is never exercised in the AC1 test, and no assertion checks that verification completes asynchronously rather than synchronously. The assertion that `file-status-video-1` and `file-status-video-2` are visible is correct but does not distinguish between `checking` state (indicator rendered but verification not yet complete) and `available`/`missing` state. The `data-status` attribute on the span element exists in the implementation but is never asserted in any test.

Fix: Add an assertion checking `data-status` attribute on `file-status-video-1` to confirm final status was applied (e.g., `expect(locator).toHaveAttribute('data-status', 'missing')`). Also seed PDFs in the AC1 test to ensure uniform coverage.

**`tests/e2e/story-e01-s05.spec.ts` (confidence: 70)**: The `indexedDB` fixture auto-cleans seeded `importedCourses` records via `clearRecords()` (fixture teardown at `indexeddb-fixture.ts:158`). However, the `importedVideos` and `importedPdfs` stores seeded using `seedImportedVideos` / `seedImportedPdfs` (raw helpers from `indexeddb-seed.ts`) are NOT included in that auto-cleanup. These stores are seeded in four of the five tests and no `afterEach` clears them. Each test uses fixed IDs (`video-1`, `video-2`, `pdf-1`), so `store.put()` semantics mean collisions would not cause failures — but leftover records could affect future tests that read from these stores without seeding their own data.

Fix: Add an `afterEach` block that calls `indexedDB.clearStore('importedVideos')` and `indexedDB.clearStore('importedPdfs')` to ensure clean state between tests.

**`src/app/pages/__tests__/ImportedCourseDetail.test.tsx:213-221` (confidence: 65)**: The `permission-denied` unit test asserts that the badge appears and the link is absent, but the design spec at `1-5-detect-missing-or-relocated-files.md:94` states permission-denied items should be "Clickable — triggers re-permission prompt." The implementation at `ImportedCourseDetail.tsx:113` treats `permission-denied` identically to `missing` (both map to `isUnavailable = true`, both render as a non-clickable `div`). The test asserts this non-clickable behavior. While the code review already flagged this as a finding, the unit test actively confirms the incorrect behavior rather than the specified behavior. If the design intent is later corrected to make permission-denied items clickable, this test will need to be inverted.

Fix: Either align the test with the design spec (assert that permission-denied items are clickable and trigger re-auth), or add a clear comment in the test noting the intentional deviation from the design spec so reviewers understand the test is documenting a known gap, not the AC-specified behavior.

---

#### Nits

**Nit `tests/e2e/story-e01-s05.spec.ts:34-53` (confidence: 55)**: `TEST_VIDEOS` and `TEST_PDFS` are defined as inline object literals rather than using the `createImportedCourse` factory pattern. While a video/PDF factory does not yet exist, the items include realistic values, so this is acceptable. Consider creating a factory to maintain consistency with the project pattern of using factories from `tests/support/fixtures/factories/` for all test data.

**Nit `tests/e2e/story-e01-s05.spec.ts:141` (confidence: 50)**: The toast locator uses the CSS attribute selector `[data-sonner-toast]`. This is a reasonable selector tied to the Sonner library's DOM output, but it is library-internal markup rather than a `data-testid`. If Sonner changes its DOM structure, this selector breaks silently. The selector is acceptable given Sonner does not expose a `data-testid` API, but the usage is worth noting as a fragility point.

**Nit `src/app/pages/__tests__/ImportedCourseDetail.test.tsx:76-97` (confidence: 45)**: The `db` mock at line 80 stubs `importedVideos` and `importedPdfs` at the query-chain level (`where().equals().sortBy()`) rather than mocking the Dexie instance at the module boundary. This is functional but differs from the project's guidance to "mock at the Dexie.js layer." A module-level mock of the `db` export would be slightly more resilient to query API changes.

---

### Edge Cases to Consider

- **`verifyFileHandle` with a revoked handle mid-verification**: The implementation's `catch` block handles `getFile()` throwing, but there is no test for a handle where `queryPermission` itself throws (e.g., a corrupted handle object). Adding a test for this in `fileVerification.test.ts` would cover the `console.warn` path fully.

- **Single-file course (one video, zero PDFs)**: No test exercises the singular form of the toast message. `useFileStatusVerification` uses `count === 1 ? 'file' : 'files'` pluralization. The E2E tests always have 2+ missing files; a single-file course with one missing item would emit "1 file unavailable" — this pluralization branch is untested.

- **Course with zero videos and zero PDFs (empty course)**: `ImportedCourseDetail.tsx:204` renders "No content found in this course." The unit test file does not include a test for this empty state, and the E2E suite omits it. This is a non-AC edge case but a real user-visible state.

- **Toast deduplication on React strict mode double-invoke**: `useFileStatusVerification` uses `toastFiredRef.current` as a deduplication guard. In React StrictMode, effects run twice in development. The `toastFiredRef.current = false` reset at the start of the effect means a second synchronous invocation would fire the toast again before the first `verifyAll()` promise settles. No test covers this StrictMode behavior.

- **`Promise.allSettled` rejected branch**: `useFileStatusVerification.ts:67-69` handles the case where a `Promise.allSettled` result has `status === 'rejected'`. This branch falls back to `item.id` from the parallel `items` array. There is no unit test confirming this fallback works correctly when the async item mapping rejects.

---

ACs: 4 covered / 4 total | Findings: 9 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 3
