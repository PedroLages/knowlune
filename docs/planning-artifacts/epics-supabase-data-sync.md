# Supabase Data Sync — Epics E92-E97

> **Source document** for `docs/implementation-artifacts/sprint-status.yaml` (E92-E97 entries).
> **Design doc:** `docs/plans/2026-03-31-supabase-data-sync-design.md`
> **Architecture:** `docs/plans/sync-architecture.md` (superseded — see design doc)
> **Updated:** 2026-04-13 — expanded from 28 → 39 stories to cover Dexie v51 (51 tables, 30+ syncable)
>
> **Dependency chain:** E92 → E93-E96 (parallel) → E97
> **Depends on:** E19 (Auth complete), E89 (unified courses), E90 (AI model config), E91 (caption settings)

---

## Epic 92: Sync Foundation — "Continue Where I Left Off"

**Tagline:** The invisible backbone that makes every device feel like home.

**Description:** Delivers the core sync infrastructure: Dexie schema migration, table registry, `syncableWrite()` wrapper, upload/download engine, auth lifecycle integration, and P0 table wiring. After this epic, content progress and study sessions sync reliably across devices. All subsequent sync epics (E93-E96) depend on this foundation.

**Dependency note:** No internal dependencies beyond E19 (Auth). All 9 stories run sequentially: migrations → schema → registry → wrapper → upload → download → triggers → auth → wire.

**Stories: 9**

---

### E92-S01: Supabase P0 Migrations and Extensions

**Summary:** Create all Postgres extensions and P0 tables required for the sync foundation. This is the database layer that the sync engine writes into.

