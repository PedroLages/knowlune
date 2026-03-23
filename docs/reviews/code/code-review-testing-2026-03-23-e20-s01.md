## Test Coverage Review: E20-S01 — Career Paths System

### AC Coverage Summary

**Acceptance Criteria Coverage:** 6/6 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=90%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | List view: 3-5 curated paths with title, description, course count, hours, progress % | `loadPaths` seeds >=4 paths (line 64); `getPathProgress` returns % (line 210) | `career-paths.spec.ts` lines 40-68: heading, card count >=3, title+desc, courses+hours | Covered |
| 2 | Detail view: staged progression with course cards per stage | `getStageProgress` / `isStageUnlocked` unit tests (lines 247-320) | `career-paths.spec.ts` lines 74-107: URL contains `/career-paths/`, h1 matches, >=2 "Stage N" labels, back-link | Covered |
| 3 | Path Enrollment: "Start Path" persists to IndexedDB, UI updates to enrolled state | `enrollInPath` Dexie write (line 106); store state update (line 120); no duplicates (line 130); re-activation after drop (line 188) | `career-paths.spec.ts` lines 113-148: button visible, click replaces with "Leave path", survives reload | Covered |
| 4 | Progress Tracking: completed courses show checkmark, overall % updates | `getPathProgress` with completion cache (lines 210-241); `isCourseCompleted` implicit via cache | `career-paths.spec.ts` lines 154-186: progress bar appears on detail when enrolled; progressbar role on list card after enrollment | Partial |
| 5 | Stage Prerequisites: Stage 2+ visually locked, "Complete Stage N to unlock" messaging, locked courses cannot be navigated | `isStageUnlocked` index 0 always true (line 254); index 1 locked when stage 1 incomplete (line 259); unlocks when all Stage 1 courses complete (line 264); partial completion keeps locked (line 276) | `career-paths.spec.ts` lines 192-223: Stage 0 not locked, Stage 2 shows lock message, locked stage has opacity class | Partial |
| 6 | Navigation: "Career Paths" sidebar link, `/career-paths` route, `/career-paths/:pathId` route | None (config-level, no unit test needed) | `career-paths.spec.ts` lines 229-258: sidebar link visible, click navigates, direct URL loads detail, invalid pathId redirects | Covered |

**Coverage**: 6/6 ACs fully covered | 0 hard gaps | 2 partial (AC4, AC5)

---

### Test Quality Findings

#### Blockers (untested ACs)

None — all 6 ACs have at least one test.

#### High Priority

- **`tests/e2e/career-paths.spec.ts:211-222` (confidence: 82)**: The AC5 "locked courses cannot be navigated to" clause is only checked via an opacity CSS class. The test at line 211 reads a `[class*="opacity"]` attribute and asserts it `toContain('opacity')` — this is a CSS implementation detail, not a behavior assertion. A locked course tile rendered without an `<a>` element (or with `aria-disabled`) is the actual contract. There is no assertion that clicking a locked course tile does NOT navigate. Suggested test: `'locked course tile is not a link'` in `career-paths.spec.ts`, scoping to Stage 2's course list with `page.getByRole('list', { name: /Courses in Stage 2/ }).getByRole('link')` and asserting `count()` equals 0, or asserting `getByRole('link', { name: /the locked course name/ })` is not present.

- **`tests/e2e/career-paths.spec.ts:154-186` (confidence: 78)**: AC4 requires completed courses to show a checkmark overlay. Neither E2E test seeds actual `contentProgress` completion records and then asserts the `Check` icon is visible on a specific course tile. The two AC4 E2E tests only assert that a `role="status"` element and a `role="progressbar"` element appear — they never exercise the checkmark overlay path. The unit test at `useCareerPathStore.test.ts:222` covers the percentage calculation correctly but relies on direct cache manipulation, not a full IDB→store→UI round-trip. Suggested test: `'completed course shows checkmark overlay'` using `seedContentProgress` to mark all items for a known course ID as `status: 'completed'`, then reload `/career-paths/:pathId` and assert `page.getByRole('img', { name: /Done/ })` or the `Check` icon is visible on that course's tile.

#### Medium

- **`tests/e2e/career-paths.spec.ts:52-58` (confidence: 72)**: The AC1 "description" assertion at line 57 checks `cardText?.length > 20` — this passes for any card text including title, metadata, and badge text concatenated. It does not verify that a separate description element is rendered. The list-page `PathCard` renders description in a `<p>` tag with `text-sm text-muted-foreground`. Suggested improvement: replace with `await expect(firstCard.locator('p')).not.toBeEmpty()` or add a `data-testid="path-description"` and assert that.

- **`tests/e2e/career-paths.spec.ts:61-68` (confidence: 72)**: The hours metadata selector `getByText(/h$/)` matches the trailing `h` character but is brittle — any text ending in `h` (e.g., a word ending in 'h') would satisfy it. The implementation renders `{path.totalEstimatedHours}h` as a `<span>`. A tighter pattern like `/^\d+h$/` or `getByText(/^\d+h$/)` would be more precise and is unlikely to cause a false pass.

- **`tests/support/fixtures/factories/` (confidence: 68)**: No factory for `PathEnrollment` records exists. The pre-seeded enrollment test at `career-paths.spec.ts:266-286` constructs an enrollment record inline (hardcoded `id`, `pathId`, `enrolledAt`, `status`). This is the exact pattern the factory system exists to prevent. A `path-enrollment-factory.ts` producing realistic enrollment records would make the inline construction unnecessary and catch schema drift when `PathEnrollment` type fields change.

