---
title: "Book Highlights and Vocabulary Sync (E93-S06)"
storyId: E93-S06
date: 2026-04-18
module: sync
tags: [book-highlights, vocabulary, sync, lww, monotonic, supabase, dexie, upsert]
---

# CE Requirements: Book Highlights and Vocabulary Sync (E93-S06)

**Date:** 2026-04-18
**Story:** E93-S06
**Branch:** feature/e93-s06-book-highlights-vocabulary-sync

---

## Problem Statement

`book_highlights` and `vocabulary_items` tables exist in Supabase (created in E93-S01), and their Dexie counterparts `bookHighlights` and `vocabularyItems` are registered in the tableRegistry. However, neither `useHighlightStore` nor `useVocabularyStore` routes their writes through `syncableWrite` — all mutations still call Dexie directly. This means reading highlights and vocabulary on a second device requires the user to re-create all annotations manually.

`book_highlights` uses LWW conflict strategy (straightforward). `vocabulary_items` uses a monotonic strategy for `masteryLevel` (the server has a SECURITY DEFINER function `upsert_vocabulary_mastery` that enforces `GREATEST(existing, incoming)` — the upload must call this function rather than a plain `upsert`).

---

## User Value / Goal

A learner who highlights passages or builds vocabulary while reading on one device should see all annotations on every other device after sync. Mastery progress (levels 0-3) must never regress — marking a word as "mastered" on Device A must not be overwritten by a stale "not started" value from Device B.

---

## Acceptance Criteria

### AC1 — `bookHighlights` tableRegistry entry is correct
`src/lib/sync/tableRegistry.ts` entry for `bookHighlights` already exists (from E92-S03). Verify and confirm:
```ts
{
  dexieTable: 'bookHighlights',
  supabaseTable: 'book_highlights',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}
```
No change needed if the entry is already correct. This task is verification-only.

### AC2 — `vocabularyItems` tableRegistry entry is correct
`src/lib/sync/tableRegistry.ts` entry for `vocabularyItems` already exists. Verify and confirm:
```ts
{
  dexieTable: 'vocabularyItems',
  supabaseTable: 'vocabulary_items',
  conflictStrategy: 'monotonic',
  priority: 1,
  fieldMap: {},
  monotonicFields: ['masteryLevel'],
}
```
The `conflictStrategy: 'monotonic'` and `monotonicFields: ['masteryLevel']` are critical — the upload phase must route `vocabularyItems` writes through the `upsert_vocabulary_mastery` SECURITY DEFINER function (not plain upsert). No fieldMap change needed.

### AC3 — `useHighlightStore` writes route through `syncableWrite`
All Dexie write calls in `src/stores/useHighlightStore.ts` replaced with `syncableWrite`:
- `createHighlight`: replace `db.bookHighlights.put(highlight)` with `syncableWrite('bookHighlights', 'put', highlight)`
- `updateHighlight`: fetch-then-put pattern — fetch existing from Dexie, merge updates, call `syncableWrite('bookHighlights', 'put', merged)`
- `deleteHighlight`: replace `db.bookHighlights.delete(highlightId)` with `syncableWrite('bookHighlights', 'delete', highlightId)`

Soft-delete note: if `BookHighlight` supports soft deletion (e.g. a `deleted` or `deletedAt` field), those mutations must also route through `syncableWrite` with a `'put'` operation — not `'delete'`. Check the type definition and handle accordingly.

### AC4 — `useVocabularyStore` writes route through `syncableWrite`
All Dexie write calls in `src/stores/useVocabularyStore.ts` replaced with `syncableWrite`:
- `addItem`: replace `db.vocabularyItems.put(item)` with `syncableWrite('vocabularyItems', 'put', item)`
- `updateItem`: fetch-then-put pattern (same as highlights above)
- `deleteItem`: replace `db.vocabularyItems.delete(id)` with `syncableWrite('vocabularyItems', 'delete', id)`
- `advanceMastery`: fetch, apply new masteryLevel, call `syncableWrite('vocabularyItems', 'put', updated)`
- `resetMastery`: fetch, apply mastery 0, call `syncableWrite('vocabularyItems', 'put', updated)`

