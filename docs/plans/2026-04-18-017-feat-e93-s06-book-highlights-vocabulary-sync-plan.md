---
title: "feat: Wire book highlights and vocabulary stores through syncableWrite (E93-S06)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e93-s06-book-highlights-vocabulary-sync-requirements.md
---

# feat: Wire book highlights and vocabulary stores through syncableWrite (E93-S06)

## Overview

`useHighlightStore` and `useVocabularyStore` write directly to Dexie, bypassing the sync layer. This story routes all write mutations in both stores through `syncableWrite`, registers their store-refresh callbacks in `useSyncLifecycle`, adds the `vocabulary_items` entry to the `MONOTONIC_RPC` map in `syncEngine.ts`, and delivers unit tests that prove each mutation produces the correct `syncQueue` entry.

No Supabase migration is required (tables exist from E93-S01). No UI changes, no tableRegistry changes (both entries already exist and are correctly configured).

## Problem Frame

Learners who highlight passages or build vocabulary on one device see none of that data on other devices — the write path never reaches `syncQueue`, so the upload engine has nothing to push. For `vocabulary_items`, the mastery monotonic invariant (mastery level can only increase) must be preserved across devices via the `upsert_vocabulary_mastery` SECURITY DEFINER function. (See origin: `docs/brainstorms/2026-04-18-e93-s06-book-highlights-vocabulary-sync-requirements.md`)

## Requirements Trace

- R1. `bookHighlights` tableRegistry entry is verified correct (LWW, no fieldMap).
- R2. `vocabularyItems` tableRegistry entry is verified correct (monotonic, `monotonicFields: ['masteryLevel']`, no fieldMap).
- R3. All `useHighlightStore` writes route through `syncableWrite` with `persistWithRetry`.
- R4. All `useVocabularyStore` writes route through `syncableWrite` with `persistWithRetry`; `advanceMastery` and `resetMastery` use fetch-then-put.
- R5. `syncEngine.ts` `MONOTONIC_RPC` map includes `vocabulary_items` entry pointing to `upsert_vocabulary_mastery` with all NOT NULL params (`p_user_id`, `p_vocabulary_item_id`, `p_mastery_level`, `p_book_id`, `p_word`, `p_updated_at`).
- R6. `useSyncLifecycle.ts` registers store-refresh callbacks for `bookHighlights` and `vocabularyItems` before `fullSync()`.
- R7. Zero direct `db.bookHighlights` or `db.vocabularyItems` write calls remain after this story.
- R8. Unauthenticated writes persist to Dexie only — no `syncQueue` entries, no errors.
- R9. `cfiRange` survives a full Supabase round-trip byte-for-byte.
- R10. Unit tests cover all 8 mutation operations plus unauthenticated no-queue scenario.
- R11. `npx tsc --noEmit` passes with zero errors.

## Scope Boundaries

- No new Supabase migration (tables and SECURITY DEFINER function exist from E93-S01).
- No tableRegistry modifications (both entries already exist with correct config).
- No UI changes — this is a pure infrastructure story.
- `flashcardId` / `highlightId` FK integrity not enforced — fields sync as plain UUIDs by design.
- Bulk backfill of pre-existing records is out of scope (E97 initial upload wizard).
- `BookHighlight` has no soft-delete field — no soft-delete pattern needed here (type inspection confirmed: no `deleted` / `softDeleted` field).

### Deferred to Separate Tasks

- Initial upload wizard for pre-existing records: E97
- `contentProgress` store refresh (requires mandatory `courseId` arg, no `loadAll()` — documented limitation in `useSyncLifecycle.ts`).

## Context & Research

### Relevant Code and Patterns

