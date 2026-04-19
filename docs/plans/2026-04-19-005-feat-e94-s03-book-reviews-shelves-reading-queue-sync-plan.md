---
title: "feat(E94-S03): Book Reviews, Shelves, and Reading Queue Sync"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e94-s03-book-reviews-shelves-reading-queue-sync-requirements.md
---

# feat(E94-S03): Book Reviews, Shelves, and Reading Queue Sync

## Overview

Wire four P2 library-organization tables (`book_reviews`, `shelves`, `book_shelves`, `reading_queue`) through the existing Knowlune sync engine so that star ratings, custom shelves, shelf memberships, and queue positions round-trip across devices. The story also introduces a default-shelf dedup mechanism so that a new-device sign-in does not produce 6 "Favorites" shelves when each device seeded its own defaults locally.

This follows the precedent set by E93-S02 (notes + bookmarks wiring) and E92-S09 (P0 store wiring). The only novel mechanics are: (a) a fieldMap translation (`sortOrder → position`) on `reading_queue`, (b) the `DEFERRABLE INITIALLY DEFERRED` uniqueness constraint for in-transaction reorder, and (c) the dedup + remap dance for default shelves.

## Problem Frame

Knowlune users invest effort organizing their library — rating books, grouping them into shelves, ordering a reading queue. Today this state is Dexie-only, so the organization is invisible on any other device. Simply round-tripping through Supabase is not enough on its own: each device seeds 3 default shelves at first launch with local UUIDs, so a naive sync on Device B would see Device A's 3 default shelves as new rows and end up with 6 entries. We need to dedup on name+is_default at download, persist the remap, then rewrite `book_shelves.shelf_id` on download so memberships land on the local canonical default. (see origin: `docs/brainstorms/2026-04-19-e94-s03-book-reviews-shelves-reading-queue-sync-requirements.md`)

## Requirements Trace

- **R1 (AC1-3):** Supabase migration creating 4 tables with RLS, `moddatetime`, download-cursor indexes, and DEFERRABLE UNIQUE on `reading_queue (user_id, position)`.
- **R2 (AC2):** Idempotent rollback script.
- **R3 (AC9):** `readingQueue` registry entry gains `fieldMap: { sortOrder: 'position' }`.
- **R4 (AC6, AC7, AC8):** All Dexie writes in the three stores route through `syncableWrite`; partial updates convert to fetch-then-put.
- **R5 (AC4, AC12):** New pure helper `dedupDefaultShelves(incoming, existingLocal)` returning `{ toInsert, toSkip, mergedIdMap }`.
- **R6 (AC5):** Download apply phase for `shelves` runs dedup and persists `mergedIdMap` in `syncMetadata['shelfDedupMap:{userId}']`; download for `bookShelves` remaps `shelfId` via the stored map.
- **R7 (AC10):** Four `registerStoreRefresh` calls added to `useSyncLifecycle.ts`.
- **R8 (AC11):** Unauthenticated writes skip the queue; authenticated writes produce one `syncQueue` entry each.
- **R9 (AC13):** Unit tests cover all wiring + dedup + fieldMap + unauth contract.

## Scope Boundaries

- No UI changes. Existing review/shelf/queue UI already reads from Dexie stores.
- No hard FKs across `book_id` references — logical only, matching other E94 tables.
- No changes to `syncableWrite` public API.
- No Dexie schema change: `sortOrder` stays as the client-side field name; translation is via `fieldMap`.

### Deferred to Separate Tasks

