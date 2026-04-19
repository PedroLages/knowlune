# CE Requirements: Course & Book Metadata Sync with Field Stripping (E94-S02)

**Date:** 2026-04-19
**Story:** E94-S02
**Epic:** E94 — Course & Book Library Sync ("My Library on Any Device")

---

## Problem Statement

The P2 library stores (`useCourseImportStore`, `useAuthorStore`, `useBookStore`) currently write directly to Dexie (`db.importedCourses.*`, `db.authors.*`, `db.books.*`). This bypasses the E92 sync engine, meaning course imports, author metadata, and book records are never enqueued for upload to Supabase. Users who import content on one device will not see that content on other devices.

Additionally, several P2 tables hold non-serializable browser API handles (`FileSystemDirectoryHandle`, `FileSystemFileHandle`, `FileSystemFileHandle` for photo) and the `books.source` union type (`ContentSource`) which includes a `fileHandle` variant that cannot be stored in Postgres. These fields must be stripped before any upload reaches Supabase.

The table registry (`src/lib/sync/tableRegistry.ts`) already declares all five P2 tables with correct `stripFields` entries (added as part of E92-S03 scaffolding). E94-S02 wires the store writes through `syncableWrite` so those registry entries take effect.

---

## User Value / Goal

A learner who imports a course, adds an author profile, or adds a book on one device should see that content automatically appear on all their other devices. This requires routing all store mutations through the sync engine so they are persisted locally and enqueued for Supabase upload.

---

## Context / Existing Infrastructure

- **Table registry** (`src/lib/sync/tableRegistry.ts`) — P2 entries already exist with:
  - `importedCourses`: `stripFields: ['directoryHandle', 'coverImageHandle']`
  - `importedVideos`: `stripFields: ['fileHandle']`
  - `importedPdfs`: `stripFields: ['fileHandle']`
  - `authors`: `stripFields: ['photoHandle']`
  - `books`: `conflictStrategy: 'monotonic'`, `monotonicFields: ['progress']` — no stripFields yet; needs `source` decomposition

- **`syncableWrite`** (`src/lib/sync/syncableWrite.ts`) — already used by E93 stores (notes, bookmarks, highlights, vocabulary, audio clips, flashcards, sessions). Handles: Dexie write, syncQueue enqueue, auth guard, `updatedAt` stamp.

- **`useSyncLifecycle`** (`src/app/hooks/useSyncLifecycle.ts`) — registers `registerStoreRefresh` callbacks so fullSync can reload store state after download.

- **`books.source`** field — The Dexie `Book` type has a `source: ContentSource` field where `ContentSource` is a discriminated union including `{ type: 'local', fileHandle: FileSystemFileHandle }`. This JSONB-incompatible variant must be decomposed into `source_type: string` + `source_url: string | null` before upload. The `fieldMap` in the registry needs entries for this decomposition, OR the `syncableWrite` pre-processor strips and re-maps it.

- **`books.progress`** — 0–100 percentage (not 0–1). The monotonic merge on Supabase is via `upsert_book_progress()` RPC (E94-S01 AC2). The sync engine upload path needs to call this RPC instead of a plain upsert for book progress updates.

- **`importedCourses.status`** — uses hyphenated enum values (`'not-started'`, `'active'`, etc.) matching Supabase CHECK constraint. No fieldMap entry needed.

---

## Acceptance Criteria

**AC1 — `useCourseImportStore` writes use `syncableWrite` for importedCourses:**
- `addCourse`: `syncableWrite('importedCourses', 'add', course)` — `directoryHandle` and `coverImageHandle` are stripped by registry
- `deleteCourse`: `syncableWrite('importedCourses', 'delete', courseId)` — also deletes child videos/pdfs (see AC3)
- `updateCourseTags`: fetch-then-put via `syncableWrite('importedCourses', 'put', updated)` (no partial update in syncableWrite)
- `updateCourseStatus`: fetch-then-put via `syncableWrite('importedCourses', 'put', updated)`
- `updateCourseMetadata` (patch updates): fetch-then-put via `syncableWrite('importedCourses', 'put', merged)`
- Bulk tag normalization (normalize all courses): each course goes through `syncableWrite('importedCourses', 'put', updated)` in a loop (not a transaction — syncableWrite is atomic per record)

**AC2 — `useCourseImportStore` writes use `syncableWrite` for importedVideos and importedPdfs:**
- On `addCourse`, video and PDF records are written via `syncableWrite('importedVideos', 'add', video)` and `syncableWrite('importedPdfs', 'add', pdf)` — `fileHandle` stripped by registry
- On `deleteCourse`, video and PDF child records are deleted via `syncableWrite('importedVideos', 'delete', videoId)` for each child (or if bulk delete is needed, use individual calls — syncableWrite has no bulkDelete)

**AC3 — `useAuthorStore` writes use `syncableWrite`:**
- `addAuthor`: `syncableWrite('authors', 'add', author)` — `photoHandle` stripped by registry
- `updateAuthor` (edit author): fetch-then-put via `syncableWrite('authors', 'put', updated)` — `photoHandle` stripped
- `deleteAuthor`: `syncableWrite('authors', 'delete', id)`
- Undo-delete (restore): `syncableWrite('authors', 'add', deletedAuthor)`
- All photo-related updates (update photo URL): fetch-then-put via `syncableWrite('authors', 'put', updated)`