- `src/stores/useHighlightStore.ts` — 3 write operations: `createHighlight` (direct `db.bookHighlights.put`), `updateHighlight` (direct `db.bookHighlights.update`), `deleteHighlight` (direct `db.bookHighlights.delete`). No soft-delete field on `BookHighlight` type.
- `src/stores/useVocabularyStore.ts` — 5 write operations: `addItem`, `updateItem`, `deleteItem`, `advanceMastery`, `resetMastery`. `advanceMastery` and `resetMastery` currently use `db.vocabularyItems.update(id, updates)` — must convert to fetch-then-put.
- `src/lib/sync/tableRegistry.ts` lines 204-219 — both `bookHighlights` (LWW) and `vocabularyItems` (monotonic, `monotonicFields: ['masteryLevel']`) entries are already correct. No change needed.
- `src/lib/sync/syncableWrite.ts` — E92-S04 pattern. Stamps `userId` + `updatedAt`, writes Dexie, enqueues `SyncQueueEntry`, nudges engine.
- `src/lib/sync/syncEngine.ts` `MONOTONIC_RPC` map (lines ~67-90) — `content_progress` is the existing example. `vocabulary_items` must be added here to avoid the "no monotonic RPC — falling back to generic upsert" warning path.
- `src/app/hooks/useSyncLifecycle.ts` — registration block before `fullSync()` (lines 49-67). Pattern: `syncEngine.registerStoreRefresh('tableName', () => useXxxStore.getState().loadXxx())`.
- `src/stores/useNoteStore.ts` — canonical `persistWithRetry(() => syncableWrite(...))` pattern; fetch-then-put for `softDelete`/`restoreNote`.
- `src/stores/useBookmarkStore.ts` — nearest example of fetch-then-put for `updateBookmarkLabel`.
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — test template: `fake-indexeddb/auto`, `vi.resetModules()`, `Dexie.delete('ElearningDB')` in `beforeEach`, `getQueueEntries(table)` helper.

### Institutional Learnings

- `syncableWrite` does not support partial `update(id, fields)` — always requires a full record. Use `db.<table>.get(id)` (read stays direct Dexie) then spread changes before calling `syncableWrite`.
- ES2020 target: no `Promise.any`; `Promise.allSettled` is fine.
- `updateItem` in `useVocabularyStore` currently saves `updatedAt` via a `now()` helper before the Dexie call — `syncableWrite` re-stamps `updatedAt` internally, so the caller-set value will be overwritten. This is acceptable (same behavior as all other stores).

### External References

- None needed — local patterns are well-established (5+ direct examples: notes, bookmarks, flashcards, studySessions, embeddings).

## Key Technical Decisions

- **`MONOTONIC_RPC` entry required in `syncEngine.ts`**: Without it the engine falls back to a generic upsert, bypassing the `GREATEST()` enforcement in `upsert_vocabulary_mastery`. Adding the entry is the only safe path for monotonic mastery upload.
- **`paramMap` must include `p_book_id` and `p_word`**: The function signature (updated in E93-S01 R1) has two additional NOT NULL params beyond the P0 `content_progress` pattern. The `paramMap` must map `book_id → p_book_id` and `word → p_word` so the engine extracts them from the `toSnakeCase` payload.
- **`highlights` are per-book; `loadHighlightsForBook` requires a `bookId`**: At refresh time inside `useSyncLifecycle`, no global "current book" context exists. Register a no-op (returns `Promise.resolve()`) with a comment documenting the limitation — highlights are re-loaded on next book navigation. This matches the established `contentProgress` non-registration precedent.
- **No soft-delete handling for `BookHighlight`**: Type inspection confirms no `deleted`/`softDeleted` field — `deleteHighlight` maps directly to `syncableWrite('bookHighlights', 'delete', id)`.
- **`persistWithRetry` wrapping**: Consistent with E93-S02 through E93-S05 patterns; all `syncableWrite` calls in store mutations must be wrapped.

## Open Questions

### Resolved During Planning

