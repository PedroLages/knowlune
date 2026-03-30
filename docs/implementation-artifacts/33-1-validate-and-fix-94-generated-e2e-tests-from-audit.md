---
story_id: E33-S01
story_name: "Validate and Fix the 94 Generated E2E Tests from the Audit"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 33.1: Validate and Fix the 94 Generated E2E Tests from the Audit

## Story

As a developer,
I want the regression test suite generated during the audit to pass reliably,
So that it serves as a baseline for future changes.

## Acceptance Criteria

**AC1: All 5 audit-generated regression specs pass on Chromium**

**Given** the 5 new spec files in `tests/e2e/regression/`:
- `course-overview.spec.ts`
- `learning-path-detail.spec.ts`
- `learning-paths.spec.ts`
- `youtube-course-detail.spec.ts`
- `youtube-lesson-player.spec.ts`
**When** run with `npx playwright test tests/e2e/regression/course-overview.spec.ts tests/e2e/regression/learning-path-detail.spec.ts tests/e2e/regression/learning-paths.spec.ts tests/e2e/regression/youtube-course-detail.spec.ts tests/e2e/regression/youtube-lesson-player.spec.ts`
**Then** all tests pass on Chromium without flakes

**AC2: No hard waits remain**

**Given** any of the 5 audit-generated spec files
**When** inspected
**Then** zero `waitForTimeout()` calls are present
**And** all waits use Playwright's built-in retry mechanisms (`expect().toBeVisible()`, `waitForSelector()`, `waitForFunction()`, or `expect.toPass()`)

**AC3: No fragile CSS class selectors**

**Given** any of the 5 audit-generated spec files
**When** inspected
**Then** zero selectors target Tailwind CSS classes (e.g., `.bg-brand`, `.text-muted-foreground`)
**And** all selectors use `data-testid`, `role`, `getByText()`, `getByLabel()`, or semantic HTML selectors

**AC4: Seeding uses shared helpers**

**Given** any test that requires IndexedDB test data
**When** the seeding logic is inspected
**Then** it uses helpers from `tests/support/helpers/seed-helpers.ts` or `tests/support/helpers/indexeddb-seed.ts`
**And** it uses factory functions from `tests/support/fixtures/factories/`
**And** no manual `indexedDB.open()` + `transaction()` calls exist inline in test files

**AC5: Tests verify meaningful behavior, not just page loads**

**Given** each test case in the 5 spec files
**When** reviewed for assertion quality
**Then** every test has at least one assertion beyond `expect(page).toHaveURL()`
**And** tests verify user-visible behavior (text content, element state, interaction results)
**And** smoke-only tests are enhanced with behavioral assertions

## Tasks / Subtasks

- [ ] Task 1: Audit each of the 5 spec files for anti-patterns (AC: 2, 3, 4, 5)
  - [ ] 1.1 Run `npx eslint tests/e2e/regression/course-overview.spec.ts tests/e2e/regression/learning-path-detail.spec.ts tests/e2e/regression/learning-paths.spec.ts tests/e2e/regression/youtube-course-detail.spec.ts tests/e2e/regression/youtube-lesson-player.spec.ts` to detect `waitForTimeout`, `Date.now()`, manual IDB seeding
  - [ ] 1.2 Manually scan for CSS class selectors (`.bg-*`, `.text-*`, `.border-*`, `.rounded-*`)
  - [ ] 1.3 Catalog each test case and classify as smoke-only vs behavioral
  - [ ] 1.4 Document findings in a tracking checklist before making changes

- [ ] Task 2: Fix `course-overview.spec.ts` (AC: 1-5)
  - [ ] 2.1 Replace all `waitForTimeout()` with deterministic waits
  - [ ] 2.2 Replace CSS class selectors with semantic selectors or `data-testid`
  - [ ] 2.3 Add `data-testid` attributes to source components if needed
  - [ ] 2.4 Replace inline IDB seeding with `seedIndexedDBStore()` and factory functions
  - [ ] 2.5 Enhance smoke-only tests with behavioral assertions (e.g., module list content, progress display)

- [ ] Task 3: Fix `learning-path-detail.spec.ts` (AC: 1-5)
  - [ ] 3.1 Apply same anti-pattern fixes as Task 2
  - [ ] 3.2 Ensure learning path data is seeded via `seedIndexedDBStore()` with appropriate factory
  - [ ] 3.3 Add assertions for path title, course list, progress indicators

