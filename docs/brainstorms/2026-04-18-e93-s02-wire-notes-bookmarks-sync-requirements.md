# CE Requirements: Wire Notes and Bookmarks with Sync (E93-S02)

**Date:** 2026-04-18
**Story:** E93-S02
**Branch:** feature/e93-s02-wire-notes-and-bookmarks-with-sync

---

## Problem Statement

The `useNoteStore` and `useBookmarkStore` Zustand stores currently write directly to Dexie (`db.notes.*`, `db.bookmarks.*`). This bypasses the E92 sync engine, meaning note and bookmark mutations are never enqueued for upload to Supabase. Users who annotate content on one device will not see those annotations on other devices until the stores are wired through `syncableWrite`.

---

## User Value / Goal

A learner who creates notes or sets video bookmarks on one device should see that content automatically appear on all their other devices without any manual action. This requires routing all store mutations through the sync engine so they are persisted locally and enqueued for Supabase upload.

---

## Acceptance Criteria

1. **AC1 — tableRegistry entries verified:** Both `notes` and `bookmarks` tables are confirmed present in `src/lib/sync/tableRegistry.ts` with correct configuration:
   - `notes`: `{ dexieTable: 'notes', supabaseTable: 'notes', conflictStrategy: 'lww', priority: 1, fieldMap: { deleted: 'soft_deleted' } }`
   - `bookmarks`: `{ dexieTable: 'bookmarks', supabaseTable: 'bookmarks', conflictStrategy: 'lww', priority: 1, fieldMap: {} }`

2. **AC2 — `useNoteStore` writes use `syncableWrite`:** All mutations in `src/stores/useNoteStore.ts` replace direct Dexie calls:
   - `saveNote`: `syncableWrite('notes', 'put', note)`
   - `addNote`: `syncableWrite('notes', 'add', note)`
   - `deleteNote`: `syncableWrite('notes', 'delete', noteId)`
   - `softDelete` / `restoreNote`: converted to async, call `syncableWrite('notes', 'put', updatedNote)` with merged `deleted`/`deletedAt` fields

3. **AC3 — `useBookmarkStore` writes use `syncableWrite`:** All mutations in `src/stores/useBookmarkStore.ts` replace direct Dexie calls:
   - `addBookmark`: `syncableWrite('bookmarks', 'add', bookmark)`
   - `updateBookmarkLabel`: fetch-then-put pattern (no partial update support in `syncableWrite`)
   - `deleteBookmark`: `syncableWrite('bookmarks', 'delete', bookmarkId)`

4. **AC4 — `VideoBookmark` type updated:** `src/data/types.ts` adds `updatedAt?: string` to the `VideoBookmark` interface (stamped by `syncableWrite`).

5. **AC5 — Store refresh callbacks registered:** `src/app/hooks/useSyncLifecycle.ts` registers before `fullSync()` is called:
   - `syncEngine.registerStoreRefresh('notes', () => useNoteStore.getState().loadNotes())`
   - `syncEngine.registerStoreRefresh('bookmarks', () => useBookmarkStore.getState().loadBookmarks())`

6. **AC6 — Sync queue entries created on authenticated write:** After any of the 6 mutating operations while signed in, `syncQueue` contains an entry with correct `tableName`, `operation`, and `status: 'pending'`. For notes puts with `deleted: true`, the payload must have `soft_deleted` key (fieldMap rename).

7. **AC7 — Unauthenticated writes persist locally only:** When `user` is null, mutations write to Dexie but create no `syncQueue` entries.

8. **AC8 — Zero direct Dexie write calls remain:** After wiring, `useNoteStore.ts` and `useBookmarkStore.ts` contain no `db.notes.put/add/delete` or `db.bookmarks.put/add/update/delete` calls (reads remain unchanged).

9. **AC9 — Unit tests:** New file `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` covers all 7 mutation operations (notes: save, add, delete, soft-delete; bookmarks: add, updateLabel, delete) plus the unauthenticated no-queue scenario.

---

## Technical Context and Constraints

