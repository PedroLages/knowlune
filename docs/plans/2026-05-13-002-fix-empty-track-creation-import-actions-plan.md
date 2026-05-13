---
title: "fix: Show course import actions when creating a learning track with no existing courses"
type: fix
status: completed
date: 2026-05-13
---

# fix: Show course import actions when creating a learning track with no existing courses

## Overview

When a new user opens the CurriculumComposer to create their first learning track, the InlineCoursePicker renders a skeleton (because `loading={importedCourses.length === 0}` is `true`), hiding the "Import new course" and "Import multiple" buttons. The user is stuck — they can't import courses to build the track, and the "Create Path" button is disabled.

## Problem Frame

**Root cause:** `useCourseImportStore` has no way to distinguish "store is still loading from Dexie" from "store loaded successfully but the user has zero courses." Both produce `importedCourses.length === 0`.

**Current flow (broken):**
1. User clicks "Create Track" → CurriculumComposer opens
2. `loading={importedCourses.length === 0}` evaluates to `true` (no courses)
3. InlineCoursePicker short-circuits to `<PickerSkeleton />` (line 553 of InlineCoursePicker.tsx)
4. Skeleton has no footer — import buttons ("Import new course", "Import multiple") are not rendered
5. User cannot import courses, cannot create a track

**Secondary issue:** Even if loading were fixed, when `hasCourses` is false the picker shows "All courses are already in this path" — the wrong message for the creation flow, where the issue is zero courses total, not courses excluded by filter.

## Requirements Trace

- R1. When opening the CurriculumComposer with zero imported courses, the "Import new course" and "Import multiple" buttons are visible and functional.
- R2. The InlineCoursePicker shows a skeleton only while the store is genuinely loading (first Dexie read), not when the store is loaded but empty.
- R3. When loaded with zero courses total, the picker shows a meaningful empty state: "No courses yet — import your first course to build a learning track."
- R4. The existing empty state "All courses are already in this path" continues to show when all existing courses have been excluded (e.g., already added to the path on the detail page).
- R5. After importing a course via either button in the creation dialog, the course auto-selects and the "Create Path" button becomes enabled.

## Scope Boundaries

- No changes to ImportWizardDialog or BulkImportDialog internals
- No changes to the course import pipeline (persist, thumbnail generation, etc.)
- No changes to how the "Import Course" header button on LearningTracks works
- No changes to the LearningTrackDetail page's edit/add flow

## Context & Research

### Relevant Code and Patterns

