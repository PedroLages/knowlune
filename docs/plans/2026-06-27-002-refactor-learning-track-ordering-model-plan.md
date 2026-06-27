---
title: "refactor: Scope track ordering to the join row and make mode explicit"
type: refactor
status: active
date: 2026-06-27
deepened: 2026-06-27
---

# Refactor: Scope Track Ordering to the Join Row and Make Mode Explicit

## Overview

Move all ordering-related fields from `ImportedCourse` (wrong scope) and the per-entry `isManuallyOrdered` flag (wrong granularity) onto `LearningPathEntry` and `LearningPath` respectively. Consolidate the two-pass import (createPathWithCourses → applyManifestOrder) into a single canonical write for new manifest tracks (the existing-track import path remains two-pass because merging into pre-existing state inherently requires append-then-reorder). The structural changes are scoped to the data model and the store — the DnD machinery, AI ordering, template forking, and UI display code remain unchanged except where they reference the old field names or flags.

## Problem Frame

Research into production-grade ordered-list implementations (Figma, Linear, Jira, Airtable, Spotify, Notion) identified three architectural gaps:

1. **`manifestPosition` on `ImportedCourse` is wrong scope.** A course can appear in multiple tracks with different positions. Order is a property of the track–course membership, not the course object. (Analog: Spotify stores order per playlist mutation, Airtable stores it per linked-record cell.)

2. **`isManuallyOrdered` per-entry is wrong granularity.** "Manual ordering" is a mode of the container, not a property of individual items. Linear and Airtable both make it a view/container mode. Per-entry flags create ambiguity when some items are moved and others aren't.

3. **The two-pass import for new tracks is a smell.** Production systems write canonical order once; the current "positions, then applyManifestOrder correction" pattern for new manifest tracks is noise when it works and silently wrong when it diverges. (The existing-track path is inherently two-pass because entries already exist — this is acceptable and out of scope for this refactor.)

The immediate order-in-picker bug is fixed (`7f09d3b6`). This refactor addresses the root structural issues.

## Requirements Trace

- **R1.** Every learning path entry carries a `manifestOrdinal` (immutable curated position from the import manifest) on the entry row, not on the course record.
- **R2.** The learning path has an explicit `orderMode` ("manifest" | "custom") that determines whether the displayed order follows the manifest or the user's manual arrangement. The mode flips to "custom" on first user drag reorder.
- **R3.** Every entry carries provenance fields (`source`, `state`, `manifestCourseKey`) so future re-import/merge flows can distinguish manifest-origin from user-added entries.
- **R4.** New tracks created from a manifest write entries in canonical order in one pass — no separate `applyManifestOrder` correction call.
- **R5.** Existing tracks and existing code paths (AI generation, template forking, manual creation, DnD reorder) continue to work without behavioral changes.
- **R6.** The `InlineCoursePicker` continues to display courses sorted by manifest position where known, falling back to alphabetical.

## Scope Boundaries

### In Scope
- Type changes to `LearningPathEntry`, `LearningPath`, `ImportedCourse`
- Store changes: new `createPathFromManifest` method, `orderMode` flip logic, `manifestOrdinal` population
- `batchImportTrackCourses` consolidation
- `InlineCoursePicker` sort-source change (store lookup instead of course field)
- Supabase sync field mapping for new columns

### Deferred to Separate Tasks
- **S05: Rename `position` → `orderKey`** — cosmetic, touches ~15 files, mechanical search-and-replace. Do separately to avoid review noise.
- **S06: Remove `ImportedCourse.manifestPosition`** — after one release cycle when all legacy tracks have been migrated by `loadPaths()`. The field is soft-deprecated in this refactor (kept on type, never written, only read by migration).
- **Fractional indexing / LexoRank** — overkill for 16–50 item lists. Dense integers with transactional renumbering suffice.
- **Manifest versioning + merge engine** — build when re-import of updated manifests becomes a user need.
- **Picker/commit order separation** — current single-confirm flow already matches research recommendation for curated tracks.

## Context & Research

### Relevant Code and Patterns

