---
title: "feat: Unify course detail syllabus with PathTimeline visual treatment"
type: feat
status: active
date: 2026-05-11
deepened: 2026-05-12
---

# feat: Unify course detail syllabus with PathTimeline visual treatment

## Overview

Replace the custom "Course Journey" timeline in `CourseOverview` with the `StatusCircle`/`EntryActionButton`/`LessonRow` visual patterns from `PathTimeline` (used in the learning track "Syllabus" section). Remove the unused "Timeline" view mode from the Courses listing page.

## Problem Frame

The course detail page (`/courses/:courseId`) has a custom-built "Course Journey" timeline that uses `CourseJourneyNodeIndicator` for its node dots. The learning track detail page (`/learning-tracks/:trackId`) has a "Syllabus" section powered by `PathTimeline` with a richer, more polished visual treatment. These two timelines serve the same conceptual purpose (showing a sequence of modules/lessons with progress) but diverge visually and in behavior — creating an inconsistent experience.

Additionally, the Courses listing page has a "Timeline" view mode (via `ViewModeToggle`) that renders each course as a card in `CourseTimelineView`. This mode is not wanted.

## Requirements Trace

- R1. Remove the "Timeline" option from the Courses listing page view mode toggle
- R2. Replace the "Course Journey" section heading and content in `CourseOverview` with a "Syllabus" section that uses `PathTimeline`'s visual primitives (`StatusCircle`, `EntryActionButton`, `LessonRow`)
- R3. Each module group (chapter/section) remains a separate timeline entry card — not collapsed into one course card
- R4. Module cards gain the `EntryActionButton` pattern with module-level labels only: "Start Module" (in-progress modules) and "Review" (completed modules). Locked modules hide the button entirely
- R4b. A course-level action area is added between the Syllabus heading and the module list. It contains a single `EntryActionButton` with "Complete Course" / "Undo Complete" labels, wired to `useCourseImportStore.updateCourseStatus()` — matching the learning track's course-level toggle behavior
- R5. The Syllabus section heading matches `LearningTrackDetail`'s style: `font-display text-2xl font-bold` with a muted lesson count on the right (matching the `<span className="text-muted-foreground text-sm">` count pattern at LearningTrackDetail:528-531)
- R6. Existing functionality preserved: expandable module cards (active/completed modules only), lesson links, progress tracking, sidebar stats. Locked module cards use `opacity-60` with `pointer-events-none` on the card content area to match PathTimeline's combined visual and behavioral treatment — locked cards are neither clickable nor expandable

## Scope Boundaries

- The hero banner, floating stats bar, and right sidebar in `CourseOverview` are unchanged
- `PathTimeline` component itself is not structurally altered — only its internal sub-components are extracted
- No changes to `LearningTrackDetail`'s Syllabus usage
- No changes to the `CourseTimelineView` component behavior for any remaining consumers

### Deferred to Separate Tasks

- Removal of `CourseTimelineView.tsx` and its test file: deferred to a separate cleanup PR to keep this diff focused
- Removal of `CourseJourneyNodeIndicator.tsx` and its test file: deferred to the same cleanup PR

## Context & Research

### Relevant Code and Patterns

- `PathTimeline.tsx` — source of `StatusCircle`, `EntryActionButton`, `LessonRow` sub-components (lines 55-158, 245-325)
- `CourseOverview.tsx` — current "Course Journey" section to be replaced (lines 476-654)
- `LearningTrackDetail.tsx` — "Syllabus" section with `PathTimeline` (lines 524-559) — the visual target
- `CourseJourneyNodeIndicator.tsx` — the current node dot component to be replaced by `StatusCircle`
- `ViewModeToggle.tsx` — 4-option toggle to be reduced to 3 options (remove timeline)
- `Courses.tsx` — timeline view mode rendering and data fetching (lines 56-59, 207-292, 718-727)
- `useEngagementPrefsStore.ts` — `CourseViewMode` type including `'timeline'`

### Institutional Learnings

- No relevant `docs/solutions/` entries found for this specific refactor

## Key Technical Decisions