- **Does `BookHighlight` have a soft-delete field?** No — type definition (lines 802-820 in `src/data/types.ts`) has no `deleted` or `softDeleted` field. `deleteHighlight` is a hard delete.
- **Are tableRegistry entries already correct?** Yes — `bookHighlights` (lines 204-210) and `vocabularyItems` (lines 212-219) in `tableRegistry.ts` are exactly as required by AC1/AC2.
- **Does the engine already handle `vocabulary_items` monotonic RPC?** No — `MONOTONIC_RPC` map only contains `content_progress` today. Adding `vocabulary_items` is required work.
- **What is the `loadHighlightsForBook` no-op approach?** Register `() => Promise.resolve()` with a comment, consistent with the `contentProgress` skip pattern already documented in the hook.

### Deferred to Implementation

- Exact test fixture shape for `BookHighlight` and `VocabularyItem` in the test file — implementer constructs using `crypto.randomUUID()` and required fields from the type definitions.
- Whether `updateHighlight` in the store should preserve or strip the `optimistic updatedAt` set before `syncableWrite` — `syncableWrite` re-stamps so this is a no-op concern; confirm at implementation time.

## Implementation Units

- [ ] **Unit 1: Add `vocabulary_items` to `MONOTONIC_RPC` in `syncEngine.ts`**

**Goal:** Ensure the upload engine calls `upsert_vocabulary_mastery` instead of falling back to generic upsert for `vocabularyItems` queue entries.

**Requirements:** R2, R5

