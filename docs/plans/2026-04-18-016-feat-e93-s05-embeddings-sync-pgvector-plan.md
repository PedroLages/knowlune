---
title: "feat: Wire embeddings table to Supabase sync (upload-only, pgvector)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e93-s05-embeddings-sync-pgvector-requirements.md
---

# feat: Wire embeddings table to Supabase sync (upload-only, pgvector)

## Overview

The `embeddings` Dexie table stores 384-dimensional vectors generated client-side for semantic search.
These vectors are currently local-only. This story wires the table into the sync engine as
**upload-only**: device generates embedding → uploads to Supabase `embeddings` table (pgvector column).
Other devices can then skip regeneration by having the vector available remotely.

No download direction is needed — each device either already has the embedding locally (generated it)
or will regenerate it. Uploading avoids expensive re-generation on a new device.

## Problem Frame

A learner who sets up semantic search on Device A uploads all note embeddings to Supabase.
Device B signs in and finds all embeddings already present — no re-generation API calls needed.
Without this story, Device B must regenerate every embedding before semantic search works.

The `embeddings` table is already registered in `tableRegistry.ts` with a generic LWW entry, but:
- It has no `uploadOnly` flag — the download phase will query Supabase and try to apply rows.
- The write sites in `vector-store.ts` call `db.embeddings.put/delete` directly, bypassing `syncableWrite`.
- The `fieldMap` does not handle the `embedding → vector` column name mismatch.
- The PK mismatch between Dexie (`noteId`) and Supabase (`id UUID`) needs resolution.

**Naming clarification:** The requirements document references `noteEmbeddings`/`note_embeddings` but
the actual Dexie table is named `embeddings` and the Supabase table is also `embeddings`. This plan
targets those existing names throughout. The `noteEmbeddings` name in the AC comments is an
aspirational alias that does not match any current schema object.

(see origin: docs/brainstorms/2026-04-18-e93-s05-embeddings-sync-pgvector-requirements.md)

## Requirements Trace

- R1. `tableRegistry` entry for `embeddings` updated with `uploadOnly: true` and correct `fieldMap`.
- R2. `TableRegistryEntry` type extended with optional `uploadOnly?: boolean` field.
- R3. Download phase (`_doDownload` in `syncEngine.ts`) skips tables where `uploadOnly: true`.
- R4. All `db.embeddings.put/delete` write sites in `vector-store.ts` replaced with `syncableWrite`.
- R5. Unauthenticated writes persist locally only — no `syncQueue` entries, no errors thrown.
- R6. Store refresh callback for `embeddings` registered in `useSyncLifecycle.ts`.
- R7. Upload payload correctly serialises the `embedding: number[]` field to `vector` column format.
- R8. Unit tests in `src/lib/sync/__tests__/p1-embeddings-sync.test.ts` cover all key behaviors.
- R9. TypeScript clean — `npx tsc --noEmit` passes with zero errors.
- R10. `tableRegistry.test.ts` updated to reflect the `embeddings` entry changes.

## Scope Boundaries

- No migration changes — `embeddings` Supabase table exists from E93-S01.
- No download of embeddings from Supabase to Dexie (upload-only by design).
- No conflict resolution strategy — LWW is trivially correct for deterministic vectors.
- No changes to semantic search query paths (`vectorStorePersistence.getStore()`).
- No regeneration trigger changes — when note content changes, re-generation is handled by the existing pipeline; this story only wires the write path.
- No bulk backfill of embeddings not yet in `syncQueue` — handled by E97 initial upload wizard.
- No UI changes — pure infrastructure.

### Deferred to Separate Tasks

