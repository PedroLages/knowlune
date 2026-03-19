## Test Coverage Review: E07-S07 — Error Path — Corrupted IndexedDB Sessions

### AC Coverage Summary

**Acceptance Criteria Coverage:** 2.5/3 ACs tested (**83%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Corrupted sessions → Courses page shows "Cold" momentum → no errors → valid sessions still work | None | `story-e07-s07.spec.ts:84` (no crash), `:289` (valid session contributes) | Partial |
| 2 | Mixed valid+corrupted → corrupted skipped (score 0/"Cold") → valid sessions contribute normally | None | `story-e07-s07.spec.ts:289-331` | Partial |
| 3 | Corrupted data → navigation works without errors | None | `story-e07-s07.spec.ts:334-360` | Covered |

**Coverage**: 1 AC fully covered | 2 partial | 0 complete gaps

---

### Test Quality Findings

#### Blockers

None. Coverage gate passes at 83%.

---

#### High Priority

- **`tests/e2e/regression/story-e07-s07.spec.ts:84,119,159,199,250` (confidence: 85)**: AC1 states momentum badges display "Cold" for affected courses, but four of the six tests assert only that the page heading and course cards are visible — they never check the momentum badge text at all. The "Cold" tier requirement is verified in exactly one scenario (the mixed valid+corrupted test at line 289), but none of the pure-corruption tests (missing fields, wrong types, malformed timestamps, bad durations, invalid sessionType) assert the badge renders "Cold". A corrupted session that causes an exception inside `loadCourseMetrics` would leave `momentumMap` empty, the badge would be absent, and these tests would still pass. Fix: add `await expect(page.getByTestId('momentum-badge').first()).toBeVisible()` and `expect(badgeText).toMatch(/cold/i)` to each pure-corruption test (lines 111, 154, 194, 245, 284).

- **`tests/e2e/regression/story-e07-s07.spec.ts:289-331` (confidence: 80)**: The mixed valid+corrupted test asserts the badge shows `/hot|warm|cold/i` rather than specifically `cold`. The AC states corrupted sessions fall back to score 0/"Cold". However, the valid session seeds `FIXED_DATE` as its `startTime`, which — with `mockDateNow` pegged to the same `FIXED_DATE` — produces a recency score near 100. This means the badge will likely show "Hot" or "Warm", not "Cold". The assertion `toMatch(/hot|warm|cold/i)` accepts any tier and therefore does not verify the AC's claim that corrupted sessions fall back to "Cold". The AC intent is that corrupted sessions do NOT inflate the score — the test passes even if corruption were causing phantom "Hot" ratings. Fix: either assert specifically that the corrupted-only course shows "Cold" (seed corrupted sessions for course A only, a valid session for course B, then assert course A badge is "Cold"), or restructure the test to seed corrupted data for a distinct course ID that has no valid sessions.

- **`src/lib/__tests__/momentum.test.ts` (confidence: 78)**: The `isValidSession` guard is the primary AC1/AC2 implementation but has zero unit-test coverage. The guard's three branches (invalid `courseId` type, unparseable `startTime`, non-finite/negative `duration`) are exercised only indirectly through the E2E layer. A regression that breaks any branch would require running a full browser test to detect. Fix: add a `describe('calculateMomentumScore — corrupted session filtering')` block in `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/lib/__tests__/momentum.test.ts` with cases: (a) all-corrupted sessions → score 0, tier cold; (b) mixed valid+corrupted → only valid sessions contribute; (c) NaN duration filtered; (d) non-string courseId filtered; (e) invalid timestamp filtered. `isValidSession` is currently unexported, but `calculateMomentumScore` accepts raw sessions, so the behavior is fully testable at the public API boundary.

---

#### Medium

- **`tests/e2e/regression/story-e07-s07.spec.ts` (confidence: 72)**: AC1 requires "no console errors or app crashes occur". None of the six tests attach a `page.on('console', ...)` listener to capture and assert the absence of `console.error` calls. Other regression specs in the codebase do collect console errors (e.g., `tests/e2e/regression/lesson-player-video.spec.ts:252-255`). The `Courses.tsx` catch block at line 128 calls `console.error('[Courses] Failed to load course metrics:', err)` — if corruption triggers that branch, the test passes (page heading visible) but the error is swallowed silently. Fix: add a `consoleErrors: string[]` collector with `page.on('console', ...)` at the start of each test and assert `consoleErrors.filter(e => e.includes('[Courses]')).length === 0` at the end. A `console.warn` from momentum is acceptable per AC; a `console.error` from Courses is not.

- **`tests/e2e/regression/story-e07-s07.spec.ts:334-360` (confidence: 70)**: AC3 (navigation with corrupted data) only tests navigation to Overview and My Class. The AC reads "Overview, My Class, Courses, etc." — navigating back to Courses (which re-triggers `loadCourseMetrics`) and to Reports/Settings would strengthen confidence. Currently the post-navigation assertions also rely on heading text (`/learning studio/i`, `/my progress/i`) which are stable, but the Courses round-trip is the highest-risk path given that is where the corrupted data was loaded. Fix: after asserting My Class, navigate back to Courses and verify the heading and at least one course card are still visible.

- **`tests/e2e/regression/story-e07-s07.spec.ts` (confidence: 65)**: Cleanup is performed inline via `await indexedDB.clearStore(STORE_NAME)` at the end of each test body rather than in an `afterEach` hook. If a test fails before reaching `clearStore`, corrupted records remain in the IndexedDB and can leak into the next test. The `indexedDB` fixture auto-cleans only `seededIds` tracked via `seedImportedCourses`, not records inserted by the local `seedCorruptedSessions` helper. Fix: add a `test.afterEach` that calls `indexedDB.clearStore(STORE_NAME)` unconditionally at the describe-block level, and remove the inline calls.

---

#### Nits

- **Nit `tests/e2e/regression/story-e07-s07.spec.ts:81`** (confidence: 55): The module-level `const STORE_NAME = 'studySessions'` duplicates the IndexedDB store name string from `indexeddb-fixture.ts`. Consider importing a shared constant or at minimum co-locating it with the helper functions at the top of the file.

- **Nit `tests/e2e/regression/story-e07-s07.spec.ts:114`** (confidence: 50): `page.locator('[data-testid^="course-card-"]').first()` uses a CSS prefix selector. This is stable if the `data-testid` convention is consistent, but `page.getByTestId` with the exact ID of the first known course would be more expressive. Minor — acceptable for the current purpose.

- **Nit `src/lib/__tests__/momentum.test.ts`** (confidence: 50): The helper `makeSession` calls `Date.now()` at call-time to compute `startTime`. This means tests run at different times will produce different recency scores, which is why several tests use relative comparisons (`toBeGreaterThan`) rather than exact values. This is pre-existing — not introduced by E07-S07 — but worth noting as a lurking flakiness source if time-sensitive boundary tests are added later.

---

### Edge Cases to Consider

- **Corrupted session with valid `courseId` but corrupted `startTime` seeded for a course that has 0% completion**: The `isValidSession` guard will reject it, producing score 0 / "Cold". No test verifies the badge for this case in isolation (only the heading is checked in the malformed-timestamps test at line 159).

- **`studySessions` store missing entirely in IndexedDB** (first app load before any session is recorded): `db.studySessions.toArray()` would return an empty array, not throw. Not a corruption scenario, but worth confirming `indexedDB.clearStore` at end-of-test does not prevent the store from being re-opened in a subsequent test — the fixture's `clearAllFromStore` clears records but does not delete the store, so this is fine.

- **Concurrent page reload while `seedCorruptedSessions` write transaction is in flight**: The spec seeds then reloads, but there is no `await` confirming the IDB transaction committed before `page.reload()` fires. In practice the `tx.oncomplete` promise resolves before `page.evaluate` returns, so the sequence is safe — but the pattern is worth noting for future test authors.

- **`StudyScheduleWidget` with corrupted sessions**: The type-guard added at `StudyScheduleWidget.tsx:41` (`typeof s.courseId === 'string' && s.courseId === course.id`) is only exercised when `completionPercent > 0 && completionPercent < 100` for some course, which requires an in-progress course. The E2E tests start from a fresh database (no study log), so no course is "active" and `buildActiveCoursesWithMomentum` returns an empty array. The guard is never exercised by the current spec. A targeted unit test for `buildActiveCoursesWithMomentum` (or an E2E scenario where a course has partial progress) would close this gap.

- **`NaN` stored in IndexedDB**: The Playwright `page.evaluate` serializes `NaN` as `null` during the structured-clone transfer. The test at line 219 seeds `duration: NaN`, but after structured-clone serialisation it arrives in the browser as `null`. `isValidSession` checks `typeof s.duration !== 'number'` — `typeof null === 'object'`, so the guard still rejects it correctly, but for a different reason than intended. The test is valid, but the comment "Not a number" is slightly misleading.

---

ACs: 2.5 covered / 3 total | Findings: 8 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 2
