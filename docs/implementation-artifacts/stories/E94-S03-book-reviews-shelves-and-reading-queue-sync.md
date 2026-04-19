---
story_id: E94-S03
story_name: "Book Reviews, Shelves, and Reading Queue Sync"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 94.03: Book Reviews, Shelves, and Reading Queue Sync

## Story

As a learner who organizes their personal library across devices,
I want my star ratings, custom shelves, shelf memberships, and reading queue order to sync automatically,
so that the organization I invest on one device (e.g. tablet reading) appears on every other device (phone, laptop) with the same books in the same places.

## Acceptance Criteria

**AC1 — Supabase migration adds 4 library organization tables:**
Migration file at `supabase/migrations/20260413000004_p2_book_organization.sql` creates:
- `book_reviews` — id UUID PK, user_id UUID FK, book_id UUID NOT NULL, rating INT CHECK (rating BETWEEN 1 AND 5), review_text TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- `shelves` — id UUID PK, user_id UUID FK, name TEXT NOT NULL, is_default BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- `book_shelves` — id UUID PK, user_id UUID FK, book_id UUID NOT NULL, shelf_id UUID NOT NULL, added_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (user_id, book_id, shelf_id)
- `reading_queue` — id UUID PK, user_id UUID FK, book_id UUID NOT NULL, position INT NOT NULL, added_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (user_id, position) DEFERRABLE INITIALLY DEFERRED

**AC2 — RLS, moddatetime, and download cursor indexes on all 4 tables:**
- Single `FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` policy per table
- `BEFORE UPDATE` trigger calling `extensions.moddatetime('updated_at')` on all 4 tables, named `{tablename}_set_updated_at`
- `CREATE INDEX IF NOT EXISTS idx_{tablename}_user_updated ON public.{tablename} (user_id, updated_at)` on all 4 tables for E92-S06 download cursor
- Additional `(user_id, book_id)` index on `book_reviews` and `book_shelves` for per-book lookups
- Additional `(user_id, shelf_id)` index on `book_shelves` for per-shelf lookups
- Migration wrapped in `BEGIN; ... COMMIT;`, uses `IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` throughout for idempotency
- Rollback script at `supabase/migrations/rollback/20260413000004_p2_book_organization_rollback.sql` (DROP all 4 tables with CASCADE)

**AC3 — `reading_queue` UNIQUE constraint is DEFERRABLE:**
The `UNIQUE (user_id, position)` constraint must be `DEFERRABLE INITIALLY DEFERRED` so that `reorderQueue` can update many rows in a single transaction without transient constraint violations (e.g., swapping position 2 ↔ 3). Regular inserts still see the constraint enforced at commit time.

**AC4 — Default-shelf dedup helper exists and is idempotent:**
A new helper `src/lib/sync/defaultShelfDedup.ts` exports `dedupDefaultShelves(incomingShelves, existingShelves): { toInsert, toSkip, mergedIdMap }` where:
- For each incoming shelf with `is_default: true`, look for an existing local shelf with the same `name` AND `is_default: true`
- If found: mark the incoming shelf as skipped and record `incoming.id → existing.id` in `mergedIdMap`
- If not found: mark the incoming shelf as insert
- Called from the download apply phase for `shelves` table (see Task 5) before inserting shelves into Dexie

**AC5 — `book_shelves` downloads remap shelf_id via `mergedIdMap`:**
When downloading `book_shelves` entries, if `shelf_id` matches an entry in the most recent `mergedIdMap`, rewrite `shelf_id` to the local canonical default-shelf id before insert. This prevents orphan `book_shelves` rows pointing at a downloaded default shelf that was deduped away. The `mergedIdMap` is persisted per user in the `syncMetadata` table with key `shelfDedupMap:{userId}` so that subsequent syncs can continue to remap.

