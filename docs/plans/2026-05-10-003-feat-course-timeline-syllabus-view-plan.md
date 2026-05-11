---
title: feat: Add timeline/syllabus view mode to courses page
type: feat
status: active
date: 2026-05-10
---

# feat: Add timeline/syllabus view mode to courses page

## Overview

Add a fourth view mode — "Timeline" — to the `/courses` page that displays imported courses in a vertical syllabus tree, matching the visual pattern from the learning-tracks `PathTimeline`. Each course appears as an expandable card showing its internal modules and lessons, letting users browse course content without navigating away.

## Problem Frame

The courses page currently offers Grid, List, and Compact views — all of which show course-level metadata (thumbnail, title, stats, progress). Users familiar with the learning-tracks syllabus tree want the same experience on the courses page: a vertical timeline that reveals what's inside each course (modules, lessons, durations) at a glance. This reduces navigation friction — users can scan course content directly from the list page instead of clicking into each course's overview.

## Requirements Trace

- R1. Users can switch to a "Timeline" view mode on the courses page via the existing `ViewModeToggle`
- R2. The timeline shows all imported courses (respecting active status filters and sort order) as entries in a vertical tree
- R3. Each course entry is expandable — revealing its internal modules/chapters and individual lessons (videos) with durations and completion status
- R4. Course entries show a visual status indicator (not-started, in-progress, completed, paused) using the same `StatusCircle` pattern from learning tracks
- R5. Clicking a lesson navigates to the lesson player (`/courses/:courseId/lessons/:videoId`), consistent with existing behavior
- R6. The timeline view preference is persisted via `useEngagementPrefsStore` (localStorage + Supabase bridge)
- R7. Existing Grid/List/Compact views continue to work unchanged

## Scope Boundaries

- The timeline view does NOT implement locking/progression logic (courses are independent, unlike learning track sequence)
- The timeline view does NOT support gap entries or manual module completion (learning-track-specific features)
- The timeline view does NOT replace or modify the existing CourseOverview "Course Journey" — that remains the dedicated course detail page
- Course metadata editing (tags, status, delete) in timeline mode should remain accessible (at minimum via existing overflow menu pattern)

### Deferred to Separate Tasks

- Extracting `StatusCircle` and `LessonRow` as fully independent shared components usable outside `PathTimeline` and `CourseTimelineView`: future refactor when a third consumer emerges

## Context & Research

### Relevant Code and Patterns

- **PathTimeline** (`src/app/components/learning-path/PathTimeline.tsx`) — the reference visual pattern: vertical timeline connector, `StatusCircle` dots, expandable `CourseTimelineEntry` cards with `LessonRow` items, `AnimatePresence` transitions
- **CourseOverview "Course Journey"** (`src/app/pages/CourseOverview.tsx`, lines ~476-560) — already renders a single-course syllabus tree using `buildGroupedCurriculum()` from `src/lib/curriculumGrouping.ts`, proving the data grouping approach works for imported courses
- **Courses.tsx** (`src/app/pages/Courses.tsx`) — the target page; manages filters, sort, view mode switching, and renders course cards via `VirtualizedCoursesList`
- **ViewModeToggle** (`src/app/components/courses/ViewModeToggle.tsx`) — three-option ToggleGroup; needs a fourth option
- **useEngagementPrefsStore** (`src/stores/useEngagementPrefsStore.ts`) — `CourseViewMode` type is `'grid' | 'list' | 'compact'`; needs `'timeline'` added
- **buildGroupedCurriculum** (`src/lib/curriculumGrouping.ts`) — groups `ImportedVideo[]`, `ImportedPdf[]`, and `YouTubeCourseChapter[]` into `ChapterGroup[]`; already used by both LearningTrackDetail and CourseOverview
- **VirtualizedCoursesList** (`src/app/components/courses/VirtualizedCoursesList.tsx`) — wraps course items with `@tanstack/react-virtual` for 30+ items; timeline view likely bypasses virtualization since each entry has variable expandable height
- **ImportedCourseCard** (`src/app/components/figma/ImportedCourseCard.tsx`) — the grid-mode card; shows the overflow menu pattern (edit, delete, change thumbnail, status change) that timeline entries should also provide

### Institutional Learnings

- **Settings bridge checklist** (`docs/solutions/best-practices/2026-04-25-engagement-prefs-bridge-checklist.md`) — adding any new preference to `useEngagementPrefsStore` requires 8 coordinated changes across the store, `settings.ts`, and Supabase hydration
- **Mobile timeline simplification** (`docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md`) — the `simplified` boolean prop pattern on `PathTimeline` was chosen over a separate component to avoid duplicating branching logic; for the courses timeline, a new component is warranted because the data model and interaction model differ (no locking, no gaps, no manual completion)