| File | Role |
|------|------|
| `src/data/types.ts` — `ImportedCourse` interface | Keeps deprecated `manifestPosition` for legacy migration only (removed in S06) |
| `src/data/types.ts` — `LearningPath` and `LearningPathEntry` interfaces | Target of all new fields |
| `src/stores/useLearningPathStore.ts` — methods: `createPathWithCourses`, `applyManifestOrder`, `reorderPathCourses`, `addCourseToPath`, `batchAddCoursesToPath`, `generatePath`, `applyAIOrder`, `forkTemplate`, `applyPlacementSuggestion`, `loadPaths` | All ordering-related store methods |
| `src/lib/trackManifestImport.ts` — `batchImportTrackCourses` | The two-pass import pipeline |
| `src/app/components/figma/InlineCoursePicker.tsx` — `allCourses` memo / picker sort logic | Picker sort logic — currently reads `ImportedCourse.manifestPosition` |
| `src/app/components/learning-path/PathTimeline.tsx` | Uses `entry.position` for display label |
| `src/lib/sync/syncableWrite.ts` | Sync write path — all Dexie writes must go through this |
| `src/lib/sync/hydrateP3P4.ts` — template entry hydration | Sets `isManuallyOrdered: false` |
| `supabase/migrations/20260427000001_p3_sync.sql` — `learning_path_entries` table schema | Table definition |

### Institutional Learnings

- **Completion-target plan** (`docs/plans/2026-06-26-001-feat-completion-target-learning-tracks-plan.md`): Documents the "required-but-optional" pattern — intermediate types force call sites to pass the new field, while Dexie types keep it optional for backward compat. Use this pattern for `manifestOrdinal`, `source`, `state`, `manifestCourseKey`.
- **Two-pass import identified as a smell** (`docs/plans/2026-06-27-learning-track-ordering-refactor.md`): The research explicitly flags the current pattern.
- **Curriculum composer lesson 4** (`docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md`): When batch-adding entries, read parent path's `updatedAt` from optimistically-updated Zustand state, not Dexie.
- **Dexie migration pattern** (`docs/engineering-patterns.md`, Dexie schema evolution section): Adding optional fields to existing tables does NOT require a Dexie version bump. Only index changes or data migrations need `db.version(N+1)`.

### External References

Comprehensive LLM research into Figma (fractional indexing), Jira (LexoRank), Trello (sparse numeric pos), Linear (orderMode + sortOrder as Float), Spotify (snapshot_id + playlist-scoped order), Notion (view-scoped order, synced blocks), and Airtable (view-specific sorting, linked-record order). Key conclusion: **order belongs on the join row, mode belongs on the container, and provenance enables merge.**

## Key Technical Decisions

- **Keep dense integer positions.** Fractional indexing is overkill for 16–50 item lists. Transactional renumbering in IndexedDB (atomic per-track) is simpler and correct at our scale.

- **`isManuallyOrdered` becomes dead legacy data after this refactor.** The field stays on `LearningPathEntry` with a `@deprecated` JSDoc tag so existing Dexie rows don't break on read. New code never writes it. The only ordering truth after this refactor is `LearningPath.orderMode` + `LearningPathEntry.position` + `LearningPathEntry.manifestOrdinal`. Tests that assert `isManuallyOrdered === true` must be updated to assert `path.orderMode === "custom"` instead.

- **`orderMode` defaults are explicit per creation path.** `"manifest"` means "this path still follows an imported curated source." Only `createPathFromManifest()` creates manifest-mode paths. All other creation paths (manual picker, AI generation, template fork, empty path) default to `"custom"`.

- **Expose `manifestOrdinalByCourseId` as a store getter, not a Map cache.** The picker needs to sort courses by manifest position after the field moves off `ImportedCourse`. A `getManifestOrdinalMap(): Map<string, number>` store method computes it from loaded entries. Courses not in any path (no entry → no ordinal) fall back to alphabetical order.

- **New `createPathFromManifest` method rather than overloading `createPathWithCourses`.** The manifest path has distinct behavior (accepts manifest metadata, writes `orderMode = "manifest"`, populates provenance in one pass). A separate method is cleaner than adding optional manifest parameters to the generic creation path.

## Implementation Units

### Unit 1: Add new fields to types and schema

**Goal:** Add types, Dexie version bump, and Supabase columns for the new ordering model.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260627000001_add_order_mode_and_provenance.sql` — new migration
- Modify: `src/data/types.ts` — `LearningPath`, `LearningPathEntry`, `ImportedCourse`
- Modify: `src/db/schema.ts` — bump Dexie version to 69
- Modify: `src/stores/useLearningPathStore.ts` — all entry construction sites (see Unit 2)
- Modify: `src/lib/trackManifestImport.ts` — remove `ImportedCourse.manifestPosition` write
- Modify: `src/app/components/figma/InlineCoursePicker.tsx` — change sort source (see Unit 3)

**Approach:**

1. **Supabase SQL migration** (must deploy before code):

```sql
ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS order_mode TEXT,
  ADD COLUMN IF NOT EXISTS base_manifest_hash TEXT;

ALTER TABLE learning_path_entries
  ADD COLUMN IF NOT EXISTS manifest_ordinal INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS manifest_course_key TEXT;
```

2. **Type changes in `src/data/types.ts`:**

```ts
// LearningPath — add:
orderMode: "manifest" | "custom"
baseManifestHash?: string | null