**Critical**: `advanceMastery` and `resetMastery` both call `db.vocabularyItems.update(id, updates)` today. These must be converted to fetch-then-put since `syncableWrite` does not support partial update.

### AC5 — `upsert_vocabulary_mastery` used for monotonic upload
The upload phase in `src/lib/sync/syncEngine.ts` already handles `conflictStrategy: 'monotonic'` tables by calling their dedicated Postgres function (per E92-S05 design). Verify that the `vocabularyItems` entry's `conflictStrategy: 'monotonic'` triggers the correct upload path that calls `upsert_vocabulary_mastery(p_user_id, p_vocabulary_item_id, p_mastery_level, p_updated_at)` rather than a generic `upsert`.

The `upsert_vocabulary_mastery` function signature (from E93-S01 R1 update):
```sql
CREATE OR REPLACE FUNCTION public.upsert_vocabulary_mastery(
  p_user_id UUID,
  p_vocabulary_item_id UUID,
  p_mastery_level INT,
  p_book_id UUID,       -- NOT NULL col required since E93-S01 R1
  p_word TEXT,          -- NOT NULL col required since E93-S01 R1
  p_updated_at TIMESTAMPTZ
)
```
All NOT NULL columns (`p_book_id`, `p_word`) are included in the function signature as of E93-S01 R1. The upload call must pass all required params. If the upload engine uses a generic RPC path, ensure it extracts these fields from the record payload.

### AC6 — Store refresh callbacks registered in `useSyncLifecycle`
`src/app/hooks/useSyncLifecycle.ts` registers before `fullSync()`:
```ts
syncEngine.registerStoreRefresh('bookHighlights', () =>
  useHighlightStore.getState().loadHighlightsForBook?.(/* current bookId */ '') ??
  Promise.resolve()
)
syncEngine.registerStoreRefresh('vocabularyItems', () =>
  useVocabularyStore.getState().loadAllItems()
)
```
`loadHighlightsForBook` requires a `bookId` — if no global "current book" context is available at refresh time, use `loadAllItems()` equivalent if one exists, or register a no-op with a comment explaining the limitation (highlights are loaded per-book on navigation).

### AC7 — Zero direct Dexie write calls remain
After this story, `useHighlightStore.ts` and `useVocabularyStore.ts` contain zero `db.bookHighlights.put/add/update/delete` or `db.vocabularyItems.put/add/update/delete` calls. Read calls (`where`, `toArray`, `get`, `orderBy`) remain unchanged.

### AC8 — Unauthenticated writes persist locally only
When `user` is null, all highlight and vocabulary mutations write to Dexie but create no `syncQueue` entries and make no Supabase requests. No errors are thrown. This is the standard `syncableWrite` contract — no extra code needed.

### AC9 — `cfiRange` string precision preserved
`BookHighlight.cfiRange` is an EPUB CFI string (e.g. `epubcfi(/6/4[chap01ref]!/4/2[para01]/1:0)`). After a round-trip through Supabase (upload then download), the `cfiRange` value is byte-for-byte identical to the original. No URL-encoding, JSON escaping, or truncation may occur.

### AC10 — Unit tests
New file `src/lib/sync/__tests__/p1-highlights-vocabulary-sync.test.ts`:
- `createHighlight` while authenticated → `syncQueue` entry `{ tableName: 'bookHighlights', operation: 'put' }`
- `updateHighlight` → `syncQueue` entry `{ tableName: 'bookHighlights', operation: 'put' }`
- `deleteHighlight` → `syncQueue` entry `{ tableName: 'bookHighlights', operation: 'delete' }`
- `addItem` while authenticated → `syncQueue` entry `{ tableName: 'vocabularyItems', operation: 'put' }`
- `advanceMastery` → `syncQueue` entry `{ tableName: 'vocabularyItems', operation: 'put' }` with updated `masteryLevel`
- `resetMastery` → `syncQueue` entry `{ tableName: 'vocabularyItems', operation: 'put' }` with `masteryLevel: 0`
- `deleteItem` → `syncQueue` entry `{ tableName: 'vocabularyItems', operation: 'delete' }`
- Unauthenticated: no queue entries for any of the above operations