- `uploadOnly` tables and the `lastSyncTimestamp` cursor: upload-only tables have no download phase and do not advance the cursor. Document this invariant inline. A formal cursor-skip mechanism can be added when E97 adds more upload-only tables.
- Unique constraint on `(user_id, note_id)` in Supabase `embeddings` table: currently absent — the upsert conflict target must be `note_id` via a dedicated RPC or a migration adding a unique index. Deferred to a follow-up migration; for now use upsert with the `id` field generated client-side (see Key Technical Decisions).

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/tableRegistry.ts` — existing `embeddings` entry (lines 166–172); `TableRegistryEntry` interface (lines 25–69). `uploadOnly` field is absent and must be added.
- `src/ai/vector-store.ts` — the only write site for `db.embeddings`. `saveEmbedding` calls `db.embeddings.put`; `removeEmbedding` calls `db.embeddings.delete`. Both must be replaced with `syncableWrite`.
- `src/ai/embeddingPipeline.ts` — thin orchestrator that calls `vectorStorePersistence.saveEmbedding` and `vectorStorePersistence.removeEmbedding`. No direct Dexie calls here; changes flow through `vector-store.ts`.
- `src/lib/sync/syncableWrite.ts` — canonical write wrapper. Stamps `userId`/`updatedAt`, writes Dexie, enqueues if authenticated.
- `src/lib/sync/syncEngine.ts` — `_doDownload` (line 617) iterates `tableRegistry` with only a `skipSync` guard today. The `uploadOnly` guard must be added here.
- `src/app/hooks/useSyncLifecycle.ts` — registers store refresh callbacks before `fullSync()` (lines 49–65). Pattern: `syncEngine.registerStoreRefresh('tableName', () => store.getState().loadFn())`.
- `src/lib/persistWithRetry.ts` — retry wrapper used by all write paths.
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — nearest test reference (E93-S02 pattern).
- `src/lib/sync/__tests__/tableRegistry.test.ts` — existing registry completeness check asserts exactly 38 entries. Adding `uploadOnly` to the `embeddings` entry will not change the count (entry already exists).
- `src/data/types.ts` line 361 — `Embedding` type: `{ noteId: string; embedding: number[]; createdAt: string }`. No `id` or `updatedAt` field currently.

### Institutional Learnings

- **E93-S02 stale-closure rule**: When any `await` separates a state read from a Zustand `set()`, use the functional `set(state => ...)` form. `vector-store.ts` does not use Zustand directly, so this does not apply here, but it is relevant if `useNoteStore` wires embedding writes in the future.
- **syncableWrite error contract**: Dexie write failure → rethrow (fatal). Queue insert failure → log + swallow (non-fatal). `vector-store.ts` already wraps writes in try/catch for non-blocking behavior; the `syncableWrite` contract preserves this by not throwing on queue failure.
- **Dexie 4**: `sortBy` returns `Promise<T[]>`, async upgrades cannot read auth. Use `toArray()` + manual sort as the safe path.

### External References

- pgvector upsert: Supabase JS client accepts `number[]` as a JSON array for `vector` columns. No manual `[v1,v2,...]` string serialization needed when the value is already `number[]`. Confirmed by Supabase JS library behavior (passes array directly to Postgres).

## Key Technical Decisions

- **Naming**: Target `embeddings` (Dexie) / `embeddings` (Supabase) throughout. The `noteEmbeddings` name in the requirements doc is an artifact; no rename is performed.

- **`uploadOnly` flag placement**: Add `uploadOnly?: boolean` to `TableRegistryEntry` and set `uploadOnly: true` on the `embeddings` entry. Add `if (entry.uploadOnly) continue` guard immediately after the `skipSync` guard in `_doDownload`. This is the minimal surgical change — no broader refactor of the download phase.

- **PK mismatch resolution**: Dexie `Embedding` type has `noteId` as PK; Supabase `embeddings` has `id UUID` as PK. To support idempotent upserts, `syncableWrite` will receive records stamped with a deterministic `id` (UUID derived or generated once per embedding write). The approach: generate `id = crypto.randomUUID()` inside `VectorStorePersistence.saveEmbedding` and persist it alongside `noteId` in Dexie. This requires adding an optional `id?: string` field to the `Embedding` type. For existing records without `id`, the upload phase will generate one at write time via `crypto.randomUUID()` inside `saveEmbedding`. The `fieldMap` entry ensures `noteId → note_id` maps correctly.

- **Vector field name**: The Dexie field is `embedding: number[]`; the Supabase column is `vector`. The `fieldMap` must declare `embedding: 'vector'` to rename it during `toSnakeCase`. The Supabase JS client accepts `number[]` for pgvector columns — no manual string conversion needed.

- **`model` field**: The Dexie `Embedding` type does not currently include a `model` field, but the Supabase column `model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2'` has a default. The upload payload can omit `model` (Supabase default applies) or the implementation can pass a hardcoded string. Decision: omit for now; the Supabase default handles it. If the embedding model ever changes, a fieldMap entry can be added.

