---
title: "feat: Wire audio_bookmarks and audio_clips sync (E93-S07)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e93-s07-audio-bookmarks-clips-sync-requirements.md
---

# feat: Wire audio_bookmarks and audio_clips sync (E93-S07)

## Overview

Routes all `audioBookmarks` INSERT calls and all `audioClips` write calls through `syncableWrite` so changes are enqueued for Supabase upload. Fixes a critical gap in the download engine: it unconditionally queries `updated_at` on every table, but `audio_bookmarks` has no `updated_at` column — requiring a `cursorField` override in the registry and download engine. Registers store-refresh callbacks in `useSyncLifecycle`.

## Problem Frame

`audio_bookmarks` and `audio_clips` Supabase tables exist (E93-S01) and both have `tableRegistry` entries (E92-S03), but all component-level and store-level writes still call Dexie directly. A learner's bookmarks and clips are therefore local-only.

Key asymmetry: `audio_bookmarks` is an immutable append-only event log with no `updated_at` column — the download engine must use `created_at` as its incremental cursor. `audio_clips` is standard LWW with `updated_at`. (See origin: `docs/brainstorms/2026-04-18-e93-s07-audio-bookmarks-clips-sync-requirements.md`)

## Requirements Trace

- R1. `AudioClip` interface gains `updatedAt?: string` so `syncableWrite` can stamp it (AC3).
- R2. `audioBookmarks` tableRegistry entry gains `cursorField: 'created_at'` and `insertOnly: true`; `conflictStrategy` updated to `'insert-only'` (AC1, critical invariant).
- R3. Download engine respects `cursorField` override when present, falling back to `updated_at` (implicit from AC1).
- R4. All `db.audioBookmarks.add(...)` INSERT call sites route through `syncableWrite('audioBookmarks', 'add', record)` (AC4).
- R5. `db.audioBookmarks.delete(...)` calls in `BookmarkListPanel` and `BookmarkButton` (toggle-off branch) stay as direct Dexie calls with explanatory comments — sync engine uses `INSERT ... ON CONFLICT DO NOTHING` for insert-only tables; delete propagation is not supported (AC4 special handling).
- R6. `db.audioBookmarks.update(...)` calls in `BookmarkButton` and `PostSessionBookmarkReview` remain local-only with `// sync: local-only — audio_bookmarks has no updated_at column` comment (AC8).
- R7. All `db.audioClips.*` write calls in `useAudioClipStore` route through `syncableWrite` wrapped in `persistWithRetry` (AC5, AC7).
- R8. `updateClipTitle` and `reorderClips` convert `db.audioClips.update(...)` to fetch-then-put pattern (AC5).
- R9. `registerStoreRefresh` called for both `audioBookmarks` (no-op) and `audioClips` in `useSyncLifecycle` before `fullSync()` (AC6).
- R10. Unit tests cover all syncQueue scenarios for both tables (AC10).
- R11. `npx tsc --noEmit` passes with zero errors (AC11).

## Scope Boundaries

- No new Supabase migrations — tables exist from E93-S01.
- No changes to `tableRegistry` array order or to any entry other than `audioBookmarks` (which is corrected from `'lww'` placeholder to `'insert-only'` in Unit 2).
- No UI changes — pure infrastructure story.
- `audio_bookmarks` note-editing sync is out of scope (no `updated_at` column makes LWW impossible).
- `audio_bookmarks` delete propagation is out of scope — hard deletes remain local-only.
- Backfill of pre-existing records is out of scope (E97 handles initial upload wizard).
- ABS-sourced bookmarks (E101-E102) follow a different sync path — out of scope.

### Deferred to Separate Tasks

