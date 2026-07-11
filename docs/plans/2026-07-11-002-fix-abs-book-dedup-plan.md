---
title: "fix: Deduplicate ABS books by canonical serverId:itemId identity"
type: fix
status: completed
date: 2026-07-11
---

# fix: Deduplicate ABS Books by Canonical Identity

## Overview

Prevent Audiobookshelf catalog sync from creating duplicate `Book` records when the same ABS library item arrives through multiple paths — duplicate library IDs in server config, or the same item appearing in multiple libraries on the same server. Add a one-time reconciliation to clean any existing duplicates that accumulated before this fix.

## Problem Frame

When `useAudiobookshelfSync` fetches library items from an ABS server, it iterates `server.libraryIds` and pushes every valid item into `allMappedBooks` without checking whether an item with the same `absServerId:absItemId` was already added from a previous library iteration. The downstream `bulkUpsertAbsBooks` only deduplicates incoming books against *existing* store state — it does not detect duplicates within the incoming batch itself.

This means:
- **Duplicate library IDs** in `server.libraryIds` cause every item from that library to be mapped twice, producing two `Book` records with different UUIDs but the same `absServerId` + `absItemId`.
- **Same item in multiple libraries** on the same server (e.g., an audiobook present in both a "Fiction" and an "All" library) creates duplicate `Book` records.
- **Existing duplicates** from past syncs persist indefinitely — each re-sync updates only one of the duplicates (the first one `absKeyMap` finds), leaving the other(s) untouched and still visible in "Continue Listening" and the library grid.

