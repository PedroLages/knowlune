---
title: "feat: Wire chapterMappings through sync engine (E94-S06)"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e94-s06-chapter-mappings-sync-requirements.md
---

# feat: Wire chapterMappings through sync engine (E94-S06)

## Overview

EPUB↔audiobook chapter alignment data (`chapterMappings`) is currently stored only in Dexie locally. Users who set up chapter mappings on one device must redo the work on every other device. This plan wires `chapterMappings` through the existing E92 sync engine so that chapter position data uploads to Supabase and downloads on new devices automatically.

The work involves four concerns: (1) a Supabase migration creating the `chapter_mappings` table with a composite PK, (2) fixing a latent `fieldMap` gap in the existing registry entry, (3) extending the upload engine to support non-`id` upsert conflict columns for compound-PK LWW tables, (4) wiring the store through `syncableWrite` using soft-delete instead of hard-delete.

## Problem Frame

`chapter_mappings` has a composite primary key `(epub_book_id, audio_book_id, user_id)` — there is no `id` column. The sync upload engine (`_uploadBatch` in `syncEngine.ts`) currently calls `.upsert(payloads, { onConflict: 'id' })` for all LWW and conflict-copy tables. This will fail on `chapter_mappings` at runtime because Postgres cannot find an `id` column for conflict resolution. This is the primary non-trivial engine change this story requires. (See origin: `docs/brainstorms/2026-04-19-e94-s06-chapter-mappings-sync-requirements.md` § Key decisions.)

Additionally, the existing `chapterMappings` registry entry has `fieldMap: {}` — an empty map. The auto-conversion in `toSnakeCase()` correctly converts `epubBookId → epub_book_id` and `audioBookId → audio_book_id` via the camelCase→snake_case regex, so no upload bugs exist today. However, the explicit `fieldMap` entries are added for documentation of intent and future-proofing: if a column is renamed or a field is added, the explicit map makes the intended mapping auditable rather than implicit.

## Requirements Trace

- R1. Supabase migration creates `chapter_mappings` table with composite PK, RLS, moddatetime trigger, and download cursor index (AC1, AC2, AC7)
- R2. `tableRegistry.ts` `chapterMappings` entry has correct `fieldMap` and `upsertConflictColumns` override (AC4, AC7)
- R3. Upload engine respects `upsertConflictColumns` when present on a table entry (engine gap fix)
- R4. `useChapterMappingStore.saveMapping` and `deleteMapping` route through `syncableWrite` (AC5, AC6)
- R5. Soft-delete: `deleteMapping` puts `{ deleted: true }` via `syncableWrite`; `loadMappings` filters deleted records (AC6, AC12)
- R6. Download apply phase removes Dexie records where downloaded `deleted: true` (AC7)
- R7. `ChapterMappingRecord` type gains `userId?` and `deleted?` fields (AC3)
- R8. Unit tests cover compound-PK recordId synthesis and soft-delete path (AC11)
- R9. TypeScript compiles clean (AC14)
- R10. `tableRegistry.test.ts` count updated if needed (AC13 adjacent)

## Scope Boundaries

- No changes to the chapter alignment algorithm or `ChapterMappingEditor.tsx` UI
- `ChapterMapping` sub-entries sync as an opaque JSONB blob — no per-entry granularity
- No `id` UUID column added to `chapter_mappings` table (composite PK is intentional by design)
- No multi-device conflict merge beyond LWW — manual overrides win if they are newer
- `upsertConflictColumns` field added to `TableRegistryEntry` is used only by compound-PK tables; all existing tables are unaffected (their entries do not set this field, so `onConflict: 'id'` remains the default)

### Deferred to Separate Tasks