### AC11 — TypeScript clean
`npx tsc --noEmit` passes with zero errors after all changes.

---

## Technical Context and Constraints

### `book_highlights` and `vocabulary_items` Tables Already Exist (E93-S01)
Both Supabase tables were created in E93-S01 (`supabase/migrations/20260413000002_p1_learning_content.sql`). No new migration is needed for this story.

### tableRegistry Entries Already Exist (E92-S03)
Both `bookHighlights` and `vocabularyItems` entries are already declared in `src/lib/sync/tableRegistry.ts` (verified at lines 204-219 in the registry). This story does **not** modify the registry.

### `upsert_vocabulary_mastery` SECURITY DEFINER Function
Defined in the P1 migration (E93-S01). Updated in R1 to include all NOT NULL columns:
```
p_user_id UUID, p_vocabulary_item_id UUID, p_mastery_level INT, p_book_id UUID, p_word TEXT, p_updated_at TIMESTAMPTZ
```
The upload engine must pass `p_book_id` and `p_word` from the record payload when calling this function. This is the ONLY safe way to upsert vocabulary mastery — direct `INSERT ... ON CONFLICT DO UPDATE` on `vocabulary_items` is prohibited because `GREATEST()` enforcement lives in the function.

### LWW vs. Monotonic Conflict Strategy
- `book_highlights`: LWW — the most recently updated record wins. Standard pattern, same as `notes` and `bookmarks`.
- `vocabulary_items`: Monotonic on `masteryLevel` — a `masteryLevel` value can only increase. The download/apply phase uses `Math.max(local.masteryLevel, server.masteryLevel)` (E92-S06 monotonic apply). The upload phase calls the SECURITY DEFINER function (E92-S05 monotonic upload). Both sides enforce the invariant independently.

### `syncableWrite` Pattern (E92-S04)
Import from `src/lib/sync/syncableWrite.ts`. Wraps Dexie write, stamps `userId` and `updatedAt`, enqueues if authenticated. Wrap in `persistWithRetry` for consistent retry behavior (see E93-S02 and E93-S04 patterns).

### Fetch-Then-Put for Partial Updates
`syncableWrite` does not support partial `update(id, fields)` — it requires a full record. For `updateHighlight`, `updateItem`, `advanceMastery`, `resetMastery`: read the existing Dexie record first, merge the changes, then call `syncableWrite` with the full merged record. Use `db.bookHighlights.get(id)` and `db.vocabularyItems.get(id)` for the reads (reads stay as direct Dexie calls — only writes switch to syncableWrite).

### `useSyncLifecycle` Pattern (E93-S02)
`registerStoreRefresh` is called once, before `fullSync()`, in the `useSyncLifecycle` hook. Callbacks are keyed by `dexieTable` name (e.g. `'bookHighlights'`). See E93-S02 and E93-S04 for the exact pattern.

### ES2020 Constraints
No `Promise.any`. `Promise.allSettled` is acceptable. All async paths must propagate or explicitly handle errors.

### `BookHighlight` Soft Delete
Check if `BookHighlight` in `src/data/types.ts` has a `deleted` or `softDeleted` field. If yes, follow the same soft-delete pattern as `notes` (E93-S02): route the update through `syncableWrite('bookHighlights', 'put', updatedHighlight)` — NOT through `syncableWrite('bookHighlights', 'delete', id)`. This ensures the soft-delete flag syncs to other devices rather than hard-deleting the record in Supabase.

