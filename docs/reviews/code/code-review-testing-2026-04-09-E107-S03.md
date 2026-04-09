# Test Coverage Review: E107-S03 — Fix TOC Loading and Fallback

**Date:** 2026-04-09
**Branch:** `feature/e107-s03-fix-toc-loading-and-fallback`
**Reviewer:** Test Coverage Agent (Opus)

---

## 1. Summary

Test coverage for E107-S03 is **solid overall**, with good unit test coverage for the two new component behaviors (loading state in TableOfContents, chapter fallback in ReaderHeader) and E2E tests covering all five acceptance criteria. The test infrastructure addition (`createMinimalEpub`, `enableTestMode`, `seedBooks` helper) is well-designed. There are a few meaningful gaps in edge-case coverage and one E2E anti-pattern worth addressing.

**Overall Assessment:** 7/10 — Good coverage of the happy paths and primary fallback scenarios. Missing some error-path and boundary-condition tests that could catch regressions.

---

## 2. AC-to-Test Traceability

| AC | Description | Unit Tests | E2E Tests | Coverage |
|----|-------------|------------|-----------|----------|
| AC-1 | TOC loading state tracked and displayed | `TableOfContents.test.tsx` lines 58-79 (3 tests) | `story-107-03.spec.ts` line 136 (1 test) | Good |
| AC-2 | Empty TOC displays user-friendly message | `TableOfContents.test.tsx` lines 82-105 (3 tests) | `story-107-03.spec.ts` line 155 (1 test) | Good |
| AC-3 | TOC timeout falls back to empty state | None directly (timeout is in BookReader, not unit-tested) | `story-107-03.spec.ts` line 167 (1 test) | Partial |
| AC-4 | Chapter tracking falls back to progress percentage | `ReaderHeader.test.tsx` lines 30-89 (7 tests) | `story-107-03.spec.ts` lines 196, 209 (2 tests) | Strong |
| AC-5 | TOC panel button remains enabled but shows empty state | Not explicitly unit-tested (ReaderHeader tests verify button rendering) | `story-107-03.spec.ts` line 225 (1 test) | Adequate |

---

## 3. Critical Gaps (Rating 8-10)

### 3.1 Missing: TOC timeout logic unit test (Rating: 8/10)

**File:** `src/app/pages/BookReader.tsx` (lines 131-139)

The 5-second timeout effect in BookReader is the core mechanism for AC-3, but it has **no direct unit test**. The timeout effect:

```typescript
useEffect(() => {
  const timeoutId = setTimeout(() => {
    if (isTocLoading) {
      setIsTocLoading(false)
    }
  }, 5000)
  return () => clearTimeout(timeoutId)
}, [isTocLoading])
```

The E2E test at `story-107-03.spec.ts:167` covers this scenario but relies on a 6-second `waitForTimeout` and a `__TEST_TOC_TIMEOUT__` flag that is never consumed by the application code (dead flag -- no code path checks it). This means the E2E test may be testing the timeout only indirectly.

**Regression it would catch:** If someone changes the timeout duration or breaks the `if (isTocLoading)` guard, nothing would fail fast. A unit test using `vi.useFakeTimers()` would catch this in milliseconds rather than seconds.

**Suggested test:**
```
describe('TOC timeout fallback', () => {
  it('sets isTocLoading to false after 5 seconds if TOC never loads', () => {
    vi.useFakeTimers()
    render(<BookReader />)
    // No tocChanged callback fired
    vi.advanceTimersByTime(5000)
    expect(screen.queryByTestId('toc-loading')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
```

**Note:** Testing BookReader directly may be impractical due to heavy dependencies. An alternative is extracting the timeout hook into a testable `useTocTimeout(isLoading: boolean, onTimeout: () => void)` hook.

### 3.2 Missing: `handleTocLoaded` clears loading state (Rating: 8/10)

**File:** `src/app/pages/BookReader.tsx` (lines 478-485)

The `handleTocLoaded` callback calls `setIsTocLoading(false)` when TOC arrives. This is a critical line -- if removed, the loading spinner would persist until the 5-second timeout, creating a confusing UX. There is no test verifying this specific interaction.

