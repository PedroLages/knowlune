---
story_id: ce-fix-companion-pdf-preview-resolve
saved_at: 2026-05-03 20:10
branch: feature/ce-2026-05-03-fix-companion-pdf-preview-resolve
---

## CE Run Context

CE orchestrator phase boundary: post-plan-approval for run fix-companion-pdf-preview-resolve.
Tracking file: `.context/compound-engineering/ce-runs/fix-companion-pdf-preview-resolve-2026-05-03.md`

## Completed Tasks

- [x] Unit 1: Add `getLesson` to adapter interface and implementations
  - Added `getLesson(lessonId: string): Promise<LessonItem | null>` to `CourseAdapter` interface
  - Implemented in `LocalCourseAdapter`: searches videos first, then all PDFs (no companion filter)
  - Implemented in `YouTubeCourseAdapter`: searches videos only
  - `getLessons()` unchanged — companion PDF exclusion preserved for prev/next

- [x] Unit 2: Update `useLessonPlayerState` to use `adapter.getLesson()`
  - Replaced `adapter.getLessons()` → `lessons.find()` with direct `adapter.getLesson(lessonId)`
  - Added `lessonResolved` boolean state to track resolution separately from lessonType
  - `lessonTypeResolved` now derives from `lessonResolved` instead of `lessonType !== null`

## Remaining Tasks

- [ ] CE review (quality gates)
- [ ] PR creation
- [ ] Post-implementation verification

## Implementation Progress

```
72fc52c2 fix: resolve companion PDF preview by adding adapter.getLesson() point-lookup
```

## Key Decisions

- **Add `getLesson(lessonId)` to the adapter interface** rather than making `getLessons()` include all PDFs. Rationale: `getLessons()` is a sequenced list for prev/next navigation and correctly excludes companion PDFs. Lesson lookup is a different operation (point query by ID) and should not be served by filtering a full list.
- **Implement in both adapters.** `LocalCourseAdapter` searches videos + all PDFs (no companion filter). `YouTubeCourseAdapter` searches only videos.
- **Track resolution separately** via `lessonResolved` boolean to avoid indefinite skeleton when a lesson ID genuinely doesn't match any known lesson.

## Approaches Tried / What Didn't Work

No challenges documented yet.

## Files Changed

```
 .../course/__tests__/MaterialsTab.test.tsx         |  3 +
 src/app/hooks/useLessonPlayerState.ts              | 14 ++--
 .../pages/__tests__/UnifiedLessonPlayer.test.tsx   |  3 +
 src/lib/__tests__/courseAdapter.test.ts            | 75 ++++++++++++++++++++++
 src/lib/courseAdapter.ts                           | 37 +++++++++++
 5 files changed, 127 insertions(+), 5 deletions(-)
```

## Current State

Working tree has untracked files (CE review artifacts, docs, tmp files) but no unstaged modifications to implementation files.