- **Extract, don't duplicate**: `StatusCircle`, `EntryActionButton`, and `LessonRow` are extracted from `PathTimeline.tsx` into a new file `TimelinePrimitives.tsx` rather than being copied. This keeps ~150 lines of visual logic in one place and ensures future changes to the timeline visual language propagate automatically.
- **Module-level entries, not course-level**: The Syllabus section on `CourseOverview` shows module groups as timeline entries (matching R3), not courses. This means `PathTimeline` itself cannot be used as-is (it expects course entries with `LearningPathEntry` type). Instead, the extracted primitives are composed directly in `CourseOverview`.
- **Keep timeline mode in the store type, remove from valid list**: Keep `'timeline'` in the `CourseViewMode` TypeScript union (avoids type errors in consumers), but remove it from `VALID_COURSE_VIEW_MODES` so persisted `'timeline'` values auto-migrate to `'grid'` on next load. This is the clean migration path.

## Implementation Units

- [ ] **Unit 1: Extract timeline visual primitives from PathTimeline**

**Goal:** Make `StatusCircle`, `EntryActionButton`, and `LessonRow` reusable by extracting them into a shared module.

**Requirements:** R2, R3 (enables the Syllabus section to use the same visual primitives)

**Dependencies:** None

**Files:**
- Create: `src/app/components/learning-path/TimelinePrimitives.tsx`
- Modify: `src/app/components/learning-path/PathTimeline.tsx`

**Approach:**
- Create `TimelinePrimitives.tsx` with three exported components: `StatusCircle`, `EntryActionButton`, `LessonRow`
- Copy the exact implementations (and their internal imports) from `PathTimeline.tsx`
- In `PathTimeline.tsx`, replace the local definitions with imports from `TimelinePrimitives.tsx`
- All props, types, and behavior remain identical — this is a pure extraction, no renames or refactors

**Patterns to follow:**
- Same file structure conventions as `PathTimeline.tsx` (imports, types, components)
- Use the same import aliases (`@/app/components/ui/...`, `@/lib/...`)

**Test scenarios:**
- Test expectation: none — pure extraction with no behavioral change. Existing PathTimeline tests cover the extracted components. If PathTimeline tests pass after extraction, the unit is verified.

**Verification:**
- `npm run build` passes
- `npm run test:unit` passes (existing PathTimeline-related tests)
- PathTimeline renders identically in LearningTrackDetail

---

- [ ] **Unit 2: Replace Course Journey with Syllabus-style timeline in CourseOverview**

**Goal:** Replace the "Course Journey" section heading and custom timeline with a "Syllabus" section using `StatusCircle`, `EntryActionButton`, and `LessonRow` from `TimelinePrimitives.tsx`.

