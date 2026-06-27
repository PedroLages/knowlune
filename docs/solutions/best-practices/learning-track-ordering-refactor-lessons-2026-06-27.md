---
title: "Refactoring Learning Track Ordering: 4 Dexie Migration and Sync Patterns"
date: 2026-06-27
category: best-practices
module: learning-tracks, sync, data-model
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Adding new computed fields to a synced Dexie table with a load-side migration
  - Writing migration logic that computes default values from legacy data
  - Adding fields that can be populated from two different code paths
  - Implementing batch writes through the syncableWrite layer
  - Adding new columns to a Supabase-synced table
tags:
  - dexie-migration
  - syncable-write
  - manifest-ordering
  - table-registry
  - field-map
  - provenance
---

# Refactoring Learning Track Ordering: 4 Dexie Migration and Sync Patterns

## Context

PR #620 refactored Knowlune's learning track ordering model. The core change moved ordering-related fields off `ImportedCourse` (wrong scope -- order is a property of the track-course join, not the course) and replaced the per-entry `isManuallyOrdered` flag (wrong granularity -- mode belongs on the container, not individual entries) with `orderMode` on `LearningPath` and provenance fields (`manifestOrdinal`, `source`, `state`, `manifestCourseKey`) on `LearningPathEntry`.

The implementation surfaced four structural lessons about Dexie migration and sync patterns that apply broadly across the codebase. Each is documented below with specific code examples from the merged implementation.

## Lesson 1: Migration Persistence Gap

### Guidance

When `loadPaths()` (or any read-side migration) computes new default values from legacy data, those computed values must be persisted back to Dexie through `syncableWrite()`. Simply assigning them in Zustand state is not enough -- the values will be lost on page refresh and every load will recompute them.

**Correct pattern: compute, assign to Zustand, AND persist via syncableWrite.**

The migration in `useLearningPathStore.ts` uses an extracted `buildMigrationPatches()` function that inspects each path and entry, computes missing `orderMode`, `manifestOrdinal`, `source`, `state`, and `manifestCourseKey`, then returns patch objects. The store then:

1. Applies patches to Zustand state (immediate display)
2. Persists each patch via individual `syncableWrite` calls through `persistWithRetry`
3. Implements rollback on failure

**Before (would lose migration):**

```typescript
// Wrong: computed defaults in loadPaths, assigned to Zustand only
loadPaths: async () => {
  const paths = await db.learningPaths.toArray()
  const entries = await db.learningPathEntries.toArray()
  const migratedPaths = paths.map(path => {
    if (!path.orderMode) {
      path.orderMode = computeOrderMode(path)
    }
    return path
  })
  // Zustand updates fine, but no persistence to Dexie
  set({ paths: migratedPaths })
  // On next page load, orderMode is gone
}
```

**After (correct, from the actual implementation):**

```typescript
loadPaths: async () => {
  // ... read from Dexie ...
  const migrationResult = await buildMigrationPatches(rawPaths, rawEntries, sorted)
  if (migrationResult) {
    try {
      await persistWithRetry(async () => {
        // Persist entry patches first
        for (const { id, patch } of allEntryPatches) {
          const existing = await db.learningPathEntries.get(id)
          if (existing) {
            await syncableWrite('learningPathEntries', 'put', {
              ...existing,
              ...patch,
            } as unknown as SyncableRecord)
          }
        }
        // Then path patches
        for (const { id, patch } of allPathPatches) {
          const existing = await db.learningPaths.get(id)
          if (existing) {
            await syncableWrite('learningPaths', 'put', {
              ...existing,
              ...patch,
            } as unknown as SyncableRecord)
          }
        }
      })
    } catch (persistError) {
      // rollback Zustand, set migrationFailed flag
      set({ paths: preMigrationSnapshot.paths,
            entries: preMigrationSnapshot.entries,
            isLoaded: true,
            migrationFailed: true })
      toast.error(...)
    }
    // Re-read from Dexie to pick up persisted changes
    const migratedPaths = await db.learningPaths.toArray()
    const migratedEntries = await db.learningPathEntries.toArray()
    set({ paths: migratedPaths, entries: migratedEntries })
  }
}
```

**Sentinel guard pattern** -- use null checks to make migration idempotent:

```typescript
for (const path of rawPaths) {
  if (path.orderMode != null) continue  // already migrated, skip
  // ... compute patches ...
}

for (const entry of pathEntries) {
  if (entry.manifestOrdinal != null) {
    // Already has manifestOrdinal, skip
    continue
  }
}
```

