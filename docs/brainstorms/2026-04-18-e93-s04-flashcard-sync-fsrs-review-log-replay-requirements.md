---
title: "Flashcard Sync with FSRS Review Log Replay (E93-S04)"
storyId: E93-S04
date: 2026-04-18
module: sync
tags: [flashcards, fsrs, sync, review-log, replay, supabase, dexie]
---

# CE Requirements: Flashcard Sync with FSRS Review Log Replay (E93-S04)

**Date:** 2026-04-18
**Story:** E93-S04
**Branch:** feature/e93-s04-flashcard-sync-fsrs-review-log-replay

---

## Problem Statement

The `useFlashcardStore` currently writes directly to Dexie (`db.flashcards.add/put/delete`), bypassing the E92 sync engine. Flashcard state therefore never reaches Supabase, and a learner who reviews cards on their phone will not see updated scheduling on their desktop.

Additionally, FSRS scheduling state is deterministic given a sequence of review events. Rather than syncing the derived FSRS fields (`stability`, `difficulty`, `state`, etc.) via a simple LWW merge, the canonical approach is to:
1. Upload each review event to the **append-only** `flashcard_reviews` Supabase table.
2. On download to a new device, replay all review events in chronological order to reconstruct the correct FSRS state locally.

This pattern guarantees correctness across devices even when reviews arrive out of order from multiple devices.

---

## User Value / Goal

A learner who reviews flashcards on one device should see their cards correctly rescheduled on every other device — including accurate FSRS stability/difficulty estimates — without any manual action. This requires:
- Wiring `useFlashcardStore` mutations through `syncableWrite` for the `flashcards` table.
- Uploading each `rateFlashcard` event as an INSERT into the `flashcard_reviews` Supabase table.
- Downloading `flashcard_reviews` on a new device and replaying them in order to derive correct card state.

---

## Acceptance Criteria

### AC1 — tableRegistry entries verified
Both `flashcards` and `reviewRecords` entries in `src/lib/sync/tableRegistry.ts` exist and are correct:
- `flashcards`: `{ dexieTable: 'flashcards', supabaseTable: 'flashcards', conflictStrategy: 'lww', priority: 1, fieldMap: {} }`
- `reviewRecords`: `{ dexieTable: 'reviewRecords', supabaseTable: 'review_records', conflictStrategy: 'lww', priority: 1, fieldMap: {} }`
- `flashcard_reviews` is intentionally absent from the registry (it is a Supabase-only INSERT-only table — no Dexie equivalent).

### AC2 — `useFlashcardStore.createFlashcard` uses `syncableWrite`
`createFlashcard` replaces `db.flashcards.add(newCard)` with `syncableWrite('flashcards', 'add', newCard)`. When authenticated, a `syncQueue` entry is created with `tableName: 'flashcards'`, `operation: 'add'`, and the card payload.

### AC3 — `useFlashcardStore.deleteFlashcard` uses `syncableWrite`
`deleteFlashcard` replaces `db.flashcards.delete(id)` with `syncableWrite('flashcards', 'delete', id)`. When authenticated, a `syncQueue` entry is created with `operation: 'delete'`.

### AC4 — `useFlashcardStore.rateFlashcard` writes review event + updated card state
`rateFlashcard` performs two writes inside a single `persistWithRetry` block:
1. `syncableWrite('flashcards', 'put', updatedCard)` — persists updated FSRS state locally and enqueues card state for upload.
2. Inserts a review event record directly into `flashcard_reviews` via the Supabase client (not `syncableWrite` — it is INSERT-only with no Dexie equivalent). The review event shape:
   ```ts
   {
     id: crypto.randomUUID(),
     userId: currentUserId,
     flashcardId: currentCard.id,
     rating: rating,           // ReviewRating (1-4)
     reviewedAt: now.toISOString(),
   }
   ```
   If the user is unauthenticated, only the `syncableWrite` Dexie write happens; the Supabase INSERT is skipped (no error thrown).

### AC5 — Zero direct Dexie write calls remain in `useFlashcardStore`
After wiring, `useFlashcardStore.ts` contains no `db.flashcards.add/put/delete` calls. Read calls (`db.flashcards.toArray()`, `db.flashcards.get()`) remain unchanged.

### AC6 — Store refresh callback registered in `useSyncLifecycle`
`src/app/hooks/useSyncLifecycle.ts` registers before `fullSync()`:
```ts
syncEngine.registerStoreRefresh('flashcards', () => useFlashcardStore.getState().loadFlashcards())
```

### AC7 — FSRS review log replay on download
A new function `replayFlashcardReviews(flashcardId: string): Promise<void>` in `src/lib/sync/flashcardReplayService.ts`:
1. Queries Supabase `flashcard_reviews` for all rows matching `flashcard_id = flashcardId AND user_id = currentUserId`, ordered by `reviewed_at ASC` (uses `created_at` as a proxy if `reviewed_at` is absent — but `reviewed_at` is the canonical ordering column).
2. Starts with the card's initial FSRS state (all defaults: `state: 0`, `reps: 0`, `stability: 0`, etc.).
3. Calls `calculateNextReview(card, review.rating, new Date(review.reviewedAt))` for each review in order, accumulating the resulting FSRS fields.
4. After replaying all events, calls `syncableWrite('flashcards', 'put', recomputedCard, { skipQueue: true })` to persist the recomputed state without re-enqueuing (it was just downloaded).

