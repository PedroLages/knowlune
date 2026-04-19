---
title: "Audio Bookmarks and Audio Clips Sync (E93-S07)"
storyId: E93-S07
date: 2026-04-18
module: sync
tags: [audio-bookmarks, audio-clips, sync, lww, append-only, event-log, supabase, dexie, syncable-write]
---

# CE Requirements: Audio Bookmarks and Audio Clips Sync (E93-S07)

**Date:** 2026-04-18
**Story:** E93-S07
**Branch:** feature/e93-s07-audio-bookmarks-clips-sync

---

## Problem Statement

`audio_bookmarks` and `audio_clips` tables exist in Supabase (created in E93-S01), and their Dexie counterparts `audioBookmarks` and `audioClips` are registered in the tableRegistry. However, none of the audiobook write sites route through `syncableWrite` — all mutations still call Dexie directly via `db.audioBookmarks.*` and `db.audioClips.*` in scattered component files.

Key asymmetry:
- **`audio_bookmarks`**: Immutable event log — no `updatedAt` column. Records are INSERT-only. The `audio_bookmarks` Supabase table has **no `updated_at` column** and the Dexie `AudioBookmark` type has **no `updatedAt` field**. Sync must use cursor-based pagination on `created_at`, not `updated_at`. This is the same pattern as `flashcard_reviews`.
- **`audio_clips`**: Standard LWW with `updatedAt`. Records can be updated (title rename) and reordered. Uses the standard `syncableWrite` pattern with `updatedAt` stamping.

---

## User Value / Goal

A learner who saves audiobook bookmarks and creates clips on one device should see all their bookmarks and clips when they open Knowlune on another device. Clips should reflect the latest title edits and sort order.

---

## Acceptance Criteria

### AC1 — `audioBookmarks` tableRegistry entry is correct
`src/lib/sync/tableRegistry.ts` entry for `audioBookmarks` already exists (from E92-S03). Verify and confirm:
```ts
{
  dexieTable: 'audioBookmarks',
  supabaseTable: 'audio_bookmarks',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}
```
**Critical note**: `audio_bookmarks` has **no `updated_at` column** in Supabase and no `updatedAt` field on `AudioBookmark`. The sync engine must use `created_at` as the cursor for incremental sync, NOT `updated_at`. Verify the tableRegistry or sync engine correctly handles this table as a `created_at`-cursor table (same mechanism as `flashcard_reviews`).

### AC2 — `audioClips` tableRegistry entry is correct
`src/lib/sync/tableRegistry.ts` entry for `audioClips` already exists (from E92-S03). Verify and confirm:
```ts
{
  dexieTable: 'audioClips',
  supabaseTable: 'audio_clips',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}
```
`AudioClip` has no `updatedAt` field in `src/data/types.ts`. `syncableWrite` will stamp `updatedAt` on writes. The `AudioClip` interface must be updated to add `updatedAt?: string` to accept the stamped value. Verify no migration is needed — the v52 Dexie upgrade already handles this for existing records.

### AC3 — `AudioClip` type gets `updatedAt` field
The `AudioClip` interface in `src/data/types.ts` must add:
```ts
updatedAt?: string // ISO 8601 — stamped by syncableWrite (E92-S04)
```
This is needed because `syncableWrite` stamps `updatedAt` on every `put`/`add` write. `AudioBookmark` intentionally does NOT get this field (it is an append-only log with no `updated_at` on the Supabase side).

### AC4 — `audio_bookmarks` write sites route through `syncableWrite` (INSERT-only)
All `db.audioBookmarks.add(record)` calls in component files are replaced with `syncableWrite('audioBookmarks', 'add', record)`.

**Affected files** (from static analysis):
- `src/app/components/audiobook/BookmarkButton.tsx` — `db.audioBookmarks.add(record)` at the INSERT site
- Any other `db.audioBookmarks.add(...)` call sites

**What stays as-is (read paths — do NOT change):**
- `db.audioBookmarks.where(...)` — read queries in all component files remain direct Dexie calls
- `db.audioBookmarks.orderBy(...)` — same