### External References

None — this is a repo-pattern-driven feature with strong local examples.

## Key Technical Decisions

- **New component over PathTimeline reuse**: `PathTimeline` is tightly coupled to `LearningPathEntry` + gap resolution + locking progression. Creating a new `CourseTimelineView` component avoids contorting course data into the wrong shape and keeps each component's concerns separate. The new component borrows visual patterns (vertical connector, status dots, expandable accordion) but owns its data model and interactions.
- **Duplicate StatusCircle and LessonRow internally**: Rather than extracting these as shared components now (which would require touching PathTimeline and its tests), duplicate them inside the new component. Extraction becomes worthwhile when a third consumer appears (see Deferred to Separate Tasks).
- **Data fetching via dedicated hook**: A `useCourseTimelineData` hook fetches per-course lesson data (videos, PDFs, chapters, progress) from Dexie for the filtered/sorted course list. This follows the same pattern used in `LearningTrackDetail.tsx` (lines ~200-280).
- **No virtualization for timeline**: Each course entry has variable height (collapsed ~120px, expanded up to ~600px+), making `@tanstack/react-virtual`'s fixed-height estimation unreliable. For typical course counts (< 50), rendering all entries with `overflow-auto` on the container is acceptable. If performance becomes an issue with 100+ courses, virtualization can be added later with dynamic measurement.

## Open Questions

### Resolved During Planning

- **Should the timeline reuse PathTimeline or be a new component?**: New component — PathTimeline's data model (LearningPathEntry), locking logic, and gap resolution don't map to independent courses
- **Should timeline entries be expandable to show lessons?**: Yes — this is the core value of the syllabus tree pattern
- **Mobile responsiveness of the timeline**: On screens < 768px, hide the timeline connector column and use a simplified layout with left-aligned status dots (20px instead of 28px) and full-width cards — resolved as documented in Unit 3

### Deferred to Implementation

- **Exact Tailwind classes for the timeline connector line**: Will be adapted from PathTimeline's connector pattern during implementation
- **Whether to show PDFs as entries in the lesson accordion**: Current CourseOverview only shows videos; implementer should match that behavior initially

## Implementation Units

- [ ] **Unit 1: Add 'timeline' to CourseViewMode type and engagement prefs**

