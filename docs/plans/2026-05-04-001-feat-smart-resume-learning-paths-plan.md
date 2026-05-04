---
title: feat: Smart Resume — Path-to-Learning Bridge
type: feat
status: active
deepened: 2026-05-04
date: 2026-05-04
origin: docs/brainstorms/2026-05-03-learning-paths-05-smart-resume-requirements.md
---

# feat: Smart Resume — Path-to-Learning Bridge

## Overview

Learning paths currently function as a management destination. Users create paths, add courses, and leave the detail page — but the path system does not actively guide them back to learning. This plan implements the "Continue" primitive across three surfaces: a new `useNextBestCourse` hook, an Overview dashboard section, path card "Continue" buttons that bypass the detail page, and post-completion path continuity in the lesson player.

## Problem Frame

A user who creates a learning path, adds courses, and leaves the detail page must navigate through 4 steps to resume learning: path list → detail page → find the right course → click "Start". The data to solve this already exists (`usePathProgress`, `useMultiPathProgress`, `LearningPathEntry.position`). What is missing is the "Continue" primitive that bridges path organization and course consumption. (See origin doc for full problem statement.)

## Requirements Trace

- **R1.** `useNextBestCourse(pathId)` hook returning the earliest in-progress or next unstarted course per position order, or null if the path is complete. Return shape: `{ entry, course, action }`.
- **R2.** Hook reactively updates when course progress changes.
- **R3.** Overview dashboard "Continue Learning" section showing the next best course from the most recently active path.
- **R4.** Multiple in-progress paths: show most recent first with "N more" expand link.
- **R5.** Overview section uses existing dashboard card pattern near the top.
- **R6.** Path list card shows "Continue" button in footer for in-progress/unstarted paths.
- **R7.** "Continue" navigates directly to the course (bypassing path detail page).
- **R8.** Completed paths show "Review" button linking to path detail page.
- **R9.** Post-completion: after course completes and belongs to a path, show "Next in path" suggestion.
- **R10.** If completed course was last in path, show "Path complete! View your achievement."
- **R11-R12.** (Stretch) Cross-path resume hook and ranking — deferred.

## Scope Boundaries

- `useNextBestCourse` is read-only — does not modify path or course state
- Overview section is a new addition, not a redesign of the entire dashboard
- No changes to how progress is computed (`usePathProgress` consumed as-is)
- Lesson player post-completion behavior is extended, not redesigned — existing `NextCourseSuggestion` gets a path-aware sibling
- Cross-path resume (R11-R12) explicitly deferred

### Deferred to Separate Tasks

- Cross-path resume ranking (R11-R12): requires user research on ranking heuristics

## Context & Research

### Relevant Code and Patterns

- **`src/app/hooks/usePathProgress.ts`** — `usePathProgress` and `useMultiPathProgress` compute per-course `completionPct` via Dexie progress tables. Reactive via `PROGRESS_UPDATED_EVENT`. Return `PathProgressSummary` with `courseProgress: Map<string, CourseProgressInfo>`.
- **`src/stores/useLearningPathStore.ts`** — Zustand store with `paths[]`, `entries[]`, `getEntriesForPath(pathId)`, `setActivePath(pathId)`. Entries sorted by `position` (1-indexed).
- **`src/data/types.ts`** — `LearningPathEntry { id, pathId, courseId, courseType, position, ... }`, `LearningPath { id, name, createdAt, updatedAt, ... }`, `ImportedCourse { id, name, ... }`.
- **`src/app/pages/Overview.tsx`** — Configurable dashboard with `DashboardCustomizer`. Existing `ContinueLearning` component handles catalog course resume. New path section added as a new section entry.
- **`src/app/components/ContinueLearning.tsx`** — Hero card + RecentlyAccessedRow for catalog courses. Standalone — not modified.
- **`src/app/pages/LearningPaths.tsx`** — `PathCard` component with progress ring, thumbnails, footer. Currently shows: `ArrowRight` (in-progress), "Not Started" text, or "Review" text.
- **`src/app/hooks/useCompletionFlow.ts`** — `handleCelebrationOpenChange` triggers `setShowCourseSuggestion(true)` on course-level modal close.
- **`src/app/pages/UnifiedLessonPlayer.tsx`** — Renders `NextCourseSuggestion` below player when `showCourseSuggestion` is true.
- **`src/app/components/NextCourseSuggestion.tsx`** — Tag-based next course suggestion card.
- **`src/stores/useContentProgressStore.ts`** — Per-lesson completion status via `statusMap`. Emits `course:completed` on `appEventBus` when all modules done.
- **`src/lib/eventBus.ts`** — Typed event bus with `course:completed` event type.
- **`src/app/routes.tsx`** — Lesson player route: `/courses/:courseId/lessons/:lessonId`.
- **`src/lib/progress.ts`** — `PROGRESS_UPDATED_EVENT`, `getAllProgress()` for localStorage progress.
- **Component pattern:** All dashboard sections use `motion.section` with `fadeUp` variants, consistent `rounded-2xl` cards with `border-border/50`.
- **Test pattern:** `src/app/pages/__tests__/LearningPaths.test.tsx`, `src/app/pages/__tests__/Overview.test.tsx`, `src/stores/__tests__/useLearningPathStore.test.ts`.