- Initial-upload backfill of existing `audioBookmarks`/`audioClips` records: E97 sync wizard.
- End-to-end testing against real Supabase (requires E93-S01 RLS to be applied).

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/tableRegistry.ts` — `audioBookmarks` (lines 221–227) and `audioClips` (229–235) entries. Both use `conflictStrategy: 'lww'` today; `audioBookmarks` must change to `'insert-only'`.
- `src/lib/sync/syncEngine.ts` — `_doDownload()` (line 629+): unconditionally uses `.order('updated_at')` and `.gte('updated_at', cursor)`. Must be patched to use `entry.cursorField ?? 'updated_at'`.
- `src/lib/sync/syncableWrite.ts` — stamps `userId` and `updatedAt` on `put`/`add`. For `add` operations `syncableWrite` stamps `updatedAt` even if the type doesn't declare it; the stamped record is written to Dexie but `audioBookmarks` Supabase table has no `updated_at` column — the upload engine uses `insertOnly: true` path (`INSERT ... ON CONFLICT DO NOTHING`), so the column is never referenced server-side. The Dexie record may carry a spurious `updatedAt` field, but this is harmless since Dexie doesn't enforce a schema beyond its index declarations.
- `src/stores/useAudioClipStore.ts` — all four write methods (`addClip`, `updateClipTitle`, `deleteClip`, `reorderClips`) use direct `db.audioClips.*` calls. `addClip` and `deleteClip` can be converted directly. `updateClipTitle` and each iteration of `reorderClips` require fetch-then-put.
- `src/app/components/audiobook/BookmarkButton.tsx` — `db.audioBookmarks.add(record)` at line 116 (INSERT site, must route through `syncableWrite`). `db.audioBookmarks.update(pendingId, ...)` at line 135 (note save — local-only, document).
- `src/app/components/audiobook/BookmarkListPanel.tsx` — `db.audioBookmarks.delete(id)` at line 64 (delete — keep local-only, document).
- `src/app/components/audiobook/PostSessionBookmarkReview.tsx` — `db.audioBookmarks.update(id, ...)` at line 92 (note save — local-only, document).
- `src/app/hooks/useSyncLifecycle.ts` — existing `registerStoreRefresh` calls at lines 51–77; add `audioBookmarks` and `audioClips` registrations before the first `fullSync()` call.
- `src/lib/sync/__tests__/p1-highlights-vocabulary-sync.test.ts` — nearest test pattern (E93-S06): `fake-indexeddb/auto`, `Dexie.delete('ElearningDB')`, `vi.resetModules()`, `useAuthStore.setState(...)`, `getQueueEntries(table)` helper.

### Institutional Learnings

- `syncableWrite` stamps `updatedAt` on every `put`/`add` regardless of type. For `audioBookmarks` this produces a spurious field in Dexie. Without the `stripFields: ['updatedAt']` fix (Unit 2), `toSnakeCase` would include `updated_at` in the INSERT payload and Supabase would reject the insert. With `stripFields` applied, the spurious stamp is stripped before upload and the server never sees the non-existent column reference.
- `reorderClips` currently wraps `db.audioClips.update(...)` calls in a `db.transaction`. After wiring, each `syncableWrite` inside the transaction creates a separate `syncQueue` entry. The transaction wrapper can stay for Dexie atomicity — this is correct behavior per the requirements (see origin doc §reorderClips Transaction Pattern).
- ES2020 constraint: no `Promise.any`; `Promise.allSettled` is acceptable. All async paths must propagate or handle errors.
- `useAudioClipStore` does not expose a `loadClipsForBook` method at the top level of its state type — the method is `loadClips`. The `useSyncLifecycle` registration must use the correct method name.

## Key Technical Decisions

- **`audioBookmarks` registry: change to `'insert-only'` + `insertOnly: true` + add `cursorField: 'created_at'`**: `conflictStrategy: 'lww'` is wrong for a table with no `updated_at` column — it would cause silent download failures (Supabase query references a non-existent column). `'insert-only'` + `insertOnly: true` correctly signals to the upload engine to use `INSERT ... ON CONFLICT DO NOTHING`. The new `cursorField` field signals to the download engine to use `created_at` instead of `updated_at` for incremental pagination.

- **Add `cursorField?: string` to `TableRegistryEntry` and patch `_doDownload`**: Rather than special-casing `audioBookmarks` in the download engine, adding a generic `cursorField` override is the minimal, forward-compatible change. The download engine falls back to `'updated_at'` when `cursorField` is absent, preserving all existing behavior. The `syncMetadata.lastSyncTimestamp` cursor meaning becomes "max `created_at` seen" for this table, which is correct for an append-only log.

- **`BookmarkListPanel` delete stays local-only**: The `insertOnly` upload path uses `INSERT ... ON CONFLICT DO NOTHING` — it never processes deletes. Routing `db.audioBookmarks.delete(id)` through `syncableWrite('audioBookmarks', 'delete', id)` would enqueue a delete entry that the upload engine would attempt to send as a DELETE RPC, conflicting with the insert-only contract. The safest and correct approach is to keep the delete as a direct Dexie call with a documentation comment.

- **`syncableWrite` spurious `updatedAt` stamp on `audioBookmarks` add operations**: `syncableWrite` unconditionally stamps `updatedAt` on `add` operations. The stamped record is written to Dexie — the `AudioBookmark` interface does not declare `updatedAt`, but Dexie doesn't enforce extra fields. The upload engine sends the payload via `INSERT ... ON CONFLICT DO NOTHING` and `toSnakeCase` maps `updatedAt → updated_at`, which would reference a column that doesn't exist in Supabase. **Resolution**: The Supabase `INSERT` payload for `insert-only` tables must strip `updated_at` before upload, OR the `tableRegistry` entry for `audioBookmarks` should list `updatedAt` in `stripFields`. Using `stripFields: ['updatedAt']` on the `audioBookmarks` registry entry is the cleanest solution — it reuses existing machinery and does not require changes to the upload engine.

- **`useAudioClipStore.loadClips` as store refresh target**: The refresh callback should call `useAudioClipStore.getState().loadClips('')` with an empty string bookId. This will hit the `if (get().isLoaded && get().loadedBookId === bookId)` guard only if an empty-string book is already loaded — which never happens in practice. The next real navigation to a book page will reload the correct clips. Document with a comment.

## Open Questions

### Resolved During Planning

- **Will `syncableWrite` stamp `updatedAt` on `audioBookmarks.add` cause a Supabase upload failure?** Yes — `toSnakeCase` converts `updatedAt → updated_at` and includes it in the INSERT payload. Since `audio_bookmarks` has no `updated_at` column, Supabase would reject the insert. Resolution: add `stripFields: ['updatedAt']` to the `audioBookmarks` registry entry. This reuses the existing field-stripping mechanism from `tableRegistry.ts` without touching the upload engine.

- **Does the download engine need to change for `audioBookmarks`?** Yes. `_doDownload()` unconditionally queries `.order('updated_at').gte('updated_at', cursor)`. Since `audio_bookmarks` has no `updated_at` column, this query will return a Supabase column-not-found error (silently skipped). Resolution: add `cursorField?: string` to `TableRegistryEntry` and update `_doDownload()` to use `entry.cursorField ?? 'updated_at'` for both the `.order()` and `.gte()` calls.

- **Should `audioBookmarks` use `conflictStrategy: 'lww'` or `'insert-only'`?** `'insert-only'` — the table is append-only, has no `updated_at`, and the upload engine's `INSERT ... ON CONFLICT DO NOTHING` path is the correct upload strategy. The current `'lww'` setting is a pre-wiring placeholder.

### Deferred to Implementation

- Whether Supabase RLS on `audio_bookmarks` correctly scopes to `user_id` — verifiable only with a live Supabase instance (depends on E93-S01 being applied).
- Whether `db.transaction('rw', db.audioClips, ...)` in `reorderClips` correctly wraps `syncableWrite` calls — `syncableWrite` opens its own Dexie table references internally. If Dexie throws a "table not in transaction" error, the transaction scope may need to include `db.syncQueue`. Investigate during implementation.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
audioBookmarks INSERT path:
  BookmarkButton.handleBookmark()
    → syncableWrite('audioBookmarks', 'add', record)
      → db.audioBookmarks.add({ ...record, userId, updatedAt })   [Dexie]
      → db.syncQueue.add({ operation: 'add', tableName: 'audioBookmarks' })  [if authed]
      → syncEngine.nudge()
  Upload engine: INSERT ... ON CONFLICT DO NOTHING (insertOnly=true)
    → toSnakeCase strips 'updatedAt' via stripFields   [new]

audioBookmarks download path (cursor override):
  _doDownload() for audioBookmarks entry
    → cursorField = entry.cursorField ?? 'updated_at'  = 'created_at'  [new]
    → supabase.from('audio_bookmarks').select('*').order('created_at').gte('created_at', cursor)
    → _applyRecord: insert-only → db.audioBookmarks.add() / skip if exists

audioClips write path:
  useAudioClipStore.addClip()
    → persistWithRetry(() => syncableWrite('audioClips', 'put', clip))
  useAudioClipStore.updateClipTitle()
    → existing = await db.audioClips.get(clipId)
    → persistWithRetry(() => syncableWrite('audioClips', 'put', { ...existing, title }))
  useAudioClipStore.deleteClip()
    → persistWithRetry(() => syncableWrite('audioClips', 'delete', clipId))
  useAudioClipStore.reorderClips()
    → db.transaction('rw', db.audioClips, db.syncQueue, async () => {
        for clip of reordered:
          existing = await db.audioClips.get(clip.id)
          await syncableWrite('audioClips', 'put', { ...existing, sortOrder })
      })
```

