---
story_id: E20-S01
story_name: "Career Paths System"
status: done
started: 2026-03-23
completed: 2026-03-23
reviewed: true
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, edge-case-review]
burn_in_validated: false
---

# Story 20.1: Career Paths System

## Story

As a learner without a clear learning direction,
I want to enroll in curated multi-course learning paths (e.g., "Web Development", "Data Science"),
so that I have a structured journey with prerequisites and skill progression tracking.

## Acceptance Criteria

**AC1: Career Paths List View**
Given the user navigates to the Career Paths page
When the page loads
Then 3-5 curated paths are displayed, each showing title, description, course count, estimated hours, and progress %

**AC2: Career Path Detail View**
Given the user clicks on a career path
When the detail page loads
Then staged progression is displayed (Stage 1: Foundations, Stage 2: Frameworks, etc.) with course cards per stage

**AC3: Path Enrollment**
Given the user is viewing a path detail page and is not enrolled
When the user clicks "Start Path"
Then the enrollment is persisted to IndexedDB
And the UI updates to show enrolled state

**AC4: Progress Tracking**
Given the user is enrolled in a path
When they complete courses within the path
Then completed courses show a checkmark overlay
And the overall path progress % updates accordingly

**AC5: Stage Prerequisites**
Given a path has multiple stages
When Stage 1 is not yet complete
Then Stage 2 courses are visually locked with clear messaging ("Complete Stage 1 to unlock")
And locked courses cannot be navigated to

**AC6: Navigation Integration**
Given the Career Paths feature is available
When the user views the sidebar
Then a "Career Paths" link appears in the Learn navigation group
And the route `/career-paths` loads the list page
And the route `/career-paths/:pathId` loads the detail page

## Tasks / Subtasks

- [ ] Task 1: Define TypeScript types for CareerPath, PathStage, PathEnrollment (AC: all)
- [ ] Task 2: Add Dexie schema v20 with careerPaths + pathEnrollments tables (AC: 3, 4)
- [ ] Task 3: Create seed data for 3-5 curated paths (AC: 1, 2)
- [ ] Task 4: Create useCareerPathStore Zustand store (AC: 1-5)
- [ ] Task 5: Create CareerPaths list page (AC: 1, 6)
- [ ] Task 6: Create CareerPathDetail page with stages (AC: 2, 3, 5)
- [ ] Task 7: Implement enrollment + progress tracking logic (AC: 3, 4)
- [ ] Task 8: Add routes and sidebar navigation (AC: 6)
- [ ] Task 9: Create E2E tests (AC: all)
- [ ] Task 10: Add IndexedDB seed helpers for tests

## Design Guidance

- **List View**: Card grid similar to Courses page — responsive 1/2/3 columns
- **Detail View**: Vertical stage timeline with course cards per stage
- **Locked stages**: Reduced opacity + lock icon + tooltip message
- **Progress**: Progress bar on path cards + checkmark overlays on completed courses
- **Design tokens**: Use `bg-brand-soft`, `text-brand-soft-foreground`, `bg-muted` for locked states
- **Brand buttons**: `variant="brand"` for "Start Path" CTA
- **Animations**: Use `motion/react` with `fadeUp` / `staggerContainer` from `src/lib/motion.ts`

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

**Plan**: [e20-s01-career-paths-system.md](plans/e20-s01-career-paths-system.md)

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

Full report: `docs/reviews/design/design-review-2026-03-23-e20-s01.md`

**Fixed (HIGH):**
- "Leave path" button was `size="sm"` = 32px height, below 44px WCAG touch target — removed `size="sm"`
- Stage metadata rendered `{completedCourses}/{totalCourses}` and `{hours}h` in adjacent divs, visually ambiguous as "0/28h" — added "courses" unit label

**Remaining (MEDIUM — follow-up):**
- `aria-disabled` on plain `<div>` (locked CourseTile) has no effect on AT; should add `role` or use visually-hidden description
- "Start learning" badge border has 1.20:1 contrast in dark mode — badge boundary invisible

## Code Review Feedback