### Institutional Learnings

- `docs/solutions/best-practices/learning-paths-import-from-path-patterns-2026-05-03.md` — Patterns for learning path data access.
- `docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md` — Lessons from previous path feature work.
- `docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md` — Integration patterns for the lesson player.

## Key Technical Decisions

- **`useNextBestCourse` consumes `useMultiPathProgress` internally:** Rather than re-implementing progress computation, the hook builds on the existing `useMultiPathProgress` which already provides per-course `completionPct` and is reactive. This keeps the new hook thin — position-order traversal over the pre-computed progress map.
- **Per-path hook (not cross-path):** The hook takes a single `pathId`. Cross-path ranking (R11-R12) is deferred; the Overview section derives per-path next courses from the aggregate `useMultiPathProgress` result rather than calling the hook in a loop (avoiding React Rules of Hooks violation).
- **Navigation target for path card "Continue":** Navigates directly to the lesson player at `/courses/${courseId}/lessons/${targetLessonId}`, satisfying R7's requirement for 1-click resume to the exact lesson. The target lesson ID is determined by `useNextBestCourse` based on per-lesson progress data.
- **`useNextBestCourse` returns `targetLessonId`:** The hook's return shape includes the target lesson ID — the first incomplete lesson for 'resume' action, or the first lesson for 'start' action. This keeps the navigational decision centralized in the hook rather than distributed across callers.
- **Post-completion uses a new `NextInPath` component:** Rather than modifying `NextCourseSuggestion` (tag-based), a new dedicated component handles path-based continuity. The lesson player conditionally renders one or the other based on whether the completed course belongs to a path.
- **New Overview section, not a replacement:** The existing `ContinueLearning` section handles catalog course resume. The new "Continue Learning Paths" section sits alongside it near the top of the dashboard.

## Implementation Units

- [ ] **Unit 1: `useNextBestCourse` hook**

**Goal:** Create a read-only hook that returns the next course to resume for a given learning path.

**Requirements:** R1, R2

**Dependencies:** None (only existing hooks/stores)

**Files:**
- Create: `src/app/hooks/useNextBestCourse.ts`
- Test: `src/app/hooks/__tests__/useNextBestCourse.test.ts`