## Implementation Units

- [ ] **Unit 1: Type update — `AudioClip.updatedAt` + `TableRegistryEntry.cursorField`**

**Goal:** Add `updatedAt?: string` to `AudioClip` interface and `cursorField?: string` to `TableRegistryEntry` so downstream units can use them without TypeScript errors.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/lib/sync/tableRegistry.ts` (type definition only — no registry entries changed yet)

**Approach:**
- Add `updatedAt?: string // ISO 8601 — stamped by syncableWrite` to `AudioClip` interface after `createdAt`.
- Add `cursorField?: string` to the `TableRegistryEntry` interface with a JSDoc comment explaining it overrides `updated_at` in the download cursor query (used for tables like `audio_bookmarks` that have no `updated_at` column).

**Test scenarios:**
- Test expectation: none — pure type additions; verified by `npx tsc --noEmit` in Unit 7.

**Verification:**
- `npx tsc --noEmit` passes with zero errors after this unit.
- `AudioClip` in `src/data/types.ts` has `updatedAt?: string`.
- `TableRegistryEntry` in `src/lib/sync/tableRegistry.ts` has `cursorField?: string`.

---

- [ ] **Unit 2: Registry — update `audioBookmarks` entry**

**Goal:** Correct the `audioBookmarks` registry entry to reflect its append-only, `created_at`-cursor nature, and add `stripFields: ['updatedAt']` to prevent the spurious `updated_at` stamp from reaching Supabase.