**Dependencies:** None (all prerequisites from E92-S05 are done)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`

**Approach:**
- Add a new entry to `MONOTONIC_RPC` keyed by `'vocabulary_items'` (the `supabaseTable` name).
- `rpcName`: `'upsert_vocabulary_mastery'`
- `paramMap`: maps snake_case payload keys to RPC parameter names. The `toSnakeCase` transform (via `fieldMapper.ts`) will have already converted camelCase record fields. Required mappings:
  - `user_id → p_user_id`
  - `id → p_vocabulary_item_id`
  - `mastery_level → p_mastery_level`
  - `book_id → p_book_id`
  - `word → p_word`
  - `updated_at → p_updated_at`
- Follow the exact shape of the existing `content_progress` entry.

**Patterns to follow:**
- `src/lib/sync/syncEngine.ts` `MONOTONIC_RPC` — `content_progress` entry (lines ~67-82)

**Test scenarios:**
- Test expectation: none — this is a configuration change to the engine's RPC dispatch table. The correctness is proved by integration: when `vocabularyItems` entries are in the queue, the engine calls `upsert_vocabulary_mastery` (not generic upsert). Full coverage is deferred to E2E testing against real Supabase.

**Verification:**
- `MONOTONIC_RPC['vocabulary_items']` is defined with all 6 param mappings.
- No TypeScript errors (`npx tsc --noEmit` passes).
- The fallback `console.warn` path for `vocabulary_items` is no longer reachable.

---

- [ ] **Unit 2: Wire `useHighlightStore` writes through `syncableWrite`**

**Goal:** Replace the three direct Dexie write calls in `useHighlightStore` with `syncableWrite` wrapped in `persistWithRetry`, matching the pattern from E93-S02.

**Requirements:** R3, R7, R8

**Dependencies:** None (syncableWrite and tableRegistry entry exist)

**Files:**
- Modify: `src/stores/useHighlightStore.ts`

**Approach:**
- Import `syncableWrite` from `@/lib/sync/syncableWrite` and `persistWithRetry` from `@/lib/persistWithRetry`.
- `createHighlight`: replace `db.bookHighlights.put(highlight)` with `persistWithRetry(() => syncableWrite('bookHighlights', 'put', highlight))`.
- `updateHighlight`: convert to fetch-then-put. The existing optimistic merge (`merged`) is already computed from the in-memory state. Replace `db.bookHighlights.update(highlightId, { ...updates, updatedAt })` with `persistWithRetry(() => syncableWrite('bookHighlights', 'put', merged))`. The `db.bookHighlights.update` call is not safe for sync (partial update); the merged object already has all fields from the in-memory record.
  - Note: the current code derives `merged` from `get().highlights` (in-memory). This is acceptable — if the in-memory record is current (it will be after the optimistic update), the fetch-then-put can reuse the same merged value. A Dexie `get` is also acceptable if implementer prefers the canonical DB read pattern.
- `deleteHighlight`: replace `db.bookHighlights.delete(highlightId)` with `persistWithRetry(() => syncableWrite('bookHighlights', 'delete', highlightId))`. No soft-delete path needed.
- All `db.bookHighlights` read calls (`where`, `sortBy`) remain unchanged — only writes switch.
- Remove the `db` import if no other direct Dexie calls remain; otherwise keep it for reads.

**Patterns to follow:**
- `src/stores/useNoteStore.ts` — `persistWithRetry(() => syncableWrite(...))` for create/delete
- `src/stores/useBookmarkStore.ts` — fetch-then-put for `updateBookmarkLabel`

**Test scenarios:**
- Happy path, `createHighlight` authenticated → Dexie has record with `userId` stamped; `syncQueue` has one `put` entry for `bookHighlights`
- Happy path, `updateHighlight` → `syncQueue` has `put` entry for `bookHighlights` with merged fields
- Happy path, `deleteHighlight` → Dexie record absent; `syncQueue` has `delete` entry with `{ id: highlightId }`
- Edge case, `updateHighlight` on unknown `highlightId` → no queue entry, no error thrown (existing guard `if (!prev) return` preserved)
- Edge case, `deleteHighlight` on unknown `highlightId` → no queue entry, no error thrown
- Unauthenticated `createHighlight` → Dexie record present, zero `bookHighlights` syncQueue entries

**Verification:**
- `grep -n "db.bookHighlights.put\|db.bookHighlights.update\|db.bookHighlights.delete\|db.bookHighlights.add" src/stores/useHighlightStore.ts` returns zero results.
- Unit tests for this store pass.

---

- [ ] **Unit 3: Wire `useVocabularyStore` writes through `syncableWrite`**

**Goal:** Replace the five direct Dexie write calls in `useVocabularyStore` with `syncableWrite` wrapped in `persistWithRetry`; convert `advanceMastery` and `resetMastery` from partial-update to fetch-then-put.

**Requirements:** R4, R7, R8

**Dependencies:** Unit 1 (MONOTONIC_RPC entry must exist before testing the upload path, though unit tests mock Supabase and do not exercise the RPC directly)

**Files:**
- Modify: `src/stores/useVocabularyStore.ts`

**Approach:**
- Import `syncableWrite` and `persistWithRetry` (same imports as Unit 2).
- `addItem`: replace `db.vocabularyItems.put(item)` with `persistWithRetry(() => syncableWrite('vocabularyItems', 'put', item))`.
- `updateItem`: already has a partial `fullUpdates` pattern. Convert to fetch-then-put: read `db.vocabularyItems.get(id)` first; if not found, return. Merge `{ ...existing, ...fullUpdates }` then call `persistWithRetry(() => syncableWrite('vocabularyItems', 'put', merged))`.
- `deleteItem`: replace `db.vocabularyItems.delete(id)` with `persistWithRetry(() => syncableWrite('vocabularyItems', 'delete', id))`.
- `advanceMastery`: already has in-memory `item` read via `get().items.find(...)`. Extend with a Dexie `db.vocabularyItems.get(id)` read for the full record. Build the merged full object (`{ ...existing, masteryLevel: newLevel, lastReviewedAt: timestamp, updatedAt: timestamp }`), then call `persistWithRetry(() => syncableWrite('vocabularyItems', 'put', fullMerged))`. Replace the `db.vocabularyItems.update(id, updates)` call.
- `resetMastery`: same pattern as `advanceMastery`. Fetch full record, merge updates (mastery 0, new timestamps), call `syncableWrite` via `persistWithRetry`. Replace the `db.vocabularyItems.update(id, updates)` call.
- All `db.vocabularyItems` read calls (`where`, `orderBy`, `toArray`, `get`) remain unchanged.
- The `toast.error` catch handlers remain — they surface Dexie write failures to the user.

**Patterns to follow:**
- `src/stores/useNoteStore.ts` — `persistWithRetry`, `softDelete` fetch-then-put pattern
- `src/stores/useBookmarkStore.ts` — `updateBookmarkLabel` fetch-then-put
- `src/stores/useHighlightStore.ts` (after Unit 2) — `updateHighlight` fetch-then-put

**Test scenarios:**
- Happy path, `addItem` authenticated → `syncQueue` has `put` entry for `vocabularyItems`; `userId` stamped on stored record
- Happy path, `updateItem` → `syncQueue` has `put` entry; payload reflects full record (not just partial fields)
- Happy path, `deleteItem` → Dexie record absent; `syncQueue` has `delete` entry with `{ id }`
- Happy path, `advanceMastery` → `syncQueue` has `put` entry with `masteryLevel` incremented (e.g., 0 → 1); payload contains full record
- Happy path, `resetMastery` → `syncQueue` has `put` entry with `masteryLevel: 0`; `lastReviewedAt` updated
- Edge case, `advanceMastery` when `masteryLevel` is already 3 → no queue entry (guard `if (!item || item.masteryLevel >= 3) return` preserved)
- Edge case, `updateItem` on non-existent id → no queue entry, no error thrown (Dexie `get` returns undefined → return early)
- Unauthenticated `addItem` → Dexie record present, zero `vocabularyItems` syncQueue entries
- Unauthenticated `advanceMastery` → Dexie record updated locally, zero `vocabularyItems` syncQueue entries

**Verification:**
- `grep -n "db.vocabularyItems.put\|db.vocabularyItems.update\|db.vocabularyItems.delete\|db.vocabularyItems.add" src/stores/useVocabularyStore.ts` returns zero results.
- Unit tests pass.

---

- [ ] **Unit 4: Register store-refresh callbacks in `useSyncLifecycle`**

**Goal:** Ensure the sync engine can notify `useHighlightStore` and `useVocabularyStore` after a download phase completes, so in-memory state reflects the latest data pulled from Supabase.

**Requirements:** R6

**Dependencies:** Units 2 and 3 (stores must be wired before callbacks are meaningful)

**Files:**
- Modify: `src/app/hooks/useSyncLifecycle.ts`

**Approach:**
- Import `useHighlightStore` from `@/stores/useHighlightStore` and `useVocabularyStore` from `@/stores/useVocabularyStore`.
- Add two `registerStoreRefresh` calls in the registration block, after the existing entries and before `fullSync()`:
  - `syncEngine.registerStoreRefresh('bookHighlights', () => Promise.resolve())` — with an inline comment: `// Intentional: loadHighlightsForBook requires a bookId; no loadAll() variant exists. Highlights are re-loaded on next book navigation.`
  - `syncEngine.registerStoreRefresh('vocabularyItems', () => useVocabularyStore.getState().loadAllItems())`
