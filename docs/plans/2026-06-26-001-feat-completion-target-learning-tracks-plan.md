---
title: "feat: Per-Course Completion Target for Learning Tracks"
type: feat
status: active
date: 2026-06-26
deepened: 2026-06-26T00:00:00.000Z  # R2 — all 6 R1 findings + 3 R2 findings resolved
---

# feat: Per-Course Completion Target for Learning Tracks

## Overview

Add a `completionTarget` field to `LearningPathEntry` that lets track curators cap course progress at a specified lesson count. When set, the progress ring shows target progress as the primary denominator (e.g., "45/60 target ✓") alongside the absolute course progress (e.g., "45/100 total"). Courses without a `completionTarget` behave unchanged. Module name filtering (`targetModuleNames`) is deferred to a future iteration — this plan ships only the lesson-count cap.

## Problem Frame

When a course appears in a learning track, the full course is imported into Knowlune, but the track curriculum often needs only a subset. For example, `100 Days of Code Python` may only need Days 1–60 in Phase 0 and Days 61–100 in Phase 3. Currently the `justification` field tells the learner what to skip, but the progress ring still counts the full course. A learner who finishes 60/60 needed lessons sees "60%" because the denominator includes 40 unused lessons — a motivation problem.

This plan adds `completionTarget` to narrow what "complete" means for a course within a specific track, while preserving the existing behavior for entries without a target.

## Requirements Trace

### Data Model & Configuration

- R1. Track curators can specify a `targetLessonCount` on a `LearningPathEntry` to cap the progress denominator at that count
- R6. Courses without `completionTarget` behave identically to current behavior (no regression)
- R7. `completionTarget` is per-track-entry, not per-course — the same course can have different targets in different tracks

### Authoring & Import

- R8. `completionTarget` is set via `track-manifest.json` and threaded through import into the database

### Completion Semantics

- R5. A course marks as "complete" when the target is met, not when the full course is done
- R10. Path milestone celebrations (25/50/75/100%) respect target-based completion, not absolute lesson count

### Display

- R4. The progress ring displays target-capped progress as the primary indicator and absolute course progress as secondary

### Edge Cases

- R9. `targetLessonCount` values exceeding the actual course lesson count are clamped to the actual count (e.g., cap of 60 on a 50-lesson course → denominator is 50)

## Scope Boundaries