**Requirements:** R2

**Dependencies:** Unit 1 (for `cursorField` type)

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts`
- Modify: `src/lib/sync/__tests__/tableRegistry.test.ts`

**Approach:**
- Change `audioBookmarks` entry:
  - `conflictStrategy`: `'lww'` → `'insert-only'`
  - Add `insertOnly: true`
  - Add `cursorField: 'created_at'`
  - Add `stripFields: ['updatedAt']`
- Add explanatory JSDoc comment to the `audioBookmarks` const explaining the append-only invariant and why `cursorField` overrides `updated_at`.
- Update `tableRegistry.test.ts`: add assertions that `audioBookmarks` has `conflictStrategy: 'insert-only'`, `insertOnly: true`, `cursorField: 'created_at'`, and `stripFields` includes `'updatedAt'`.

**Patterns to follow:**
- `studySessions` and `quizAttempts` entries in `src/lib/sync/tableRegistry.ts` for `insert-only` + `insertOnly: true` pattern.
- `importedCourses` for `stripFields` usage.

**Test scenarios:**
- Happy path: `audioBookmarks` entry has `conflictStrategy: 'insert-only'`, `insertOnly: true`, `cursorField: 'created_at'`, `stripFields` includes `'updatedAt'`.
- Happy path: `audioClips` entry remains unchanged (`conflictStrategy: 'lww'`, no `cursorField`).
- Integration: existing `tableRegistry.test.ts` assertions for other entries remain green.

**Verification:**
- `npm run test:unit -- tableRegistry` passes.
- `npx tsc --noEmit` passes.

---

- [ ] **Unit 3: Download engine — `cursorField` support in `_doDownload`**

**Goal:** Patch `_doDownload()` in `syncEngine.ts` to use `entry.cursorField ?? 'updated_at'` for both the Supabase `.order()` and `.gte()` calls, so `audioBookmarks` queries paginate on `created_at`.

**Requirements:** R3

**Dependencies:** Unit 1 (for `cursorField` type), Unit 2 (registry entry)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Modify: `src/lib/sync/__tests__/syncEngine.download.test.ts`

**Approach:**
- In `_doDownload()`, before building the Supabase query, derive `const cursorCol = entry.cursorField ?? 'updated_at'`.
- Replace the two hard-coded `'updated_at'` references in the query builder with `cursorCol`.
- The `maxUpdatedAt` variable that advances `syncMetadata.lastSyncTimestamp` must also use `cursorCol` to read the correct timestamp field from each row: `const rowTimestamp = row[cursorCol] as string | undefined`.
- No other changes to `_doDownload()`.

**Patterns to follow:**
- Existing `_doDownload()` structure in `src/lib/sync/syncEngine.ts` (lines 629–710).

**Test scenarios:**
- Happy path: when `entry.cursorField` is absent, download query uses `updated_at` column — existing behavior preserved.
- Happy path: when `entry.cursorField: 'created_at'`, download query uses `created_at` for `.order()`, `.gte()`, and cursor advancement.
- Edge case: cursor is null (first sync) — full download, no `.gte()` filter regardless of `cursorField`.
- Edge case: `cursorField: 'created_at'` and rows have `created_at` but no `updated_at` — `rowTimestamp` reads `created_at`, `maxUpdatedAt` advances correctly.
- Integration: after download of `audioBookmarks` rows, `syncMetadata` for `audioBookmarks` stores the max `created_at` value seen, not null.

**Verification:**
- `syncEngine.download.test.ts` passes with new `cursorField` test cases added.
- Existing download tests remain green.

---

- [ ] **Unit 4: Wire `useAudioClipStore` through `syncableWrite`**

**Goal:** Replace all direct `db.audioClips.*` write calls in `useAudioClipStore` with `syncableWrite` wrapped in `persistWithRetry`. Zero direct Dexie write calls for `audioClips` after this unit.

**Requirements:** R7, R8, AC7

**Dependencies:** Unit 1 (`updatedAt` field on `AudioClip`)

**Files:**
- Modify: `src/stores/useAudioClipStore.ts`

**Approach:**
- Import `syncableWrite` from `@/lib/sync/syncableWrite` and `persistWithRetry` from `@/lib/persistWithRetry`.
- `addClip`: replace `await db.audioClips.put(clip)` with `await persistWithRetry(() => syncableWrite('audioClips', 'put', clip))`.
- `updateClipTitle`: replace `await db.audioClips.update(clipId, { title })` with fetch-then-put — `const existing = await db.audioClips.get(clipId); if (!existing) return; await persistWithRetry(() => syncableWrite('audioClips', 'put', { ...existing, title }))`.
- `deleteClip`: replace `await db.audioClips.delete(clipId)` with `await persistWithRetry(() => syncableWrite('audioClips', 'delete', clipId))`.
- `reorderClips`: convert the transaction body to use fetch-then-put via `syncableWrite`. Expand the transaction scope to include `db.syncQueue` (in addition to `db.audioClips`) to avoid a Dexie "table not in transaction" error when `syncableWrite` inserts queue entries inside the transaction. Each clip: `const existing = await db.audioClips.get(clip.id); if (existing) await syncableWrite('audioClips', 'put', { ...existing, sortOrder: clip.sortOrder })`.
- Remove the `const now = () => ...` helper if no longer used after wiring.
- Keep all optimistic update / rollback logic unchanged.

**Patterns to follow:**
- `src/stores/useHighlightStore.ts` — `createHighlight`, `updateHighlight`, `deleteHighlight` with `persistWithRetry(() => syncableWrite(...))`.
- `src/stores/useVocabularyStore.ts` — fetch-then-put pattern for `advanceMastery`.

**Test scenarios:**
- Happy path: `addClip` authenticated → Dexie record present, `syncQueue` has `{ tableName: 'audioClips', operation: 'put', status: 'pending' }`.
- Happy path: `updateClipTitle` authenticated → `syncQueue` has `put` entry with updated `title` in payload.
- Happy path: `deleteClip` authenticated → Dexie record absent, `syncQueue` has `{ operation: 'delete', payload: { id: clipId } }`.
- Happy path: `reorderClips` on 3 clips → 3 `put` entries in `syncQueue`, each with updated `sortOrder`.
- Edge case: `updateClipTitle` on non-existent `clipId` → no queue entry, no error thrown.
- Edge case: `deleteClip` on non-existent `clipId` → no queue entry (Dexie delete is a no-op for missing keys), no error.
- Error path: `addClip` with Dexie write failure → optimistic state rolled back, toast error shown, error rethrown.
- Unauthenticated: `addClip` with `user: null` → Dexie record present, zero `audioClips` queue entries.

**Verification:**
- Zero `db.audioClips.put/add/update/delete` direct calls remain in `useAudioClipStore.ts`.
- `npm run test:unit -- p1-audio-bookmarks-clips-sync` passes.

---

- [ ] **Unit 5: Wire `audioBookmarks` INSERT in `BookmarkButton` + document local-only exceptions**

**Goal:** Route the `db.audioBookmarks.add(record)` INSERT call through `syncableWrite`. Mark all `db.audioBookmarks.update(...)` and `db.audioBookmarks.delete(...)` calls with explanatory comments documenting why they remain local-only.

**Requirements:** R4, R5, R6, AC4, AC8

**Dependencies:** Unit 2 (registry entry correct before wiring)

**Files:**
- Modify: `src/app/components/audiobook/BookmarkButton.tsx`
- Modify: `src/app/components/audiobook/BookmarkListPanel.tsx`
- Modify: `src/app/components/audiobook/PostSessionBookmarkReview.tsx`

**Approach:**

**BookmarkButton.tsx:**
- Import `syncableWrite` from `@/lib/sync/syncableWrite`.
- In `handleBookmark()`, replace `await db.audioBookmarks.add(record)` with `await syncableWrite('audioBookmarks', 'add', record)`.
- The `db.audioBookmarks.delete(existing.id)` at the toggle-off branch is a hard delete — keep as direct Dexie call. Add comment: `// sync: local-only — audioBookmarks insertOnly; delete not propagated to Supabase`.
- The `db.audioBookmarks.update(pendingId, { note: trimmed })` in `handleSaveNote()` — keep as direct Dexie call. Add comment: `// sync: local-only — audio_bookmarks has no updated_at column; note edits cannot be LWW-synced`.