- [ ] Task 4: Fix `learning-paths.spec.ts` (AC: 1-5)
  - [ ] 4.1 Apply same anti-pattern fixes
  - [ ] 4.2 Verify list rendering, search/filter behavior, create path flow

- [ ] Task 5: Fix `youtube-course-detail.spec.ts` (AC: 1-5)
  - [ ] 5.1 Apply same anti-pattern fixes
  - [ ] 5.2 Seed YouTube course data using `createImportedCourse()` factory with YouTube-specific fields
  - [ ] 5.3 Add assertions for video list, metadata display, AI summary section

- [ ] Task 6: Fix `youtube-lesson-player.spec.ts` (AC: 1-5)
  - [ ] 6.1 Apply same anti-pattern fixes
  - [ ] 6.2 Mock YouTube iframe or video element as needed
  - [ ] 6.3 Add assertions for player controls, progress tracking, chapter navigation

- [ ] Task 7: Add missing `data-testid` attributes to source components (AC: 3)
  - [ ] 7.1 Add `data-testid` to CourseOverview page elements that tests need to locate
  - [ ] 7.2 Add `data-testid` to LearningPaths/LearningPathDetail elements
  - [ ] 7.3 Add `data-testid` to YouTubeCourseDetail/YouTubeLessonPlayer elements

- [ ] Task 8: Run full validation (AC: 1)
  - [ ] 8.1 Run all 5 spec files together on Chromium
  - [ ] 8.2 Run 3-iteration burn-in to check for flakes
  - [ ] 8.3 Fix any remaining failures

## Implementation Notes

**Existing test infrastructure:**
- Seeding helpers: `tests/support/helpers/seed-helpers.ts`, `tests/support/helpers/indexeddb-seed.ts`
- Factory functions: `tests/support/fixtures/factories/` (course, session, content-progress, imported-course, note, challenge, quiz, review)
- Constants: `tests/support/fixtures/constants/sidebar-constants.ts`
- Navigation helpers: `tests/support/helpers/navigation.ts`

**Files to modify:**
- `tests/e2e/regression/course-overview.spec.ts`
- `tests/e2e/regression/learning-path-detail.spec.ts`
- `tests/e2e/regression/learning-paths.spec.ts`
- `tests/e2e/regression/youtube-course-detail.spec.ts`
- `tests/e2e/regression/youtube-lesson-player.spec.ts`
- Various `src/` components to add `data-testid` attributes

**Selector replacement strategy:**
| Old (fragile) | New (resilient) |
|---|---|
| `.bg-brand` | `[data-testid="..."]` or `getByRole()` |
| `.text-muted-foreground` | `getByText()` with content match |
| `div.rounded-xl` | `getByTestId()` or semantic role |
| `.hover\:bg-brand-hover` | Never select by hover state |

**Wait replacement strategy:**
| Old (non-deterministic) | New (deterministic) |
|---|---|
| `waitForTimeout(1000)` | `expect(locator).toBeVisible()` |
| `waitForTimeout(500)` | `waitForSelector('[data-testid="..."]')` |
| `waitForTimeout(2000)` | `expect.toPass({ timeout: 5000 })` |

## Testing Notes

This story is meta-testing: we are fixing tests, not writing new features. The "tests" for this story are the fixed spec files themselves.

**Validation approach:**
1. Run each fixed spec file individually first to isolate failures
2. Run all 5 together to check for cross-file interference
3. Run 3-iteration burn-in: `for i in {1..3}; do npx playwright test tests/e2e/regression/course-overview.spec.ts tests/e2e/regression/learning-path-detail.spec.ts tests/e2e/regression/learning-paths.spec.ts tests/e2e/regression/youtube-course-detail.spec.ts tests/e2e/regression/youtube-lesson-player.spec.ts; done`
4. ESLint rules `test-patterns/no-hard-waits` and `test-patterns/use-seeding-helpers` should pass with zero violations

**Known risks:**
- YouTube player tests may need iframe mocking strategy since real YouTube embeds require network access
- Learning path tests may require seeding `useLearningPathStore` data which may not have an existing factory -- create one if needed
- Some audit-generated tests may be completely non-functional (never ran against real app) and need full rewrites

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document during implementation]