**Approach:**
- Accept `pathId: string` and optionally a `paths`/`entries` override (for use outside the store, e.g., testing)
- Internally call `useLearningPathStore(s => s.getEntriesForPath(pathId))` to get sorted entries
- Build a `Map<string, LearningPathEntry[]>` with just this path's entries
- Call `useMultiPathProgress` with that map to get per-course `completionPct`
- Traverse entries in position order: return the first entry where `completionPct > 0 && completionPct < 100` (action: `'resume'`), or the first where `completionPct === 0` (action: `'start'`), or `null` with action `'complete'` if all are 100%
- Look up the `ImportedCourse` from `useCourseImportStore(s => s.importedCourses)`
- For 'resume' action: determine `targetLessonId` by finding the first incomplete lesson using `useContentProgressStore(s => s.statusMap)` — traverse lessons in order, return the first where status is not 'completed'
- For 'start' action: use the first lesson ID from the course's lesson structure (the course's first lesson)
- For 'complete' or null actions: `targetLessonId` is null (no navigation needed)
- Return shape: `{ entry: LearningPathEntry | null, course: ImportedCourse | null, action: 'resume' | 'start' | 'complete' | null, targetLessonId: string | null }`
- Reactivity: inherited from `useMultiPathProgress` which watches `PROGRESS_UPDATED_EVENT`
- Pure computation from existing store data — no network calls, sub-10ms

**Patterns to follow:**
- `usePathProgress.ts` — existing hook pattern with `useState` + `useEffect` + event listeners
- `useMultiPathProgress` — batch-loading pattern (though this hook only needs one path)

**Test scenarios:**
- Happy path: Returns the first in-progress entry (completionPct=50) when one exists
- Happy path: Returns the first unstarted entry when no courses are in progress
- Edge case: Returns null with action 'complete' when all courses are at 100%
- Edge case: Returns null with action null when entries array is empty
- Edge case: Handles a single course path — returns 'resume' for in-progress, 'complete' for finished
- Happy path: Returns correct `targetLessonId` for resume (first incomplete lesson based on `statusMap`)
- Happy path: Returns correct `targetLessonId` for start (first lesson in course lesson structure)
- Edge case: All lessons complete but course progress is < 100% — falls back to first lesson as target
- Integration: Re-computes when progress changes (verify by mocking `PROGRESS_UPDATED_EVENT` dispatch)
- Error path: Handles missing course (entry exists but no matching `ImportedCourse`) — returns entry with null course

**Verification:**
- Unit tests pass for all scenarios
- Hook returns correct action type for each state

- [ ] **Unit 2: Overview dashboard "Continue Learning Path" section**

**Goal:** Add a new dashboard section showing the user's path-based resume options.

**Requirements:** R3, R4, R5

**Dependencies:** Unit 1 (`useNextBestCourse`)

**Files:**
- Create: `src/app/components/ContinueLearningPathSection.tsx`
- Modify: `src/app/pages/Overview.tsx` (add section renderer + register in `sectionRenderers`)
- Test: `src/app/pages/__tests__/Overview.test.tsx` (extend existing)

**Approach:**
- Create a new component `ContinueLearningPathSection` that:
  - Uses `useLearningPathStore(s => s.paths)` and `useLearningPathStore(s => s.entries)` to get all paths and entries
  - Groups entries by `pathId` into a `Map<string, LearningPathEntry[]>` (a single map computation, not a per-path hook call)
  - Calls `useMultiPathProgress(entriesByPathMap)` to get per-course progress for ALL paths in a single hook call — this is the key fix: it avoids calling a hook inside a loop, satisfying React's Rules of Hooks
  - Derives the next best course per path by traversing each path's sorted entries in position order over the pre-computed progress map, identifying the first entry where `completionPct > 0 && completionPct < 100` (resume) or `completionPct === 0` (start) — no loop-based hooks needed
  - Filters to paths that have a non-null result (ignores empty or complete paths with no actionable course)
  - Shows the most recently active/updated path as the primary card
  - Displays: path name (small, muted text), course title (prominent), progress bar (if in-progress), "Continue" button
  - If more than 1 path has a next course, shows "N more paths in progress" link that expands to show secondary cards
  - If no paths exist or all are complete with no actionable course, renders nothing (graceful empty state)
- "Continue" button navigates to `/courses/${courseId}/lessons/${targetLessonId}` where `courseId` and `targetLessonId` come from the derived next best course result
- Use `motion.section` with `fadeUp` variants matching existing dashboard section patterns (`rounded-2xl`, `border-border/50`, `bg-card`, `p-[var(--content-padding)]`)
- Insert the section renderer in `Overview.tsx`'s `sectionRenderers` object with section ID `'continue-learning-path'`
- Position it near the top — register it early in the `sectionOrder` (after `recommended-next` or `metrics-strip`)

