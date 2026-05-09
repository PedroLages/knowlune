---
title: "feat: Learning track UX improvements"
type: feat
status: active
date: 2026-05-09
origin: docs/brainstorms/2026-05-09-learning-track-ux-improvements-requirements.md
---

# feat: Learning track UX improvements

## Overview

Six UX fixes for the learning track creation and detail pages: numbered position badges and drag-and-drop reordering in the course picker, non-sticky progress sidebar with metadata card, collapsed syllabus modules by default, and CTA navigation directly to the video lesson instead of the course overview.

## Problem Frame

Users creating and navigating learning tracks encounter several UX friction points: no visual position indicators when selecting courses during creation, no drag-and-drop for reordering, a sticky-positioned progress sidebar, the first syllabus module expanded by default, and a CTA button that navigates to the course overview instead of directly to the lesson.

## Requirements Trace

- R1. Selected courses in `InlineCoursePicker` display numbered position badges (1, 2, 3…) reflecting their order in the track.
- R2. Selected courses support drag-and-drop reordering via `@dnd-kit`, in addition to the existing up/down chevron buttons.
- R3. The `PathProgressSidebar` is not sticky-positioned; it scrolls naturally with the page content.
- R4. A track metadata card appears below the progress ring, displaying: difficulty label, estimated hours, course count, and created/updated dates.
- R5. All syllabus modules are collapsed by default. No module auto-expands on page load.
- R6. The hero banner CTA navigates directly to the first incomplete video lesson within the target course. If no progress exists, it navigates to the first lesson of the first course. The target course is the earliest-positioned course (by `LearningPathEntry.position`) with incomplete progress.

## Scope Boundaries

- Reordering on the detail page timeline remains unsupported (creation/edit dialog only)
- No new npm packages — `@dnd-kit` is already in the codebase
- No data model changes — `LearningPathEntry.position` already stores order
- Empty tracks continue to be rejected (no creation without courses)

## Context & Research

### Relevant Code and Patterns

- `src/app/components/figma/InlineCoursePicker.tsx` — multi-select course picker used in creation dialog; currently uses `MoveUpDownButtons` for reorder, no drag-and-drop
- `src/app/components/figma/CurriculumComposer.tsx` — creation dialog wrapping `InlineCoursePicker`
- `src/app/components/learning-path/PathTimeline.tsx` — syllabus timeline with accordion; line 314: `useState(isInProgress)` controls initial expansion
- `src/app/components/learning-path/PathHeroBanner.tsx` — hero with CTA; line 139: currently links to `/courses/${ctaCourseId}`
- `src/app/components/learning-path/PathProgressSidebar.tsx` — progress sidebar; line 25: `sticky top-24`
- `src/app/pages/LearningTrackDetail.tsx` — detail page composing hero + timeline + sidebar; lines 363-366: wrapper `<aside>` also has `lg:sticky lg:top-24`
- `src/app/hooks/useNextBestCourse.ts` — resolves first incomplete lesson for a course via `targetLessonId`; reuses existing `findFirstIncompleteLesson()` logic
- `src/app/components/figma/VideoReorderList.tsx` — reference dnd-kit pattern (DndContext + SortableContext + useSortable + KeyboardSensor)
- `src/stores/useLearningPathStore.ts` — `reorderCourse(pathId, fromIndex, toIndex)` exists but is for persisted entries; creation dialog reordering operates on in-memory `selectedCourseIds` array
- `src/data/types.ts` — `LearningPath` has `difficultyLabel?`, `estimatedHours?`, `createdAt`, `updatedAt`; optional fields only set on template forks

### External References

None — codebase has strong existing patterns for all changes.

## Key Technical Decisions