**AC6 — `useBookReviewStore` writes route through `syncableWrite`:**
All Dexie mutations in `src/stores/useBookReviewStore.ts` use `syncableWrite`:
- `addReview` (or equivalent upsert): replaces `db.bookReviews.put(review)` with `syncableWrite('bookReviews', 'put', review)` (covers both lines 71 and 96)
- `removeReview` (or equivalent): replaces `db.bookReviews.delete(existing.id)` with `syncableWrite('bookReviews', 'delete', existing.id)`
- Zero remaining `db.bookReviews.put|add|delete|update` calls in the store after this story

**AC7 — `useShelfStore` writes route through `syncableWrite`:**
All Dexie mutations in `src/stores/useShelfStore.ts` use `syncableWrite`:
- `createShelf`: `db.shelves.put(shelf)` → `syncableWrite('shelves', 'put', shelf)`
- `updateShelf` (rename): `db.shelves.update(shelfId, { name, updatedAt })` → fetch-then-put pattern via `syncableWrite('shelves', 'put', { ...existing, name, updatedAt })` (syncableWrite does not support partial update)
- `deleteShelf`: `db.shelves.delete(shelfId)` → `syncableWrite('shelves', 'delete', shelfId)`
- `addBookToShelf`: `db.bookShelves.put(entry)` → `syncableWrite('bookShelves', 'put', entry)`
- `removeBookFromShelf`: `db.bookShelves.delete(entry.id)` → `syncableWrite('bookShelves', 'delete', entry.id)`
- Zero remaining `db.shelves.put|add|delete|update` or `db.bookShelves.put|add|delete|update` calls in the store

**AC8 — `useReadingQueueStore` writes route through `syncableWrite`:**
All Dexie mutations in `src/stores/useReadingQueueStore.ts` use `syncableWrite`:
- `addToQueue`: `db.readingQueue.put(entry)` → `syncableWrite('readingQueue', 'put', entry)`
- `removeFromQueue`: `db.readingQueue.delete(entry.id)` → `syncableWrite('readingQueue', 'delete', entry.id)`
- `reorderQueue`: replace each `db.readingQueue.update(entry.id, { sortOrder })` call with fetch-then-put via `syncableWrite('readingQueue', 'put', { ...entry, sortOrder })`. All writes run sequentially within the existing method — no batch API needed.
- Zero remaining `db.readingQueue.put|add|delete|update` calls in the store

**AC9 — `sortOrder` (Dexie) maps to `position` (Supabase) via fieldMap:**
The Dexie `ReadingQueueEntry.sortOrder: number` field is synced to the Supabase `reading_queue.position INT` column. Update `tableRegistry.ts` `readingQueue` entry to include `fieldMap: { sortOrder: 'position' }`. This prevents drift between the client's existing `sortOrder` naming and the schema's `position` column.

**AC10 — Store refresh callbacks registered in `useSyncLifecycle`:**
`src/app/hooks/useSyncLifecycle.ts` registers refresh callbacks for all 4 tables so the download phase reloads in-memory state after sync:
- `syncEngine.registerStoreRefresh('bookReviews', () => useBookReviewStore.getState().loadReviews())`
- `syncEngine.registerStoreRefresh('shelves', () => useShelfStore.getState().loadShelves())`
- `syncEngine.registerStoreRefresh('bookShelves', () => useShelfStore.getState().loadShelves())` (shelf store owns both shelves and shelf memberships)
- `syncEngine.registerStoreRefresh('readingQueue', () => useReadingQueueStore.getState().loadQueue())`

**AC11 — Sync queue entries created on write:**
While authenticated, each mutation produces a `syncQueue` entry with the correct `tableName`, `operation`, `status: 'pending'`, and serialized payload. Unauthenticated writes persist to Dexie only (no queue entries), matching the existing `syncableWrite` contract.

