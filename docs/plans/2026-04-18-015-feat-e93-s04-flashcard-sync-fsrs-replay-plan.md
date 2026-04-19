---
title: "feat: Flashcard Sync with FSRS Review Log Replay (E93-S04)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e93-s04-flashcard-sync-fsrs-review-log-replay-requirements.md
---

## Overview

Wire `useFlashcardStore` mutations through the E92 `syncableWrite` path so flashcard CRUD reaches Supabase. Introduce `flashcardReplayService.ts` to reconstruct FSRS card state from the append-only `flashcard_reviews` event log on download, rather than using a raw LWW overwrite of derived scheduling fields. Register the store refresh callback in `useSyncLifecycle`. Hook the replay service into the sync engine's download phase for `flashcards` rows that have been reviewed at least once.

## Problem Frame

`useFlashcardStore` calls `db.flashcards.add/put/delete()` directly, bypassing the E92 sync engine. Flashcard state never reaches Supabase, so a learner who reviews cards on one device sees no change on any other device. Additionally, FSRS scheduling state is deterministic given a sequence of review events — correct multi-device sync requires replaying the full event log rather than a simple LWW field overwrite. (See origin: `docs/brainstorms/2026-04-18-e93-s04-flashcard-sync-fsrs-review-log-replay-requirements.md`)

## Requirements Trace

- R1. `createFlashcard` and `deleteFlashcard` mutations use `syncableWrite` (AC2, AC3)
- R2. `rateFlashcard` uses `syncableWrite` for card state AND inserts a review event directly into Supabase `flashcard_reviews` when authenticated (AC4)
- R3. Zero direct `db.flashcards.add/put/delete` calls remain in `useFlashcardStore` (AC5)
- R4. `useSyncLifecycle` registers the `flashcards` store refresh callback before `fullSync()` (AC6)
- R5. `replayFlashcardReviews(flashcardId)` fetches review log from Supabase and replays in chronological order via `calculateNextReview` to reconstruct correct FSRS state (AC7)
- R6. Sync engine download phase calls `replayFlashcardReviews` for each downloaded flashcard that has `last_review` set (AC8)
- R7. Unauthenticated writes persist locally only — no `syncQueue` entries, no Supabase INSERT (AC9)
- R8. Unit tests cover all mutation paths (authenticated + unauthenticated) and the replay algorithm (AC10)
- R9. TypeScript clean — `npx tsc --noEmit` passes (AC11)

## Scope Boundaries

- `reviewRecords` store wiring via `syncableWrite` is NOT part of this story — deferred as stated in origin doc
- No UI changes — pure infrastructure story; design review not required
- No changes to the upload phase (E92-S05) — `syncableWrite` enqueues normally; upload worker unchanged
- Bulk replay performance optimization (first sync, all cards) is deferred
- Conflict UX for concurrent reviews on multiple devices is deferred

### Deferred to Separate Tasks

- `reviewRecords` wiring: if/when the legacy FSRS cache table is fully reconciled with the event-log approach
- `embeddings` table wiring: E93-S05
- E93-S01 must be deployed to Supabase before this story can run end-to-end (dependency, not scope)

## Context & Research

### Relevant Code and Patterns

