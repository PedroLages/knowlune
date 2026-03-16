## Test Coverage Review: E11-S05 — Interleaved Review Mode

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Notes from multiple courses surfaced in mixed sequence weighted by topic similarity and time since last review | `src/lib/__tests__/interleave.test.ts:56-103` (interleaveReviews — spreads courses, prioritises urgency) | `tests/e2e/story-e11-s05.spec.ts:101-115` (progress shows 1/3 with multi-course data) | Covered |
| 2 | Card-flip interface with prompt on front, content on back | None | `tests/e2e/story-e11-s05.spec.ts:117-134` (front visible, rating buttons hidden pre-flip, visible post-flip) | Covered |
| 3 | Hard/Good/Easy rating updates review interval and retention prediction | None | `tests/e2e/story-e11-s05.spec.ts:136-160` (all three buttons present, rating advances progress counter) | Partial |
| 4 | Single-course fallback informs learner and offers options | None | `tests/e2e/story-e11-s05.spec.ts:162-198` (dialog visible, both action buttons, Continue Anyway proceeds) | Covered |
| 5 | Session summary: total notes, ratings distribution, courses covered, retention improvement | None | `tests/e2e/story-e11-s05.spec.ts:200-235` (summary visible, total-reviewed=2, courses-covered=2, both action buttons) | Partial |

**Coverage**: 5/5 ACs have at least one test | 0 gaps | 2 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All ACs have test coverage.

---

#### High Priority

**`tests/e2e/story-e11-s05.spec.ts:136-160` (confidence: 85)**
AC3 requires that a rating "updates the note's review interval and retention prediction." The test verifies that clicking "Good" advances the progress counter from `1 / 3` to `2 / 3`, but never reads back the persisted `ReviewRecord` from IndexedDB to confirm the `interval`, `easeFactor`, or `nextReviewAt` fields were actually mutated. The progress counter advancing only proves the UI state machine incremented `interleavedIndex` — not that `rateNote()` wrote to Dexie successfully.

Fix: after the "Good" click, add a `page.evaluate()` call that opens IndexedDB, reads `reviewRecords` for `note-1`, and asserts that `interval > 4` and `nextReviewAt` is in the future relative to `FIXED_DATE`.

**`tests/e2e/story-e11-s05.spec.ts:200-235` (confidence: 80)**
AC5 requires the summary to show "ratings distribution" and "estimated retention improvement." The test asserts `summary-total-reviewed` and `summary-courses-covered` but does not assert anything about the ratings distribution panel (`data-testid="interleaved-summary"` contains three `RatingBar` components) or the retention improvement value. Because `averageRetentionAfter` is computed from a formula in `endInterleavedSession`, not testing it leaves the core math unvalidated from an E2E perspective.

Fix: assert `summary.getByText(/Good/i)` with an adjacent count of `1`, assert `summary.getByText(/Easy/i)` with count `1`, and assert that a retention percentage element is visible and non-zero (e.g. `getByTestId('summary-retention')` if added, or use a text pattern against the `%` suffix).

**`tests/e2e/story-e11-s05.spec.ts:162-198` (confidence: 75)**
AC4's "Return to Review Queue" path is never exercised. The test clicks "Continue Anyway" and asserts the progress bar appears, but does not test the secondary action that navigates back to `/review`. This is one of two explicitly named options in the AC and represents a navigation path with no coverage.

Fix: add a second scenario within the AC4 test (or a separate test) that seeds the same single-course data, navigates to `/review/interleaved`, asserts the dialog, clicks "Return to Review Queue", and verifies `page.url()` contains `/review` and the dialog is gone.

---

#### Medium

**`tests/e2e/story-e11-s05.spec.ts:24-91` (confidence: 72)**
Module-level factory calls (`createImportedCourse`, `createDexieNote`, `createDueReviewRecord`) produce shared objects that are reused across every test. If any test mutates these objects (unlikely in JS with spread factories, but possible if factory returns object references rather than deep copies), test isolation breaks silently. The `createDexieNote` factory returns a plain object literal so shallow mutation is safe here, but the `FIXED_DATE` string shared across `note1/note2/note3` is fine — the real risk is the counter in `review-factory.ts` (line 21: `let counter = 0`) being shared across the test suite execution, potentially colliding IDs with other test files that import `createReviewRecord`.

Fix: move module-level factory calls inside `seedMultiCourseData` or inside each test body, or rely exclusively on `beforeEach` scoping to guarantee fresh data per test.

**`src/lib/__tests__/interleave.test.ts` — no test for `interleaveReviews` with exactly two courses and overlapping tags (confidence: 68)**
The "spreads notes from same course" test uses disjoint tags (`react` vs `python`). When two courses share a tag (e.g. both have `programming`), the Jaccard similarity is non-zero and the dissimilarity penalty partially cancels out. The algorithm's behaviour in this partially-overlapping scenario is not verified, even though the story specifically calls out "related topics" as a weighting dimension.

Fix: add a unit test with `c1: ['javascript', 'programming']` and `c2: ['react', 'programming']`, confirm that the result still alternates courses (no consecutive same-course cards) despite the partial overlap.