**Patterns to follow:**
- `ContinueLearning.tsx` hero card pattern (but simpler — no 3D tilt)
- Existing dashboard sections in `Overview.tsx` (`sectionRenderers` pattern)
- `ReadingOverviewSection` for how external sections are structured

**Test scenarios:**
- Happy path: Section renders when paths exist with in-progress courses
- Happy path: Shows correct path name, course title, progress percentage
- Happy path: Clicking "Continue" navigates to `/courses/{courseId}/lessons/{targetLessonId}`
- Edge case: Renders nothing (null) when no user paths exist
- Edge case: Renders nothing when all paths are complete or empty
- Edge case: Shows "N more paths" when multiple paths have in-progress courses
- Edge case: Expand link reveals secondary path cards
- Edge case: Single path with one unstarted course shows "Start" action
- Integration: Section re-renders when progress changes (reactive)

**Verification:**
- Overview page renders the section in correct position
- Section content updates when progress changes
- All edge cases render without error

- [ ] **Unit 3: Path card "Continue" button**

**Goal:** Add a "Continue" button to path cards that navigates directly to the course (bypassing path detail page).

**Requirements:** R6, R7, R8

**Dependencies:** Unit 1 (`useNextBestCourse`)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx` (PathCard component + parent computation)
- Test: `src/app/pages/__tests__/LearningPaths.test.tsx` (extend existing)

**Approach:**
- In the parent `LearningPaths` component, compute a `Map<pathId, { entry, course, action }>` using `useNextBestCourse` for each path
- Pass the `nextCourseInfo` as a prop to each `PathCard` (or compute inside PathCard using `useNextBestCourse`)
- **Prefer prop approach** since `useNextBestCourse` is a hook and would need to be called per path, which is fine but cleaner to compute in parent and pass down
- In `PathCard`, replace the current footer (`ArrowRight` / "Not Started" / "Review") with:
  - **In-progress (action='resume'):** "Continue 'Course Name'" Button — navigates to `/courses/${courseId}/lessons/${targetLessonId}` (lesson player)
  - **Unstarted (action='start'):** "Start 'Course Name'" Button — navigates to `/courses/${courseId}/lessons/${targetLessonId}` (lesson player)
  - **Completed (action='complete'):** "Review" Button — navigates to `/learning-paths/${path.id}` (detail page)
  - **No courses or empty:** Keep existing behavior (no button, or "Not Started" text)
- The footer structure changes from a plain `<Link>` wrapping to a `<div>` with a `<Button>` for the continue action
- Style the "Continue" button using `variant="brand"` for visual prominence
- Maintain existing keyboard accessibility and ARIA labels

**Patterns to follow:**
- Existing `PathCard` footer structure (border-t, flex layout)
- `Button` usage patterns throughout the app

**Test scenarios:**
- Happy path: Path with in-progress course shows "Continue" button with correct course name
- Happy path: Path with only unstarted courses shows "Start" button
- Happy path: Completed path shows "Review" button
- Happy path: Clicking "Continue" navigates to `/courses/{courseId}/lessons/{targetLessonId}`
- Happy path: Clicking "Review" navigates to `/learning-paths/{pathId}`
- Edge case: Empty path (no entries) shows no continue/start button
- Edge case: Path with course whose imported data is missing shows fallback text
- Edge case: Button labels truncate for long course names
- Integration: Button updates when progress changes (reactive)

**Verification:**
- Path card renders correct button for each progress state
- Navigation targets match expected routes
- Existing tests still pass

- [ ] **Unit 4: Post-completion path continuity in lesson player**

**Goal:** After completing a course that belongs to a path, show "Next in path" suggestion or path completion message.

**Requirements:** R9, R10

**Dependencies:** Unit 1 (`useNextBestCourse`)

**Files:**
- Create: `src/app/components/NextInPath.tsx`
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx` (conditionally render `NextInPath` vs `NextCourseSuggestion`)
- Test: `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx` (extend existing)

