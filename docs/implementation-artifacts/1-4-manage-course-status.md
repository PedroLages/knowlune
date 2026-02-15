---
story_id: E01-S04
story_name: "Manage Course Status"
status: done
started: 2026-02-15
completed: 2026-02-15
reviewed: true
review_started: 2026-02-15
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review]
---

# Story 1.4: Manage Course Status

## Story

As a learner,
I want to categorize my courses as Active, Completed, or Paused,
so that I can focus on what I'm currently studying and filter out completed or paused courses.

## Acceptance Criteria

**Given** the user is viewing a course in the library
**When** the user changes the course status to Active, Completed, or Paused
**Then** the status is persisted in IndexedDB
**And** the course card displays a visual status indicator (badge or icon)
**And** Active courses show a blue-600 indicator, Completed shows green-600 with checkmark, Paused shows gray-400

**Given** the user has courses in multiple statuses
**When** the user applies a status filter on the Courses page
**Then** only courses matching the selected status are displayed
**And** filters can be combined with topic filters
**And** the active filter state is visually indicated

**Given** a newly imported course
**When** the import completes
**Then** the course status defaults to "Active"

## Tasks / Subtasks

- [ ] Task 1: Add `LearnerCourseStatus` type and `status` field to `ImportedCourse` (AC: 1, 3)
- [ ] Task 2: Dexie v2 migration adding `status` index with backfill (AC: 1)
- [ ] Task 3: Add `updateCourseStatus` store action with optimistic updates (AC: 1)
- [ ] Task 4: Add status badge + dropdown to `ImportedCourseCard` (AC: 1)
- [ ] Task 5: Create `StatusFilter` component (AC: 2)
- [ ] Task 6: Integrate status filtering into Courses page (AC: 2)
- [ ] Task 7: Default status on import (AC: 3)

## Implementation Notes

- `LearnerCourseStatus` named to avoid conflict with existing `CourseStatus` type ('importing' | 'ready' | 'error')
- Branched from S03 (PR #2 open, not merged to main) since S04 depends on S03's TopicFilter, ImportedCourseCard, useCourseImportStore, and Dexie schema
- Follow existing optimistic update + retry pattern from `updateCourseTags`
- StatusFilter follows TopicFilter component pattern (Badge toggles, aria-pressed, role="group")

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

**2026-02-15 (re-review)** — Report: `docs/reviews/design/design-review-2026-02-15-e01-s04.md`

- Previous blocker (gray-500) has been **fixed** — now uses gray-400 correctly
- **Medium**: Empty filtered state could have "Clear filters" action button
- **Medium**: Missing visual testing evidence (code-based review only)
- Overall: Excellent accessibility (A), design system compliance (A), responsive code patterns correct
- Verdict: **Pass** — 0 blockers, 2 medium suggestions

## Code Review Feedback

**2026-02-15 (re-review)** — Report: `docs/reviews/code/code-review-2026-02-15-e01-s04.md`

- Previous blockers **all fixed**: gray-400 correct, updateCourseStatus tests added, status filtering tests added, badge/dropdown tests added, getAllTags re-render fixed
- **High**: `updateCourseTags` has zero test coverage (parity gap with updateCourseStatus)
- **High**: `updateCourseStatus` rollback/error path untested
- **High**: No dedicated StatusFilter unit tests (tested indirectly via Courses.test.tsx)
- **High**: Inline makeCourse factories instead of shared factory
- **Medium**: Inconsistent `h-N w-N` vs `size-N`, string interpolation vs `cn()`, weak combined filter test
- Issues: 10 total (0 blockers, 4 high, 4 medium, 2 nits)
- Verdict: **Pass** — no blockers

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