**What requires special handling:**
- `db.audioBookmarks.delete(id)` in `BookmarkListPanel.tsx` — this is a hard delete. Audio bookmarks are an immutable event log: **deletes must NOT sync**. Route through `syncableWrite('audioBookmarks', 'delete', id)` so local Dexie delete happens, but confirm the sync engine does NOT propagate deletes for append-only tables. Alternatively, if the sync engine cannot suppress delete propagation per-table, keep the delete as a direct `db.audioBookmarks.delete(id)` (local-only) and document the decision.
- `db.audioBookmarks.update(id, { note: trimmed })` in `PostSessionBookmarkReview.tsx` — the `audio_bookmarks` table has **no `updated_at` column**, making LWW impossible. This update must remain a **local-only** direct Dexie call. Do NOT route through `syncableWrite`. Document this in the implementation as an intentional exception.
- `db.audioBookmarks.update(pendingId, { note: trimmed })` in `BookmarkButton.tsx` — same rule: local-only, direct Dexie call.

### AC5 — `audio_clips` writes in `useAudioClipStore` route through `syncableWrite`
All Dexie write calls in `src/stores/useAudioClipStore.ts` replaced with `syncableWrite`:
- `saveClip` (or equivalent add/put): replace `db.audioClips.put(clip)` with `syncableWrite('audioClips', 'put', clip)`
- `updateClipTitle`: uses `db.audioClips.update(clipId, { title })` — convert to fetch-then-put:
  ```ts
  const existing = await db.audioClips.get(clipId)
  if (!existing) return
  await syncableWrite('audioClips', 'put', { ...existing, title })
  ```
- `deleteClip`: replace `db.audioClips.delete(clipId)` with `syncableWrite('audioClips', 'delete', clipId)`
- `reorderClips`: uses `db.audioClips.update(clip.id, { sortOrder })` in a transaction — convert each update to fetch-then-put via `syncableWrite('audioClips', 'put', { ...existing, sortOrder: clip.sortOrder })`. Keep the transaction wrapper.

**Wrap in `persistWithRetry`** consistent with the E93-S02 and E93-S06 patterns.

### AC6 — Store refresh callbacks registered in `useSyncLifecycle`
`src/app/hooks/useSyncLifecycle.ts` registers before `fullSync()`:
```ts
syncEngine.registerStoreRefresh('audioBookmarks', () =>
  // audioBookmarks are loaded per-book on navigation — no global refresh needed
  Promise.resolve()
)
syncEngine.registerStoreRefresh('audioClips', () =>
  useAudioClipStore.getState().loadClipsForBook?.('') ?? Promise.resolve()
)
```
`audioBookmarks` are loaded per-book context (no global `loadAll`), so the store refresh can be a no-op `Promise.resolve()`. Document this with a comment. After `fullSync()` the next navigation to a book detail will re-query and pick up downloaded bookmarks automatically.

### AC7 — Zero direct Dexie write calls remain for `audioClips`
After this story, `useAudioClipStore.ts` contains zero `db.audioClips.put/add/update/delete` calls. Read calls (`where`, `toArray`, `sortBy`, `orderBy`) remain unchanged.

### AC8 — `audio_bookmarks` update calls documented as intentional local-only exceptions
Any `db.audioBookmarks.update(...)` calls that cannot be safely synced (due to the missing `updated_at` column in Supabase) are marked with a `// sync: local-only — audio_bookmarks has no updated_at column` comment. These are NOT routed through `syncableWrite`.

### AC9 — Unauthenticated writes persist locally only
When `user` is null, all mutations write to Dexie but create no `syncQueue` entries and make no Supabase requests. No errors thrown. Standard `syncableWrite` contract.

### AC10 — Unit tests
New file `src/lib/sync/__tests__/p1-audio-bookmarks-clips-sync.test.ts`:
- `db.audioBookmarks.add(record)` via `syncableWrite` while authenticated → `syncQueue` entry `{ tableName: 'audioBookmarks', operation: 'add' }`
- Unauthenticated `audioBookmarks` add → Dexie row exists, no `syncQueue` entry
- `useAudioClipStore.saveClip()` while authenticated → `syncQueue` entry `{ tableName: 'audioClips', operation: 'put' }`
- `useAudioClipStore.updateClipTitle()` → `syncQueue` entry `{ tableName: 'audioClips', operation: 'put' }` with updated title
- `useAudioClipStore.deleteClip()` → `syncQueue` entry `{ tableName: 'audioClips', operation: 'delete' }`
- Unauthenticated `audioClips` mutation → no `syncQueue` entries