- Place these registrations alongside the existing `notes`, `bookmarks`, `flashcards`, and `embeddings` registrations for readability.

**Patterns to follow:**
- `src/app/hooks/useSyncLifecycle.ts` lines 50-67 — existing `registerStoreRefresh` block
- The `embeddings` registration comment pattern for no-op with rationale

**Test scenarios:**
- Test expectation: none — `useSyncLifecycle` is a React hook using `useEffect`; its correctness is validated by the E2E sync flow in later stories. The no-op registration is correct by design (documented limitation).

**Verification:**
- Two new `registerStoreRefresh` calls appear in the hook before the `fullSync()` call.
- `useHighlightStore` and `useVocabularyStore` are imported.
- `npx tsc --noEmit` passes.

---

- [ ] **Unit 5: Unit tests for highlights and vocabulary sync wiring**

**Goal:** Deliver the `p1-highlights-vocabulary-sync.test.ts` file that proves all 8 mutations produce correct `syncQueue` entries and that unauthenticated writes produce zero queue entries.

**Requirements:** R10, AC10

**Dependencies:** Units 2 and 3 (stores must be wired before tests can pass)

**Files:**
- Create: `src/lib/sync/__tests__/p1-highlights-vocabulary-sync.test.ts`

**Approach:**
- Follow the exact template from `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts`: `fake-indexeddb/auto`, `vi.resetModules()` + `Dexie.delete('ElearningDB')` in `beforeEach`, `getQueueEntries(table)` helper, `useAuthStore.setState` to simulate authenticated user.
- Two `describe` blocks: `'E93-S06 sync wiring — bookHighlights'` and `'E93-S06 sync wiring — vocabularyItems'`.
- One additional `describe` block: `'E93-S06 sync wiring — unauthenticated'`.
- Helper factory functions: `makeHighlight()` and `makeVocabItem()` (similar to `makeNote()`), producing minimal valid objects with `crypto.randomUUID()` ids and required fields.
- Test cases (one `it` per scenario):

  **bookHighlights:**
  1. `createHighlight` authenticated → queue entry `{ tableName: 'bookHighlights', operation: 'put' }`, Dexie record present with `userId` stamped
  2. `updateHighlight` → queue entry `{ tableName: 'bookHighlights', operation: 'put' }`
  3. `deleteHighlight` → queue entry `{ tableName: 'bookHighlights', operation: 'delete', payload: { id: highlightId } }`, Dexie record absent

  **vocabularyItems:**
  4. `addItem` authenticated → queue entry `{ tableName: 'vocabularyItems', operation: 'put' }`, `userId` stamped
  5. `advanceMastery` → queue entry `{ tableName: 'vocabularyItems', operation: 'put' }` with `masteryLevel` incremented in the Dexie record
  6. `resetMastery` → queue entry `{ tableName: 'vocabularyItems', operation: 'put' }` with `masteryLevel: 0` in the Dexie record
  7. `deleteItem` → queue entry `{ tableName: 'vocabularyItems', operation: 'delete', payload: { id } }`, Dexie record absent

  **unauthenticated:**
  8. Unauthenticated `createHighlight` → Dexie record present, zero `bookHighlights` queue entries
  9. Unauthenticated `addItem` → Dexie record present, zero `vocabularyItems` queue entries

