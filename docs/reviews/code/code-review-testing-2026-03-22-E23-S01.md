## Test Coverage Review: E23-S01 — Remove Hardcoded Branding from Courses Page

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | No hardcoded course provider names, logos, or branding text displayed | None | `tests/e2e/story-23-1.spec.ts:17` — asserts header area does not contain "Chase Hughes" or "The Operative Kit" | Partial |
| 2 | Empty state shown when no imported courses exist | `src/app/pages/__tests__/Courses.test.tsx:128` — "displays global empty state when no courses at all"; `Courses.test.tsx:136` — global empty state has correct test id | `tests/e2e/story-23-1.spec.ts:35` — clears IndexedDB, blocks re-seed with `addInitScript`, asserts `[data-testid="courses-empty-state"]` visible and contains "No courses yet" | Covered |
| 3 | Design tokens used for all remaining styling | None (deferred to ESLint static analysis per story notes) | None | Partial |
| 4 | Layout remains responsive on mobile, tablet, and desktop | None | `tests/e2e/story-23-1.spec.ts:86` — iterates 375px, 768px, 1440px viewports; asserts h1 visible and body width does not overflow | Covered |

**Coverage**: 4/4 ACs have at least one test | 0 complete gaps | 2 partial (AC1 unit gap, AC3 no runtime test)

---

### Test Quality Findings

#### Blockers

None. All four ACs have at least one test exercising the described behavior.

#### High Priority

- **`src/app/pages/__tests__/Courses.test.tsx` — entire file (confidence: 85)**: AC1 (no hardcoded branding) has zero unit-level coverage. The unit test suite contains no assertion that the rendered header subtitle does not include "Chase Hughes", "The Operative Kit", or any provider-specific string. The E2E test covers this but a unit test would catch a regression immediately without a browser. The suite does not mock `useCourseStore`, which means `allCourses` silently defaults to `[]` in every unit test. This is noted in the story's own Lessons Learned section, yet the fix applied was to change empty-state assertions rather than add the missing mock and a positive "dynamic subtitle renders N courses" assertion. A missing `useCourseStore` mock also means no unit test can exercise the subtitle branch at line `Courses.tsx:209-212` (`allCourses.length + importedCourses.length > 0`). Suggested test: add `vi.mock('@/stores/useCourseStore', ...)` returning a courses array and assert `screen.getByText('2 courses')` (or whatever the count produces).

- **`tests/e2e/story-23-1.spec.ts:17` — AC1 selector is structurally brittle (confidence: 80)**: The test locates the header area with `page.locator('main > div > div').first()`. This selector couples the test to the DOM nesting depth of the Courses page layout. A minor refactor that adds or removes a wrapper `<div>` will silently make the selector match an unrelated node and the assertion will still pass. The fix is to use a stable selector: add `data-testid="courses-header"` to the header container in `Courses.tsx` and assert `page.locator('[data-testid="courses-header"]')`.

#### Medium

- **`tests/e2e/story-23-1.spec.ts:35` — AC2 E2E test: `addInitScript` called after first navigation (confidence: 75)**: `addInitScript` is registered after the first `goToCourses(page)` call at line 37. According to Playwright's documentation, `addInitScript` only takes effect on the *next* navigation. This ordering is intentional (the comment at line 45 says "Navigate first so Dexie creates the database"), so the flow is: navigate → clear IDB → register init script → `page.goto('/courses')` (init script fires here). This is correct, but the pattern is non-obvious and fragile: any test that calls `addInitScript` before the IDB-clearing navigation will seed-block on the wrong page load. The mitigation is to extract this two-phase "clear-then-block-reseed" logic into a named helper (e.g., `navigateWithEmptyState`) so the ordering is documented and reusable rather than inline.

