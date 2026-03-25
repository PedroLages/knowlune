# Test Coverage Review: E23-S05 — De-emphasize Pre-seeded Courses

**Date**: 2026-03-23
**Branch**: feature/e23-s05-de-emphasize-pre-seeded-courses
**Reviewer**: Claude Code (code-review-testing agent)

---

## AC Coverage Summary

**E2E Coverage**: 6/6 ACs tested via `tests/e2e/story-e23-s05.spec.ts` — all 23 E2E tests pass.
**Unit Coverage**: Unit tests exist in `src/app/pages/__tests__/Courses.test.tsx` but are incomplete.

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Pre-seeded section "Sample Courses", collapsible, collapsed by default when imports exist | Heading & grid visible ✓; collapsed-by-default ✗ | Tests 1-3 (lines 31-58) ✓ | **Partial** |
| 2 | Imported courses section appears first | None | Test 4 (lines 65-83): boundingBox Y comparison ✓ | **Covered (E2E)** |
| 3 | Overview pre-seeded courses reduced opacity when imports exist | None | Test 5 (lines 89-105): `toHaveCSS('opacity', '0.6')` ✓ | **Covered (E2E)** |
| 4 | Overview full opacity when no imports | None | Test 6 (lines 111-121) ✓ | **Covered (E2E)** |
| 5 | Collapse state persists to localStorage | None | Test 7 (lines 127-148): navigate away + back ✓ | **Partial (no unit)** |
| 6 | Responsive layout at 375px, 768px, 1440px | None | Tests 8-10 (lines 155-175): scroll-width check ✓ | **Partial (overflow only)** |

---

## Test Quality Findings

### High

**H1: AC1 — "Collapsed by default when imports exist" has no unit-level assertion**
- **Location**: `src/app/pages/__tests__/Courses.test.tsx` (sample courses section describe block)
- **Confidence**: 92
- **Gap**: None of the 5 unit tests set `storeState.importedCourses = mockCourses` then assert `sample-courses-grid` is absent. The logic lives in a `useEffect` at `Courses.tsx:70-76` which is testable with RTL `act()`.
- **Suggested test**: `"sample courses section is collapsed by default when imported courses exist"` — render with `storeState.importedCourses = mockCourses`, await effect, assert `queryByTestId('sample-courses-grid')` is not in document.

**H2: AC5 — localStorage persistence has zero unit coverage**
- **Location**: Missing from `src/app/pages/__tests__/Courses.test.tsx`
- **Confidence**: 90
- **Gap**: No test verifies `localStorage.setItem('knowlune:sample-courses-collapsed', 'true')` is called on toggle, or that a stored `'true'` value initializes the component collapsed.
- **Suggested tests**: `"persists collapse state to localStorage on toggle"` and `"reads collapse state from localStorage on mount"`.

**H3: AC4 E2E test uses brittle CSS `:has` + `:text` pseudo-selector**
- **Location**: `tests/e2e/story-e23-s05.spec.ts:116`
- **Confidence**: 85
- **Issue**: `page.locator('section:has(h2:text("Your Library"))')` breaks on any whitespace change, element type change, or i18n update.
- **Fix**: Add `data-testid="library-section"` to the `<motion.section>` in `Overview.tsx:319` and update the locator.

**H4: AC6 responsive tests missing sidebar state seed at 768px**
- **Location**: `tests/e2e/story-e23-s05.spec.ts:161-174`
- **Confidence**: 82
- **Issue**: At 768px tablet viewport, the sidebar defaults open and renders as a full-screen Sheet overlay blocking interaction. The `localStorage.setItem('knowlune-sidebar-v1', 'false')` pattern is not applied.
- **Fix**: Add `await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))` before `goToCourses(page)` in the AC6 viewport loop.

### Medium

**M1: No combined render test for both sections simultaneously**
- **Location**: `src/app/pages/__tests__/Courses.test.tsx`
- **Confidence**: 72
- **Gap**: All unit tests test sections in isolation. No test renders with both `importedCourses` populated AND `allCourses` populated simultaneously — the primary user-facing behavior.

**M2: AC2 DOM-order test uses `boundingBox()` without null guard**
- **Location**: `tests/e2e/story-e23-s05.spec.ts:81`
- **Confidence**: 70
- **Issue**: Non-null assertion `!` on `boundingBox()` results. Off-screen elements return `null`.

### Nits

- **N1**: `SAMPLE_IMPORTED_COURSE` inline object — project pattern uses factories from `tests/support/fixtures/factories/`.
- **N2**: `Courses.test.tsx:196-200` — class-name selector `.lg\\:grid-cols-4` is brittle if breakpoints change.
- **N3**: `courseStoreState.isLoaded` is never set to `true` in some test setups — verify this doesn't mask behavior.
- **N4**: Edge cases not tested: (1) user removes all imported courses (localStorage stays collapsed), (2) user rapidly toggles, (3) empty search within collapsed section.

---

## Edge Cases to Consider

1. **Auto-collapse fires only once**: `stored === null && importedCourses.length > 0`. If user manually expands then imports a second course, the section should stay expanded (their preference is stored). Currently untested.
2. **Removing all imported courses**: `importedCourses.length` becomes 0, but `COLLAPSE_KEY` remains `'true'`. Section stays collapsed. No test covers this state transition.
3. **Empty search within collapsible section**: When search filters all pre-seeded courses to zero results, "No courses match your search" renders. Untested.

---

**ACs covered by E2E**: 6/6 | **ACs with unit coverage**: partial | **E2E tests passing**: 23/23