- **`createdAt` → `created_at`**: Auto-converted by `camelToSnake`. No explicit fieldMap needed.

- **`updatedAt` stamping**: `syncableWrite` stamps `updatedAt` automatically on every write. The `Embedding` type does not currently have `updatedAt`, but `syncableWrite` adds it. The Supabase table has `updated_at` (managed by a trigger). Since `syncableWrite` stamps `updatedAt`, it will appear in the upload payload as `updated_at` — this is fine; the trigger will update it on any subsequent server-side `UPDATE` anyway.

- **Upload-only cursor**: Upload-only tables have no download phase, so the `lastSyncTimestamp` cursor is never written for `embeddings`. This is correct behavior. Document inline in `_doDownload`.

- **Store refresh callback**: `vectorStorePersistence.loadAll()` is the correct reload function. It re-hydrates the in-memory `BruteForceVectorStore` from Dexie. Since `embeddings` is upload-only (no downloads applied), this callback will almost always be a no-op — but registering it is correct for API symmetry and future-proofing if the upload-only decision is ever reversed.

## Open Questions

### Resolved During Planning

- **Which Dexie table?** `embeddings` (not `noteEmbeddings`). The requirements doc used an aspirational name that does not match the schema.
- **Vector dimensions**: The migration creates `vector(384)` (all-MiniLM-L6-v2), not `vector(1536)`. The requirements doc mentioned 1536 — this was aspirational (OpenAI-style). Current codebase uses 384-dim local model.
- **Does `number[]` work with Supabase JS for pgvector?** Yes — the Supabase client serializes `number[]` as a JSON array which pgvector accepts for `vector` columns.
- **Is there a unique constraint on `note_id`?** No. The `embeddings` table only has `id UUID PRIMARY KEY`. Upserts must target `id` — which requires the client to generate and persist `id` alongside `noteId` (see PK mismatch decision above).
- **Does the existing `embeddings` registry entry need to be replaced or updated?** Updated in-place — entry already exists, just needs `uploadOnly: true`, correct `fieldMap`, and the `uploadOnly` type addition.

### Deferred to Implementation

- **Exact `id` generation site**: Whether `id` is generated in `saveEmbedding`, in `syncableWrite`, or via a migration adding a computed column. The plan recommends generating in `saveEmbedding` — implementer should confirm and adjust if a cleaner pattern emerges.
- **Existing `Embedding` records without `id`**: The Dexie schema upgrade version number and migration step to backfill `id` on existing records. This is an ES2020-safe Dexie migration (no `Promise.any`).
- **`updatedAt` field on `Embedding` type**: `syncableWrite` stamps it but the TypeScript type doesn't declare it. The implementer should decide whether to add `updatedAt?: string` to `Embedding` in `types.ts` or cast to `SyncableRecord`.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
VectorStorePersistence.saveEmbedding(noteId, embedding)
  │
  ├─ 1. Insert to in-memory BruteForceVectorStore (throws on dim mismatch)
  │
  ├─ 2. Build Dexie record: { id: uuid, noteId, embedding, createdAt }
  │
  └─ 3. syncableWrite('embeddings', 'put', record)
         │
         ├─ Stamps userId + updatedAt
         ├─ Writes to db.embeddings (Dexie)
         └─ If authenticated: enqueues SyncQueueEntry
              payload = toSnakeCase(entry, record)
              → { id, note_id, vector: [f1…f384], user_id, updated_at }
              → Upload phase sends to supabase.from('embeddings').upsert(payload, {onConflict: 'id'})