- **Multi-device Playwright E2E for AC12**: unit coverage of `dedupDefaultShelves` plus the new-device scenario satisfies the functional bar. If time remains, add `tests/e2e/e94-s03-library-organization-sync.spec.ts`; otherwise defer to the E94 epic closeout or manual QA and log a `docs/known-issues.yaml` entry noting the gap.
- **Full cross-device dedup auditor**: a background task to reconcile historical duplicates pre-dating this migration is out of scope; new users and freshly-signed-in devices are what this story covers.

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncableWrite.ts` — Public API. Contract: write to Dexie first, then enqueue for Supabase when authenticated; unauthenticated writes skip the queue silently. Does **not** support partial update — fetch-then-put is the accepted pattern.
- `src/lib/sync/tableRegistry.ts` lines 362–392 — Existing entries for `bookReviews`, `shelves`, `bookShelves`, `readingQueue` with `conflictStrategy: 'lww'`, `priority: 2`, `fieldMap: {}`. Only `readingQueue.fieldMap` needs to change.
- `src/lib/sync/syncEngine.ts` — Owns `_doDownload` (~line 731) and `_applyRecord` (~line 667). There is **no separate `downloadApply.ts`**. The dedup + remap hook must live in `syncEngine.ts`, invoked per-table before/within the apply loop.
- `src/lib/sync/syncEngine.ts:143` — Comment already notes store refresh callback shape.
- `src/stores/useBookReviewStore.ts` — 3 write sites at lines 71, 96, 112.
- `src/stores/useShelfStore.ts` — 6 write sites at lines 114, 157, 184, 212, 235.
- `src/stores/useReadingQueueStore.ts` — 3 write sites at lines 62, 81, 103.
- `src/app/hooks/useSyncLifecycle.ts` — Registers store refresh callbacks around line 110–131.
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — Test pattern to mirror.
- `supabase/migrations/20260413000001_p0_sync_foundation.sql` — RLS + moddatetime + index template.
- `supabase/migrations/20260413000003_p2_library.sql` (from E94-S01) — immediate predecessor; this migration depends on `books` row existence conceptually.

### Institutional Learnings

- `docs/solutions/best-practices/compound-pk-recordid-synthesis-in-syncable-write-2026-04-19.md` — relevant if `book_shelves` uses its `UNIQUE (user_id, book_id, shelf_id)` as an implicit identity. However this story keeps `book_shelves.id UUID PK`, so compound PK handling is not needed — the unique constraint is a deduplication belt, not a PK surrogate.
- `docs/solutions/best-practices/fail-closed-destructive-migrations-with-session-scoped-guc-2026-04-19.md` — not applicable here (no destructive change), but the wrapping `BEGIN; ... COMMIT;` idiom is the same.
- E93-S02 retrospective (`docs/engineering-patterns.md`) — fetch-then-put pattern for partial updates, and single-method sequential writes for reorder loops.

### External References

- Supabase `moddatetime` extension docs — used as `extensions.moddatetime('updated_at')` trigger; repo already has this pattern.
- PostgreSQL `DEFERRABLE INITIALLY DEFERRED` — required because reorder swaps (A.pos 2→3, B.pos 3→2) transiently violate `UNIQUE (user_id, position)` mid-transaction.

## Key Technical Decisions

- **Dedup hook lives in `syncEngine._doDownload`, not a new file.** The existing engine already per-table orchestrates apply; adding a thin `_preApplyShelves` and `_remapBookShelvesShelfId` sidecar is cheaper and safer than introducing a new module and rewiring. The pure `dedupDefaultShelves` logic **is** extracted to its own file (`src/lib/sync/defaultShelfDedup.ts`) so it's testable in isolation.
- **`mergedIdMap` persisted in `syncMetadata` keyed by `shelfDedupMap:{userId}`.** Merged on every download (new entries layered over existing) so subsequent `book_shelves` downloads can still remap. This survives sign-out/sign-in because `syncMetadata` is Dexie-local per app install; `userId` scoping prevents cross-account leak.
- **Name matching is case-insensitive + trimmed.** `"favorites"`, `"Favorites"`, `" Favorites "` all collapse to the same dedup key. Prevents duplicates from minor casing drift across devices.
- **Dedup only triggers when both sides have `is_default: true`.** Custom user-created shelves named "Favorites" are preserved as distinct rows.
- **`reorderQueue` uses `syncableWrite('readingQueue', 'put', { ...entry })` in-loop.** Reorder already has the full entry in scope with updated `sortOrder`; no extra Dexie read needed. Existing sequential-await semantics preserved.
- **Registry ordering guarantees shelves apply before bookShelves.** `shelves` is registered before `bookShelves` (lines 370 and 378 today); `_doDownload` iterates `tableRegistry` in registration order. Documented as the ordering invariant — any future reordering would break the remap.
- **No change to conflict strategy.** All 4 tables stay `lww`. `shelves` dedup is an insert-time filter, not a conflict strategy — it only affects the apply list, not how per-row `updated_at` comparisons work.
- **Migration ordering.** `20260413000004_` runs after E94-S01's `20260413000003_`. This plan assumes E94-S01 ships to shared environments before this one. Documented in the migration header comment.

## Open Questions

### Resolved During Planning

- Where does download apply live? → `src/lib/sync/syncEngine.ts` (`_doDownload` + `_applyRecord`). No separate module.
- Does `reorderQueue` need a separate fetch-then-put? → No. The loop already has each entry in scope with updated `sortOrder`; spreading `{...entry}` is sufficient.
- Does dedup belong in a conflict resolver? → No. Conflict resolvers run per-record; dedup needs whole-batch context (know all local defaults before deciding insert/skip).

### Deferred to Implementation

- Exact `syncMetadata` read/write helper — the existing sync engine already reads `syncMetadata.lastSyncTimestamp`; we'll follow the same idiom. If the existing helpers don't expose arbitrary keys, the implementer will add a minimal `getSyncMeta(key)` / `setSyncMeta(key, value)` pair co-located with existing cursor helpers.
- Whether the unit test suite needs a new Dexie fake bootstrap helper or can reuse `p1-notes-bookmarks-sync.test.ts`'s setup — decide when copying the pattern.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
                     ┌─────────────────────────────────────┐
 Supabase            │ _doDownload (syncEngine.ts)         │
  ▼                  │                                     │
  shelves batch ───▶ │  if entry.dexieTable === 'shelves':│
                     │    existingLocal = db.shelves.toArray()
                     │    { toInsert, toSkip, mergedIdMap } │
                     │      = dedupDefaultShelves(batch,    │
                     │          existingLocal)              │
                     │    mergeIntoSyncMeta(                │
                     │      'shelfDedupMap:'+userId,        │
                     │      mergedIdMap)                    │
                     │    apply toInsert via _applyRecord   │
                     │                                      │
  bookShelves ─────▶ │  if entry.dexieTable === 'bookShelves':
                     │    map = readSyncMeta(               │
                     │      'shelfDedupMap:'+userId)        │
                     │    for row in batch:                 │
                     │      if map[row.shelfId] exists:     │
                     │        row.shelfId = map[row.shelfId]│
                     │    apply normally via _applyRecord   │
                     └─────────────────────────────────────┘

 Dexie write path (authenticated):
   store.createShelf(shelf)
     → syncableWrite('shelves', 'put', shelf)
       → db.shelves.put(shelf)            [Dexie-local]
       → db.syncQueue.add({                [outbound queue]
           tableName: 'shelves',
           operation: 'put',
           payload: JSON.stringify(shelf),
           status: 'pending'
         })
```