### Why This Matters

Without the persist step, every app refresh triggers recomputation of the same migration values. More critically, if the migration logic ever changes, the load-side computation produces different results each time -- users would see different ordering depending on the order of page loads and code deploys. Writing through `syncableWrite` pins the values to Dexie so they survive restarts and only un-migrated rows are processed on subsequent loads.

The sentinel guard also enables the self-healing partial-write recovery pattern: if the app crashes mid-migration (some entries persisted, others not), the next `loadPaths()` skips already-migrated entries and processes only the un-migrated ones.

### When to Apply

- Any time `loadPaths()` or an equivalent data-loading function computes default values that should survive app restarts
- When adding optional fields (no schema migration) that derive from existing data and need to be "committed" once
- For any migration where the computation is expensive enough that running it every load would be wasteful

## Lesson 2: manifestCourseKey Format Inconsistency

### Guidance

When a field can be populated from two different code paths (a one-time migration path vs. a creation code path), define the value derivation in ONE shared utility function that both paths call. This prevents drift.

In this refactor, `manifestCourseKey` is the folder-level stable identifier used for future merge matching. But the migration path and the creation path derived it differently:

**Migration path** (in `buildMigrationPatches`, `useLearningPathStore.ts` lines 276-277 and 287):

```typescript
manifestCourseKey: entry.manifestCourseKey ?? course?.name?.trim().normalize('NFC') ?? null,
//                                                    ^^^^^^ -- uses course.name (display name)
```

**New creation path** (in `createPathFromManifest`, `useLearningPathStore.ts` line 1604):

```typescript
manifestCourseKey: course.folder.trim().normalize('NFC'),
//                              ^^^^^^ -- uses course.folder (folder/slug)
```

The migration path wrote `course.name` (the human-readable display name like "Introduction to TypeScript") while the new code paths wrote `course.folder` (the directory slug like "01-introduction-to-typescript"). These may or may not match depending on naming conventions in the manifest files.

**The fix**: Extract a single function that both paths call. This was done in `entryProvenance` utility in `learningPathUtils.ts`:

```typescript
function deriveManifestCourseKey(course: { folder: string; name?: string }): string {
  return course.folder.trim().normalize('NFC')  // standardize on folder
}
```

This inconsistency was not identified in the plan document -- it was surfaced by the review loop during `/review-story` round 2. Having both paths diverge silently would cause data integrity issues if a future re-import or merge flow relies on `manifestCourseKey` for matching.

### Why This Matters

Silent field inconsistency is the hardest class of bug to diagnose because the values look "right" in isolation but differ subtly between records. When a future merge feature tries to match entries from a re-import against existing entries, entries migrated via the legacy path would have `manifestCourseKey` set to `course.name` while newly imported entries would have it set to `course.folder` -- causing the match to fail for every legacy track. This would appear as duplicate entries or broken merge behavior with no obvious source.

### When to Apply

- When adding any field that can be populated both from a migration path and from a new code path
- When the value derivation involves any transformation (trimming, normalization, formatting)
- As a general rule: if two call sites compute the same field, extract a shared function

## Lesson 3: Non-Transactional Dexie Writes

### Guidance

Dexie 4 with the sync layer does not support transactional batch writes across different tables through `syncableWrite()`. Every write (whether `add`, `put`, or `delete`) is an individual call that goes through the sync queue. This means batch operations that span multiple entries or tables have a partial-failure window.

In this migration, the persist phase writes the `pathPatch` and each `entryPatch` via separate `syncableWrite` calls:

```typescript
// LearningPathStore buildMigrationPatches persistence
for (const { id, patch } of allEntryPatches) {
  const existing = await db.learningPathEntries.get(id)
  if (existing) {
    await syncableWrite('learningPathEntries', 'put',
      { ...existing, ...patch } as unknown as SyncableRecord)
  }
}
for (const { id, patch } of allPathPatches) {
  const existing = await db.learningPaths.get(id)
  if (existing) {
    await syncableWrite('learningPaths', 'put',
      { ...existing, ...patch } as unknown as SyncableRecord)
  }
}
```

The pattern that makes this safe:

