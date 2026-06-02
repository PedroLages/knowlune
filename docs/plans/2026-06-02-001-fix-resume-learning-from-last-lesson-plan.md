---
title: "fix: Resume learning tracks from last incomplete lesson instead of the beginning"
type: fix
status: active
date: 2026-06-02
deepened: 2026-06-02
---

# fix: Resume learning tracks from last incomplete lesson instead of the beginning

## Overview

When users click "Continue", "Continue Learning", "Continue lesson", or "Start Module" buttons on learning track pages, they are navigated to the first lesson of the course instead of the first incomplete lesson — the one they should resume from. This happens across all surfaces: the listing page card actions, the detail page hero CTA, the bento card, and the syllabus timeline entries.

## Problem Frame

Knowlune tracks lesson completion through two parallel systems:

| System | Storage | What It Records |
|--------|---------|----------------|
| `contentProgress` (canonical) | Dexie table `[courseId+itemId]` | Per-lesson status: `'not-started'`, `'in-progress'`, `'completed'` |
| `progress` (legacy) | Dexie table `[courseId+videoId]` | Per-video playback position: `completionPercentage`, `completedAt` |

The canonical source is `contentProgress` — it's the P0 sync table, managed by `useContentProgressStore`, and updated via `syncableWrite` when a lesson is marked complete.

The bug: **`LearningTrackDetail.tsx` uses the legacy `progress` table exclusively to find the first incomplete lesson**, ignoring `contentProgress` entirely. When the `progress` table lacks entries for completed lessons (which is common — `markLessonComplete` updates localStorage, not the `progress` Dexie table), every lesson appears incomplete, so the first lesson is always returned.

Additionally, `useNextBestCourse` (used by the listing page) reads from `contentProgressStore.statusMap`, but that map is populated on-demand by `loadCourseProgress()`. If no component has loaded progress for the relevant course yet, the map is empty and the hook falls through to `getFirstLessonId()` — also returning the first lesson.

## Requirements Trace

- **R1.** Clicking "Continue" on a learning track card navigates to the first incomplete lesson of the first in-progress course (not the first lesson).
- **R2.** Clicking "Continue Learning" on the detail page hero navigates to the first incomplete lesson of the current/next course.
- **R3.** Clicking "Continue lesson" on the bento card navigates to the first incomplete lesson of the displayed in-progress course.
- **R4.** Clicking "Start Module" on a syllabus timeline entry navigates to the first incomplete lesson of that course.
- **R5.** The resume-point computation uses `contentProgress` as the primary source, falling back to the legacy `progress` table for backward compatibility.
- **R6.** The listing page card actions compute resume points correctly even when course progress hasn't been pre-loaded into the Zustand store.

## Scope Boundaries

- This plan fixes **navigation targets** — where the buttons send the user — by unifying resume-point computation to use `contentProgress` as the primary source.
- It does NOT change the lesson player's behavior once the correct lesson is loaded.
- It does NOT add new progress tracking mechanisms or schema changes.

### Deferred to Separate Tasks

- **Backfill `progress` table from `contentProgress`**: A one-time migration to populate `completedAt` in the `progress` table for already-completed lessons. This would make the `progress` table self-consistent but is not required for the fix to work — the new code reads from both sources.
- **Dual-write progress to legacy `progress` table on lesson completion**: When a lesson is marked complete via `contentProgressStore.setItemStatus()`, also write `completedAt` and `completionPercentage: 100` to the legacy `progress` table using `syncableWrite` with `skipQueue: true`. This keeps both sources consistent for consumers still reading the legacy table. Not required for the core navigation fix — the new dual-source read handles the gap — but prevents confusion for code paths that rely solely on the `progress` table. Deferred alongside the backfill task.

## Context & Research

### Relevant Code and Patterns