- E2E integration test (`tests/sync/p2-chapter-mappings-sync.spec.ts`): only unit tests are in scope per AC11; integration spec belongs in the E94 closeout sprint
- Supabase-side `computed_at` index: not needed for LWW correctness; deferred unless profiling shows a query gap

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncEngine.ts` — `_uploadBatch` (LWW path, line ~482): uses `.upsert(payloads, { onConflict: 'id' })`. Needs to read `tableEntry.upsertConflictColumns` when set.
- `src/lib/sync/syncEngine.ts` — `_getLocalRecord` (line ~529): already handles compound-PK via `where(compoundPkFields).equals(keyValues)`. **Download side is correct — no change needed here.**
- `src/lib/sync/syncEngine.ts` — `_doDownload` loop (line ~838): per-record apply calls `_applyRecord`. For soft-deleted records (`deleted: true`), the LWW path currently calls `table.put(record)` — this would re-insert a logically-deleted mapping. A `deleted` guard is needed in `_applyRecord` for this pattern.
- `src/lib/sync/tableRegistry.ts` — `chapterMappings` entry (line ~410): `fieldMap: {}` must be populated; `compoundPkFields` already correct.
- `src/lib/sync/fieldMapper.ts` — `toSnakeCase` / `toCamelCase`: explicit `fieldMap` entries override auto-conversion. Fields not in the map fall back to automatic camelCase→snake_case. `epubBookId` auto-converts to `epub_book_id` — the bug is that currently NO entries are in `fieldMap`, so the auto-conversion would apply; but `computedAt → computed_at` and `deleted → deleted` also need explicit entries for clarity and cross-check against Supabase schema.
- `src/stores/useChapterMappingStore.ts` — `saveMapping` / `deleteMapping` / `loadMappings`: the three mutations to update.
- `src/data/types.ts` — `ChapterMappingRecord` (line ~1037): add `userId?` and `deleted?`.
- `src/db/schema.ts` — `chapterMappings` table (line ~142): compound index `[epubBookId+audioBookId]` already defined. No index change needed for `deleted` (optional boolean, no new query pattern).
- `src/lib/sync/__tests__/syncableWrite.test.ts` — existing unit tests; add compound-PK group here.
- `src/lib/sync/__tests__/tableRegistry.test.ts` — `has exactly 38 entries` assertion and `p2Tables` array reference `chapterMappings`.

### Institutional Learnings

- **Monotonic reset pattern**: Progress fields should only go up — use `Math.max()` in apply, not plain LWW. (Not applicable here — chapter mappings use plain LWW.)
- **PK reuse pattern**: When a Supabase table lacks a standalone `id` column, the `onConflict` clause must list all composite PK columns. Discovered during E92-S01 (monotonic RPCs) — similar discipline applies to generic upserts.
- **Append-only cursor pattern**: Download cursor uses `updated_at` (default); only override with `cursorField` for tables without `updated_at`. `chapter_mappings` has `updated_at` via moddatetime trigger — no override needed.
- **Soft-delete pattern** (E93-S02): `deleteNote()` calls `syncableWrite('notes', 'put', { ...note, deleted: true })` rather than a Dexie `delete()`. Same pattern applies here because `syncableWrite` does not support compound-PK deletes.

### External References

- None needed — local patterns are direct and sufficient.

## Key Technical Decisions

- **`upsertConflictColumns?: string` on `TableRegistryEntry`**: Adds a new optional field to the registry entry interface. When set, `_uploadBatch` uses this value as the `onConflict` parameter instead of `'id'`. For `chapterMappings` the value is `'epub_book_id,audio_book_id,user_id'`. All other tables omit this field and continue to use `onConflict: 'id'`. This is the minimally invasive fix — no per-table special-casing in the engine, just a declarative override.

- **Soft-delete in `_applyRecord`**: When a downloaded record has `deleted: true`, `_applyRecord` should delete the Dexie record instead of calling `table.put()`. The guard is table-agnostic (any table with a `deleted` field) so it naturally extends to future soft-delete tables without engine changes. Guard: only act on `deleted: true` — absence of the field is falsy and treated as normal apply.

- **`deleted: 'deleted'` in `fieldMap`**: Explicit entry prevents accidental auto-conversion issues and documents the intent. The Supabase column is also `deleted` (no rename needed), but the explicit entry is the canonical source of truth.

- **No `id` column on `chapter_mappings`**: Consistent with the Dexie compound key `[epubBookId+audioBookId]`. Adding a synthetic UUID `id` would add upload engine complexity for no benefit. The composite PK correctly models the domain constraint (one mapping per EPUB+audio pair per user).

- **`computedAt` included in fieldMap**: `computedAt` auto-converts to `computed_at` which is correct, but an explicit entry is added for visibility and to prevent future renames from silently breaking upload. The Supabase column must be `computed_at`.

## Open Questions

### Resolved During Planning

- **Does download apply need a `deleted` guard for LWW tables generally?** Yes — any LWW table using soft-delete must guard against `table.put(softDeletedRecord)` in `_applyRecord`. The guard is a two-line check before the strategy switch — safe to add generally. Currently only `notes` uses soft-delete (field: `deleted`, mapped to `soft_deleted`) but `notes` uses `conflict-copy` strategy, not `lww`. `chapterMappings` would be the first LWW table with soft-delete. The guard must specifically handle the `deleted` field name (not `soft_deleted`) since `chapterMappings` uses `deleted` directly.

- **Can `fieldMap: {}` (empty) cause bugs today?** Analysis confirms: `toSnakeCase` auto-converts camelCase fields correctly in the absence of explicit `fieldMap` entries (e.g., `epubBookId → epub_book_id` via the regex). The empty map causes no bugs for upload/download direction. However, the explicit entries are added for clarity and future-proofing.

- **Does `toCamelCase` round-trip `computed_at → computedAt` without an explicit entry?** Yes — `snakeToCamel('computed_at')` produces `computedAt`. The auto-conversion is correct. The explicit `fieldMap` entry is belt-and-suspenders.

### Deferred to Implementation

- Whether Dexie version needs incrementing: adding `userId?` and `deleted?` as optional fields to `ChapterMappingRecord` does not add new indexes to the Dexie `chapterMappings` table, so a version bump is not strictly required. Confirm during implementation by checking the `schema.ts` upgrade callback pattern. If unsure, a version bump is always safe.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Upload path (new `upsertConflictColumns` field):**
```
syncableWrite('chapterMappings', 'put', record)
  → recordId = 'epubId\u001faudioId'       [compound synthesis, already works]
  → toSnakeCase(entry, record)              [fieldMap now populated]
  → syncQueue.add({tableName, recordId, payload})
  → syncEngine.nudge()
  → _uploadBatch:
      entry.upsertConflictColumns?          [NEW field check]
        → supabase.upsert(payloads, { onConflict: 'epub_book_id,audio_book_id,user_id' })
        → [else] supabase.upsert(payloads, { onConflict: 'id' })   [existing default]