1. **Migration is monotonic** -- it only adds fields, never removes or reorders. Partial writes leave some rows with `manifestOrdinal` and some without, but the data remains consistent and renderable.
2. **Sentinel guard** -- on next `loadPaths()`, the `manifestOrdinal != null` check skips already-migrated entries, and the migration recomputes only for un-migrated ones.
3. **Idempotent path mode** -- `orderMode` is recomputed from entry state each pass. A partial path write followed by re-migration produces the same `orderMode` as a complete single pass.

The `createPathFromManifest` method documents this explicitly:

```typescript
await persistWithRetry(async () => {
  // Note: uses 'put' (not 'add') for idempotency -- if the path was
  // partially persisted before a failure, the retry overwrites cleanly.
  await syncableWrite('learningPaths', 'put', path as unknown as SyncableRecord)
  for (const entry of pathEntries) {
    await syncableWrite('learningPathEntries', 'put', entry as unknown as SyncableRecord)
  }
})
```

And the error handler cleans up orphaned rows immediately:

```typescript
catch (error) {
  // Cleanup: delete any orphaned entries and path (F-044).
  // F-002: use per-step try/catch so entry cleanup failure
  // doesn't block path deletion.
  try {
    const orphanedEntries = await db.learningPathEntries
      .where('pathId').equals(pathId).toArray()
    for (const oe of orphanedEntries) {
      await syncableWrite('learningPathEntries', 'delete', oe.id)
    }
  } catch (cleanupError) {
    console.warn('[...] Failed to clean up orphaned manifest entries:', cleanupError)
  }
  try {
    const orphanedPath = await db.learningPaths.get(pathId)
    if (orphanedPath) {
      await syncableWrite('learningPaths', 'delete', pathId)
    }
  } catch (cleanupError) {
    console.warn('[...] Failed to clean up orphaned manifest path:', cleanupError)
  }
  // Fall through to Zustand rollback
}
```

### Why This Matters

Non-transactional batch writes through the sync layer are a design constraint of the architecture (the sync queue processes individual events, not bulk transactions). Attempting to force transactions causes silent failures. The correct approach is:

- Accept the constraint and design for self-healing
- Write cleanup code that removes orphaned rows
- Document at every batch write site that partial writes are self-healing and why
- Prioritize write order so a crash leaves the least confusing state (entries before paths)

In this migration, entries are written before paths so a crash leaves entries without `orderMode` (triggers re-migration) rather than paths with `orderMode` but entries without `manifestOrdinal` (inconsistent state).

### When to Apply

- Any batch operation that writes to multiple Dexie tables through the sync layer
- When implementing migration code that adds fields monotonically
- When writing new `create*` methods that involve multiple entries

## Lesson 4: fieldMap Must Match Supabase Column Names Exactly

### Guidance

The sync layer in `tableRegistry.ts` maps camelCase Dexie field names to snake_case Supabase column names through a `fieldMap` object. Every new field on a synced table needs a four-step checklist:

1. **Supabase SQL migration** (deploy first)
2. **fieldMap entry** in `tableRegistry.ts`
3. **Dexie schema version bump** (even if no index changes)
4. **TypeScript interface update**

The correct pattern for this refactor:

```typescript
// tableRegistry.ts (lines 485-498)
const learningPaths: TableRegistryEntry = {
  // ...
  fieldMap: {
    orderMode: 'order_mode',
    baseManifestHash: 'base_manifest_hash',
  },
}

const learningPathEntries: TableRegistryEntry = {
  // ...
  fieldMap: {
    manifestOrdinal: 'manifest_ordinal',
    manifestCourseKey: 'manifest_course_key',
    source: 'source',
    state: 'state',
  },
}
```

Note that `source` and `state` map to themselves (`source` -> `source`, `state` -> `state`) -- even identity mappings must be explicit. The registry does not auto-map fields with matching names.

The complete checklist:

```sql
-- 1. Supabase SQL migration (deploy before code)
ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS order_mode TEXT,
  ADD COLUMN IF NOT EXISTS base_manifest_hash TEXT;
ALTER TABLE learning_path_entries
  ADD COLUMN IF NOT EXISTS manifest_ordinal INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS manifest_course_key TEXT;
```

```typescript
// 2. tableRegistry.ts fieldMap (every new field must appear)
fieldMap: {
  orderMode: 'order_mode',
  baseManifestHash: 'base_manifest_hash',
}

// 3. Dexie schema version bump (src/db/schema.ts)
db.version(69).stores({})
// Documents new optional fields, no index changes needed

// 4. TypeScript interface update (src/data/types.ts)
export interface LearningPath {
  orderMode?: 'manifest' | 'custom'
  baseManifestHash?: string | null
}
```