The canonical identity for an ABS-sourced book is the compound key `absServerId:absItemId`. Both fields are populated by `mapAbsItemToBook` at [src/app/hooks/useAudiobookshelfSync.ts:224-225](src/app/hooks/useAudiobookshelfSync.ts#L224-L225).

## Requirements Trace

### Behavioral Invariants (at all times)

- **R1.** No two `Book` records with the same `absServerId` + `absItemId` (both non-null) shall coexist in the store after a sync completes.
- **R4.** Cross-server books — same `absItemId` but different `absServerId` — must remain separate (different servers are different sources).

### Migration (one-time)

- **R2.** Existing duplicate ABS books shall be cleaned up exactly once, preserving the canonical copy with the most user progress.

### Non-functional Constraints

- **R3.** The fix must not affect locally-imported books (EPUB/PDF with no `absServerId`/`absItemId`).

## Scope Boundaries

- **In scope:** Dedup by `absServerId:absItemId` at sync ingress, within the bulk upsert batch, and a one-time reconciliation of existing duplicates on next `loadBooks`.
- **Out of scope:** Adding a compound Dexie unique index on `[absServerId+absItemId]`. This is deferred until after the reconciliation proves the data is clean — a unique index on dirty data would throw on `bulkPut`. Tracked as a follow-up chore.
- **Out of scope:** Cross-server deduplication (R4 explicitly preserves separate records per server).
- **Out of scope:** UI/shelf changes — "Continue Listening" and library grid display are downstream consumers; fixing the data source fixes the symptom.

## Context & Research

### Relevant Code and Patterns

| File | Role |
|---|---|
| [src/app/hooks/useAudiobookshelfSync.ts](src/app/hooks/useAudiobookshelfSync.ts#L262-L387) | `syncCatalog` — fetches items per library, maps to `Book[]`, calls `bulkUpsertAbsBooks` |
| [src/app/hooks/useAudiobookshelfSync.ts:149-230](src/app/hooks/useAudiobookshelfSync.ts#L149-L230) | `mapAbsItemToBook` — creates a `Book` with `absServerId` and `absItemId` set at lines 224-225 |
| [src/stores/useBookStore.ts:584-645](src/stores/useBookStore.ts#L584-L645) | `bulkUpsertAbsBooks` — builds `absKeyMap` from existing store books, merges metadata, calls `db.books.bulkPut` |
| [src/stores/useBookStore.ts:118-122](src/stores/useBookStore.ts#L118-L122) | `loadBooks` — loads all books from Dexie on app startup, guarded by `isLoaded` flag |
| [src/stores/useBookStore.ts:542-582](src/stores/useBookStore.ts#L542-L582) | `upsertAbsBook` — single-book variant, same dedup pattern |
| [src/db/checkpoint.ts](src/db/checkpoint.ts) | `CHECKPOINT_SCHEMA` pattern — localStorage-based migration markers with versioning |
| [src/data/types.ts:918-959](src/data/types.ts#L918-L959) | `Book` interface — `absServerId?: string` at line 943, `absItemId?: string` at line 944 |
| [src/stores/__tests__/useBookStore.test.ts](src/stores/__tests__/useBookStore.test.ts) | Existing store tests with `makeBook` factory helper |
| [src/app/hooks/__tests__/useAudiobookshelfSync.map.test.ts](src/app/hooks/__tests__/useAudiobookshelfSync.map.test.ts) | Existing `mapAbsItemToBook` tests |

### Institutional Learnings

- **`docs/solutions/sync/abs-sync-qa-fix-patterns-2026-04-24.md`** — Prior ABS sync QA pass established patterns for guard clauses and safe state updates. The `try/finally` deadlock guard and inline semaphore patterns don't apply here, but the defensive posture does.
- **`docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`** — The `getAbsBookKey` helper qualifies as a shared primitive on its second consumer (`upsertAbsBook` + `bulkUpsertAbsBooks` both build the key inline). Extract it rather than duplicate the template literal a third time.
- **`src/db/checkpoint.ts`** — Established pattern for versioned localStorage markers (`knowlune-checkpoint-v{version}`). The reconciliation marker should follow this convention as `knowlune-abs-dedup-v1`.

## Key Technical Decisions

- **Three-layer defense, not one:** Dedup at ingress (cheapest — prevents duplicates from entering the batch), within `bulkUpsertAbsBooks` (defense in depth — catches any path that constructs a `Book[]` with duplicates), and a one-time reconciliation (cleans existing data). Ingress-only would miss programmatic callers of `bulkUpsertAbsBooks`; bulk-only would still let duplicates enter the batch silently.
- **localStorage marker for reconciliation, not Dexie:** The reconciliation mutates many rows and should run once. A localStorage flag is atomic, synchronous, and follows the existing `checkpoint.ts` convention. A Dexie-based flag would require a schema migration for a one-time operation.
- **Canonical selection: progress → lastOpenedAt → currentPosition → createdAt:** When reconciling duplicates, prefer the copy with the most user progress. If tied, prefer the most recently opened. If still tied, prefer the one with a valid `currentPosition`. Fall back to the oldest record (earliest `createdAt`).
- **Extract `getAbsBookKey` helper:** Both `upsertAbsBook` and `bulkUpsertAbsBooks` build the same `${absServerId}:${absItemId}` key. Extract a shared helper rather than adding a third inline construction in the reconciliation logic. Follow the "extract on second consumer" rule from institutional learnings.

## Implementation Units

- [ ] **Unit 1: Extract `getAbsBookKey` helper and deduplicate at sync ingress**

**Goal:** Prevent duplicate library IDs and duplicate items across libraries from entering the sync batch.

**Requirements:** R1, R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/app/hooks/useAudiobookshelfSync.ts`
- Modify: `src/stores/useBookStore.ts`
- Test: `src/app/hooks/__tests__/useAudiobookshelfSync.map.test.ts`
- Test: `src/stores/__tests__/useBookStore.test.ts`

**Approach:**
1. Add an exported `getAbsBookKey(serverId: string, itemId: string): string` helper at module scope in `useBookStore.ts` (or a shared lib — but start in the store since that's where both consumers live). This is a pure function: `"${serverId}:${itemId}"`.
2. Refactor `upsertAbsBook` and `bulkUpsertAbsBooks` to use `getAbsBookKey` instead of inline template literals.
3. In `syncCatalog` ([useAudiobookshelfSync.ts:315](src/app/hooks/useAudiobookshelfSync.ts#L315)), deduplicate `server.libraryIds` with `[...new Set(server.libraryIds)]` before iterating.
4. During the fetch loop ([lines 345-348](src/app/hooks/useAudiobookshelfSync.ts#L345-L348)), maintain a `Map<string, Book>` keyed by `getAbsBookKey(server.id, absItem.id)`. Before pushing a mapped book, check the map — if the key already exists, `console.warn` and skip. After all libraries are fetched, extract `[...seenMap.values()]` as the deduplicated `allMappedBooks`.

**Patterns to follow:**
- `getAbsBookKey` signature: same pattern as the inline template literal currently at [useBookStore.ts:593](src/stores/useBookStore.ts#L593) and [useBookStore.ts:561](src/stores/useBookStore.ts#L561).
- Map-based dedup pattern: same O(1) lookup approach already used in `bulkUpsertAbsBooks`'s `absKeyMap` at line 590.

**Test scenarios:**
- Happy path: `server.libraryIds` with duplicates → each library fetched once, items mapped once.
- Happy path: Same `absItemId` appears in two different libraries on the same server → only the first occurrence is kept, warning logged.
- Happy path: Items from different servers with the same `absItemId` → both kept (different `absServerId`, different key).
- Edge case: Empty `libraryIds` → no fetch, empty batch, no crash.
- Edge case: `getAbsBookKey` returns correct `${serverId}:${itemId}` format for valid inputs.

**Verification:**
- `npm run typecheck && npm run lint` passes.
- Existing `mapAbsItemToBook` tests still pass.
- New dedup behavior verified by unit tests.

---

- [ ] **Unit 2: Defensive dedup within `bulkUpsertAbsBooks` batch**

**Goal:** Ensure that even if duplicates reach `bulkUpsertAbsBooks` (e.g., from a future caller that doesn't go through `syncCatalog`), the batch itself is deduplicated before the Dexie write.

**Requirements:** R1, R3, R4

**Dependencies:** Unit 1 (for `getAbsBookKey` helper)

**Files:**
- Modify: `src/stores/useBookStore.ts`
- Test: `src/stores/__tests__/useBookStore.test.ts`

**Approach:**
1. After building the existing `absKeyMap` (line 590), build a second `Map<string, Book>` from `newBooks` keyed by `getAbsBookKey`. This deduplicates the incoming batch against itself.
2. For books without both `absServerId` and `absItemId` (local EPUB/PDF), use `book.id` as the fallback key so they still pass through.
3. If a duplicate ABS key is detected within the batch, `console.warn` with the key and keep the *later* occurrence (last-write-wins within the batch — consistent with the fact that later items may have fresher metadata from a more specific library).
4. Use the deduplicated array for the existing-vs-new merge step (lines 597-611) and stale-book purge (lines 614-622).

**Patterns to follow:**
- Same Map-based dedup pattern as the existing `absKeyMap` at [useBookStore.ts:590-595](src/stores/useBookStore.ts#L590-L595).
- `getAbsBookKey` extracted in Unit 1.

**Test scenarios:**
- Happy path: Batch with duplicate `absServerId:absItemId` → one `Book` persisted, warning logged.
- Happy path: Idempotent re-sync of the same books → no duplicates created (existing behavior preserved).
- Happy path: Local books (no `absServerId`) in the same batch → unaffected, each gets its own record.
- Edge case: Cross-server same `absItemId` → treated as distinct (different `absServerId`), both kept.
- Edge case: Book with `absServerId` but no `absItemId` (malformed) → falls through to `book.id` key, not collapsed with other malformed books.

**Verification:**
- `npm run typecheck && npm run lint` passes.
- All existing `bulkUpsertAbsBooks` tests pass.
- New dedup tests pass.

---

- [ ] **Unit 3: One-time reconciliation of existing duplicates on `loadBooks`**

**Goal:** Clean up any duplicate ABS books that accumulated in the database before this fix shipped.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 1 (for `getAbsBookKey` helper)

**Files:**
- Modify: `src/stores/useBookStore.ts`
- Test: `src/stores/__tests__/useBookStore.test.ts`

**Approach:**
1. Add a `reconcileAbsDuplicates(books: Book[]): Book[]` function that:
   a. Groups books by `getAbsBookKey` (skip books missing `absServerId` or `absItemId`).
   b. For groups with >1 book, selects a canonical copy using the priority: highest `progress` → newest `lastOpenedAt` → has valid `currentPosition` → earliest `createdAt`.
   c. Merges user-facing metadata from non-canonical copies onto the canonical copy using an explicit allow-list: `description`, `series`, `seriesSequence`, `narrator`, `isbn`, `asin`, `language`, `publishDate`, `genre`, `tags`. Only merge when the canonical field is `undefined`/`null`/empty and the duplicate has a value. Exclude system/identity fields (`userId`, `guestSessionId`, `offlinePath`, `absServerId`, `absItemId`, `linkedBookId`, `sourceType`, `sourceUrl`, `fileUrl`, `updatedAt`) — these must remain as-is on the canonical copy.
   d. Collects IDs of non-canonical duplicates for deletion.
   e. Logs `console.info` with the count of duplicates found and removed.
   f. Returns the deduplicated book array (canonical copies + non-ABS books unchanged).
2. Integrate into `loadBooks` ([useBookStore.ts:118-122](src/stores/useBookStore.ts#L118-L122)):
   a. After `db.books.toArray()`, check `localStorage.getItem('knowlune-abs-dedup-v1')`.
   b. If absent, run `reconcileAbsDuplicates`, delete non-canonical IDs via `db.books.bulkDelete`, set the localStorage marker, and use the reconciled array for `set()`.
   c. If present, skip reconciliation — normal fast path.
3. The reconciliation runs synchronously within `loadBooks` before `isLoaded` is set to `true`, so consumers see clean data from the start.

**Patterns to follow:**
- localStorage marker convention: `knowlune-{purpose}-v{version}`, following `src/db/checkpoint.ts`'s `CHECKPOINT_SCHEMA` pattern.
- `loadBooks` guard pattern: existing `isLoaded` check at line 119 — the reconciliation must complete before `isLoaded` flips to `true`, same as the existing `toArray()` call.
- `getAbsBookKey` extracted in Unit 1.

**Test scenarios:**
- Happy path: Two books with same `absServerId:absItemId`, one at 60% progress, one at 30% → 60% progress copy kept, 30% deleted, marker set.
- Happy path: Tied progress (both 50%), book A has newer `lastOpenedAt` → book A kept.
- Happy path: No duplicates exist → no deletions, marker still set, `isLoaded` proceeds normally.
- Happy path: Marker already present → reconciliation skipped entirely (verify via spy that `bulkDelete` is never called).
- Edge case: Books with no `absServerId`/`absItemId` (local imports) → passed through unchanged.
- Edge case: Three duplicates → exactly 2 deleted, 1 kept with merged metadata.
- Edge case: Canonical missing `description` but duplicate has one → merged onto canonical.
- Error path: `bulkDelete` fails → error caught, `toast.error`, marker NOT set (retry on next `loadBooks`).

**Verification:**
- `npm run typecheck && npm run lint` passes.
- Reconciliation tests pass in isolation.
- App boots cleanly with existing IndexedDB data.

---

- [ ] **Unit 4: Final verification**

**Goal:** Confirm all quality gates pass with the complete change set.

**Dependencies:** Units 1-3

**Files:** (none new — verification only)

**Approach:**
1. Run `npm run typecheck` — must pass with `strict: true`.
2. Run `npm run lint` — must pass (ESLint cache OK).
3. Run `npm run format:check` — must pass.
4. Run `npm run build` — production build must succeed.
5. Run `npm run test:unit` — all existing and new tests must pass.

**Test scenarios:** N/A (verification unit)

**Verification:**
- All five commands exit zero.

## System-Wide Impact

- **Interaction graph:** `loadBooks` → reconciliation (new, gated by localStorage marker). `syncCatalog` → `bulkUpsertAbsBooks` (existing path, hardened). No new store subscriptions or event bus emissions.
- **Error propagation:** Reconciliation failure logs a toast and skips the marker — retries on next `loadBooks`. Sync ingress dedup failures are non-fatal (`console.warn`, continue with deduplicated set). Bulk upsert dedup failures are similarly non-fatal.
- **State lifecycle risks:** The reconciliation mutates `db.books` before `isLoaded` flips. If it crashes mid-reconciliation, the marker is not set and the next `loadBooks` retries. No partial state is exposed to consumers.
- **API surface parity:** `getAbsBookKey` is a new exported helper — it should be importable by sync hooks and test files. No existing public API signatures change.
- **Integration coverage:** The full flow — sync ingress dedup, bulk upsert dedup, and `loadBooks` reconciliation (with persistence as an intermediate step) — spans the three defensive layers described in Key Technical Decisions. Unit tests cover each layer in isolation; a manual smoke test of running an ABS sync with a known duplicate library ID config would provide end-to-end confidence.
- **Unchanged invariants:** Local books (no `absServerId`) are never collapsed or deleted. Cross-server books (same `absItemId`, different `absServerId`) remain separate. The `Book.id` UUID remains the primary key in Dexie — this plan adds a logical uniqueness constraint at the application layer, not a schema-level unique index.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Reconciliation deletes a book the user was actively reading | Canonical selection prefers highest progress + newest `lastOpenedAt`, so the copy with the most reading activity survives |
| Large library (1000+ books) makes reconciliation slow | Reconciliation is O(n) single-pass over the `toArray()` result. For 10k books this is well under 100ms. The marker ensures it runs exactly once |
| Future code adds a third caller of `getAbsBookKey` outside the store | The helper is exported from `useBookStore.ts`. If a third consumer emerges in a different module, extract to `src/lib/bookKey.ts` as a follow-up |

## Sources & References

- **Origin:** User research and codebase exploration (2026-07-11)
- Related code: [src/app/hooks/useAudiobookshelfSync.ts](src/app/hooks/useAudiobookshelfSync.ts), [src/stores/useBookStore.ts](src/stores/useBookStore.ts), [src/data/types.ts](src/data/types.ts)
- Institutional: [docs/solutions/sync/abs-sync-qa-fix-patterns-2026-04-24.md](docs/solutions/sync/abs-sync-qa-fix-patterns-2026-04-24.md), [docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md](docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md)
- Pattern reference: [src/db/checkpoint.ts](src/db/checkpoint.ts) (localStorage migration markers)
