---
story_id: E31-S05
story_name: "Fix Silent .catch(() => {}) in useCourseImportStore"
status: in-progress
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 31.5: Fix Silent .catch(() => {}) in useCourseImportStore

## Story

As a developer,
I want thumbnail loading errors to be logged and surfaced,
so that failed thumbnails show a fallback image instead of silently disappearing.

## Acceptance Criteria

**Given** `useCourseImportStore` loads course thumbnails
**When** the thumbnail fetch/read fails
**Then** the error is logged via `console.warn` (not silently swallowed)
**And** the course card shows a default placeholder image
**And** the `.catch(() => {})` is replaced with meaningful error handling

## Tasks / Subtasks

- [ ] Task 1: Replace the silent `.catch(() => {})` with meaningful handling (AC: 1)
  - [ ] 1.1 Locate the `.catch(() => {})` at `useCourseImportStore.ts:377-379`
  - [ ] 1.2 Replace with `.catch((err) => { console.warn('Failed to load thumbnail:', err.message) })`
  - [ ] 1.3 Set the thumbnail URL to a default placeholder path when the catch fires

- [ ] Task 2: Add a placeholder image for failed thumbnails (AC: 1)
  - [ ] 2.1 Define a `PLACEHOLDER_THUMBNAIL` constant (e.g., `/assets/placeholder-course.svg` or a data URI)
  - [ ] 2.2 In the catch handler, set the course's thumbnail to `PLACEHOLDER_THUMBNAIL`
  - [ ] 2.3 Verify existing placeholder assets exist, or create a minimal SVG placeholder

- [ ] Task 3: Verify ESLint catches the anti-pattern (AC: 1)
  - [ ] 3.1 Confirm that `error-handling/no-silent-catch` ESLint rule flags `.catch(() => {})`
  - [ ] 3.2 If the rule doesn't catch this specific pattern, document why (may be a promise chain vs try/catch difference)

- [ ] Task 4: Write tests for thumbnail error handling
  - [ ] 4.1 Test that when thumbnail loading fails, `console.warn` is called
  - [ ] 4.2 Test that the placeholder image is set on failure
  - [ ] 4.3 Test that successful thumbnail loading still works (regression)

## Implementation Notes

- **Audit finding:** H5 (confidence 88%)
- **File:** `useCourseImportStore.ts:377-379`
- **Root cause:** `.catch(() => {})` swallows all errors silently — no logging, no fallback, no user feedback. The thumbnail simply disappears without any indication of failure.
- **Two-layer fix applied:**
  1. **Inner layer (loadThumbnailUrls):** Wrapped each individual `loadCourseThumbnailUrl()` call in try/catch so one failed thumbnail doesn't reject the entire `Promise.all`. Failed thumbnails log via `console.warn` and return `null`, which means the existing UI fallback (FolderOpen icon in ImportedCourseCard) renders naturally.
  2. **Outer layer (loadImportedCourses):** Replaced `.catch(() => {})` with `.catch((err) => { console.warn(...) })` so any unexpected rejection from `loadThumbnailUrls` itself is also logged.
- **Placeholder strategy:** The existing `ImportedCourseCard` already renders a `FolderOpen` gradient icon when `thumbnailUrl` is falsy (line 260-262). No separate placeholder image asset needed — the graceful fallback was already in the UI, just the error was being swallowed silently in the store.
- **ESLint enforcement:** The `error-handling/no-silent-catch` rule should flag `.catch(() => {})`. Verified the pattern is now eliminated.

## Testing Notes

- **Error simulation:** Mock the thumbnail loading mechanism to reject
- **Console.warn verification:** Spy on `console.warn` and assert it's called with the error message
- **Placeholder verification:** After error, verify the course's `thumbnailUrl` equals the placeholder constant
- **UI verification:** In E2E, verify the placeholder image renders (not a broken image icon)
- **Regression test:** Verify successful thumbnail loading is unaffected
- **Edge case:** Test when multiple thumbnails fail simultaneously (all should get placeholders)
- **Edge case:** Test when the error object has no `.message` property

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

- **Silent catch in Promise chains is worse than in try/catch blocks:** The `.catch(() => {})` at the call site masked the fact that `loadThumbnailUrls` used `Promise.all` without per-item error handling. A single failed thumbnail would reject the entire batch, losing all thumbnails. The fix required error handling at both levels.
- **UI fallback was already correct:** The `ImportedCourseCard` component already had a graceful FolderOpen icon fallback for missing thumbnails. The only missing piece was making the error observable via `console.warn` so developers can diagnose thumbnail failures in production.
- **Pattern: Prefer `Promise.all` with per-item try/catch over `Promise.allSettled`:** Using try/catch inside the `.map()` callback keeps the return type clean (`[string, string | null][]`) without needing to unwrap `PromiseSettledResult` wrappers.
