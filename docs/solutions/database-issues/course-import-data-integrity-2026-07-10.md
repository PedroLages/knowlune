---
module: course-import
date: 2026-07-10
problem_type: database_issue
component: database
severity: high
symptoms:
  - "syncableWrite('videoCaptions') throws 'Unknown table' error — table not registered in sync tableRegistry"
  - "Primary key constraint violation on course re-import after incomplete delete when using add() instead of put()"
  - "DexieError: Missing index on .where('serverPath') query against unindexed importedCourses field"
  - "Catch blocks silently discard actual error messages, replacing with generic 'Failed to import'"
  - "Supabase sync fails with HTTP 400 because local Dexie columns are missing from remote imported_* tables"
root_cause: wrong_api
resolution_type: code_fix
tags:
  - course-import
  - syncable-write
  - dexie
  - supabase-sync
  - upsert-pattern
  - error-handling
  - captions
---

# Course Import Pipeline Data Integrity

## Problem

The server course import pipeline had five distinct failure modes that crashed imports or silently corrupted data: caption persistence used the wrong write API, re-imports threw primary-key violations, unindexed queries failed at runtime, error messages were swallowed, and Supabase sync failed due to schema drift between Dexie and the remote database.

## Symptoms

- Import crashes with `[syncableWrite] Unknown table: "videoCaptions"` for any course containing `.srt`/`.vtt` subtitle files (Linux Administration Bootcamp, 100 Days of Python, CKA with Practice Tests)
- Re-importing a course after an incomplete delete throws primary-key constraint violations on `importedCourses`/`importedVideos`/`importedPdfs`
- `DexieError: Missing index` when checking for existing courses via `.where('serverPath')` during scan dedup
- Bulk import shows generic `"Failed to import"` toast with zero diagnostic information — every failure looks identical
- Supabase sync returns HTTP 400 because `imported_courses`, `imported_videos`, and `imported_pdfs` tables are missing `server_id`, `server_path`, `source_drive_id`, `server_url`, and `module_title` columns

## What Didn't Work

1. **`syncableWrite('videoCaptions', ...)`**: `videoCaptions` is not registered in `src/lib/sync/tableRegistry.ts`, so `syncableWrite` throws an unknown-table error. The table stores locally-sourced caption files with no Supabase counterpart and was intentionally excluded from sync — but the import code didn't know that. (session history)

2. **`syncableWrite('importedCourses', 'add', ...)` on the first-import path**: Using `add` (insert) fails when orphaned child records from a prior incomplete delete still exist. Dexie's `add()` throws on duplicate keys; the re-import path in `syncableWrite` already used `put()` (upsert), but the first-import path was never updated to match. (session history)