**AC12 — Default shelves not duplicated on new-device sign-in:**
When a user signs in on Device B where Device A has seeded the 3 standard default shelves (e.g. "Favorites", "Currently Reading", "Want to Read") and Device B already created the same 3 defaults at its own first boot, the download phase must NOT end up with 6 shelf rows. Verified by an integration test scenario: Device B local has `[{ id: 'local-fav', name: 'Favorites', is_default: true }]`; server returns `[{ id: 'remote-fav', name: 'Favorites', is_default: true }]`; after download, Dexie contains exactly ONE "Favorites" shelf with `id: 'local-fav'`, and `mergedIdMap` contains `'remote-fav' → 'local-fav'`.

**AC13 — Unit tests cover all wiring and dedup:**
New Vitest unit test file `src/lib/sync/__tests__/p2-book-organization-sync.test.ts` verifies:
- `addReview` / `removeReview` → correct `syncQueue` entries for `bookReviews`
- `createShelf` / `updateShelf` / `deleteShelf` → correct `syncQueue` entries for `shelves`
- `addBookToShelf` / `removeBookFromShelf` → correct `syncQueue` entries for `bookShelves`
- `addToQueue` / `reorderQueue` (3-entry reorder) / `removeFromQueue` → correct `syncQueue` entries for `readingQueue` with `sortOrder → position` mapping applied in payload
- Unauthenticated: no queue entries for any of the above
- `dedupDefaultShelves`: same-name default collision → skip + mergedIdMap entry; different-name default → insert; non-default incoming with same name as local default → insert (only defaults dedupe)
- `book_shelves` download remap: when `mergedIdMap` has `'remote-fav' → 'local-fav'` and an incoming `bookShelves` entry has `shelf_id: 'remote-fav'`, inserted entry has `shelf_id: 'local-fav'`

## Tasks / Subtasks

- [ ] Task 1: Create Supabase migration `supabase/migrations/20260413000004_p2_book_organization.sql` (AC: 1, 2, 3)
  - [ ] 1.1 Header comment block: reference E94-S03, migration ordering (after P2 library `20260413000003`), idempotency policy, note on `reading_queue` DEFERRABLE constraint rationale
  - [ ] 1.2 Open `BEGIN;` transaction wrapper
  - [ ] 1.3 Unit 1 — `book_reviews` table: columns from AC1, `FOR ALL` RLS policy, `book_reviews_set_updated_at` trigger, `(user_id, updated_at)` + `(user_id, book_id)` indexes
  - [ ] 1.4 Unit 2 — `shelves` table: columns from AC1, RLS policy, `shelves_set_updated_at` trigger, `(user_id, updated_at)` index
  - [ ] 1.5 Unit 3 — `book_shelves` table: columns from AC1 including `UNIQUE (user_id, book_id, shelf_id)`, RLS policy, `book_shelves_set_updated_at` trigger, `(user_id, updated_at)` + `(user_id, book_id)` + `(user_id, shelf_id)` indexes
  - [ ] 1.6 Unit 4 — `reading_queue` table: columns from AC1 including `UNIQUE (user_id, position) DEFERRABLE INITIALLY DEFERRED`, RLS policy, `reading_queue_set_updated_at` trigger, `(user_id, updated_at)` index
  - [ ] 1.7 Close `COMMIT;`
  - [ ] 1.8 Confirm migration is idempotent: apply twice on a local Supabase instance → no errors on second run

- [ ] Task 2: Create rollback script `supabase/migrations/rollback/20260413000004_p2_book_organization_rollback.sql` (AC: 2)
  - [ ] 2.1 `DROP TABLE IF EXISTS public.reading_queue CASCADE`
  - [ ] 2.2 `DROP TABLE IF EXISTS public.book_shelves CASCADE`
  - [ ] 2.3 `DROP TABLE IF EXISTS public.shelves CASCADE`
  - [ ] 2.4 `DROP TABLE IF EXISTS public.book_reviews CASCADE`