- `src/stores/useFlashcardStore.ts` — store to wire; currently has three raw Dexie write calls across `createFlashcard`, `deleteFlashcard`, and `rateFlashcard`
- `src/lib/sync/syncableWrite.ts` — canonical write wrapper; use exactly as wired in E93-S02 notes/bookmarks
- `src/lib/sync/tableRegistry.ts` — already has `flashcards` (LWW, P1) and `reviewRecords` entries; `flashcard_reviews` is intentionally absent (confirmed)
- `src/app/hooks/useSyncLifecycle.ts` — already registers `studySessions`, `notes`, `bookmarks` refresh callbacks; pattern is `syncEngine.registerStoreRefresh('table', () => store.getState().loadXxx())`
- `src/lib/sync/syncEngine.ts` — `_applyRecord()` is the per-record apply dispatcher; `_doDownload()` is the download loop; both are the integration points for replay hook
- `src/lib/spacedRepetition.ts` — exports `calculateNextReview(card: FSRSCardState | null, rating, now, fsrsInstance?)` and `fsrsTest` (deterministic, no fuzz) for test use
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — nearest test pattern; use `fake-indexeddb/auto`, `vi.resetModules()`, `Dexie.delete('ElearningDB')` in `beforeEach`
- `src/lib/auth/supabase.ts` — import `supabase` (nullable) for direct Supabase calls in `rateFlashcard` and `replayFlashcardReviews`
- `src/data/types.ts` — `Flashcard`, `ReviewRating`, `CardState`, `FSRSCardState` types
- `src/lib/persistWithRetry.ts` — wrap all Dexie mutations consistently

### Institutional Learnings

- `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md` — six rules from E93-S02; key ones for this story:
  - Rule 1: Use `set(state => ...)` whenever there is an `await` before a Zustand write (stale closure)
  - Rule 5: `registerStoreRefresh` must be called synchronously in `useEffect` setup, before any `await`
- `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md` — `syncableWrite` is the single canonical write path; no direct `db.flashcards.*` calls
- `docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md` — `flashcard_reviews` INSERT+SELECT RLS only; no UPDATE/DELETE

### External References

- FSRS algorithm: replay is sequential accumulation — each call's output card becomes the next call's input. Initial state: `{ stability: 0, difficulty: 0, reps: 0, lapses: 0, state: 0, elapsed_days: 0, scheduled_days: 0 }`

## Key Technical Decisions

- **Direct Supabase INSERT for `flashcard_reviews` in `rateFlashcard`**: `flashcard_reviews` is Supabase-only with no Dexie table and no `tableRegistry` entry. `syncableWrite` would throw on an unregistered table. The INSERT must be conditional on `user !== null` — unauthenticated reviews write only the local card state via `syncableWrite`. (see origin: AC4)

- **Both writes in the same `persistWithRetry` block**: the `syncableWrite` call and the Supabase INSERT for the review event belong in a single `persistWithRetry` wrapper for consistent retry behavior. If the card state write succeeds but the review INSERT fails (or vice versa), a retry will attempt both again. `syncableWrite` is idempotent for `put` (upsert). The INSERT may produce a duplicate review event on retry if Supabase does not reject it — acceptable given `flashcard_reviews` RLS only allows INSERT+SELECT and a duplicate event will produce an identical FSRS replay result.

- **`skipQueue: true` on replay write**: after replaying, the reconstructed card state is written back to Dexie via `syncableWrite('flashcards', 'put', recomputedCard, { skipQueue: true })`. The card was just downloaded — re-enqueueing it would cause an upload cycle that overwrites the server copy with the same data. `skipQueue: true` prevents this.

- **Replay only when `last_review` is set**: new unreviewed cards have no review log. Calling `replayFlashcardReviews` for them would make a Supabase query that returns zero rows, producing a card with default FSRS state — then writing that state over a card that may already have local FSRS fields from a prior session. Guard: only call replay when the downloaded record's `last_review` field is non-null.

- **`reviewed_at` is the canonical ordering column**: `flashcard_reviews` has no `updated_at`. Replay fetches with `.order('reviewed_at', { ascending: true })`. `created_at` is a valid fallback but `reviewed_at` (device-local clock at review time) is canonical per the origin doc.

- **Incremental download cursor for `flashcard_reviews`**: `flashcard_reviews` is NOT in `tableRegistry`, so `_doDownload` does not fetch it directly. The replay service fetches all reviews for a card on each sync — no incremental cursor needed. This is correct because replay must process ALL reviews in order, not just new ones. Performance optimization is deferred.

- **Replay call site in `_applyRecord`**: the replay hook is inserted in `_applyRecord` after the LWW apply for the `flashcards` table. After the table write, if the record has `last_review`, call `replayFlashcardReviews(record.id)`. This keeps the replay co-located with the record's apply step, consistent with how `conflictResolvers` are dispatched.