**BookmarkListPanel.tsx:**
- `handleDelete` uses `db.audioBookmarks.delete(id)` — keep as direct Dexie call. Add comment: `// sync: local-only — audioBookmarks insertOnly; hard deletes are not propagated to Supabase`.

**PostSessionBookmarkReview.tsx:**
- `handleNoteSave` uses `db.audioBookmarks.update(id, { note: trimmed || undefined })` — keep as direct Dexie call. Add comment: `// sync: local-only — audio_bookmarks has no updated_at column; note edits cannot be LWW-synced`.

**Patterns to follow:**
- E93-S06: `BookHighlights` component-level write wiring for import pattern.
- Existing `db` import in these files for the direct-Dexie read queries (read paths stay unchanged).

**Test scenarios:**
- Happy path: `syncableWrite('audioBookmarks', 'add', record)` while authenticated → `syncQueue` has `{ tableName: 'audioBookmarks', operation: 'add', status: 'pending' }`.
- Happy path: `syncableWrite('audioBookmarks', 'add', record)` unauthenticated → Dexie record present, zero `audioBookmarks` queue entries.
- Integration: `syncQueue` entry for `audioBookmarks` add has no `updated_at` field in the snake_case payload (stripped by `stripFields`).

**Verification:**
- Zero un-commented `db.audioBookmarks.add(...)` calls remain without going through `syncableWrite`.
- All `db.audioBookmarks.update(...)` and `db.audioBookmarks.delete(...)` calls have the required local-only comment.