`dedupDefaultShelves` is a pure function: input two arrays, output three sets. All I/O lives in `syncEngine.ts`.

## Implementation Units

- [ ] **Unit 1: Supabase migration (4 tables)**

**Goal:** Create `book_reviews`, `shelves`, `book_shelves`, `reading_queue` with RLS, `moddatetime`, download-cursor indexes, and DEFERRABLE UNIQUE on `reading_queue`.

**Requirements:** R1, R2

**Dependencies:** E94-S01's `20260413000003_p2_library.sql` conceptually ships first (documented in header; not enforced by SQL).

**Files:**
- Create: `supabase/migrations/20260413000004_p2_book_organization.sql`
- Create: `supabase/migrations/rollback/20260413000004_p2_book_organization_rollback.sql`

**Approach:**
- Header comment: reference E94-S03, migration ordering (after `...000003`), idempotency policy (`IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS`), DEFERRABLE rationale.
- Wrap in `BEGIN; ... COMMIT;`.
- Per table: columns (AC1), `FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` RLS, `BEFORE UPDATE` trigger `{tablename}_set_updated_at` calling `extensions.moddatetime('updated_at')`, `(user_id, updated_at)` index.
- Extra indexes: `book_reviews (user_id, book_id)`; `book_shelves (user_id, book_id)` and `(user_id, shelf_id)`.
- `reading_queue`: `UNIQUE (user_id, position) DEFERRABLE INITIALLY DEFERRED` (constraint declaration inline with table, or `ALTER TABLE ... ADD CONSTRAINT`).
- Rollback: `DROP TABLE IF EXISTS ... CASCADE` in reverse dependency order (reading_queue, book_shelves, shelves, book_reviews).