### AC11 — TypeScript clean
`npx tsc --noEmit` passes with zero errors after all changes.

---

## Technical Context and Constraints

### `audio_bookmarks` — Append-Only Event Log (Critical Invariant)

`AudioBookmark` in `src/data/types.ts` has **no `updatedAt` field**. The Supabase `audio_bookmarks` table has **no `updated_at` column**. This is by design — audio bookmarks are an immutable event log (same as `flashcard_reviews`).

Consequences:
1. **Cursor-based sync must use `created_at`**, not `updated_at`. The sync engine's incremental download query must use `created_at > lastSyncCursor` for this table.
2. **Update operations on `audio_bookmarks` (e.g. adding a note) are local-only** — they cannot be safely synced without `updated_at`. Do NOT route `db.audioBookmarks.update(...)` through `syncableWrite`.
3. **`syncableWrite` with `'add'` operation**: Does NOT stamp `updatedAt` for add-only records. Confirm this behavior or add a guard so `audioBookmarks` inserts don't get a spurious `updatedAt` field that would be rejected by the Supabase table.

### `audio_bookmarks` Write Sites Are in Components, Not a Store

Unlike most other sync stories, `audio_bookmarks` writes are scattered across component files, not centralized in a dedicated store:
- `BookmarkButton.tsx` — `add` and (delete via toggle off)
- `BookmarkListPanel.tsx` — `delete`
- `PostSessionBookmarkReview.tsx` — `update` (note editing — local-only)
- `AudiobookRenderer.tsx` — read-only queries

The `add` calls must be routed through `syncableWrite`. The `update` calls (note editing) must remain local-only with explanatory comments.

### `audio_clips` — Standard LWW via `useAudioClipStore`

`useAudioClipStore.ts` is the single write surface for `audioClips`. All mutations are centralized. The store currently uses direct `db.audioClips.*` calls. This is the straightforward migration path.

`AudioClip` does not have `updatedAt` in `src/data/types.ts`. Add `updatedAt?: string` to the interface (AC3) before wiring the store, or TypeScript will reject the stamped record.

### `syncableWrite` Pattern (E92-S04)

Import from `src/lib/sync/syncableWrite.ts`. Wraps Dexie write, stamps `userId` and `updatedAt` (for add/put), enqueues if authenticated. Wrap in `persistWithRetry` for the clips store.

Reference implementations: E93-S02 (notes/bookmarks), E93-S06 (highlights/vocabulary).

### `persistWithRetry` and `syncableWrite` Interaction

`syncableWrite` performs the Dexie write internally. `persistWithRetry` adds exponential-backoff retry on transient IDB errors. Keep `persistWithRetry` wrapper in `useAudioClipStore` — just replace the inner `db.*` call with `syncableWrite(...)`.

### `reorderClips` Transaction Pattern

`useAudioClipStore.reorderClips` currently wraps multiple `db.audioClips.update(...)` calls in a `db.transaction('rw', db.audioClips, ...)`. After wiring, each update becomes a `syncableWrite('audioClips', 'put', fullRecord)`. The `db.transaction` wrapper can remain for atomicity on the Dexie side, but note that each `syncableWrite` inside the transaction will create a separate `syncQueue` entry. This is correct behavior.

### ES2020 Constraints

No `Promise.any`. `Promise.allSettled` acceptable. All async paths must propagate or explicitly handle errors.

### `useSyncLifecycle` Pattern (E93-S02/E93-S06)

`registerStoreRefresh` must be called before `fullSync()`. For `audioBookmarks`, a no-op `Promise.resolve()` is the correct callback because the data is loaded per-book on navigation. For `audioClips`, `loadClipsForBook` requires a `bookId` — register with empty string or a no-op and document the limitation.

---

## Dependencies