- [src/app/pages/LearningTrackDetail.tsx](src/app/pages/LearningTrackDetail.tsx#L365-L411) — Computes `targetLessonId`, `currentEntryTargetLessonId`, and `firstLessonByCourse` using only `videoProgressMap` (legacy `progress` table).
- [src/app/hooks/useNextBestCourse.ts](src/app/hooks/useNextBestCourse.ts) — Centralized resume hook using `contentProgressStore.statusMap`. Already has the correct pattern for `findFirstIncompleteLesson()`.
- [src/stores/useContentProgressStore.ts](src/stores/useContentProgressStore.ts) — Zustand store managing `statusMap` (keyed `courseId:itemId` → `CompletionStatus`). Has `loadCourseProgress(courseId)` for single-course loading.
- [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts#L52-L186) — `usePathProgress` computes aggregate progress using `progress` table (with `completedAt` filter) and localStorage fallback. Does NOT consult `contentProgress`.
- [src/lib/progress.ts](src/lib/progress.ts#L218-L233) — `markLessonComplete` updates localStorage only, not the Dexie `progress` table.
- [src/app/components/learning-path/TimelinePrimitives.tsx](src/app/components/learning-path/TimelinePrimitives.tsx#L143-L223) — `EntryActionButton` receives `onClick` from parent; does not compute resume targets itself.
- [src/app/components/learning-path/ContinueLearningBento.tsx](src/app/components/learning-path/ContinueLearningBento.tsx) — Receives `targetLessonId` as a prop; does not compute it internally.
- [src/app/components/learning-path/PathHeroBanner.tsx](src/app/components/learning-path/PathHeroBanner.tsx) — Receives `targetLessonId` as a prop; does not compute it internally.

### Institutional Learnings

- [docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md](docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md) — Documents the `useNextBestCourse` pattern: return navigation targets from the hook, resolve domain context in the consumer, sync-first return shape for async-dependent hooks.
- [docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md](docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md) — `syncableWrite` is the canonical write path for `contentProgress`. The legacy `progress` table writes bypass this path.
- [docs/plans/2026-05-14-006-fix-course-lesson-completion-status-sync-plan.md](docs/plans/2026-05-14-006-fix-course-lesson-completion-status-sync-plan.md) — Documents the stale-status bug pattern: subscribing to a stable function reference (`getItemStatus`) misses `statusMap` updates. The fix pattern (direct `statusMap[key]` subscription) is relevant for reactive resume-point computation.

## Key Technical Decisions

- **Primary source: `contentProgress`**: Use `contentProgressStore.statusMap` as the authoritative source for lesson completion. The `progress` table serves as a fallback for lessons completed before `contentProgress` was introduced.
- **Extract shared helper**: Extract the "find first incomplete lesson" logic from `useNextBestCourse.ts` into a shared utility, so both `LearningTrackDetail.tsx` and `useNextBestCourse.ts` use the same algorithm.
- **Batch-load contentProgress**: In `LearningTrackDetail.tsx`, batch-load `contentProgress` for all courses in the path (similar to how videos are batch-loaded). Subscribe to `statusMap` reactively so resume targets update when progress changes.
- **No schema changes**: This fix does not require Dexie schema migrations. Both `contentProgress` and `progress` tables already exist and have the needed indexes.

## Open Questions

### Resolved During Planning

- **Should `LearningTrackDetail.tsx` use `contentProgress` or `progress`?** → Use `contentProgress` as primary, `progress` as fallback. `contentProgress` is the canonical P0 sync table; `progress` is legacy.
- **Should we extract the find-first-incomplete logic?** → Yes, into a shared utility at `src/lib/resumeLearning.ts`. Both consumers need the same dual-source algorithm.
- **Should we load contentProgress for unviewed courses?** → Yes, batch-load on mount. Without loading, the `statusMap` is empty and the fallback behavior (first lesson) is wrong.

### Deferred to Implementation

- **Whether `usePathProgress` should also consult `contentProgress`**: Currently it only uses `progress` table + localStorage. This is a separate concern (aggregate completion percentage, not resume-point computation) and is out of scope.
- **Whether to backfill `progress.completedAt` from `contentProgress`**: This would improve consistency but is not required for the fix. Deferred to a separate task.

## Implementation Units

- [ ] **Unit 1: Extract shared resume-point utility**

**Goal:** Create a shared function that, given a course ID and progress data from both sources, returns the first incomplete lesson ID.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Create: `src/lib/resumeLearning.ts`
- Test: `src/lib/__tests__/resumeLearning.test.ts`

**Approach:**
- Extract the dual-source algorithm into a pure function (no React/Dexie dependencies at this layer — callers pass in the data).
- Signature: `findFirstIncompleteLesson(params: { courseId, statusMap, videoProgressList, videos, pdfs? }) → string | null`
- Priority: check `statusMap` first (canonical source). For each video in order, if `statusMap[\`${courseId}:${videoId}\`] !== 'completed'`, return that video ID.
- Fallback: if statusMap has no entries for this course, check `videoProgressList` for `completionPercentage < 90` or missing `completedAt`.
- PDF fallback: if no videos exist for the course, iterate `pdfs` sorted by filename and return the first one where `statusMap` does not show `'completed'`.
- Final fallback: return the first video (or first PDF if no videos) by display order.

**Patterns to follow:**
- [src/app/hooks/useNextBestCourse.ts](src/app/hooks/useNextBestCourse.ts#L67-L104) — Existing `findFirstIncompleteLesson` function (statusMap-only). The new shared version adds `progress` table fallback.
- Pure function pattern from [src/lib/curriculumGrouping.ts](src/lib/curriculumGrouping.ts) — stateless, testable, no React dependencies.

**Test scenarios:**
- Happy path: All videos present in statusMap, first non-'completed' video returned
- Happy path: statusMap has no entries for course → falls back to videoProgressList, finds first with completionPercentage < 90
- Happy path: Both sources empty → returns first video by order
- Edge case: All videos completed in statusMap → returns null (caller handles)
- Edge case: Course has PDFs but no videos → returns first PDF by filename order
- Edge case: Course has no lessons at all → returns null

**Verification:**
- Unit tests pass for all scenarios
- The returned lesson ID, when navigated to, corresponds to the first lesson the user hasn't completed

- [ ] **Unit 2: Fix `LearningTrackDetail.tsx` to use contentProgress as primary source**

**Goal:** Replace the three `videoProgressMap`-only resume-point computations with the shared dual-source utility.

**Requirements:** R2, R3, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx`
- Test: `tests/e2e/learning-track-detail-resume.spec.ts` (new or extend existing)

**Approach:**
- Import `useContentProgressStore` and subscribe to `statusMap` reactively.
- On mount (or when `courseEntries` change), call `loadCourseProgress()` for each course in the path. Use a batched approach: iterate course IDs and call `loadCourseProgress` for each. (The store method handles one course at a time; batch by looping.)
- **Loading state tracking**: Maintain a `loadedCourseIds` Set (via `useRef`) alongside the loading effect. Before `loadCourseProgress` resolves for a given course, that course ID is absent from the set. The resume-point computation checks this set: if the relevant course's ID is not yet in the set, `findFirstIncompleteLesson` should return a sentinel (e.g., `undefined`) that the UI maps to "loading" — preserving the existing skeleton/spinner rather than falling through to the first lesson.
- **Large-path performance**: For paths with 50+ courses, sequential `loadCourseProgress` calls could cause perceptible delay. Use `Promise.allSettled` to parallelize the loads, but wrap them in a concurrency limiter (e.g., process 10 at a time) to avoid Dexie contention. The loading-state tracking from the previous bullet ensures the UI shows pending state until all loads resolve, so no flash of incorrect targets occurs.
- Replace the three `useMemo` blocks (`targetLessonId` at L365, `currentEntryTargetLessonId` at L382, `firstLessonByCourse` at L399) with calls to the shared `findFirstIncompleteLesson` utility, passing both `statusMap` and `videoProgressMap`.
- The `firstLessonByCourse` map (used by `onCourseClick` for timeline navigation) should also use the shared utility per course.

**Execution note:** Add characterization tests for the existing resume-point behavior before modifying the `useMemo` blocks.

**Patterns to follow:**
- [src/app/hooks/useNextBestCourse.ts](src/app/hooks/useNextBestCourse.ts#L166-L167) — Reactive subscription to `statusMap`.
- [src/app/pages/LearningTrackDetail.tsx](src/app/pages/LearningTrackDetail.tsx#L133-L200) — Existing batch-loading pattern for videos/chapters/progress.

**Test scenarios:**
- Happy path: User has completed lessons 1-3 of a course → hero "Continue Learning" navigates to lesson 4
- Happy path: User has completed no lessons → hero "Start Learning" navigates to lesson 1
- Happy path: User clicks "Start Module" on syllabus entry for course with lessons 1-2 completed → navigates to lesson 3
- Edge case: Course fully completed → CTA navigates to first lesson (review behavior)
- Edge case: contentProgress has data but progress table is empty → uses contentProgress correctly
- Edge case: progress table has data but contentProgress is empty → falls back to progress table
- Edge case: Path with multiple courses, first course completed → bento card shows second course with correct target lesson
- Integration: Navigating via hero CTA loads the lesson player with the correct lesson visible/active

**Verification:**
- Manual testing: Create a learning track, complete 2 lessons of the first course, return to the detail page, click "Continue Learning" — should navigate to lesson 3
- E2E tests pass: seed contentProgress with known completion data, verify navigation targets

- [ ] **Unit 3: Fix `useNextBestCourse` to eagerly load progress data**

**Goal:** Ensure the listing page "Continue" button computes correct resume targets even when progress hasn't been pre-loaded.

**Requirements:** R1, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/hooks/useNextBestCourse.ts`
- Test: `src/app/hooks/__tests__/useNextBestCourse.test.ts` (new, if test infrastructure supports hook testing)

**Approach:**
- The hook currently reads `statusMap` passively. If empty, `findFirstIncompleteLesson` (soon the shared utility) falls back to `progress` table data.
- Add an effect that calls `useContentProgressStore.getState().loadCourseProgress(courseId)` for each course in the sorted entries. This populates the statusMap, which triggers reactivity.
- **Loading state tracking**: The `loadedCourseIds` ref (tracked alongside the loading effect) gates the resume computation. While loading is in progress, the hook should return a loading-compatible shape (matching `INITIAL_RESULT` or a distinct sentinel) so the calling card shows a skeleton/spinner rather than navigating to the first lesson. Once all courses in the sorted entries are loaded, recompute with real data.
- Replace `getFirstLessonId(entry.courseId)` in the `computeNextBestCourse` "start" path (line ~146) with the shared `findFirstIncompleteLesson` utility. This ensures that when a course has contentProgress data but an empty progress table (yielding `completionPct: 0` from `useMultiPathProgress`), the "Start" button still navigates to the correct incomplete lesson rather than lesson 1.
- Use a ref to avoid redundant loads (track which course IDs have been loaded).
- The sync-first return shape (`INITIAL_RESULT` → async compute) is preserved; the loading just populates inputs so the async compute produces correct results.

**Patterns to follow:**
- [src/app/hooks/useNextBestCourse.ts](src/app/hooks/useNextBestCourse.ts#L194-L213) — Existing `runCompute` pattern with cancellation ref.
- [src/stores/useContentProgressStore.ts](src/stores/useContentProgressStore.ts#L73-L94) — `loadCourseProgress` method signature.

**Test scenarios:**
- Happy path: Hook called for path with course that has completed lessons → returns `action: 'resume'` with correct `targetLessonId`
- Happy path: Hook called for path with no progress → returns `action: 'start'` with first lesson
- Edge case: statusMap initially empty → loads progress → recomputes and returns correct target
- Edge case: All courses complete → returns `action: 'complete'`

**Verification:**
- On the learning tracks listing page, a card for a partially-completed track shows "Continue" and navigates to the correct lesson
- On the listing page, a card for an unstarted track shows "Start" and navigates to the first lesson

## System-Wide Impact

- **Interaction graph:** The fix touches three code paths that all feed into React Router navigation. The lesson player (`UnifiedLessonPlayer` or equivalent) receives the lesson ID via URL params — no changes needed there.
- **Error propagation:** If progress loading fails, the shared `findFirstIncompleteLesson` utility degrades gracefully: try `contentProgress`, then `progress` table, then first lesson. No unhandled rejections.
- **State lifecycle risks:** The `statusMap` in Zustand is keyed by `courseId:itemId`. If a course is removed from a track and later re-added, stale statusMap entries could cause incorrect resume points. Mitigation: `loadCourseProgress` clears stale entries for the course before merging fresh data.
- **API surface parity:** The `useNextBestCourse` hook is consumed by `LearningTracks.tsx` (listing page), `ContinueLearningPathSection.tsx` (overview dashboard), and `NextInPath.tsx` (post-completion). All three benefit from the Unit 3 fix without code changes.
- **Integration coverage:** The full flow (listing → detail → lesson player) needs E2E coverage: seed contentProgress, navigate to listing, click "Continue", verify the URL contains the correct lesson ID.
- **Unchanged invariants:** The `progress` table schema, `contentProgress` table schema, `usePathProgress` aggregate computation, and `useMultiPathProgress` batch computation are unchanged. The lesson player's navigation handling is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `loadCourseProgress` called for many courses simultaneously could cause Dexie contention | Use concurrency-limited parallel loading (`Promise.allSettled` with batches of 10) combined with loading-state gating to avoid incorrect intermediate targets. For small paths (<10 courses), sequential loading is acceptable. |
| Stale `statusMap` entries from deleted courses cause incorrect resume points | `loadCourseProgress` clears stale entries per course before merging. The shared utility only considers videos that actually exist in the course. |
| The `progress` table has `completionPercentage` values but no `completedAt` (partial watches) | The shared utility uses `completionPercentage < 90` as the threshold, matching existing behavior in `LearningTrackDetail.tsx`. |

## Sources & References

- **Origin document:** None (reported bug)
- Related code:
  - [src/app/pages/LearningTrackDetail.tsx](src/app/pages/LearningTrackDetail.tsx#L365-L411)
  - [src/app/hooks/useNextBestCourse.ts](src/app/hooks/useNextBestCourse.ts)
  - [src/stores/useContentProgressStore.ts](src/stores/useContentProgressStore.ts)
  - [src/lib/progress.ts](src/lib/progress.ts)
  - [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts)
- Related plans:
  - [docs/plans/2026-05-04-001-feat-smart-resume-learning-paths-plan.md](docs/plans/2026-05-04-001-feat-smart-resume-learning-paths-plan.md) — Original smart resume implementation
  - [docs/plans/2026-05-14-006-fix-course-lesson-completion-status-sync-plan.md](docs/plans/2026-05-14-006-fix-course-lesson-completion-status-sync-plan.md) — Stale status bug fix pattern
- Related solutions:
  - [docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md](docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md)