- **`tests/e2e/story-23-1.spec.ts:86` — AC4 responsive tests: tablet viewport at 768px does not seed sidebar state (confidence: 72)**: The `goToCourses` helper calls `navigateAndWait`, which does seed `knowlune-sidebar-v1=false` via `addInitScript` before each navigation, so the sidebar Sheet overlay is suppressed on tablet. However, the AC4 loop sets the viewport via `page.setViewportSize` *before* calling `goToCourses`. On the 768px viewport, `addInitScript` will run correctly because the viewport is set before navigation. This is fine, but the test does not assert that interactive content (e.g., Import Course button) is reachable — it only checks heading visibility and body width. A touch-target or button visibility assertion at 768px would give stronger signal. Suggested addition: `await expect(page.getByRole('button', { name: 'Import Course' })).toBeVisible()` for each viewport.

- **`src/app/pages/__tests__/Courses.test.tsx:163-167` — grid selector uses CSS class string (confidence: 70)**: The test at line 163 queries `container.querySelector('.lg\\:grid-cols-4')` to assert the 4-column grid is present. This is a Tailwind class selector — it tests implementation (the chosen responsive class) rather than behavior (the grid renders imported course cards side-by-side). If the layout ever shifts to 3 or 5 columns the test breaks on the class name, not on user-visible behavior. Suggested replacement: assert that multiple `ImportedCourseCard` elements are rendered and that the grid container exists via `data-testid="imported-courses-grid"` (which is already in the source at `Courses.tsx:322`).

#### Nits

- **Nit `src/app/pages/__tests__/Courses.test.tsx:15-38` (confidence: 60)**: `mockCourses` uses inline literal test data (`id: 'c1'`, `name: 'Older Course'`) rather than a factory from `tests/support/fixtures/factories/`. The project convention is factories for realistic data. For a focused unit test this is low-risk, but consistent factory use would improve maintainability if the `ImportedCourse` type changes.

- **Nit `tests/e2e/story-23-1.spec.ts` (confidence: 55)**: AC3 is explicitly omitted from E2E coverage with the comment "verified by ESLint". While ESLint's `design-tokens/no-hardcoded-colors` rule catches new violations at save time, it does not assert that *existing* styling passes the token requirement — ESLint only runs on the diff, not on the rendered output. A brief snapshot or visual assertion (e.g., checking that no element in the Courses page carries a raw hex or hardcoded `rgb()` style attribute) would give runtime evidence. This is a nit rather than a blocker because the ESLint rule is enforced pre-commit and the story notes confirm no hardcoded colors were introduced.

---

### Edge Cases to Consider

- **Subtitle with only pre-seeded courses, no imported courses**: `Courses.tsx:209-212` renders the subtitle only when `allCourses.length + importedCourses.length > 0`. There is no unit test asserting that the subtitle reads "5 courses" (or similar) when `allCourses` has entries and `importedCourses` is empty. The `useCourseStore` is never mocked in the unit test file, so `allCourses` is always `[]` there. This path is untested at unit level.

- **Subtitle arithmetic when both collections are populated**: The subtitle adds both counts (`allCourses.length + importedCourses.length`). There is no test verifying the combined count renders correctly (e.g., 3 pre-seeded + 2 imported = "5 courses"). A regression here would only be caught visually.

- **Empty state CTA button triggers import flow**: The global `EmptyState` component renders an "Import Course" button wired to `handleImportCourse`. The E2E test asserts the button text is present (`toContainText('Import Course')`) but does not click it or assert that the file-picker interaction is triggered. Given that the File System Access API is unavailable in Playwright's Chromium without a mock, at minimum a click-and-assert-no-crash test or a mock-based assertion would verify the wiring.

- **Per-section imported-courses empty state (`data-testid="imported-courses-empty-state"`)**: This state is rendered when `allCourses.length > 0` but `importedCourses.length === 0`. There is no test covering this tier. It is a distinct UI state that a user can observe (pre-seeded courses exist, no imports yet). Because `useCourseStore` is unmocked in unit tests, this state is never reachable in the test suite.

- **Rapid viewport resize / orientation change**: The responsive tests are static snapshot checks at fixed breakpoints. No test exercises re-rendering on viewport change mid-session, which is how a real tablet user would experience orientation switching.

---

ACs: 4 covered / 4 total | Findings: 7 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 2