- **Numbered badges + drag-and-drop via existing @dnd-kit pattern**: Follow the pattern established in `VideoReorderList`, `DashboardCustomizer`, and `LearningPathDetail` — DndContext with PointerSensor (activation distance) + KeyboardSensor (sortableKeyboardCoordinates) + SortableContext with verticalListSortingStrategy. Keep `MoveUpDownButtons` as keyboard-accessible alternative (WCAG 2.5.7).
- **Selected courses section above the browse list**: The current `InlineCoursePicker` renders courses in static groups (recently imported + all courses). Adding numbered badges to selected courses scattered across these groups would be visually confusing. Instead, add a separate "Selected Courses" reorderable section at the top of the picker where drag-and-drop operates, with the full browse list below for selection/deselection.
- **Reorder persistence on dialog submit**: In the creation dialog, reorder changes to `selectedCourseIds` are in-memory only. They persist when the user clicks "Add N Courses" and `createPathWithCourses` is called. This matches the current `MoveUpDownButtons` behavior and avoids partial persistence of an uncommitted track.
- **CTA lesson resolution via new `targetLessonId` prop on PathHeroBanner**: `LearningTrackDetail` already loads `videosByCourse` and `videoProgressMap`. Compute the first incomplete lesson ID in the detail page using the same pattern as `useNextBestCourse.findFirstIncompleteLesson()`, or reuse the hook directly, and pass the result as a new prop. `PathHeroBanner` changes its `Link to` from `/courses/${ctaCourseId}` to `/courses/${ctaCourseId}/lessons/${targetLessonId}`.
- **Metadata card adapts to optional fields**: `difficultyLabel` and `estimatedHours` are optional on `LearningPath` and only populated on template forks. The metadata card renders only fields with values. For user-created tracks without these fields, it shows course count and dates. This avoids half-empty cards.

## Open Questions

### Resolved During Planning

- R6 target course when multiple have progress: earliest-positioned by `LearningPathEntry.position` (see Key Technical Decisions)
- R6 "incomplete" threshold: `completionPercentage < 90` (matches existing `LessonRow.isVideoCompleted` check at line 445 of PathTimeline)
- R4 metadata card layout: inside `PathProgressSidebar`, below the progress ring, as a new card section
- DnD accessibility: follow the existing KeyboardSensor pattern used in all three existing dnd-kit components
- InlineCoursePicker layout for reorder: add a "Selected Courses" section above the browse list

### Deferred to Implementation

- Whether to use `useNextBestCourse` hook directly or inline the lesson-resolution logic in `LearningTrackDetail` — both work; the implementer decides based on prop cleanliness
- Exact positioning of the metadata card within the sidebar DOM (separate Card component vs. appended section)
- Whether `estimatedHours` for non-template tracks should be computed from the sum of course durations

## Implementation Units

- [ ] **Unit 1: Collapse all syllabus modules by default (R5)**

**Goal:** Change the initial expanded state in `PathTimeline` so no module auto-expands on page load.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx`

**Approach:**
- Line 314: change `useState(isInProgress)` to `useState(false)` in the `CourseTimelineEntry` sub-component
- The `autoScrollToCurrent` behavior still scrolls to the in-progress entry card, but the accordion inside remains collapsed — this is the intended behavior per requirements

**Patterns to follow:**
- Existing `useState` pattern in same file

**Test scenarios:**
- Happy path: Navigate to a track detail page — all modules are collapsed (no lesson rows visible)
- Happy path: Click a module card — it expands to show lesson rows
- Edge case: Navigate to a track with progress on course 3 — modules 1, 2, 3 are all collapsed; `autoScrollToCurrent` scrolls to module 3's card (still collapsed)

**Verification:**
- First visit to any track detail page shows zero expanded modules
- Clicking a module card toggles expansion correctly
- `autoScrollToCurrent` still works (scrolls to the right card)

---

- [ ] **Unit 2: Make progress sidebar non-sticky (R3)**

**Goal:** Remove sticky positioning from the progress sidebar so it scrolls naturally with the page.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/app/components/learning-path/PathProgressSidebar.tsx`
- Modify: `src/app/pages/LearningTrackDetail.tsx`

**Approach:**
- `PathProgressSidebar.tsx` line 25: remove `sticky top-24` from the `cn()` call
- `LearningTrackDetail.tsx` line 364: remove `lg:sticky lg:top-24 lg:self-start` from the wrapper `<aside>`
- The sidebar still renders in the right column at `lg:col-span-1`; it just scrolls with the page instead of sticking

**Patterns to follow:**
- Existing grid layout pattern in `LearningTrackDetail.tsx` lines 310, 363

**Test scenarios:**
- Happy path: Scroll through a track detail page — the sidebar scrolls with the content (does not stay fixed)
- Happy path: On mobile (single column), the sidebar appears below the syllabus — no sticky behavior

**Verification:**
- No `sticky` or `top-*` classes remain on the sidebar or its wrapper in LearningTrackDetail
- Sidebar scrolls naturally on desktop and mobile

---

- [ ] **Unit 3: Numbered badges + drag-and-drop in course picker (R1, R2)**