// LearningPathEntry — add:
manifestOrdinal?: number | null       // immutable curated position from manifest
source?: "manifest" | "user"          // provenance: who added this entry
state?: "active" | "removed-upstream" | "detached"  // relationship to current manifest
manifestCourseKey?: string | null     // stable folder-level ID for future merge matching

// LearningPathEntry — mark as deprecated:
/** @deprecated Use LearningPath.orderMode instead. Kept for legacy Dexie rows. */
isManuallyOrdered: boolean

// ImportedCourse — soft-deprecate, do not remove:
/** 
 * @deprecated Legacy migration bridge only. Do not write new values.
 * Ordering now lives on LearningPathEntry.manifestOrdinal.
 * Remove after one release cycle when all legacy tracks are migrated.
 */
manifestPosition?: number
```

`manifestPosition` stays on `ImportedCourse` because the `loadPaths()` migration (Unit 2) reads it to backfill `manifestOrdinal` for legacy tracks. Removal is deferred to a separate cleanup task (S06).

3. **Dexie schema version bump** in `src/db/schema.ts`:
```ts
db.version(69).stores({})
// Documents new optional fields: LearningPath.orderMode, LearningPath.baseManifestHash,
// LearningPathEntry.manifestOrdinal, .source, .state, .manifestCourseKey.
// No index changes. Follows pattern from v67 (progressionMode) and v68 (completionTarget).
```

4. Intermediate types for `createPathWithCourses` and `batchAddCoursesToPath` gain the new optional fields (following the completion-target plan's required-but-optional pattern — TypeScript forces every call site to acknowledge them).

**Patterns to follow:**
- Completion-target plan's "required-but-optional" pattern for intermediate types
- `src/lib/sync/tableRegistry.ts:488-494` — existing `fieldMap` pattern for sync tables. Add explicit camelCase → snake_case entries:
  ```ts
  learningPaths: { fieldMap: { orderMode: "order_mode", baseManifestHash: "base_manifest_hash" } }
  learningPathEntries: { fieldMap: { manifestOrdinal: "manifest_ordinal", manifestCourseKey: "manifest_course_key", source: "source", state: "state" } }
  ```
- `src/db/schema.ts:1767-1771` — existing `db.version(N).stores({})` pattern for optional non-indexed fields

**Test expectation:** none — type-only changes. Build and `tsc --noEmit` verify correctness.

**Verification:** `npx tsc --noEmit` passes with zero errors. `npm run build` succeeds. Supabase columns exist before first sync with new code.

---

### Unit 2: Add `orderMode` logic, migration, and provenance

**Goal:** Wire `orderMode` into every creation and mutation path. Implement `loadPaths()` migration. Define `applyManifestOrder` contract. Fix reorder-history to use `orderMode` instead of the deprecated `isManuallyOrdered` flag. Populate provenance fields during manifest imports and manual adds. Stop writing `isManuallyOrdered` from all new code.

**Requirements:** R1, R2, R3, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `src/stores/useLearningPathStore.ts` — `loadPaths` (add migration), `createPath` (set default `orderMode`), `createPathWithCourses` (accept optional `orderMode`), `addCourseToPath`, `reorderPathCourses`, `applyManifestOrder`, `batchAddCoursesToPath`, `forkTemplate`, `generatePath`, `applyAIOrder`, `applyPlacementSuggestion`
- Modify: `src/lib/trackManifestImport.ts` — populate provenance fields on imported entries
- Modify: `src/lib/sync/hydrateP3P4.ts` — stop writing `isManuallyOrdered` on hydrated template entries
- Modify: `src/ai/learningPath/generatePath.ts` — stop writing `isManuallyOrdered`
- Modify: `src/ai/learningPath/generatePathFromGoal.ts` — stop writing `isManuallyOrdered`

**Approach:**

#### 2a. `orderMode` defaults table

| Creation path | `orderMode` | Rationale |
|---|---|---|
| `createPathFromManifest()` | `"manifest"` | Still follows imported curated source |
| Manual picker (`createPathWithCourses`) | `"custom"` | User-authored, no external manifest |
| AI generation (`generatePath`) | `"custom"` | AI output is a suggestion, not an imported source of truth |
| Template fork (`forkTemplate`) | `"custom"` | Forked copy is user-owned from creation |
| Empty path (`createPath`) | `"custom"` | User-authored until proven otherwise |
| `batchAddCoursesToPath` | Preserves existing track mode | Adding courses doesn't change mode |

Only `createPathFromManifest()` (Unit 4) creates `"manifest"` mode paths. All other creation paths default to `"custom"`.

**Manifest-mode paths can contain user-added entries without flipping mode.** Adding a course via `addCourseToPath` or `batchAddCoursesToPath` to a `"manifest"` track does NOT change `orderMode`. The display rule is: manifest-sourced entries remain ordered by `manifestOrdinal`, and user-added entries sit after them (higher `position`). Only an explicit reorder (`reorderPathCourses`) flips the mode to `"custom"`.

#### 2b. `loadPaths()` migration logic

Add a migration helper that runs once per `loadPaths()` call (idempotent — checks whether `orderMode` already exists before computing):

```ts
function migrateLegacyPathOrdering(
  path: LearningPath,
  entries: LearningPathEntry[],
  coursesById: Map<string, ImportedCourse>
): {
  pathPatch?: Partial<LearningPath>
  entryPatches: Array<{ id: string; patch: Partial<LearningPathEntry> }>
}
```

**Per-entry rules:**

```
for each entry:
  if entry is a gap (courseId === ''):
    manifestOrdinal = null
    source = entry.source ?? "user"
    state = entry.state ?? "active"
    manifestCourseKey = null

  else if entry.manifestOrdinal != null:
    // Already has manifestOrdinal, but may still be missing other
    // provenance fields from a partial prior migration.
    manifestOrdinal = entry.manifestOrdinal
    source = entry.source ?? "manifest"
    state = entry.state ?? "active"
    manifestCourseKey = entry.manifestCourseKey ?? course?.folder ?? null

  else if course.manifestPosition exists:
    // Best-effort legacy bridge from old wrong-scope field.
    // This is not correct long-term but prevents data loss for
    // tracks imported before this refactor.
    manifestOrdinal = course.manifestPosition
    source = entry.source ?? "manifest"
    state = entry.state ?? "active"
    manifestCourseKey = entry.manifestCourseKey ?? course.folder ?? null

  else:
    manifestOrdinal = null
    source = entry.source ?? "user"
    state = entry.state ?? "active"
    manifestCourseKey = null