**AC4 — `useBookStore` writes use `syncableWrite` with source decomposition:**
- `importBook` / `addBook`: Before calling `syncableWrite('books', 'add', book)`, decompose `book.source` into `sourceType` + `sourceUrl` fields, strip the `source` field itself (so no JSONB blob is uploaded). The Dexie record retains `source` intact (local only) — only the upload payload is decomposed.
- `updateBook` (status, metadata patches): fetch-then-put via `syncableWrite('books', 'put', updated)` with same source decomposition applied
- `deleteBook`: `syncableWrite('books', 'delete', bookId)`
- `updateBookProgress`: This is the monotonic case — the sync engine's upload path for `books` calls `upsert_book_progress()` RPC. The `syncableWrite` call itself is `syncableWrite('books', 'put', book)` which writes to Dexie and enqueues. The upload worker (E92-S06) handles the RPC dispatch based on `conflictStrategy: 'monotonic'`.
- `linkBooks` / `unlinkBooks`: Both are fetch-then-put operations updating `linkedBookId` field — use `syncableWrite('books', 'put', updated)` for each affected book

**AC5 — `books` tableRegistry entry updated with source fieldMap:**
- `fieldMap` entry added: `{ source: '' }` with a special sentinel OR the registry gains a new `stripFields` entry for `'source'` plus new virtual fields `sourceType` and `sourceUrl` added to `Book` type for upload.
- More precisely: `stripFields: ['source']` added to `books` registry entry, AND the `syncableWrite` preprocessor (or a new `fieldTransform` hook) maps `book.source.type → sourceType` and `book.source.url → sourceUrl` before stripping `source`.
- **Alternative (simpler):** Add `sourceType` and `sourceUrl` as persisted fields on the Dexie `Book` record (set at import time), and keep `source` as a local-only ephemeral field that is always stripped. The store sets both when importing.

**AC6 — Store refresh callbacks registered in `useSyncLifecycle`:**
- `syncEngine.registerStoreRefresh('importedCourses', () => useCourseImportStore.getState().loadCourses())`
- `syncEngine.registerStoreRefresh('importedVideos', () => useCourseImportStore.getState().loadCourses())` (reload courses reloads all videos/pdfs)
- `syncEngine.registerStoreRefresh('importedPdfs', () => useCourseImportStore.getState().loadCourses())`
- `syncEngine.registerStoreRefresh('authors', () => useAuthorStore.getState().loadAuthors())`
- `syncEngine.registerStoreRefresh('books', () => useBookStore.getState().loadBooks())`

**AC7 — Sync queue entries created on authenticated write:**
- After any of the above mutating operations while signed in, `syncQueue` contains an entry with correct `tableName`, `operation`, and `status: 'pending'`
- `directoryHandle`, `coverImageHandle`, `fileHandle`, `photoHandle` must NOT appear in the syncQueue payload

**AC8 — Unauthenticated writes persist locally only:**
- When `user` is null, mutations write to Dexie but create no `syncQueue` entries (syncableWrite auth guard)

**AC9 — Zero direct Dexie write calls remain in wired stores:**
- After wiring, `useCourseImportStore.ts`, `useAuthorStore.ts`, and `useBookStore.ts` contain no `db.importedCourses.put/add/delete/update`, `db.importedVideos.put/add/delete/update`, `db.importedPdfs.put/add/delete/update`, `db.authors.put/add/delete/update`, `db.books.put/add/delete/update` calls (reads and `db.transaction` for atomic multi-table reads remain unchanged)

**AC10 — Unit tests:**
- New test file `src/lib/sync/__tests__/p2-course-book-sync.test.ts`
- Covers: course add (handles stripped), author add+delete, book add with source decomposition, book progress update (monotonic enqueue), unauthenticated write (no syncQueue entry)
- Uses existing vitest + syncableWrite mock patterns from E93 tests

---

## Out of Scope

- `db.transaction` for atomic multi-table reads — keep as-is (reads are not wired)
- Book progress RPC dispatch logic in the upload worker — E92-S06 already handles this based on conflictStrategy
- Supabase Storage integration (cover art, audio files) — E94-S04
- `bookReviews`, `shelves`, `bookShelves`, `readingQueue` stores — E94-S03
- Chapter mappings (`chapterMappings`) — E94-S06

---

## Key Design Decisions

1. **Source decomposition at write time vs. upload time:** Decompose `book.source` when writing to Dexie (store `sourceType` + `sourceUrl` as persisted fields, strip `source` from upload). This keeps the upload path simple and avoids a transform hook in the sync engine. The `source` field with its live `fileHandle` reference continues to work locally — it's just not persisted to Supabase.

2. **Bulk delete pattern:** `syncableWrite` has no bulk delete. For `deleteCourse`, iterate child videos/PDFs and call individual `syncableWrite('importedVideos', 'delete', id)`. This produces N syncQueue entries (one per record) which is correct — the upload worker processes them independently.

3. **Fetch-then-put for partial updates:** `syncableWrite` does not support partial updates (no `update` operation). All field-patch operations must first read the record from Dexie, merge fields, then call `syncableWrite('tableName', 'put', merged)`. This matches the E93-S02 pattern.

4. **`books.progress` monotonic:** The `syncableWrite('books', 'put', book)` call enqueues normally. The upload worker uses `conflictStrategy: 'monotonic'` + `monotonicFields: ['progress']` to call `upsert_book_progress()` RPC. No special handling needed in the store.