**Goal:** Add numbered position badges to selected courses and implement drag-and-drop reordering in the `InlineCoursePicker` creation dialog, following the existing @dnd-kit pattern.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/InlineCoursePicker.tsx`
- Test: `tests/e2e/learning-tracks.spec.ts` (add assertions for position badges and drag handles)

**Approach:**
1. Add a "Selected Courses" section above the browse list (rendered only when `selectedCourseIds.length > 0` in multiSelect mode)
2. Wrap the selected section in `DndContext` + `SortableContext` (follow `VideoReorderList` pattern: PointerSensor with `activationConstraint: { distance: 5 }`, KeyboardSensor with `sortableKeyboardCoordinates`, `closestCenter` collision detection, `verticalListSortingStrategy`)
3. Each selected course row in the sortable context uses `useSortable` with a `<button>` drag handle (`GripVertical` icon + `{...listeners}`)
4. Add a numbered position badge (`<span>` with `bg-muted rounded-md`, position = `index + 1`) before each selected course name
5. Keep existing `MoveUpDownButtons` as keyboard-accessible alternative (WCAG 2.5.7)
6. On `onDragEnd`: compute `arrayMove(selectedCourseIds, oldIndex, newIndex)`, call `onSelectionChange(newOrder)`
7. The browse list below the selected section remains unchanged (courses stay in their static groups)
8. The "Add N Courses" confirm button at the bottom still submits the full ordered list

**Execution note:** Implement the "Selected Courses" section with DnD first, then add position badges. Test keyboard navigation (Tab through drag handles, arrow keys for MoveUpDownButtons).

**Patterns to follow:**
- `src/app/components/figma/VideoReorderList.tsx` — DndContext + SortableContext + useSortable + DragOverlay pattern
- `src/app/pages/LearningPathDetail.tsx` — SortableCourseRow with drag handle + position badge (lines 88-260)
- `src/app/components/figma/MoveUpDownButtons.tsx` — existing keyboard reorder buttons

**Test scenarios:**
- Happy path: Select 3 courses — a "Selected Courses" section appears at the top showing all 3 with numbered badges 1, 2, 3
- Happy path: Drag course at position 3 to position 1 — badges update to reflect new order (old 3 → 1, old 1 → 2, old 2 → 3)
- Happy path: Use up/down chevron buttons to move a course — badges update accordingly
- Happy path: Deselect a course — it moves back to the browse list, remaining courses renumber
- Edge case: Select only 1 course — shows badge "1" but drag handle is non-interactive (single item cannot be reordered)
- Edge case: Keyboard-only reorder via MoveUpDownButtons still works alongside DnD
- Edge case: Search/filter in browse list does not affect the "Selected Courses" section

**Verification:**
- Selected courses show numbered badges in order
- Drag-and-drop reorders courses and updates badges
- MoveUpDownButtons remain functional
- Deselect renumbers remaining courses
- No regressions in singleSelect mode (no "Selected Courses" section)

---

- [ ] **Unit 4: Metadata card in progress sidebar (R4)**

**Goal:** Add a track metadata card below the progress ring in `PathProgressSidebar` showing difficulty, estimated hours, course count, and dates.

**Requirements:** R4

**Dependencies:** Unit 2 (sidebar restructuring — both touch the same component)

**Files:**
- Modify: `src/app/components/learning-path/PathProgressSidebar.tsx`
- Modify: `src/app/pages/LearningTrackDetail.tsx` (pass additional path data)

**Approach:**
1. Add new optional props to `PathProgressSidebar`: `difficultyLabel?: string`, `estimatedHours?: number`, `courseCount: number`, `createdAt: string`, `updatedAt: string`
2. Below the existing progress ring and stats, add a `Card` or `CardContent` section titled "Track Info" (or similar)
3. Render rows for each field that has a value:
   - Difficulty: show `difficultyLabel` if present
   - Estimated hours: show `estimatedHours` if present and > 0
   - Courses: always show `courseCount`
   - Created: show formatted `createdAt` date
   - Updated: show formatted `updatedAt` date (only if different from created)
4. Fields without values are omitted (avoids half-empty card for non-template tracks)
5. Update `LearningTrackDetail` to pass these new props from the `path` object

**Patterns to follow:**
- Existing stat display pattern in `PathProgressSidebar.tsx` (icon + label + value rows)
- Use `Intl.DateTimeFormat` or a lightweight date formatter for createdAt/updatedAt

**Test scenarios:**
- Happy path: View a template-forked track — metadata card shows difficulty, hours, course count, and dates
- Happy path: View a user-created track (no template) — metadata card shows only course count and dates
- Edge case: Track created and never updated — only one date shown (created), updatedAt matches createdAt

**Verification:**
- Metadata card appears below the progress ring
- Optional fields are hidden when null/undefined
- Dates are human-readable
- No duplicate "course count" confusion with the existing "Modules Completed" stat (re-label existing stat to avoid conflict if needed)

---

- [ ] **Unit 5: CTA navigates to first incomplete lesson (R6)**

**Goal:** Change the hero banner CTA button to navigate directly to the first incomplete video lesson instead of the course overview page.

**Requirements:** R6

**Dependencies:** None (uses existing `videosByCourse` and `videoProgressMap` already loaded in `LearningTrackDetail`)

**Files:**
- Modify: `src/app/components/learning-path/PathHeroBanner.tsx`
- Modify: `src/app/pages/LearningTrackDetail.tsx`

**Approach:**
1. Add optional `targetLessonId?: string` prop to `PathHeroBannerProps`
2. In `PathHeroBanner`, change the CTA `Link to` from `/courses/${ctaCourseId}` to `/courses/${ctaCourseId}/lessons/${targetLessonId}` when `targetLessonId` is present; fall back to `/courses/${ctaCourseId}` when absent
3. In `LearningTrackDetail`, compute `targetLessonId`:
   - Determine target course: first entry (by position) with `completionPct < 90`, falling back to first non-gap entry
   - Find first incomplete lesson: scan videos for that course ordered by `order`, find first where `completionPercentage < 90`
   - If no progress exists for any course, use the first lesson of the first course
   - If all courses are complete (all `completionPct >= 90`), fall back to the course overview page `/courses/${firstCourseId}`
   - If the target course has no videos (PDFs only), fall back to `/courses/${ctaCourseId}`
4. Pass `targetLessonId` to `PathHeroBanner`

**Patterns to follow:**
- `src/app/hooks/useNextBestCourse.ts` — `findFirstIncompleteLesson()` and `getFirstLessonId()` patterns
- Existing `videoProgressMap` and `videosByCourse` state in `LearningTrackDetail.tsx` lines 33-37
- Lesson route pattern: `/courses/${courseId}/lessons/${videoId}` (used in PathTimeline's `LessonRow`)

**Test scenarios:**
- Happy path: Track with in-progress course — CTA navigates to the first incomplete lesson within that course
- Happy path: Track with no progress — CTA navigates to the first lesson of the first course
- Happy path: Track with all courses complete — CTA navigates to the first lesson of the first course (or falls back to course overview)
- Edge case: Target course has no videos (PDFs only) — CTA falls back to course overview `/courses/${ctaCourseId}`
- Edge case: Target course has all lessons complete — CTA navigates to the first lesson of the next incomplete course in the track

**Verification:**
- "Start Learning" on a fresh track goes to the first lesson, not the course page
- "Continue Learning" goes to the first incomplete lesson
- CTA label logic unchanged ("Start" vs "Continue" based on `completionPct > 0`)

## System-Wide Impact

- **Interaction graph:** `PathHeroBanner` gains a `targetLessonId` prop. `PathProgressSidebar` gains metadata props. `InlineCoursePicker` gains a selected-courses DnD section. `PathTimeline` changes default accordion state.
- **Error propagation:** No new error paths — all changes are UI-level prop/state modifications.
- **State lifecycle risks:** DnD reorder in creation dialog is in-memory only; no partial persistence risk.
- **API surface parity:** `PathHeroBanner` and `PathProgressSidebar` are shared between learning paths and learning tracks. Changes must not break the learning paths usage.
- **Unchanged invariants:** `LearningPathEntry.position` storage unchanged. Store `reorderCourse` unchanged. `MoveUpDownButtons` component unchanged. All existing creation dialog behavior (AI mode, single-select mode) preserved.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `PathHeroBanner` and `PathProgressSidebar` are shared with learning paths — new props must not break that usage | Make new props optional with sensible defaults; verify learning path detail page renders correctly |
| `InlineCoursePicker` is used in multiple contexts (manual creation, AI generation preview) | Gate the "Selected Courses" section on `mode === 'multiSelect'` which is already the trigger for reorder UI |
| DnD in scrollable list — drag near boundaries may conflict with scroll | Follow the existing pattern from `VideoReorderDialog` which handles scroll + DnD correctly with `activationConstraint` |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-09-learning-track-ux-improvements-requirements.md](../brainstorms/2026-05-09-learning-track-ux-improvements-requirements.md)
- Related code: `src/app/components/figma/VideoReorderList.tsx` (dnd-kit pattern), `src/app/hooks/useNextBestCourse.ts` (lesson resolution)