```

**Path-level rules:**

```ts
if path.orderMode already exists:
  keep it (already migrated)

else if any entry.isManuallyOrdered === true:
  orderMode = "custom"

else if entries.length === 0:
  orderMode = "custom"

else if no entry has a resolvable manifestOrdinal:
  orderMode = "custom"

else if manifest-sourced entries are still in manifestOrdinal order:
  // Compare only entries that have a manifestOrdinal, sorted by current
  // position first (Dexie load order is not guaranteed to match position).
  // A user-added course at the tail (manifestOrdinal: null) doesn't
  // break the manifest contract for the entries that do have ordinals.
  const manifestEntries = entries
    .filter(e => e.manifestOrdinal != null)
    .sort((a, b) => a.position - b.position)
  const inManifestOrder = manifestEntries.every((e, i) => {
    if (i === 0) return true
    return e.manifestOrdinal! > manifestEntries[i - 1].manifestOrdinal!
  })

  if inManifestOrder:
    orderMode = "manifest"
  else:
    orderMode = "custom"

else:
  orderMode = "custom"
```

**Persistence after migration:**

After computing `pathPatch` and `entryPatches`, persist each patch individually through `syncableWrite`. This follows the same optimistic-update and rollback pattern used by every other mutation in the store (e.g., `reorderPathCourses`, `createPathWithCourses`):

1. Apply patches to Zustand state immediately (optimistic update).
2. If `pathPatch` is non-empty, persist it via `syncableWrite("learningPaths", [pathPatch])`.
3. Persist each entry patch individually via `syncableWrite("learningPathEntries", [patch])`.
4. **Rollback on failure:** If any `syncableWrite` call fails, restore ALL pre-migration entry and path state in Zustand (revert to the snapshot taken before migration began) and surface a toast error. This mirrors the rollback pattern in `reorderPathCourses`.
5. **Sentinel guard:** Use `manifestOrdinal != null` as the read-side sentinel — if an entry already has `manifestOrdinal`, skip it during migration on subsequent `loadPaths()` calls. This prevents re-migration and is cheaper than a separate migration flag.

**Partial-failure recovery:** If the process crashes mid-persistence (some entries persisted, others not), the next `loadPaths()` call re-migrates only the entries still missing `manifestOrdinal`. Already-migrated entries are skipped by the sentinel guard. This is safe because the migration is monotonic (it only adds fields, never removes or reorders). The path's `orderMode` is recomputed from entry state on each pass, so a partial path write followed by re-migration on next load produces the same `orderMode` as a complete single pass.

**Coverage of legacy cases:**

| Legacy case | New mode |
|---|---|
| Old manifest import with `course.manifestPosition`, never dragged | `"manifest"` if positions still match ordinals |
| Old manifest import later dragged by user | `"custom"` |
| Old manual path (never had a manifest) | `"custom"` |
| Empty path | `"custom"` |
| Gap entries | `source: "user"`, `state: "active"`, no manifest ordinal |

Backfilling from `ImportedCourse.manifestPosition` is a **best-effort one-time bridge**. It is not the long-term source of truth because course-level manifest position is the old wrong scope. After one release cycle when all legacy tracks have been migrated, `ImportedCourse.manifestPosition` can be removed in S06.

**Transitional invariant:** This migration depends on `ImportedCourse.manifestPosition` existing as stale data from old code paths. Since `manifestPosition` is marked "do not write new values" after this refactor, the migration is a genuine one-shot bridge — it only works because legacy tracks happened to receive `manifestPosition` writes before this refactor. If a user has never loaded their app since the old manifest write patterns were active, there are no `manifestPosition` values to backfill from. In that case, the migration correctly produces `orderMode: "custom"` and `source: "user"` for all entries — the track works normally, just without manifest-ordering semantics. This is safe behavior: the migration is not a guaranteed backfill for every possible pre-refactor state, but it correctly degrades to the conservative `"custom"` default when the old-scope field was never populated.

#### 2c. `reorderPathCourses` changes

- Read the track's current `orderMode` before reassigning positions.
- Flip `orderMode` to `"custom"` in the same optimistic update (no separate write).
- Reorder history recording: gate on the reorder operation itself (`fromIndex !== toIndex`), not on `movedEntry.isManuallyOrdered`. The deprecated per-entry flag no longer controls whether history exists.

```ts
const wasOrderMode = path.orderMode ?? "custom"
const switchedFromManifest = wasOrderMode === "manifest"