VectorStorePersistence.removeEmbedding(noteId)
  │
  ├─ 1. db.embeddings.where('noteId').equals(noteId).first() → get id
  ├─ 2. syncableWrite('embeddings', 'delete', id)
  └─ 3. Remove from in-memory store

_doDownload (syncEngine.ts)
  for (const entry of tableRegistry) {
    if (entry.skipSync) continue
    if (entry.uploadOnly) continue  // ← new guard — skips 'embeddings'
    ...
  }
```

## Implementation Units

- [ ] **Unit 1: Add `uploadOnly` to `TableRegistryEntry` type and update `embeddings` entry**

**Goal:** Declare the `uploadOnly` optional field on the registry type, update the existing `embeddings` entry with `uploadOnly: true` and the correct `fieldMap`, and add a guard in `_doDownload`.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts`
- Modify: `src/lib/sync/syncEngine.ts`
- Modify: `src/lib/sync/__tests__/tableRegistry.test.ts`

**Approach:**
- Add `uploadOnly?: boolean` to the `TableRegistryEntry` interface alongside the existing optional fields (`skipSync`, `insertOnly`, etc.). Include a JSDoc comment explaining: "If true, this table only uploads to Supabase — no rows are downloaded to Dexie. The download phase skips this table entirely."
- Update the `embeddings` const entry: add `uploadOnly: true` and `fieldMap: { noteId: 'note_id', embedding: 'vector' }`. The `createdAt → created_at` conversion is automatic. Do not change priority (stays P1) or conflictStrategy (stays `lww` for semantic correctness even though it's upload-only).
- In `_doDownload`, add `if (entry.uploadOnly) continue` immediately after the `if (entry.skipSync) continue` guard (around line 625). Add a comment: `// upload-only tables have no download phase — embeddings are generated locally, not pulled from server`.
- Update `tableRegistry.test.ts`: add a test asserting `getTableEntry('embeddings')?.uploadOnly === true`, and add `embeddings` to the P1 tables list if it isn't already there (it should be). Also add a test that `fieldMap` for `embeddings` contains `{ noteId: 'note_id', embedding: 'vector' }`.

**Patterns to follow:**
- `skipSync` optional field pattern (lines 65–68 of `tableRegistry.ts`)
- Existing `if (entry.skipSync) continue` guard pattern in `_doDownload`

**Test scenarios:**
- Happy path: `getTableEntry('embeddings')` returns entry with `uploadOnly: true`
- Happy path: `embeddings` fieldMap contains `noteId: 'note_id'` and `embedding: 'vector'`
- Integration: `_doDownload` iterates tableRegistry — confirm `embeddings` table is NOT queried when `uploadOnly: true` (via mock that asserts no `supabase.from('embeddings').select()` call)
- Edge case: `uploadOnly` field is absent on other existing entries — spot-check `notes`, `flashcards`, `bookmarks` are all falsy

**Verification:**
- `tableRegistry.test.ts` passes.
- `syncEngine.download.test.ts` passes (no regression to download phase).
- TypeScript clean.

---

- [ ] **Unit 2: Add `id` field to `Embedding` type and Dexie schema**

**Goal:** Add a required `id: string` field to the `Embedding` type so that `syncableWrite` has a stable PK to use as the Supabase upsert conflict target. Bump the Dexie schema version with a migration that backfills `id` on existing records.

**Requirements:** R4 (prerequisite — `syncableWrite` needs `id`)

**Dependencies:** Unit 1

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/ai/vector-store.ts` (read-path: `loadAll` must handle records without `id` if migration hasn't run)

**Approach:**
- Add `id: string` to the `Embedding` interface in `types.ts`. Optionally add `updatedAt?: string` for TypeScript completeness (syncableWrite stamps it at runtime).
- In `schema.ts`, bump to the next schema version (check the current max version by scanning schema.ts) and add a migration that iterates `db.embeddings.toArray()` and backfills `id = crypto.randomUUID()` for any record missing `id`. The Dexie index for `embeddings` stays `'noteId, createdAt'` — `id` does not need an index (it is only used as the upsert conflict key).
- `loadAll` already reads `emb.noteId` and `emb.embedding` — no change needed there.

**Patterns to follow:**
- Dexie migration pattern in `schema.ts` (search for `version(NN).upgrade(tx => ...)`)
- ES2020 safe: use `for...of` loop + `await table.put()` per record (no `Promise.any`)

**Test scenarios:**
- Happy path: after migration, a previously `id`-less embedding record gets a UUID-shaped `id`
- Edge case: records that already have `id` are not overwritten (migration is idempotent)
- Edge case: `db.embeddings.toArray()` in `loadAll` does not throw if records still lack `id` (graceful read)

**Verification:**
- Schema migration tests pass (`src/db/__tests__/schema.test.ts`).
- TypeScript clean on `Embedding` type usage.

---

- [ ] **Unit 3: Wire `VectorStorePersistence` writes through `syncableWrite`**

**Goal:** Replace the two direct Dexie write calls in `vector-store.ts` with `syncableWrite`, using `persistWithRetry` for retry consistency. Generate `id` in `saveEmbedding` before writing.

**Requirements:** R4, R5, R7

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/ai/vector-store.ts`
- Test: `src/ai/__tests__/vector-store.test.ts`

**Approach:**
- `saveEmbedding(noteId, embedding)`:
  1. Insert to in-memory `BruteForceVectorStore` (existing — keep as-is, throws on dim mismatch).
  2. Build the record: `{ id: crypto.randomUUID(), noteId, embedding, createdAt: new Date().toISOString() }`.
  3. Call `await persistWithRetry(() => syncableWrite('embeddings', 'put', record))`.
  4. On failure: rollback in-memory insert (`this.store.remove(noteId)`) then rethrow — same behavior as the current `db.embeddings.put` error path.
- `removeEmbedding(noteId)`:
  1. Look up the Dexie record first to get its `id`: `const rec = await db.embeddings.where('noteId').equals(noteId).first()`.
  2. If `rec?.id` exists: `await syncableWrite('embeddings', 'delete', rec.id)`.
  3. If no `id` (legacy record without migration): fall back to direct `db.embeddings.delete(noteId)` as best-effort with a console.warn.
  4. Remove from in-memory store (`this.store.remove(noteId)`).
- Import `syncableWrite` from `@/lib/sync/syncableWrite` and `persistWithRetry` from `@/lib/persistWithRetry`.

**Patterns to follow:**
- `src/stores/useNoteStore.ts` — `persistWithRetry(() => syncableWrite(...))` call pattern
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — test structure: Dexie seeding, queue assertion

**Test scenarios:**
- Happy path: `saveEmbedding` while authenticated → Dexie record written with `id`, `syncQueue` entry created with `tableName: 'embeddings'`, `operation: 'put'`
- Happy path: `saveEmbedding` while unauthenticated → Dexie record written, no `syncQueue` entry, no error thrown
- Happy path: `removeEmbedding` while authenticated → `syncQueue` entry with `operation: 'delete'` and `recordId` matching the embedding's `id`
- Happy path: queue entry payload has `note_id` (not `noteId`) and `vector` (not `embedding`) due to fieldMap
- Error path: `saveEmbedding` Dexie write fails → in-memory rollback happens, error rethrows
- Edge case: `removeEmbedding` on a record without `id` (pre-migration) → direct Dexie delete, no queue entry, console.warn logged

**Verification:**
- `vector-store.test.ts` passes.
- No `db.embeddings.put/delete` direct calls remain in `vector-store.ts`.
- TypeScript clean.

---

- [ ] **Unit 4: Register `embeddings` store refresh callback in `useSyncLifecycle`**

**Goal:** Register a store refresh callback so that if `uploadOnly` is ever removed and download is re-enabled, the in-memory vector store is reloaded. Also documents the design intent inline.

**Requirements:** R6

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/hooks/useSyncLifecycle.ts`

**Approach:**
- Add after the existing `registerStoreRefresh` calls (around line 57):
  ```
  syncEngine.registerStoreRefresh('embeddings', () =>
    vectorStorePersistence.loadAll()
  )
  ```
- Import `vectorStorePersistence` from `@/ai/vector-store`.
- Add inline comment: `// upload-only: embeddings are not downloaded from Supabase, so this callback
  // is a no-op during normal sync. Registered for API symmetry and in case uploadOnly is
  // later removed (E97+ or future bidirectional scenario).`

**Patterns to follow:**
- Existing `registerStoreRefresh` calls in `useSyncLifecycle.ts` (lines 49–59)

**Test scenarios:**
- Test expectation: none — this is a pure wiring call with no behavioral change to test in isolation. The callback's correctness is covered by `vector-store.test.ts` (Unit 3) and `vectorStorePersistence.loadAll()` is already tested elsewhere.

**Verification:**
- `useSyncLifecycle.ts` imports and calls `syncEngine.registerStoreRefresh('embeddings', ...)`.
- TypeScript clean.

---

- [ ] **Unit 5: Unit tests — `p1-embeddings-sync.test.ts`**

**Goal:** Write a dedicated integration test file verifying the full sync wiring for the `embeddings` table: authenticated writes enqueue, unauthenticated writes do not, delete produces a delete entry, download phase skips `embeddings`, and field serialisation produces correct snake_case keys.

**Requirements:** R8

**Dependencies:** Units 1, 2, 3

**Files:**
- Create: `src/lib/sync/__tests__/p1-embeddings-sync.test.ts`

**Execution note:** Write tests against the implemented behavior — these are integration-style tests using `fake-indexeddb` and module mocking, mirroring `p1-notes-bookmarks-sync.test.ts`.

**Approach:**
- Follow the `p1-notes-bookmarks-sync.test.ts` structure exactly: `fake-indexeddb/auto`, `vi.resetModules()` in `beforeEach`, `Dexie.delete('ElearningDB')` for isolation, lazy dynamic imports for all stores and db.
- Use `useAuthStore.setState` to toggle auth state between tests.
- Import `vectorStorePersistence` and call `saveEmbedding`/`removeEmbedding` directly — these are the integration seams.
- Helper to generate a test embedding: `{ id: 'note-id', text: 'test' }` → `Array.from({length: 384}, (_, i) => i * 0.001)`.

**Test scenarios:**
- Happy path: `saveEmbedding(noteId, embedding)` while authenticated → Dexie record has `id`, `syncQueue` entry exists with `tableName: 'embeddings'`, `operation: 'put'`
- Happy path: `saveEmbedding` while unauthenticated → Dexie write succeeds, `syncQueue` has no `embeddings` entries
- Happy path: `removeEmbedding(noteId)` while authenticated → `syncQueue` entry with `operation: 'delete'`
- Integration: queue entry payload has `note_id` key (not `noteId`) and `vector` key (not `embedding`) — fieldMap applied by `toSnakeCase`
- Integration: `uploadOnly` guard — instantiate `syncEngine._doDownload` path (or mock Supabase) and confirm `supabase.from('embeddings')` is never called when `uploadOnly: true` (reference the download test pattern in `syncEngine.download.test.ts`)
- Edge case: `saveEmbedding` with `Float32Array` input (coerced via `Array.from`) → payload `vector` field is a plain `number[]`

**Verification:**
- All 6+ test cases pass with `npm run test:unit -- --reporter=verbose`.
- No flakiness across 3 runs.

## System-Wide Impact

- **Interaction graph:** `VectorStorePersistence.saveEmbedding` → `syncableWrite` → `syncQueue` → upload engine (`_doUpload`). The upload engine already handles `embeddings` entries correctly once the registry entry is in place (it uses `upsert(payload, { onConflict: 'id' })`). `embeddingPipeline.ts` calls `vectorStorePersistence` — no direct impact but changes propagate.
- **Error propagation:** Dexie write failure in `saveEmbedding` → in-memory rollback + rethrow (non-blocking in `embeddingPipeline` which already swallows errors). Queue insert failure → logged, swallowed (non-fatal per `syncableWrite` contract).
- **State lifecycle risks:** The in-memory `BruteForceVectorStore` and Dexie must remain in sync. The existing rollback on Dexie failure already handles this. `syncableWrite` does not touch the in-memory store — `VectorStorePersistence` continues to own both writes.
- **API surface parity:** `embeddingPipeline.ts` uses `vectorStorePersistence` exclusively — no other write sites were found. The public API of `VectorStorePersistence` is unchanged.
- **Integration coverage:** Cross-layer: `saveEmbedding → syncableWrite → Dexie + syncQueue` is the critical path verified in Unit 5 tests.
- **Unchanged invariants:** Semantic search query path (`vectorStorePersistence.getStore().search(...)`) is read-only and unchanged. The HNSW index on the Supabase side is pre-existing (E93-S01) and unchanged.
- **tableRegistry count**: The `tableRegistry.test.ts` asserts exactly 38 entries. No new entry is added (existing `embeddings` entry is updated in-place) — count stays at 38. The test will need the `uploadOnly` assertion added but not the count changed.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| PK mismatch: Dexie `noteId` vs Supabase `id UUID` | Generate UUID in `saveEmbedding` and persist alongside `noteId`. Upload uses `id` as upsert conflict key — aligns with Supabase table design. |
| Existing `Embedding` records in Dexie without `id` | Dexie schema migration backfills `id` via `crypto.randomUUID()`. `removeEmbedding` falls back to direct delete for un-migrated records. |
| `tableRegistry.test.ts` hardcodes 38-entry count | Count does not change (update, not add). Only assertion to add is `uploadOnly: true` for `embeddings`. |
| `number[]` not accepted by Supabase for pgvector | Supabase JS client handles `number[]` natively for vector columns. No manual string serialization needed. |
| `VectorStorePersistence` is a class singleton — test isolation | Tests use `vi.resetModules()` + `fake-indexeddb/auto` + `Dexie.delete(...)` in `beforeEach`. Import `vectorStorePersistence` dynamically after module reset. |
| `updatedAt` not in `Embedding` type → TypeScript error | Cast the record as `SyncableRecord` in `syncableWrite` call, or add `updatedAt?: string` to `Embedding`. Implementer decides. |

## Documentation / Operational Notes

- Add inline comment to `tableRegistry.ts` `embeddings` entry documenting upload-only rationale: deterministic vectors, LWW trivially correct, download avoided to prevent stale overwrites.
- Add inline comment to `_doDownload` in `syncEngine.ts` explaining that upload-only tables skip the cursor advancement step.
- No RLS changes needed — `embeddings` table has `FOR ALL USING (auth.uid() = user_id)` from E93-S01.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e93-s05-embeddings-sync-pgvector-requirements.md](docs/brainstorms/2026-04-18-e93-s05-embeddings-sync-pgvector-requirements.md)
- Related code: `src/ai/vector-store.ts`, `src/lib/sync/tableRegistry.ts`, `src/lib/sync/syncEngine.ts`
- Reference patterns: `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` (E93-S02)
- Related solutions doc: `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md`
- Migration: `supabase/migrations/20260413000002_p1_learning_content.sql` (embeddings table DDL)
- lastGreenSha: `312af4dc0afd1c14977d7fcaa498c98d1848f32f`
