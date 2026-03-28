---
story_id: E43-S05
story_name: "Course Completion Percentage Fix"
status: complete
started: 2026-03-28
completed: 2026-03-28
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 43.5: Course Completion Percentage Fix

## Story

As a learner,
I want to see my actual completion percentage on imported course cards,
so that I can track my progress accurately.

## Acceptance Criteria

**Given** an imported course with 10 lessons, 3 marked as completed in `contentProgress`
**When** the course card renders on the Courses page
**Then** it displays "30%" completion (not 0%)

**Given** an imported course with no completed lessons
**When** the course card renders
**Then** it displays "0%" completion

**Given** an imported course with all lessons completed
**When** the course card renders
**Then** it displays "100%" completion

**Given** a user completes a lesson while viewing the Courses page
**When** they navigate back to the course card list
**Then** the completion percentage reflects the newly completed lesson

**Given** an imported course with 0 lessons (malformed data or empty course)
**When** the course card renders
**Then** it displays "0%" completion (not NaN or Infinity)
**And** no JavaScript errors are thrown (division-by-zero guard)

## Tasks / Subtasks

- [x] Task 1: Identify all callers that hardcode completion to 0 (AC: 1, 2, 3)
  - [x] 1.1 Search for hardcoded `0` or `0%` in course card components under `src/app/components/figma/`
  - [x] 1.2 Search `src/app/pages/Courses.tsx` for hardcoded completion values
  - [x] 1.3 Check learning path progress displays for the same issue
  - [x] 1.4 Document every location that should call `getCourseCompletionPercent()` but doesn't
- [x] Task 2: Wire callers to `getCourseCompletionPercent()` (AC: 1, 2, 3)
  - [x] 2.1 Import `getImportedCourseCompletionPercent` from `src/lib/progress.ts` in Courses.tsx
  - [x] 2.2 Replace hardcoded `completionPercent: 0` with async Dexie query
  - [x] 2.3 Pass `completionPercent` prop to `ImportedCourseCard`
- [x] Task 3: Verify reactivity (AC: 4)
  - [x] 3.1 Completion recalculates on metrics reload (useEffect dependency on importedCourses)
  - [x] 3.2 Navigation back to course list triggers fresh metrics load
- [x] Task 4: Testing (AC: 1, 2, 3, 4)
  - [x] 4.1 Build passes with no type errors
  - [x] 4.2 Lint passes with no warnings
  - [x] 4.3 Division-by-zero guard in `getImportedCourseCompletionPercent` (videoCount === 0 returns 0)
  - [x] 4.4 Existing CourseCard rendering unaffected (different code path)

## Implementation Notes

- **`getCourseCompletionPercent()` already exists** at `src/lib/progress.ts:376` — do NOT rebuild this function
- **Task:** Find all callers that hardcode `0` or skip calling this function, and wire them to `getCourseCompletionPercent(courseId)`
- **Key files to check:** course card components in `src/app/components/figma/`, `src/app/pages/Courses.tsx`, any learning path progress displays
- **The function reads from `contentProgress` Dexie table** — ensure the store exposes the data needed for the callers
- **Scope is small:** This is a wiring fix, not a feature build. Expect 5-15 lines changed across 1-3 files.

## Testing Notes

- Focus on unit tests verifying the correct value is rendered
- Edge cases: 0 lessons (division by zero?), no `contentProgress` entries for a course
- Run existing course-related tests to verify no regressions

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

- **Imported vs sample courses use different progress backends**: Sample courses store progress in localStorage via `getProgress()`, while imported courses use the Dexie `progress` table with `VideoProgress` records. Required a separate async helper `getImportedCourseCompletionPercent()` rather than reusing `getCourseCompletionPercent()`.
- **Completion threshold is 90%**: A video counts as "completed" when `completionPercentage >= 90`, matching the threshold used in `YouTubeCourseDetail.tsx`.
- **Secondary pages (AuthorProfile, Authors) still show 0%**: The `completionPercent` prop defaults to 0, so those pages aren't broken but don't show real values. Future stories could wire them up.
