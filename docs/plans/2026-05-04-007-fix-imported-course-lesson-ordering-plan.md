---
title: "fix: Ensure consistent lesson ordering and starting point for imported courses"
type: fix
status: active
date: 2026-05-04
---

# fix: Ensure consistent lesson ordering and starting point for imported courses

## Overview

Fix two root-cause bugs in imported course lesson ordering: (1) bulk and drop import paths assign `order` values in OS-dependent iteration order instead of path-sorted order, scrambling lesson sequences; (2) several Dexie queries use non-deterministic `toArray()` instead of `sortBy()`, causing unstable behavior across sessions. Both issues share the same underlying cause — missing sort steps that the single-folder import path (`scanCourseFolder`) already implements correctly.

## Problem Frame

**Symptom A — Lesson ordering within folders:** In the Course Content sidebar, lessons within a folder display out of sequence (e.g., lesson 1, lesson 3, lesson 2). This happens because `scanCourseFolderFromHandle` (bulk import) and `scanFromDroppedFiles` (drop import) assign `order: index + 1` while iterating files in OS-dependent order. On macOS, `FileSystemDirectoryHandle.values()` returns entries in inode/creation order — effectively random. The single-folder `scanCourseFolder` already sorts by path with `localeCompare({ numeric: true })` before assigning `order`.

**Symptom B — Wrong starting point:** When opening a newly imported course, playback starts at a seemingly random folder (e.g., folder 7 instead of folder 1, lesson 1). This is a downstream consequence: `getFirstLessonId()` sorts videos by `order`, but `order` values are scrambled. The lesson with the lowest `order` value could be any lesson from any folder.

**Scope:** All imported courses (local video/PDF courses). YouTube courses and learning paths are unaffected — YouTube lessons inherit `order` from the URL scrape order which is already deterministic (playlist order).

## Requirements Trace

- **R1.** Lessons within each folder display in numeric-filename order (e.g., `01 - intro.mp4` before `02 - basics.mp4`) — matching the `scanCourseFolder` single-import behavior
- **R2.** Bulk-imported courses (`scanCourseFolderFromHandle`) produce the same deterministic `order` values as single-folder imports
- **R3.** Drop-imported courses (`scanFromDroppedFiles`) produce the same deterministic `order` values
- **R4.** Opening a newly imported course with no prior progress starts at the first lesson of the first folder
- **R5.** All Dexie queries that feed lesson ordering use deterministic `sortBy()` instead of `toArray()`
- **R6.** Existing courses retain correct ordering — fixes apply only at import time (new imports) and at query time (deterministic reads)

## Scope Boundaries

- **In scope:** Video ordering in `scanCourseFolderFromHandle` and `scanFromDroppedFiles` import paths; non-deterministic Dexie queries in `useCourseAdapter`, `useNextBestCourse`, and `getLastWatchedLesson`
- **Out of scope:** Adding `order` field to `ImportedPdf` (PDF lessons derive order from filename prefix at runtime — sufficient and works correctly for current UX)
- **Out of scope:** Intra-folder badge numbering in the sidebar (the `groupIndexMap` already uses flat-position numbering, which is a deliberate UX choice)
- **Out of scope:** Fixing existing courses that were imported with scrambled `order` values — the `VideoReorderDialog` already allows manual reordering as a mitigation

### Deferred to Separate Tasks

- **Adding `order` to `ImportedPdf`:** Adding an `order` column to the `ImportedPdf` type + Dexie schema + import code. Currently PDFs derive order at runtime from filename parsing (`buildPdfLessons` in `courseAdapter.ts`). This works correctly but is fragile — deferred because it requires a schema migration and the current approach works for existing data.

## Context & Research

### Relevant Code and Patterns

