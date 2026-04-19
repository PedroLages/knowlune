---
title: "Embeddings Sync with pgvector (E93-S05)"
storyId: E93-S05
date: 2026-04-18
module: sync
tags: [embeddings, pgvector, sync, upload-only, supabase, dexie, vector-search]
---

# CE Requirements: Embeddings Sync with pgvector (E93-S05)

**Date:** 2026-04-18
**Story:** E93-S05
**Branch:** feature/e93-s05-embeddings-sync-pgvector

---

## Problem Statement

The `note_embeddings` Dexie table stores 1536-dimensional vectors generated client-side for semantic search. Currently these vectors are local-only — a learner's second device starts with no embeddings and must re-generate all of them before semantic search is functional. This is expensive (API calls or slow on-device inference) and creates a degraded experience on new devices.

Since embeddings are deterministic given the same note content (same input → same vector), the correct sync strategy is **upload-only**: the device that generated the embedding uploads it to Supabase's `note_embeddings` table (pgvector column), and other devices can download it instead of re-generating. There is no need for conflict resolution because:
1. Embeddings are deterministic from content.
2. Two devices generating the same embedding independently will produce identical vectors.
3. Last-write-wins with no conflict strategy is correct by definition.

---

## User Value / Goal

A learner who sets up semantic search on one device should have all note embeddings available on every other device immediately after sync — without re-running the embedding pipeline. This requires:
- A `tableRegistry` entry for `note_embeddings` with upload-only sync mode.
- Wiring all `note_embeddings` writes in `useNoteStore` (or the embedding service) through `syncableWrite`.
- Registering a store refresh callback so the local embedding index is refreshed after a full sync download.

---

## Acceptance Criteria

### AC1 — `note_embeddings` `tableRegistry` entry exists with upload-only mode
`src/lib/sync/tableRegistry.ts` has an entry for `note_embeddings`:
```ts
{
  dexieTable: 'noteEmbeddings',
  supabaseTable: 'note_embeddings',
  conflictStrategy: 'lww',
  priority: 2,
  uploadOnly: true,
  fieldMap: {
    noteId: 'note_id',
    embedding: 'embedding',
    updatedAt: 'updated_at',
  }
}
```
The `uploadOnly: true` flag instructs the sync engine's download phase to skip this table entirely — no rows are pulled from Supabase to Dexie during download. Upload still proceeds normally.

### AC2 — `syncableWrite` used for all `note_embeddings` writes
All writes to the `noteEmbeddings` Dexie table (add, put, delete) in the embedding service or note store are replaced with `syncableWrite('noteEmbeddings', operation, payload)`. When authenticated, a `syncQueue` entry is created. When unauthenticated, only the Dexie write happens — no error is thrown.

### AC3 — Zero direct Dexie write calls remain for `noteEmbeddings`
After wiring, the embedding service / note store contains no `db.noteEmbeddings.add/put/delete` calls. Read calls (`db.noteEmbeddings.toArray()`, `db.noteEmbeddings.get()`, `db.noteEmbeddings.where(...)`) remain unchanged.

### AC4 — Store refresh callback registered in `useSyncLifecycle`
`src/app/hooks/useSyncLifecycle.ts` registers before `fullSync()`:
```ts
syncEngine.registerStoreRefresh('noteEmbeddings', () =>
  useNoteStore.getState().loadEmbeddings?.() ?? Promise.resolve()
)
```
If `useNoteStore` has no `loadEmbeddings` method, the callback is a no-op (`() => Promise.resolve()`). Document the decision inline.

### AC5 — Upload phase correctly serialises the `embedding` vector
The upload phase must serialise the `embedding` field (a `Float32Array` or `number[]` in Dexie) as a Postgres-compatible vector literal (`[v1,v2,...,v1536]` string) before inserting into Supabase. The `fieldMap` entry in AC1 may need a custom serialiser, or the upload worker must coerce the type. The serialised form must be accepted by the `note_embeddings.embedding vector(1536)` column (pgvector HNSW index already exists from E93-S01).