- For `updateHighlight` and `updateItem`: seed a record first (`createHighlight` / `addItem`), clear queue with `db.syncQueue.clear()`, then call the update method and assert queue entry count ≥ 1 with correct operation.
- For mastery tests: seed a vocab item with `masteryLevel: 0`, then call `advanceMastery` and assert the Dexie record shows `masteryLevel: 1`.

**Execution note:** Follow the `beforeEach` reset pattern exactly from the reference test — `vi.resetModules()` before re-importing stores prevents cross-test contamination from Zustand singleton state.

**Patterns to follow:**
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — full test structure
- `src/lib/sync/__tests__/p1-flashcard-sync.test.ts` (E93-S04 reference, if it exists) — for store factory pattern

**Test scenarios:** (the test file is itself the test artifact — scenarios are enumerated above)

**Verification:**
- `npm run test:unit` passes with all 9 test cases green.
- No `vi.useFakeTimers()` or `Date.now()` anti-patterns (ESLint `test-patterns/deterministic-time` rule).

---

- [ ] **Unit 6: TypeScript, lint, and build verification**

**Goal:** Confirm the full toolchain passes clean after all store and engine changes.

**Requirements:** R11

**Dependencies:** Units 1–5

**Files:**
- No new files

**Approach:**
- Run `npx tsc --noEmit`, `npm run lint`, `npm run build` in sequence.
- Fix any type errors, lint warnings, or import path issues surfaced.
- Common issues to anticipate:
  - `syncableWrite` generic type inference if `BookHighlight` or `VocabularyItem` have fields not in `SyncableRecord` — cast via `as unknown as SyncableRecord` if needed (same as `useNoteStore`).
  - Missing `persistWithRetry` import if the import is not added to both stores.
  - `db` import still needed in both stores for read calls — do not remove it.

**Test scenarios:**
- Test expectation: none — toolchain verification, not behavioral test.

