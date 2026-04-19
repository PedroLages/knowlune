---
story_id: E94-S06
story_name: "Chapter Mappings Sync"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 94.06: Chapter Mappings Sync

## Story

As a learner who reads EPUB books while listening to the matching audiobook,
I want my EPUB↔audiobook chapter alignment data to sync automatically across devices,
so that synchronized reading+listening mode works seamlessly on any device I sign in to.

## Acceptance Criteria

**AC1 — Supabase migration creates `chapter_mappings` table:**
Migration file at `supabase/migrations/20260420000001_chapter_mappings.sql` creates:
- `chapter_mappings` — `epub_book_id UUID NOT NULL, audio_book_id UUID NOT NULL, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, mappings JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- PRIMARY KEY `(epub_book_id, audio_book_id, user_id)` (composite; no separate `id` column)
- Single RLS policy: `FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- `BEFORE UPDATE` trigger using `extensions.moddatetime('updated_at')` named `chapter_mappings_set_updated_at`
- Download cursor index: `CREATE INDEX IF NOT EXISTS idx_chapter_mappings_user_updated ON public.chapter_mappings (user_id, updated_at)`
- Migration wrapped in `BEGIN; ... COMMIT;`, uses `IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` throughout for idempotency

**AC2 — Rollback script exists:**
`supabase/migrations/rollback/20260420000001_chapter_mappings_rollback.sql` drops the table with CASCADE.

**AC3 — `ChapterMappingRecord` type gets `userId` field:**
In `src/data/types.ts`, add `userId?: string | null` to `ChapterMappingRecord` interface (between `audioBookId` and `mappings`). This field is stamped by `syncableWrite` and must not be set by callers. The field is optional (`?`) for backward compatibility with existing local records that were saved before E94-S06.

**AC4 — `tableRegistry.ts` entry for `chapterMappings` is complete:**
The existing `chapterMappings` entry in `src/lib/sync/tableRegistry.ts` currently has `fieldMap: {}` and no `userId`-related configuration. Update it to:
```ts
const chapterMappings: TableRegistryEntry = {
  dexieTable: 'chapterMappings',
  supabaseTable: 'chapter_mappings',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {
    epubBookId: 'epub_book_id',
    audioBookId: 'audio_book_id',
    computedAt: 'computed_at',
    // mappings, userId, updatedAt, createdAt — handled by syncEngine standard fields
  },
  compoundPkFields: ['epubBookId', 'audioBookId'],
}
```
`mappings` maps to `mappings` (same name — no entry needed). `userId → user_id` and `updatedAt → updated_at` are handled by the standard sync engine snake_case convention (the fieldMapper falls back to snake_case for unmapped fields).

**AC5 — `useChapterMappingStore` `saveMapping` goes through `syncableWrite`:**
In `src/stores/useChapterMappingStore.ts`, replace the direct `db.chapterMappings.put(fullRecord)` call in `saveMapping` with:
```ts
await syncableWrite('chapterMappings', 'put', fullRecord)
```
The store's Zustand state update (`set(...)`) remains unchanged — it runs after the write. The `syncableWrite` call stamps `userId` and `updatedAt` automatically; remove any manual `updatedAt: new Date().toISOString()` stamp from `saveMapping` if present (the store currently does not stamp it, so `computedAt` from the caller is preserved as-is — only `updatedAt` is overwritten by syncableWrite).

**AC6 — `useChapterMappingStore` `deleteMapping` goes through `syncableWrite` (soft-delete or compound delete):**
`syncableWrite` for compound-PK tables does not currently support `delete` operations (see comment in `syncableWrite.ts` lines 97-99: "delete is not currently used for compound-PK tables — the synthesized recordId would not be available from the bare string the caller passes"). Use a **soft-delete** pattern instead:
- Add a `deleted?: boolean` field to `ChapterMappingRecord` in `src/data/types.ts`
- In `deleteMapping`, instead of `db.chapterMappings.delete([epubBookId, audioBookId])`, call:
  ```ts
  const existing = get().mappings.find(m => m.epubBookId === epubBookId && m.audioBookId === audioBookId)
  if (!existing) return
  await syncableWrite('chapterMappings', 'put', { ...existing, deleted: true })
  ```