### AC6 — `uploadOnly` flag respected by download phase
The sync engine's download/apply phase skips all tables where `uploadOnly: true`. No rows from `note_embeddings` are downloaded to Dexie during a pull cycle. This is by design: the device generates its own embeddings from content (or uploads the ones it already has); it never overwrites local embeddings with remote copies.

### AC7 — Unauthenticated writes persist locally only
When `user` is null, all `noteEmbeddings` mutations write to Dexie but create no `syncQueue` entries and make no Supabase requests. No errors are thrown.

### AC8 — Unit tests
New file `src/lib/sync/__tests__/p1-embeddings-sync.test.ts` covering:
- `syncableWrite('noteEmbeddings', 'add', payload)` while authenticated → `syncQueue` entry created with `tableName: 'noteEmbeddings'`, `operation: 'add'`
- Same write while unauthenticated → Dexie write, no queue entry
- `syncableWrite('noteEmbeddings', 'delete', id)` while authenticated → `syncQueue` entry with `operation: 'delete'`
- Download phase does NOT process `noteEmbeddings` rows (verify `uploadOnly` guard)
- Vector serialisation: `Float32Array` input produces a `[v1,v2,...]` string in the upload payload

### AC9 — TypeScript clean
`npx tsc --noEmit` passes with zero errors after all changes.

---

## Technical Context and Constraints

### `note_embeddings` Table Already Exists (E93-S01)
The Supabase `note_embeddings` table was created in E93-S01 (`supabase/migrations/20260413000002_p1_learning_content.sql`) with:
- `id UUID PRIMARY KEY`
- `user_id UUID REFERENCES auth.users`
- `note_id UUID REFERENCES notes(id) ON DELETE CASCADE`
- `embedding vector(1536)` — pgvector column with HNSW index
- `updated_at TIMESTAMPTZ`

No new migration is needed for this story.

### Upload-Only Rationale
Embeddings are deterministic: the same note content always produces the same vector (for a given model/version). Therefore:
- Two devices generating the same embedding produce the same vector → LWW is correct.
- Downloading embeddings is unnecessary if the device can re-generate them locally from content.
- However, uploading allows other devices to skip generation entirely — a significant UX improvement.
- There is no meaningful "conflict" scenario for embeddings → no conflict strategy needed.

### tableRegistry `uploadOnly` Flag
The `TableRegistryEntry` type in `src/lib/sync/tableRegistry.ts` may not yet have an `uploadOnly` field. If absent, add it as an optional boolean:
```ts
uploadOnly?: boolean
```
The download phase already checks per-table config — add a guard:
```ts
if (entry.uploadOnly) continue  // skip download for this table
```

### `syncableWrite` Pattern (E92-S04)
Same pattern used across all P0 and P1 stores. Import from `src/lib/sync/syncableWrite.ts`. Wraps the Dexie write, stamps `userId` and `updatedAt`, enqueues if authenticated.

### Embedding Service Location
The embedding generation code likely lives in one of:
- `src/lib/embeddingService.ts`
- `src/lib/aiEmbedding.ts`
- `src/stores/useNoteStore.ts` (inline in note save flow)

Locate all `db.noteEmbeddings` write calls before wiring. Use Grep across `src/` to find them.

### Vector Serialisation for pgvector
pgvector accepts vectors as either:
- A JavaScript `number[]` (Supabase JS client may handle this via JSON)
- A string literal: `'[0.1,0.2,...,0.9]'`

If the Dexie field is stored as `Float32Array`, convert with `Array.from(embedding)` before inserting. Confirm the Supabase client handles `number[]` directly or apply explicit serialisation in the upload worker.

### `persistWithRetry` Pattern
Wrap all `syncableWrite` calls in `persistWithRetry` for consistent retry behavior, matching the pattern from E93-S02 and E93-S04.

### ES2020 Constraints
No `Promise.any`. `Promise.allSettled` is acceptable. All async paths must propagate or explicitly handle errors. Queue insert failures inside `syncableWrite` are already swallowed — do not re-throw them.