- [CurriculumComposer.tsx:342](src/app/components/figma/CurriculumComposer.tsx#L342) — `loading={importedCourses.length === 0}` — the buggy prop
- [InlineCoursePicker.tsx:553-554](src/app/components/figma/InlineCoursePicker.tsx#L553-L554) — `if (loading) return <PickerSkeleton />` — hides all content including footer import buttons
- [InlineCoursePicker.tsx:643-649](src/app/components/figma/InlineCoursePicker.tsx#L643-L649) — `!hasCourses && !search.trim()` → "All courses are already in this path." — wrong for creation flow
- [InlineCoursePicker.tsx:393-404](src/app/components/figma/InlineCoursePicker.tsx#L393-L404) — `allCourses` is computed from `importedCourses.filter(c => !excludeCourseIds.has(c.id))` — conflates "no courses" with "all excluded"
- [useCourseImportStore.ts:64-65](src/stores/useCourseImportStore.ts#L64-L65) — Store initial state: `importedCourses: []` — no `isLoaded` flag exists
- [useCourseImportStore.ts:511-527](src/stores/useCourseImportStore.ts#L511-L527) — `loadImportedCourses()` — loads from Dexie, sets `importedCourses`, no side-effect to mark load complete
- [LearningTracks.tsx:157-173](src/app/pages/LearningTracks.tsx#L157-L173) — Page-level `isLoaded` state tracks both `loadPaths()` + `loadImportedCourses()` completing — shows CurriculumComposer's loading state is redundant for the page-level case but not for direct mounting

### Institutional Learnings

- No relevant `docs/solutions/` entries.

## Key Technical Decisions

- **Add `isCoursesLoaded` to the store, not a per-component loading state.** The CurriculumComposer is used in multiple places (LearningTracks header, AILearningPath wrapper). A store-level flag avoids each consumer re-inventing loading tracking.
- **Separate "no courses" from "all excluded" in InlineCoursePicker.** The `allCourses` computation already filters via `excludeCourseIds`. By comparing `importedCourses.length` (total) against `allCourses.length` (after exclusion), we can distinguish "user has zero courses" from "all courses are already in this path."
- **Keep skeleton as the loading state, but make import actions visible in the empty state.** The empty state should render the search bar, the message, AND the footer with import buttons — the skeleton is only for the brief Dexie read window.

## Implementation Units

- [ ] **Unit 1: Add `isCoursesLoaded` flag to `useCourseImportStore`**

**Goal:** Add a boolean flag to the store that transitions from `false` to `true` after the first successful `loadImportedCourses()` call, letting consumers distinguish loading from empty.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/stores/useCourseImportStore.ts`

**Approach:**
- Add `isCoursesLoaded: false` to the initial state object and the `CourseImportState` interface
- In `loadImportedCourses`, set `isCoursesLoaded: true` in the `set()` call after successfully loading courses from Dexie (success path)
- In the catch block, also set `isCoursesLoaded: true` — loading completed even if it failed, so consumers don't wait forever
- Export as a selector: `useCourseImportStore(s => s.isCoursesLoaded)`

**Test scenarios:**
- Happy path: Before `loadImportedCourses()` is called, `isCoursesLoaded` is `false`
- Happy path: After `loadImportedCourses()` succeeds, `isCoursesLoaded` is `true`
- Error path: After `loadImportedCourses()` fails, `isCoursesLoaded` is `true` (loading did complete, even if errored)

**Verification:**
- Unit test: assert `isCoursesLoaded` transitions after `loadImportedCourses()` resolves
- Store type check: `isCoursesLoaded` is in the `CourseImportState` interface

---

- [ ] **Unit 2: Fix CurriculumComposer loading prop**

**Goal:** Use `isCoursesLoaded` from the store instead of `importedCourses.length === 0` for the InlineCoursePicker `loading` prop.

**Requirements:** R1, R2

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/figma/CurriculumComposer.tsx`
- Modify: `src/app/components/figma/__tests__/CurriculumComposer.test.tsx`

**Approach:**
- Import `isCoursesLoaded` from `useCourseImportStore`: `const isCoursesLoaded = useCourseImportStore(s => s.isCoursesLoaded)`
- Change line 342 from `loading={importedCourses.length === 0}` to `loading={!isCoursesLoaded}`
- In the test file, add `isCoursesLoaded: true` to the `courseImportState` mock object — without it, the selector returns `undefined`, `!undefined` is `true`, and every rendered test shows the skeleton instead of the picker
- This is a one-line change that unblocks the entire flow

**Test scenarios:**
- Happy path: Open CurriculumComposer after store is loaded with 0 courses → picker renders with "No courses yet" empty state + import buttons visible
- Happy path: Open CurriculumComposer after store is loaded with N courses → picker renders normally with course list
- Edge case: Open CurriculumComposer while store is still loading → skeleton renders (same as before, but now only during actual loading)

**Verification:**
- Unit tests pass: `npx vitest run src/app/components/figma/__tests__/CurriculumComposer.test.tsx`
- Manual: Fresh browser profile → navigate to Learning Tracks → click "Create Track" → verify "Import new course" and "Import multiple" buttons are visible
- Manual: Import a course → verify it auto-selects → "Create Path" becomes enabled
- `npm run build` passes

---

- [ ] **Unit 3: Fix InlineCoursePicker empty state for zero-courses scenario**

**Goal:** When the picker has loaded but the user has zero courses total (not just all excluded), show a meaningful empty state with import CTAs instead of "All courses are already in this path."

**Requirements:** R3, R4

**Dependencies:** Unit 2 (the empty state is now reachable once loading is fixed)

**Files:**
- Modify: `src/app/components/figma/InlineCoursePicker.tsx`

**Approach:**

The picker currently shows one of three states in the course list area:
1. `!hasCourses && !search.trim()` → "All courses are already in this path."
2. `filteredCourses.length === 0 && search.trim()` → "No matching courses found..."
3. Otherwise → course list with sections

Add a fourth state for "no courses at all" by checking `importedCourses.length === 0` (total courses, before exclusion) vs `allCourses.length === 0` (after exclusion):

- When `importedCourses.length === 0 && !search.trim()` (no courses exist at all):
  - Show an empty state with: `<BookOpen>` icon, "No courses yet", "Import your first course to build a learning track."
  - The import buttons are rendered in the footer below (already handled by existing footer logic at lines 723-747)
- When `importedCourses.length > 0 && allCourses.length === 0 && !search.trim()` (all courses excluded):
  - Keep the existing "All courses are already in this path." message

This is a small change around lines 643-649 — add the new branch before the existing `!hasCourses` check.

**Test scenarios:**
- Happy path: 0 total courses, no search → shows "No courses yet" message + import buttons in footer
- Happy path: 3 total courses, all excluded via `excludeCourseIds` → shows "All courses are already in this path."
- Happy path: 3 total courses, search for "xyz" no match → shows "No matching courses found for 'xyz'"
- Edge case: 3 total courses, none excluded → course list renders normally
- Integration: Click "Import new course" from empty state → ImportWizardDialog opens → complete import → course auto-selects

**Verification:**
- Manual: Fresh profile → CurriculumComposer → verify "No courses yet" message + both import buttons visible
- Manual: Existing path detail page → edit/add → verify existing exclusion message still works
- `npm run build` passes

## System-Wide Impact

- **Interaction graph:** `useCourseImportStore` gains one new boolean property — all existing consumers are unaffected unless they choose to use it
- **Unchanged invariants:** `addImportedCourse`, `removeImportedCourse`, `loadImportedCourses` signatures unchanged. ImportWizardDialog and BulkImportDialog unchanged. `createPathWithCourses` store method unchanged.
- **API surface parity:** The `InlineCoursePicker` prop interface is unchanged — the empty state differentiation is internal

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `loadImportedCourses` is called multiple times by different consumers (LearningTracks page, CurriculumComposer post-import) — `isCoursesLoaded` must stay `true` once set | Setting `isCoursesLoaded: true` is idempotent — it's never reset to `false` |
| The "No courses yet" empty state could flash briefly before the store loads | Unit 1's `isCoursesLoaded` prevents this — skeleton shows until load completes, then empty state renders |

## Sources & References

- Related plan: [docs/plans/2026-05-10-001-feat-batch-course-import-track-creation-plan.md](docs/plans/2026-05-10-001-feat-batch-course-import-track-creation-plan.md) — Added batch import button to CurriculumComposer (implemented, but the skeleton bug hides it)
- Related requirements: [docs/brainstorms/2026-05-03-learning-paths-01-curriculum-composer-requirements.md](docs/brainstorms/2026-05-03-learning-paths-01-curriculum-composer-requirements.md) — R3, R9 describe the inline picker's import actions and "Recently Imported" section