const updatedPath = {
  ...path,
  orderMode: "custom" as const,
  updatedAt: new Date().toISOString(),
}
```

- Store `switchedFromManifest` in history metadata if useful for analytics.
- Remove `isManuallyOrdered: true` assignment (inside `reorderPathCourses` method). Stop writing `isManuallyOrdered: false` at all entry creation sites.

#### 2d. `applyManifestOrder` contract

```ts
applyManifestOrder(
  pathId: string,
  manifestCourses: Array<{
    folder: string
    courseId?: string
    position: number
  }>,
  options?: {
    setOrderMode?: "manifest" | "preserve"
    baseManifestHash?: string
  }
): Promise<void>
```

**Behavior:**

1. Match existing entries to manifest courses by `manifestCourseKey`, then folder, then course ID.
2. Set matched entries: `source = "manifest"`, `state = "active"`, `manifestOrdinal = manifest.position`, `manifestCourseKey = manifest.folder`.
3. Reassign dense `position` according to manifest sort order.
4. Append non-manifest/user/gap entries after manifest entries (existing orphan rule).
5. Set path mode: `"manifest"` if `setOrderMode === "manifest"`, or preserve current mode if `"preserve"`. **Default behavior when options are omitted or `setOrderMode` is undefined:** Preserve the current `path.orderMode`. If the path has no `orderMode` yet (pre-migration state), fall back to `"custom"` — this is the safest default because it avoids accidentally declaring a pre-migration path as manifest-sourced without evidence.
6. Update `baseManifestHash` only if provided in options.

For existing-track imports in `batchImportTrackCourses`: use `setOrderMode: "manifest"`.
A future merge engine can use `"preserve"` for "add new manifest courses but keep my custom order."

#### 2e. Entry construction site updates

Every method that creates `LearningPathEntry` rows stops writing `isManuallyOrdered`. Instead:

| Method | Sets `source` | Sets `state` | Sets `manifestOrdinal` |
|---|---|---|---|
| `addCourseToPath` | `"user"` | `"active"` | — |
| `createPathWithCourses` | `"user"` | `"active"` | — |
| `batchAddCoursesToPath` | accepts optional param, defaults `"user"` | `"active"` | — |
| `forkTemplate` | `"user"` | `"active"` | — |
| `generatePath` | `"user"` | `"active"` | — |
| `applyAIOrder` | preserves existing | preserves existing | — |
| `applyPlacementSuggestion` | preserves existing | preserves existing | — |
| `replaceGapEntry` | `"user"` | `"active"` | — |

`applyManifestOrder` and `createPathFromManifest` (Unit 4) are the only methods that write `source: "manifest"` and `manifestOrdinal`.

**Patterns to follow:**
- `reorderPathCourses` existing pattern: optimistic update → persist → rollback on error
- Curriculum composer lesson 4: read `updatedAt` from Zustand, not Dexie

**Test scenarios:**
- **Happy path:** Create track via manifest import → entries have `source: "manifest"`, `manifestOrdinal` matches manifest, track `orderMode` is `"manifest"`
- **Happy path:** Create track via manual picker → entries have `source: "user"`, track `orderMode` is `"custom"`
- **Happy path:** Create empty track → `orderMode: "custom"`
- **Happy path:** AI generate path → `orderMode: "custom"`, entries have `source: "user"`
- **Happy path:** Fork template → `orderMode: "custom"`, entries have `source: "user"`
- **Happy path:** Drag-reorder a manifest-mode track → track `orderMode` flips to `"custom"`, `manifestOrdinal` values preserved
- **Happy path:** Drag-reorder → reorder history recorded (gated on `fromIndex !== toIndex`, not the deprecated flag)
- **Edge case:** Add course to existing manifest-mode track → new entry gets `source: "user"`, existing entries keep `source: "manifest"`, track `orderMode` stays `"manifest"` (user-add doesn't flip mode — only reorder does)
- **Edge case:** `batchAddCoursesToPath` into manifest-mode track → new entries get `source: "user"`, track mode preserved
- **Migration:** Legacy track with `manifestPosition` on courses, never dragged → `orderMode: "manifest"`, `manifestOrdinal` backfilled
- **Migration:** Legacy track with `isManuallyOrdered: true` entries → `orderMode: "custom"`
- **Migration:** Legacy manual track (no manifest data) → `orderMode: "custom"`
- **Migration:** Empty legacy track → `orderMode: "custom"`
- **Migration:** Manifest track where user added a course at the end → `orderMode: "manifest"` (manifest-sourced entries still in ordinal order)
- **Migration:** Manifest track where user reordered → `orderMode: "custom"` (manifest entries no longer in ordinal order)

**Verification:**
- `src/stores/__tests__/useLearningPathStore.test.ts` — add assertions for `orderMode` defaults, flip on reorder, reorder-history gating, migration logic with all legacy cases above
- `src/lib/__tests__/trackManifestImport.test.ts` — add assertions for `manifestOrdinal` and provenance fields on imported entries
- Update existing tests: replace `entries[0].isManuallyOrdered` assertions with `path.orderMode === "custom"` and optional `entries[0].manifestOrdinal` preservation check

---

### Unit 3: Move picker sort from `ImportedCourse.manifestPosition` to store lookup

**Goal:** After moving picker sorting away from `ImportedCourse.manifestPosition`, make the `InlineCoursePicker` sort by manifest ordinal via a store getter instead.

**Requirements:** R6

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/app/components/figma/InlineCoursePicker.tsx` — change sort logic
- Modify: `src/stores/useLearningPathStore.ts` — add `getManifestOrdinalMap()` getter