**Patterns to follow:**
- `supabase/migrations/20260413000001_p0_sync_foundation.sql` — RLS + moddatetime + index structure.
- `supabase/migrations/20260413000003_p2_library.sql` — E94-S01 predecessor migration.

**Test scenarios:**
- Happy path: apply migration on local Supabase; verify via `information_schema.tables` all 4 tables exist; verify `information_schema.triggers` each `{tablename}_set_updated_at` trigger exists; verify `pg_indexes` all expected indexes exist.
- Happy path: verify RLS policy blocks `SELECT` from a different user_id.
- Integration: within a single transaction, swap `reading_queue` positions 2↔3 via two UPDATE statements → COMMIT succeeds (DEFERRABLE working).
- Error path: without DEFERRABLE, the same swap would fail — include a regression-sanity check in the rollback-then-reapply test.
- Idempotency: apply migration twice → second run succeeds with no errors.

**Verification:**
- Migration applies cleanly and is idempotent.
- All 4 tables, 4 triggers, and documented indexes exist in `information_schema` / `pg_indexes`.
- Rollback drops all 4 tables without error.

---

- [ ] **Unit 2: `tableRegistry.ts` — `readingQueue.fieldMap`**

**Goal:** Add the `sortOrder → position` field translation.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts` (line ~386–392)

**Approach:**
- Change `readingQueue.fieldMap` from `{}` to `{ sortOrder: 'position' }`.
- Leave `bookReviews`, `shelves`, `bookShelves` entries untouched.

**Patterns to follow:**
- Existing fieldMap usage in `src/lib/sync/fieldMapper.ts` (already handles the translation both directions when `fieldMap` is populated).

**Test scenarios:**
- Happy path: `tableRegistry.test.ts` — add a case asserting `readingQueue.fieldMap.sortOrder === 'position'`.
- Integration: the E94-S03 sync test suite (Unit 8) covers the round-trip — a queue write's `syncQueue.payload` should contain `position`, not `sortOrder`.

**Verification:**
- `npx tsc --noEmit` passes.
- `tableRegistry.test.ts` passes.

---

- [ ] **Unit 3: Pure helper `dedupDefaultShelves`**

**Goal:** Extract the dedup decision as a pure function.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Create: `src/lib/sync/defaultShelfDedup.ts`
- Test: `src/lib/sync/__tests__/p2-book-organization-sync.test.ts` (group covered in Unit 8; can be added alongside this unit if preferred)

**Approach:**
- Export:
  - `interface DedupResult { toInsert: Shelf[]; toSkip: Shelf[]; mergedIdMap: Record<string,string> }`
  - `function dedupDefaultShelves(incoming: Shelf[], existingLocal: Shelf[]): DedupResult`
- Algorithm:
  - Build `localDefaultsByName: Map<string, Shelf>` from `existingLocal.filter(s => s.isDefault === true)`, keyed by `name.toLowerCase().trim()`.
  - For each incoming: if `incoming.isDefault === true` AND the normalized-name key exists in the map → push to `toSkip`, set `mergedIdMap[incoming.id] = existingLocal.id`. Otherwise push to `toInsert`.
- Pure function: no I/O, no imports beyond the `Shelf` type.

**Patterns to follow:**
- Keep-it-small pure modules as in `src/lib/sync/fieldMapper.ts`.

**Test scenarios:**
- Happy path: incoming `[{id:'r1', name:'Favorites', isDefault:true}]`, local `[{id:'l1', name:'Favorites', isDefault:true}]` → `toSkip=[r1]`, `mergedIdMap={r1:l1}`.
- Edge case: case/whitespace difference (`'favorites'` vs `' Favorites '`) → still dedupes.
- Edge case: incoming is default but no local match → goes to `toInsert`, empty map.
- Edge case: incoming non-default with same name as local default → goes to `toInsert` (only defaults dedupe).
- Edge case: local non-default with same name as incoming default → goes to `toInsert` (only local defaults participate in the map).
- Edge case: empty incoming or empty local → no errors, empty result sets.

**Verification:**
- Unit tests pass.
- `npx tsc --noEmit` passes.

---

- [ ] **Unit 4: Wire `useBookReviewStore` through `syncableWrite`**

**Goal:** Route all Dexie writes in the review store through `syncableWrite`.

**Requirements:** R4, R8

**Dependencies:** Unit 2 (so `tableRegistry` is consistent before tests run)

**Files:**
- Modify: `src/stores/useBookReviewStore.ts`
- Test: existing `useBookReviewStore.test.ts` (regression) and new `p2-book-organization-sync.test.ts` (Unit 8)

**Approach:**
- Add `import { syncableWrite } from '@/lib/sync/syncableWrite'`.
- Replace `db.bookReviews.put(review)` (lines 71, 96) with `await syncableWrite('bookReviews', 'put', review)`.
- Replace `db.bookReviews.delete(existing.id)` (line 112) with `await syncableWrite('bookReviews', 'delete', existing.id)`.
- Grep the file after changes; assert zero remaining `db.bookReviews.(put|add|delete|update)` occurrences.

**Patterns to follow:**
- `src/stores/useNoteStore.ts` (E93-S02) — same wiring pattern.

**Test scenarios:**
- Happy path (authenticated): `addReview` → one `syncQueue` entry `{tableName:'bookReviews', operation:'put'}`; `removeReview` → one `{operation:'delete'}`.
- Edge case (unauthenticated): same calls → zero `syncQueue` entries (syncableWrite's contract).
- Integration: existing `useBookReviewStore.test.ts` suite stays green.

**Verification:**
- Zero remaining `db.bookReviews.*` mutations in the store.
- `npx tsc --noEmit` passes.
- Existing store tests + new sync tests pass.

---

- [ ] **Unit 5: Wire `useShelfStore` through `syncableWrite`**

**Goal:** Route shelf + shelf-membership writes through `syncableWrite`, converting partial updates to fetch-then-put.

**Requirements:** R4, R8

**Dependencies:** Unit 2

**Files:**
- Modify: `src/stores/useShelfStore.ts`

**Approach:**
- Add `syncableWrite` import.
- Replace `db.shelves.put(shelf)` (line 114) with `await syncableWrite('shelves', 'put', shelf)`.
- Replace `db.shelves.update(shelfId, { name, updatedAt })` (line 157) with fetch-then-put:
  - `const existing = await db.shelves.get(shelfId); if (!existing) return;`
  - `await syncableWrite('shelves', 'put', { ...existing, name: trimmed, updatedAt: timestamp })`
- Replace `db.shelves.delete(shelfId)` (line 184) with `await syncableWrite('shelves', 'delete', shelfId)`.
- Replace `db.bookShelves.put(entry)` (line 212) with `await syncableWrite('bookShelves', 'put', entry)`.
- Replace `db.bookShelves.delete(entry.id)` (line 235) with `await syncableWrite('bookShelves', 'delete', entry.id)`.
- Grep: zero remaining `db.(shelves|bookShelves).(put|add|delete|update)`.

**Patterns to follow:**
- Fetch-then-put pattern from E93-S02 (`useNoteStore.updateNote`).

**Test scenarios:**
- Happy path: `createShelf` → put queue entry; `updateShelf` → put queue entry with payload containing both unchanged fields and the renamed name; `deleteShelf` → delete queue entry; `addBookToShelf` → bookShelves put; `removeBookFromShelf` → bookShelves delete.
- Edge case (fetch-then-put correctness): `updateShelf` on a nonexistent id → no-op (returns early, no queue entry).
- Edge case (unauthenticated): all of the above → zero queue entries.

**Verification:**
- Zero remaining raw Dexie mutations in the store.
- Existing `useShelfStore.test.ts` (if present) stays green.

---

- [ ] **Unit 6: Wire `useReadingQueueStore` through `syncableWrite` (with fieldMap validation)**

**Goal:** Route queue writes through `syncableWrite`; verify `sortOrder → position` translation in the queue payload.

**Requirements:** R3, R4, R8

**Dependencies:** Unit 2

**Files:**
- Modify: `src/stores/useReadingQueueStore.ts`

**Approach:**
- Add `syncableWrite` import.
- Replace `db.readingQueue.put(entry)` (line 62) with `await syncableWrite('readingQueue', 'put', entry)`.
- Replace `db.readingQueue.delete(entry.id)` (line 81) with `await syncableWrite('readingQueue', 'delete', entry.id)`.
- In `reorderQueue` (line ~103), inside the loop replace `db.readingQueue.update(entry.id, { sortOrder: entry.sortOrder })` with `await syncableWrite('readingQueue', 'put', { ...entry })`. Preserve the sequential-await semantics of the existing loop.
- Grep: zero remaining `db.readingQueue.(put|add|delete|update)`.

**Patterns to follow:**
- Existing reorder loops in the codebase; sequential-await is the established idiom.

**Test scenarios:**
- Happy path: `addToQueue` → one put queue entry; the serialized `payload` contains the key `position`, not `sortOrder` (fieldMap translation).
- Happy path: `reorderQueue` applied to a 3-entry queue `[A(pos 1), B(pos 2), C(pos 3)]` → `[C(pos 1), A(pos 2), B(pos 3)]` produces exactly 3 put entries, each with `position` correctly remapped in payload.
- Happy path: `removeFromQueue` → one delete queue entry.
- Edge case (unauthenticated): all of the above → zero queue entries.

**Verification:**
- Zero remaining raw Dexie mutations.
- Unit 8 test suite confirms fieldMap translation in the payload.

---

- [ ] **Unit 7: Hook dedup + remap into `_doDownload` (syncEngine)**

**Goal:** On shelves download, dedup default shelves and persist the map; on bookShelves download, remap `shelfId` via the stored map.

**Requirements:** R5, R6

**Dependencies:** Unit 3 (`dedupDefaultShelves` helper exists)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`