- [ ] Task 3: Update `tableRegistry.ts` `readingQueue` fieldMap (AC: 9)
  - [ ] 3.1 In `src/lib/sync/tableRegistry.ts`, set `readingQueue.fieldMap = { sortOrder: 'position' }` (currently empty `{}`)
  - [ ] 3.2 Verify `bookReviews`, `shelves`, `bookShelves` entries still have `fieldMap: {}` (no rename) and `conflictStrategy: 'lww'`, `priority: 2` — no changes needed
  - [ ] 3.3 Run `npx tsc --noEmit` — zero type errors

- [ ] Task 4: Wire `useBookReviewStore` through `syncableWrite` (AC: 6)
  - [ ] 4.1 Add `import { syncableWrite } from '@/lib/sync/syncableWrite'` at the top of `src/stores/useBookReviewStore.ts`
  - [ ] 4.2 Line 71 — `db.bookReviews.put(review)` → `await syncableWrite('bookReviews', 'put', review)` (inside upsert branch)
  - [ ] 4.3 Line 96 — `db.bookReviews.put(review)` → `await syncableWrite('bookReviews', 'put', review)` (inside update branch)
  - [ ] 4.4 Line 112 — `db.bookReviews.delete(existing.id)` → `await syncableWrite('bookReviews', 'delete', existing.id)`
  - [ ] 4.5 Grep the file for any remaining `db\.bookReviews\.(put|add|delete|update)` and confirm zero matches
  - [ ] 4.6 Run `npx tsc --noEmit` — zero type errors

- [ ] Task 5: Wire `useShelfStore` through `syncableWrite` (AC: 7)
  - [ ] 5.1 Add `syncableWrite` import at the top of `src/stores/useShelfStore.ts`
  - [ ] 5.2 Line 114 — `createShelf`: `db.shelves.put(shelf)` → `await syncableWrite('shelves', 'put', shelf)`
  - [ ] 5.3 Line 157 — `updateShelf` (rename): convert from partial update to fetch-then-put. Replace `db.shelves.update(shelfId, { name: trimmed, updatedAt: timestamp })` with:
    ```ts
    const existing = await db.shelves.get(shelfId)
    if (!existing) return
    await syncableWrite('shelves', 'put', { ...existing, name: trimmed, updatedAt: timestamp })
    ```
  - [ ] 5.4 Line 184 — `deleteShelf`: `db.shelves.delete(shelfId)` → `await syncableWrite('shelves', 'delete', shelfId)`
  - [ ] 5.5 Line 212 — `addBookToShelf`: `db.bookShelves.put(entry)` → `await syncableWrite('bookShelves', 'put', entry)`
  - [ ] 5.6 Line 235 — `removeBookFromShelf`: `db.bookShelves.delete(entry.id)` → `await syncableWrite('bookShelves', 'delete', entry.id)`
  - [ ] 5.7 Grep the file for any remaining `db\.(shelves|bookShelves)\.(put|add|delete|update)` and confirm zero matches
  - [ ] 5.8 Run `npx tsc --noEmit` — zero type errors

- [ ] Task 6: Wire `useReadingQueueStore` through `syncableWrite` (AC: 8)
  - [ ] 6.1 Add `syncableWrite` import at the top of `src/stores/useReadingQueueStore.ts`
  - [ ] 6.2 Line 62 — `addToQueue`: `db.readingQueue.put(entry)` → `await syncableWrite('readingQueue', 'put', entry)`
  - [ ] 6.3 Line 81 — `removeFromQueue`: `db.readingQueue.delete(entry.id)` → `await syncableWrite('readingQueue', 'delete', entry.id)`
  - [ ] 6.4 Line 103 — `reorderQueue`: inside the loop, replace `db.readingQueue.update(entry.id, { sortOrder: entry.sortOrder })` with `await syncableWrite('readingQueue', 'put', { ...entry })` (the reorder method already has the full entry with updated sortOrder in scope; no extra fetch required). Confirm writes run sequentially — existing semantics preserved.
  - [ ] 6.5 Grep the file for any remaining `db\.readingQueue\.(put|add|delete|update)` and confirm zero matches
  - [ ] 6.6 Run `npx tsc --noEmit` — zero type errors