- The Zustand state filter (`state.mappings.filter(...)`) remains, removing the deleted mapping from in-memory state immediately
- The download apply phase in `syncEngine.ts` already skips Dexie records where `deleted: true` (consistent with notes soft-delete pattern from E93-S02)
- Add `deleted?: boolean` to the `fieldMap` as `deleted: 'deleted'` (same name, no change) and to Supabase migration schema as `deleted BOOLEAN NOT NULL DEFAULT FALSE`

**AC7 — `tableRegistry.ts` entry includes `deleted` field mapping:**
After AC6, the `chapterMappings` registry entry must include `deleted: 'deleted'` in `fieldMap`. The Supabase `chapter_mappings` table must have a `deleted BOOLEAN NOT NULL DEFAULT FALSE` column (add to migration AC1). The download phase must filter deleted records from Dexie: `if (record.deleted) { await db.chapterMappings.delete([record.epubBookId, record.audioBookId]); continue }`.

**AC8 — Round-trip field fidelity:**
A `ChapterMappingRecord` with `mappings: [{ epubChapterHref: 'chapter01.xhtml', audioChapterIndex: 0, confidence: 1.0 }]` written via `syncableWrite` must:
- Appear in Supabase `chapter_mappings` with `epub_book_id`, `audio_book_id`, `user_id`, and `mappings` JSONB array intact
- Round-trip back via download without any field mutations or precision loss on `confidence` (float 0–1)
- `computedAt` ISO string preserved exactly (no timezone coercion)

**AC9 — Compound PK: two different book pairs store as separate records:**
Writing mappings for `(epubId: 'A', audioId: 'B')` and `(epubId: 'A', audioId: 'C')` creates two distinct rows in Supabase, not one overwritten row.

**AC10 — Manual override mappings (`confidence: 1.0`) preserved:**
A mapping entry with `confidence: 1.0` (manually corrected by user) round-trips correctly. Auto-generated entries (`confidence < 1.0`) also round-trip correctly. LWW conflict strategy applies: the more recently `updatedAt`-stamped record wins on conflict.

**AC11 — Unit tests for `syncableWrite` with `chapterMappings`:**
New or extended test in `src/lib/sync/__tests__/syncableWrite.test.ts`:
- `saveMapping` → `syncableWrite('chapterMappings', 'put', record)` → `db.chapterMappings.put` called with stamped `userId` and `updatedAt`
- `syncQueue` entry has `recordId = '{epubBookId}\u001f{audioBookId}'` (unit separator join)
- `deleteMapping` (soft-delete) → `syncableWrite('chapterMappings', 'put', { ...record, deleted: true })` → `db.chapterMappings.put` called; queue entry created

**AC12 — `loadMappings` still works after schema change:**
`useChapterMappingStore.loadMappings()` reads `db.chapterMappings.toArray()` and filters out records where `deleted: true` from the Zustand state (so soft-deleted mappings do not appear in the UI). Existing Dexie records without a `userId` field continue to load without errors (`userId` is optional).

**AC13 — Dexie version incremented for schema changes:**
If `ChapterMappingRecord` gains a new `deleted` field that must be indexed or the schema changed, increment the Dexie version in `src/db/schema.ts`. If only an optional field is added with no new indexes, a version bump may not be required — but confirm with existing migration pattern. Update `src/db/__tests__/schema.test.ts` if version changes.

**AC14 — No TypeScript errors:**
`npx tsc --noEmit` passes clean after all changes.

## Tasks / Subtasks

