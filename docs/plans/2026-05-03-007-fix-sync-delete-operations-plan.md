---
title: "fix: Sync engine ignores delete operations — deleted records reappear after refresh"
type: fix
status: completed
date: 2026-05-03
---

# fix: Sync engine ignores delete operations — deleted records reappear after refresh

## Overview

When a user deletes a course (or any syncable record), the local Dexie delete succeeds and a `SyncQueueEntry` with `operation: 'delete'` is enqueued. But the upload pipeline (`_uploadBatch`) never inspects the `operation` field — it treats every entry as an upsert of its payload. For deletes, the payload is `{ id: recordId }`, so the server row is upserted (not deleted) and its `updated_at` is bumped by the `moddatetime` trigger. The next download cycle fetches the still-present row and re-inserts it into Dexie via LWW, making the deleted record reappear. Users must delete 2–3 times, and only if the queue entry happens to dead-letter before a download cycle runs.

This affects **every syncable table** that uses `syncableWrite('…', 'delete', id)` — at least 20 store call sites across the app.

## Problem Frame

The sync engine's `_uploadBatch()` function ([syncEngine.ts:497](src/lib/sync/syncEngine.ts#L497)) builds `payloads = entries.map(e => e.payload)` and sends them all to `supabase.upsert()` (or `supabase.insert()` for insert-only tables). The `operation` field (`'put'`, `'add'`, `'delete'`) written by `syncableWrite` is never read during upload.

**Full cycle of the bug:**

1. User deletes a course → `syncableWrite('importedCourses', 'delete', courseId)` deletes from Dexie and enqueues `{ operation: 'delete', payload: { id: courseId } }`
2. Upload cycle runs → `_uploadBatch` upserts `{ id: courseId }` to `imported_courses`
3. The `moddatetime` trigger sets `updated_at = NOW()` on the still-present row
4. Next download cycle → row fetched (updated_at > lastSyncTimestamp) → `_applyLww` sees `local === undefined` (we deleted it) → re-inserts the row
5. Store refresh callback fires → course reappears in UI

**Why "2–3 times":** Timing-dependent. If the user refreshes before the upload cycle processes the delete entry, the course stays gone until the next periodic nudge (30s) or the next page load triggers `fullSync()`. The entry may also dead-letter after 5 failed attempts, but the server row remains regardless.

## Requirements Trace

### Functional Requirements

- **R1.** Deleting a syncable record must remove it from the Supabase server, not upsert a tombstone payload
- **R2.** Deleted records must not reappear after any subsequent sync cycle (upload or download)

### Scope Requirements