| File | Role |
|------|------|
| `src/lib/courseImport.ts:259-261` | `scanCourseFolder` — correctly sorts by path (the pattern to replicate) |
| `src/lib/courseImport.ts:671-691` | `scanCourseFolderFromHandle` — **missing sort** (bulk import bug) |
| `src/lib/courseImport.ts:813-828` | `scanFromDroppedFiles` — **missing sort** (drop import bug) |
| `src/lib/fileSystem.ts:52` | `scanDirectory` — `for await (const entry of dirHandle.values())` returns OS-order |
| `src/hooks/useCourseAdapter.ts:31` | PDFs loaded with non-deterministic `toArray()` |
| `src/app/hooks/useNextBestCourse.ts:42-47` | `getFirstLessonId` — relies on `sortBy('order')` (correct for videos, broken for PDFs) |
| `src/app/hooks/useNextBestCourse.ts:84-87` | `findFirstIncompleteLesson` — uses `toArray()` to build `videoOrderMap` |
| `src/lib/progress.ts:111-138` | `getLastWatchedLesson` — uses `toArray()` with no deterministic tiebreaker |
| `src/app/pages/CourseOverview.tsx:211-249` | Course landing CTA — calls `getLastWatchedLesson` / `getFirstLesson` |
| `src/lib/courseAdapter.ts:146-162` | `LocalCourseAdapter.getLessons()` — sorts by `order` then `title` (correct, depends on correct `order` values) |

### Institutional Learnings

- **lesson-badge-local-global-index-mismatch (2026-05-04):** The `useCourseAdapter` already switched from `toArray()` to `sortBy('order')` for videos (line 29), but PDFs (line 31) were missed. The lesson is: **always use `sortBy()` for Dexie queries that feed ordering**. Never rely on insertion order.
- **smart-resume-implementation-lessons (2026-05-04):** `findFirstIncompleteLesson` in `useNextBestCourse.ts` uses `toArray()` to build `videoOrderMap`. While functionally safe (it stores `v.order`, not the iteration index), this pattern is fragile and inconsistent with the documented best practice.
- **non-deterministic-dexie-query-patterns (2026-05-04):** Multiple `toArray()` calls across the lesson player space that should be `sortBy()`. This is a known anti-pattern in the codebase.

## Key Technical Decisions

- **Sort by path, not filename:** `scanCourseFolder` sorts by `entry.path` (full relative path including folder), which produces folder-grouped ordering (`01 - intro/lesson 1.mp4` before `02 - advanced/lesson 1.mp4`). This matches user expectation — course content flows through folders in order, then through lessons within each folder.
- **Use `localeCompare` with `numeric: true`:** This correctly sorts numeric prefixes (`2`, `10`, `11`) rather than lexicographic order (`10`, `11`, `2`). The single-import path already uses this.
- **Drop import sort by filename:** `scanFromDroppedFiles` has no folder paths (files come from a flat drop), so sort by `file.name` with the same `localeCompare({ numeric: true })`.
- **No schema migration for existing courses:** Existing data keeps its current `order` values. Only new imports benefit from the fix. Users with broken courses can use `VideoReorderDialog` (already exists) or re-import.

## Open Questions

### Resolved During Planning

- **Why does `scanCourseFolder` work but `scanCourseFolderFromHandle` doesn't?**: The `.sort()` step exists only in `scanCourseFolder`. `scanCourseFolderFromHandle` and `scanFromDroppedFiles` were written later and never included it.
- **Is `findFirstIncompleteLesson`'s `toArray()` actually broken?**: No — it stores `v.order` in the map, so iteration order doesn't matter. But it's inconsistent and fragile. Fixed for consistency.

### Deferred to Implementation

- **Exact Dexie compound index for PDF filename sort:** Whether to add a `[courseId+filename]` compound index or just use `sortBy('filename')` with a filtered where clause — depends on observed performance with real course data.
- **Whether `getLastWatchedLesson` needs an `updatedAt` field on `VideoProgress`:** The current comment on line 119-121 acknowledges this gap. Adding the field requires a schema migration; deferred until it causes user-visible issues beyond the ordering bug.

## Implementation Units

- [ ] **Unit 1: Sort videos in `scanCourseFolderFromHandle` (bulk import)**

**Goal:** Bulk-imported courses produce path-sorted `order` values matching single-folder import behavior.

**Requirements:** R1, R2, R4

**Dependencies:** None

**Files:**
- Modify: `src/lib/courseImport.ts` (lines 671-691)

**Approach:**
- Add `.sort()` between the `.filter()` and `.map()` chains, using the same comparator as `scanCourseFolder`: `a.value.entry.path.localeCompare(b.value.entry.path, undefined, { numeric: true })`
- This ensures videos are sorted by their full relative path (folder + filename) before `order` is assigned

**Patterns to follow:**
- `src/lib/courseImport.ts:259-261` (the `scanCourseFolder` sort — identical logic)