---

## Dependencies

- **E92-S03 (done):** `tableRegistry.ts` exists with `bookHighlights` and `vocabularyItems` entries.
- **E92-S04 (done):** `syncableWrite` function exists at `src/lib/sync/syncableWrite.ts`.
- **E92-S05 (done):** Upload phase processes `syncQueue` entries, including monotonic upsert path.
- **E92-S06 (done):** Download/apply phase applies LWW and monotonic strategies per registry config.
- **E92-S09 (done):** P0 stores wired — reference implementation.
- **E93-S01 (in-progress):** `book_highlights` and `vocabulary_items` Supabase tables with RLS and `upsert_vocabulary_mastery` function. Must be applied before end-to-end testing against real Supabase.
- **E93-S02 (done):** Notes/bookmarks wiring — nearest reference for `syncableWrite` pattern.

---

## Out of Scope

- **New migration**: No Supabase migration needed — tables and functions exist from E93-S01.
- **tableRegistry changes**: Both entries already exist with correct config — no modifications needed.
- **UI changes**: Pure infrastructure story. No new components, no design review required.
- **`flashcardId` FK integrity**: The `bookHighlights.flashcardId` and `vocabularyItems.highlightId` foreign keys are not enforced server-side (by design — FK integrity across P1 tables is deferred). The fields sync as plain UUIDs.
- **Bulk backfill on first sync**: Existing highlights/vocabulary are uploaded when the sync engine drains the full `syncQueue` on first login. Pre-existing records not yet in `syncQueue` are handled by E97's initial upload wizard.
- **Highlight search/filter changes**: This story only wires the write path. Read paths (search, filter, color filter) remain unchanged.
- **Vocabulary review logic**: `advanceMastery` and `resetMastery` business logic is unchanged — only the persistence layer switches from direct Dexie to `syncableWrite`.

---

## Implementation Hints

1. **Locate all `db.bookHighlights` write sites**: `grep -rn "db.bookHighlights" src/` — primarily in `useHighlightStore.ts`.
2. **Locate all `db.vocabularyItems` write sites**: `grep -rn "db.vocabularyItems" src/` — primarily in `useVocabularyStore.ts`.
3. **Wire `useHighlightStore`** (AC3): `createHighlight`, `updateHighlight`, `deleteHighlight`.
4. **Wire `useVocabularyStore`** (AC4): `addItem`, `updateItem`, `deleteItem`, `advanceMastery`, `resetMastery`.
5. **Register store refresh callbacks** in `useSyncLifecycle.ts` (AC6).
6. **Verify monotonic upload path** for `vocabularyItems` — confirm `upsert_vocabulary_mastery` is called with all required params including `p_book_id` and `p_word` (AC5).
7. **Write unit tests** in `src/lib/sync/__tests__/p1-highlights-vocabulary-sync.test.ts` (AC10).
8. **Verification**: `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Key Files

| File | Role |
|------|------|
| `src/stores/useHighlightStore.ts` | Wire `db.bookHighlights` writes via `syncableWrite` |
| `src/stores/useVocabularyStore.ts` | Wire `db.vocabularyItems` writes via `syncableWrite` |
| `src/lib/sync/tableRegistry.ts` | Verify `bookHighlights` and `vocabularyItems` entries (no changes expected) |
| `src/lib/sync/syncableWrite.ts` | The write wrapper (E92-S04) |
| `src/lib/sync/syncEngine.ts` | Monotonic upload path — verify `upsert_vocabulary_mastery` call (AC5) |
| `src/app/hooks/useSyncLifecycle.ts` | Register store refresh callbacks |
| `src/data/types.ts` | `BookHighlight` and `VocabularyItem` type definitions |
| `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` | Nearest test pattern (E93-S02) |

### lastGreenSha

`0803a653cda889a29ee4abb092523bc4729d49e7`