**Key Deliverables:**
- Extensions: `moddatetime` (auto-update `updated_at`), `pgcrypto` (UUID generation), `vector` (pgvector for embeddings, installed now, used in E93), `supabase_vault` (credential storage, used in E95)
- P0 tables: `content_progress`, `study_sessions`, `video_progress`
- RLS policies on all P0 tables: `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE
- Monotonic upsert functions:
  - `upsert_content_progress(p_user_id, p_content_id, p_content_type, p_status, p_progress_pct, p_updated_at)` — enforces status precedence: `completed > in_progress > not_started`; uses `GREATEST()` for `progress_pct`
  - `upsert_video_progress(p_user_id, p_video_id, p_watched_seconds, p_duration_seconds, p_updated_at)` — uses `GREATEST()` for `watched_seconds`
- `updated_at` columns use `moddatetime` trigger for auto-update
- Migration file: `supabase/migrations/20260413000001_p0_sync_foundation.sql`

**Acceptance Criteria:**
- All 4 extensions installed and visible in `pg_extension`
- `content_progress`, `study_sessions`, `video_progress` tables exist with correct columns and types
- RLS policies block cross-user access: a query with `auth.uid() = userA` cannot read `userB` rows
- `upsert_content_progress()` called with `status='not_started'` after `status='completed'` leaves status as `completed`
- `upsert_video_progress()` called with lower `watched_seconds` than existing value leaves existing value unchanged
- Migration is idempotent (re-running does not error)

---

### E92-S02: Dexie v52 Migration and Sync Infrastructure

**Summary:** One schema migration that adds sync fields (`userId`, `updatedAt`) to all 30+ syncable Dexie tables, adds the `syncQueue` and `syncMetadata` tables, and backfills existing records with the authenticated user's ID.

**Key Deliverables:**
- `src/lib/db/migrations/v52.ts` — Dexie v52 migration:
  - Adds `userId` and `updatedAt` compound index to all syncable tables (see tableRegistry in E92-S03 for full list)
  - Adds `syncQueue` table: `{ id, tableName, recordId, operation, payload, attempts, createdAt, updatedAt }`
  - Adds `syncMetadata` table: `{ id, tableName, lastSyncTimestamp, lastUploadedKey }`
- `src/lib/db/checkpoint.ts` updated from v51 → v52
- Backfill: on migration open, read userId from auth store (Zustand persist or Supabase session), stamp all existing records in syncable tables with that userId and current timestamp
- Backfill is batched (1000 records at a time) to avoid blocking the UI thread
- If no authenticated user, backfill skipped (records will be backfilled at sign-in per E92-S08)

**Acceptance Criteria:**
- Migration runs without data loss on a v51 database
- All syncable tables have `userId` and `updatedAt` indexes after migration
- `syncQueue` and `syncMetadata` tables exist and are empty after fresh migration
- Running `checkpoint.ts` programmatically confirms schema version is 52
- Existing records in `contentProgress` have `userId` populated after migration (when signed in)
- Migration performance: 10,000-record database migrates in under 3 seconds

---

### E92-S03: Sync Table Registry and Field Mapping

**Summary:** A single declarative configuration file (`tableRegistry.ts`) that describes every syncable table — its Supabase table name, conflict strategy, camelCase↔snake_case field map, non-serializable fields to strip, monotonic fields, compound PK fields, and Vault credential fields. All sync engine code reads from this registry rather than hardcoding per-table logic.

**Key Deliverables:**
- `src/lib/sync/tableRegistry.ts`:
  ```ts
  export interface TableRegistryEntry {
    dexieTable: string;           // e.g. 'contentProgress'
    supabaseTable: string;        // e.g. 'content_progress'
    conflictStrategy: 'lww' | 'monotonic' | 'insert-only' | 'conflict-copy' | 'skip';
    priority: 0 | 1 | 2 | 3 | 4; // download priority order
    fieldMap: Record<string, string>; // camelCase → snake_case
    stripFields?: string[];        // non-serializable fields to remove before upload
    monotonicFields?: string[];    // fields that must never decrease
    compoundPkFields?: string[];   // for tables with composite PKs
    vaultFields?: string[];        // fields stored in Vault (never in Postgres row)
    insertOnly?: boolean;          // shorthand for conflictStrategy='insert-only'
    skipSync?: boolean;            // evaluated in E96-S04 spike
  }
  ```
- Entries for all 30+ syncable tables, organized by priority:
  - **P0:** `contentProgress`, `studySessions`, `videoProgress`
  - **P1:** `notes`, `bookmarks`, `flashcards`, `reviewRecords`, `flashcardReviews`, `embeddings`, `bookHighlights`, `vocabularyItems`, `audioBookmarks`, `audioClips`, `chatConversations`, `learnerModels`
  - **P2:** `importedCourses`, `importedVideos`, `importedPdfs`, `authors`, `books`, `bookReviews`, `shelves`, `bookShelves`, `readingQueue`, `chapterMappings`
  - **P3:** `learningPaths`, `learningPathEntries`, `challenges`, `courseReminders`, `notifications`, `careerPaths`, `pathEnrollments`, `studySchedules`, `opdsCatalogs`, `audiobookshelfServers`, `notificationPreferences`
  - **P4:** `quizzes`, `quizAttempts`, `aiUsageEvents`
- `src/lib/sync/fieldMapper.ts`: pure functions `toSnakeCase(entry, record)` and `toCamelCase(entry, record)` using the registry field map
- Unit tests in `src/lib/sync/__tests__/tableRegistry.test.ts`: round-trip tests for each table (camelCase → snake_case → camelCase yields original)

**Acceptance Criteria:**
- Every syncable table (30+) has a registry entry
- Round-trip field mapping tests pass for all tables with non-trivial field maps
- Non-serializable fields (`directoryHandle`, `coverImageHandle`, `fileHandle`, `photoHandle`) listed under `stripFields` for correct tables
- Vault fields (`password` in `opdsCatalogs`, `apiKey` in `audiobookshelfServers`) listed under `vaultFields`
- Monotonic fields correctly listed: `videoProgress.watchedSeconds`, `bookProgress.progress`, `challengeProgress.progress`, `vocabularyItem.masteryLevel`
- `flashcardReviews` and `aiUsageEvents` have `conflictStrategy: 'insert-only'`
- `skipSync` field exists (populated in E96-S04); registry compiles without errors before that epic

---

### E92-S04: syncableWrite Wrapper

**Summary:** The single write path for all synced Dexie mutations. All stores that sync must use `syncableWrite()` instead of calling Dexie directly. The wrapper stamps metadata, writes optimistically, and enqueues for upload.

**Key Deliverables:**
- `src/lib/sync/syncableWrite.ts`:
  ```ts
  export async function syncableWrite<T extends SyncableRecord>(
    tableName: string,
    operation: 'put' | 'add' | 'delete',
    record: T | string, // string for delete (id)
    options?: { skipQueue?: boolean }
  ): Promise<void>
  ```
- Behavior:
  1. Stamps `userId` (from auth store) and `updatedAt` (ISO timestamp from `Date.now()`) on the record
  2. Writes to Dexie immediately (optimistic, no await on Supabase)
  3. Applies `stripFields` from tableRegistry before building queue payload
  4. Enqueues to `syncQueue` with `operation`, `tableName`, `recordId`, `payload` (stripped), `attempts: 0`
  5. **Unauthenticated path:** If no `userId`, writes to Dexie but skips queue entirely (no error thrown)
  6. Calls `syncEngine.nudge()` to trigger an immediate incremental upload if engine is running
- `src/lib/sync/deviceIdentity.ts`: generates and persists a `deviceId` UUID in localStorage on first call
- `src/lib/sync/__tests__/syncableWrite.test.ts`: unit tests covering all paths

**Acceptance Criteria:**
- Write appears in Dexie immediately (before any network activity)
- `syncQueue` entry created with correct `operation`, `tableName`, `recordId`, and stripped payload
- Unauthenticated write (no userId): Dexie write succeeds, no queue entry created, no error thrown
- After re-auth (sign-in), queue flush triggered (via `syncEngine.start()` in E92-S08)
- `stripFields` removes `directoryHandle`, `fileHandle`, `photoHandle` from applicable records
- `vaultFields` are NOT included in queue payload (confirmed via unit test)
- Unit tests: 100% branch coverage for authenticated/unauthenticated/delete/put/add paths

---

### E92-S05: Sync Engine Upload Phase

**Summary:** The upload half of the sync engine. Reads from `syncQueue`, coalesces duplicate entries, batches upserts to Supabase, and handles retries with exponential backoff.

**Key Deliverables:**
- `src/lib/sync/syncEngine.ts` — upload phase:
  - **Queue coalescing:** For each `(tableName, recordId)` pair, keep only the latest queue entry by `createdAt` (earlier entries for the same record are discarded before upload)
  - **Batch upsert:** 100 records per batch; uses `supabase.from(table).upsert(batch, { onConflict: 'id' })`
  - **Monotonic upsert override:** Tables with `conflictStrategy: 'monotonic'` call their dedicated Postgres function (e.g., `upsert_video_progress()`) instead of generic upsert
  - **INSERT-only tables:** Use `supabase.from(table).insert(batch)` (no upsert); duplicate inserts are no-ops via `ON CONFLICT DO NOTHING`
  - **Retry logic:** Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 attempts); only on 5xx or network errors; 4xx (except 401) are permanent failures → dead-letter
  - **Dead-letter:** After 5 failures, update queue entry `status = 'dead'`; never retried automatically; surfaced in Sync Settings panel (E97-S02)
  - **Concurrency guard:** `navigator.locks.request('sync-upload', ...)` serializes upload runs; if a lock is already held, the new call returns immediately
- `syncEngine.nudge()`: signals the engine to run an upload cycle soon (debounced 200ms)

**Acceptance Criteria:**
- Queue entries uploaded and deleted from `syncQueue` on success
- Coalescing: two puts for the same record before upload → only one Supabase call
- Failed entry retries with correct backoff delays (verifiable via unit test with fake timers)
- After 5 failures, entry has `status = 'dead'` and stops retrying
- 5xx errors retry; 4xx (400/403/404) dead-letter immediately; 401 triggers `supabase.auth.refreshSession()`
- Concurrent `nudge()` calls do not cause parallel uploads (lock serializes them)
- Batch of 250 records splits into 3 Supabase calls (100 + 100 + 50)

---

### E92-S06: Sync Engine Download and Apply Phase

**Summary:** Incremental download of server-side changes since the last sync checkpoint, merged into Dexie using per-table conflict strategies from the registry.

**Key Deliverables:**
- `src/lib/sync/syncEngine.ts` — download phase:
  - Per-table download: `SELECT * FROM {table} WHERE user_id = auth.uid() AND updated_at >= lastSyncTimestamp ORDER BY updated_at ASC`
  - Reads `lastSyncTimestamp` from `syncMetadata` per table (null = full download)
  - **LWW apply:** Compare `updated_at` of downloaded record vs local Dexie record; server wins if server is newer; client wins if client is newer (client has uncommitted changes)
  - **Monotonic apply:** Use `Math.max()` for monotonic fields; never let server overwrite with a lower value
  - **INSERT-only apply:** Only insert if `id` not already present in Dexie (never update existing)
  - **Conflict-copy apply:** If content differs and timestamps are within 5 seconds → save both versions; tag the non-authoritative copy with `{ conflictCopy: true, conflictSourceId: originalId }`
  - After successful apply, update `syncMetadata.lastSyncTimestamp` to the max `updated_at` seen in this batch
  - Refresh affected Zustand stores by calling existing `load*()` / `hydrate*()` methods (do not patch Zustand state directly)
- `syncEngine.start(userId)` and `syncEngine.stop()` public API

**Acceptance Criteria:**
- Only records with `updated_at >= lastSyncTimestamp` are fetched (confirmed by inspecting Supabase query log)
- LWW: server record newer than local → local updated; client record newer than server → local kept
- Monotonic: server sends `watchedSeconds: 100` when local is `200` → local stays `200`
- INSERT-only: downloaded `flashcardReview` with existing `id` → not duplicated in Dexie
- Conflict-copy: two records with same id but different content within 5s → both present in Dexie, one tagged `conflictCopy: true`
- `syncMetadata.lastSyncTimestamp` advances after successful download
- Affected Zustand stores reflect new data after apply (e.g., `useNoteStore` shows downloaded note)

---

### E92-S07: Sync Triggers and Offline Handling

**Summary:** Wires all the events that cause the sync engine to run, and ensures graceful behavior when the device is offline.

**Key Deliverables:**
- `src/app/hooks/useSyncLifecycle.ts`:
  - **App open:** calls `syncEngine.fullSync()` on mount
  - **Periodic timer:** `setInterval` every 30 seconds calls `syncEngine.nudge()`
  - **Visibility change:** `document.addEventListener('visibilitychange', ...)` — when `document.visibilityState === 'visible'`, calls `syncEngine.nudge()`
  - **Online/offline:** `window.addEventListener('online', ...)` resumes sync; `window.addEventListener('offline', ...)` pauses sync (sets `syncEngine.paused = true`)
  - **Before unload:** `window.addEventListener('beforeunload', ...)` uses `navigator.sendBeacon` to flush any pending small queue items (payload < 64KB)
- Offline state: `syncEngine.paused = true` disables upload and download; all `syncableWrite()` calls still write to Dexie (queue entries accumulate); no errors thrown
- Zustand `useSyncStatusStore`: tracks `{ status: 'synced' | 'syncing' | 'offline' | 'error', pendingCount: number, lastSyncAt: Date | null }`

**Acceptance Criteria:**
- Sync fires on app open (confirmed via network tab showing Supabase requests)
- Sync fires every 30 seconds when app is open and online
- Sync fires when switching from another tab back to the app
- Setting `navigator.onLine = false` (simulated) pauses sync without any console errors
- Coming back online triggers an immediate sync cycle
- `useSyncStatusStore.pendingCount` reflects accurate queue depth
- `useSyncLifecycle` hook is called from the root app layout (not a specific page)

---

### E92-S08: Auth Lifecycle Integration and userId Backfill

**Summary:** Starts and stops the sync engine with the user's auth state. Handles the first-sign-in case where the user has existing local data and must choose whether to link it or start fresh.

**Key Deliverables:**
- Modify `src/app/hooks/useAuthLifecycle.ts`:
  - On `SIGNED_IN` and `INITIAL_SESSION` events: call `syncEngine.start(userId)`
  - On `SIGNED_OUT` event: call `syncEngine.stop()`
- First-sign-in detection: if `syncEngine.start()` is called with a userId and Dexie contains records with `userId = null` or `userId != newUserId`, show the "Link my data" dialog
- **"Link my data" dialog** (`src/app/components/sync/LinkDataDialog.tsx`):
  - Shows count of local records by category (e.g., "12 courses, 47 notes, 3 books")
  - "Link to my account" button: backfills all `userId = null` records with new userId, then triggers full upload
  - "Start fresh" button: clears all Dexie tables (except `syncMetadata`), then triggers full download
  - Cannot be dismissed without choosing (modal, no close button)
- Backfill function: `backfillUserId(userId)` — updates all records across all syncable tables where `userId` is null; batched 1000 at a time

**Acceptance Criteria:**
- Sync engine starts automatically after successful sign-in (within one event cycle)
- Sync engine stops after sign-out (no Supabase calls made after SIGNED_OUT)
- "Link my data" dialog appears when signing in with existing local data
- "Link to my account" correctly backfills all local records and triggers upload
- "Start fresh" clears all local data and triggers download from server
- Dialog does not appear on subsequent sign-ins (only first time, or when userId changes)
- Backfill correctly handles all 30+ syncable tables without missing any

---

### E92-S09: Wire P0 Stores with syncableWrite

**Summary:** Replace direct Dexie writes in the three P0 stores with `syncableWrite()`, making content progress and study sessions the first data to sync end-to-end.

**Key Deliverables:**
- `src/app/stores/useContentProgressStore.ts`: all `put`/`delete` calls → `syncableWrite('contentProgress', ...)`
- `src/app/stores/useSessionStore.ts`: all `add` calls → `syncableWrite('studySessions', 'add', ...)` (INSERT-only)
- Video progress writes (wherever they live): → `syncableWrite('videoProgress', ...)` using monotonic upsert path
- Field stripping applied per tableRegistry (verify no non-serializable fields in P0 tables — none expected, but confirm)
- Integration test `tests/sync/p0-sync.spec.ts`: seeds Dexie, signs in, waits for sync, queries Supabase to confirm records present

**Acceptance Criteria:**
- Content progress change appears in Supabase `content_progress` table within 30 seconds
- Study session records uploaded as INSERT-only (no update/delete of historical sessions)
- Video progress uses `upsert_video_progress()` monotonic function (never regresses in Supabase)
- Manual E2E: progress change on Device A appears in Dexie on Device B after triggering sync
- No direct `db.contentProgress.put()` calls remain in `useContentProgressStore`
- All three stores pass existing unit tests after refactor

---

## Epic 93: Learning Content Sync — "My Notes Everywhere"

**Tagline:** Your annotations, flashcards, and conversations follow you across every device.

**Description:** Syncs all user-generated learning content: notes, bookmarks, flashcards with FSRS review history, embeddings for semantic search, book highlights and vocabulary, audio bookmarks and clips, and AI tutor conversations. After this epic, a user's entire learning record is available on any device.

**Dependency note:** Requires E92 complete (especially E92-S03 table registry and E92-S04 syncableWrite). Stories within this epic can run in parallel after E93-S01 migrations complete.

**Stories: 8**

---

### E93-S01: P1 Supabase Migrations

**Summary:** Create all Postgres tables for P1 learning content. This migration must complete before any other E93 wiring stories begin.

**Key Deliverables:**
- Tables:
  - `notes` (id, user_id, content_id, content_type, title, content, tags[], soft_deleted, conflict_copy, conflict_source_id, created_at, updated_at)
  - `bookmarks` (id, user_id, video_id, position_seconds, label, created_at, updated_at)
  - `flashcards` (id, user_id, front, back, tags[], source_type ['manual'|'note'|'book'], source_note_id, source_book_id, source_highlight_id, due_date, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, created_at, updated_at)
  - `review_records` (id, user_id, flashcard_id, scheduled_days, elapsed_days, created_at, updated_at)
  - `flashcard_reviews` (id, user_id, flashcard_id, rating, reviewed_at) — INSERT-only policy
  - `embeddings` (id, user_id, note_id, vector vector(384), created_at, updated_at) — pgvector HNSW index
  - `book_highlights` (id, user_id, book_id, chapter_id, cfi_range, text, color, note, flashcard_id, soft_deleted, created_at, updated_at)
  - `vocabulary_items` (id, user_id, word, definition, example, mastery_level int, source_book_id, source_highlight_id, flashcard_id, created_at, updated_at)
  - `audio_bookmarks` (id, user_id, book_id, position_seconds, label, created_at, updated_at)
  - `audio_clips` (id, user_id, book_id, start_time_seconds, end_time_seconds, label, sort_order, created_at, updated_at)
  - `chat_conversations` (id, user_id, course_id, messages jsonb, created_at_epoch bigint, updated_at)
  - `learner_models` (id, user_id, course_id, vocabulary_level, strengths jsonb, misconceptions jsonb, quiz_stats jsonb, created_at, updated_at)
- RLS policies: `auth.uid() = user_id` on all tables
- INSERT-only policy on `flashcard_reviews`: allows INSERT and SELECT, blocks UPDATE and DELETE
- `search_similar_notes(p_user_id uuid, p_query_vector vector(384), p_limit int)` function using `<=>` cosine distance operator with HNSW index
- Migration file: `supabase/migrations/20260413000002_p1_learning_content.sql`

**Acceptance Criteria:**
- All 12 tables exist with correct columns and types
- pgvector HNSW index created on `embeddings.vector` column
- INSERT-only policy on `flashcard_reviews` verified: `UPDATE` returns 403, `INSERT` succeeds
- `search_similar_notes()` returns results ordered by cosine similarity (tested with known vectors)
- RLS policies block cross-user access on all tables
- Migration idempotent

---

### E93-S02: Wire Notes and Bookmarks with Sync

**Summary:** All note and video bookmark mutations go through `syncableWrite()`, enabling notes to sync across devices with soft-delete support.

**Key Deliverables:**
- `src/app/stores/useNoteStore.ts`: `createNote`, `updateNote`, `deleteNote` (sets `softDeleted: true`) → `syncableWrite('notes', ...)`
- `src/app/stores/useBookmarkStore.ts` (video bookmarks): `addBookmark`, `updateBookmark`, `deleteBookmark` → `syncableWrite('bookmarks', ...)`
- Field mapping in tableRegistry (E92-S03 already has entries; confirm `notes.tags` maps to `notes.tags` as JSONB array)
- Soft-delete: `deleteNote()` calls `syncableWrite('notes', 'put', { ...note, softDeleted: true })` rather than a Dexie `delete()`; download phase respects `soft_deleted: true` by deleting from local Dexie

**Acceptance Criteria:**
- New note created on Device A appears in Device B's Dexie after sync
- Note edited on Device A: updated content appears on Device B
- Deleted note (soft-deleted): `softDeleted: true` flag syncs; note disappears from Device B's UI
- Video bookmark position (seconds) syncs correctly without precision loss
- No direct `db.notes.put()` calls remain in `useNoteStore` outside of the sync layer
- Existing unit tests for note store pass after refactor

---

### E93-S03: Note Conflict Preservation

**Summary:** When two devices edit the same note concurrently, both versions are preserved with a conflict tag and the user is notified.

**Key Deliverables:**
- Conflict detection in download apply phase (`syncEngine.ts`):
  - Condition: incoming server record has same `id` as local record, different `content`, and `|server.updated_at - local.updated_at| < 5000ms` (5-second window)
  - Resolution: save both — local record gets `conflictCopy: true, conflictSourceId: serverId`; server record also written to Dexie as a new note with original `id`
- Toast notification (via Sonner): "Note conflict detected — both versions saved. Tap to review." — navigates to note list filtered to conflicted notes on tap
- `ConflictBadge` component in note list item: shown when `conflictCopy: true`
- No automated merge (user resolves manually)

**Acceptance Criteria:**
- Simultaneous edit on Device A and Device B creates two note records in Dexie on both devices after sync
- Both versions are visible in the notes list (one tagged with conflict badge)
- Toast notification appears within 3 seconds of conflict detection
- Toast tap navigates to conflicted notes view
- No data loss: both versions' content is preserved in full
- Conflict detection does not trigger for sequential edits (A edits, syncs, B edits later → no conflict)

---

### E93-S04: Flashcard Sync with FSRS Review Log Replay

**Summary:** Sync flashcards and their SRS scheduling state using review log replay rather than syncing derived state directly. The FSRS algorithm (used since E59) recomputes scheduling from the merged log of reviews from all devices.

**Key Deliverables:**
- `src/app/stores/useFlashcardStore.ts`:
  - `createFlashcard`, `updateFlashcard`, `deleteFlashcard` → `syncableWrite('flashcards', ...)`
  - `recordReview(flashcardId, rating)` → `syncableWrite('flashcardReviews', 'add', ...)` (INSERT-only)
- Download phase for `flashcardReviews`: after downloading all reviews for the user, sort by `reviewed_at`, replay through `calculateNextReview()` (FSRS, from E59), update each flashcard's scheduling fields in Dexie
- `src/lib/fsrs/replay.ts`: `replayReviewLog(reviews: FlashcardReview[]): Map<string, FlashcardSchedule>` — pure function, testable
- Book-sourced flashcards (`sourceType: 'book'`, `sourceBookId`, `sourceHighlightId`): all source reference fields synced correctly; FK integrity not enforced in Supabase (books may not be synced yet)

**Acceptance Criteria:**
- Flashcard created on Device A appears on Device B after sync
- Review performed on Device A updates the `dueDate` on Device B (FSRS scheduling applied)
- Merged review log from two devices replays correctly: same result as if reviews were done sequentially
- Book flashcards (`sourceType: 'book'`) retain `sourceBookId` and `sourceHighlightId` after sync round-trip
- `replayReviewLog()` unit tests: known review sequence produces expected FSRS schedule
- INSERT-only: downloading a `flashcardReview` that already exists in Dexie does not create a duplicate

---

### E93-S05: Embeddings Sync with pgvector

**Summary:** Upload note embedding vectors to Supabase for server-side semantic search, without blocking the note save experience.

**Key Deliverables:**
- After a note is saved via `syncableWrite()`, trigger embedding generation in the background (Web Worker or `requestIdleCallback`)
- Embedding model: reuse whatever is in place from the notes feature (likely a local ONNX model or API call)
- `syncableWrite('embeddings', 'put', { id: noteId, userId, noteId, vector: Float32Array → Array<number> })` — vector serialized as JSON array in Dexie, stored as `vector(384)` type in Supabase
- On note update: embedding re-generated and re-uploaded
- On note delete (soft-delete): embedding deleted from Supabase (`syncableWrite('embeddings', 'delete', noteId)`)
- `search_similar_notes()` Edge Function wrapper (or direct RPC call) for client-side semantic search queries

**Acceptance Criteria:**
- Note embedding present in Supabase `embeddings` table after sync (within one sync cycle after note save)
- Embedding upload does not delay note save (note appears in list immediately)
- `search_similar_notes()` RPC returns semantically related notes for a test query
- Embedding updated when note content changes (new vector in Supabase after sync)
- Deleted note: corresponding embedding removed from Supabase

---

### E93-S06: Book Highlights and Vocabulary Sync

**Summary:** Sync user annotations from reading (highlights, vocabulary items) including the links between highlights and flashcards.

**Key Deliverables:**
- `src/app/stores/useHighlightStore.ts` (or wherever book highlight CRUD lives):
  - `addHighlight`, `updateHighlight`, `deleteHighlight` → `syncableWrite('bookHighlights', ...)`
  - Soft-delete pattern (same as notes)
- `src/app/stores/useVocabularyStore.ts`:
  - `addVocabularyItem`, `updateVocabularyItem` → `syncableWrite('vocabularyItems', ...)`
  - `masteryLevel` declared as `monotonicField` in tableRegistry: download apply uses `Math.max(local.masteryLevel, server.masteryLevel)`
- `flashcardId` FK: synced as part of both `bookHighlights` and `vocabularyItems` records; FK integrity not enforced server-side

**Acceptance Criteria:**
- Highlight created while reading on Device A appears on Device B after sync
- `masteryLevel: 2` on Device A cannot be overwritten by `masteryLevel: 1` from Device B
- Deleted highlight (soft-deleted) syncs; highlight disappears from Device B's reader
- Vocabulary item with `flashcardId` reference preserves the flashcard ID after round-trip
- Highlight `cfiRange` string (EPUB CFI format) preserved exactly without encoding changes
- Highlight `color` (hex string) preserved

---

### E93-S07: Audio Bookmarks and Audio Clips Sync

**Summary:** Sync audiobook position bookmarks and clipped audio ranges created by the user.

**Key Deliverables:**
- Wire audio bookmark writes (wherever they are persisted in the audio player flow — likely `useAudioPlayerStore` or similar):
  - `addAudioBookmark`, `updateAudioBookmark`, `deleteAudioBookmark` → `syncableWrite('audioBookmarks', ...)`
- `src/app/stores/useAudioClipStore.ts`:
  - `createClip`, `updateClip`, `deleteClip` → `syncableWrite('audioClips', ...)`
- `sortOrder` field for audio clips: integer, syncs as plain LWW field; client is responsible for maintaining sort order on moves
- Both tables use LWW conflict strategy

**Acceptance Criteria:**
- Audio bookmark placed at position 3600.5 seconds on Device A appears on Device B with the same position (float precision preserved)
- Audio clip (startTime: 120.0, endTime: 180.5) syncs with both times correct
- Deleted audio bookmark syncs (removed from Device B's bookmark list)
- Clip sort order preserved across sync
- `label` field (nullable string) syncs correctly (null round-trips as null, not empty string)

---

### E93-S08: Chat Conversations and Learner Models Sync

**Summary:** Sync AI tutor conversation history and per-course learner profile data, including special handling for epoch-millisecond timestamps used in chat conversations.

**Key Deliverables:**
- `src/app/stores/useTutorStore.ts`:
  - `saveConversation`, `updateConversation` → `syncableWrite('chatConversations', ...)`
  - `updateLearnerModel` → `syncableWrite('learnerModels', ...)`
- Epoch-ms timestamp handling in field mapper:
  - `chatConversations.createdAt` is stored as `number` (epoch ms) in Dexie
  - Field map: `createdAt → created_at_epoch` (stored as `bigint` in Supabase, not `timestamptz`)
  - `toCamelCase()` restores `created_at_epoch` back to `createdAt` as a number
- `messages` JSONB: serialized as full JSON array; no size limit imposed client-side (but document 10MB practical Postgres limit)
- `learnerModels`: `strengths`, `misconceptions`, `quizStats` stored as JSONB; merge strategy is LWW on the whole document

**Acceptance Criteria:**
- Tutor conversation started on Device A continues on Device B (all messages present)
- Epoch-ms `createdAt` round-trips correctly: `Date.now()` value stored and restored as the same number
- Learner model (vocabularyLevel, strengths map) syncs to Device B
- Large conversation (100+ messages, ~50KB) syncs without truncation
- `courseId` FK preserved after round-trip (links conversation to correct course)
- LWW on learner model: more recently updated model wins

---

## Epic 94: Course & Book Library Sync — "My Library, Any Device"

**Tagline:** Every book, course, and annotation available the moment you sign in.

**Description:** Syncs the user's imported courses, books, reading organization (shelves, reading queue, reviews), file storage (PDFs, EPUBs, thumbnails, covers via Supabase Storage), and chapter alignment data. After this epic, a user's entire library is available on new devices — metadata immediately, files on demand.

**Dependency note:** Requires E92 and E89 (unified courses). E94-S04 (Storage buckets) must complete before E94-S07 (book file upload). All other E94 stories can run after E94-S01 migrations.

**Stories: 7**

---

### E94-S01: P2 Supabase Migrations (courses, videos, PDFs, authors, books)

**Summary:** Create all Postgres tables for P2 library content. Must complete before any other E94 wiring stories.

**Key Deliverables:**
- Tables:
  - `imported_courses` (id, user_id, title, description, provider, provider_url, thumbnail_url, tags[], total_videos, total_duration_seconds, imported_at, created_at, updated_at)
  - `imported_videos` (id, user_id, course_id, title, url, duration_seconds, position, youtube_id, created_at, updated_at)
  - `imported_pdfs` (id, user_id, course_id, title, file_url, total_pages, created_at, updated_at)
  - `authors` (id, user_id, name, bio, website, photo_url, created_at, updated_at)
  - `books` (id, user_id, title, author_id, format ['epub'|'pdf'|'audiobook'|'epub+audiobook'], status ['want-to-read'|'reading'|'completed'|'paused'], progress real, file_url, cover_url, source_type ['file'|'remote'|'opds'|'abs'], source_url, isbn, total_pages, total_duration_seconds, created_at, updated_at)
- `upsert_book_progress(p_user_id, p_book_id, p_progress, p_updated_at)`: uses `GREATEST()` for `progress` field; also updates `status` to `'reading'` if progress > 0 and < 1, `'completed'` if progress = 1
- RLS policies on all tables
- Migration file: `supabase/migrations/20260413000003_p2_library.sql`

**Acceptance Criteria:**
- All 5 tables exist with correct columns
- `upsert_book_progress()` prevents progress regression (0.8 → 0.6 → stays 0.8)
- `upsert_book_progress()` sets status to 'completed' when progress = 1.0
- Books table `format` column supports all 4 values
- RLS blocks cross-user access
- Migration idempotent

---

### E94-S02: Course and Book Metadata Sync with Field Stripping

**Summary:** Sync all course and book metadata, stripping non-serializable browser file handles before upload.

**Key Deliverables:**
- `src/app/stores/useCourseImportStore.ts`: all mutations → `syncableWrite('importedCourses', ...)`, `syncableWrite('importedVideos', ...)`, `syncableWrite('importedPdfs', ...)`
- `src/app/stores/useAuthorStore.ts`: mutations → `syncableWrite('authors', ...)`
- `src/app/stores/useBookStore.ts`:
  - `addBook`, `updateBook`, `updateProgress` → `syncableWrite('books', ...)`
  - `updateProgress` uses monotonic path (calls `upsert_book_progress()` via tableRegistry `conflictStrategy: 'monotonic'`)
- Field stripping per tableRegistry `stripFields`:
  - `importedCourses`: strip `directoryHandle`, `coverImageHandle`
  - `importedVideos`: strip `fileHandle`
  - `importedPdfs`: strip `fileHandle`
  - `authors`: strip `photoHandle`
  - `books`: strip `source` when `source.type === 'fileHandle'`; keep `source` when `source.type === 'remote'`, `'opds'`, or `'abs'`
- Custom strip logic for books' `source` field in `syncableWrite` pre-processing

**Acceptance Criteria:**
- Course imported on Device A appears on Device B (title, description, provider, video count) after sync
- Book metadata (title, author, format, status) syncs
- `FileSystemDirectoryHandle` and `FileSystemFileHandle` objects are NOT present in Supabase rows (would cause serialization error — confirm by checking Supabase row content)
- Book with `source.type = 'remote'` and `source.url = 'https://...'` retains URL after round-trip
- Book with `source.type = 'fileHandle'` has `source` field null/absent in Supabase row
- Book progress uses monotonic upsert (progress 0.8 → not overwritten by 0.6 from server)

---

### E94-S03: Book Reviews, Shelves, and Reading Queue Sync

**Summary:** Sync the user's book organization: star ratings, custom shelves, shelf memberships, and reading queue with order.

**Key Deliverables:**
- Supabase migrations (`supabase/migrations/20260413000004_p2_book_organization.sql`):
  - `book_reviews` (id, user_id, book_id, rating int [1-5], review_text, created_at, updated_at)
  - `shelves` (id, user_id, name, is_default bool, created_at, updated_at)
  - `book_shelves` (id, user_id, book_id, shelf_id, added_at, updated_at) — UNIQUE constraint on `(book_id, shelf_id, user_id)`
  - `reading_queue` (id, user_id, book_id, position int, added_at, updated_at) — UNIQUE constraint on `(user_id, position)`
- Wire stores:
  - `useBookReviewStore`: `addReview`, `updateReview` → `syncableWrite('bookReviews', ...)`
  - `useShelfStore`: `createShelf`, `updateShelf`, `deleteShelf` → `syncableWrite('shelves', ...)`; `addBookToShelf`, `removeBookFromShelf` → `syncableWrite('bookShelves', ...)`
  - `useReadingQueueStore`: `addToQueue`, `reorderQueue`, `removeFromQueue` → `syncableWrite('readingQueue', ...)`
- Default shelf dedup logic in download apply phase: before inserting a downloaded shelf, check if a shelf with `is_default: true` and the same name already exists; if so, skip insert (do not duplicate "Favorites", "Currently Reading", "Want to Read")

**Acceptance Criteria:**
- 5-star rating on Device A appears on Device B after sync
- Custom shelf "Spanish Learning" created on Device A appears on Device B
- Book added to "Favorites" shelf on Device A is shelved on Device B
- Reading queue: 3 books in order [A, B, C] on Device A appears as [A, B, C] on Device B (position preserved)
- Default shelves not duplicated: signing into a new device does not create a second "Favorites" shelf
- `UNIQUE` constraint on `book_shelves` prevents duplicate shelf entries for same book+shelf

---

### E94-S04: Supabase Storage Bucket Setup and File Upload

**Summary:** Create all 6 Storage buckets with user-scoped RLS and implement the file upload pipeline that stores binary blobs in Storage and saves the resulting URL in the Postgres row.

**Key Deliverables:**
- Storage buckets (created via Supabase dashboard / migration):
  | Bucket | Max File Size | Purpose |
  |--------|---------------|---------|
  | `course-thumbnails` | 500 KB | Course cover images |
  | `screenshots` | 2 MB | Course/video screenshots |
  | `avatars` | 1 MB | User profile photos |
  | `pdfs` | 100 MB | Imported PDF course materials |
  | `book-files` | 200 MB | EPUB, PDF books |
  | `book-covers` | 2 MB | Book cover images |
- RLS on all buckets: `storage.foldername(name)[1] = auth.uid()::text` (path format: `{userId}/{recordId}/{filename}`)
- `src/lib/sync/storageUpload.ts`:
  - `uploadBlob(bucket, path, blob): Promise<string>` — uploads and returns public URL
  - Called after Dexie write, before Supabase upsert
  - On success: updates Postgres row's `*_url` column with Storage URL
- Upload triggered for: course thumbnails, author photos, PDF files, book cover images (not book files — those are E94-S07)
- Existing blob data in Dexie (base64 or ArrayBuffer): converted to `Blob` for upload

**Acceptance Criteria:**
- All 6 buckets exist in Supabase Storage dashboard
- Cross-user access blocked: User A cannot read User B's files (RLS verified)
- Course thumbnail blob → uploaded to `course-thumbnails/{userId}/{courseId}/thumbnail.jpg` → URL stored in `imported_courses.thumbnail_url`
- Author photo → uploaded to `avatars/{userId}/{authorId}/photo.jpg` → URL stored in `authors.photo_url`
- PDF file → uploaded to `pdfs/{userId}/{pdfId}/file.pdf` → URL stored in `imported_pdfs.file_url`
- Book cover → uploaded to `book-covers/{userId}/{bookId}/cover.jpg` → URL stored in `books.cover_url`
- File size limits enforced (501KB thumbnail upload rejected)

---

### E94-S05: File Download on New Device

**Summary:** Restore the user's files on a new device — small files automatically, large book files on demand.

**Key Deliverables:**
- Download phase enhancement: after metadata download, auto-download small files:
  - Course thumbnails: fetch from `thumbnail_url`, store in Dexie/IndexedDB blob cache
  - Author photos: fetch and cache
  - Book covers: fetch and cache
  - PDF course materials: fetch and store in Dexie (warn if >10MB, still auto-download)
  - Screenshots: fetch and cache
- Book files (EPUB/PDF/audiobook): **on-demand only**
  - Show "Download" button on book cards when `file_url` is set but local file is absent
  - On tap: background download via `fetch()`, store in OPFS or Dexie `bookFiles` table
  - Progress indicator (percentage) during download
  - Cancel button during download
- Priority: P0 metadata first, then small files while user browses

**Acceptance Criteria:**
- On new device after sign-in: course thumbnails visible within one sync cycle (no manual action)
- Book metadata (title, author, format, status) visible before file downloaded
- "Download" button visible on book cards where file_url is set but file not local
- Tapping "Download" shows progress bar and downloads file to local storage
- Downloaded book opens correctly in reader/player
- Auto-download skipped if device is on a metered connection (check `navigator.connection.saveData`)

---

### E94-S06: Chapter Mappings Sync

**Summary:** Sync EPUB↔audiobook chapter alignment data used for synchronized reading+listening mode.

**Key Deliverables:**
- Supabase migration (`supabase/migrations/20260413000005_chapter_mappings.sql`):
  - `chapter_mappings` (epub_book_id uuid, audio_book_id uuid, user_id uuid, mappings jsonb, created_at, updated_at)
  - PRIMARY KEY `(epub_book_id, audio_book_id, user_id)`
  - RLS: `auth.uid() = user_id`
- tableRegistry entry for `chapterMappings`:
  - `compoundPkFields: ['epubBookId', 'audioBookId']`
  - `conflictStrategy: 'lww'`
  - `fieldMap`: `epubBookId → epub_book_id`, `audioBookId → audio_book_id`, `mappings → mappings` (JSONB array)
- `src/app/stores/useChapterMappingStore.ts` (wherever it lives): `saveMapping`, `updateMapping` → `syncableWrite('chapterMappings', ...)`
- Compound PK handling in `syncableWrite`: `recordId` constructed as `{epubBookId}:{audioBookId}` for queue entry

**Acceptance Criteria:**
- Chapter mapping created on Device A appears on Device B after sync
- Manual override mappings (`confidence: 1.0`) preserved through round-trip
- Compound PK: two different book pairs store as separate records (not merged)
- `mappings` JSONB array (array of `{ epubChapterId, audioStartSeconds, confidence }`) round-trips without data loss
- Existing auto-generated mappings (confidence < 1.0) and manual overrides (confidence = 1.0) both sync correctly

---

### E94-S07: Book Files Storage Integration

**Summary:** Upload and download EPUB/PDF book files via the `book-files` Storage bucket, with resumable upload for large files and per-user quota tracking.

**Key Deliverables:**
- Upload flow:
  - Triggered when a new book with a local file is synced
  - File path: `book-files/{userId}/{bookId}/{filename}`
  - Files < 10MB: standard `storageUpload()` from E94-S04
  - Files ≥ 10MB: TUS resumable upload via Supabase Storage resumable API
  - Upload status tracked in `syncMetadata` per book: `{ bookId, uploadStatus: 'pending'|'uploading'|'complete'|'failed', bytesUploaded, totalBytes }`
  - On success: `books.file_url` updated with Storage URL
- Download flow (extends E94-S05 on-demand download):
  - Fetch from `books.file_url` (Storage URL)
  - Store in OPFS (for EPUB/PDF) or Dexie `bookFiles` table (for audiobook chunks)
- Storage quota:
  - `GET /storage/v1/bucket/{bucket}` to check used bytes
  - Warning toast when user's `book-files` usage > 80% of allocated limit
  - Quota warning only shown once per session

**Acceptance Criteria:**
- EPUB file (3MB) uploads successfully and `books.file_url` updated in Supabase
- Large EPUB (150MB) upload resumes after simulated interruption (page refresh mid-upload)
- Downloaded EPUB opens correctly in reader on new device (valid EPUB format)
- `uploadStatus: 'complete'` set after successful upload
- Storage usage warning toast appears when usage > 80%
- Upload progress visible in Sync Settings panel (E97-S02) while uploading

---

## Epic 95: Settings & Security Sync — "My Preferences, Protected"

**Tagline:** Your preferences and credentials stay secure while following you everywhere.

**Description:** Syncs all user preferences (reader, audiobook, reading goals, engagement), stores sensitive credentials in Supabase Vault (never in Postgres rows), makes entitlements server-authoritative, calculates streaks server-side, and syncs external server configurations (OPDS, ABS) and notification preferences.

**Dependency note:** Requires E92. E95-S02 (Vault) is a prerequisite for E97-S05 (credential UX). E95-S05 (server connection sync) also depends on E95-S02.

**Stories: 6**

---

### E95-S01: Full Settings Sync Expansion

**Summary:** Expand the `user_settings` JSONB column to cover all user preferences from three localStorage-backed stores, and hydrate them correctly on new devices.

**Key Deliverables:**
- Existing `user_settings` table (from E19): expand the JSONB `settings` column to include new preference groups
- New preference groups added to `user_settings.settings`:
  ```jsonc
  {
    // Reader preferences (from useReaderStore localStorage migration)
    "readingTheme": "sepia",
    "readingFontSize": 18,
    "readingLineHeight": 1.6,
    "readingRuler": false,
    "scrollMode": "paginated",
    // Audiobook preferences (from useAudiobookPrefsStore localStorage migration)
    "defaultSpeed": 1.5,
    "skipSilence": true,
    "defaultSleepTimer": 30,
    "autoBookmarkOnStop": true,
    // Reading goals (from useReadingGoalStore localStorage migration)
    "dailyType": "pages",
    "dailyTarget": 20,
    "yearlyBookTarget": 24,
    "currentReadingStreak": 0,
    "longestReadingStreak": 0,
    // Engagement preferences
    "achievementsEnabled": true,
    "streaksEnabled": true,
    "colorScheme": "professional"
  }
  ```
- `src/app/stores/useReaderStore.ts`: preferences persisted via `syncableWrite('userSettings', ...)` instead of localStorage
- `src/app/stores/useAudiobookPrefsStore.ts`: same migration
- `src/app/stores/useReadingGoalStore.ts`: same migration (except streak fields — those are server-calculated in E95-S04)
- `hydrateSettingsFromSupabase()`: expanded to restore all new fields on sign-in

**Acceptance Criteria:**
- Setting reading theme to "sepia" on Device A: Device B shows "sepia" after sync
- Audiobook default speed 1.5x on Device A: Device B defaults to 1.5x after sync
- Reading goal (daily target 20 pages) syncs to Device B
- `colorScheme` preference (professional/vibrant/clean) syncs and applies on next app load
- All three localStorage stores no longer write to `localStorage` for preference data (confirmed by checking localStorage keys absent after refactor)
- New device: all preferences restored without requiring manual re-configuration

---

### E95-S02: API Keys and All Credentials via Supabase Vault

**Summary:** Extend Supabase Vault coverage to all three credential types. The browser never stores raw credentials after they're vaulted.

**Key Deliverables:**
- Edge Function `supabase/functions/vault-credentials/index.ts` with routes:
  - `POST /vault/store-credential` — body: `{ credentialType: 'ai-provider'|'opds-catalog'|'abs-server', credentialId: string, secret: string }` → stores in `vault.secrets` with key `{userId}:{credentialType}:{credentialId}`; returns `{ configured: true }`
  - `GET /vault/check-credential?credentialType=...&credentialId=...` → returns `{ configured: boolean }` (never returns the secret)
  - `GET /vault/read-credential?credentialType=...&credentialId=...` → returns `{ secret: string }` (for client reads when needed, e.g. making API calls)
  - `DELETE /vault/delete-credential?credentialType=...&credentialId=...` → deletes from vault
- Vault cleanup on record delete:
  - When `syncableWrite('opdsCatalogs', 'delete', catalogId)` is called: also call `DELETE /vault/delete-credential` for that catalog's auth
  - When `syncableWrite('audiobookshelfServers', 'delete', serverId)` is called: same
- Browser stores only `credentialConfigured: true|false` per credential in Dexie/Zustand (never the raw key)
- Migrate existing AI provider key storage to use this unified Edge Function

**Acceptance Criteria:**
- AI provider API key stored and retrievable via Vault (existing functionality preserved)
- OPDS catalog password stored in Vault; `opdsCatalogs` Supabase row has no `password` column
- ABS server API key stored in Vault; `audiobookshelf_servers` Supabase row has no `api_key` column
- `check-credential` returns `{ configured: true }` after storage, `{ configured: false }` if not stored
- Deleting an OPDS catalog also deletes its Vault secret (verify via `check-credential` returning false)
- Raw credential never present in Postgres rows, queue payload, or browser localStorage (confirmed by inspection)

---

### E95-S03: Server-Authoritative Entitlements

**Summary:** Entitlements are managed server-side and read-only on the client. Stripe webhook updates them; the client reads the current tier on sync.

**Key Deliverables:**
- `entitlements` table RLS: SELECT allowed (auth.uid() = user_id), INSERT/UPDATE/DELETE blocked from client
- Add columns to `entitlements`: `trial_end timestamptz`, `had_trial boolean default false`
- Stripe webhook Edge Function (`supabase/functions/stripe-webhook/index.ts`):
  - `checkout.session.completed`: upsert entitlements with new tier and trial_end (if trial)
  - `customer.subscription.updated`: update tier
  - `customer.subscription.deleted`: downgrade to 'free'
- Client: reads `entitlements` row on sync download; updates local Zustand `useEntitlementsStore`
- `useEntitlementsStore` becomes read-only (no local mutations)

**Acceptance Criteria:**
- Client `INSERT` to `entitlements` returns 403 (RLS blocks it)
- Client `UPDATE` to `entitlements` returns 403
- Stripe `checkout.session.completed` webhook correctly sets `tier = 'pro'` and `trial_end`
- `had_trial` set to `true` after first trial activation (idempotent)
- Tier change from Stripe webhook reflected on client within one sync cycle (< 30 seconds when app is open)
- Free tier correctly applied after subscription cancellation

---

### E95-S04: Server-Side Streak Calculation

**Summary:** Calculate study and reading streaks using server-side Postgres functions that aggregate synced data, with graceful offline fallback.

**Key Deliverables:**
- `calculate_study_streak(p_user_id uuid) RETURNS int` Postgres function:
  - Counts consecutive days (in user's local timezone — pass as parameter or use `now()`) where total session duration ≥ 60 seconds in `study_sessions`
  - Returns current streak (days including today if applicable)
- `calculate_reading_streak(p_user_id uuid) RETURNS int` Postgres function:
  - Counts consecutive days where reading progress meets daily target from `user_settings.settings.dailyTarget` and `dailyType`
  - Based on delta of `books.progress` between days (approximated from `updated_at` timestamps)
- Client calls both functions via Supabase RPC during sync download phase
- Updates `useReadingGoalStore.currentReadingStreak` and `useSessionStore.currentStudyStreak` (or wherever streaks are displayed)
- Offline fallback: if RPC fails (offline), show locally-calculated streak with "(offline)" suffix in UI

**Acceptance Criteria:**
- Study streak matches locally-calculated value within 1 day tolerance (timezone handling)
- Reading streak correctly counts days where reading target was met (based on synced data)
- Offline indicator shown when streak is locally calculated (not from server)
- Server streak updates within one sync cycle after study session uploaded
- `calculate_study_streak()` returns 0 if no sessions in last 2 days (streak broken)

---

### E95-S05: OPDS and ABS Server Connection Sync

**Summary:** Sync external server URLs, names, and configuration — but never credentials (those are in Vault from E95-S02).

**Key Deliverables:**
- Supabase migrations (`supabase/migrations/20260413000006_external_servers.sql`):
  - `opds_catalogs` (id, user_id, name, url, auth_type ['none'|'basic'|'digest'], last_synced, created_at, updated_at) — NO `username` or `password` columns
  - `audiobookshelf_servers` (id, user_id, name, url, library_ids jsonb, status ['connected'|'error'|'unchecked'], last_synced_at, created_at, updated_at) — NO `api_key` column
- Wire stores:
  - `src/app/stores/useOpdsCatalogStore.ts`: `addCatalog`, `updateCatalog`, `deleteCatalog` → `syncableWrite('opdsCatalogs', ...)`; Vault interaction (E95-S02) called separately for credential fields
  - `src/app/stores/useAudiobookshelfStore.ts`: `addServer`, `updateServer`, `deleteServer` → `syncableWrite('audiobookshelfServers', ...)`
- `auth_type` syncs so Device B knows what type of auth to prompt for (without knowing the actual credentials)

**Acceptance Criteria:**
- OPDS catalog URL and name added on Device A appears in catalog list on Device B
- ABS server URL and status ('connected') syncs to Device B
- No credential fields (`password`, `apiKey`) present in Supabase rows (confirmed by row inspection)
- Deleting a catalog on Device A: soft-deleted or hard-deleted record syncs, catalog disappears from Device B
- `libraryIds` JSONB array (list of selected ABS library IDs) preserves order after round-trip
- `auth_type` field syncs correctly ('basic', 'digest', or 'none')

---

### E95-S06: Notification Preferences Sync

**Summary:** Sync per-type notification toggle settings and quiet hours configuration across devices.

**Key Deliverables:**
- Supabase migration (`supabase/migrations/20260413000007_notification_preferences.sql`):
  - `notification_preferences` (id, user_id, preferences jsonb, created_at, updated_at)
  - Singleton per user (UNIQUE on user_id); upsert on conflict
  - `preferences` JSONB schema:
    ```jsonc
    {
      "types": {
        "studyReminder": true,
        "achievement": true,
        "streakAlert": true,
        "courseUpdate": true,
        "bookImported": true,
        "bookDeleted": true,
        "highlightReview": true
      },
      "quietHours": {
        "enabled": false,
        "startTime": "22:00",
        "endTime": "08:00"
      }
    }
    ```
- `src/app/stores/useNotificationPrefsStore.ts`: `updatePreference`, `updateQuietHours` → `syncableWrite('notificationPreferences', ...)`
- LWW on whole document (not per-type — last write wins for the entire preferences object)

**Acceptance Criteria:**
- Disabling "streakAlert" on Device A: Device B no longer shows streak alerts after sync
- Quiet hours (22:00–08:00) configured on Device A: same hours applied on Device B
- New notification types (`bookImported`, `bookDeleted`, `highlightReview`) included in JSONB and sync correctly
- Default preferences applied on first creation (all types enabled, quiet hours disabled)
- Singleton constraint: only one `notification_preferences` row per user (upsert works correctly)

---

## Epic 96: Remaining Tables & Features Sync — "The Last Mile"

**Tagline:** Every feature fully synced — nothing left behind.

**Description:** Syncs all remaining P3-P4 tables: learning paths, challenges, quizzes, study schedules, AI usage logs, career paths, and course reminders. Also resolves the YouTube chapters sync question via a spike story. After this epic, all 30+ syncable tables are wired.

**Dependency note:** Requires E92. Can run in parallel with E93-E95. E96-S01 (migrations) must complete before E96-S02 (wiring).

**Stories: 4**

---

### E96-S01: P3-P4 Supabase Migrations

**Summary:** Create all remaining Postgres tables for P3-P4 features. Must complete before E96-S02 wiring.

**Key Deliverables:**
- P3 tables (`supabase/migrations/20260413000008_p3_features.sql`):
  - `learning_paths` (id, user_id, title, description, tags[], created_at, updated_at)
  - `learning_path_entries` (id, user_id, path_id, content_id, content_type, position, completed, created_at, updated_at)
  - `challenges` (id, user_id, title, type ['videos'|'pages'|'books'|'time'], target_type, target_count int, progress real, start_date, end_date, created_at, updated_at)
  - `course_reminders` (id, user_id, course_id, schedule_type ['daily'|'weekly'], days_of_week int[], time_of_day time, enabled, created_at, updated_at)
  - `notifications` (id, user_id, type, title, body, read bool, dismissed bool, data jsonb, created_at, updated_at)
  - `career_paths` (id, user_id, title, target_role, skills_required jsonb, created_at, updated_at)
  - `path_enrollments` (id, user_id, path_id, enrolled_at, completed_at, progress real, updated_at)
  - `study_schedules` (id, user_id, title, time_zone, blocks jsonb, created_at, updated_at)
- P4 tables:
  - `quizzes` (id, user_id, content_id, content_type, questions jsonb, created_at, updated_at)
  - `quiz_attempts` (id, user_id, quiz_id, answers jsonb, score real, completed_at, created_at) — INSERT + SELECT only
  - `ai_usage_events` (id, user_id, provider, model, tokens_used int, cost_usd real, event_type, created_at) — INSERT + SELECT only (append log)
- RLS on all tables
- INSERT+SELECT only policy on `quiz_attempts` and `ai_usage_events`
- `challenges.progress` is monotonic (use `GREATEST()`)

**Acceptance Criteria:**
- All P3+P4 tables exist with correct columns
- `quiz_attempts` UPDATE returns 403; DELETE returns 403; INSERT succeeds
- `ai_usage_events` UPDATE returns 403; INSERT succeeds
- `challenges` table supports `type = 'books'` (target: number of books) and `type = 'pages'` (target: pages read)
- `study_schedules` has `time_zone` column (IANA timezone string)
- Migration idempotent

---

### E96-S02: Wire P3-P4 Stores with syncableWrite

**Summary:** All remaining stores call `syncableWrite()` for mutations. After this story, every P3-P4 feature is sync-enabled.

**Key Deliverables:**
- `src/app/stores/useLearningPathStore.ts`: `createPath`, `updatePath`, `deletePath` → `syncableWrite('learningPaths', ...)`
- Learning path entries: `addEntry`, `updateEntry`, `removeEntry`, `reorderEntries` → `syncableWrite('learningPathEntries', ...)`
- `src/app/stores/useChallengeStore.ts`:
  - `createChallenge`, `updateChallenge` → `syncableWrite('challenges', ...)`
  - `updateProgress` uses monotonic path (never decrements)
- `src/app/stores/useStudyScheduleStore.ts`: `saveSchedule`, `updateSchedule`, `deleteSchedule` → `syncableWrite('studySchedules', ...)`
- Course reminder writes: → `syncableWrite('courseReminders', ...)`
- Career path + enrollment writes: → `syncableWrite('careerPaths', ...)` and `syncableWrite('pathEnrollments', ...)`

**Acceptance Criteria:**
- Learning path created on Device A appears on Device B after sync
- Challenge progress is monotonic: 60% → 55% from server → stays 60% locally
- Study schedule with IANA timezone (e.g., "Europe/Lisbon") syncs with timezone preserved
- Career path enrollment with `progress: 0.4` syncs to Device B
- `blocks` JSONB array in study schedule preserves order and structure
- No direct Dexie calls remain in wired stores (outside sync layer)

---

### E96-S03: AI Usage Events, Course Reminders, and Notifications Sync

**Summary:** Sync append-only usage logs, course reminders, and notification state (including new book-related notification types).

**Key Deliverables:**
- AI usage events:
  - `src/lib/ai/trackUsage.ts` (or wherever AI calls are logged): append via `syncableWrite('aiUsageEvents', 'add', ...)`
  - INSERT-only: each event is a permanent audit log entry
  - Fields: `provider`, `model`, `tokensUsed`, `costUsd`, `eventType`
- Course reminders: existing reminder writes → `syncableWrite('courseReminders', ...)`; LWW
- Notifications:
  - `src/app/stores/useNotificationStore.ts`: `addNotification`, `markRead`, `markDismissed` → `syncableWrite('notifications', ...)`
  - New notification types included: `book-imported`, `book-deleted`, `highlight-review`
  - `read: true` state syncs: notification read on Device A → also shown as read on Device B
  - `dismissed: true` state syncs: dismissed on Device A → dismissed on Device B

**Acceptance Criteria:**
- AI usage event (provider: 'openai', model: 'gpt-4o', tokensUsed: 1500) uploaded as INSERT-only (no updates)
- Course reminder schedule syncs to Device B
- Notification dismissed on Device A: shows as dismissed on Device B after sync
- `book-imported` notification type syncs correctly (type field preserved)
- AI usage log is append-only: no mechanism to update or delete events from client

---

### E96-S04: youtubeChapters Sync Evaluation (Spike)

**Summary:** Investigate whether YouTube chapter data needs sync or can be safely re-fetched from the YouTube API on each device. Implement the outcome of the investigation.

**Key Deliverables:**
- Investigation questions:
  1. Is `youtubeChapters` data purely fetched from YouTube API and cached locally with no user customization?
  2. Can users reorder, rename, or add custom chapters? If so, those need sync.
  3. Is the YouTube API reliably available (i.e., re-fetching is deterministic)?
- **Outcome A (skip sync):** If chapters are purely cached API data with no user customization:
  - Document decision: add `skipSync: true` to `youtubeChapters` entry in tableRegistry
  - Add comment explaining why (re-fetchable from YouTube API)
  - Update design doc skip list
- **Outcome B (sync needed):** If chapters are user-customizable:
  - Create Supabase migration for `youtube_chapters` table (LWW)
  - Wire store with `syncableWrite()`

**Acceptance Criteria:**
- Decision documented with rationale in tableRegistry comment
- tableRegistry `youtubeChapters` entry has either `skipSync: true` or a full sync configuration
- If skip: confirmed that re-fetching chapter data from YouTube API produces equivalent result to cached data
- If sync: migrations created, store wired, AC verified (chapter data appears on Device B)
- Design doc updated with outcome

---

## Epic 97: Sync UX Polish — "It Just Works"

**Tagline:** Sync that's invisible when it works, and clear when it needs attention.

**Description:** Adds all the UI that makes sync feel seamless: a header status indicator, a detailed settings panel, an initial upload wizard for first sign-in, a prioritized restoration experience on new devices, and credential verification flow for external services.

**Dependency note:** Requires E92 (foundation). Benefits from E93-E96 completing first for accurate status data. E97-S05 (credential UX) requires E95-S02 (Vault) and E95-S05 (server sync).

**Stories: 5**

---

### E97-S01: Sync Status Indicator in Header

**Summary:** A persistent, accessible sync status indicator in the app header with four visual states.

**Key Deliverables:**
- `src/app/components/sync/SyncStatusIndicator.tsx`:
  - 4 states driven by `useSyncStatusStore`:
    | State | Icon | Color | Label (sr-only) |
    |-------|------|-------|----------------|
    | `synced` | `CloudCheck` (Lucide) | `text-success` | "All changes synced" |
    | `syncing` | `Cloud` + animated spinner overlay | `text-brand` | "Syncing {n} changes…" |
    | `offline` | `CloudOff` | `text-muted-foreground` | "Offline — changes saved locally" |
    | `error` | `Cloud` + `AlertCircle` badge | `text-destructive` | "Sync error — tap for details" |
  - Shows pending count badge when `syncing` and `pendingCount > 0`
  - Clicking indicator: opens Sync Settings panel (Sheet component, slides in from right)
- Placed in `Layout.tsx` header bar, adjacent to existing notification bell
- `aria-label` dynamically reflects current state (screen reader reads the state on change via `aria-live="polite"`)

**Acceptance Criteria:**
- Indicator shows `synced` state when queue is empty and last sync succeeded
- Indicator shows `syncing` with count badge when queue has pending items
- Indicator shows `offline` when `navigator.onLine === false`
- Indicator shows `error` when dead-letter queue has entries
- Clicking indicator opens Sync Settings panel (E97-S02)
- Screen reader announces state changes via `aria-live` region
- Indicator visible on all pages (lives in shared Layout)

---

### E97-S02: Sync Settings Panel

**Summary:** A detailed sync status and control panel accessible from the header indicator and the Settings page.

**Key Deliverables:**
- `src/app/components/sync/SyncSettingsPanel.tsx` (Sheet component):
  - **Last sync time:** "Last synced 2 minutes ago" (relative time, updates live)
  - **Pending queue count:** "3 changes pending upload"
  - **Per-category status** with last-sync time per category:
    - Courses & Videos
    - Books & Reading
    - Learning Content (notes, flashcards, highlights)
    - Settings & Preferences
  - **Vault credential status** (one row per configured external service):
    - AI provider: configured / not configured
    - Each OPDS catalog: "Catalog Name — credentials configured"
    - Each ABS server: "Server Name — credentials configured"
  - **Dead-letter entries** (if any): table with columns [Table, Record ID, Error, Attempts]; per-row "Retry" and "Dismiss" buttons
  - **Storage bucket usage:** per-bucket breakdown in human-readable format (e.g., "book-files: 2.4 GB of 10 GB")
  - **Manual sync button:** "Sync Now" — triggers `syncEngine.fullSync()` and disables for 5 seconds after tap
- Also accessible from Settings page (`/settings`) as a section

**Acceptance Criteria:**
- All 4 per-category status rows show accurate last-sync timestamps
- Vault status accurately reflects E95-S02 `check-credential` results
- Dead-letter entries visible with error message; "Retry" re-queues and removes from dead-letter list; "Dismiss" removes without re-queuing
- Storage usage displayed as "X.X GB of Y GB" per bucket
- "Sync Now" button triggers immediate full sync cycle
- Panel accessible via keyboard (focus trap when open, Esc to close)

---

### E97-S03: Initial Upload Wizard

**Summary:** A guided first-sync experience that walks the user through uploading their local data to Supabase after signing in for the first time.

**Key Deliverables:**
- `src/app/components/sync/InitialUploadWizard.tsx` — 4-step modal wizard:
  1. **"What we found"** — inventory by category:
     - Progress & Sessions: {n} records
     - Notes & Flashcards: {n} records
     - Books & Reading: {n} records
     - Course Library: {n} records
     - Settings: configured
     - "Upload everything" CTA button
  2. **"Uploading your data"** — per-category progress bars with counts:
     - Each category shows: `█████░░░░░ 23 / 47` style progress
     - Categories upload in priority order (P0 first)
  3. **"Uploading your book files"** — separate step for large files:
     - Per-file progress: `Book Title.epub  ████░░░░  45%  1.2 MB / 2.7 MB`
     - "Skip for now" link (files can be uploaded later; already uploaded metadata is used on new device)
  4. **"You're all synced!"** — completion screen with summary stats
- Resumable: `syncMetadata.lastUploadedKey` tracks last successfully uploaded record per table; wizard resumes from that point on re-open
- Shown when: user signs in and `userId = null` records exist (same trigger as E92-S08 "Link my data")
- Not shown again after completion (completion state stored in `syncMetadata`)

**Acceptance Criteria:**
- Wizard appears on first sign-in with existing local data
- Step 1 shows accurate counts per category (matches actual Dexie record counts)
- Step 2 progress bars advance in real time as categories upload
- Step 3 shows per-book file progress; "Skip for now" dismisses step 3 without failing wizard
- Step 4 shown only after all non-skipped uploads complete
- Wizard does not appear on subsequent sign-ins after completion
- If interrupted and re-opened: resumes from where it left off (no re-upload of already-uploaded records)

---

### E97-S04: New Device Download Experience

**Summary:** Fast, prioritized data restoration on a new device with clear visual feedback.

**Key Deliverables:**
- Download phase orchestration in `syncEngine.ts`: enforce P0→P1→P2→P3 download order (priority from tableRegistry)
- `src/app/components/sync/RestoringLibraryOverlay.tsx`:
  - Full-page overlay shown during initial download
  - Progress phases: "Restoring your progress…" → "Downloading your books…" → "Fetching your notes…" → "Almost there…"
  - Phase transitions based on which priority tier is currently downloading
  - Dismiss button available after P0 completes (user can use app with partial data)
- Book cards in library: show "Download" button (CloudDownload icon) when `file_url` set but no local file
- P0 target: contentProgress, studySessions, videoProgress, userSettings available within 3 seconds on a good connection (≤ 100ms Supabase latency)
- Progressive UI: app is usable after P0 download completes; overlay dismissible; P1-P3 downloads in background

**Acceptance Criteria:**
- P0 data (progress, sessions, settings) available within 3 seconds of sign-in on good connection (≥ 10 Mbps, ≤ 100ms RTT)
- Book metadata visible before file downloaded (library shows books without waiting for EPUB)
- "Download" button visible on book cards for on-demand file fetch
- Tapping "Download" on a book card initiates background download with progress in Sync Settings panel
- Overlay dismissible after P0 completes; background sync continues
- "Restoring your library…" overlay not shown on subsequent sign-ins (only initial restoration)

---

### E97-S05: Credential Sync UX for External Services

**Summary:** Guide users through verifying external service connections on a new device after credentials have been synced from Vault.

**Key Deliverables:**
- `src/app/components/sync/CredentialVerificationScreen.tsx`:
  - Shown after new-device download completes, when Vault credentials exist for any external service
  - One card per external service with stored Vault credentials:
    ```
    ┌─────────────────────────────────────────┐
    │  📚  My Home OPDS Catalog               │
    │  opds.example.com                        │
    │  [Verify Connection]  [Skip for now]     │
    └─────────────────────────────────────────┘
    ```
  - States after tapping "Verify Connection":
    - **Testing…** (spinner)
    - **Connected** ✓ (green) — auto-dismisses card after 2s
    - **Auth failed** (orange) — "Credentials may have changed. [Re-enter credentials]" → links to Settings > Connections
    - **Server unreachable** (gray) — "Check server address or network. [View settings]"
  - "Skip for now" per service (hides card; service not verified but remains configured)
  - "Skip all" button at bottom
- Triggered by: new device flag in `syncMetadata` (set on first download of server configs) + Vault credentials exist
- Not shown if no external services configured

**Acceptance Criteria:**
- Screen shown only when external service configs were downloaded from Vault AND this is a new device (first download)
- "Verify Connection" button fires Vault `read-credential` + service connection test
- Connected state: green check appears, card auto-dismisses after 2s
- Auth failed state: orange warning, "Re-enter credentials" links to correct Settings page
- Server unreachable: gray state with helpful message
- "Skip for now" hides individual card; service remains in configured-but-unverified state
- Screen not shown if no external services are configured
- Screen not shown again on next sign-in for already-verified services

---

## Notes

- E93-E96 can run in parallel after E92 completes
- E97 can start after E92 but benefits from E93-E96 completing first for accurate status data in all panels
- Within E93-E96, the S01 migration story must complete before any wiring stories in the same epic begin
- The table registry (E92-S03) is a prerequisite for all wiring stories (any story that calls `syncableWrite` on a new table)
- Book file upload (E94-S07) depends on Storage bucket setup (E94-S04)
- Credential UX (E97-S05) depends on Vault implementation (E95-S02) and server connection sync (E95-S05)
- Dead-letter entries surface in E97-S02 (Sync Settings Panel); the dead-letter mechanism itself is implemented in E92-S05
- The `useSyncStatusStore` Zustand store (introduced in E92-S07) is consumed by E97-S01 and E97-S02
- Storage quota warning (E94-S07) shown in both the Sync Settings Panel (E97-S02) and as a toast