**Approach:**
- In `_doDownload`, when `entry.dexieTable === 'shelves'`:
  - Before the per-record apply loop, fetch current local shelves (`await db.shelves.toArray()`).
  - Call `dedupDefaultShelves(incomingRecords, localShelves)` on the incoming batch (after snake→camel conversion).
  - Read any existing `shelfDedupMap:{userId}` from `syncMetadata`; merge the new `mergedIdMap` over it and write back.
  - Apply only `toInsert` via the existing `_applyRecord` loop; skip `toSkip` entirely.
  - Debug log `toSkip.length`.
- When `entry.dexieTable === 'bookShelves'`:
  - Before the apply loop, load `shelfDedupMap:{userId}` from `syncMetadata`.
  - For each incoming row, if `map[row.shelfId]` exists, rewrite `row.shelfId` to the mapped local id.
  - Apply normally.
- Resolve `userId` from the active auth session (the sync engine already has auth access — follow the existing pattern for reading the signed-in user).
- Preserve existing per-record try/catch + store-refresh invocation.
- Registry-order invariant: `shelves` MUST appear before `bookShelves` in `tableRegistry`. Add a source-level comment at both registry entries noting this dependency.

**Patterns to follow:**
- Existing `_doDownload` structure for how `entry` is dispatched.
- Existing `syncMetadata` cursor read/write pattern (`lastSyncTimestamp` read/write around the download loop).