- `completionTarget` only applies to imported courses (not catalog courses, which have no lesson-level progress)
- No UI for editing `completionTarget` post-import in this iteration — targets are authored in the manifest JSON (see origin: [Desktop/completion-target-feature-prompt.md](#sources--references))
- `generatePath` and `applyAIOrder` receive explicit `completionTarget` propagation (set to `undefined` during AI generation, preserved during reorder) but never SET a target value — the field is threaded through for correctness, not to add AI-authored targets
- No changes to the sync protocol or `tableRegistry` — the field passes through unmodified as part of the JSON payload

### Deferred to Separate Tasks

- UI for viewing/editing `completionTarget` on an existing `LearningPathEntry` post-import
- Re-import detection that updates `completionTarget` on existing entries when the manifest changes (current re-import skips duplicates by courseId)
- `targetModuleNames` support for module-scoped completion targets — adds async queries, stale-closure guards, and module-title matching infrastructure that isn't justified by current user needs (only lesson-count caps are used today)

## Context & Research

### Relevant Code and Patterns

- [src/data/types.ts](src/data/types.ts#L506-L514) — `LearningPathEntry` interface; `justification` is the canonical per-entry optional field precedent
- [src/lib/courseManifest.ts](src/lib/courseManifest.ts#L51-L56) — `TrackManifestCourse` interface; `notes` → `justification` threading pattern
- [src/lib/courseManifest.ts](src/lib/courseManifest.ts#L426) — `parseTrackManifest()` validation with `asOptionalString()` helper pattern
- [src/lib/trackManifestImport.ts](src/lib/trackManifestImport.ts#L177-L248) — Phase 3 batch import: `createPathWithCourses` / `batchAddCoursesToPath` threading
- [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts#L1097-L1226) — Store methods accepting `Array<{ courseId; courseType; justification? }>`; must extend this intermediate type
- [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts#L942) — `applyAIOrder` selective map: must preserve `completionTarget` in spread
- [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts#L681) — `reorderPathCourses`: uses `{ ...entry }` spread — carries target if source has it
- [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts#L114) — `totalLessons = importedCourse?.videoCount ?? 0` — the line that must read `completionTarget`
- [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts#L131-L142) — `completionPct` and `completedCoursesCount` guards (denominator = 0 handling)
- [src/lib/pathCompletion.ts](src/lib/pathCompletion.ts#L40) — `computePathCompletionPct` — independent aggregation that reads Dexie directly, not via `usePathProgress`
- [src/lib/challengePathMilestones.ts](src/lib/challengePathMilestones.ts#L76) — `calculatePathMilestoneProgress` — milestone toasts at 25/50/75/100%
- [src/app/components/learning-path/PathProgressSidebar.tsx](src/app/components/learning-path/PathProgressSidebar.tsx) — Primary progress sidebar; currently shows single ring
- [src/app/components/learning-path/PathTimeline.tsx](src/app/components/learning-path/PathTimeline.tsx#L665) — Course completion check: `pct >= 100 || isManuallyCompleted`
- [src/app/components/learning-path/SortableCourseTimelineEntry.tsx](src/app/components/learning-path/SortableCourseTimelineEntry.tsx) — Edit-mode variant with same status logic
- [src/lib/curriculumGrouping.ts](src/lib/curriculumGrouping.ts#L75) — `buildGroupedCurriculum` groups videos by folder or chapter; module titles come from `ImportedVideo.moduleTitle`
- [src/db/checkpoint.ts](src/db/checkpoint.ts#L23) — Current version 67; new v68 no-op migration needed
- [src/db/checkpoint.ts](src/db/checkpoint.ts#L102) — Schema string: `'id, [pathId+courseId], pathId, userId, [userId+updatedAt]'` — no index change needed
- [src/lib/sync/tableRegistry.ts](src/lib/sync/tableRegistry.ts) — No change needed; optional fields pass through `syncableWrite` unmodified

### Multi-Path Progress (useMultiPathProgress)

- [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts#L190-L337) — `useMultiPathProgress` computes aggregate progress across multiple paths simultaneously. It uses a single `courseProgressLookup` Map keyed by `courseId` (line 236-269), which conflates the same course appearing in different paths with different `completionTarget` values — a direct violation of R7.
- **Fix required:** Change `courseProgressLookup` to key by composite `pathId:courseId` instead of `courseId` alone. At the aggregation loop (line 283), match on the composite key. Extend `CourseProgressInfo` with `targetTotalLessons` and `targetCompletionPct` fields so per-path target-capped progress is available alongside absolute progress.
- **Consumers affected:** `ContinueLearningPathSection` (next best course per path), `PathAnalyticsTab` (stacked bar chart in reports), `LearningTracks` page (progress bars on `TrackCard`), `useNextBestCourse` (wraps `useMultiPathProgress` for single-path next-best). All four surfaces need per-path target-aware progress for correctness.
- **Implementation guidance:** This change is scoped to Unit 3 alongside the `usePathProgress` modifications. The composite key approach is internal — the external API (`Map<pathId, PathProgressSummary>`) is unchanged. Each `PathProgressSummary` already scopes per-course progress to its parent path, so consumers (`ContinueLearningPathSection`, `PathAnalyticsTab`, `LearningTracks` page, `useNextBestCourse`) receive path-specific summaries naturally. The only consumer-visible change is that `CourseProgressInfo` gains `targetTotalLessons` and `absoluteTotalLessons` fields — consumers that read `totalLessons` directly should audit whether they need the target-capped or absolute value. All 4 consumer surfaces are verified in Unit 3 test scenarios.

### Institutional Learnings

- **Store mutations require store methods**: Direct property assignment (`entry.completionTarget = x`) updates Zustand in memory but never reaches Dexie. All mutations must go through store `update`/`add` methods. ([docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md](docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md))
- **8+ entry construction sites**: Every object literal that creates a `LearningPathEntry` must include `completionTarget`. Missing one silently drops the field. ([src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts) — lines 573, 681, 826, 842, 942, 1051, 1125, 1184, 1317; also [src/lib/sync/hydrateP3P4.ts](src/lib/sync/hydrateP3P4.ts#L108))
- **`applyAIOrder` selective map risk**: At line 942, the spread `{ ...entry }` carries `completionTarget` implicitly, but the field list (`position, justification, isManuallyOrdered`) explicitly overrides only those fields. The spread handles `completionTarget` correctly, but this site needs verification.
- **Stale closures after async**: If module name filtering adds new `await` points to the progress hook, use generation counters or cancellation refs per [docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md](docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md)
- **Type checking**: esbuild silently passes missing named imports. Run `npx tsc --noEmit` to catch type errors after adding the new field to all construction sites.

### External References

External research was skipped — the codebase has strong local patterns: the `justification` field on `LearningPathEntry` is a direct precedent for threading optional per-entry fields from manifest through import to store to display.

## Key Technical Decisions

- **Type shape: `{ targetLessonCount?: number }`**: A single optional field on a flat interface. Simpler than the originally considered dual-field approach (`targetLessonCount` + `targetModuleNames`) — module filtering is deferred to a future iteration since current user needs only require lesson-count caps. This eliminates async query complexity, stale-closure guards, and 6+ test scenarios.
- **Module name matching (deferred)**: The `targetModuleNames` feature is deferred to a future iteration. When implemented, use `trim().toLowerCase()` normalization consistent with `forkTemplate` at [src/stores/useLearningPathStore.ts#L1249](src/stores/useLearningPathStore.ts#L1249).
- **Denominator = 0 guard**: `targetLessonCount` values < 1 are rejected during manifest parsing. Values exceeding the actual course's `videoCount` are clamped to `videoCount` — this avoids a "target says 60 but course only has 50 lessons" surprise while preserving curatorial intent for future course updates that add lessons.
- **No re-import update**: Re-importing a track skips existing entries by courseId. If the manifest's `completionTarget` changes, the old target stays on the existing entry. Clear-and-reimport is the workaround. A future iteration will add re-import detection.
- **Milestone sync required**: `computePathCompletionPct` and `calculatePathMilestoneProgress` read Dexie directly (not via `usePathProgress`). They must accept `LearningPathEntry[]` and apply `completionTarget` to denominator computation so milestone toasts fire at the correct thresholds.
- **Dexie v68 no-op migration**: A version bump with a comment documenting the new field, following the `progressionMode` precedent at v67. No schema string or index changes.
- **Estimated hours show both values**: The sidebar displays both target-based remaining hours and absolute remaining hours so learners know there are optional extra lessons.

## Open Questions

### Resolved During Planning

- **Type shape**: Flat interface with single optional field `{ targetLessonCount?: number }`. Module filtering deferred. See Key Technical Decisions.
- **Module name matching strategy**: Deferred to the `targetModuleNames` future iteration. See Scope Boundaries.
- **Milestone alignment**: Must update `challengePathMilestones.ts` and `pathCompletion.ts`. See Unit 4.
- **Re-import semantics**: Keep current skip behavior. See Scope Boundaries.
- **Estimated hours display**: Show both values. See Key Technical Decisions.
- **useMultiPathProgress R7 support**: Change `courseProgressLookup` key from `courseId` to `pathId:courseId` composite. See Unit 3 (Part B) and Context & Research.

### Deferred to Implementation

- **Exact positions of all construction sites**: The research catalogued 9+ sites across `useLearningPathStore.ts` and `hydrateP3P4.ts`. The implementer must verify each site during implementation — a site may have been added since this plan was written.
- **Exact shape of the dual progress indicator in the sidebar**: The feature spec describes "dual-ring or stacked progress indicator" — the implementer should choose the specific visual approach based on existing component patterns and Tailwind utilities. ARIA labels and responsive breakpoints are specified in Unit 5.

## Implementation Units

- [ ] **Unit 1: Data Model & Manifest Validation**

**Goal:** Define the `CompletionTarget` type, extend `LearningPathEntry` and `TrackManifestCourse`, and add manifest parsing validation.

**Requirements:** R1, R6, R7

**Dependencies:** None

**Files:**
- Modify: `src/data/types.ts` — add `CompletionTarget` interface, extend `LearningPathEntry`
- Modify: `src/lib/courseManifest.ts` — extend `TrackManifestCourse`, add parse-time validation in `parseTrackManifest()`
- Modify: `src/db/schema.ts` — add `database.version(68).stores({})` no-op migration (following the v67 precedent at line 1761 which uses empty stores with a doc comment)
- Modify: `src/db/checkpoint.ts` — bump `CHECKPOINT_VERSION` to 68, update `CHECKPOINT_SCHEMA` comment if applicable
- Test: `src/lib/__tests__/courseManifest.test.ts` (create if absent, or test via existing manifest parse tests)

**Approach:**
- Add `CompletionTarget` as `{ targetLessonCount?: number }` — a standalone interface so it can be reused in both `LearningPathEntry` and `TrackManifestCourse`. The type is intentionally a flat interface (not a union) so future `targetModuleNames` can be added as an additional optional field without a migration.
- Extend `LearningPathEntry` with `completionTarget?: CompletionTarget`
- Extend `TrackManifestCourse` with `completionTarget?: CompletionTarget` — reuses the same type since the shape is identical across manifest and store
- In `parseTrackManifest()`, add an `asOptionalPositiveInteger` helper following the existing `asOptionalString` pattern. Reject `targetLessonCount < 1` with a parse error. Emit a warning (not error) when `targetLessonCount` exceeds the course's declared `lessonCount` in the manifest — the curator likely made a mistake, but the value is still accepted (clamped at runtime per R9).
- Dexie v68: add `database.version(68).stores({})` in `src/db/schema.ts` (following the v67 precedent at line 1761 — empty stores object with a doc comment documenting that `completionTarget` is an optional non-indexed field on `learningPathEntries`). No schema string changes, no upgrade callback, no index changes. Bump `CHECKPOINT_VERSION` in `src/db/checkpoint.ts` to 68 to keep the fresh-install checkpoint aligned. The `CHECKPOINT_SCHEMA` does not change since no indexes were modified.
- **Note on file split**: `schema.ts` holds incremental migrations (`database.version(N).stores({})`); `checkpoint.ts` holds the frozen snapshot for fresh installs. For a no-op migration that doesn't change indexes, only the version number in `checkpoint.ts` needs updating — the schema string stays the same. See `src/db/checkpoint.ts` doc comment (lines 1-15) for the update procedure.

**Patterns to follow:**
- [src/lib/courseManifest.ts](src/lib/courseManifest.ts#L94-L107) — `asOptionalString` and `asStringArray` helper patterns for manifest validation
- [src/data/types.ts](src/data/types.ts#L506-L514) — `LearningPathEntry` existing shape and `justification` optional field precedent
- [src/db/checkpoint.ts](src/db/checkpoint.ts) — v67 migration: `database.version(67).stores({})` with no upgrade callback

**Test scenarios:**
- Happy path: Manifest JSON with `completionTarget: { targetLessonCount: 60 }` parses successfully and produces a `TrackManifestCourse` with the field set
- Happy path: Manifest JSON without `completionTarget` parses successfully (field is `undefined`)
- Edge case: `targetLessonCount: 0` is rejected with a parse error
- Edge case: `targetLessonCount: -1` is rejected with a parse error
- Error path: `targetLessonCount: "sixty"` (string instead of number) is rejected
- Error path: `completionTarget: "invalid"` (string instead of object) is rejected

**Verification:**
- `npx tsc --noEmit` passes with the new types
- Manifest JSON files with `completionTarget` parse without errors
- Manifest JSON files without `completionTarget` still parse (backward compatibility)
- Invalid `completionTarget` values produce clear parse errors

---

- [ ] **Unit 2: Store & Import Threading**

**Goal:** Thread `completionTarget` from manifest import through all `LearningPathEntry` construction sites and extend the store method parameter types.

**Requirements:** R1, R7, R8

**Dependencies:** Unit 1 (types must exist first)

**Files:**
- Modify: `src/stores/useLearningPathStore.ts` — extend `createPathWithCourses` and `batchAddCoursesToPath` parameter types; include `completionTarget` at all 8+ entry construction sites
- Modify: `src/lib/trackManifestImport.ts` — thread `completionTarget` from `TrackManifestCourse` through the import pipeline into store method calls
- Modify: `src/lib/sync/hydrateP3P4.ts` — include `completionTarget` in the remote hydration entry construction (field passes through from Supabase JSON payload)
- Test: `src/stores/__tests__/useLearningPathStore.test.ts`

**Approach:**
- Extend the intermediate type used by `createPathWithCourses` and `batchAddCoursesToPath` from `Array<{ courseId; courseType; justification? }>` to include `completionTarget: CompletionTarget | undefined` (explicitly required, not optional). Making the field required-but-union-with-undefined forces every call site to explicitly pass either a value or `undefined` — TypeScript then catches any construction site that forgets the field entirely. The Dexie interface (`LearningPathEntry`) keeps `completionTarget?` optional since existing entries in the database lack the field.
- In `trackManifestImport.ts`, map `trackCourse.completionTarget` through to the store method call (same pattern as `notes` → `justification`)
- At each entry construction site, include `completionTarget: courses[i].completionTarget` (or `undefined` where appropriate):
  - `addCourseToPath` — accept `completionTarget?` param, spread into `LearningPathEntry`
  - `createPathWithCourses` — spread from the extended courses array
  - `batchAddCoursesToPath` — spread from the extended courses array
  - `forkTemplate` — entries inherit from template source; if template has no target, result has no target
  - `generatePath` / `regeneratePath` — set `completionTarget: undefined` (AI doesn't know about targets)
  - `applyAIOrder` — add `completionTarget: entry.completionTarget` as an explicit field alongside `position`, `justification`, and `isManuallyOrdered` in the return object (currently preserved implicitly via `...entry` spread; explicit is safer against future refactors)
  - `replaceGapEntry` — set `completionTarget: undefined` (gap entries represent missing courses)
  - `hydrateP3P4.ts` — spread from Supabase JSON payload (field arrives as part of the serialized entry)
  - `reorderPathCourses` — `{ ...entry }` spread carries it automatically
- The `courses` array in `trackManifestImport.ts` lines 201 and 213 is the critical handoff point — extend the inline type definition there

**Patterns to follow:**
- [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts#L1097-L1164) — `createPathWithCourses` construction pattern
- [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts#L1166-L1226) — `batchAddCoursesToPath` construction pattern
- [src/lib/trackManifestImport.ts](src/lib/trackManifestImport.ts#L201) — intermediate type: `{ courseId, courseType, justification? }` → extend to include `completionTarget?`

**Test scenarios:**
- Happy path: Import a track manifest with `completionTarget` → `LearningPathEntry` in Dexie has the field set
- Happy path: Import a track manifest without `completionTarget` → `LearningPathEntry` has `completionTarget: undefined` (no regression)
- Happy path: `createPathWithCourses` stores `completionTarget` on each entry when provided
- Happy path: `batchAddCoursesToPath` stores `completionTarget` on new entries when provided
- Happy path: `addCourseToPath` called with `completionTarget` → entry has it; called without → entry has `undefined`
- Edge case: `applyAIOrder` preserves existing `completionTarget` on reordered entries
- Edge case: `forkTemplate` preserves `completionTarget` from the source template entries (if any)
- Edge case: `generatePath` entries have `completionTarget: undefined` (AI doesn't set targets)
- Edge case: `reorderPathCourses` preserves `completionTarget` on reordered entries (via spread)
- Integration: Full import flow: manifest JSON → `parseTrackManifest` → `batchImportTrackCourses` → `LearningPathEntry` in Dexie has `completionTarget`

**Verification:**
- `npx tsc --noEmit` passes — all construction sites covered. The non-optional `completionTarget: CompletionTarget | undefined` in the intermediate type forces every call site to explicitly pass the field; TypeScript flags any site that forgets.
- Import a track with `completionTarget` in its manifest → query Dexie: `learningPathEntries` has the field
- Import a track without `completionTarget` → entries have `undefined` (no regression)

---

- [ ] **Unit 3: Progress Calculation & useMultiPathProgress**

**Goal:** Modify `usePathProgress` to read `completionTarget` and compute target-capped per-course denominators. Fix `useMultiPathProgress` to support per-path target variance (R7).

**Requirements:** R1, R5, R6, R7, R9

**Dependencies:** Unit 1 (types), Unit 2 (entries must carry `completionTarget` from store)

**Files:**
- Modify: `src/app/hooks/usePathProgress.ts` — apply `completionTarget` in per-course progress computation; fix `useMultiPathProgress` composite key
- Test: `src/app/hooks/__tests__/usePathProgress.test.ts`

**Approach:**

**Part A — Single-path progress (usePathProgress):**
- Modify the per-course progress compute loop (around line 114):
  1. Read `entry.completionTarget?.targetLessonCount` from the `LearningPathEntry`
  2. If set and ≥ 1: `targetTotal = Math.min(targetLessonCount, course.videoCount ?? 0)` — clamped to actual
  3. Else: `targetTotal = course?.videoCount ?? 0` (existing behavior)
  4. Clamp completed lessons: `clampedCompleted = Math.min(completedLessons, targetTotal)`
- Extend `CourseProgressInfo` with two new fields:
  - `absoluteTotalLessons: number` — the full course lesson count (always `videoCount`)
  - `absoluteCompletionPct: number` — `completedLessons / absoluteTotalLessons * 100`
  - The existing `totalLessons` and `completionPct` fields carry the target-capped values
- Update the completed-course detection (line 142): if target denominator > 0 and `completedLessons >= targetDenominator`, count as completed — even if absolute lessons remain
- For catalog courses (`courseType === 'catalog'`): skip target logic entirely — 0/0 already handled by existing code
- **No async work needed**: Since `targetLessonCount` is a sync value on the entry (no module-name DB queries), no stale-closure guard, generation counter, or loading state management is required. This is a significant simplification vs the originally considered dual-field approach.

**Part B — Multi-path progress (useMultiPathProgress):**
- Change `courseProgressLookup` (line 236-269) from `Map<courseId, CourseProgressInfo>` to `Map<pathId:courseId, CourseProgressInfo>` so the same course in different paths with different `completionTarget` values are tracked independently (R7)
- Update the aggregation loop (line 283) to match on the composite key: `courseProgressLookup.get(pathId + ':' + entry.courseId)`
- Extend `CourseProgressInfo` with the fields already defined in Part A: `totalLessons` (target-capped, existing semantics), and `absoluteTotalLessons` + `absoluteCompletionPct` (new). All four fields are available per-path.
- `absoluteTotalLessons` and `absoluteCompletionPct` remain available for consumers that need cross-path aggregates (e.g., `PathAnalyticsTab`)
- The per-path `PathProgressSummary` aggregation uses target-capped denominators when available; consumers that want absolute cross-path totals use `absoluteCompletionPct`

**Patterns to follow:**
- [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts#L55-L162) — current `computeProgress` loop structure
- [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts#L190-L337) — current `useMultiPathProgress` implementation and composite key insertion point

**Technical design:**

> *This illustrates the intended approach for the progress computation loop and is directional guidance for review, not implementation specification.*

```text
for each entry in entries (imported type only):
  course = importedMap.get(entry.courseId)
  absoluteTotal = course?.videoCount ?? 0
  completedLessons = computed from progress records

  if entry.completionTarget?.targetLessonCount >= 1:
    targetTotal = Math.min(entry.completionTarget.targetLessonCount, absoluteTotal)
    clampedCompleted = Math.min(completedLessons, targetTotal)
  else:
    targetTotal = absoluteTotal  // no target
    clampedCompleted = Math.min(completedLessons, targetTotal)

  result.set(entry.id, {  // keyed by entry ID (not courseId) for per-path variance
    courseId,
    completedLessons: clampedCompleted,
    totalLessons: targetTotal,            // target-capped (primary)
    completionPct: targetTotal > 0 ? (clampedCompleted / targetTotal) * 100 : 0,
    absoluteTotalLessons: absoluteTotal,   // NEW: full course count
    absoluteCompletionPct: absoluteTotal > 0 ? (completedLessons / absoluteTotal) * 100 : 0,  // NEW
  })
```

**Test scenarios:**
- Happy path: Entry with `targetLessonCount: 60`, 45 lessons completed → `completionPct = 75%` (45/60), `absoluteCompletionPct = 45%` (45/100)
- Happy path: Entry with `targetLessonCount: 60`, 60 lessons completed → `completionPct = 100%` (course marked complete)
- Happy path: Entry without `completionTarget` → `totalLessons = videoCount` (unchanged behavior)
- Edge case: `targetLessonCount` exceeds actual lesson count (60 cap on a 50-lesson course) → `totalLessons = 50` (clamped)
- Edge case: Catalog course entry with `completionTarget` → `totalLessons = 0`, `completionPct = 0` (unchanged)
- R7: Same `courseId` in two different paths, one with `targetLessonCount: 30` and one without → `useMultiPathProgress` returns different `totalLessons` per path
- R7: `useMultiPathProgress` dedup key changed from courseId to pathId:courseId → no progress conflation across paths
- Integration: Mark all target lessons complete → `completedCoursesCount` increments (target-complete = path-complete)
- Integration: `estimatedRemainingHours` reflects target-capped remaining as primary, with absolute remaining available for dual display

---

- [ ] **Unit 4: Milestone & Completion Alignment**

**Goal:** Ensure path milestone celebrations (25/50/75/100% toasts) and the "Path Complete" banner use target-capped denominators, aligning with what the path UI considers "complete."

**Requirements:** R5, R10

**Dependencies:** Unit 3 (progress hook must return target-capped data)

**Files:**
- Modify: `src/lib/pathCompletion.ts` — update `computePathCompletionPct` to accept and apply `LearningPathEntry[]` (with `completionTarget`)
- Modify: `src/lib/challengePathMilestones.ts` — update `calculatePathMilestoneProgress` to pass entries through for target-aware denominator computation
- Modify: `src/app/pages/LearningTrackDetail.tsx` — ensure the "Path Complete" banner call site passes entry data through
- Test: `src/lib/__tests__/pathCompletion.test.ts`
- Test: `src/lib/__tests__/challengePathMilestones.test.ts`

**Approach:**
- `computePathCompletionPct` currently computes `totalCompleted / totalLessons` using Dexie queries against `importedVideos` and progress. Add an optional `pathEntries?: LearningPathEntry[]` parameter (distinct from the existing `entries: PathCompletionEntry[]` positional parameter). When provided, apply the same `completionTarget` logic from Unit 3 to each course's `totalLessons` denominator before summing.
- `calculatePathMilestoneProgress` calls `computePathCompletionPct` — thread the entries parameter through.
- In `LearningTrackDetail.tsx`, the milestone celebration call site already has access to `entries` (from the store). Pass `entries` to the milestone computation so it uses target-capped progress.
- When entries are not provided (backward compatibility for other callers), fall back to the existing absolute-progress behavior.

**Patterns to follow:**
- [src/lib/pathCompletion.ts](src/lib/pathCompletion.ts#L40) — current `computePathCompletionPct` signature and computation
- [src/lib/challengePathMilestones.ts](src/lib/challengePathMilestones.ts#L76) — `calculatePathMilestoneProgress` signature
- [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts) — the target-capped denominator logic from Unit 3 (keep in the hook; milestone functions extract the same per-course caps from entries)

**Technical design:**

> *This illustrates the intended approach for milestone alignment and is directional guidance for review, not implementation specification.*

```text
computePathCompletionPct(courses, progressRecords, pathEntries?):
  for each course:
    if pathEntries:
      entry = pathEntries.find(e => e.courseId === course.id)
      targetTotal = resolveEffectiveTotal(course.videoCount, entry?.completionTarget)
    else:
      targetTotal = course.videoCount  // backward compat
    completed = Math.min(progressRecords[course.id] ?? 0, targetTotal)
    totalCompleted += completed
    totalTarget += targetTotal
  return totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0
```

**Test scenarios:**
- Happy path: Path with 2 courses, each at 100% target (but not 100% absolute) → `computePathCompletionPct` returns 100% with entries provided
- Happy path: Path with 2 courses, one at 50% target → `computePathCompletionPct` returns 50% (midpoint of target denominators)
- Happy path: `computePathCompletionPct` called without entries → uses absolute denominators (backward compatible)
- Edge case: Mixed path (one course with target, one without) → denominators computed correctly per course
- Integration: Milestone toast fires at 100% target completion, not 100% absolute completion
- Integration: "Path Complete" banner shows when all target denominators are met

**Verification:**
- Create a path with a course capped at 5 lessons target. Complete those 5 lessons.
- Verify the path shows as 100% complete and milestone toast fires
- Verify the "Path Complete" banner appears
- Verify that completing lessons beyond the target doesn't change the milestone state

---

- [ ] **Unit 5: Dual Progress Display**

**Goal:** Show target-capped progress as the primary indicator and absolute progress as secondary in the path progress sidebar and timeline entries.

**Requirements:** R4, R5

**Dependencies:** Unit 3 (`CourseProgressInfo` must include `absoluteTotalLessons` and `absoluteCompletionPct`)

**Files:**
- Modify: `src/app/components/learning-path/PathProgressSidebar.tsx` — dual progress display with target as primary and absolute as secondary
- Modify: `src/app/components/learning-path/PathTimeline.tsx` — per-entry progress badges showing "45/60 target" with "(100 total)" subtitle for targeted entries
- Modify: `src/app/components/learning-path/SortableCourseTimelineEntry.tsx` — same badge change for edit-mode entries
- Test: E2E test for the path detail page with targeted courses (extend existing path detail specs)

**Approach:**
- **Sidebar**: When any entry has a `completionTarget`, show a primary ring with target-capped progress and secondary text:
  - Primary ring: target-capped `completionPct` with `aria-label="N of M target lessons complete. N of T total lessons."` for screen readers (WCAG 4.1.2)
  - Secondary text below: "45/100 total lessons" showing absolute counts, in `text-muted-foreground`
  - When no entries have targets, show the standard single ring (no change)
  - Estimated remaining hours: show "~5h (target) / ~12h (full)" when targets differ from absolute
  - **Responsive**: On mobile (< 640px), stack the primary ring and secondary text vertically instead of side-by-side. On tablet+ (≥ 640px), use the default horizontal layout. Use Tailwind responsive prefixes (`max-sm:flex-col sm:flex-row`)
- **Timeline entries**: For entries with `completionTarget`:
  - Status badge shows target progress: "45/60 target ✓" (green if target-complete)
  - Small subtitle below badge: "100 total" in muted text
  - Add `aria-label="45 of 60 target lessons complete. 45 of 100 total."` on the badge container for screen readers
  - For entries without targets: show the standard badge (no change)
- **Completion status logic**: The `isCompleted` check at [PathTimeline.tsx#L665](src/app/components/learning-path/PathTimeline.tsx#L665) (`pct >= 100`) already uses the target-capped `completionPct` from the progress hook — no change needed to the logic itself
- Design tokens: Use `text-brand-soft-foreground` for target labels, `text-muted-foreground` for absolute progress subtitles. No hardcoded colors.

**Patterns to follow:**
- [src/app/components/learning-path/PathProgressSidebar.tsx](src/app/components/learning-path/PathProgressSidebar.tsx) — current single-ring progress display
- [src/app/components/learning-path/PathTimeline.tsx](src/app/components/learning-path/PathTimeline.tsx#L298-L299) — existing `justification` display pattern for per-entry metadata
- [src/styles/theme.css](src/styles/theme.css) — brand color tokens for progress indicators

**Test scenarios:**
- Happy path: Entry with `completionTarget` shows "45/60" in the timeline badge and full ring shows 75%
- Happy path: Target-complete entry (60/60 target, 60/100 absolute) shows green checkmark and "Complete" status
- Happy path: Entry without `completionTarget` shows standard single badge (no "total" subtitle)
- Edge case: Path where all entries lack `completionTarget` → sidebar shows standard single ring (no dual display)
- Edge case: Path where some entries have targets and some don't → sidebar shows aggregate target progress as primary
- Integration: Clicking a target-complete entry in the timeline expands to show lessons beyond the target (they're still accessible)
- Integration: `estimatedRemainingHours` in the sidebar reflects target-based time when targets are active

**Verification:**
- Visual check: Import a track with `completionTarget` entries, open the track detail page
- The sidebar shows target-capped progress as the primary ring
- Timeline entries with targets show "X/Y" badges with absolute total subtitle
- Entries without targets show normal badges (no regression)
- A target-complete course shows as "complete" in the timeline

---

- [ ] **Unit 6: Integration Verification & E2E**

**Goal:** End-to-end validation of the full pipeline — manifest import through progress display — with build, lint, type check, and existing E2E regression pass.

**Requirements:** R1–R10 (full coverage)

**Dependencies:** Units 1–5

**Files:**
- Test: E2E spec for completion target flow (new or extend existing path detail spec)
- Test: Update existing test data fixtures that construct `LearningPathEntry` objects (e.g., [src/lib/sync/__tests__/p3-lww-batch-a-sync.test.ts](src/lib/sync/__tests__/p3-lww-batch-a-sync.test.ts#L133)) to include `completionTarget` field
- Verify: Run `npm run build && npm run lint && npx tsc --noEmit`

**Approach:**
- Create or extend an E2E test that:
  1. Imports a track with a manifest containing `completionTarget`
  2. Navigates to the track detail page
  3. Verifies targeted courses show "X/Y target" progress indicators
  4. Marks lessons complete up to the target
  5. Verifies the course shows as "complete" at target threshold
  6. Marks a lesson beyond the target — verifies target progress unchanged, absolute increment visible
  7. Verifies courses without `completionTarget` behave normally
- Audit and update all test fixtures that construct `LearningPathEntry` objects to include `completionTarget` (even if `undefined`) to prevent type errors
- Run the full pre-check suite: build, lint, type check, unit tests, E2E tests (Chromium)

**Patterns to follow:**
- [tests/e2e/](tests/e2e/) — existing E2E test patterns and path detail specs
- [tests/support/fixtures/](tests/support/fixtures/) — test data fixture patterns

**Test scenarios:**
- Happy path: Full import → display → complete → milestone flow with a targeted course
- Edge case: Course with `targetLessonCount` larger than actual lesson count — progress caps at actual count
- Regression: All existing path detail E2E tests pass (courses without targets behave identically)
- Regression: `npm run build` passes
- Regression: `npm run lint` passes
- Regression: `npx tsc --noEmit` passes

**Verification:**
- All E2E tests pass (Chromium)
- Build, lint, and type check pass with zero errors
- Manual verification: import track with targets, verify progress display

## System-Wide Impact

- **Interaction graph:** The change flows through manifest parsing → import pipeline → Zustand store → Dexie persistence → progress calculation hook → milestone system → sidebar + timeline display. All layers from parse to paint are touched.
- **Error propagation:** Manifest parsing errors surface at import time (validation rejects invalid `targetLessonCount` values). Runtime errors are limited to the clamped clamping case (target > actual lesson count) — handled silently with `Math.min()`. No async fallbacks or stale-closure risks since `completionTarget` computation is purely synchronous.
- **State lifecycle risks:** `completionTarget` is set once at import and never mutated by the application. The reorder methods preserve it via spread (`{ ...entry }`). The sync system passes it through as part of the JSON payload. No risk of partial-write or duplicate-target corruption.
- **API surface parity:** `addCourseToPath` accepts `completionTarget` via store methods. `batchAddCoursesToPath` and `createPathWithCourses` accept it via the extended intermediate type. Manual course addition (via UI) does not expose a target control — that's deferred to a future iteration.
- **Integration coverage:** The milestone system (`challengePathMilestones.ts`, `pathCompletion.ts`) operates on a separate code path from the progress hook. Unit tests alone will not prove they align — E2E verification of the milestone toast firing at target-completion is needed.
- **Unchanged invariants:**
  - `ImportedCourse.videoCount` is never modified — it always reflects the absolute lesson count
  - `ImportedVideo.moduleTitle` is never modified — matching is read-only
  - `LearningPathEntry` fields other than the new `completionTarget` are unchanged — no schema migration rewrites existing data
  - The progress ring for courses without `completionTarget` computes identically to the current code
  - The `justification` field behavior is unchanged — it remains a separate concern from `completionTarget`

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `useMultiPathProgress` courseId-keyed conflation violates R7 | Unit 3 (Part B) changes lookup key to `pathId:courseId` composite. All four consumer surfaces verified in Unit 3 test scenarios |
| Missing `completionTarget` at a construction site silently drops the field | `completionTarget` is optional on the interface — TypeScript won't flag a missing field. Mitigation: (a) Unit 2 lists every known construction site with explicit instructions; (b) implementer must audit each site; (c) E2E test in Unit 6 verifies the field reaches Dexie after import |
| Milestone toasts fire at wrong thresholds (absolute vs target) | Unit 4 specifically addresses this — milestones accept entries and apply target-capped denominators |
| `applyAIOrder` selective field override drops `completionTarget` | Unit 2 adds `completionTarget: entry.completionTarget` as an explicit field in the return object alongside `position`, `justification`, and `isManuallyOrdered` — no longer relies solely on `{ ...entry }` spread |
| Re-import doesn't update changed targets | Documented as a known limitation in Scope Boundaries. Future iteration will add re-import detection |

## Sources & References

- **Origin document:** [Desktop/completion-target-feature-prompt.md](Desktop/completion-target-feature-prompt.md)
- **Related code:**
  - [src/data/types.ts](src/data/types.ts#L506-L514) — `LearningPathEntry`
  - [src/lib/courseManifest.ts](src/lib/courseManifest.ts#L51-L56) — `TrackManifestCourse`
  - [src/lib/trackManifestImport.ts](src/lib/trackManifestImport.ts) — Import pipeline
  - [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts) — Store methods
  - [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts) — Progress computation
  - [src/lib/pathCompletion.ts](src/lib/pathCompletion.ts) — Milestone completion
  - [src/lib/challengePathMilestones.ts](src/lib/challengePathMilestones.ts) — Milestone celebrations
  - [src/app/components/learning-path/PathProgressSidebar.tsx](src/app/components/learning-path/PathProgressSidebar.tsx) — Progress sidebar
  - [src/app/components/learning-path/PathTimeline.tsx](src/app/components/learning-path/PathTimeline.tsx) — Timeline entries
- **Institutional learnings:**
  - [docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md](docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md) — Store mutation discipline
  - [docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md](docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md) — Stale closure guards
  - [docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md](docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md) — Hook loop rules
  - [docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md](docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md) — syncableWrite pass-through