---

## Dependencies

- **E92-S03 (done):** `tableRegistry.ts` exists. `noteEmbeddings` entry must be added in this story (if not already present).
- **E92-S04 (done):** `syncableWrite` function exists at `src/lib/sync/syncableWrite.ts`.
- **E92-S05 (done):** Upload phase processes `syncQueue` entries — handles `noteEmbeddings` uploads automatically once the registry entry exists.
- **E92-S06 (done):** Download phase must be updated to skip `uploadOnly` tables.
- **E92-S09 (done):** P0 stores wired — reference implementation.
- **E93-S01 (in-progress):** `note_embeddings` Supabase table with HNSW index and RLS. Must be applied before end-to-end testing against real Supabase.
- **E93-S02 (done):** Notes/bookmarks wiring — nearest reference for `syncableWrite` pattern.

---

## Out of Scope

- **Download direction for embeddings:** Embeddings are never downloaded from Supabase to Dexie. The device either already has them (locally generated) or will re-generate them from content. Download is upload-only by design.
- **Conflict resolution:** No conflict strategy is needed. Embeddings are deterministic — LWW is always correct.
- **Embedding regeneration triggers:** When note content changes and the embedding becomes stale, re-generation and re-upload is handled by the existing embedding pipeline. This story only wires the write path — it does not change when generation occurs.
- **Bulk backfill on first sync:** Uploading all existing local embeddings on first login is handled by the E92 upload phase (it drains the full `syncQueue`). Backfilling old embeddings not yet in `syncQueue` is a separate concern deferred to a future story or the E97 initial upload wizard.
- **pgvector similarity search changes:** The existing `useNoteStore` semantic search queries Dexie directly. This story does not change the search path — it only ensures that locally-generated embeddings are uploaded to Supabase.
- **UI changes:** Pure infrastructure story. No new components, no design review required.
- **`uploadOnly` tables in incremental sync cursor:** The `lastSyncTimestamp` cursor is only updated for downloaded tables. `uploadOnly` tables do not advance the cursor (they have no download phase). Document this in the implementation.

---

## Implementation Hints

1. **Locate all `db.noteEmbeddings` write sites:** Run `grep -r "db.noteEmbeddings" src/` to find add/put/delete calls.
2. **Add `uploadOnly` to `TableRegistryEntry` type** (if absent) and add the `noteEmbeddings` entry to `tableRegistry.ts` (AC1).
3. **Guard download phase** against `uploadOnly: true` tables (AC6).
4. **Wire write sites** with `syncableWrite` inside `persistWithRetry` (AC2, AC3).
5. **Handle vector serialisation** — confirm `number[]` works directly with Supabase client; if not, add `Array.from(embedding)` coercion in the upload worker's field serialiser (AC5).
6. **Register store refresh callback** in `useSyncLifecycle.ts` (AC4).
7. **Write unit tests** in `src/lib/sync/__tests__/p1-embeddings-sync.test.ts` (AC8).
8. **Verification:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Key Files

| File | Role |
|------|------|
| `src/lib/sync/tableRegistry.ts` | Add `noteEmbeddings` entry with `uploadOnly: true` |
| `src/lib/sync/syncableWrite.ts` | The write wrapper (E92-S04) |
| `src/lib/sync/syncEngine.ts` | Add `uploadOnly` guard in download/apply phase |
| `src/app/hooks/useSyncLifecycle.ts` | Register store refresh callback |
| `src/lib/embeddingService.ts` (or similar) | Wire `db.noteEmbeddings` writes via `syncableWrite` |
| `src/stores/useNoteStore.ts` | May contain inline `noteEmbeddings` writes |
| `src/lib/sync/__tests__/p0-sync.test.ts` | Test pattern reference |
| `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` | Nearest test pattern (E93-S02) |
| `src/data/types.ts` | `NoteEmbedding` type for shape reference |

### lastGreenSha

`312af4dc0afd1c14977d7fcaa498c98d1848f32f`