- [ ] Task 7: Implement `dedupDefaultShelves` helper (AC: 4, 5, 12)
  - [ ] 7.1 Create `src/lib/sync/defaultShelfDedup.ts` exporting:
    ```ts
    export interface DedupResult {
      toInsert: Shelf[]
      toSkip: Shelf[]
      mergedIdMap: Record<string, string> // incomingId → existingLocalId
    }
    export function dedupDefaultShelves(
      incoming: Shelf[],
      existingLocal: Shelf[]
    ): DedupResult
    ```
  - [ ] 7.2 Algorithm:
    - Build lookup: `localDefaultsByName: Map<string, Shelf>` from `existingLocal.filter(s => s.isDefault === true)`, keyed by `name.toLowerCase().trim()`
    - For each `incoming` shelf: if `incoming.isDefault === true` AND `localDefaultsByName.has(incoming.name.toLowerCase().trim())` → push to `toSkip`, add `incoming.id → existing.id` to `mergedIdMap`; otherwise push to `toInsert`
  - [ ] 7.3 Hook into download apply phase for `shelves` table (locate in `src/lib/sync/downloadApply.ts` or equivalent — see Key Existing Files). Call `dedupDefaultShelves` BEFORE the `bulkPut` into Dexie. Write `toInsert` via normal path; log `toSkip.length` at debug level; persist `mergedIdMap` to `syncMetadata` under key `shelfDedupMap:{userId}` (merging with any existing map).
  - [ ] 7.4 Hook into download apply phase for `book_shelves` table: load the current `shelfDedupMap:{userId}` from `syncMetadata`; for each incoming `bookShelves` row, if `mergedIdMap[row.shelfId]` exists, rewrite `row.shelfId` to the mapped local id before insert.
  - [ ] 7.5 Order matters: shelves must be applied BEFORE bookShelves in the download batch so the map exists when bookShelves runs. Confirm by reading `tableRegistry.ts` ordering (`shelves` appears before `bookShelves` in the registry array — priority ties resolve by registration order).

- [ ] Task 8: Register store refresh callbacks in `useSyncLifecycle.ts` (AC: 10)
  - [ ] 8.1 Add imports: `useBookReviewStore`, `useShelfStore`, `useReadingQueueStore`
  - [ ] 8.2 After the existing `books` registration (line ~128), append:
    ```ts
    syncEngine.registerStoreRefresh('bookReviews', () => useBookReviewStore.getState().loadReviews())
    syncEngine.registerStoreRefresh('shelves', () => useShelfStore.getState().loadShelves())
    syncEngine.registerStoreRefresh('bookShelves', () => useShelfStore.getState().loadShelves())
    syncEngine.registerStoreRefresh('readingQueue', () => useReadingQueueStore.getState().loadQueue())
    ```
  - [ ] 8.3 Run existing `useSyncLifecycle.test.ts` — no registration-order assertion should break

- [ ] Task 9: Write unit tests `src/lib/sync/__tests__/p2-book-organization-sync.test.ts` (AC: 11, 13)
  - [ ] 9.1 Setup: reuse the pattern from `p1-notes-bookmarks-sync.test.ts` (mock auth, init Dexie fake, clear syncQueue)
  - [ ] 9.2 Test group 1 — bookReviews: addReview → queue entry `tableName: 'bookReviews'`, `operation: 'put'`; removeReview → `operation: 'delete'`
  - [ ] 9.3 Test group 2 — shelves: createShelf → put; updateShelf (rename) → put (verify payload contains full existing shelf merged with new name); deleteShelf → delete
  - [ ] 9.4 Test group 3 — bookShelves: addBookToShelf → put; removeBookFromShelf → delete
  - [ ] 9.5 Test group 4 — readingQueue: addToQueue → put (verify payload contains `position` key, not `sortOrder`, due to fieldMap); reorderQueue (3-entry [A, B, C] → [C, A, B]) → 3 put entries with remapped positions; removeFromQueue → delete
  - [ ] 9.6 Test group 5 — unauthenticated: mock auth returning no user; perform one write per store; assert zero syncQueue entries across all 4 tables
  - [ ] 9.7 Test group 6 — `dedupDefaultShelves` (pure function, no Dexie needed): 3 cases from AC4 + the book_shelves remap scenario from AC5 + the new-device scenario from AC12
  - [ ] 9.8 Run `npm run test:unit -- p2-book-organization-sync` — all tests pass

