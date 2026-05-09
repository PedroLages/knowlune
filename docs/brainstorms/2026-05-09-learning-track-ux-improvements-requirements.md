---
date: 2026-05-09
topic: learning-track-ux-improvements
---

# Learning Track UX Improvements

## Problem Frame
Users creating and navigating learning tracks encounter several UX friction points: no visual position indicators when selecting courses during creation, no drag-and-drop for reordering, a sticky-positioned progress sidebar, the first syllabus module expanded by default, and a CTA button that navigates to the course overview instead of directly to the lesson.

## Requirements

**Creation Dialog — Course Selection**
- R1. Selected courses in `InlineCoursePicker` display numbered position badges (1, 2, 3…) reflecting their order in the track.
- R2. Selected courses support drag-and-drop reordering via `@dnd-kit` (already in the codebase), in addition to the existing up/down chevron buttons.

**Detail Page — Progress Sidebar**
- R3. The `PathProgressSidebar` is not sticky-positioned; it scrolls naturally with the page content.
- R4. A track metadata card appears below the progress ring, displaying: difficulty label, estimated hours, course count, and created/updated dates.

**Detail Page — Syllabus**
- R5. All syllabus modules are collapsed by default. No module auto-expands on page load.

**Detail Page — CTA Navigation**
- R6. The hero banner "Start Learning" / "Continue Learning" button navigates directly to the first incomplete video lesson within the target course. If no progress exists, it navigates to the first lesson of the first course. The target course is the earliest-positioned course (by `LearningPathEntry.position`) with incomplete progress.

**Creation Constraint**
- R7. Learning tracks continue to require at least one course to be created. Empty tracks are not supported.

## Success Criteria
- Course order is visually obvious during creation (numbered badges)
- Courses can be reordered by dragging in the creation dialog
- The sidebar does not follow the user as they scroll through the syllabus
- First visit to a track detail page shows all modules collapsed
- Clicking "Start Learning" takes the user directly to a video lesson, not a course overview

## Scope Boundaries
- Reordering on the detail page timeline remains unsupported (creation/edit dialog only)
- No new npm packages — `@dnd-kit` is already in the codebase
- No data model changes — `LearningPathEntry.position` already stores order

## Key Decisions
- **Empty tracks rejected**: Keep the constraint requiring at least one course. Simpler UX, no empty-state edge cases.
- **Numbers + drag-and-drop over numbers-only**: The codebase already has `@dnd-kit`; adding drag handles to the course picker list is low-cost and significantly improves the reordering experience.
- **CTA to lesson, not course overview**: Learning tracks are linear by design — users should jump straight into the next lesson rather than stopping at a course landing page.
- **Sidebar stays, becomes non-sticky**: The progress ring is useful information; the issue was the sticky positioning, not the content.

## Dependencies / Assumptions
- `@dnd-kit/core` and `@dnd-kit/sortable` are already installed and used in `DashboardCustomizer` and `VideoReorderDialog`
- `LearningPathEntry.position` (1-based integer) is the source of truth for course ordering, already supported by `useLearningPathStore.reorderCourse()`
- `useNextBestCourse` hook (`src/app/hooks/useNextBestCourse.ts`) already resolves the first incomplete lesson for a course, with `getFirstLessonId()` fallback when no progress exists — available for R6

## Next Steps
-> /ce:plan for structured implementation planning