---

- [ ] **Unit 6: Register store refresh callbacks in `useSyncLifecycle`**

**Goal:** Register `audioBookmarks` (no-op) and `audioClips` (load trigger) store refresh callbacks before `fullSync()`.

**Requirements:** R9, AC6

**Dependencies:** Unit 4 (`useAudioClipStore` wired and exported)

**Files:**
- Modify: `src/app/hooks/useSyncLifecycle.ts`

**Approach:**
- Import `useAudioClipStore` from `@/stores/useAudioClipStore`.
- Add two `registerStoreRefresh` calls in the store refresh registration block (before `setStatus('syncing')` and `syncEngine.fullSync()`):
  ```
  // audioBookmarks are loaded per-book on navigation — no global loadAll exists.
  // A no-op is correct: after fullSync, the next book navigation will re-query Dexie
  // and pick up any downloaded bookmarks automatically.
  syncEngine.registerStoreRefresh('audioBookmarks', () => Promise.resolve())

  // audioClips are scoped per-book. Load with empty string so the guard
  // (isLoaded && loadedBookId === bookId) never matches '' in practice.
  // The next book navigation will reload the correct clips.
  syncEngine.registerStoreRefresh('audioClips', () =>
    useAudioClipStore.getState().loadClips('')
  )
  ```