**Test scenarios:**
- Happy path: incoming shelves has one default with same name as a local default → dedup skips insert, map persists with `{incomingId: localId}`.
- Happy path (AC12 new-device scenario): local has `[{id:'local-fav', name:'Favorites', isDefault:true}]`; server returns `[{id:'remote-fav', name:'Favorites', isDefault:true}]`; after download, Dexie contains exactly ONE "Favorites" shelf with `id: 'local-fav'`, and `syncMetadata['shelfDedupMap:{userId}']` contains `{'remote-fav': 'local-fav'}`.
- Happy path (AC5 remap): with `mergedIdMap = {'remote-fav': 'local-fav'}` already in `syncMetadata`, incoming `bookShelves` row `{shelf_id: 'remote-fav', ...}` → inserted with `shelf_id: 'local-fav'`.
- Edge case: `bookShelves` row where `shelf_id` is not in the map → insert unchanged.
- Edge case: dedup runs when `syncMetadata` has no prior map → creates a new entry without crashing.
- Edge case: unauthenticated download (no userId) → early-exit preserved from existing engine behavior; no dedup attempted.
- Integration: two successive download cycles (map already populated, new bookShelves arriving) → remap still works.

**Verification:**
- After the new-device scenario test, Dexie has 1 "Favorites" row, `syncMetadata` has the expected map, no `syncQueue` outbound entries were spuriously created.
- Existing `syncEngine.download.test.ts` tests stay green.