**Approach:**
- Add `getManifestOrdinalMap(): Map<string, number>` to the store. It iterates `entries` across ALL loaded tracks, groups by `courseId`, and returns the minimum `manifestOrdinal` per courseId. **Multi-track tiebreak:** If the same course appears in multiple tracks with different manifest ordinals, the minimum ordinal is used — this is the most conservative choice, placing the course earliest in the picker (where users expect to see familiar courses first). Document this tiebreak explicitly in the code comment at the method's `manifestOrdinal` assignment site in the store.
- In the picker's `allCourses` memo, call `getManifestOrdinalMap()` and use it for sorting instead of `c.manifestPosition`.
- Sort logic: courses with a manifest ordinal sort by it (ascending); courses without fall back to alphabetical.
- `getManifestOrdinalMap` is called inside `useMemo` dependencies — it reads from the store snapshot synchronously.

**Patterns to follow:**
- Existing picker sort structure — just change the data source from `c.manifestPosition` to `ordinalMap.get(c.id)`

**Test scenarios:**
- **Happy path:** Picker displays courses in manifest ordinal order after batch import
- **Edge case:** Courses with no manifest ordinal (manually imported) sort alphabetically after manifest-ordered courses
- **Edge case:** Same course appears in two tracks with different manifest ordinals — picker uses the lowest ordinal

**Verification:**
- Manual testing: batch-import the DevOps-Platform-Engineer manifest, open Create Track dialog, verify picker order matches manifest

---

### Unit 4: Consolidate two-pass import into `createPathFromManifest`

**Goal:** Replace the `createPathWithCourses` → `applyManifestOrder` sequence for new tracks with a single `createPathFromManifest` store call. Keep `applyManifestOrder` for existing-track imports.

**Requirements:** R4

**Dependencies:** Unit 1, Unit 2, Unit 3

**Files:**
- Modify: `src/stores/useLearningPathStore.ts` — add `createPathFromManifest` method
- Modify: `src/lib/trackManifestImport.ts` — call `createPathFromManifest` for new tracks; keep `applyManifestOrder` for existing tracks