```

**Download path (soft-delete guard):**
```
_doDownload → _applyRecord(entry, camelRecord):
  if (camelRecord.deleted === true):       [NEW guard, before strategy switch]
    table.delete([epubBookId, audioBookId])  [compound key array]
    return
  switch(entry.conflictStrategy):
    case 'lww': _applyLww(...)             [existing path]
```

**Soft-delete in store:**
```
deleteMapping(epubId, audioId):
  existing = get().mappings.find(...)
  if (!existing) return
  syncableWrite('chapterMappings', 'put', { ...existing, deleted: true })
  set(state => { mappings: state.mappings.filter(m => !(m.epubBookId === epubId && m.audioBookId === audioId)) })
```

## Implementation Units

- [ ] **Unit 1: Supabase migration — `chapter_mappings` table**

**Goal:** Create the `chapter_mappings` Postgres table with composite PK, `deleted` column, RLS, moddatetime trigger, download cursor index, and idempotent rollback script.

**Requirements:** R1

**Dependencies:** E94-S01 migration already shipped (books table exists); moddatetime extension installed by P0 migration.

**Files:**
- Create: `supabase/migrations/20260420000001_chapter_mappings.sql`
- Create: `supabase/migrations/rollback/20260420000001_chapter_mappings_rollback.sql`

**Approach:**
- Table schema: `epub_book_id UUID NOT NULL`, `audio_book_id UUID NOT NULL`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `mappings JSONB NOT NULL DEFAULT '[]'`, `deleted BOOLEAN NOT NULL DEFAULT FALSE`, `computed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`; PRIMARY KEY `(epub_book_id, audio_book_id, user_id)`
- RLS: single `FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` policy
- Trigger: `chapter_mappings_set_updated_at BEFORE UPDATE` using `extensions.moddatetime('updated_at')` — follows E94-S01/S03 trigger naming convention
- Download cursor index: `idx_chapter_mappings_user_updated ON public.chapter_mappings (user_id, updated_at)`
- All statements use `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, `DROP TRIGGER IF EXISTS` for idempotency
- Wrap in `BEGIN; ... COMMIT;`
- Rollback script: `DROP TABLE IF EXISTS public.chapter_mappings CASCADE;`