### AC8 — Replay triggered during download reconciliation
The sync engine's download phase (E92-S06) calls `replayFlashcardReviews(flashcardId)` for each flashcard row it writes locally during a full sync. This ensures that after download, the local FSRS state is derived from the server's authoritative review log rather than a raw LWW overwrite.

Implementation note: The download phase should call replay only when the downloaded flashcard has a `last_review` value (i.e., it has been reviewed at least once). New unreviewed cards can be applied directly without replay.

### AC9 — Unauthenticated writes persist locally only
When `user` is null, all three mutations (`createFlashcard`, `deleteFlashcard`, `rateFlashcard`) write to Dexie but create no `syncQueue` entries and make no Supabase `flashcard_reviews` INSERT. No errors are thrown.

### AC10 — Unit tests
New file `src/lib/sync/__tests__/p1-flashcard-sync.test.ts` covering:
- `createFlashcard` while authenticated → `syncQueue` entry with `operation: 'add'`
- `createFlashcard` while unauthenticated → Dexie write, no queue entry
- `deleteFlashcard` while authenticated → `syncQueue` entry with `operation: 'delete'`
- `rateFlashcard` while authenticated → `syncQueue` entry with `operation: 'put'`; Supabase INSERT called for `flashcard_reviews`
- `rateFlashcard` while unauthenticated → Dexie write, no queue entry, no Supabase call
- `replayFlashcardReviews` with 3 reviews → recomputed card state matches manual replay of `calculateNextReview` sequence

### AC11 — TypeScript clean
`npx tsc --noEmit` passes with zero errors after all changes.

---

## Technical Context and Constraints

### E92 `syncableWrite` Pattern
Same pattern used by notes/bookmarks (E93-S02). All flashcard mutations wrap the inner Dexie call in `persistWithRetry`:
```ts
await persistWithRetry(async () => {
  await syncableWrite('flashcards', 'put', updatedCard)
})
```
`syncableWrite` stamps `userId` and `updatedAt`, writes to Dexie, and enqueues to `syncQueue` if authenticated.

### `flashcard_reviews` is Supabase-Only (INSERT-Only)
This table is NOT in the tableRegistry — it has no Dexie equivalent. It is an append-only event log.
- Created in E93-S01 with INSERT+SELECT RLS only (no UPDATE/DELETE policies).
- Columns: `id UUID`, `user_id UUID`, `flashcard_id UUID`, `rating INT`, `reviewed_at TIMESTAMPTZ`.
- `reviewed_at` is the ordering column for replay — `created_at ASC` is a valid fallback but `reviewed_at` is preferred (device-local clock at review time).

### `flashcard_reviews` Has No `updated_at`
Unlike most P1 tables, `flashcard_reviews` is an immutable event log with no `updated_at` column. Use `reviewed_at` (or `created_at`) for ordering. The incremental download cursor for this table is `reviewed_at >= lastSyncTimestamp`.

### FSRS Replay Algorithm
The `fsrs` npm package (already installed — E59) provides the `calculateNextReview` function. Replay is sequential: pass the accumulated state from the previous call as the `card` argument for the next. The initial card state for replay is:
```ts
{ stability: 0, difficulty: 0, reps: 0, lapses: 0, state: 0, elapsed_days: 0, scheduled_days: 0 }
```

### `flashcards` Table Has `note_id` FK
The Supabase `flashcards` table has `note_id UUID REFERENCES notes(id) ON DELETE SET NULL` (from E93-S01). When uploading a flashcard, if the referenced note no longer exists server-side, `note_id` is silently nulled by Postgres. The client-side `noteId` field remains populated locally — this asymmetry is acceptable (the FK is informational).

### `reviewRecords` Dexie Table
`reviewRecords` is the legacy FSRS state cache table (from pre-E59 era). It IS in the tableRegistry (mapped to `review_records` in Supabase). This story does NOT wire `reviewRecords` through `syncableWrite` — that is handled if/when the table remains active. The primary sync mechanism for FSRS in this story is the `flashcard_reviews` event log pattern, which supersedes direct `reviewRecords` sync for correctness.

### `skipQueue` Option
When writing the replayed card state locally after download, pass `{ skipQueue: true }` to `syncableWrite` to prevent re-enqueueing data that was just fetched from Supabase.

### ES2020 Constraints
No `Promise.any`. `Promise.allSettled` is fine. All async functions must properly propagate errors or swallow only non-fatal cases (queue insert failure is already swallowed inside `syncableWrite`).