- **E92-S03 (done):** `tableRegistry.ts` exists with `audioBookmarks` and `audioClips` entries.
- **E92-S04 (done):** `syncableWrite` function exists at `src/lib/sync/syncableWrite.ts`.
- **E92-S05 (done):** Upload phase processes `syncQueue` entries, LWW strategy.
- **E92-S06 (done):** Download/apply phase applies LWW strategy per registry config.
- **E92-S09 (done):** P0 stores wired — reference implementation.
- **E93-S01 (in-progress):** `audio_bookmarks` and `audio_clips` Supabase tables with RLS. Must be applied before end-to-end testing against real Supabase.
- **E93-S02 (done):** Notes/bookmarks wiring — nearest reference for `syncableWrite` pattern.
- **E93-S06 (done/in-progress):** Book highlights/vocabulary wiring — reference for component-level write sites.

---

## Out of Scope

- **New migration**: No Supabase migration needed — tables exist from E93-S01.
- **tableRegistry changes**: Both entries already exist — no modifications expected.
- **UI changes**: Pure infrastructure story. No new components, no design review required.
- **`audio_bookmarks` note-editing sync**: The `note` field on `AudioBookmark` cannot be synced because there is no `updated_at` column. Note edits remain local-only (intentional exception, documented with comments).
- **`audio_bookmarks` delete sync**: Hard deletes of bookmarks are local-only unless the sync engine supports per-table delete suppression. Determine the correct behavior and document.
- **Backfill of existing records**: Pre-existing records not in `syncQueue` are handled by E97's initial upload wizard.
- **ABS (Audiobookshelf) integration**: ABS-sourced bookmarks (E101-E102) follow a different sync path (bidirectional with ABS server). This story only concerns local Knowlune bookmarks stored in Dexie.

---

## Implementation Hints

1. **Locate all `db.audioBookmarks` write sites**: Look at `BookmarkButton.tsx`, `BookmarkListPanel.tsx`, `PostSessionBookmarkReview.tsx`, `AudiobookRenderer.tsx`, `BookReader.tsx`.
2. **Locate all `db.audioClips` write sites**: All in `useAudioClipStore.ts`.
3. **Add `updatedAt?: string` to `AudioClip`** in `src/data/types.ts` first (AC3).
4. **Wire `audioClips` in `useAudioClipStore`** (AC5): `saveClip/put`, `updateClipTitle` (fetch-then-put), `deleteClip`, `reorderClips` (fetch-then-put loop).
5. **Wire `audioBookmarks` INSERT** in `BookmarkButton.tsx` (AC4): replace `db.audioBookmarks.add(record)` with `syncableWrite('audioBookmarks', 'add', record)`.
6. **Mark `audioBookmarks` update calls** as local-only (AC8).
7. **Register store refresh callbacks** in `useSyncLifecycle.ts` (AC6).
8. **Write unit tests** in `src/lib/sync/__tests__/p1-audio-bookmarks-clips-sync.test.ts` (AC10).
9. **Verification**: `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Key Files

| File | Role |
|------|------|
| `src/stores/useAudioClipStore.ts` | Wire `db.audioClips` writes via `syncableWrite` |
| `src/app/components/audiobook/BookmarkButton.tsx` | Wire `db.audioBookmarks.add` via `syncableWrite` |
| `src/app/components/audiobook/BookmarkListPanel.tsx` | Wire `db.audioBookmarks.delete` or keep local-only |
| `src/app/components/audiobook/PostSessionBookmarkReview.tsx` | Mark `db.audioBookmarks.update` as local-only |
| `src/lib/sync/tableRegistry.ts` | Verify `audioBookmarks` and `audioClips` entries (no changes expected) |
| `src/lib/sync/syncableWrite.ts` | The write wrapper (E92-S04) |
| `src/app/hooks/useSyncLifecycle.ts` | Register store refresh callbacks |
| `src/data/types.ts` | Add `updatedAt?: string` to `AudioClip` (AC3) |
| `src/lib/sync/__tests__/p1-highlights-vocabulary-sync.test.ts` | Nearest test pattern (E93-S06) |

### lastGreenSha

`03a406cf81f78cee134ef0f8d1aaa842c66754f9`