### Why This Matters

Silent sync failures are invisible to the user locally (the field exists in Dexie and Zustand) but cause data loss at the Supabase level. When a user later syncs on another device, the missing column data is not there. The sync layer does not log a warning when a field is missing from `fieldMap` -- it simply omits it from the Supabase payload.

The "SQL migration before code" ordering is critical because Supabase rejects writes with unknown column names. If the code deploys before the SQL migration, every write to the table fails, breaking the entire table's sync (not just the new fields).

### When to Apply

- Every time a new field is added to a table listed in `tableRegistry.ts` -- even optional, nullable, or backfilled fields
- When troubleshooting missing-data issues in Supabase -- check `fieldMap` first
- When reviewing PRs that add model fields -- verify the checklist (SQL + fieldMap + Dexie + TypeScript) is complete
- When renaming fields -- both the Dexie field name and the `fieldMap` key must be updated

## Examples

### Reverse Checklist for Adding Fields

Before merging any PR that adds a field to a synced table:

```
[ ] SQL migration created in supabase/migrations/
[ ] SQL migration deployed to production BEFORE code deploy
[ ] fieldMap entry added in tableRegistry.ts (every field, even identity mappings)
[ ] Dexie schema version bumped (even for non-indexed fields with no index changes)
[ ] TypeScript interface updated
[ ] Shared utility extracted if field can come from multiple code paths
[ ] Migration persistence added if loadPaths backfills the field
[ ] Sentinel guard added for idempotent re-migration
[ ] Partial-write self-healing documented at batch write site
```

### Complete Migration Pattern (Combining All 4 Lessons)

```typescript
// 1. Define types with optional fields
interface LearningPath {
  orderMode?: 'manifest' | 'custom'
  // ...
}

// 2. SQL migration (deploy before code)
// ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS order_mode TEXT;

// 3. tableRegistry.ts fieldMap
// fieldMap: { orderMode: 'order_mode' }

// 4. Dexie schema version bump
// db.version(N).stores({})

// 5. Shared utility for value derivation (avoids Lesson 2 drift)
function deriveOrderMode(path: LearningPath, entries: LearningPathEntry[]): 'manifest' | 'custom' {
  const manifestEntries = entries.filter(e => e.manifestOrdinal != null)
  const inOrder = manifestEntries.every((e, i, a) =>
    i === 0 || e.manifestOrdinal! > a[i - 1].manifestOrdinal!)
  return inOrder && manifestEntries.length > 0 ? 'manifest' : 'custom'
}

// 6. Migration in loadPaths with persistence (addresses Lesson 1)
loadPaths: async () => {
  const paths = await db.learningPaths.toArray()
  const entries = await db.learningPathEntries.toArray()
  const patches = computeMigrationPatches(paths, entries)
  if (patches) {
    try {
      // Individual syncableWrite calls (Lesson 3)
      for (const { id, patch } of patches.entries) {
        await syncableWrite('learningPathEntries', 'put', { ...existing, ...patch })
      }
    } catch {
      // Rollback on failure
    }
  }
}
```

## Related

- Plan file: `docs/plans/2026-06-27-002-refactor-learning-track-ordering-model-plan.md`
- Prior plan outline: `docs/plans/2026-06-27-learning-track-ordering-refactor.md`
- PR #620 (merged to main)
- Curriculum composer lessons: `docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md` (Lesson 4: read `updatedAt` from Zustand, not Dexie)
- Learning track reorder lessons: `docs/solutions/best-practices/learning-track-detail-reorder-implementation-lessons-2026-05-14.md` (note: `isManuallyOrdered` write is now deprecated -- use `orderMode` instead)
- Paths as study plan: `docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md` (Lesson 3b: store mutation discipline)
- Single write path: `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`
- Compound-PK recordId: `docs/solutions/best-practices/compound-pk-recordid-synthesis-in-syncable-write-2026-04-19.md`
- Supabase migration invariants: `docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md`
- Engineering patterns: `docs/engineering-patterns.md` (Dexie schema evolution, Single Write Path sections)
- Completion-target plan: `docs/plans/2026-06-26-001-feat-completion-target-learning-tracks-plan.md` (required-but-optional pattern)