---

- [ ] **Unit 8: Unit test suite `p2-book-organization-sync.test.ts`**

**Goal:** Cover all wiring + dedup + fieldMap + unauth contract + new-device scenario in one Vitest file.

**Requirements:** R9

**Dependencies:** Units 3–7

**Files:**
- Create: `src/lib/sync/__tests__/p2-book-organization-sync.test.ts`

**Approach:**
- Setup pattern copied from `p1-notes-bookmarks-sync.test.ts`: mock auth (signed-in/signed-out variants), initialize Dexie fake, clear `syncQueue` between tests.
- Six test groups aligned to AC13:
  1. bookReviews: addReview/removeReview → correct queue entries.
  2. shelves: createShelf/updateShelf/deleteShelf → correct queue entries with full-row payloads.
  3. bookShelves: addBookToShelf/removeBookFromShelf → correct queue entries.
  4. readingQueue: addToQueue/reorderQueue (3-entry)/removeFromQueue → correct queue entries with `sortOrder → position` mapping in payload.
  5. Unauthenticated: one write per store → zero queue entries.
  6. `dedupDefaultShelves` pure function + AC5 book_shelves remap + AC12 new-device end-to-end (stubs the download path as needed).

**Patterns to follow:**
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — setup, auth mocking, syncQueue assertions.
- `src/lib/sync/__tests__/p2-course-book-sync.test.ts` — closest structural sibling (P2 tier).

**Test scenarios:**
- Enumerated inline per group above — each test names its input, action, and expected queue entry / Dexie state / map state.

**Verification:**
- `npm run test:unit -- p2-book-organization-sync` passes.
- Full `npm run test:unit` suite green.

---

- [ ] **Unit 9: Register store refresh callbacks + final cleanup**

**Goal:** Wire download-phase refresh for all 4 tables; run full verification.

**Requirements:** R7

**Dependencies:** Units 4–7

**Files:**
- Modify: `src/app/hooks/useSyncLifecycle.ts`

**Approach:**
- Add imports for `useBookReviewStore`, `useShelfStore`, `useReadingQueueStore`.
- After the existing `books` registration (~line 128), add:
  - `syncEngine.registerStoreRefresh('bookReviews', () => useBookReviewStore.getState().loadReviews())`
  - `syncEngine.registerStoreRefresh('shelves', () => useShelfStore.getState().loadShelves())`
  - `syncEngine.registerStoreRefresh('bookShelves', () => useShelfStore.getState().loadShelves())` (shelf store owns both)
  - `syncEngine.registerStoreRefresh('readingQueue', () => useReadingQueueStore.getState().loadQueue())`
- Confirm each store actually exports the referenced loader method; if not, add a minimal `loadX` method matching the existing pattern in the store.
- Full verification pass:
  - `npm run lint` — zero errors (auto-fix as needed).
  - `npx tsc --noEmit` — zero errors.
  - `npm run test:unit` — full suite green.
  - `npm run build` — succeeds.
  - Grep: zero `db.(bookReviews|shelves|bookShelves|readingQueue).(put|add|delete|update)` remaining in any store file.