**`tests/e2e/story-e11-s05.spec.ts:93-99` (confidence: 65)**
The `beforeEach` navigates to `/` and seeds `eduvi-sidebar-v1=false` — correct tablet viewport pattern from project rules. However, there is no `afterEach` cleanup. Each test seeds distinct data using `seedImportedCourses` / `seedNotes` / `seedReviewRecords` with `put()` semantics (upsert), so stale records from a prior test can accumulate in the same browser context. If Playwright reuses the same browser page between tests (which it does by default for tests in the same `describe` block unless contexts are isolated), the `allReviews` loaded on mount may include records from the previous test's seed.

Fix: add an `afterEach` that clears the `reviewRecords`, `notes`, and `importedCourses` stores using `clearIndexedDBStore` (already exported from `tests/support/helpers/indexeddb-seed.ts`), or use a fresh browser context per test via the existing `fixtures` setup.

---

#### Nits

**Nit** `tests/e2e/story-e11-s05.spec.ts:113-114` (confidence: 90): The AC1 test asserts `interleaved-progress` contains `'1 / 3'` to prove three notes were loaded, but does not verify that the sequence is actually interleaved (i.e. that notes from both courses appear). The test name says "surfaced in a mixed sequence" but the assertion only checks the total count. Consider also asserting that the first card's `interleaved-course-name` matches one of the two seeded course names (`'JavaScript Fundamentals'` or `'React Patterns'`) and, after rating and advancing, that the second card shows a different course name.

**Nit** `src/lib/__tests__/interleave.test.ts:5` (confidence: 85): `FIXED_DATE` is defined inline (`new Date('2026-03-15T12:00:00.000Z')`) rather than imported from `tests/utils/test-time` (which is used in E2E factories). The E2E spec imports `FIXED_DATE` from `../utils/test-time` while the unit test declares its own constant. If the project-level fixed date ever changes, the unit test will drift. Import the shared constant instead.

**Nit** `tests/e2e/story-e11-s05.spec.ts:133` (confidence: 80): `{ timeout: 2000 }` is used in three places to wait for the flip animation to complete. A 500ms CSS transition with a 2000ms test timeout is reasonable, but the `timeout` override is not documented. Add a brief comment referencing the 500ms `motion/react` flip duration so future readers understand why the override exists rather than assuming it is an arbitrary hard wait.

**Nit** `tests/e2e/story-e11-s05.spec.ts:87-91` (confidence: 70): The `seedMultiCourseData` helper function seeds data but the seeding order (courses → notes → reviews) matters because `loadReviews` may race with `loadNotes` on mount. The current order is correct. This is not a bug, but a comment explaining that courses must be seeded before notes (which reference `courseId`) would help future maintainers.

---

### Edge Cases to Consider

1. **Empty notes queue (zero due reviews):** `InterleavedReview.tsx` renders an "empty" phase with a `data-testid="interleaved-review"` wrapper and the `Empty` component. There is no E2E test that navigates to `/review/interleaved` with no seeded data and verifies the empty-state message "No notes due for review" is shown.

2. **"End Session" early exit:** The page renders an "End Session" ghost button that calls `endInterleavedSession` and transitions to the summary phase mid-session. No test covers this path. The AC5 only describes completing all cards, but the design guidance explicitly lists "End Session" as a trigger. A test clicking "End Session" after one of three cards, then verifying the summary shows `totalReviewed: 1` (not 3), would confirm the partial-session summary is correct.

3. **"Review More" action in summary:** The summary's "Review More" button calls `onStartNew`, which invokes `startSession()` and resets `isFlipped` and `phase` back to `reviewing`. No test exercises this re-entry path. If `phaseInitialised.current` is already `true` from the first session, the guard at line 101 of `InterleavedReview.tsx` prevents re-initialisation — the second session must start via the button's `startInterleavedSession` call, not the effect. This is a subtle state machine path with no test coverage.

4. **All-Hard rating session:** If every card is rated Hard, the `averageRetentionAfter` calculation in `endInterleavedSession` should still apply the `95%` bump formula. No unit or E2E test exercises all-Hard or all-Easy homogeneous sessions to confirm the ratings distribution rendering (all bars except one are 0).

5. **Note deleted between session start and rating:** `noteMap` is built from `notes.filter(n => !n.deleted)`. If a note is soft-deleted during a session, `noteMap.get(currentRecord.noteId)` returns `undefined`. `InterleavedReview.tsx` renders the card only when `currentNote` is truthy (line 332), so the UI would skip the card silently, but `rateInterleavedNote` in the store still calls `rateNote(currentRecord.noteId, ...)` with a potentially orphaned noteId. No test covers this defensive path.

6. **Keyboard shortcut `Space` to flip:** The story's design guidance and accessibility section specify `Space`/`Enter` to flip. No E2E test dispatches keyboard events to verify the shortcut works, and the handler has a guard that checks `target.closest('[data-testid="interleaved-card-front"]') || target === document.body`. If focus is elsewhere (e.g. the progress region), the shortcut silently does nothing.

---

ACs: 5 covered / 5 total | Findings: 10 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 4