- **`syncableWrite` contract:** Performs the Dexie write internally and enqueues a `syncQueue` entry when a user is authenticated. Dexie write failure rethrows (fatal); queue insert failure is logged and swallowed (non-fatal).
- **`persistWithRetry` must be kept:** Wraps `syncableWrite` calls for transient IndexedDB error resilience with exponential backoff. The two layers compose cleanly.
- **No partial update in `syncableWrite`:** Does not support Dexie's `update(id, partial)` API. `updateBookmarkLabel` must fetch the full existing record then call `syncableWrite('bookmarks', 'put', mergedRecord)`. The `get()` must be inside `persistWithRetry` so retries always re-fetch.
- **`softDelete`/`restoreNote` async conversion:** These are currently synchronous in-memory `set()` calls. They must become `async` functions. All call sites in the codebase must be audited for `await`.
- **fieldMap rename for notes:** `deleted → soft_deleted` in queue payload. The `toSnakeCase` utility inside `syncableWrite` applies this mapping automatically. Verify payload has `soft_deleted` (not `deleted`) in tests.
- **Unified search index calls must survive:** `useNoteStore.saveNote` calls `updateDocInIndex(toSearchableNote(note))` and `addDocToIndex(...)` — these must remain untouched. Only the Dexie persistence line changes.
- **Registration order in `useSyncLifecycle`:** New `registerStoreRefresh` calls must be placed before `setStatus('syncing')` / `syncEngine.fullSync()`, following the existing pattern for `studySessions`.
- **ES2020 target:** No `Promise.any`. `Promise.allSettled` is fine.
- **TypeScript strictness:** Run `npx tsc --noEmit` after every task. Zero errors before submission.
- **Test pattern:** Follow `src/lib/sync/__tests__/p0-sync.test.ts` exactly — `import 'fake-indexeddb/auto'`, `vi.resetModules()` + `Dexie.delete('ElearningDB')` in `beforeEach`, dynamic imports after reset.

---

## Dependencies

- **E92-S03 (completed):** Both `notes` and `bookmarks` tables are already registered in `tableRegistry.ts`. No registry modifications needed.
- **E92-S04 / E92-S09 (completed):** `syncableWrite` function exists at `src/lib/sync/syncableWrite.ts`. The `useContentProgressStore` (P0 store) is already wired and serves as the reference implementation pattern.
- **Dexie schema v52:** Already stamped `updatedAt` on existing bookmark records. No migration needed for AC4.
- **`search_similar_notes()` Supabase function (E93-S01):** Already filters `soft_deleted IS NOT TRUE`, so soft-deleted notes are excluded from server-side semantic search automatically.

---

## Out of Scope

- **`embeddings` table sync:** The `db.embeddings` write path runs inside a Worker via `embeddingPipeline.indexNote()`. Refactoring Worker communication is deferred to E93-S03 or a dedicated story.
- **Supabase upload / download engine changes:** This story only wires the local store mutation layer. The upload worker and download reconciliation logic are handled by E92.
- **UI changes:** Pure infrastructure story. No new components, no design review required.
- **New Supabase migrations:** Tables and columns already exist from E92. No SQL changes needed.
- **Conflict resolution logic:** LWW strategy is already implemented in the sync engine. This story does not modify it.

---

## Implementation Hints

1. **Start with AC1 (verification only):** Read `tableRegistry.ts`, confirm both entries exist with correct values. No code changes in this task.
2. **Add `updatedAt` to `VideoBookmark` first (AC4):** Unblocks TypeScript for bookmark tests. One-line change in `src/data/types.ts`.
3. **Wire `useNoteStore` (AC2/AC8):**
   - Add `import { syncableWrite } from '@/lib/sync/syncableWrite'`
   - Replace inner `db.notes.*` calls inside each `persistWithRetry` block
   - Convert `softDelete`/`restoreNote` to async: fetch note from `get(state().notes, id)` or `db.notes.get(id)`, merge fields, call `syncableWrite`
   - Audit all `softDelete`/`restoreNote` call sites for `await`
4. **Wire `useBookmarkStore` (AC3/AC8):**
   - Add import
   - `updateBookmarkLabel`: `const existing = await db.bookmarks.get(bookmarkId); if (!existing) return; await syncableWrite('bookmarks', 'put', { ...existing, label })`
5. **Register refresh callbacks (AC5):** Two lines in `useSyncLifecycle.ts` inside the `useEffect`, before the `fullSync()` call.
6. **Write unit tests (AC9):** Use `p0-sync.test.ts` as template. Key assertion for soft-delete: payload has `soft_deleted: true` AND does NOT have `deleted` property.
7. **Verification pass (AC6/AC7/AC8):** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Reference implementation pattern (from `useContentProgressStore`):
```ts
await persistWithRetry(async () => {
  await syncableWrite('notes', 'put', note)
})
```

### Key test assertion for fieldMap rename:
```ts
const entry = (await db.syncQueue.toArray()).find(q => q.tableName === 'notes' && q.payload.soft_deleted === true)
expect(entry).toBeDefined()
expect(entry?.payload).not.toHaveProperty('deleted')
```