**Requirements:** R2, R3, R4, R5, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/pages/CourseOverview.tsx`

**Approach:**
1. Import `StatusCircle`, `EntryActionButton`, `LessonRow` from `TimelinePrimitives.tsx`
2. Replace the section heading (lines 476-483): "Course Journey" → "Syllabus", match `font-display text-2xl font-bold` style with a lesson count badge on the right
3. Replace `CourseJourneyNodeIndicator` with `StatusCircle` — map statuses: `completed` → `'completed'`, `active` → `'in-progress'`, `upcoming` → `'locked'`
4. Add `EntryActionButton` to each module card header with status-appropriate labels, covering all five button states explicitly: "Start Module" (in-progress modules with no completed lessons), "Review" (completed modules with all lessons done), hidden (locked modules). Complete/Undo are NOT on module cards — those are course-level actions (see step 5)
5. Add a course-level action area between the Syllabus heading and module list. This area contains a single `EntryActionButton` with "Complete Course" (when course is active/in-progress) and "Undo Complete" (when course is completed), wired to `useCourseImportStore.updateCourseStatus()` to toggle the course's overall status. Note: this is semantically correct because the course status maps 1:1 to a course-level toggle, unlike module-level Complete/Undo which would incorrectly toggle course status per-module
6. Replace inline lesson rows with `LessonRow` component
7. Match card styling to `PathTimeline`'s `CourseTimelineEntry`: `rounded-2xl border hover:shadow-md transition-all`, status-based border colors (`border-success/20` for completed, `border-brand/20 ring-1 ring-brand/5` for in-progress). Locked cards get `opacity-60` with `pointer-events-none` on the card content area to match PathTimeline's combined visual and behavioral treatment — locked cards are neither clickable nor expandable. Locked cards use `StatusCircle status="locked"` styling
8. Remove the `CourseJourneyNodeIndicator` import (it's no longer used)

**Execution note:** This is a visual refactor of existing behavior. The module grouping logic (`buildGroupedCurriculum`), progress calculation, accordion state, and CTA resolution are all preserved as-is. Only the JSX rendering within the timeline section changes.

**Patterns to follow:**
- `PathTimeline.tsx` `CourseTimelineEntry` (lines 465-593) for card structure and styling
- `LearningTrackDetail.tsx` Syllabus section header (lines 527-531) for heading style
- `CourseOverview.tsx` existing module grouping and progress logic (lines 203-240, 495-507)

**Test scenarios:**
- Happy path: Single course with 3 module groups renders 3 timeline entries, each with StatusCircle at the correct status
- Happy path: Clicking "Start Module" on an in-progress module navigates to the first incomplete lesson
- Happy path: Clicking "Review" on a completed module expands the card to show lessons
- Edge case: Course with one module group renders a single timeline entry (not empty)
- Edge case: Course with no videos (empty modules) — Syllabus section shows the heading with "0 lessons" badge but no entries
- Happy path: Course-level "Complete Course" button calls `useCourseImportStore.updateCourseStatus(courseId, 'completed')` to toggle overall course status to completed
- Happy path: Course-level "Undo Complete" button calls `useCourseImportStore.updateCourseStatus(courseId, 'active')` to revert course status
- Edge case: Locked module card uses both `opacity-60` and `pointer-events-none` — no click interaction is possible

**Verification:**
- `CourseOverview` renders a "Syllabus" section heading (not "Course Journey")
- `StatusCircle` dots appear at each module node instead of `CourseJourneyNodeIndicator`
- `EntryActionButton` appears on each module card with correct label for status
- `LessonRow` renders individual lessons within expanded modules
- All existing CourseOverview functionality works: expand/collapse, lesson links, progress rings, stats bar
- `npm run build` and `npm run test:unit` pass

---

- [ ] **Unit 3: Remove timeline view mode from Courses listing page**

**Goal:** Remove the "Timeline" option from the view mode toggle and clean up associated data fetching.

**Requirements:** R1

**Dependencies:** None (independent of Units 1-2)

**Files:**
- Modify: `src/app/components/courses/ViewModeToggle.tsx`
- Modify: `src/app/pages/Courses.tsx`

**Approach:**
1. In `ViewModeToggle.tsx`: Remove `{ value: 'timeline', label: 'Timeline view', Icon: GitBranch }` from the `OPTIONS` array, remove the `GitBranch` import, and update the `onValueChange` guard at line 40 to remove `|| next === 'timeline'` so the filter only accepts the three remaining modes
2. In `Courses.tsx`:
   - Remove the `CourseTimelineView` import
   - Remove timeline-specific state: `timelineProgressMap`, `lessonGroupsByCourse`, `timelineIsLoading`, `timelineRefreshKey` (lines 56-59)
   - Remove the timeline data fetching `useEffect` (lines 207-292)
   - Remove the `courseViewMode === 'timeline'` branch from the render (lines 718-727) — the fallthrough to `VirtualizedCoursesList` with `viewMode={courseViewMode}` already handles non-timeline modes, but since timeline is no longer selectable, the conditional can be simplified
   - Remove `buildGroupedCurriculum` and `ChapterGroup` imports if no longer used (check: `buildGroupedCurriculum` is used elsewhere via `curriculumGrouping`, but `ChapterGroup` type is only used by timeline — confirm before removing)
3. Keep `'timeline'` in the `CourseViewMode` TypeScript type (avoid breaking consumers that reference the type), but remove it from `VALID_COURSE_VIEW_MODES` so any persisted `'timeline'` values auto-migrate to the `'grid'` default on next load

**Patterns to follow:**
- The existing 3-mode toggle pattern in the same file

**Test scenarios:**
- Happy path: ViewModeToggle renders 3 options (Grid, List, Compact) without Timeline
- Happy path: Courses page renders with grid/list/compact views working as before
- Edge case: User with `courseViewMode: 'timeline'` persisted in localStorage gets defaulted to `'grid'` on load (existing store fallback behavior)
- Edge case: `timelineRefreshKey` is used in the `study-log-updated` event listener (line 139) — remove that reference so the listener doesn't trigger a no-op state update

**Verification:**
- ViewModeToggle shows only 3 options in the UI
- Courses page works correctly in all remaining view modes
- No console errors from missing imports or stale state
- `npm run build` passes
- `npm run test:unit` passes (update ViewModeToggle tests if they reference timeline)

---

- [ ] **Unit 4: Update tests for the changes**

**Goal:** Update existing tests to match the new UI state and add coverage for the Syllabus section.

**Requirements:** All

**Dependencies:** Units 1, 2, 3

**Files:**
- Create: `src/app/pages/__tests__/CourseOverview.test.tsx` (new — no existing CourseOverview tests)
- Modify: `src/app/components/courses/__tests__/ViewModeToggle.test.tsx`
- Modify: `src/app/pages/__tests__/Courses.test.tsx`

**Approach:**
1. `CourseOverview.test.tsx` (new): Create a new test file with smoke tests for the Syllabus section — "renders Syllabus heading with lesson count" and "renders module entries with StatusCircle indicators" (no existing CourseOverview tests to update)
2. `ViewModeToggle.test.tsx`: Remove test cases that assert the Timeline option exists; verify 3 options are rendered
3. `Courses.test.tsx`: Remove test cases that assert timeline view rendering; verify the timeline branch is no longer reachable
4. If no existing Overview test covers the timeline section, add a minimal smoke test: "renders Syllabus heading" and "renders module entries with status circles"

**Test harness complexity note:** `CourseOverview.test.tsx` requires mocking at least 5 subsystem categories to render without error:

- **Router context:** `useParams` must return `{ courseId }` — use `react-router-dom`'s `MemoryRouter` with an appropriate initial route
- **Stores / state management:** `useCourseAdapter` (course data fetching), `useCourseImportStore` (course status), and any lazy-loaded stores need mock implementations
- **Dexie / IndexedDB queries:** Course progress data deriving from Dexie tables must be stubbed
- **Animation components:** `motion` (framer-motion) elements render in tests — wrap with `MotionConfig` or mock `motion` if snapshot diffs are problematic
- **UI primitives:** Collapsible/Accordion components from Radix may require `asChild` wrapping or `CollapsibleTrigger` presence

Recommend a `createCourseOverviewTestHarness()` factory function in the test file that pre-configures all mocks and returns a rendered `CourseOverview` wrapper. This avoids repeating the same mock setup across test cases and keeps individual test scenarios focused on their assertion.

**Test scenarios:**
- Overview: Syllabus heading renders with lesson count
- Overview: Module entries render with StatusCircle indicators
- ViewModeToggle: Only Grid, List, Compact options are present
- Courses: Timeline view code path is unreachable through normal UI interaction

**Verification:**
- `npm run test:unit` passes with all updated tests
- `npm run build` passes

## System-Wide Impact

- **Interaction graph:** The `study-log-updated` custom event listener in `Courses.tsx` currently calls `setTimelineRefreshKey` — this reference must be removed when the timeline state is removed (Unit 3)
- **Unchanged invariants:** `PathTimeline` component API is unchanged; `LearningTrackDetail` Syllabus section is unaffected; `CourseOverview`'s hero banner, stats bar, sidebar, and CTA logic are untouched; `CourseTimelineView` component file remains on disk (deferred cleanup)
- **API surface parity:** The `CourseViewMode` type retains `'timeline'` as a valid value — no TypeScript errors in consumers that reference the type

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Extracting sub-components from PathTimeline could introduce subtle regressions in the learning track Syllabus | Pure extraction with no behavioral changes; existing PathTimeline tests catch regressions |
| Removing timeline state from Courses.tsx could break the `study-log-updated` event listener | Carefully remove only the `setTimelineRefreshKey` call, keeping the `loadCourseMetrics()` call |
| Manual completion (`onMarkComplete`) for courses uses `updateCourseStatus()` from `useCourseImportStore` rather than a learning-track-specific endpoint. The Complete button toggles course status to `'completed'`; Undo reverts to `'active'`. | Scope Complete/Undo to course-level status toggling via the existing store action |

## Sources & References

- `src/app/pages/CourseOverview.tsx` — current Course Journey implementation
- `src/app/components/learning-path/PathTimeline.tsx` — source of visual primitives
- `src/app/pages/LearningTrackDetail.tsx:524-559` — target Syllabus visual pattern
- `src/app/components/course/CourseJourneyNodeIndicator.tsx` — component being replaced
- `src/app/components/courses/ViewModeToggle.tsx` — timeline option to remove
- `src/app/pages/Courses.tsx:56-59,207-292,718-727` — timeline view mode code to remove