### `persistWithRetry` Must Be Kept
Both write calls in `rateFlashcard` (the `syncableWrite` for the card and the Supabase INSERT for the review event) should be inside the same `persistWithRetry` wrapper for consistent retry behavior.

---

## Dependencies

- **E92-S03 (done):** Both `flashcards` and `reviewRecords` entries exist in `tableRegistry.ts`.
- **E92-S04 (done):** `syncableWrite` function exists at `src/lib/sync/syncableWrite.ts`.
- **E92-S09 (done):** P0 stores wired — serves as reference implementation for `syncableWrite` pattern.
- **E93-S01 (in-progress):** `flashcard_reviews` Supabase table with INSERT-only RLS. `flashcards` table with `(user_id, due_date)` compound index. Story must be done before E93-S04 can run end-to-end against real Supabase.
- **E93-S02 (done):** Notes/bookmarks wiring — direct pattern reference.
- **E59 (done):** `fsrs` npm package installed; `calculateNextReview` function exists in `src/lib/spacedRepetition.ts`.

---

## Out of Scope

- **`reviewRecords` store wiring:** The Dexie `reviewRecords` table wiring via `syncableWrite` is deferred. The `flashcard_reviews` event log is the authoritative approach for FSRS state reconstruction.
- **Conflict resolution for simultaneous reviews on multiple devices:** If two devices review the same card concurrently, the event log will record both reviews. Replay will process them in `reviewed_at` order. Devices that upload last will see a merged FSRS state. True conflict UX (showing both ratings) is out of scope.
- **Batch replay on first sync:** Replaying the full review history for all cards on a new device's first sync is addressed at the architecture level (the download phase replays per-card as cards arrive). Optimization of bulk replay performance is deferred.
- **Supabase upload phase changes (E92-S05):** The upload worker already processes `syncQueue` entries. No changes to the upload phase are needed for this story — `syncableWrite` enqueues normally.
- **UI changes:** Pure infrastructure story. No new components, no design review required.
- **`embeddings` table wiring:** Deferred to E93-S05.

---

## Implementation Hints

1. **Start with AC1 (verification):** Read `tableRegistry.ts`, confirm `flashcards` and `reviewRecords` entries. Confirm `flashcard_reviews` is absent (as expected).
2. **Wire `createFlashcard` (AC2):** Replace `db.flashcards.add(newCard)` with `syncableWrite('flashcards', 'add', newCard)` inside `persistWithRetry`.
3. **Wire `deleteFlashcard` (AC3):** Replace `db.flashcards.delete(id)` with `syncableWrite('flashcards', 'delete', id)` inside `persistWithRetry`.
4. **Wire `rateFlashcard` (AC4):** Inside `persistWithRetry`, replace `db.flashcards.put(updatedCard)` with `syncableWrite('flashcards', 'put', updatedCard)`. Add conditional Supabase INSERT for the review event:
   ```ts
   const { user } = useAuthStore.getState()
   if (user) {
     const supabase = getSupabaseClient()
     await supabase.from('flashcard_reviews').insert({
       id: crypto.randomUUID(),
       user_id: user.id,
       flashcard_id: currentCard.id,
       rating: rating,
       reviewed_at: now.toISOString(),
     })
   }
   ```
5. **Create `flashcardReplayService.ts` (AC7):**
   ```ts
   // src/lib/sync/flashcardReplayService.ts
   export async function replayFlashcardReviews(flashcardId: string): Promise<void>
   ```
   - Fetch reviews from Supabase ordered by `reviewed_at ASC`.
   - Replay using `calculateNextReview`.
   - Persist with `syncableWrite(..., { skipQueue: true })`.
6. **Register store refresh (AC6):** Add one line in `useSyncLifecycle.ts` before `fullSync()`.
7. **Wire replay into download phase (AC8):** In the sync engine's apply-downloaded-record path for `flashcards`, call `replayFlashcardReviews(record.id)` when `record.last_review` is not null.
8. **Write unit tests (AC10):** Follow `src/lib/sync/__tests__/p0-sync.test.ts` template. Mock `getSupabaseClient` to capture INSERT calls for `flashcard_reviews`.
9. **Verification:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Key Files

| File | Role |
|------|------|
| `src/stores/useFlashcardStore.ts` | Store to wire via `syncableWrite` |
| `src/lib/sync/tableRegistry.ts` | Registry entries for `flashcards` and `reviewRecords` |
| `src/lib/sync/syncableWrite.ts` | The write wrapper (E92-S04) |
| `src/lib/sync/flashcardReplayService.ts` | NEW — FSRS replay service |
| `src/app/hooks/useSyncLifecycle.ts` | Register store refresh callback |
| `src/lib/spacedRepetition.ts` | `calculateNextReview` function (E59) |
| `src/lib/sync/__tests__/p0-sync.test.ts` | Test pattern reference |
| `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` | Nearest test pattern (E93-S02) |
| `src/data/types.ts` | `Flashcard`, `ReviewRating`, `CardState` types |

### lastGreenSha

`21216484317a6e23a176d9188f8e0981805213f1`