**Approach:**

#### 4a. Method signature

```ts
type ManifestCourseForPath = {
  courseId: string
  folder: string           // stable manifestCourseKey
  position: number         // manifest-defined ordinal
}

type CreatePathFromManifestInput = {
  name: string
  description?: string
  courses: ManifestCourseForPath[]
  manifestHash: string     // hash of track-manifest.json contents
  manifestName?: string    // optional display name for debugging
}

createPathFromManifest(input: CreatePathFromManifestInput): Promise<string>
// Returns the new pathId
```

#### 4b. Behavior

Must execute atomically in one optimistic update + one persist:

1. Sort `courses` by `position` (ascending). For duplicate positions, tie-break by `folder` alphabetically.
2. Deduplicate by `courseId`. If duplicate `courseId` values exist after sorting, keep the first item in sorted order, log a warning, and collect it as an import warning. Do not create duplicate entries.
3. Create `LearningPath`:
   ```ts
   {
     id: crypto.randomUUID(),
     name,
     description,
     orderMode: "manifest",
     baseManifestHash: manifestHash,
     progressionMode: "free",
     createdAt: now,
     updatedAt: now,
     isAIGenerated: false,
   }
   ```
4. Create `LearningPathEntry` for each course:
   ```ts
   {
     id: crypto.randomUUID(),
     pathId: path.id,
     courseId: course.courseId,
     courseType: "imported",
     position: index + 1,           // dense sequential — the mutable current order
     manifestOrdinal: course.position,  // immutable curated position from manifest
     source: "manifest",
     state: "active",
     manifestCourseKey: course.folder,
     isManuallyOrdered: undefined,  // do not write it
   }
   ```
5. Preserve manifest ordinal gaps. Example: manifest has courses at positions 1, 2, 5 → entries get dense `position` 1, 2, 3 but `manifestOrdinal` 1, 2, 5.
6. **Duplicate manifest positions**: Tie-breaking is handled in step 2. Preserve each entry's original `manifestOrdinal` value. Log a warning and collect it as an import warning — do not crash the import.
7. Single optimistic Zustand update + `syncableWrite` persist for path + all entries.
8. Roll back optimistic state if persist fails (same pattern as `createPathWithCourses`).

#### 4c. Caller changes in `batchImportTrackCourses`