- **`tests/debug/debug-enroll.spec.ts:21` (confidence: 90)**: The debug spec uses `page.waitForTimeout(3000)` — a hard 3-second wait. This file is in `tests/debug/` rather than `tests/e2e/`, suggesting it was a development aid, but it violates the `test-patterns/no-hard-waits` ESLint rule and should be removed before shipping. If it is excluded from the CI run by glob pattern, the risk is low; if not, it will introduce flakiness in slow environments.

- **`src/stores/__tests__/useCareerPathStore.test.ts:278-288` (confidence: 65)**: The `isStageUnlocked` test for "Stage 2 stays locked if only some Stage 1 courses are complete" (line 276) contains an early return via `if (stage1CourseIds.length < 2) return`. If a future seed data change reduces Stage 1 to a single course, this test silently passes without exercising any assertion, hiding a regression. Suggested fix: use `expect(stage1CourseIds.length).toBeGreaterThanOrEqual(2)` at the top of the test so the skip is visible as a test failure rather than a silent pass.

#### Nits

- **Nit `tests/e2e/career-paths.spec.ts:95` (confidence: 55)**: `page.getByText(/^Stage \d/)` could match `<span>` elements inside stage cards as well as other stray text. The Stage label is rendered as a `<span>` with `text-xs font-semibold uppercase`. Since the detail page already has `role="list" aria-label="Learning stages"`, scoping the count to `page.getByRole('list', { name: 'Learning stages' }).getByText(/^Stage \d/)` would be more precise and resilient to layout changes.

- **Nit `tests/e2e/career-paths.spec.ts:216` (confidence: 55)**: `page.getByRole('listitem').filter({ has: page.getByText(/^Stage \d/) })` does not scope to the "Learning stages" list, so it may match listitems from the course list within Stage 1 as well. Add `.locator('[aria-label="Learning stages"] >> [role="listitem"]')` or use the ARIA list approach to restrict scope.

- **Nit `tests/e2e/career-paths.spec.ts:184` (confidence: 50)**: `void href` at line 184 is dead code suppressing an unused-variable lint warning. The `href` variable was used at line 170 but the suppression suggests the test was refactored. The variable can be removed entirely along with the `void` statement.

- **Nit `src/stores/__tests__/useCareerPathStore.test.ts:1` (confidence: 50)**: The unit test file imports `fake-indexeddb/auto` at the module level (line 1). The `beforeEach` clears `db.careerPaths`, `db.pathEnrollments`, and `db.contentProgress` but does NOT clear `db.importedCourses`. The `refreshCourseCompletion` function queries `db.importedCourses` (store line 104). If a prior test populates that table, subsequent `refreshCourseCompletion` calls could see stale data. Low risk given current test structure but worth adding `db.importedCourses.clear()` to `beforeEach`.

---

### Edge Cases to Consider

- **`dropPath` with no active enrollment**: `dropPath` at `useCareerPathStore.ts:162` guards with `if (!enrollment) return` when there is no active enrollment — this silent no-op is not tested. A unit test asserting that calling `dropPath` on an unenrolled path leaves the DB unchanged would document the contract.

- **`refreshCourseCompletion` failure path**: The `catch` block at `useCareerPathStore.ts:113` logs the error but does NOT call `toast.error` and does NOT set `state.error`. If completion refresh silently fails, the UI will show 0% progress indefinitely with no user-visible feedback. No test covers this failure path. Consider a unit test that stubs `db.contentProgress.where` to throw and asserts the store remains consistent.

- **`enrollInPath` DB write failure**: The `enrollInPath` catch block at line 152 calls `toast.error` and re-throws. No test covers what happens when `persistWithRetry` rejects — specifically that the store state is not dirtied (enrollment not added to the array before the throw). The `persistWithRetry` mock at line 6 of the unit test always succeeds; a second mock variant that rejects would close this gap.

- **Enrollment query filter**: `loadPaths` at `useCareerPathStore.ts:56` queries `pathEnrollments.where('status').anyOf(['active', 'completed'])`. An enrollment with status `'dropped'` is excluded from the result. The pre-seeded enrollment E2E test seeds `status: 'active'` correctly, but there is no test that seeds a `'dropped'` enrollment and confirms it does NOT render as enrolled on the detail page.

- **Four paths, no "at most 5" upper-bound assertion**: AC1 states 3-5 curated paths. The seed data contains exactly 4 paths (`CURATED_CAREER_PATHS` has 4 entries). The E2E test at line 49 asserts `count >= 3` but not `count <= 5`. If seed data grows beyond 5 paths, AC1 would silently be violated. A `expect(count).toBeLessThanOrEqual(5)` would document the upper bound.

- **Tablet viewport sidebar visibility**: The `localStorage` fixture does not seed `knowlune-sidebar-v1` to `'false'` before navigating in any AC6 test. On a tablet-width viewport, the sidebar may be collapsed, causing `getByRole('link', { name: 'Career Paths' })` to fail. The AC6 sidebar tests only run at the default (desktop) viewport, so this is currently safe, but adding `page.setViewportSize({ width: 768, height: 1024 })` with the sidebar seed would prevent future regressions if viewport-specific test runs are added.

---

ACs: 6 covered / 6 total | Findings: 10 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 4