- [ ] Task 10: E2E / integration smoke test (AC: 12) — **optional if unit tests cover AC12 with sufficient fidelity**
  - [ ] 10.1 If time permits, add a Playwright spec at `tests/e2e/e94-s03-library-organization-sync.spec.ts` that:
    - Seeds Dexie with local default shelves on Device B
    - Injects server-side shelves via the existing sync test harness
    - Triggers fullSync
    - Asserts final Dexie has 3 default shelves (not 6), matching the "new-device sign-in" scenario
  - [ ] 10.2 If skipped, add a `known-issue` note in `docs/known-issues.yaml` flagging that AC12 is only unit-tested and cross-device behavior should be validated manually during the E94 epic closeout

- [ ] Task 11: Verification and cleanup
  - [ ] 11.1 `npm run lint` — zero errors (auto-fix where possible)
  - [ ] 11.2 `npx tsc --noEmit` — zero type errors
  - [ ] 11.3 `npm run test:unit` — full suite passes, including the new `p2-book-organization-sync.test.ts`
  - [ ] 11.4 `npm run build` — production build succeeds
  - [ ] 11.5 Grep across `src/stores/useBookReviewStore.ts`, `src/stores/useShelfStore.ts`, `src/stores/useReadingQueueStore.ts` for any remaining `db\.(bookReviews|shelves|bookShelves|readingQueue)\.(put|add|delete|update)` patterns → expect zero matches

## Design Guidance

No UI changes. This is a data-sync wiring story — the existing UI for reviews, shelves, and reading queue already reads from the Dexie stores and will automatically reflect synced data once the download phase populates Dexie.

Follow the established pattern from E93-S02 (notes + bookmarks wiring) and the E92-S09 P0 wiring stories: the contract of `syncableWrite` is "write to Dexie first, then enqueue for Supabase; unauthenticated writes skip the queue silently."

## Implementation Notes

### Why the `sortOrder → position` fieldMap

The Dexie `ReadingQueueEntry` type already uses `sortOrder: number` (see `src/data/types.ts` — established before sync was designed). The Supabase schema uses `position INT` which matches the product-level concept (queue position, 1-indexed visually). Renaming in Supabase is cleaner than renaming in Dexie and risking a v53+ migration. The `fieldMap: { sortOrder: 'position' }` entry in `tableRegistry.ts` handles the translation in both directions automatically.

### Why `DEFERRABLE INITIALLY DEFERRED` on `reading_queue`

A typical reorder operation swaps positions: book A from 2 → 3, book B from 3 → 2. With a non-deferrable `UNIQUE (user_id, position)` constraint, the first UPDATE would transiently create two rows at position 3 and fail. `DEFERRABLE INITIALLY DEFERRED` postpones the uniqueness check until COMMIT, letting the transaction see a consistent final state.

### Default-shelf dedup rationale

The Knowlune client seeds 3 default shelves on first launch (e.g. "Favorites", "Currently Reading", "Want to Read") keyed by local UUIDs. When a user signs in on Device B having already run on Device A, the server returns Device A's default shelves with *different* UUIDs but the *same* names and `is_default: true`. Without dedup, Device B would end up with 6 shelves.