- [ ] Task 1: Supabase migration (AC: 1, 2)
  - [ ] 1.1 Create `supabase/migrations/20260420000001_chapter_mappings.sql`
    - `BEGIN;`
    - `CREATE TABLE IF NOT EXISTS public.chapter_mappings (epub_book_id UUID NOT NULL, audio_book_id UUID NOT NULL, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, mappings JSONB NOT NULL DEFAULT '[]', deleted BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (epub_book_id, audio_book_id, user_id));`
    - RLS enable + single FOR ALL policy: `CREATE POLICY "Users access own chapter mappings" ON public.chapter_mappings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`
    - moddatetime trigger: `CREATE TRIGGER chapter_mappings_set_updated_at BEFORE UPDATE ON public.chapter_mappings FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');`
    - Download cursor index: `CREATE INDEX IF NOT EXISTS idx_chapter_mappings_user_updated ON public.chapter_mappings (user_id, updated_at);`
    - `COMMIT;`
  - [ ] 1.2 Create `supabase/migrations/rollback/20260420000001_chapter_mappings_rollback.sql`
    - `DROP TABLE IF EXISTS public.chapter_mappings CASCADE;`
  - [ ] 1.3 Verify migration is idempotent (re-run does not error)

- [ ] Task 2: Type updates (AC: 3, 6)
  - [ ] 2.1 Open `src/data/types.ts`; locate `ChapterMappingRecord` interface (around line 1037)
  - [ ] 2.2 Add `userId?: string | null` after `audioBookId` field
  - [ ] 2.3 Add `deleted?: boolean` after `updatedAt` field
  - [ ] 2.4 Run `npx tsc --noEmit` — zero errors

- [ ] Task 3: Update `tableRegistry.ts` entry (AC: 4, 7)
  - [ ] 3.1 Open `src/lib/sync/tableRegistry.ts`; locate the `chapterMappings` entry (around line 410)
  - [ ] 3.2 Replace `fieldMap: {}` with:
    ```ts
    fieldMap: {
      epubBookId: 'epub_book_id',
      audioBookId: 'audio_book_id',
      computedAt: 'computed_at',
      deleted: 'deleted',
    },
    ```
  - [ ] 3.3 Confirm `compoundPkFields: ['epubBookId', 'audioBookId']` is already present (it is — just verify)
  - [ ] 3.4 Run `npx tsc --noEmit` — zero errors

- [ ] Task 4: Wire `useChapterMappingStore` through `syncableWrite` (AC: 5, 6, 12)
  - [ ] 4.1 Open `src/stores/useChapterMappingStore.ts`
  - [ ] 4.2 Add import: `import { syncableWrite } from '@/lib/sync/syncableWrite'`
  - [ ] 4.3 In `saveMapping`: replace `await db.chapterMappings.put(fullRecord)` with `await syncableWrite('chapterMappings', 'put', fullRecord)`
    - Keep the Zustand `set(...)` state update unchanged
  - [ ] 4.4 In `deleteMapping`: replace `await db.chapterMappings.delete([epubBookId, audioBookId])` with soft-delete:
    ```ts
    const existing = get().mappings.find(m => m.epubBookId === epubBookId && m.audioBookId === audioBookId)
    if (!existing) return
    await syncableWrite('chapterMappings', 'put', { ...existing, deleted: true })
    ```
    - Keep the Zustand `set(state => ({ mappings: state.mappings.filter(...) }))` unchanged
  - [ ] 4.5 In `loadMappings`: after `db.chapterMappings.toArray()`, filter: `const mappings = (await db.chapterMappings.toArray()).filter(m => !m.deleted)`
  - [ ] 4.6 Remove the `import { db } from '@/db/schema'` if `db` is no longer used directly — BUT `loadMappings` still reads from Dexie via `db.chapterMappings.toArray()`, so keep the import
  - [ ] 4.7 Run `npx tsc --noEmit` — zero errors