## Open Questions

### Resolved During Planning

- **Where to call `replayFlashcardReviews` in the sync engine?** Inside `_applyRecord` for the `flashcards` table entry, after the LWW write. This is the narrowest hook point — it fires per-record during download and keeps the replay within the table's apply step.

- **How does `replayFlashcardReviews` know the current user id?** It reads `useAuthStore.getState().user?.id` the same way `syncableWrite` does. No argument required — both functions guard on null userId and skip the Supabase call if unauthenticated.

- **tableRegistry AC1 verification**: confirmed from code — `flashcards` (LWW, P1) and `reviewRecords` (LWW, P1) both present. `flashcard_reviews` absent as expected.

### Deferred to Implementation

- **Retry semantics for duplicate `flashcard_reviews` INSERT on retry**: the review event UUID is generated outside `persistWithRetry` (matching `createFlashcard`'s pattern for `newCard.id`). A retry re-attempts INSERT with the same UUID, which will hit a PK conflict. Implementer should decide whether to swallow a `23505` unique_violation error on INSERT, treating it as an idempotent success (safest approach).

- **Exact error-handling posture for Supabase `flashcard_reviews` INSERT failure**: for the authenticated-but-Supabase-error case (network timeout, RLS failure), implementer should decide whether to surface a toast or swallow. The `rateFlashcard` catch block currently shows a retry toast — keeping that behavior for the combined write block is consistent.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
rateFlashcard(rating, now)
  ├── optimistic Zustand update (advance queue, update card in list)
  └── persistWithRetry(async () => {
        syncableWrite('flashcards', 'put', updatedCard)  // → Dexie + syncQueue
        if (user) {
          supabase.from('flashcard_reviews').insert({ id, user_id, flashcard_id, rating, reviewed_at })
        }
      })

sync engine _doDownload() → iterates tableRegistry entries
  → for each flashcard row from Supabase:
      toCamelCase(row) → record
      _applyRecord(flashcardsEntry, record)
        → _applyLww(table, local, record)         // writes Dexie
        → if record.lastReview: replayFlashcardReviews(record.id)

replayFlashcardReviews(flashcardId)
  → supabase.from('flashcard_reviews')
       .select('*')
       .eq('flashcard_id', flashcardId)
       .eq('user_id', currentUserId)
       .order('reviewed_at', { ascending: true })
  → start with accState = null
  → for each review in order:
       accState = calculateNextReview(accState, review.rating, new Date(review.reviewedAt), fsrsTest)
  → syncableWrite('flashcards', 'put', { ...existingCard, ...accState }, { skipQueue: true })
```

## Implementation Units

- [ ] **Unit 1: Verify tableRegistry entries and wire `createFlashcard` + `deleteFlashcard`**

**Goal:** Confirm AC1 (tableRegistry correct), then replace the two simplest raw Dexie calls in `useFlashcardStore` with `syncableWrite`.

**Requirements:** R1, R3, R7, R9

**Dependencies:** None (all E92 infrastructure already present)

**Files:**

- Modify: `src/stores/useFlashcardStore.ts`
- Modify: `src/app/hooks/useSyncLifecycle.ts`
- Test: `src/lib/sync/__tests__/p1-flashcard-sync.test.ts` (create)

**Approach:**

- Read `tableRegistry.ts` to confirm `flashcards` and `reviewRecords` entries are present and `flashcard_reviews` is absent. No code change needed for AC1 — it is a verification step.
- In `createFlashcard`: replace `await db.flashcards.add(newCard)` with `await syncableWrite('flashcards', 'add', newCard)`. Import `syncableWrite` from `@/lib/sync/syncableWrite`.
- In `deleteFlashcard`: replace `await db.flashcards.delete(id)` with `await syncableWrite('flashcards', 'delete', id)`.
- In `useSyncLifecycle.ts`: add `syncEngine.registerStoreRefresh('flashcards', () => useFlashcardStore.getState().loadFlashcards())` in the synchronous block before `fullSync()`. Import `useFlashcardStore`.
- Keep the existing `persistWithRetry` wrappers in place around the `syncableWrite` calls — no structural change to error handling.

**Patterns to follow:**

- `src/stores/useNoteStore.ts` — `addNote` and `deleteNote` with `syncableWrite` (E93-S02)
- `src/app/hooks/useSyncLifecycle.ts` lines 48–54 — existing `registerStoreRefresh` calls

**Test scenarios:**

- Happy path: `createFlashcard` while authenticated → Dexie record created with `userId` stamped; `syncQueue` entry with `tableName: 'flashcards'`, `operation: 'add'`, `status: 'pending'`
- Happy path: `deleteFlashcard` while authenticated → Dexie record removed; `syncQueue` entry with `operation: 'delete'`, `payload: { id: cardId }`
- Edge case: `createFlashcard` while unauthenticated → Dexie record created; zero `syncQueue` entries for `flashcards`
- Edge case: `deleteFlashcard` on non-existent card → no error thrown, no queue entry

**Verification:**

- `syncQueue` entries for `createFlashcard` and `deleteFlashcard` carry correct `tableName`, `operation`, and `payload`
- No `db.flashcards.add` or `db.flashcards.delete` calls remain in the store
- `useSyncLifecycle.ts` has the `flashcards` `registerStoreRefresh` call before `fullSync()`

---

- [ ] **Unit 2: Wire `rateFlashcard` with dual write (card state + review event)**

**Goal:** Replace the raw `db.flashcards.put` call in `rateFlashcard` with `syncableWrite`, and add a conditional Supabase INSERT for the `flashcard_reviews` event when authenticated.

**Requirements:** R2, R3, R7

**Dependencies:** Unit 1 (import structure established)

**Files:**

- Modify: `src/stores/useFlashcardStore.ts`
- Test: `src/lib/sync/__tests__/p1-flashcard-sync.test.ts`

**Approach:**

- Within the existing `persistWithRetry` block in `rateFlashcard`, replace `await db.flashcards.put(updatedCard)` with `await syncableWrite('flashcards', 'put', updatedCard)`.
- After the `syncableWrite` call and still inside `persistWithRetry`, add a conditional block: read `user` from `useAuthStore.getState()` and, if non-null, call `supabase.from('flashcard_reviews').insert(reviewEvent)`. Import `supabase` from `@/lib/auth/supabase` and `useAuthStore` from `@/stores/useAuthStore`.
- The review event shape: `{ id: reviewEventId, user_id: user.id, flashcard_id: currentCard.id, rating: rating, reviewed_at: now.toISOString() }` where `reviewEventId` is `crypto.randomUUID()` captured **outside** `persistWithRetry` before the retry block (same pattern as `createFlashcard` captures `newCard.id`). A retry with the same UUID will hit a PK conflict — swallow `23505` unique_violation errors on the INSERT as idempotent success.
- The `now` parameter already exists as a `Date` argument on `rateFlashcard`. Use `now.toISOString()` for both `updatedAt` on the card and `reviewed_at` on the event to ensure timestamp alignment.

**Patterns to follow:**

- `src/stores/useStudyScheduleStore.ts` — direct `supabase.from(...).insert/delete` pattern for non-syncable tables
- `src/lib/sync/syncableWrite.ts` — how `useAuthStore.getState()` is called inside a non-React async function

**Test scenarios:**

- Happy path: `rateFlashcard` while authenticated → `syncQueue` entry for `flashcards` with `operation: 'put'`; mock `supabase.from('flashcard_reviews').insert` called with correct `flashcard_id`, `rating`, `reviewed_at`
- Error path: `rateFlashcard` while unauthenticated → Dexie `put` occurs; zero `syncQueue` entries; Supabase INSERT mock NOT called
- Integration: both writes inside single `persistWithRetry` block — card state and review event are either both attempted or both retried

**Verification:**

- `rateFlashcard` contains no direct `db.flashcards.put` call
- Supabase INSERT is skipped when `user` is null
- `updatedAt` on the updated card and `reviewed_at` on the review event are derived from the same `now` variable

---

- [ ] **Unit 3: Create `flashcardReplayService.ts`**

**Goal:** Implement `replayFlashcardReviews(flashcardId: string): Promise<void>` — fetch all review events for a card from Supabase and replay them in order via `calculateNextReview` to reconstruct the correct FSRS state.

**Requirements:** R5, R7

**Dependencies:** Unit 1 (imports of `syncableWrite`, `useAuthStore`, `supabase` established)

**Files:**

- Create: `src/lib/sync/flashcardReplayService.ts`
- Test: `src/lib/sync/__tests__/p1-flashcard-sync.test.ts`

**Approach:**

- Export one function: `replayFlashcardReviews(flashcardId: string): Promise<void>`.
- Guard: if `supabase` is null or `useAuthStore.getState().user?.id` is null, return early (no-op — unauthenticated replay is meaningless).
- Fetch: `supabase.from('flashcard_reviews').select('*').eq('flashcard_id', flashcardId).eq('user_id', userId).order('reviewed_at', { ascending: true })`.
- If the query returns zero rows, return early (no-op — card has no review history, or E93-S01 hasn't migrated yet).
- Initialize `accState: FSRSCardState | null = null` before the replay loop.
- Replay loop: for each review in chronological order, call `calculateNextReview(accState, review.rating as ReviewRating, new Date(review.reviewedAt), fsrsTest)`. Update `accState` with the returned `FSRSSchedulingResult`. Use `fsrsTest` (deterministic, no fuzz) to ensure replay is idempotent across devices and time.
- After the loop, read the existing local card from Dexie: `db.flashcards.get(flashcardId)`. If not found, log a warning and return (the download phase should have written it first).
- Merge: spread `existingCard` first, then spread `accState` — preserves non-FSRS fields (courseId, noteId, front, back, etc.) from the local record while overwriting all FSRS scheduling fields.
- Write: `await syncableWrite('flashcards', 'put', mergedCard, { skipQueue: true })`.
- Errors: if the Supabase fetch fails, log a warning and return — replay failure is non-fatal. The card keeps its pre-replay LWW state and will be corrected on the next sync cycle.

> Note: `fsrsTest` (deterministic, no fuzz) is used for replay instead of the production `fsrs` instance. This ensures replay produces the same result regardless of when or where it runs, which is the correctness requirement for event-log reconstruction.

**Patterns to follow:**

- `src/lib/sync/syncEngine.ts` `_doDownload` — how `supabase` null guard and per-record error isolation is applied
- `src/lib/spacedRepetition.ts` `calculateNextReview` signature and `fsrsTest` export
- `src/lib/sync/syncableWrite.ts` `skipQueue` option

**Test scenarios:**

- Happy path: `replayFlashcardReviews` with 3 reviews (again → good → easy) → recomputed card's FSRS fields match manually chaining `calculateNextReview` 3 times with `fsrsTest` and the same inputs
- Edge case: zero reviews in Supabase → returns without writing to Dexie; existing Dexie record unchanged
- Edge case: `supabase` is null → returns early, no Dexie write, no error thrown
- Edge case: unauthenticated (user is null) → returns early, no Supabase call, no Dexie write
- Error path: Supabase fetch returns an error → logs warning, returns early; existing Dexie card unchanged

**Verification:**

- Three-review replay produces FSRS state identical to three sequential `calculateNextReview(fsrsTest)` calls with the same inputs
- `skipQueue: true` prevents a `syncQueue` entry being created for the replayed card state
- Non-FSRS flashcard fields (front, back, courseId) are preserved from the existing Dexie record

---

- [ ] **Unit 4: Hook replay into sync engine download phase**

**Goal:** After the sync engine applies a downloaded `flashcards` row via LWW, call `replayFlashcardReviews` if the card has a non-null `last_review` field — so the local FSRS state is derived from the authoritative event log rather than a raw LWW write.

**Requirements:** R6

**Dependencies:** Unit 3 (`flashcardReplayService.ts` exists and is exported)

**Files:**

- Modify: `src/lib/sync/syncEngine.ts`

**Approach:**

- In `_applyRecord`, after the `switch` block (all apply strategies already complete), add a post-apply hook for the `flashcards` table. Guard on `entry.dexieTable === 'flashcards'` and `record['lastReview']` being truthy — `lastReview` is camelCase because `toCamelCase` runs before `_applyRecord` in `_doDownload`.
- Import `replayFlashcardReviews` from `./flashcardReplayService`.
- The call is `await` — replay runs synchronously per record within the download loop. Per-record error isolation in `_doDownload`'s `try/catch` around `_applyRecord` already covers replay failures; `replayFlashcardReviews` itself swallows non-fatal errors.

**Patterns to follow:**

- `src/lib/sync/syncEngine.ts` `_applyRecord` switch block — how per-strategy dispatch is structured
- `src/lib/sync/syncEngine.ts` `_doDownload` per-record try/catch — error isolation pattern

**Test scenarios:**

- Integration: sync engine `_applyRecord` called with a flashcard record that has `lastReview` set → `replayFlashcardReviews` is called with the correct `flashcardId`
- Integration: sync engine `_applyRecord` called with a flashcard record where `lastReview` is undefined → `replayFlashcardReviews` is NOT called
- Integration: `replayFlashcardReviews` throws inside `_applyRecord` → error is caught by `_doDownload`'s per-record catch; download continues for remaining records

**Verification:**

- `_applyRecord` imports and calls `replayFlashcardReviews` only for `flashcards` table entries with non-null `lastReview`
- Other table entries are unaffected — the guard is table-name-specific

---

- [ ] **Unit 5: Unit tests — complete coverage of AC10**

**Goal:** Write all unit tests specified in AC10 to a single test file, ensuring full coverage of authenticated/unauthenticated paths and the FSRS replay algorithm.

**Requirements:** R8

**Dependencies:** Units 1–4 (all implementation units complete)

**Files:**

- Modify/complete: `src/lib/sync/__tests__/p1-flashcard-sync.test.ts`

**Approach:**

- Follow the exact setup pattern from `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts`: `fake-indexeddb/auto`, `vi.resetModules()` in `beforeEach`, delete `'ElearningDB'` before each test, import stores after reset.
- Mock `supabase` from `@/lib/auth/supabase` using `vi.mock` to capture INSERT calls for `flashcard_reviews` and to control the SELECT response in replay tests.
- Structure as three `describe` blocks: `useFlashcardStore — authenticated writes`, `useFlashcardStore — unauthenticated writes`, `replayFlashcardReviews`.
- For replay tests: seed a fake `flashcard_reviews` response with 3 reviews, run `replayFlashcardReviews`, and assert the resulting Dexie card's FSRS fields match a manually-computed reference using `calculateNextReview(fsrsTest)` with identical inputs.
- Use `fsrsTest` (deterministic) for replay test assertions.

**Patterns to follow:**

- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — full setup/teardown pattern
- `src/lib/sync/__tests__/syncEngine.download.test.ts` — `vi.hoisted()` + `vi.mock` pattern for Supabase response control

**Test scenarios:**

- `createFlashcard` authenticated → `syncQueue` entry `operation: 'add'`
- `createFlashcard` unauthenticated → Dexie write, no queue entry
- `deleteFlashcard` authenticated → `syncQueue` entry `operation: 'delete'`
- `rateFlashcard` authenticated → `syncQueue` entry `operation: 'put'`; Supabase INSERT called for `flashcard_reviews` with correct fields
- `rateFlashcard` unauthenticated → Dexie write, no queue entry, no Supabase INSERT call
- `replayFlashcardReviews` with 3 reviews → final FSRS state matches manual 3-call `calculateNextReview(fsrsTest)` chain

**Verification:**

- `npm run test:unit` passes for this file with all 6 scenarios covered
- No test uses `Date.now()` or `new Date()` without a fixed reference date (use `new Date('2026-04-18T10:00:00Z')` or a `FIXED_DATE` constant)

## System-Wide Impact

- **Interaction graph:** `rateFlashcard` now calls both `syncableWrite` (→ Dexie → syncQueue) and `supabase.from('flashcard_reviews').insert` (→ Supabase directly). These are two distinct write targets in the same `persistWithRetry` block.
- **Error propagation:** `syncableWrite` Dexie failure is fatal (rethrown); queue insert failure is non-fatal (logged, swallowed). Supabase INSERT failure for `flashcard_reviews` propagates to the `persistWithRetry` retry loop — the existing toast-with-retry in `rateFlashcard`'s catch block fires.
- **State lifecycle risks:** If `replayFlashcardReviews` writes a card with `skipQueue: true` and a concurrent `rateFlashcard` also writes the same card to `syncQueue`, the LWW comparison on next upload may overwrite the replayed state with a stale snapshot. This is an acceptable edge case — it self-corrects on the next download + replay cycle. Not a data-loss scenario.
- **API surface parity:** `flashcard_reviews` INSERT is only called from `rateFlashcard`. No other store or component writes to this table. No parity issue.
- **Integration coverage:** The download → replay flow is an integration scenario unit tests alone cannot prove (they would mock Supabase and Dexie). The existing E2E test suite (if flashcard review flows exist) will exercise the full path. If no E2E test exists for review sessions, that gap should be noted in the test coverage review.
- **Unchanged invariants:** `tableRegistry.ts` is not modified by this story. `flashcard_reviews` remains absent from the registry. The upload phase (E92-S05) is unchanged — `syncableWrite` enqueues to `syncQueue` as before; the upload worker processes `flashcards` entries normally. `reviewRecords` sync wiring is explicitly unchanged.

## Risks & Dependencies

| Risk | Mitigation |
| ---- | ---------- |
| E93-S01 not yet deployed — `flashcard_reviews` table doesn't exist in Supabase | Gate end-to-end testing on E93-S01 merge. Unit tests mock Supabase, so they pass regardless. |
| Replay with `fsrsTest` (no fuzz) vs `fsrs` (production, fuzz) diverges over many reviews | Replay must be deterministic — `fsrsTest` is correct for replay. Production scheduling on new ratings continues to use `fsrs`. Document this asymmetry in `flashcardReplayService.ts`. |
| Duplicate UUID on `flashcard_reviews` INSERT retry — same UUID hits PK conflict | Generate UUID outside `persistWithRetry`; swallow `23505` unique_violation on INSERT as idempotent success. |
| Replay performance on first sync (many cards, many reviews per card) | Each card triggers a separate Supabase fetch. Acceptable for beta scale. Deferred optimization. |
| `_applyRecord` is a private function in `syncEngine.ts`; adding a hook couples replay to the engine | Alternative is calling replay from `_doDownload` after `_applyRecord`. Either location is acceptable. Prefer `_applyRecord` for colocation. Extract the hook in E95+ if engine becomes more pluggable. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e93-s04-flashcard-sync-fsrs-review-log-replay-requirements.md](docs/brainstorms/2026-04-18-e93-s04-flashcard-sync-fsrs-review-log-replay-requirements.md)
- Related patterns: [docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md](docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md)
- Related patterns: [docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md](docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md)
- Related patterns: [docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md](docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md)
- Nearest prior art test: [src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts](src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts)
- Nearest store impl: [src/stores/useFlashcardStore.ts](src/stores/useFlashcardStore.ts)
- Engine integration point: [src/lib/sync/syncEngine.ts](src/lib/sync/syncEngine.ts) `_applyRecord` (~line 552)
- lastGreenSha: `21216484317a6e23a176d9188f8e0981805213f1`