- **New tracks**: Call `createPathFromManifest` with the full manifest course list, filtered to successful imports. Remove the pre-sort logic in `batchImportTrackCourses` (the pre-sort moves into the new method's internal dedup-and-sort logic). Remove the `applyManifestOrder` call for new tracks (it was a defensive no-op).
- **Existing tracks**: Keep the existing `batchAddCoursesToPath` → `applyManifestOrder` two-pass. This is inherently a merge operation and out of scope for this refactor.
- Keep `applyManifestOrder` as a standalone utility.

**Patterns to follow:**
- `createPathWithCourses` optimistic-update + persist + rollback structure
- `applyManifestOrder` orphan-detection logic (handles duplicate entries — though duplicates are impossible for new tracks)

**Test scenarios:**
- **Happy path:** Import manifest with 16 courses, all succeed → track created with 16 entries in manifest order, `orderMode: "manifest"`, `manifestOrdinal` = manifest position, `source: "manifest"`, `state: "active"`, `manifestCourseKey` = folder
- **Happy path:** Import manifest where 4 courses fail (folder not found) → track created with 12 entries, `position` contiguous 1–12, `manifestOrdinal` preserves original manifest values (may have gaps like 1, 2, 5, 7, …)
- **Happy path:** Import manifest with positions in non-array-order → entries sorted by `position` ascending, `manifestOrdinal` reflects manifest values, `position` reflects current dense order
- **Edge case:** Re-import same manifest into existing track → `batchAddCoursesToPath` + `applyManifestOrder(setOrderMode: "manifest")` reorders entries
- **Edge case:** Manifest has duplicate courseIds (shouldn't happen after dedup, but defensive) → `createPathFromManifest` deduplicates, keeps first
- **Error path:** Persist failure → rollback restores previous paths and entries, toast error shown

**Verification:**
- `src/lib/__tests__/trackManifestImport.test.ts` — update assertions to expect single-pass creation for new tracks; verify `manifestOrdinal` gap preservation; verify existing-track path still works
- `src/stores/__tests__/useLearningPathStore.test.ts` — add `createPathFromManifest` unit tests covering all scenarios above

## System-Wide Impact

- **Interaction graph:** `reorderPathCourses` gains a track-update side effect (flipping `orderMode`). `createPathFromManifest` replaces two existing calls in `batchImportTrackCourses`.
- **Error propagation:** `createPathFromManifest` follows the existing optimistic-update → persist → rollback pattern. Failures produce the same toast errors as current code.
- **State lifecycle risks:** The `orderMode` flip in `reorderPathCourses` happens in the same optimistic update that reassigns positions. If the persist fails, the rollback restores both position and `orderMode`. No partial-write risk.
- **API surface parity:** The `applyManifestOrder` method remains available for existing-track imports. Template forking and AI generation are unaffected — they continue using `createPathWithCourses` and `batchAddCoursesToPath`.
- **Integration coverage:** The picker → store interaction (Unit 3) requires an integration test or manual verification — unit tests alone can't prove the picker renders courses in the right order after a store update.
- **Unchanged invariants:** `position` (the mutable order field) remains a dense 1-indexed integer. All display code that sorts by `position` is unchanged. The DnD machinery, gap entry handling, and reorder history recording are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `orderMode` migration misses some legacy tracks | Migration runs in `loadPaths()` on every app start; any track with `isManuallyOrdered: true` entries gets `orderMode: "custom"`. Even if missed, the worst case is the track stays in `"manifest"` mode — functionally identical to current behavior where the flag is per-entry. |
| Moving picker sorting away from `ImportedCourse.manifestPosition` must land with the store getter | Units 1–3 must land in the same PR. The picker sort-source change, store getter addition, and deprecated-field handling are three commits in one PR, not separate deploys. |
| Supabase sync rejects writes with unknown columns | The sync layer maps camelCase Dexie fields to snake_case Supabase columns via explicit `fieldMap` entries (Unit 1). If the `fieldMap` is missing entries or the SQL migration hasn't been deployed, sync writes will fail. Mitigation: deploy the SQL migration from Unit 1 before code, and verify `fieldMap` covers all new fields. |
| E2E tests that assert `isManuallyOrdered === true` fail after reorder | `reorderPathCourses` stops writing `isManuallyOrdered: true`. Tests in `src/stores/__tests__/useLearningPathStore.test.ts` that assert `isManuallyOrdered` (the reorder-history test and any `isManuallyOrdered: true` assertions) must be updated to assert `path.orderMode === "custom"` instead. Optional additional assertion: `entries[0].manifestOrdinal` preserved after reorder. |
| Migration writes persist individually (non-transactional) | Unit 2b's migration persists `pathPatch` and each `entryPatch` via separate `syncableWrite` calls, creating a partial-failure window (some entries persisted, others not). **Mitigation:** The migration is monotonic (adds fields only, never removes). On next `loadPaths()` call, the sentinel guard (`manifestOrdinal != null`) skips already-migrated entries; only un-migrated entries are processed. The `orderMode` computation is idempotent across the resulting state. A crash mid-migration is self-healing. |
| Existing-track two-pass import still has the old smell | The existing-track case inherently needs two steps (append, then reorder) because the pre-existing entries are unknown. This is a different problem from the new-track case and is acceptable. A future merge-engine story would address this. |

## Documentation / Operational Notes

- **Supabase SQL migration MUST deploy before code.** Supabase rejects writes with unknown columns even when the sync layer's `fieldMap` maps them. Run the migration from Unit 1 (`supabase/migrations/20260627000001_add_order_mode_and_provenance.sql`) before deploying the refactored code. The sync `fieldMap` in `tableRegistry.ts` maps camelCase Dexie fields to snake_case Supabase columns (e.g., `orderMode` → `order_mode`). All new columns are nullable — no backfill needed.
- **No user-facing behavior change.** The same picker shows courses in the same order. The same DnD reorder works the same way. `orderMode` is an internal concept.
- **The `baseManifestHash` field** on `LearningPath` is populated on manifest import but not yet consumed. It exists for future re-import/merge flows.
- **`isManuallyOrdered` becomes dead data.** The field stays on the type with a `@deprecated` JSDoc tag so existing Dexie rows don't break on read. New code never writes it. The only ordering truth after this refactor is `LearningPath.orderMode` + `LearningPathEntry.position` + `LearningPathEntry.manifestOrdinal`.

## Sources & References

- **Origin document:** conversation — research into production-grade ordering (Figma, Linear, Jira, Airtable, Spotify, Notion)
- **Prior plan outline:** `docs/plans/2026-06-27-learning-track-ordering-refactor.md`
- **Institutional patterns:** `docs/plans/2026-06-26-001-feat-completion-target-learning-tracks-plan.md` (required-but-optional pattern), `docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md` (Lesson 4), `docs/engineering-patterns.md` (Dexie schema evolution section)
- **Related code:** `src/stores/useLearningPathStore.ts`, `src/lib/trackManifestImport.ts`, `src/data/types.ts`, `src/app/components/figma/InlineCoursePicker.tsx`