**Patterns to follow:**
- Existing `registerStoreRefresh('bookHighlights', ...)` no-op pattern at line 73.
- Existing `registerStoreRefresh('vocabularyItems', ...)` pattern at line 75.

**Test scenarios:**
- Test expectation: none — integration-level; the effect is verified by the download engine calling the refresh callback after a `fullSync()`. The no-op for `audioBookmarks` and the `loadClips('')` guard behavior are covered by code inspection and the existing `syncEngine.download.test.ts` infrastructure.

**Verification:**
- `useSyncLifecycle.ts` has both `registerStoreRefresh` calls before the `fullSync()` invocation.
- `npx tsc --noEmit` passes.

---

- [ ] **Unit 7: Unit tests**

**Goal:** Create `p1-audio-bookmarks-clips-sync.test.ts` covering all AC10 scenarios.

**Requirements:** R10, AC10

**Dependencies:** Units 2, 4, 5 (all write wiring complete)

**Files:**
- Create: `src/lib/sync/__tests__/p1-audio-bookmarks-clips-sync.test.ts`

**Approach:**
- Follow the exact structure of `src/lib/sync/__tests__/p1-highlights-vocabulary-sync.test.ts`:
  - `import 'fake-indexeddb/auto'`
  - `beforeEach`: `Dexie.delete('ElearningDB')`, `vi.resetModules()`, seed `useAuthStore` with test user
  - `getQueueEntries(table)` helper
  - Dynamic imports (not top-level) to get fresh module instances after `resetModules`
- Describe blocks:
  - `E93-S07 sync wiring — audioBookmarks`
  - `E93-S07 sync wiring — audioClips`
  - `E93-S07 sync wiring — unauthenticated writes`

**Test scenarios:**

*audioBookmarks:*
- Happy path: `syncableWrite('audioBookmarks', 'add', record)` authenticated → Dexie record present; `syncQueue` has `{ tableName: 'audioBookmarks', operation: 'add', status: 'pending' }`.
- Happy path: `syncQueue` payload for `audioBookmarks` add does NOT contain `updated_at` key (stripped by `stripFields`).
- Unauthenticated: `syncableWrite('audioBookmarks', 'add', record)` with `user: null` → Dexie record present, zero `audioBookmarks` queue entries.

*audioClips (via `useAudioClipStore`):*
- Happy path: `addClip()` authenticated → `syncQueue` has `{ tableName: 'audioClips', operation: 'put', status: 'pending' }`.
- Happy path: `updateClipTitle()` authenticated → `syncQueue` has `put` entry; payload contains updated `title`.
- Happy path: `deleteClip()` authenticated → Dexie record absent; `syncQueue` has `{ operation: 'delete', payload: { id: clipId } }`.
- Unauthenticated: `addClip()` with `user: null` → Dexie record present, zero `audioClips` queue entries.

