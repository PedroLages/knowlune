# Requirements — Learning track syllabus reorder persistence

## Problem

Manual drag reorder on `/learning-tracks/:trackId` does not survive reload; user expects order written to `learningPathEntries.position`.

## Acceptance

- Reorder via edit mode persists to Dexie via existing `syncableWrite` path.
- Behaviour matches `@dnd-kit/sortable` (move active course to over target).
- Gap rows (`courseId === ''`) stay fixed in the timeline while real courses reorder among themselves.

## Constraints

- Preserve `reorderCourse(fromIndex,toIndex)` API for manifest import and tests.
- No new dependencies; store stays free of `@dnd-kit`.
