---
story_id: E20-S01
story_name: "Career Paths System"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests]
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

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

**1. Zustand v5 getter functions don't create reactive subscriptions**
Storing getter functions in Zustand state that internally call `get()` (e.g. `getEnrollmentForPath`) does NOT create a reactive subscription in components. When `enrollments` changed via `set()`, the component using only the getter didn't re-render — the enrollment button never flipped. Fix: add an explicit selector (`useCareerPathStore(state => state.enrollments)`) to create a proper subscription, then derive enrollment from it directly. Pattern to follow: any component that needs to react to state changes must subscribe via a selector, not call a getter.

**2. Agentation dev toolbar injects CSS `@keyframes` into the DOM**
`getByText(/0%/)` matched both the progress `<span>0%</span>` AND Agentation's injected `<style>@keyframes { 0% { ... } }</style>` element, causing a Playwright strict-mode violation. Fix: use semantic role selectors (`getByRole('status')`) that can't accidentally match style elements. General rule: prefer role/testid selectors over text matchers for numeric/percentage values.

**3. Playwright strict mode violations from ambiguous role selectors**
`getByRole('link', { name: /Career Paths/i })` matched both the sidebar nav link and the detail page back-link. Fix: add `data-testid="back-link"` to the back-link and use `getByTestId('back-link')` in the test. When two elements share a semantic role and similar accessible name, `data-testid` is the right disambiguation tool.

**4. Schema unit test requires manual update when adding new tables**
`src/db/__tests__/schema.test.ts` asserts the exact sorted list of table names and the DB version number. Adding v20 tables (`careerPaths`, `pathEnrollments`) without updating this test caused 2 test failures. Pattern: whenever a new Dexie version is added, update the schema test immediately as part of the same commit.