**Regression it would catch:** If a refactor removes `setIsTocLoading(false)` from `handleTocLoaded`, the loading state would only clear after 5 seconds, even when TOC loads instantly. Users would see a spinner for 5 seconds on every book open.

---

## 4. Important Improvements (Rating 5-7)

### 4.1 Dead test flag `__TEST_TOC_TIMEOUT__` (Rating: 7/10)

**File:** `tests/e2e/story-107-03.spec.ts` (lines 171-174)

The AC-3 E2E test sets `(window).__TEST_TOC_TIMEOUT__ = true` but nothing in the application code checks this flag. The test works only because the book has no TOC (empty chapters array), and the timeout naturally fires. The flag creates a false sense of coverage -- the test appears to be testing a "simulated timeout" but is actually just testing the empty-TOC path.

**Fix:** Either remove the dead flag and rely on the empty-TOC scenario (which already triggers the timeout), or wire the flag into BookContentService to actually simulate a slow/never-resolving TOC load.

### 4.2 Missing: `readingProgress` boundary values (Rating: 6/10)

**File:** `src/app/components/reader/__tests__/ReaderHeader.test.tsx`

The unit tests cover 0%, 25%, 33.4%, 50%, and 100% progress values. Missing boundaries:
- `readingProgress = -0.001` (negative value) -- would display "-0%"
- `readingProgress = 1.001` (over 100%) -- would display "100%" via Math.round but could be confusing
- `readingProgress = NaN` -- would display "NaN%"

These matter because `readingProgress` comes from a Zustand store computed from epub.js location data, which could produce unexpected values during EPUB parsing errors.

### 4.3 Missing: Loading state takes priority over empty TOC (Rating: 6/10)

**File:** `src/app/components/reader/__tests__/TableOfContents.test.tsx`

The tests verify:
- `isLoading=true, toc=[]` shows loading (line 59)
- `isLoading=false, toc=[]` shows empty message (line 67)
- `isLoading=false, toc=[...]` shows items (line 74)

Missing scenario: `isLoading=true, toc=[...]` (TOC data already present but still loading). This could happen if `handleTocLoaded` fires before the timeout clears but there is a race with a re-render. The component's three-way conditional (line 115-138) prioritizes `isLoading` over `toc`, which is correct behavior, but this ordering is untested.

### 4.4 Missing: `createMinimalEpub` unit test (Rating: 5/10)

**File:** `src/services/__tests__/minimalEpub.ts`

The `createMinimalEpub` function is a new test infrastructure utility placed in `__tests__/` but it has no self-test. If the generated EPUB structure becomes invalid (e.g., missing mimetype, wrong ZIP ordering), E2E tests would fail with confusing epub.js errors rather than a clear assertion failure.

**Suggested test:** Verify the output is a valid ZIP containing required EPUB files (mimetype, META-INF/container.xml, etc.). This could use JSZip to load the output and assert structure.

### 4.5 E2E test uses `waitForTimeout` multiple times (Rating: 5/10)

**File:** `tests/e2e/story-107-03.spec.ts`

Per the project's test-patterns rule, `waitForTimeout` should be avoided. This test uses it at:
- Line 98: `await page.waitForTimeout(500)` -- dismiss dialogs
- Line 100: `await page.waitForTimeout(200)` -- after Escape press
- Line 120: `await page.waitForTimeout(200)` -- after Escape press
- Line 182: `await page.waitForTimeout(6000)` -- wait for timeout
- Lines 281, 284: `waitForTimeout(100)` -- rapid toggle timing
- Line 302: `await page.waitForTimeout(50)` -- between arrow key presses

The 6-second wait (line 182) is particularly problematic for test performance. The dialog dismiss waits (lines 98, 100, 120) should use `waitFor` on element state instead. The 100ms waits in rapid-toggle tests are justified and acceptable.

---

## 5. Test Quality Observations

### 5.1 Good: Unit tests test behavior, not implementation

The `ReaderHeader.test.tsx` tests verify visible output (text content, CSS classes, DOM presence) rather than internal state. The `TableOfContents.test.tsx` tests follow the same pattern. This makes tests resilient to refactoring.

### 5.2 Good: Shared helper usage