- [ ] Task 5: Sync engine download: handle soft-deleted chapter mappings (AC: 7)
  - [ ] 5.1 Open `src/lib/sync/syncEngine.ts`; locate the `_applyRecord` function (or equivalent download apply loop)
  - [ ] 5.2 In the apply path for `chapterMappings` (via the generic LWW apply or a special case), add: if the downloaded record has `deleted: true`, call `db.chapterMappings.delete([record.epubBookId, record.audioBookId])` and skip the put
  - [ ] 5.3 Confirm existing generic soft-delete logic (from E93-S02 notes pattern) already handles `deleted: true` → if so, no special case needed; just verify the field name is consistent
  - [ ] 5.4 Run `npx tsc --noEmit` — zero errors

- [ ] Task 6: Dexie schema version check (AC: 13)
  - [ ] 6.1 Open `src/db/schema.ts`; check if `chapterMappings` table definition needs updating
  - [ ] 6.2 `deleted` is an optional boolean field on an existing record — no new index needed. Confirm the Dexie version does NOT need to bump for this (optional fields added without index changes do not require a version bump in Dexie)
  - [ ] 6.3 Update `src/db/__tests__/schema.test.ts` only if version bumped

- [ ] Task 7: Unit tests (AC: 11)
  - [ ] 7.1 Open `src/lib/sync/__tests__/syncableWrite.test.ts`
  - [ ] 7.2 Add test group: `describe('chapterMappings — compound PK')`:
    - `saveMapping path`: call `syncableWrite('chapterMappings', 'put', { epubBookId: 'epub-1', audioBookId: 'audio-1', mappings: [...], computedAt: '...', updatedAt: '...' })` → assert `db.chapterMappings.put` called with `userId` and `updatedAt` stamped; `db.syncQueue.add` called with `recordId = 'epub-1\u001faudio-1'`
    - `deleteMapping (soft-delete) path`: call `syncableWrite('chapterMappings', 'put', { epubBookId: 'epub-1', audioBookId: 'audio-1', deleted: true, ... })` → assert `db.chapterMappings.put` called; queue entry has `operation: 'put'` and payload includes `deleted: true`
  - [ ] 7.3 Run `npm run test:unit -- syncableWrite` — all pass

- [ ] Task 8: Final verification
  - [ ] 8.1 `npm run test:unit` — all unit tests pass
  - [ ] 8.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 8.3 `npm run lint` — zero new ESLint warnings/errors
  - [ ] 8.4 `npm run build` — clean build
  - [ ] 8.5 Manual smoke test: in browser DevTools, call `useChapterMappingStore.getState().saveMapping('epub-1', 'audio-1', { mappings: [], computedAt: new Date().toISOString() })`, then inspect `db.syncQueue.toArray()` — verify entry exists with `tableName: 'chapterMappings'` and `recordId` containing unit separator

## Implementation Notes

### Compound PK and `syncableWrite`

The `chapterMappings` table uses a composite primary key `(epubBookId, audioBookId)` — there is no `id` UUID column. `syncableWrite` already handles this: when `entry.compoundPkFields` is set, it synthesizes `recordId = parts.join('\u001f')` (U+001F unit separator). The upload engine reads `recordId` from the syncQueue and uses it for upsert conflict resolution.

For **delete**, `syncableWrite` explicitly does not support compound-PK tables via `operation: 'delete'` (see lines 97-99 of `syncableWrite.ts`). The soft-delete pattern (put with `deleted: true`) is the standard workaround used throughout the codebase (same as notes in E93-S02).

### `fieldMap` Gap in Existing Registry

The existing `chapterMappings` registry entry has `fieldMap: {}` — an empty map. The upload engine's `toSnakeCase()` falls back to raw camelCase if no map entry exists, which means `epubBookId` would be sent as-is (not converted to `epub_book_id`) and Supabase would reject it. This is a latent bug that this story fixes in Task 3.

The fix requires explicitly mapping:
- `epubBookId → epub_book_id`
- `audioBookId → audio_book_id`
- `computedAt → computed_at`

`mappings`, `userId → user_id`, and `updatedAt → updated_at` are handled by the standard snake_case convention.