**Approach:**
- Create `NextInPath` component:
  - Props: `{ pathName: string, courseName: string, isLastInPath: boolean, targetLessonId: string | null, onNavigate: () => void, onDismiss: () => void }`
  - Shown after course-level celebration modal closes (same trigger point as existing `NextCourseSuggestion`)
  - For non-last course: shows "Next in path: [Course Name]" with a "Continue" button that navigates to `/courses/${courseId}/lessons/${targetLessonId}`
  - For last course: shows "Path complete! View your achievement" with a link to `/learning-paths/${pathId}`
  - Matches the visual style of the existing `NextCourseSuggestion` component (rounded card, thumbnail area)
- In `UnifiedLessonPlayer.tsx`:
  - After the completion modal closes (`showCourseSuggestion` becomes true), determine path membership locally by querying `useLearningPathStore(s => s.entries)` filtered by the completed `courseId` — this avoids coupling `useCompletionFlow` with path-specific context
  - If the course belongs to a path, use `useNextBestCourse(pathId)` to find the next course and its `targetLessonId`
  - Render `NextInPath` instead of `NextCourseSuggestion`, passing path context directly as props
  - If no path membership is found, render the existing `NextCourseSuggestion` (current behavior unchanged)
- **`useCompletionFlow.ts` is NOT modified** — path context is determined entirely within `UnifiedLessonPlayer.tsx`, keeping the completion flow generic

**Patterns to follow:**
- `NextCourseSuggestion.tsx` — visual layout, card pattern, dismissal behavior

**Test scenarios:**
- Happy path: Course completes, belongs to a path with more courses — shows "Next in path: [Course Name]"
- Happy path: Course completes, is last in path — shows "Path complete! View your achievement"
- Happy path: Clicking "Continue" navigates to the next course's lesson player
- Happy path: Clicking "View achievement" navigates to path detail page
- Edge case: Course belongs to multiple paths (should pick the first match or most recently active)
- Edge case: Course completes but is not in any path — falls back to existing `NextCourseSuggestion`
- Edge case: Dismiss button works correctly
- Edge case: Course completes but the next course's data is missing — shows graceful fallback text
- Integration: Post-completion suggestion renders after celebration modal closes

**Verification:**
-`NextInPath` renders correctly for both pending-next and last-course scenarios
- Existing `NextCourseSuggestion` behavior is unchanged for courses not in paths
- All existing lesson player tests pass

## System-Wide Impact

- **Interaction graph:** `useNextBestCourse` depends on `useMultiPathProgress`, `useLearningPathStore`, and `useCourseImportStore`. All are already reactive — no new subscriptions needed.
- **Error propagation:** The hook is pure computation over store data — no async operations. Errors are limited to null/undefined handling for missing courses or entries.
- **State lifecycle risks:** The "Continue" button on the path card could briefly show stale data if the user completes a lesson and immediately returns to the path list. This is acceptable — the next render cycle (triggered by `PROGRESS_UPDATED_EVENT`) corrects it within milliseconds.
- **Unchanged invariants:** The existing `ContinueLearning` component (catalog course resume), `NextCourseSuggestion` (tag-based), `usePathProgress`, and `useMultiPathProgress` are not modified. All new code is additive.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `useNextBestCourse` creates a circular dependency if it uses `usePathProgress` inside a component that also receives computed path data | Solution: the hook computes its own derived state from `useMultiPathProgress` — no circular dependency |
| Multiple paths could contain the same course — post-completion suggestion should pick the right one | Choose the most recently active/updated path containing this course |
| Reactive updates may cause flicker if progress events fire rapidly during lesson completion | `useMultiPathProgress` already batches via `useEffect` — no additional concern |

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-03-learning-paths-05-smart-resume-requirements.md`
- Related code: `src/app/hooks/usePathProgress.ts`, `src/stores/useLearningPathStore.ts`, `src/app/pages/LearningPaths.tsx`, `src/app/pages/Overview.tsx`, `src/app/pages/UnifiedLessonPlayer.tsx`, `src/app/hooks/useCompletionFlow.ts`
- Related PRs/issues: Learning Paths epic (E26+)
