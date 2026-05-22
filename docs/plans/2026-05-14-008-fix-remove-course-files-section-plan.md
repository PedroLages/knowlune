---
title: Remove "Course files" section from course overview page
type: fix
status: active
date: 2026-05-14
---

# Remove "Course files" section from course overview page

## Overview

Remove the "Course files" section (the `LessonList` component with folder grouping, file-status badges, search, and progress bars) from the bottom of the `CourseOverview` page at `/courses/:courseId`. The syllabus timeline already surfaces all lessons with their completion status, making the duplicate file listing redundant.

## Problem Frame

The `CourseOverview` page (`src/app/pages/CourseOverview.tsx`) currently renders two lesson-oriented sections:

1. **Syllabus** (lines 476-797) — the primary curriculum timeline with accordion modules, status circles, completion indicators, and navigable lesson rows
2. **Course files** (lines 799-821) — a secondary `LessonList` section with folder/chapter grouping, file-status badges (`File not found`, `Permission needed`), search/filter, and collapsible groups

The Course files section is conditionally rendered only for local (non-network) courses with videos or PDFs. It duplicates information already presented in the Syllabus and adds visual noise at the bottom of the page without offering unique functionality.

Removing it simplifies the page, reduces the data dependency on `useFileStatusVerification` in this component, and keeps a single canonical lesson listing (the Syllabus timeline).

## Requirements Trace

- **R1.** The "Course files" heading and `LessonList` component are no longer rendered on the `CourseOverview` page.
- **R2.** Unused imports (`LessonList`, `useFileStatusVerification`) and the unused `fileStatuses` hook call are removed from `CourseOverview.tsx`.
- **R3.** The `LessonList` component and `useFileStatusVerification` hook remain available for other consumers (`UnifiedCourseDetail` still uses both).

## Scope Boundaries

- **In scope:** Removing the Course files section JSX, its related imports, and the `fileStatuses` variable from `CourseOverview.tsx`.
- **Out of scope:** Deleting or modifying `LessonList` component, `useFileStatusVerification` hook, or `UnifiedCourseDetail` page. Changes to the Syllabus locking behavior (covered by plan #007).

## Context & Research

### Relevant Code and Patterns

- `src/app/pages/CourseOverview.tsx` lines 799-821 — the conditional "Course files" section to remove
- `src/app/pages/CourseOverview.tsx` line 32 — `useFileStatusVerification` import (becomes unused)
- `src/app/pages/CourseOverview.tsx` line 44 — `LessonList` import (becomes unused)
- `src/app/pages/CourseOverview.tsx` line 100 — `fileStatuses` variable (becomes unused)
- `src/app/pages/UnifiedCourseDetail.tsx` lines 26, 196, 374 — still uses `useFileStatusVerification` and `LessonList` (unchanged)
- `src/app/components/course/LessonList.tsx` — the component itself (unchanged, still used by `UnifiedCourseDetail`)

### Institutional Learnings

- `docs/solutions/best-practices/course-detail-syllabus-unification-implementation-lessons-2026-05-12.md` — the syllabus timeline is the canonical lesson listing for `CourseOverview`; the `LessonList` was a legacy holdover from before the unification.

### External References

None required — pure removal with no new behavior.

## Key Technical Decisions

- **Remove, don't hide:** Delete the section's JSX, its related imports, and the `fileStatuses` variable outright rather than commenting out or feature-flagging. The section has no unique functionality not already present in the Syllabus.
- **Keep the shared dependencies:** `LessonList` and `useFileStatusVerification` remain in the codebase because `UnifiedCourseDetail` still consumes both.

## Implementation Units

- [ ] **Unit 1: Remove Course files section from CourseOverview**

**Goal:** Strip the "Course files" section, its related imports, and the now-unused `fileStatuses` variable from the course overview page.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/CourseOverview.tsx`

**Approach:**
- Remove the four items below from highest line number to lowest (to avoid line-number drift as earlier lines are deleted):
  1. Lines 799-821: the entire conditional `{capabilities && !capabilities.requiresNetwork && ...}` block (the JSX)
  2. Line 100: `const fileStatuses = useFileStatusVerification(videos, pdfs)`
  3. Line 44: `import { LessonList } from '@/app/components/course/LessonList'`
  4. Line 32: `import { useFileStatusVerification } from '@/hooks/useFileStatusVerification'`
- Build and type-check to confirm no remaining references.
- **Side-effect note:** Removing `useFileStatusVerification` from this page also removes the aggregated toast that alerts users to missing or permission-denied files on the overview route. `UnifiedCourseDetail` still runs the same hook and fires the same toast, so the warning is preserved on the detail page.

**Patterns to follow:**
- Standard import cleanup — remove only what becomes unused; keep the import order intact.

**Test scenarios:**
- Test expectation: none — pure removal with no new behavior. Existing tests for `CourseOverview` continue to pass unchanged (no test references the "Course files" section). The `LessonList` and `useFileStatusVerification` tests remain unaffected since those modules are not deleted.

**Verification:**
- `npm run build` succeeds with no unused import warnings.
- `npx tsc --noEmit` passes.
- Manual smoke: navigate to a local course at `/courses/:id` — the page renders without the "Course files" section; the Syllabus section remains fully functional.

## System-Wide Impact

- **Interaction graph:** Only `CourseOverview` is affected. `UnifiedCourseDetail` continues to render `LessonList` independently.
- **Error propagation:** None — removal only.
- **State lifecycle risks:** None — no state management changes.
- **API surface parity:** No API or type changes.
- **Integration coverage:** No cross-layer scenarios affected.
- **Unchanged invariants:** All Dexie queries, progress tracking, CTA resolution, and curriculum grouping remain identical.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `UnifiedCourseDetail` is later removed, orphaning `LessonList` | Out of scope for this plan; the component and hook are independently useful and deletion would be a separate task |

## Sources & References

- Code: `src/app/pages/CourseOverview.tsx`, `src/app/pages/UnifiedCourseDetail.tsx`, `src/app/components/course/LessonList.tsx`
- Related plan (locked lessons): `docs/plans/2026-05-14-007-feat-nonlinear-course-module-access-plan.md`
- Learnings: `docs/solutions/best-practices/course-detail-syllabus-unification-implementation-lessons-2026-05-12.md`