**Patterns to follow:**
- Existing `registerStoreRefresh` calls near lines 110–131 of `useSyncLifecycle.ts`.

**Test scenarios:**
- Integration: existing `useSyncLifecycle.test.ts` (if present) passes without modification. If the test file asserts a specific registration count, update the assertion to reflect the 4 new calls.

**Verification:**
- All four gates (lint, typecheck, unit tests, build) pass.
- No raw Dexie mutations remain in any of the 3 touched stores.

## System-Wide Impact

- **Interaction graph:** `syncEngine._doDownload` gains two per-table hooks; `syncableWrite` is unchanged; 3 stores gain imports. The registered store-refresh callbacks cause `useSyncLifecycle`-consuming components to re-render via Zustand after each sync cycle completes.
- **Error propagation:** Dedup failures (missing userId, malformed map) should log + fallback to apply-unchanged (fail-open on dedup, since worst case is a duplicate shelf — not data loss). `syncableWrite` already handles queue-write failures.
- **State lifecycle risks:** `shelfDedupMap:{userId}` persists across sessions in Dexie — if a user signs out and a different user signs in on the same device, the per-user key scoping isolates them. If a user truly wants to reset (e.g., after deleting all shelves), they can clear Dexie; not a new risk vs existing sync metadata.
- **API surface parity:** No public API changes.
- **Integration coverage:** The AC12 new-device scenario is a true cross-layer integration case — it verifies that `_doDownload`'s shelves branch + bookShelves branch + `syncMetadata` persistence cooperate correctly. Unit 8 test group 6 covers this with a stubbed download.
- **Unchanged invariants:** `syncableWrite`'s public API, `tableRegistry` entries for `bookReviews/shelves/bookShelves` (only `readingQueue` changes), all conflict strategies remain `lww`, the existing `_doDownload` loop order (registry order), existing store-refresh callback contract.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Registry ordering (shelves must precede bookShelves) silently breaks remap if someone reorders the array | Add source-level comments at both entries citing this plan; add a test in `tableRegistry.test.ts` asserting `shelves` index < `bookShelves` index |
| DEFERRABLE constraint + per-row `moddatetime` trigger interaction | Integration test: transaction-scoped position swap succeeds after `moddatetime` fires on each row |
| `mergedIdMap` grows unbounded over time as server rotates shelves | Acceptable for MVP: default shelves are seeded once and rarely change. Future cleanup deferred |
| Fetch-then-put race on high-frequency updates (e.g., rapid shelf rename) | Sequential awaits within each method already serialize — same pattern as E93-S02 which shipped green |
| E94-S01 not yet merged when this migration is applied | Header comment documents the dependency; plan ships only after E94-S01 merges |
| Silent dedup failure hiding a real bug | Debug log on skip; unit test asserts `toSkip` count + `mergedIdMap` contents |

## Documentation / Operational Notes

- Document migration ordering in the SQL header.
- Update `docs/engineering-patterns.md` at epic closeout with the "default-shelf dedup + persisted idMap" pattern if it proves reusable (E95 preferences or future entitlements could reuse it).
- No user-visible rollout communication needed — purely backend sync wiring.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e94-s03-book-reviews-shelves-reading-queue-sync-requirements.md](../brainstorms/2026-04-19-e94-s03-book-reviews-shelves-reading-queue-sync-requirements.md)
- **Story:** [docs/implementation-artifacts/stories/E94-S03-book-reviews-shelves-and-reading-queue-sync.md](../implementation-artifacts/stories/E94-S03-book-reviews-shelves-and-reading-queue-sync.md)
- Related precedent: `docs/implementation-artifacts/stories/E93-S02-wire-notes-and-bookmarks-with-sync.md`
- Related code: `src/lib/sync/syncEngine.ts`, `src/lib/sync/syncableWrite.ts`, `src/lib/sync/tableRegistry.ts`
- Institutional learnings: `docs/solutions/best-practices/compound-pk-recordid-synthesis-in-syncable-write-2026-04-19.md`, `docs/solutions/best-practices/fail-closed-destructive-migrations-with-session-scoped-guc-2026-04-19.md`
- Epic tracker: E94 (P2 library organization)