The E2E tests correctly use `seedBooks` from `tests/support/helpers/indexeddb-seed.ts` instead of duplicating IndexedDB seeding logic. This follows the project's test-patterns rule.

### 5.3 Good: Deterministic time handling

E2E tests import `FIXED_DATE` from `tests/utils/test-time.ts` for test data timestamps. No `Date.now()` or `new Date()` in test code.

### 5.4 Concern: Test mode infrastructure in production code (Rating: 5/10)

**Files:** `src/main.tsx` (lines 6-17), `src/services/BookContentService.ts` (lines 29-73)

The test mode infrastructure (module-level `TEST_MODE` variable, `enableTestMode()`, `__enableBookContentTestMode__` window function, `__BOOK_CONTENT_TEST_MODE__` flag check) is now part of the production bundle. While the runtime cost is minimal (a boolean check and a dynamic import), this pattern introduces:

1. A `console.log` in production when test mode activates (line 38 of BookContentService)
2. A window function that persists in production builds
3. The `createMinimalEpub` import pulls JSZip into the test-mode code path

The code uses dynamic `import()` in `main.tsx` which helps with tree-shaking, but the `import` at the top of `BookContentService.ts` (line 17) is static and will include JSZip in the bundle. The commit message `44b20c13` mentions moving JSZip to devDependencies, but the static import means it will still be bundled when referenced.

**Note:** This is a code review concern more than a test coverage concern, but it affects test reliability -- if the JSZip dependency is missing in CI, tests would fail in confusing ways.

### 5.5 Minor: `null as unknown as Rendition` type casting (Rating: 3/10)

**File:** `src/app/components/reader/__tests__/TableOfContents.test.tsx` (line 130)

The test for "rendition is null" uses `null as unknown as Rendition` which is a TypeScript anti-pattern. A cleaner approach would use `as unknown` first, then `as Rendition`, or define the type explicitly. This is cosmetic and does not affect test correctness.

---

## 6. Positive Observations

1. **Comprehensive AC-4 coverage**: The ReaderHeader unit tests thoroughly cover the chapter-to-progress fallback with 7 distinct scenarios (provided chapter, empty string, undefined, rounding, boundaries, both unavailable, preference order). This is the most user-facing behavior and it is well-protected.

2. **Accessibility testing**: Both unit test files verify ARIA attributes (`aria-label`, `aria-hidden`, `role="dialog"`, `role="list"`, `aria-current`). The E2E tests also check `toBeEnabled()` on interactive elements.

3. **Edge case E2E tests**: The "Edge Cases" section (lines 272-314) tests rapid panel open/close and concurrent navigation during TOC loading. These are valuable stress tests that catch race conditions.

4. **Clean separation of concerns**: Unit tests focus on component behavior with mocked dependencies. E2E tests focus on integration. No overlap or redundancy between the two layers.

5. **Test infrastructure reuse**: The `seedBooks` helper was added to the shared helpers file rather than being local to this test file. Future reader E2E tests can reuse it.

---

## 7. Recommendations Summary

| # | Finding | Rating | Action |
|---|---------|--------|--------|
| 1 | TOC timeout logic has no unit test | 8 | Add test with fake timers or extract hook |
| 2 | `handleTocLoaded` clearing loading state is untested | 8 | Add test verifying spinner disappears on TOC arrival |
| 3 | Dead `__TEST_TOC_TIMEOUT__` flag in E2E test | 7 | Remove or wire into application code |
| 4 | `readingProgress` boundary values (NaN, negative) | 6 | Add 2-3 boundary tests to ReaderHeader.test.tsx |
| 5 | `isLoading=true` with non-empty TOC is untested | 6 | Add test for loading-priority-over-data behavior |
| 6 | `createMinimalEpub` has no self-validation | 5 | Add unit test verifying EPUB structure |
| 7 | Multiple `waitForTimeout` in E2E tests | 5 | Replace with element-state waits where possible |
| 8 | Test mode code in production bundle | 5 | Consider conditional import or build-time exclusion |

**Priority for this PR:** Items 1-3 are worth addressing before merge. Items 4-8 can be addressed as follow-up tech debt without blocking the PR.