Full report: `docs/reviews/code/code-review-2026-03-23-e20-s01.md` | Test coverage: `docs/reviews/code/code-review-testing-2026-03-23-e20-s01.md`

**Fixed (HIGH):**
- TOCTOU race: two concurrent `loadPaths()` calls both saw `count()===0` and both attempted `bulkAdd()`, causing a ConstraintError and spurious error toast on first app load — replaced with `bulkPut` (idempotent) + `loadInFlight` guard
- Stale closure: `enrollInPath`/`dropPath` captured `enrollments` snapshot before `await`, then `set()` could overwrite concurrent mutations — switched to `set(state => ...)` callback pattern
- Double-click guard: two rapid clicks on "Start Path" both passed the `existing` check before either updated state, creating two active enrollment records — added `enrollingPaths` module-level Set with try/finally cleanup
- `refreshCourseCompletion` concurrent overwrites: two parallel calls each spread the cache then `set()` replaced it, last-write-wins — now collects `updates` dict and merges via `set(state => { ...state.courseCompletionCache, ...updates })`
- Silent progress failures: `refreshCourseCompletion` errors logged to console only; learner saw 0% progress with no explanation — added `toast.warning()`
- Locked AC5 course navigation test: only CSS opacity class was asserted; actual link presence was untested — added test asserting Stage 2 course list contains no `<a>` elements

**Fixed (MEDIUM):**
- `debug-enroll.spec.ts` contained `waitForTimeout(3000)` hard wait — removed file
- `getByText(/^Stage \d/)` and `getByRole('listitem')` locators were unscoped — scoped to `"Learning stages"` list
- Hours metadata regex `/h$/` could match any text ending in 'h' — tightened to `/^\d+h$/`

**Remaining (MEDIUM — follow-up):**
- Course tile display name derived from courseId slug (`'6mx'` → `'6mx'`); real course titles exist in DB but are not fetched
- `sortedPaths` in `CareerPaths.tsx` applies no sort; name is misleading — rename or implement ordering
- `networkidle` used as wait strategy throughout E2E; prefer `expect(locator).toBeVisible()` auto-retry
- Completed courses cannot be revisited — CourseTile renders non-interactive div for completed state

## Web Design Guidelines Review

Design review passed with no BLOCKER findings. See `docs/reviews/design/design-review-2026-03-23-e20-s01.md` for full report. Design tokens used throughout; motion accessibility correct (`reducedMotion="user"`); responsive layout correct at all 3 breakpoints.

## Challenges and Lessons Learned

**1. Zustand v5 getter functions don't create reactive subscriptions**
Storing getter functions in Zustand state that internally call `get()` (e.g. `getEnrollmentForPath`) does NOT create a reactive subscription in components. When `enrollments` changed via `set()`, the component using only the getter didn't re-render — the enrollment button never flipped. Fix: add an explicit selector (`useCareerPathStore(state => state.enrollments)`) to create a proper subscription, then derive enrollment from it directly. Pattern to follow: any component that needs to react to state changes must subscribe via a selector, not call a getter.

**2. Agentation dev toolbar injects CSS `@keyframes` into the DOM**
`getByText(/0%/)` matched both the progress `<span>0%</span>` AND Agentation's injected `<style>@keyframes { 0% { ... } }</style>` element, causing a Playwright strict-mode violation. Fix: use semantic role selectors (`getByRole('status')`) that can't accidentally match style elements. General rule: prefer role/testid selectors over text matchers for numeric/percentage values.

**3. Playwright strict mode violations from ambiguous role selectors**
`getByRole('link', { name: /Career Paths/i })` matched both the sidebar nav link and the detail page back-link. Fix: add `data-testid="back-link"` to the back-link and use `getByTestId('back-link')` in the test. When two elements share a semantic role and similar accessible name, `data-testid` is the right disambiguation tool.

**4. Schema unit test requires manual update when adding new tables**
`src/db/__tests__/schema.test.ts` asserts the exact sorted list of table names and the DB version number. Adding v20 tables (`careerPaths`, `pathEnrollments`) without updating this test caused 2 test failures. Pattern: whenever a new Dexie version is added, update the schema test immediately as part of the same commit.