The chosen strategy is client-side name+isDefault matching rather than a unique DB constraint because:
- A DB-level `UNIQUE (user_id, name) WHERE is_default = true` would reject the downloaded shelf outright, causing a sync-queue error
- Users can create custom (non-default) shelves named "Favorites" — we must NOT dedupe those
- The remap persistence (`mergedIdMap` in `syncMetadata`) lets subsequent syncs also remap `book_shelves.shelf_id` correctly

### `syncableWrite` does not support partial update

Like E93-S02, this story converts every `db.*.update(id, { ...partial })` call to a fetch-then-put pattern. The overhead is one extra read per update — acceptable for the write frequency here (shelf renames and queue reorders are infrequent).

### Migration ordering

This migration's filename prefix `20260413000004` places it after the P2 library migration (`20260413000003` from E94-S01). E94-S01 MUST be merged and deployed before this migration runs, because `book_reviews.book_id` and `book_shelves.book_id` reference books rows (logical FK — no hard FK constraint, but conceptually depends on the `books` table existing). Confirm with the E94 epic tracker that E94-S01 is marked `done` before running this migration against shared environments.

### Key Existing Files

| File | Relevance |
|------|-----------|
| `src/stores/useBookReviewStore.ts` | Target of Task 4 (3 write sites at lines 71, 96, 112) |
| `src/stores/useShelfStore.ts` | Target of Task 5 (6 write sites at lines 114, 157, 184, 212, 235) |
| `src/stores/useReadingQueueStore.ts` | Target of Task 6 (3 write sites at lines 62, 81, 103) |
| `src/lib/sync/tableRegistry.ts` | Registry entries for bookReviews/shelves/bookShelves/readingQueue already exist (lines 362–392); Task 3 adds the sortOrder fieldMap |
| `src/lib/sync/syncableWrite.ts` | Public API for all wiring — do NOT modify |
| `src/app/hooks/useSyncLifecycle.ts` | Registers store-refresh callbacks (line ~110-131); Task 8 extends this |
| `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` | Test pattern reference for Task 9 |
| `docs/implementation-artifacts/stories/E93-S02-wire-notes-and-bookmarks-with-sync.md` | Closest precedent story — same wiring pattern |
| `docs/implementation-artifacts/stories/E94-S01-p2-supabase-migrations-courses-videos-pdfs-authors-books.md` | Pattern reference for the SQL migration structure (Task 1) |
| `supabase/migrations/20260413000001_p0_sync_foundation.sql` | RLS + moddatetime + index patterns |
| `docs/planning-artifacts/epics-supabase-data-sync.md` (Epic 94, E94-S03) | Source requirements |

## Testing Notes

### Test Strategy

1. **Unit tests (primary)** — `src/lib/sync/__tests__/p2-book-organization-sync.test.ts` covers all store wiring, fieldMap translation, and the `dedupDefaultShelves` pure function. This is the fastest, most reliable layer.
2. **Migration smoke test** — Apply the migration locally via `supabase db push` (or equivalent), verify tables+indexes+triggers exist via `information_schema` queries, verify RLS blocks cross-user access, verify the DEFERRABLE constraint allows swap-reorders.
3. **Optional E2E** — Multi-device sync test for AC12 is nice-to-have; unit coverage of `dedupDefaultShelves` satisfies the functional requirement. Defer to E94 closeout or manual QA if time-boxed.

### Regression Guardrails

- Existing `useBookReviewStore.test.ts`, `useShelfStore.test.ts`, `useReadingQueueStore.test.ts` (check presence) should continue to pass unchanged — `syncableWrite` is transparent to store consumers when authenticated (writes still land in Dexie) and when unauthenticated (same contract).
- `useSyncLifecycle.test.ts` must continue to pass — new `registerStoreRefresh` calls should not break the order-of-initialization assertions (AC10 in that spec).

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