**Patterns to follow:**
- `src/lib/sync/__tests__/p1-highlights-vocabulary-sync.test.ts` (E93-S06) — full structure.
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` (E93-S02) — unauthenticated section pattern.

**Verification:**
- `npm run test:unit -- p1-audio-bookmarks-clips-sync` passes with all 7 test cases green.
- `npx tsc --noEmit` passes.
- `npm run lint` passes.

---

- [ ] **Unit 8: Full quality gate**

**Goal:** Confirm all quality gates pass before marking the story done.

**Requirements:** AC11

**Dependencies:** Units 1–7

**Files:** (no new files)

**Approach:**
- Run `npx tsc --noEmit` — zero errors expected.
- Run `npm run lint` — zero new errors.
- Run `npm run test:unit` — all sync tests pass.
- Run `npm run build` — clean build.

**Test scenarios:**
- Test expectation: none — this is a verification unit, not a behavioral unit.

**Verification:**
- All four commands exit with code 0.

## System-Wide Impact

- **Interaction graph:** `syncEngine.nudge()` is called after every `syncableWrite` — the upload engine will attempt to flush the new `audioBookmarks` and `audioClips` queue entries on next nudge. No new event bus emissions from this story.
- **Error propagation:** `syncableWrite` rethrows Dexie write failures to the caller (fatal). Queue insert failures are swallowed by `syncableWrite` and logged — the Dexie write has already succeeded, so the record is safe. `persistWithRetry` adds backoff on transient IDB errors.
- **State lifecycle risks:** The `reorderClips` transaction expansion (adding `db.syncQueue` to transaction scope) may surface previously-hidden issues where `syncQueue` is not declared in the Dexie schema's transaction-eligible tables. Verify the Dexie schema includes `syncQueue` in the same version as `audioClips`.
- **API surface parity:** No other components write to `audioClips` directly — `useAudioClipStore` is the single write surface. Read queries (`where`, `sortBy`) remain unchanged everywhere.
- **Integration coverage:** The insert-only upload path for `audioBookmarks` (`INSERT ... ON CONFLICT DO NOTHING`) is the same code path used for `studySessions` and `quizAttempts` — already tested by the upload engine's existing tests.
- **Unchanged invariants:** All read paths (`db.audioBookmarks.where(...)`, `db.audioClips.where(...)`) remain as direct Dexie calls and are not changed by this story.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `db.transaction('rw', db.audioClips, ...)` in `reorderClips` throws "table not in transaction" when `syncableWrite` writes to `db.syncQueue` | Expand transaction scope to include `db.syncQueue`: `db.transaction('rw', db.audioClips, db.syncQueue, async () => ...)` |
| `syncableWrite` stamps `updatedAt` on `audioBookmarks.add` — reaches Supabase as `updated_at` column reference, causing insert failure | Mitigated by `stripFields: ['updatedAt']` on the `audioBookmarks` registry entry (Unit 2) |
| Download engine queries `audio_bookmarks` with `updated_at` filter — Supabase returns column-not-found error, silently skipping all bookmark downloads | Mitigated by `cursorField: 'created_at'` + `_doDownload()` patch (Units 2, 3) |
| `useAudioClipStore.loadClips('')` registered as store refresh callback — may cause unexpected store state if `''` is ever a real bookId | The guard `if (get().isLoaded && get().loadedBookId === bookId) return` short-circuits immediately for `''` in normal usage. Empty-string book IDs are not used in the application. |
| E93-S01 RLS not yet applied — end-to-end Supabase round-trip not testable in unit tests | Unit tests use fake-indexeddb and mock Supabase; end-to-end validation deferred until E93-S01 is merged |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e93-s07-audio-bookmarks-clips-sync-requirements.md](docs/brainstorms/2026-04-18-e93-s07-audio-bookmarks-clips-sync-requirements.md)
- Related code: `src/lib/sync/syncEngine.ts` (`_doDownload` lines 629–710)
- Related code: `src/lib/sync/tableRegistry.ts` (`audioBookmarks` lines 221–227, `audioClips` lines 229–235)
- Related code: `src/stores/useHighlightStore.ts` — `persistWithRetry` + `syncableWrite` reference pattern
- Related plan: `docs/plans/2026-04-18-017-feat-e93-s06-book-highlights-vocabulary-sync-plan.md` (nearest prior art)
- lastGreenSha: `03a406cf81f78cee134ef0f8d1aaa842c66754f9`