**Test scenarios:**
- **Happy path:** Import a course folder with videos named `1.mp4`, `2.mp4`, `10.mp4` across subfolders `01-intro/` and `02-advanced/`. Verify videos have `order` values matching path-sorted sequence.
- **Edge case:** Import a course with no videos (PDF-only). No sort applied — no crash.
- **Edge case:** Import a course with filenames containing mixed numeric/non-numeric prefixes (e.g., `intro.mp4`, `2-basics.mp4`, `10-advanced.mp4`). Verify `numeric: true` handles mixed prefixes correctly.

**Verification:**
- After bulk import, `ImportedVideo.order` values follow path-sorted order
- Course Content sidebar displays lessons in correct sequence within each folder
- Starting a new course begins at the first lesson of the first folder

---

- [ ] **Unit 2: Sort videos in `scanFromDroppedFiles` (drop import)**

**Goal:** Drop-imported courses produce filename-sorted `order` values.

**Requirements:** R1, R3, R4

**Dependencies:** None (independent of Unit 1)

**Files:**
- Modify: `src/lib/courseImport.ts` (lines 813-828)

**Approach:**
- Since dropped files have no folder structure (flat list), sort by `file.name` using `localeCompare({ numeric: true })`
- Sort before the loop that assigns `order: videos.length + 1` (or restructure to sort after collecting all videos)

**Patterns to follow:**
- `src/lib/courseImport.ts:259-261` (the comparator pattern, adapted to `file.name` instead of `entry.path`)

**Test scenarios:**
- **Happy path:** Drop files named `01-intro.mp4`, `02-basics.mp4`, `10-conclusion.mp4`. Verify `order` values are `1, 2, 3` not `1, 3, 2`.
- **Edge case:** Drop files from different folders (flat list). Sort by filename only, no folder grouping expected.

**Verification:**
- After drop import, video `order` matches filename-sorted sequence

---

- [ ] **Unit 3: Fix non-deterministic `toArray()` queries**

**Goal:** All Dexie queries that feed lesson ordering use deterministic `sortBy()`.

**Requirements:** R5

**Dependencies:** None (independent of Units 1-2)

**Files:**
- Modify: `src/hooks/useCourseAdapter.ts` (line 31)
- Modify: `src/app/hooks/useNextBestCourse.ts` (line 87)

**Approach:**
- `useCourseAdapter.ts:31` — Change `toArray()` to `sortBy('filename')` for PDFs (mirrors the `sortBy('order')` already used for videos on line 29)
- `useNextBestCourse.ts:87` — Change `toArray()` to `sortBy('order')` for consistency (functionally safe today but fragile)

**Patterns to follow:**
- `src/hooks/useCourseAdapter.ts:29` — the existing `sortBy('order')` for videos

**Test scenarios:**
- **Happy path:** Load a course with PDFs. Verify PDF order is deterministic across multiple loads — always sorted by filename.
- **Happy path:** Call `findFirstIncompleteLesson` for a course. Verify the `videoOrderMap` is built from deterministically-ordered data — no change in behavior, just consistency.
- **Edge case:** Course with no PDFs — `sortBy('filename')` returns empty array, no crash.
- **Edge case:** Course with no videos — `sortBy('order')` returns empty array, `videoOrderMap` is empty, function falls back to `getFirstLessonId`.

**Verification:**
- `useCourseAdapter` returns PDFs in deterministic order across sessions
- `findFirstIncompleteLesson` uses `sortBy('order')` for video ordering — no behavioral change, just consistency hardening

---

- [ ] **Unit 4: Add tiebreaker to `getLastWatchedLesson`**