**Verification:**
- `npx tsc --noEmit` exits 0 with zero errors.
- `npm run lint` exits 0 with zero errors/warnings.
- `npm run build` exits 0.
- `npm run test:unit` exits 0 with all tests passing (including Units 2–5 coverage).

## System-Wide Impact

- **Interaction graph:** `useHighlightStore` and `useVocabularyStore` now call `syncEngine.nudge()` (via `syncableWrite`) on every mutation. This is consistent with all other synced stores and has no additional side effects.
- **Error propagation:** Dexie write failures propagate to the caller (rethrown by `syncableWrite`). Queue insert failures are swallowed and logged — the Dexie write already succeeded. Both stores' existing `catch` blocks continue to surface fatal errors via `toast.error` or `throw`.
- **State lifecycle risks:** `advanceMastery` and `resetMastery` switch from partial `update(id, fields)` to full fetch-then-put. If the Dexie record is deleted between the optimistic in-memory check and the `get()` call, the fetch returns `undefined` and the store must return early (no queue entry). The guard `if (!item || item.masteryLevel >= 3)` already protects the in-memory check; add a corresponding guard after `db.vocabularyItems.get(id)`.
- **API surface parity:** No other stores reference `bookHighlights` or `vocabularyItems` write paths directly — no parity changes needed.
- **Integration coverage:** The unit tests prove the `store → syncableWrite → Dexie + syncQueue` chain. The upload path (`syncQueue → upsert_vocabulary_mastery`) requires a live Supabase instance to test end-to-end; this is deferred to E2E or manual QA against the E93-S01 migration.
- **Unchanged invariants:** tableRegistry entries for `bookHighlights` and `vocabularyItems` are not modified. The read paths in both stores (`where`, `orderBy`, `toArray`, `get`) remain as direct Dexie calls. `loadHighlightsForBook` behavior is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `upsert_vocabulary_mastery` paramMap key mismatch — if `toSnakeCase` renames a field differently than the RPC expects (e.g., `masteryLevel → mastery_level` vs. the actual column name) | Verify against the E93-S01 migration SQL before finalizing; the `content_progress` entry in `MONOTONIC_RPC` is the canonical reference for param naming pattern |
| `advanceMastery` / `resetMastery` fetch-then-put introduces a read-modify-write race (two rapid calls on the same item) | Acceptable — same race exists in all other fetch-then-put stores (notes, bookmarks). Monotonic strategy on the server side (`GREATEST`) ensures the higher mastery level wins even if two devices race |
| `cfiRange` EPUB CFI string contains special chars that `JSON.stringify` in `toSnakeCase` might escape | No serialization concern — `toSnakeCase` copies field values by reference (no transform on string values); risk is at Supabase REST layer; covered by AC9 in E2E testing |
| `loadHighlightsForBook` no-op registration means highlights do not refresh in-memory after a remote sync until next navigation | Documented limitation, matches `contentProgress` precedent; acceptable for this story |

## Documentation / Operational Notes

- Both `MONOTONIC_RPC` and store wiring patterns are now consistently applied to P1 tables. The `vocabulary_items` monotonic RPC addition is the only syncEngine change; it follows the exact pattern of `content_progress`.
- After this story, `docs/solutions/` may warrant a brief note clarifying the fetch-then-put requirement for `syncableWrite` and the no-op registration pattern for per-book stores.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e93-s06-book-highlights-vocabulary-sync-requirements.md](docs/brainstorms/2026-04-18-e93-s06-book-highlights-vocabulary-sync-requirements.md)
- Reference implementation (E93-S02): `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts`
- Store write pattern (E93-S02): `src/stores/useNoteStore.ts`, `src/stores/useBookmarkStore.ts`
- MONOTONIC_RPC pattern (E92-S05): `src/lib/sync/syncEngine.ts` lines ~67-90
- tableRegistry entries: `src/lib/sync/tableRegistry.ts` lines 204-219
- Type definitions: `src/data/types.ts` lines 802-836 (`BookHighlight`, `VocabularyItem`)
- lastGreenSha: `0803a653cda889a29ee4abb092523bc4729d49e7`
