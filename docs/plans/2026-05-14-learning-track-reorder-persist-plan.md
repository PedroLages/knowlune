# Plan — Learning track reorder persistence (2026-05-14)

## Approach

1. Add `reorderPathCourses(pathId, activeCourseId, overCourseId)` in `useLearningPathStore`: build movable (non-gap) subset, `arrayMove`, weave back into skeleton rows, reassign `position`, optimistic update + `syncableWrite` puts (same as legacy `reorderCourse`).
2. Implement `reorderCourse` as thin wrapper: resolve `fromIndex`/`toIndex` to course IDs (skip gap indices), delegate to `reorderPathCourses`.
3. `PathTimeline`: add optional `onReorderByCourseId`; drag-end prefers it over index `onReorder`.
4. `LearningTrackDetail`: wire `onReorderByCourseId` → `reorderPathCourses`.
5. Vitest: regression for gap weave + existing `reorderCourse` tests.

## Verification

- `vitest` `useLearningPathStore` reorder + `PathTimeline` tests.
- Note: full `tsc`/`build` may surface pre-existing repo errors outside this change (see CI).

## Plan critic (summary)

- **Verdict:** approve
- **Confidence:** 88
- **Blockers:** none
- **Risks:** Signed-in sync LWW could still race if remote stale; out of scope unless reproduced.
