# Test Coverage Review — E24-S06: Video Drag-and-Drop Reorder

**Date:** 2026-03-25
**Reviewer:** Claude (automated)

## Test Files

- `src/app/components/figma/__tests__/VideoReorderList.test.tsx` — 3 tests (new)
- `src/app/components/figma/__tests__/EditCourseDialog.test.tsx` — 2 tests added (14 total)

## Coverage Assessment

### What's Covered

| Aspect | Tests | Status |
|--------|-------|--------|
| Empty state rendering | 1 | Covered |
| Video list rendering (filenames, order numbers, durations) | 1 | Covered |
| Drag handle rendering and aria-labels | 1 | Covered |
| Tab UI rendering (Details + Video Order tabs) | 1 | Covered |
| Tab switching hides Save, shows Done button | 1 | Covered |
| Duration formatting (m:ss) | Inline in test 2 | Covered |

### Gaps

**HIGH — No drag-and-drop interaction test** — `VideoReorderList.test.tsx`
The core feature (reordering via drag) has no test. While dnd-kit interaction testing is complex in jsdom, a test should verify that `handleDragEnd` correctly calls `onReorder` with reordered items and persists to the DB mock. This can be done by calling the handler directly or simulating pointer events.

**HIGH — No error/rollback test** — `VideoReorderList.test.tsx`
The error path (persist failure -> toast.error -> rollback to original order) is untested. This is critical business logic.

**MEDIUM — Mock returns wrong value** — `EditCourseDialog.test.tsx:7`
As noted in code review (M2), the mock returns `undefined` instead of `true`, so the success path (toast.success, dialog close) is never exercised. The test passes but doesn't verify the intended behavior.

**LOW — No E2E spec**
No E2E test exists for the video reorder feature. Given that drag-and-drop requires real browser interaction, an E2E spec would be the most appropriate way to test the full flow. However, this may be acceptable if the story explicitly waives E2E (like E24-S05 did with AC7).

## Verdict

Test coverage is shallow — it covers rendering but not the behavioral core (drag reorder, persistence, error handling). The 3 unit tests for `VideoReorderList` only verify static rendering, not the interactive drag-and-drop or data persistence that defines the feature.