**Goal:** Extend the type system and persistence layer to recognize the new view mode

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/stores/useEngagementPrefsStore.ts`
- Modify: `src/lib/settings.ts`

**Approach:**
- Add `'timeline'` to the `CourseViewMode` union type
- Add `'timeline'` to `VALID_COURSE_VIEW_MODES` array
- Follow the 8-step settings bridge checklist from `docs/solutions/best-practices/2026-04-25-engagement-prefs-bridge-checklist.md`:
  1. Sanitizer in `loadPersistedPrefs`
  2. State persistence in `setPreference`
  3. `saveSettings` bridge branch
  4. `saveSettingsToSupabase` bridge branch
  5. Reset-defaults bridge entry
  6. Sanitizer in `getSettings` (`settings.ts`)
  7. `UserSettingsPatch` type extension (`settings.ts`)
  8. Hydration block in `hydrateSettingsFromSupabase` (`settings.ts`)

**Patterns to follow:**
- Existing `'grid' | 'list' | 'compact'` handling in the same files

**Test scenarios:**
- Happy path: Setting `courseViewMode` to `'timeline'` persists across page reload (localStorage)
- Edge case: Invalid/unknown value in stored prefs is sanitized to the default (`'grid'`)
- Integration: `'timeline'` value survives the `saveSettings` → `getSettings` round-trip

**Verification:**
- `CourseViewMode` union includes `'timeline'`
- Setting the pref to `'timeline'` and reloading the page restores the timeline view

---

- [ ] **Unit 2: Update ViewModeToggle with timeline option**

**Goal:** Add a fourth toggle button for the timeline view

**Requirements:** R1

**Dependencies:** Unit 1 (type must exist)

**Files:**
- Modify: `src/app/components/courses/ViewModeToggle.tsx`

**Approach:**
- Add a fourth entry to the `OPTIONS` array: `{ value: 'timeline', label: 'Timeline view', Icon: GitBranch }` (using `GitBranch` from lucide-react, which is already in the project's dependencies)
- Extend the guard in `onValueChange` to accept `'timeline'`

**Patterns to follow:**
- Existing `OPTIONS` entries for grid/list/compact

**Test scenarios:**
- Happy path: Clicking the timeline toggle button switches the view to timeline mode
- Happy path: All four toggle options are visible and selectable
- Edge case: Toggle correctly reflects the current `courseViewMode` value from the store

**Verification:**
- ViewModeToggle renders 4 options
- Clicking "Timeline" calls `onChange('timeline')`

---

- [ ] **Unit 3: Create CourseTimelineView component**

**Goal:** Build the main timeline component that renders courses in a vertical syllabus tree with expandable lesson accordions

**Requirements:** R2, R3, R4, R5

**Dependencies:** Unit 1 (type exists for props)

**Files:**
- Create: `src/app/components/courses/CourseTimelineView.tsx`
- Test: `src/app/components/courses/__tests__/CourseTimelineView.test.tsx`

**Approach:**
- Accept props: `courses: ImportedCourse[]`, `completionMap: Map<string, number>`, `momentumMap: Map<string, MomentumScore>`, `progressMap: Map<string, VideoProgress>`, `lessonGroupsByCourse: Map<string, ChapterGroup[]>`, `isLoading: boolean`
- Render behavior based on `isLoading` and data availability:
  - When `isLoading=true`: show skeleton placeholder with 3-5 `bg-muted` pulsing cards matching timeline entry layout; visible at least 300ms to prevent flash-of-content
  - When `isLoading=false` and `courses` is empty: render empty state message
  - Otherwise: render the full vertical timeline
- The vertical timeline layout includes:
  - A left connector column (thin vertical line + status dot) for each course
  - `StatusCircle` (duplicated from PathTimeline, adapted for course status: completed=green check, active=brand pulsing, not-started=muted hollow, paused=yellow)
  - `CourseTimelineEntry` cards showing: course title, author, video/PDF counts, duration, progress bar, momentum badge, status badge, expand/collapse chevron
  - When expanded: `LessonRow` items (duplicated from PathTimeline) showing individual videos with completion check, filename, and duration
  - `AnimatePresence` for accordion expand/collapse transitions (matching PathTimeline's animation pattern)
- Include an overflow menu on each course entry (delete, edit, status change) following the same pattern as `ImportedCourseCard`
- On screens < 768px: hide the timeline connector column, use left-aligned status dots (20px instead of 28px) with full-width cards in a simplified layout — matching PathTimeline's `simplified` prop pattern
- Group lessons using `buildGroupedCurriculum()` (already imported in Courses.tsx, pass result via props)
- Each lesson row links to `/courses/:courseId/lessons/:videoId`

**Patterns to follow:**
- `PathTimeline.tsx` — vertical connector layout, `StatusCircle` variants, `AnimatePresence` accordion, `LessonRow` structure
- `CourseOverview.tsx` "Course Journey" section — `buildGroupedCurriculum` usage for imported courses
- `ImportedCourseCard.tsx` — overflow menu pattern (edit, delete, status change, thumbnail)

**Test scenarios:**
- Happy path: Renders a course entry for each course in the list
- Happy path: Clicking expand reveals lesson rows grouped by module/chapter
- Happy path: Clicking a lesson row navigates to the correct lesson player URL
- Happy path: Completed courses show green check status dot; active courses show brand pulsing dot
- Happy path: Overflow menu provides edit, delete, and status change actions
- Edge case: Course with no videos shows "No lessons" message and is not expandable
- Edge case: Course with many modules (10+) renders all accordion sections correctly
- Edge case: Empty courses array renders an empty state message
- Edge case: Course with 0% completion shows muted hollow dot
- Error path: Missing video data gracefully degrades (shows course entry without expand)

**Verification:**
- Timeline renders all courses from the filtered/sorted list
- Expand/collapse works per course independently
- Lesson links point to correct URLs

---

- [ ] **Unit 4: Integrate timeline view into Courses.tsx**

**Goal:** Wire the new view mode into the courses page with data fetching, filtering, and rendering

**Requirements:** R1, R2, R7

**Dependencies:** Unit 2 (toggle), Unit 3 (component)

**Files:**
- Modify: `src/app/pages/Courses.tsx`
- Test: `tests/e2e/courses-timeline-view.spec.ts`

**Approach:**
- Add a `courseViewMode === 'timeline'` branch in the render function (alongside existing grid/list/compact branches)
- Hide `GridColumnControl` when in timeline mode (columns are irrelevant for vertical layout)
- Create a `useCourseTimelineData` hook (or inline logic) that fetches per-course lesson data from Dexie when in timeline mode:
  - Track loading state: `isLoading` is `true` during initial fetch, `false` once data resolves
  - Query `db.importedVideos`, `db.importedPdfs`, `db.youtubeChapters`, `db.progress` for the filtered course IDs
  - Build `lessonGroupsByCourse` using `buildGroupedCurriculum()`
  - Memoize results to avoid re-fetching on every render
  - Return `{ isLoading, completionMap, momentumMap, progressMap, lessonGroupsByCourse }` to the parent
- Pass all fetched data plus `isLoading` to `<CourseTimelineView>`
- Timeline view does NOT go through `VirtualizedCoursesList` (variable-height entries don't work with fixed-size virtual estimation) — rendered directly in a plain scrollable container as a sibling branch alongside grid/list/compact
- Wrap the timeline in a scrollable container matching the page layout
- Listen for the `study-log-updated` custom event on `window` and re-fetch timeline progress data when it fires, consistent with the existing event listener pattern in Courses.tsx

**Patterns to follow:**
- Existing view mode branching in `Courses.tsx` (lines ~466-491)
- Data fetching pattern from `LearningTrackDetail.tsx` (lines ~200-280) — query Dexie tables by course ID, build maps, pass to component

**Test scenarios:**
- Happy path: Switching to timeline view displays courses in a vertical tree
- Happy path: Status filters (Not Started, Active, Completed, Paused) work in timeline mode
- Happy path: Sort modes (Recent, Momentum) order courses correctly in the timeline
- Happy path: Switching back to grid view restores the grid layout
- Integration: Clicking a lesson in the timeline navigates to the lesson player and back
- Edge case: No courses match the active filter → timeline shows empty state
- Edge case: Single course with no lessons → renders course entry without expand

**Verification:**
- ViewModeToggle switches between all 4 modes
- Timeline view respects filters and sort
- Existing grid/list/compact views unaffected

## System-Wide Impact

- **Interaction graph:** `ViewModeToggle` → `useEngagementPrefsStore.setPreference` → `saveSettings` → `saveSettingsToSupabase`. The new `'timeline'` value flows through the same path as existing modes.
- **Error propagation:** Dexie query failures in `useCourseTimelineData` should surface via existing toast patterns; individual course lesson data failures should degrade per-course (show entry without expand) rather than failing the whole timeline
- **State lifecycle risks:** The `'study-log-updated'` custom event listener in Courses.tsx refreshes completion data — this should also trigger a refresh of the timeline's progress data
- **API surface parity:** The `CourseViewMode` type is consumed by `ViewModeToggle`, `Courses.tsx`, and `useEngagementPrefsStore` — all must be updated. `VirtualizedCoursesList` is bypassed in timeline mode (variable-height entries), so it does not need changes. No external API surface.
- **Integration coverage:** The timeline bypasses `VirtualizedCoursesList`'s virtualizer, so scrolling behavior differs from grid/list. Test scroll position restoration when navigating to a lesson and back.
- **Unchanged invariants:** `gridClassName.ts` and its `CourseGridViewMode` type (`'grid' | 'compact'`) do not change — timeline is not a grid variant. `ImportedCourseCard`, `ImportedCourseCompactCard`, and `ImportedCourseListRow` are unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Fetching lesson data for all courses could be slow with many courses | Use Dexie compound queries (`where('courseId').anyOf(ids)`) which are indexed and efficient; memoize results |
| Duplicating StatusCircle/LessonRow creates visual drift from PathTimeline | Keep the duplicated code intentionally aligned; if they diverge, extraction becomes the remedy (see Deferred to Separate Tasks) |
| Timeline with 50+ courses could cause layout thrashing | Each collapsed entry is ~120px; 50 courses = 6000px scrollable content — acceptable. Expand is user-initiated, one at a time |

## Sources & References

- Origin: User request — "same course tree (Syllabus) from the learning-tracks/ into /courses page"
- Reference component: `src/app/components/learning-path/PathTimeline.tsx`
- Reference page: `src/app/pages/CourseOverview.tsx` (Course Journey section)
- Reference page: `src/app/pages/LearningTrackDetail.tsx` (data fetching pattern)
- Settings bridge: `docs/solutions/best-practices/2026-04-25-engagement-prefs-bridge-checklist.md`
- Curriculum grouping: `src/lib/curriculumGrouping.ts`