**Goal:** `getLastWatchedLesson` returns a deterministic result when multiple lessons have equal progress (common for newly imported courses where all are at 0%).

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/lib/progress.ts` (lines 111-138)

**Approach:**
- The function already has a post-`toArray()` sort by `currentTime > 0` then `completionPercentage` descending (lines 122-128). Add a third tiebreaker to that existing sort: `a.videoId.localeCompare(b.videoId)` for absolute determinism when both prior criteria are equal
- This ensures that for a brand-new course with zero progress, the same lesson is always picked (the one with the lexicographically lowest ID)
- Note: this is a defense-in-depth fix. After Units 1-2, `getFirstLesson` (via `adapter.getLessons()`) will correctly return the first lesson by `order`, so `getLastWatchedLesson` returning `null` for new courses is actually the desired path — the `getFirstLesson` fallback in `CourseOverview` handles it

**Patterns to follow:**
- `src/lib/courseAdapter.ts:159` — existing `a.title.localeCompare(b.title)` tiebreaker

**Test scenarios:**
- **Happy path:** Two lessons with equal progress (both 0%). Verify deterministic selection — same lesson every time.
- **Happy path:** One lesson with watch time, one without. Verify lesson with watch time is selected (existing behavior preserved).
- **Edge case:** No progress rows — returns `null` as before (no change).

**Verification:**
- `getLastWatchedLesson` produces deterministic results when progress is equal

---

- [ ] **Unit 5: Fix `getFirstLessonId` PDF `sortBy('order')` on non-existent field**

**Goal:** `getFirstLessonId` no longer calls `sortBy('order')` on `ImportedPdf` objects that have no `order` property.

**Requirements:** R5

**Dependencies:** Unit 3 (the `sortBy('filename')` pattern it follows is established there)

**Files:**
- Modify: `src/app/hooks/useNextBestCourse.ts` (lines 50-54)

**Approach:**
- Change the PDF fallback from `sortBy('order') as unknown as Array<{ id: string; order: number }>` (unsafe type assertion on a field that doesn't exist) to `sortBy('filename')` — a field that actually exists and provides deterministic ordering
- This path is only reached when a course has zero videos (PDF-only course), so it's a low-frequency edge case

**Patterns to follow:**
- `src/hooks/useCourseAdapter.ts:31` — after Unit 3 fix, uses `sortBy('filename')` for PDFs

**Test scenarios:**
- **Edge case:** PDF-only course with multiple PDFs. `getFirstLessonId` returns the filename-sorted first PDF (deterministic).
- **Happy path:** Course with videos. Videos are returned by `sortBy('order')` — PDF path never reached. No behavioral change.

**Verification:**
- `getFirstLessonId` no longer calls `sortBy()` on a non-existent field
- PDF-only courses return a deterministic first lesson ID

## System-Wide Impact

- **Interaction graph:** All three import paths (`scanCourseFolder`, `scanCourseFolderFromHandle`, `scanFromDroppedFiles`) now produce deterministic ordering. The two folder-based paths sort by full relative path (identical behavior); the drop-import path sorts by filename (analogous behavior — no folder structure exists in dropped files). The adapter layer, sidebar, prev/next navigation, resume logic, and CTA all depend on `order` being correct — fixing it at the source propagates correctly to all consumers.
- **Error propagation:** No new error paths. Sort operations are pure functions on in-memory arrays — they don't throw.
- **State lifecycle risks:** Existing courses keep their current (potentially wrong) `order` values. Users can fix by re-importing or using `VideoReorderDialog`. No data migration.
- **API surface parity:** N/A — no exported API changes.
- **Integration coverage:** Import → adapter sort → sidebar tree → prev/next nav → resume CTA form a single ordering pipeline. Unit tests on the import layer validate the source; the rest is verified by existing E2E tests on course navigation.
- **Unchanged invariants:** `order` remains a 1-indexed integer. The `VideoReorderDialog` contract (`persistVideoOrder` writes `order` back to Dexie) is unchanged. The `LocalCourseAdapter.getLessons()` sort by `order` then `title` is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Sorting by path in bulk import could produce different order than user's mental model (e.g., if they expect creation-date order) | Path-sort matches the single-import behavior and the sidebar's folder-based grouping. This is the established convention |
| `localeCompare` with `{ numeric: true }` may handle edge cases differently across browsers | `localeCompare` is standardized in ECMAScript and `numeric: true` behavior is consistent across modern browsers (Chrome, Firefox, Safari). The single-import path has been using this for months without issue |
| Drop import sorting by filename may differ from the original folder structure | Drop import has no folder structure — filename sorting is the best available heuristic and matches user expectation of alphabetical order |

## Sources & References

- **Prior learnings:** `docs/solutions/ui-bugs/lesson-badge-local-global-index-mismatch-2026-05-04.md`
- **Prior learnings:** `docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md`
- **Related code:** `src/lib/courseImport.ts:259-261` — the correct sort pattern in `scanCourseFolder`
- **Related code:** `src/lib/fileSystem.ts:52` — OS-order iteration via `dirHandle.values()`
- **Related code:** `src/app/components/course/VideoReorderDialog.tsx` — existing manual reorder UI