3. **`.where('serverPath').equals(...).first()`**: `serverPath` was added to the Dexie schema but never indexed. `.where()` requires an index and throws `DexieError: Missing index` on unindexed fields. The natural alternative of creating the index was rejected because `serverPath` is rarely queried and the dataset is bounded (user's courses, typically < 100).

4. **Catch blocks using hardcoded strings**: Both `persistCourse` and `handleRetry` in `BulkImportDialog.tsx` used `catch { ... error: 'Failed to import' }`, discarding the actual `err.message`. Every import failure was indistinguishable, turning debugging into guesswork. (session history: discovered during investigation of repeated "Failed to import" errors on courses from `academy.pedrolages.net`)

5. **Missing Supabase columns**: The Supabase migration for `imported_*` tables was written before `server_id`, `server_path`, `source_drive_id`, `server_url`, and `module_title` were added to the Dexie schema. Column-level sync requires every local column to exist in the remote schema — missing columns cause HTTP 400 on every sync attempt for those tables.

## Solution

### Fix 1: Replace `syncableWrite` with direct `db.videoCaptions.put()` (f86040f3)

```typescript
// Before: crashed with unknown-table error
await syncableWrite('videoCaptions', 'add', {
  id: crypto.randomUUID(),
  videoId: caption.matchedVideoId,
  language: caption.language || 'en',
  content: caption.srtContent,
  source: 'file',
  createdAt: now,
  updatedAt: now,
} as unknown as SyncableRecord)

// After: direct Dexie put() with correct VideoCaptionRecord fields
await db.videoCaptions.put({
  courseId: course.id,
  videoId: persistedVideoId,
  filename: caption.filename,
  content: caption.srtContent,
  format: caption.format,
  createdAt: now,
})
```

Key changes:
- Uses `db.videoCaptions.put()` — bypasses sync entirely, which is correct since captions have no Supabase equivalent
- Records use compound PK fields (`courseId` + `videoId`) instead of a random UUID
- Added `filename` and `format` to `ScannedCaption` interface, populated during post-scan caption matching
- Built a `scannedToPersistedVideoId` map to translate scan-time video UUIDs to persisted video IDs (critical for re-import, where video IDs differ)

### Fix 2: Use `put()` (upsert) instead of `add()` on first-import path (d8869b00)

```typescript
// Before (first-import path) — throws ConstraintError on re-import
await syncableWrite('importedCourses', 'add', course as unknown as SyncableRecord)
await syncableWrite('importedVideos', 'add', video as unknown as SyncableRecord)
await syncableWrite('importedPdfs', 'add', pdf as unknown as SyncableRecord)

// After — idempotent upsert, safe for re-import
await syncableWrite('importedCourses', 'put', course as unknown as SyncableRecord)
await syncableWrite('importedVideos', 'put', video as unknown as SyncableRecord)
await syncableWrite('importedPdfs', 'put', pdf as unknown as SyncableRecord)
```

### Fix 3: Replace unindexed `.where()` with `toArray().find()` (1abc54b3)

```typescript
// Before: fails because serverPath is not indexed
existingCourse = await db.importedCourses
  .where('serverPath')
  .equals(scanned.serverPath)
  .first()

// After: safe for any field, bounded dataset makes performance acceptable
const allCourses = await db.importedCourses.toArray()
existingCourse = allCourses.find(c => c.serverPath === scanned.serverPath)
```

### Fix 4: Preserve actual error messages in catch blocks (63c7ebeb)

```typescript
// Before: hardcoded, diagnostic-dead
catch {
  updateItemInList(results, item.folderName, { status: 'error', error: 'Failed to import' }, setImportItems)
  progressStore.failCourse(item.folderName, 'Failed to import')
}

// After: preserves actual error
catch (err) {
  const message = err instanceof Error ? err.message : 'Failed to import'
  console.error('[BulkImport] persistCourse failed for', item.folderName, ':', err)
  updateItemInList(results, item.folderName, { status: 'error', error: message }, setImportItems)
  progressStore.failCourse(item.folderName, message)
}
```

Also updated the persist-level catch in `courseImport.ts`:
```typescript
// Before
const message = `Failed to save "${course.name}" to your library. Please try again.`

// After
const detail = error instanceof Error ? error.message : 'Unknown error'
const message = `Failed to save "${course.name}": ${detail}`
```

### Fix 5: Add missing server import columns to Supabase (1cdff9aa)

```sql
ALTER TABLE public.imported_courses ADD COLUMN IF NOT EXISTS server_id TEXT;
ALTER TABLE public.imported_courses ADD COLUMN IF NOT EXISTS server_path TEXT;
ALTER TABLE public.imported_courses ADD COLUMN IF NOT EXISTS source_drive_id TEXT;
ALTER TABLE public.imported_videos ADD COLUMN IF NOT EXISTS server_url TEXT;
ALTER TABLE public.imported_videos ADD COLUMN IF NOT EXISTS module_title TEXT;
ALTER TABLE public.imported_pdfs ADD COLUMN IF NOT EXISTS server_url TEXT;
ALTER TABLE public.imported_pdfs ADD COLUMN IF NOT EXISTS module_title TEXT;
```

## Why This Works

- **Fix 1**: `videoCaptions` is inherently local-only (sourced from `.srt`/`.vtt` files, no Supabase equivalent). Direct Dexie `put()` bypasses the sync layer — simpler and correct. The compound PK (`courseId` + `videoId`) provides idempotent re-import via upsert semantics. The `scannedToPersistedVideoId` map bridges the gap between scan-time ephemeral UUIDs and persisted record IDs that differ during re-import.

- **Fix 2**: Dexie's `put()` is an upsert — it replaces a record if its primary key already exists. This handles the edge case where orphaned child records from a prior incomplete delete still exist when a new course is imported. `put()` silently overwrites them rather than throwing.

- **Fix 3**: `toArray()` + `.find()` works on any field regardless of index status. The performance cost is negligible since the filtered dataset is bounded (user's courses, typically < 100). Adding an index for a rarely-queried field adds IndexedDB overhead with no meaningful benefit.

- **Fix 4**: The actual `Error.message` is the only way to diagnose import failures. Hardcoded strings make every failure indistinguishable, turning debugging into guesswork. `console.error` adds a second diagnostic channel that survives toast dismissal.

- **Fix 5**: Supabase column-level sync requires every column written by the local app to exist in the remote schema. Missing columns cause HTTP 400 on every sync attempt for those tables. `ADD COLUMN IF NOT EXISTS` is idempotent and safe to run on already-migrated databases.

## Prevention

- When adding a new non-indexed Dexie field that will be queried, either add the index or use `.toArray().filter()` with a code comment explaining why no index is needed
- Write a unit test that asserts `videoCaptions` operations never go through `syncableWrite` — the table is intentionally excluded from the sync registry
- Extend the existing `error-handling/no-silent-catch` ESLint rule to flag hardcoded error strings in catch blocks (not just missing `toast.error()` calls)
- Add a CI check or lint rule that compares Dexie schema fields against Supabase migration columns on PRs that touch either the Dexie schema or Supabase migrations

## Related

- [[single-write-path-for-synced-mutations-2026-04-18]] — foundational `syncableWrite` pattern; this doc describes when to deviate from it
- [[supabase-migration-schema-invariants-2026-04-18]] — migration invariants for Dexie-synced tables (RLS policies, upsert functions, field name mapping)
- [[compound-pk-recordid-synthesis-in-syncable-write-2026-04-19]] — how `syncableWrite` handles compound-PK tables
- [[implementation-lessons-url-batch-import-2026-06-28]] — URL-based batch import integration with existing local file scanning pipeline
- [[implementation-lessons-deferred-issues-hardening-2026-06-28]] — deferred-issues hardening sprint covering Dexie TOCTOU race handling and concurrency guards