### Supabase `chapter_mappings` Schema

The Supabase table has a **composite primary key** with no separate `id` column — unlike most other sync tables. This means:
- Upsert in the upload engine uses `onConflict: 'epub_book_id,audio_book_id,user_id'` (not the default `id`)
- The download cursor query uses `(user_id, updated_at)` index (added in AC1)
- The download apply phase identifies records by `(epub_book_id, audio_book_id)` to locate the Dexie record

Confirm the upload engine's upsert call specifies the correct `onConflict` columns. Look at how `contentProgress` (another compound-PK table) handles this in `syncEngine.ts`.

### `deleted` Field and Supabase Column

Adding `deleted BOOLEAN NOT NULL DEFAULT FALSE` to the migration ensures:
1. The column exists server-side so soft-deleted records upload correctly
2. Downloaded records with `deleted: true` can be detected and cleaned from Dexie
3. The default `FALSE` means existing rows (before this migration) are treated as non-deleted

### `computedAt` vs `updatedAt`

`ChapterMappingRecord` has both `computedAt` (when the mapping was computed by the alignment algorithm) and `updatedAt` (sync metadata). `syncableWrite` stamps `updatedAt` automatically with the current ISO timestamp. `computedAt` is set by the caller (the alignment computation code) and is preserved as-is. Both must round-trip correctly.

### LWW Conflict Strategy

`conflictStrategy: 'lww'` means the record with the newer `updatedAt` wins on download. Since manual overrides (`confidence: 1.0`) are set by the user and cause an immediate `saveMapping` call (which stamps a new `updatedAt`), they will win over any older auto-generated mapping from another device.

## Testing Notes

### Compound PK Mock Pattern

When mocking `db.chapterMappings` in unit tests, note that `put` accepts the full record (with both PK fields), and `delete` accepts an array `[epubBookId, audioBookId]`. The Dexie `Table.put()` call in `syncableWrite` passes the full stamped record — Dexie internally uses the compound index `[epubBookId+audioBookId]` as the key.

### Verifying `recordId` in Queue

In unit tests, assert:
```ts
expect(db.syncQueue.add).toHaveBeenCalledWith(
  expect.objectContaining({
    tableName: 'chapterMappings',
    recordId: 'epub-1\u001faudio-1',
    operation: 'put',
  })
)
```

### Soft-Delete Round-Trip

Test the full soft-delete cycle:
1. `saveMapping(...)` → record in Dexie with `deleted: undefined`
2. `deleteMapping(...)` → record in Dexie updated with `deleted: true`; filtered from Zustand state
3. `loadMappings()` → record with `deleted: true` excluded from `mappings` array

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] Migration file present at `supabase/migrations/20260420000001_chapter_mappings.sql` with `deleted` column, PK, RLS, trigger, index
- [ ] Rollback script present at `supabase/migrations/rollback/20260420000001_chapter_mappings_rollback.sql`
- [ ] `ChapterMappingRecord` in `types.ts` has `userId?: string | null` and `deleted?: boolean`
- [ ] `tableRegistry.ts` `chapterMappings` entry has `fieldMap` with `epubBookId`, `audioBookId`, `computedAt`, `deleted` mapped
- [ ] `useChapterMappingStore.saveMapping` uses `syncableWrite` (not direct `db.chapterMappings.put`)
- [ ] `useChapterMappingStore.deleteMapping` uses soft-delete pattern (not `db.chapterMappings.delete`)
- [ ] `useChapterMappingStore.loadMappings` filters out `deleted: true` records from Zustand state
- [ ] Sync engine download apply handles `deleted: true` for `chapterMappings` (either via existing generic soft-delete or explicit case)
- [ ] No TypeScript errors: `npx tsc --noEmit` clean
- [ ] Unit tests for compound PK `recordId` synthesis pass
- [ ] `npm run test:unit` — all pass
- [ ] `npm run build` — clean build
- [ ] `npm run lint` — zero new warnings

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