**Patterns to follow:**
- `supabase/migrations/20260413000004_p2_book_organization.sql` — trigger naming, RLS pattern, idempotency guards
- `supabase/migrations/20260413000003_p2_library.sql` — header comment structure, cursor index naming

**Test scenarios:**
- Test expectation: none — migration correctness is verified by the store wiring tests which write to Dexie and queue to syncQueue; Supabase schema is tested manually via `supabase db push` in dev

**Verification:**
- Migration file exists at the stated path
- Rollback script exists
- `BEGIN; ... COMMIT;` wrapper present
- All `IF NOT EXISTS` guards in place (re-run does not error)
- `deleted BOOLEAN NOT NULL DEFAULT FALSE` column present

---

- [ ] **Unit 2: Type updates + `tableRegistry.ts` fix**

**Goal:** Add `userId?` and `deleted?` to `ChapterMappingRecord`; add `upsertConflictColumns?: string` to `TableRegistryEntry`; populate the `chapterMappings` registry entry with correct `fieldMap` and the new `upsertConflictColumns`.

**Requirements:** R2, R7, R9, R10

**Dependencies:** None (pure TypeScript, no runtime dependencies)

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/lib/sync/tableRegistry.ts`
- Modify: `src/lib/sync/__tests__/tableRegistry.test.ts` (update count if needed)

**Approach:**
- In `src/data/types.ts`, `ChapterMappingRecord` interface: add `userId?: string | null` (after `audioBookId`) and `deleted?: boolean` (after `updatedAt`)
- In `src/lib/sync/tableRegistry.ts`, `TableRegistryEntry` interface: add `upsertConflictColumns?: string` with JSDoc: "Override the columns used in the Supabase upsert `onConflict` clause. Defaults to `'id'` when absent. Use for tables whose PK spans multiple columns and does not include a standalone `id` column."
- Update the `chapterMappings` const:
  ```
  fieldMap: {
    epubBookId: 'epub_book_id',
    audioBookId: 'audio_book_id',
    computedAt: 'computed_at',
    deleted: 'deleted',
  },
  compoundPkFields: ['epubBookId', 'audioBookId'],  // already present
  upsertConflictColumns: 'epub_book_id,audio_book_id,user_id',
  ```
- `tableRegistry.test.ts`: the count assertion currently reads `38` — `chapterMappings` is already in the registry, so no count change. Verify the `p2Tables` array already includes `'chapterMappings'` (it does per the test file).

**Patterns to follow:**
- `TableRegistryEntry.cursorField?: string` (same optional-override pattern introduced in E92-S07)
- `notes` entry `fieldMap` for explicit mapping examples

**Test scenarios:**
- Happy path: `toSnakeCase(chapterMappingsEntry, { epubBookId: 'a', audioBookId: 'b', mappings: [], computedAt: '...', updatedAt: '...', userId: 'u', deleted: false })` → all keys are snake_case, values unchanged
- Round-trip: `toCamelCase(chapterMappingsEntry, toSnakeCase(chapterMappingsEntry, record))` → identical to original (round-trip fidelity)
- `upsertConflictColumns` field present on `chapterMappings` entry and equals `'epub_book_id,audio_book_id,user_id'`

**Verification:**
- `npx tsc --noEmit` passes
- `chapterMappings` entry has `fieldMap` with 4 entries, `compoundPkFields` with 2 entries, and `upsertConflictColumns` set

---

- [ ] **Unit 3: Upload engine — `upsertConflictColumns` support**

**Goal:** Extend `_uploadBatch` in `syncEngine.ts` to use `tableEntry.upsertConflictColumns` when present, instead of hardcoded `onConflict: 'id'`.

**Requirements:** R3

**Dependencies:** Unit 2 (TypeScript type for `upsertConflictColumns`)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Modify: `src/lib/sync/__tests__/syncEngine.test.ts` (add compound-PK upsert scenario)

**Approach:**
- In `_uploadBatch`, the LWW / conflict-copy upsert block (line ~482) currently uses `{ onConflict: 'id' }`. Replace with:
  ```
  const conflictCol = tableEntry.upsertConflictColumns ?? 'id'
  supabase.from(tableEntry.supabaseTable).upsert(payloads, { onConflict: conflictCol })
  ```
- Apply the same pattern to the retry callback inside the same block
- The `monotonic` RPC path and `insert-only` path are unaffected — they do not use `onConflict: 'id'`
- No changes needed to `_getLocalRecord`, `_applyRecord`, or the download phase — these already handle compound-PK tables correctly via `compoundPkFields`

**Patterns to follow:**
- `tableEntry.cursorField ?? 'updated_at'` fallback pattern (line ~758 in syncEngine.ts) — same `?? default` idiom

**Test scenarios:**
- Happy path: `_uploadBatch` called with `tableEntry = { supabaseTable: 'chapter_mappings', upsertConflictColumns: 'epub_book_id,audio_book_id,user_id', conflictStrategy: 'lww', ... }` → Supabase `upsert` called with `{ onConflict: 'epub_book_id,audio_book_id,user_id' }`
- Regression: existing table without `upsertConflictColumns` (e.g., `notes`) → Supabase `upsert` still called with `{ onConflict: 'id' }`

**Verification:**
- `npx tsc --noEmit` passes
- Existing `syncEngine.test.ts` passes without regression

---

- [ ] **Unit 4: Download apply — soft-delete guard**

**Goal:** Extend `_applyRecord` to detect downloaded records with `deleted: true` and remove them from Dexie instead of applying them as live records.

**Requirements:** R6

**Dependencies:** Unit 2 (type update), Unit 3 (engine familiarity)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Modify: `src/lib/sync/__tests__/syncEngine.download.test.ts` (add soft-delete scenario)

**Approach:**
- In `_applyRecord`, before the `switch(entry.conflictStrategy)` block, add:
  ```
  if (record['deleted'] === true) {
    const table = (db as ...)[entry.dexieTable]
    if (!table) { console.error(...); return }
    if (entry.compoundPkFields && entry.compoundPkFields.length > 0) {
      const keyValues = entry.compoundPkFields.map((f) => record[f])
      await (table as ...).where(entry.compoundPkFields).equals(keyValues).delete()
    } else {
      await table.delete(record['id'] as string)
    }
    return
  }
  ```
- This guard is table-agnostic: any future LWW table with `deleted: boolean` gets the correct behavior. For `notes` (uses `conflict-copy` strategy with `soft_deleted` field — not `deleted`), the guard does not fire because `record['deleted']` is `undefined`, not `true`. Existing behavior is preserved.
- Intentional: `soft_deleted` (notes) vs `deleted` (chapterMappings) — they are different field names by design (notes mapped `deleted → soft_deleted` in upload; chapter_mappings uses `deleted` directly). The guard only checks `record['deleted']` which is the post-`toCamelCase` field name.

**Patterns to follow:**
- `_getLocalRecord` compound-PK lookup pattern (line ~529) for the Dexie delete path
- Existing per-record error isolation pattern in `_doDownload` (try/catch continues on next record)

**Test scenarios:**
- Soft-delete apply: `_applyRecord(chapterMappingsEntry, { epubBookId: 'a', audioBookId: 'b', deleted: true, ... })` → Dexie `where(['epubBookId','audioBookId']).equals(['a','b']).delete()` called, NOT `table.put()`
- Normal apply (not deleted): `_applyRecord(chapterMappingsEntry, { epubBookId: 'a', audioBookId: 'b', deleted: false, mappings: [...], ... })` → `_applyLww` called normally
- No regression: `_applyRecord(notesEntry, { id: 'n1', soft_deleted: true, ... })` → `record['deleted']` is `undefined` → guard does not fire → `_applyConflictCopy` called as before

**Verification:**
- `npx tsc --noEmit` passes
- `syncEngine.download.test.ts` new scenarios pass
- Existing download tests pass without regression

---

- [ ] **Unit 5: Store wiring + unit tests**

**Goal:** Wire `saveMapping`, `deleteMapping`, and `loadMappings` through `syncableWrite`; add unit tests for the compound-PK sync path.

**Requirements:** R4, R5, R8, R9

**Dependencies:** Units 2, 3, 4 (types, engine, store at implementation time)

**Files:**
- Modify: `src/stores/useChapterMappingStore.ts`
- Modify: `src/lib/sync/__tests__/syncableWrite.test.ts` (add compound-PK group)
- Create: `src/lib/sync/__tests__/p2-chapter-mappings-sync.test.ts`

**Approach:**

**`saveMapping`**: Replace `await db.chapterMappings.put(fullRecord)` with `await syncableWrite('chapterMappings', 'put', fullRecord)`. Remove any direct `db` import references that become unused. The `syncableWrite` call stamps `userId` and `updatedAt` automatically — do not set these in the store.

**`deleteMapping`**: Replace `await db.chapterMappings.delete([epubBookId, audioBookId])` with soft-delete:
```
const existing = get().mappings.find(m => m.epubBookId === epubBookId && m.audioBookId === audioBookId)
if (!existing) return
await syncableWrite('chapterMappings', 'put', { ...existing, deleted: true })
```
The Zustand filter (`state.mappings.filter(...)`) remains — the in-memory state removes the record immediately, consistent with optimistic UI pattern used across all other stores.

**`loadMappings`**: Add filter after `toArray()`:
```
const all = await db.chapterMappings.toArray()
const mappings = all.filter(m => !m.deleted)
set({ mappings, isLoaded: true })
```
This ensures soft-deleted records (written locally pending sync, or downloaded and marked for deletion) do not surface in the UI.

**Error handling**: `saveMapping` and `deleteMapping` already have `try/catch` blocks with `toast.error()` — leave them intact. `syncableWrite` throws on Dexie write failure (fatal) which is caught there.

**Patterns to follow:**
- `src/stores/useBookReviewStore.ts` — `setRating` sync wiring pattern (E94-S03)
- `src/stores/useNoteStore.ts` — `deleteNote` soft-delete pattern (E93-S02)

**Test scenarios for `syncableWrite.test.ts` compound-PK group:**
- `saveMapping` path: `syncableWrite('chapterMappings', 'put', { epubBookId: 'epub-1', audioBookId: 'audio-1', mappings: [], computedAt: '2026-01-01T00:00:00.000Z', updatedAt: '' })` → `db.table().put` called with `userId` stamped; `db.syncQueue.add` called with `recordId: 'epub-1\u001faudio-1'`, `operation: 'put'`, `tableName: 'chapterMappings'`
- Soft-delete path: same call with `deleted: true` → `db.table().put` called (not delete); queue entry has `operation: 'put'` and `payload.deleted === true`
- Unauthenticated: no queue entry created; Dexie write still happens

**Test scenarios for `p2-chapter-mappings-sync.test.ts` (integration):**
- `saveMapping('epub-a', 'audio-b', { mappings: [{epubChapterHref:'c01.xhtml', audioChapterIndex: 0, confidence: 1.0}], computedAt: '...' })` → Dexie record has `userId` stamped; syncQueue has entry with `recordId` containing unit separator; payload includes `epub_book_id` and `audio_book_id` (snake_case from fieldMap)
- `deleteMapping('epub-a', 'audio-b')` → syncQueue has a `put` entry with `payload.deleted === true`; `loadMappings()` does not return the deleted record
- Unauthenticated save: Dexie record created; syncQueue empty

**Verification:**
- `npm run test:unit -- syncableWrite` passes
- `npm run test:unit -- p2-chapter-mappings-sync` passes
- `npm run test:unit` overall passes
- `npx tsc --noEmit` passes

---

- [ ] **Unit 6: Final verification sweep**

**Goal:** Confirm build, lint, types, and all unit tests pass end-to-end.

**Requirements:** R9, all ACs

**Dependencies:** All prior units

**Files:** None created — verification only

**Approach:**
- `npm run build` — clean build, no bundle regression
- `npm run lint` — zero new ESLint warnings (design-tokens rule, no-silent-catch)
- `npx tsc --noEmit` — zero type errors
- `npm run test:unit` — all unit tests pass

**Test scenarios:**
- Test expectation: none — this unit is a gate, not a behavioral change

**Verification:**
- All commands exit 0
- `tableRegistry.test.ts` still passes with correct `38` count
- No direct `db.chapterMappings.put` or `db.chapterMappings.delete` calls remain in `useChapterMappingStore.ts` outside `loadMappings`

## System-Wide Impact

- **Interaction graph**: `useChapterMappingStore.saveMapping` → `syncableWrite` → `syncQueue` → `_doUpload` → Supabase `chapter_mappings` table. `_doDownload` → `_applyRecord` with new soft-delete guard. The only stores in the interaction graph are `useChapterMappingStore` and (indirectly) `useAuthStore` for userId stamping.
- **Error propagation**: `syncableWrite` fatal on Dexie write failure → surfaces via existing `toast.error()` in the store's catch block. Queue insert failure is non-fatal (logged, not surfaced). Upload engine errors are batched and retried per the existing `_handleBatchError` path.
- **State lifecycle risks**: The soft-delete pattern requires `loadMappings` to filter `deleted: true` records — failure to do so would show ghost entries. The filter is a simple array filter on the in-memory result, low risk.
- **API surface parity**: `ChapterMappingEditor.tsx` reads from `useChapterMappingStore.mappings` and calls `saveMapping` / `deleteMapping`. Both actions continue to work identically — no UI-facing API change. The only observable behavior difference is that deletions now persist across devices.
- **Integration coverage**: The upload engine change (`upsertConflictColumns`) affects only `chapterMappings` in this story. All other tables continue using `onConflict: 'id'` via the `?? 'id'` fallback. The regression risk is minimal — the change touches a single conditional in `_uploadBatch`.
- **Unchanged invariants**: `toCamelCase` / `toSnakeCase` behavior for all other tables is unchanged. The `_getLocalRecord` compound-PK lookup already works — download direction needs only the soft-delete guard addition.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Upload engine `onConflict` change introduces regression for existing tables | `?? 'id'` fallback preserves current behavior; unit test verifies `notes` table still uses `onConflict: 'id'` |
| Soft-delete guard in `_applyRecord` fires unexpectedly on `notes` (which uses `soft_deleted`, not `deleted`) | Guard checks `record['deleted'] === true`; `notes` records have no `deleted` field in their camelCase form — the field is mapped `deleted → soft_deleted` on upload, so the downloaded `camelRecord` would have `softDeleted`, not `deleted` — guard never fires |
| `computed_at` column not in migration causes upload rejection | Explicitly included in migration DDL; `fieldMap` entry ensures it is included in upload payload |
| Dexie compound-key delete in download soft-delete guard uses wrong key array | The `.where(compoundPkFields).equals(keyValues)` pattern is proven by `_getLocalRecord` (same pattern); uses the same key shape |
| `tableRegistry.test.ts` count assertion fails | Count remains 38 (`chapterMappings` was already registered); test updated only if count changes |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e94-s06-chapter-mappings-sync-requirements.md](docs/brainstorms/2026-04-19-e94-s06-chapter-mappings-sync-requirements.md)
- Related code: `src/lib/sync/syncEngine.ts` (upload line ~482, download line ~670)
- Related code: `src/lib/sync/tableRegistry.ts` (chapterMappings entry line ~410)
- Related code: `src/stores/useChapterMappingStore.ts`
- Related code: `src/lib/sync/__tests__/p2-book-organization-sync.test.ts` (pattern for P2 sync test)
- Related code: `src/stores/useNoteStore.ts` (soft-delete pattern reference, E93-S02)
- Prior migrations: `supabase/migrations/20260413000004_p2_book_organization.sql`
- Epic spec: [docs/planning-artifacts/epics-supabase-data-sync.md](docs/planning-artifacts/epics-supabase-data-sync.md) (E94-S06 section)
