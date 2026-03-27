---
story_id: E29-S01
story_name: "Fix Courses Page Crash — TagManagementPanel Zustand Selector Infinite Loop"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 29.1: Fix Courses Page Crash — TagManagementPanel Zustand Selector Infinite Loop

## Story

As a user,
I want the Courses page to load without crashing,
So that I can browse and manage my course library.

## Acceptance Criteria

**Given** the Courses page at `/courses`
**When** the page loads with any number of courses (0, 1, 50+)
**Then** the page renders without triggering the error boundary
**And** the tag management panel displays tags with correct counts

**Given** `TagManagementPanel.tsx:33` calls `useCourseImportStore`
**When** the selector executes
**Then** it returns the `getTagsWithCounts` function reference (not calling it inline)
**And** the result is memoized with `useMemo` to prevent re-renders on every store update

## Tasks / Subtasks

- [ ] Task 1: Fix Zustand selector in TagManagementPanel (AC: 1, 2)
  - [ ] 1.1 Open `src/app/components/figma/TagManagementPanel.tsx:33`
  - [ ] 1.2 Change `useCourseImportStore(s => s.getTagsWithCounts())` to extract the function reference: `const getTagsWithCounts = useCourseImportStore(s => s.getTagsWithCounts)`
  - [ ] 1.3 Add `useMemo` to memoize the function call result: `const tags = useMemo(() => getTagsWithCounts(), [getTagsWithCounts])`
  - [ ] 1.4 Update the `useMemo` import if not already present
- [ ] Task 2: Verify fix does not regress tag display (AC: 1)
  - [ ] 2.1 Manually verify the Courses page loads without crash
  - [ ] 2.2 Verify tags display with correct counts
  - [ ] 2.3 Verify with 0 courses, 1 course, and many courses

## Implementation Notes

- **Root cause:** `useCourseImportStore(s => s.getTagsWithCounts())` calls a method inside the Zustand selector, producing a new array reference on every render. Since the selector return value is always a new reference, Zustand triggers a re-render, which re-runs the selector, creating an infinite loop.
- **Fix pattern:** Extract the function reference from the store, then call it inside `useMemo` with the function reference as a dependency. This ensures the tags array is only recomputed when the store's `getTagsWithCounts` function actually changes.
- **File:** `src/app/components/figma/TagManagementPanel.tsx:33`
- **Audit source:** B1 (blocker severity)

## Testing Notes

- This is a crash fix — verify the Courses page loads without hitting the error boundary
- Test with empty course library (0 courses) to verify no null/undefined errors
- Run existing E2E tests for the Courses page to confirm no regression
- Consider adding a simple smoke test if one doesn't exist: navigate to `/courses`, assert page renders

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **Root cause**: Zustand selectors that call methods inline (`s.getTagsWithCounts()`) return new array references on every render, causing infinite re-render loops
- **Pattern**: Always extract function refs from Zustand selectors, then memoize the call with `useMemo` — `const fn = useStore(s => s.method); const result = useMemo(() => fn(), [fn])`
- **Pre-existing build issue**: `@sentry/react` was in package.json but not installed in node_modules — `npm install` resolved it