- **R3.** The fix must handle all tables that use `syncableWrite` delete — at minimum `importedCourses`, `importedVideos`, `importedPdfs`, `authors`, `books`, `bookReviews`, `shelves`, `bookShelves`, `readingQueue`, `learningPaths`, `learningPathEntries`, `challenges`, `courseReminders`, `notifications`, `studySchedules`, `opdsCatalogs`, `audiobookshelfServers`, `bookmarks`, `audioClips`, `bookHighlights`, `vocabularyItems`, `chatConversations`, `flashcards`. This includes all conflict strategies (LWW, insert-only, conflict-copy, monotonic) — the delete SQL path is strategy-agnostic.
- **R4.** The fix must cover insert-only tables that use delete (`studySessions` — verified via test at [syncEngine.test.ts:913](src/lib/sync/__tests__/syncEngine.test.ts#L913))

### Correctness Invariants

- **R5.** Coalescing must still work correctly — a delete followed by a re-add (or vice versa) of the same recordId should result in only the latest operation being uploaded

### Safety Requirements

- **R6.** Compound-PK tables that use delete in the future must be handled safely (currently no compound-PK table uses delete, but the code must not silently corrupt data if one does)

## Scope Boundaries

- **In scope:** Make `_uploadBatch` issue `DELETE` SQL for queue entries with `operation: 'delete'`
- **In scope:** Update sync engine tests to verify delete operations produce SQL DELETE calls
- **In scope:** Handle the interaction between delete and put/add entries within the same batch
- **Out of scope:** Soft-delete patterns. The `notes` table uses `conflictStrategy: 'conflict-copy'` with `fieldMap: { deleted: 'soft_deleted' }` — its current `syncableWrite('notes', 'delete', noteId)` call hard-deletes the local Dexie record without setting the `soft_deleted` flag on the server. Both the old behavior (upserting `{ id }` which leaves the row) and the new behavior (issuing SQL DELETE, destroying the row) are incorrect for the intended soft-delete design. This fix changes the behavior (the row will now be hard-deleted from Supabase), but the proper soft-delete implementation is deferred to a separate story. The `notes` table is excluded from R3's coverage list for this reason.
- **Out of scope:** Schema migrations or new columns
- **Out of scope:** Changes to `syncableWrite.ts` — it already correctly enqueues `operation: 'delete'`
- **Out of scope:** Compound-PK delete support — no compound-PK table currently uses delete; explicit guard with a clear error message

### Known Behavioral Change

- **`notes` table:** Currently `syncableWrite('notes', 'delete', noteId)` upserts `{ id: noteId }`, leaving the server row intact (though the `soft_deleted` column is never set — the soft-delete pattern was never fully wired on the upload side). After this fix, the same call site will issue a SQL DELETE, permanently removing the Supabase row. The local Dexie delete behavior is unchanged. Implementing the proper soft-delete upload path (setting `soft_deleted = true` based on `fieldMap.deleted` for tables that declare it) is deferred to a separate story. See scope note above for design rationale.

## Context & Research

### Relevant Code and Patterns

- [syncableWrite.ts](src/lib/sync/syncableWrite.ts) — correctly enqueues `operation: 'delete'` with payload `{ id: recordId }` and calls `syncEngine.nudge()`
- [syncEngine.ts:497–614](src/lib/sync/syncEngine.ts#L497) — `_uploadBatch()` processes all entries as upserts/inserts, never checking `operation`
- [syncEngine.ts:662–680](src/lib/sync/syncEngine.ts#L662) — `_applyLww()` re-inserts when `!local`, no way to distinguish "was deleted" from "never existed"
- [syncEngine.ts:783–819](src/lib/sync/syncEngine.ts#L783) — `_applyRecord()` already handles soft-delete via `record['deleted'] === true` guard for download
- [syncEngine.ts:1158–1203](src/lib/sync/syncEngine.ts#L1158) — `_doUpload()` groups entries by table, chunks into batches, calls `_uploadBatch`
- [syncEngine.ts:375–404](src/lib/sync/syncEngine.ts#L375) — `_coalesceQueue()` keeps only latest entry per `(tableName, recordId)`, which already handles delete-vs-put sequencing
- [tableRegistry.ts:340–347](src/lib/sync/tableRegistry.ts#L340) — `importedCourses` entry: LWW strategy, no compound PK, priority 2
- [syncEngine.test.ts:898–928](src/lib/sync/__tests__/syncEngine.test.ts#L898) — existing tests that explicitly verify the *broken* behavior ("verifies operation type is not special-cased")

### Affected Delete Call Sites (sampling)

At least 20+ stores call `syncableWrite('…', 'delete', id)`:
`useCourseImportStore`, `useAuthorStore`, `useBookStore`, `useBookReviewStore`, `useShelfStore`, `useReadingQueueStore`, `useLearningPathStore`, `useChallengeStore`, `useStudyScheduleStore`, `useOpdsCatalogStore`, `useAudiobookshelfStore`, `useBookmarkStore`, `useAudioClipStore`, `useHighlightStore`, `useVocabularyStore`, `useNoteStore`, `useFlashcardStore`, `useTutorStore`

All are affected by this bug. The fix in `_uploadBatch` corrects all of them simultaneously.

### Institutional Learnings

- [docs/solutions/sync/](docs/solutions/sync/) directory exists — no prior delete-specific solution documented
- The sync engine was built in E92-S05 (upload) + E92-S06 (download); delete handling was deferred

### External References

- Supabase JS client: `supabase.from(table).delete().in('id', ids)` for batch deletes
- Supabase JS client: `supabase.from(table).delete().eq('id', id)` for single-row deletes

## Key Technical Decisions

- **Issue SQL DELETE, not a soft-delete column:** Adding a `deleted_at` column to every table would require migrations on 20+ tables. SQL DELETE directly removes the server row, matching the user's intent and the local Dexie state. This is simpler and correct for all current use cases.
- **Separate deletes from writes within `_uploadBatch`:** Rather than splitting at the `_doUpload` level, handle the split inside `_uploadBatch` so the table-level batching and chunking logic stays unchanged. The function already receives entries grouped by table.
- **Process deletes before upserts in the same batch:** If a batch contains both a delete and a put for different recordIds (different records), the delete runs first. If coalescing worked correctly, there will never be both a delete and a put for the *same* recordId in the same batch.
- **Compound-PK guard:** No compound-PK table currently uses delete. Add an explicit check — if a delete entry targets a compound-PK table, throw a clear error rather than silently producing a wrong DELETE. When compound-PK deletes are needed in the future, the implementer will have a clear signal of what to implement.

## Implementation Units

- [ ] **Unit 1: Split delete and write operations in `_uploadBatch`**

**Goal:** Make the upload pipeline issue `DELETE` SQL for delete entries while continuing to upsert/insert write entries.

**Requirements:** R1, R2, R3, R4, R6

**Dependencies:** None

**Files:**
- Modify: `src/lib/sync/syncEngine.ts` (function `_uploadBatch`, lines ~497–614)

**Approach:**
- At the top of `_uploadBatch`, split `entries` into `deleteEntries` and `writeEntries` based on `entry.operation === 'delete'`
- For `deleteEntries`:
  - Extract IDs from payloads: `deleteEntries.map(e => e.payload.id)`
  - Guard: if the table has `compoundPkFields`, throw an error with a clear message (no compound-PK table uses delete today, and a bare `.in('id', …)` DELETE would be wrong for them)
  - Call `supabase.from(tableEntry.supabaseTable).delete().in('id', ids)`
  - On success: `db.syncQueue.bulkDelete(deleteEntries.map(e => e.id!))`
  - On error: use existing `_handleBatchError` (delete entries are already a separate batch — error handling path is identical)
- For `writeEntries`:
  - If no write entries remain, return success from the delete path
  - If write entries remain, proceed with the existing upsert/insert logic unchanged (the existing `payloads = entries.map(e => e.payload)` becomes `payloads = writeEntries.map(e => e.payload)`)
- Handle the case where delete succeeds but write fails (or vice versa) — they are independent operations; return `true` only if both succeed
- **Tradeoff:** When a batch for a STORAGE_TABLES table (`importedCourses`, `authors`, `importedPdfs`, `books`) contains both deletes and writes, and the write half succeeds while the delete half fails (returning `false`), the caller (`_doUpload`) skips `uploadStorageFilesForTable()` for that batch. The successfully upserted rows' binary assets will not reach Supabase Storage until the next sync cycle. This is accepted — storage upload is already non-fatal best-effort, and the mixed-operation-in-same-batch scenario is low-probability.

**Patterns to follow:**
- Existing error handling in `_uploadBatch` — `_handleBatchError` with retry callback
- Existing success path: `db.syncQueue.bulkDelete(entries.map(e => e.id!))` after successful Supabase call
- Single-entry delete pattern used in monotonic RPC path ([syncEngine.ts:552](src/lib/sync/syncEngine.ts#L552))

**Test scenarios:**
- Happy path: Delete entry for LWW table → `supabase.delete().in('id', […])` is called, entry removed from queue
- Happy path: Delete entry for insert-only table → `supabase.delete().in('id', […])` is called (same behavior regardless of conflict strategy)
- Happy path: Batch with 3 delete entries for same table → single `delete().in('id', [id1, id2, id3])` call
- Happy path: Batch with mixed delete + put entries → delete runs first, then upsert for puts; queue cleared for both groups on success
- Happy path: Batch with only put entries → existing upsert path unchanged (no regression)
- Edge case: Empty delete group (all entries are puts) → existing upsert path, no DELETE call
- Edge case: Empty write group (all entries are deletes) → only DELETE runs, no upsert call
- Edge case: Compound-PK table delete attempt → throws with clear message including table name
- Error path: DELETE fails with 5xx → retry via `_handleBatchError`, entry retried or dead-lettered
- Error path: DELETE fails with 4xx (non-401) → dead-lettered immediately
- Error path: Mixed batch: delete succeeds, upsert fails → delete entries removed from queue, upsert entries retried
- Error path: Mixed batch: delete fails, upsert succeeds → delete entries retried, upsert entries removed from queue

**Verification:**
- Deleting a course and refreshing the page results in the course staying deleted
- All 20+ affected stores' delete operations produce server-side row removal
- Existing tests that don't test delete behavior continue to pass unchanged

---

- [ ] **Unit 2: Update sync engine tests for delete behavior**

**Goal:** Replace tests that verify the broken behavior with tests that verify the correct DELETE behavior.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/lib/sync/__tests__/syncEngine.test.ts` (lines ~898–928)

**Approach:**
- Replace the "upserts delete payload for LWW table" test (line 899) with a test that verifies `mockDelete().in()` is called with the correct IDs and the entry is removed from the queue
- Replace the "inserts delete payload for insert-only table" test (line 913) with a test that verifies `mockDelete().in()` is called (insert-only tables also use DELETE for deletes — the conflict strategy only matters for writes)
- Add test: mixed batch with delete + put entries, verifying both `mockDelete` and `mockUpsert`/`mockInsert` are called
- Add test: delete-only batch for LWW table
- Add test: delete error handling (5xx retry, 4xx dead-letter)
- Add test: compound-PK table delete throws
- Ensure the test mock setup includes the chained delete mock. The `supabase.from()` call returns an object with `delete`, which must return `{ in: mockDeleteIn }` where `mockDeleteIn` resolves to `{ error: null }`. Follow the existing chaining pattern used by `mockSelect` → `{ order: mockOrder }` in the test file: `const mockDeleteIn = vi.fn().mockResolvedValue({ error: null })` and `const mockDelete = vi.fn().mockReturnValue({ in: mockDeleteIn })`, then add `delete: mockDelete` to the mock chain returned by `mockFrom`

**Patterns to follow:**
- Existing test structure: `makeEntry()`, `setQueueEntries()`, `vi.useFakeTimers()`, `advanceTimersByTimeAsync(201)`
- Existing mock pattern: `mockUpsert`, `mockInsert` are `vi.fn()` on the Supabase chain

**Test scenarios:**
- Delete entry for LWW table → `mockDelete.in()` called with correct id array, entry dequeued
- Delete entry for insert-only table → `mockDelete.in()` called (not `mockInsert`)
- Batch with only delete entries → `mockDelete.in()` called, no upsert/insert calls
- Batch with mixed operations → both `mockDelete.in()` and `mockUpsert` called independently
- Delete network error (5xx) → entry retried, not dead-lettered on first failure
- Delete 4xx error → entry dead-lettered immediately
- Compound-PK delete → throws before any Supabase call
- Delete with empty entries array (all puts) → no mockDelete call, existing upsert path preserved

**Verification:**
- `npm run test:unit` passes with updated assertions
- All delete-related test descriptions reflect the corrected behavior

---

- [ ] **Unit 3: Add E2E test for delete persistence**

**Goal:** Verify end-to-end that deleting a course survives a page refresh.

**Requirements:** R1, R2

**Dependencies:** Unit 1

**Files:**
- Create: `tests/e2e/courses-delete-persistence.spec.ts`

**Approach:**
- Scope this as a **local delete durability** test — it verifies the Dexie delete survives page reload without depending on the Supabase round-trip
- Seed a course into IndexedDB (via the existing `seedImportedCourse` or equivalent factory)
- Navigate to the courses page
- Delete the course via UI (click delete button, confirm dialog)
- Verify course is removed from the visible list
- Reload the page (`page.reload()`)
- Verify the course does NOT reappear (local delete is durable)
- **Supabase dependency:** Verifying the full server round-trip (delete → upload → download → not re-inserted) requires Supabase credentials in the test environment. When `supabase` is null (local dev without env vars), `_uploadBatch` returns early, so the sync cycle is a no-op. The E2E test captures the local durability guarantee; server-side verification is covered by Unit 2's sync engine unit tests which mock the Supabase client.

**Patterns to follow:**
- Existing E2E test patterns in [tests/e2e/](tests/e2e/)
- Local storage fixture for guest session: [tests/support/fixtures/local-storage-fixture.ts](tests/support/fixtures/local-storage-fixture.ts)
- IndexedDB seeding patterns from existing course-related specs

**Test scenarios:**
- Happy path: Delete a course via UI → reload page → course stays deleted
- Happy path: Delete multiple courses → reload → all stay deleted
- Edge case: Delete course, immediately reload before sync → course stays deleted (local delete is durable)

**Verification:**
- E2E test passes in Chromium
- Test is not flaky (uses deterministic seeding, no `waitForTimeout`)

## System-Wide Impact

- **Interaction graph:** `_uploadBatch` is called by `_doUpload`, which is called by `_runUploadCycle`, triggered by `syncEngine.nudge()` (called from `syncableWrite` after every write). The fix changes the Supabase SQL issued during upload — no changes to the nudge/coalesce/batch/retry pipeline.
- **Error propagation:** Delete failures use the same `_handleBatchError` → `_retryOrDeadLetter` path as upsert failures. No new error propagation paths.
- **State lifecycle risks:** The coalescing step (`_coalesceQueue`) already handles rapid delete→re-add (or re-add→delete) by keeping only the latest entry per `(tableName, recordId)`. No new race conditions are introduced.
- **API surface parity:** All 20+ delete call sites benefit automatically — no per-store changes needed.
- **Integration coverage:** The `_applyRecord` soft-delete guard for download ([syncEngine.ts:800](src/lib/sync/syncEngine.ts#L800)) remains unchanged. If a record is properly deleted from the server, it won't appear in download results at all — the soft-delete guard is only needed for tables that use soft-delete instead of hard DELETE.
- **Unchanged invariants:** `syncableWrite` behavior is unchanged — it still deletes locally and enqueues. Coalescing still keeps only the latest entry per key. Download still applies LWW/monotonic/insert-only/conflict-copy strategies. The only change is what SQL the upload pipeline issues for entries with `operation: 'delete'`.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A delete entry with a missing or malformed `payload.id` could crash the batch | The `recordId` guard in `syncableWrite` (line 101–109) already validates the id before enqueue. Only well-formed entries reach `_uploadBatch`. |
| Compound-PK tables start using delete before compound-PK delete support is built | The explicit guard throws a clear error message naming the table and the limitation. The entry is not silently corrupted. |
| Performance: large delete batches (e.g., clearing many shelf entries at once) | `.delete().in('id', ids)` handles batches up to `BATCH_SIZE` (50). Supabase supports this efficiently. |

## Sources & References

- **Bug report:** User report — deleted courses reappear after page refresh
- Related code: `src/lib/sync/syncEngine.ts` (`_uploadBatch`, `_applyLww`, `_applyRecord`)
- Related code: `src/lib/sync/syncableWrite.ts` (delete enqueue)
- Related code: `src/lib/sync/tableRegistry.ts` (table configurations)
- Related tests: `src/lib/sync/__tests__/syncEngine.test.ts:898–928`
- Supabase docs: `delete().in()` — https://supabase.com/docs/reference/javascript/delete
