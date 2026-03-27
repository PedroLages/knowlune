---
story_id: E31-S02
story_name: "Fix ImportedCourseDetail handleDelete Missing try/catch"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 31.2: Fix ImportedCourseDetail handleDelete Missing try/catch

## Story

As a user,
I want course deletion to show an error message if it fails,
so that I'm not stuck on a "Deleting..." state forever.

## Acceptance Criteria

**Given** the ImportedCourseDetail page
**When** I click delete and the deletion fails (e.g., IndexedDB error)
**Then** a try/catch catches the error
**And** `deleting` state is set back to `false`
**And** a `toast.error("Failed to delete course")` is shown

**Given** a successful deletion
**When** the operation completes
**Then** behavior is unchanged (navigates back to courses list)

## Tasks / Subtasks

- [ ] Task 1: Wrap handleDelete in try/catch (AC: 1, 2)
  - [ ] 1.1 Add try/catch around the async deletion logic in `ImportedCourseDetail.tsx:135-147`
  - [ ] 1.2 In the catch block: set `deleting` state back to `false`
  - [ ] 1.3 In the catch block: call `toast.error("Failed to delete course")`
  - [ ] 1.4 In the catch block: log the error with `console.error` for debugging
  - [ ] 1.5 Verify the happy path (successful deletion) still navigates back correctly

- [ ] Task 2: Add a finally block for safety (AC: 1)
  - [ ] 2.1 Consider using `finally { setDeleting(false) }` instead of catch-only reset
  - [ ] 2.2 If using finally: ensure the navigation on success doesn't conflict with state reset

- [ ] Task 3: Write tests for error path
  - [ ] 3.1 Test that when deletion fails, `deleting` returns to `false`
  - [ ] 3.2 Test that toast.error is shown on failure
  - [ ] 3.3 Test that user can retry deletion after failure
  - [ ] 3.4 Test that successful deletion still navigates correctly (regression)

## Implementation Notes

- **Audit finding:** H4 (confidence 85%)
- **File:** `ImportedCourseDetail.tsx:135-147`
- **Root cause:** `deleting=true` is set but never reset on the error path — user sees "Deleting..." forever if the operation fails
- **Pattern:**
  ```typescript
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCourse(courseId);
      navigate('/courses');
    } catch (err) {
      console.error('Failed to delete course:', err);
      toast.error('Failed to delete course');
      setDeleting(false);
    }
  };
  ```
- **Note on finally:** Using `finally { setDeleting(false) }` could cause a React state update after unmount if navigation happens first. Prefer resetting only in the catch block.

## Testing Notes

- **Error simulation:** Mock the `deleteCourse` store method to throw
- **UI state verification:** After error, the delete button should be enabled again (not stuck in loading)
- **Toast verification:** Assert `toast.error` appears with the correct message
- **Regression test:** Verify successful deletion still navigates to `/courses`
- **Edge case:** Test double-click on delete while first deletion is in progress (button should be disabled)
- **Edge case:** Test network error vs IndexedDB error (both should be caught)

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **catch-only reset**: Reset `deleting` only in catch (not finally) to avoid React state update after unmount when navigation occurs on success
- **Store-level importError**: The existing store error check inside the try block handles store-reported errors; the catch handles unexpected throws (IndexedDB failures)
