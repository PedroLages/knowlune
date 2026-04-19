---
title: "feat: E94-S04 Supabase Storage Bucket Setup and File Upload"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e94-s04-supabase-storage-bucket-setup-requirements.md
---

# feat: E94-S04 Supabase Storage Bucket Setup and File Upload

## Overview

Creates the Supabase Storage infrastructure (6 private buckets with RLS) and a lightweight upload pipeline so binary assets — course thumbnails, author photos, PDF files, and book covers — follow their Postgres metadata rows to Supabase. The upload runs non-fatally after each successful sync-queue batch, strictly after row persistence.

## Problem Frame

The sync engine (E92) and P2 metadata sync (E94-S01 through S03) push Postgres rows to Supabase. Binary assets — blobs, FileSystemFileHandles, and OPFS-backed files — live only on the originating device. After sign-in on a second device, metadata arrives but thumbnails and covers are absent. This story closes that gap for the four tables that carry binary assets: `importedCourses`, `authors`, `importedPdfs`, and `books`. (See origin: `docs/brainstorms/2026-04-19-e94-s04-supabase-storage-bucket-setup-requirements.md`)

## Requirements Trace

- R1. Six Storage buckets: `course-thumbnails` (500 KB), `screenshots` (2 MB), `avatars` (1 MB), `pdfs` (100 MB), `book-files` (200 MB), `book-covers` (2 MB). All private (`public: false`).
- R2. User-scoped RLS on all 6 buckets: path pattern `{userId}/{recordId}/{filename}`; both `USING` and `WITH CHECK` enforce `(storage.foldername(name))[1] = auth.uid()::text`.
- R3. Bucket creation and RLS captured in `supabase/storage-setup.sql` (manual-apply, not a numbered migration).
- R4. `src/lib/sync/storageUpload.ts` exports `uploadBlob(bucket, path, blob, options?)` returning `{ url, path }`, using the existing `supabase` singleton.
- R5. `uploadBlob` enforces `options.maxSizeBytes` before any network call.
- R6. Upload uses `upsert: true`; URL returned via `getPublicUrl()`.
- R7. Post-upsert for `importedCourses`: upload thumbnail blob from `db.courseThumbnails.get(courseId)` → `course-thumbnails/{userId}/{courseId}/thumbnail.jpg`; update `imported_courses.thumbnail_url`.
- R8. Post-upsert for `authors`: if `photoHandle` readable, upload → `avatars/{userId}/{authorId}/photo.jpg`; update `authors.photo_url`. Stale handles silently skipped.
- R9. Post-upsert for `importedPdfs`: if `fileHandle` readable, upload → `pdfs/{userId}/{pdfId}/file.pdf`; update `imported_pdfs.file_url`. Stale handles silently skipped.
- R10. Post-upsert for `books`: if `coverUrl` starts with `opfs-cover://` or `opfs://`, resolve via `opfsStorageService.getCoverUrl(bookId)` → fetch blob → upload → `book-covers/{userId}/{bookId}/cover.jpg`; update `books.cover_url`. OPFS failures silently skipped. Already-https URLs skipped.
- R11. Upload orchestration encapsulated in `src/lib/sync/storageSync.ts`.
- R12. Storage upload failures are non-fatal: `console.warn`, not thrown.
- R13. `syncEngine.ts` calls `uploadStorageFilesForTable(tableName, recordId, userId)` only for `importedCourses`, `authors`, `importedPdfs`, `books`.
- R14. Storage upload runs strictly after successful `bulkDelete` (row persistence confirmed).
- R15. `book-files` bucket created but no upload logic implemented (E94-S07).

## Scope Boundaries

- No UI changes.
- No download/restore logic (E94-S05).
- No signed-URL generation at display time (E94-S05 or display layer).
- No storage quota UI (E97-S02).
- `screenshots` bucket created but no upload trigger implemented in this story.
- No EPUB/PDF/audiobook file upload (E94-S07).

### Deferred to Separate Tasks

- Signed URL generation for `<img>` rendering: E94-S05 or display layer.
- `book-files` upload: E94-S07.

## Context & Research

### Relevant Code and Patterns

- `src/lib/auth/supabase.ts` — singleton `supabase: SupabaseClient | null`; `.storage` API is available via standard `createClient()`.
- `src/lib/sync/syncEngine.ts` — `_doUpload()` loop at lines ~932–948: iterates `byTable`, calls `await _uploadBatch(batch, tableEntry)`. The storage hook belongs immediately after the `_uploadBatch` call, guarded by the return value (`true` = success).
- `src/lib/sync/syncEngine.ts` — `_uploadBatch()` at lines ~399–510: all three code paths (insert-only, monotonic RPC, default upsert) converge at line 501 `await db.syncQueue.bulkDelete(entries.map(...))` before returning `true`. The `_doUpload` loop is the right hook point — not inside `_uploadBatch` — because `_uploadBatch` handles individual batches and the storage upload is per-record-id.
- `src/lib/sync/tableRegistry.ts` — `importedCourses`, `authors`, `importedPdfs`, `books` entries confirmed; `books` uses `conflictStrategy: 'monotonic'`, others use `'lww'`.
- `src/services/OpfsStorageService.ts` — `opfsStorageService.getCoverUrl(bookId): Promise<string | null>` confirmed.
- `src/data/types.ts` — `CourseThumbnail.blob: Blob`, keyed by `courseId`; `ImportedAuthor.photoHandle?: FileSystemFileHandle`; `ImportedPdf.fileHandle: FileSystemFileHandle`; `Book.coverUrl?: string`.
- `src/db/schema.ts` — `courseThumbnails` table keyed by `'courseId'` (EntityTable<CourseThumbnail, 'courseId'>).
- `src/lib/sync/__tests__/p2-course-book-sync.test.ts` — existing P2 sync test; must not regress.
- `src/app/hooks/useBookCoverUrl.ts` — existing OPFS resolution pattern using `opfsStorageService.getCoverUrl()` and object URL revocation; follow the same revoke-after-fetch pattern in `storageSync.ts`.

### Institutional Learnings

- Supabase Storage bucket creation via `INSERT INTO storage.buckets` is not idempotent through the standard migration runner in self-hosted setups — use a separate manual-apply script (R3 confirms this).
- `getPublicUrl()` on a private bucket returns a stable URL string but requires the authenticated Supabase client to resolve; direct `<img src>` will not work without signed URLs. This is accepted for this story — the URL is stored as a stable reference.
- `books` uses monotonic conflict strategy with no dedicated RPC → falls back to generic upsert in `_uploadBatch`. The `_doUpload` loop correctly processes all tables regardless of conflict strategy; the storage hook after `_uploadBatch` works uniformly.
- FileSystemFileHandle validity: handles become stale after page reload. Catch `DOMException` on `.getFile()` and skip silently (not an error).
- Object URLs from OPFS must be revoked after `fetch()` to avoid memory leaks (pattern from `useBookCoverUrl.ts`).

### External References

- Supabase Storage RLS docs: bucket-level policies use `storage.foldername(name)` to extract path segments.

## Key Technical Decisions

- **Hook point in syncEngine**: Add storage upload call in the `_doUpload` loop (lines ~944–947) immediately after `await _uploadBatch(batch, tableEntry)` returns true, guarded by a set of target table names. This avoids modifying `_uploadBatch` internals and keeps the storage concern isolated in `storageSync.ts`.
- **Record IDs from queue entries**: Each `SyncQueueEntry` carries the record's `payload`. Extract `payload.id` (or `payload.courseId` for courseThumbnails) from the batch entries to drive storage lookups.
- **storageSync.ts dispatches per-entry**: `uploadStorageFilesForTable(tableName, recordIds, userId)` iterates entries and calls table-specific handlers. Each handler is independently try/caught and warns on failure (non-fatal per R12).
- **No URL writeback via syncableWrite**: After uploading, update the Supabase row URL column directly via `supabase.from(...).update(...)` — not via syncableWrite — to avoid creating a new sync queue entry for the URL itself. This is a post-upload bookkeeping write, not a user-initiated mutation.
- **supabase/storage-setup.sql as manual-apply script**: Avoids the idempotency issues of `INSERT INTO storage.buckets` in self-hosted Supabase's migration runner. Developer applies once per environment via `psql` or the Supabase dashboard SQL editor.
- **Size limit in storageUpload.ts**: Checked against `blob.size` before any `supabase.storage.from().upload()` call; throws a typed error that the caller catches and warns on.

## Open Questions

### Resolved During Planning

- **Exact hook point in syncEngine.ts**: The `_doUpload` loop at lines 932–948 is the correct integration point. After `await _uploadBatch(batch, tableEntry)`, check if the table is one of the four target tables and call `uploadStorageFilesForTable`. Passes batch entries (which carry payloads) and `userId` (from `useAuthStore` state or a module-level auth resolver).
- **SQL bucket creation approach**: Use `supabase/storage-setup.sql` as a standalone manual-apply script with `INSERT INTO storage.buckets ... ON CONFLICT DO NOTHING` guards. Not a numbered migration.
- **userId sourcing in syncEngine**: `syncEngine.ts` is a pure module (no Zustand imports). User ID must be passed into `uploadStorageFilesForTable` from the auth state available at the call site. The `_doUpload` function currently has no userId — it will need to read it from the `supabase` client session (`supabase.auth.getSession()` or similar) or accept it as a parameter. The cleanest approach: call `supabase?.auth.getSession()` once at the top of `_doUpload` and pass the userId down. This keeps syncEngine pure.

### Deferred to Implementation

- Exact parameter signature of `uploadStorageFilesForTable` (whether it takes the full `SyncQueueEntry[]` or just `string[]` of record IDs).
- Whether `supabase.auth.getSession()` is the right call or if the userId can be read from `supabase.auth.getUser()` (both are available on the JS client; choose based on latency in context).
- SQL `ON CONFLICT DO NOTHING` clause syntax for `storage.buckets` in self-hosted Supabase version.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
_doUpload() [syncEngine.ts]
  └─ for each [tableName, entries] in byTable
       ├─ _uploadBatch(batch, tableEntry) → success: bool
       └─ if success AND tableName in STORAGE_TABLES
            └─ uploadStorageFilesForTable(tableName, entries, userId)
                   [storageSync.ts]
                   ├─ 'importedCourses' → uploadCourseThumbnail(entry, userId)
                   │     db.courseThumbnails.get(courseId) → blob
                   │     uploadBlob('course-thumbnails', path, blob, {maxSizeBytes: 500_000})
                   │     supabase.from('imported_courses').update({thumbnail_url})
                   ├─ 'authors' → uploadAuthorPhoto(entry, userId)
                   │     photoHandle.getFile() → blob  [catch DOMException → skip]
                   │     uploadBlob('avatars', path, blob, {maxSizeBytes: 1_000_000})
                   │     supabase.from('authors').update({photo_url})
                   ├─ 'importedPdfs' → uploadPdfFile(entry, userId)
                   │     fileHandle.getFile() → blob  [catch DOMException → skip]
                   │     uploadBlob('pdfs', path, blob, {maxSizeBytes: 100_000_000})
                   │     supabase.from('imported_pdfs').update({file_url})
                   └─ 'books' → uploadBookCover(entry, userId)
                         if coverUrl starts with opfs-cover:// or opfs://
                           opfsStorageService.getCoverUrl(bookId) → objectUrl
                           fetch(objectUrl) → blob; URL.revokeObjectURL(objectUrl)
                           uploadBlob('book-covers', path, blob, {maxSizeBytes: 2_000_000})
                           supabase.from('books').update({cover_url})

uploadBlob(bucket, path, blob, options) [storageUpload.ts]
  ├─ if blob.size > options.maxSizeBytes → throw RangeError
  ├─ supabase.storage.from(bucket).upload(path, blob, {upsert: true})
  └─ supabase.storage.from(bucket).getPublicUrl(path) → { url, path }
```

## Implementation Units

- [ ] **Unit 1: Storage SQL setup script**

**Goal:** Create `supabase/storage-setup.sql` with bucket definitions and RLS policies for all 6 buckets.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Create: `supabase/storage-setup.sql`

**Approach:**
- Use `INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES (...) ON CONFLICT (id) DO NOTHING` for each of the 6 buckets.
- For each bucket, create 3 RLS policies (SELECT, INSERT, UPDATE) enforcing `(storage.foldername(name))[1] = auth.uid()::text` in both `USING` and `WITH CHECK` clauses.
- `book-files` bucket gets the same RLS pattern even though no upload logic is implemented in this story (R15).
- Include a comment block at the top explaining this is a manual-apply script (not a migration runner artifact).

**Patterns to follow:**
- `supabase/migrations/20260413000001_p0_sync_foundation.sql` for SQL style (explicit column names, comments).

**Test scenarios:**
- Test expectation: none — SQL infrastructure script; verified by manual inspection and the cross-user access success criterion.

**Verification:**
- Script applies cleanly against local self-hosted Supabase with no errors.
- Running it twice does not produce duplicate key errors (idempotent via `ON CONFLICT DO NOTHING`).
- Supabase Storage UI shows all 6 buckets with correct size limits.
- Attempting to read another user's file via the Storage API returns a policy violation error.

---

- [ ] **Unit 2: `storageUpload.ts` — core upload utility**

**Goal:** Implement the `uploadBlob` function with size enforcement and upsert semantics.

**Requirements:** R4, R5, R6

**Dependencies:** Unit 1 (buckets must exist in target environment; unit is independently implementable)

**Files:**
- Create: `src/lib/sync/storageUpload.ts`
- Create: `src/lib/sync/__tests__/storageUpload.test.ts`

**Approach:**
- Export `uploadBlob(bucket: string, path: string, blob: Blob, options?: { maxSizeBytes?: number }): Promise<{ url: string; path: string }>`.
- Check `blob.size > options.maxSizeBytes` before any network call; throw a `RangeError` with a descriptive message.
- Call `supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type })`.
- On Supabase error, throw so the caller can catch and warn.
- Retrieve URL via `supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl`.
- Guard: if `supabase` singleton is null (env vars missing), throw immediately.

**Patterns to follow:**
- `src/lib/auth/supabase.ts` — null-guard pattern for the singleton.
- `src/lib/sync/syncEngine.ts` — error logging style (`console.warn('[storageUpload]', ...)`).

**Test scenarios:**
- Happy path: blob under size limit → calls `supabase.storage.from(bucket).upload` with `upsert: true` → returns `{ url, path }`.
- Edge case: blob.size exactly equals maxSizeBytes → upload proceeds (boundary is exclusive: > not >=).
- Error path: blob.size exceeds maxSizeBytes → throws `RangeError` before any network call; `supabase.storage.from` is never called.
- Error path: Supabase upload returns an error object → throws so the caller can warn.
- Error path: `supabase` singleton is null → throws immediately.
- Happy path: `upsert: true` is passed in the upload options (verify via mock assertion).

**Verification:**
- All unit test scenarios pass.
- TypeScript compiles without errors (`npx tsc --noEmit`).

---

- [ ] **Unit 3: `storageSync.ts` — per-table upload orchestration**

**Goal:** Implement `uploadStorageFilesForTable` with handlers for the four target tables.

**Requirements:** R7, R8, R9, R10, R11, R12

**Dependencies:** Unit 2 (`uploadBlob` must exist)

**Files:**
- Create: `src/lib/sync/storageSync.ts`
- Create: `src/lib/sync/__tests__/storageSync.test.ts`

**Approach:**
- Export `uploadStorageFilesForTable(tableName: string, entries: SyncQueueEntry[], userId: string): Promise<void>`.
- Dispatch to per-table handlers based on `tableName`; ignore non-target tables silently.
- Each handler is wrapped in try/catch; failures emit `console.warn` and do not throw.
- `importedCourses` handler: extract `courseId` from `entry.payload.id`, call `db.courseThumbnails.get(courseId)`, call `uploadBlob`, then update `supabase.from('imported_courses').update({ thumbnail_url: url }).eq('id', courseId).eq('user_id', userId)`.
- `authors` handler: extract `authorId` from `entry.payload.id`, call `photoHandle?.getFile()` from the local Dexie record (`db.authors.get(authorId)`), catch `DOMException` → skip silently, upload to `avatars/`, update `authors.photo_url`.
- `importedPdfs` handler: same FileSystemFileHandle pattern with `db.importedPdfs.get(pdfId)`, upload to `pdfs/`, update `imported_pdfs.file_url`.
- `books` handler: get `coverUrl` from Dexie record, check for `opfs-cover://` or `opfs://` prefix, call `opfsStorageService.getCoverUrl(bookId)` → fetch blob → `URL.revokeObjectURL` after fetch → upload to `book-covers/`, update `books.cover_url`. Already-https URLs are skipped; OPFS read failures caught and skipped.
- Authors and PDFs handlers must read the Dexie record (to get the FileSystemFileHandle) since the sync payload strips handles (`stripFields: ['photoHandle']`, `stripFields: ['fileHandle']`).

**Patterns to follow:**
- `src/app/hooks/useBookCoverUrl.ts` — OPFS resolution and object URL revocation pattern.
- `src/lib/sync/tableRegistry.ts` — `stripFields` confirms that handles are not in the payload; must read from Dexie.

**Test scenarios:**
- Happy path (importedCourses): thumbnail blob exists in `db.courseThumbnails` → `uploadBlob` called with correct bucket/path → Supabase `update` called with `thumbnail_url`.
- Edge case (importedCourses): `db.courseThumbnails.get(courseId)` returns undefined → handler skips upload silently, no error thrown.
- Happy path (authors): Dexie author has readable `photoHandle` → blob obtained → upload to `avatars/` → Supabase update for `photo_url`.
- Error path (authors): `photoHandle.getFile()` throws `DOMException` → caught silently, `console.warn` not called (stale handle is expected, not an error).
- Happy path (importedPdfs): readable `fileHandle` → upload to `pdfs/` → update `file_url`.
- Error path (importedPdfs): stale `fileHandle` → caught silently, skipped.
- Happy path (books, opfs-cover): `coverUrl` starts with `opfs-cover://` → `getCoverUrl` returns objectUrl → fetch → revoke → upload to `book-covers/` → update `cover_url`.
- Edge case (books, already-https): `coverUrl` starts with `https://` → entire handler skips upload.
- Error path (books, OPFS failure): `getCoverUrl` returns null → skip silently.
- Error path (uploadBlob throws size limit): caught in per-table handler, `console.warn` emitted, no rethrow.
- Integration: non-target table name passed → function returns without dispatching any upload.

**Verification:**
- All test scenarios pass.
- TypeScript compiles cleanly.
- Existing `p2-course-book-sync.test.ts` continues to pass (storageSync.ts mocked or no-op in that test environment).

---

- [ ] **Unit 4: syncEngine.ts integration**

**Goal:** Wire `uploadStorageFilesForTable` into the `_doUpload` loop, guarded by table name and upload success.

**Requirements:** R13, R14

**Dependencies:** Unit 3

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Modify: `src/lib/sync/__tests__/syncEngine.test.ts` (regression check and new assertion for storage call)

**Approach:**
- Add import for `uploadStorageFilesForTable` from `./storageSync`.
- At the top of `_doUpload`, resolve `userId` once via `await supabase?.auth.getSession()` (or `getUser()`); if null, proceed without storage uploads (storage upload is non-fatal, same as offline behavior).
- In the `_doUpload` loop (lines ~944–947), after `const success = await _uploadBatch(batch, tableEntry)`:
  - Add constant set `STORAGE_TABLES = new Set(['importedCourses', 'authors', 'importedPdfs', 'books'])` at module level.
  - If `success && userId && STORAGE_TABLES.has(tableName)`, call `await uploadStorageFilesForTable(tableName, batch, userId)` — fire-and-forget is acceptable but await is safer (non-fatal errors are contained inside `storageSync.ts`).
- Do not modify `_uploadBatch` — the hook belongs in `_doUpload` where per-table context is available.

**Patterns to follow:**
- `src/lib/sync/syncEngine.ts` — module-level constants (`MONOTONIC_RPC`, `BATCH_SIZE`), existing null-guard pattern for `supabase`.

**Test scenarios:**
- Happy path: after successful `_uploadBatch` for `importedCourses`, `uploadStorageFilesForTable` is called with correct tableName and entries.
- Edge case: `_uploadBatch` returns false (upload failure) → `uploadStorageFilesForTable` is NOT called.
- Edge case: table is `notes` (non-storage table) → `uploadStorageFilesForTable` is NOT called.
- Edge case: `supabase` is null (env vars missing) → storage upload skipped, no error thrown.
- Regression: existing `syncEngine.test.ts` scenarios pass without modification.

**Verification:**
- `syncEngine.test.ts` passes.
- TypeScript compiles cleanly.
- Verified by inspection that storage upload is called after — never before — `bulkDelete` (which happens inside `_uploadBatch` on the success path).

## System-Wide Impact

- **Interaction graph**: `_doUpload` in `syncEngine.ts` gains a new async call after each successful batch for 4 tables. Upload cycle duration increases proportionally to file sizes; the `navigator.locks` guard (already in place) prevents concurrent upload cycles from stacking.
- **Error propagation**: Storage failures are contained in `storageSync.ts` per-handler try/catch; `console.warn` only. They do not propagate to `_doUpload`, `_uploadBatch`, or the sync queue state.
- **State lifecycle risks**: Postgres row is persisted and sync queue entry deleted before storage upload begins (R14). If storage upload fails, the Postgres row has no `thumbnail_url` / `photo_url` etc. — this is the accepted trade-off (retry on next sync cycle). No partial-write risk to the sync queue.
- **API surface parity**: The `storageSync.ts` module updates Supabase URL columns directly (not via syncableWrite), so no new sync queue entries are generated for URL writeback. This is intentional — URL columns are server-managed after first upload.
- **Integration coverage**: The syncEngine integration test should mock `uploadStorageFilesForTable` to verify call/no-call behavior without hitting real Storage.
- **Unchanged invariants**: Sync queue processing, coalescing, batch upload, and download logic are unchanged. `tableRegistry.ts` is not modified. `syncableWrite.ts` is not modified.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `supabase/storage-setup.sql` applied multiple times causes duplicates | Use `ON CONFLICT (id) DO NOTHING` guards on all inserts |
| Storage upload lengthens sync cycle, blocking the lock for longer | Non-fatal and await'd inside existing lock scope; large files (PDFs, book files) are bounded by size limits; book-files upload deferred to E94-S07 |
| `supabase.auth.getSession()` adds a round-trip per upload cycle | Call once at top of `_doUpload`, not per batch; session is cached by the JS client |
| Stale FileSystemFileHandles cause unhandled rejections | Catch `DOMException` per handler, skip silently |
| Object URL memory leak on OPFS path | Revoke via `URL.revokeObjectURL` immediately after `fetch()` completes (pattern from `useBookCoverUrl.ts`) |
| URL writeback via direct Supabase `.update()` could conflict with concurrent download sync | URL columns (`thumbnail_url`, etc.) are not part of LWW conflict resolution (they are not in sync queue payloads); direct update is safe |
| Private bucket + `getPublicUrl()` URL not usable in `<img>` tags | Accepted trade-off — display-time signed URL generation is E94-S05 |

## Documentation / Operational Notes

- `supabase/storage-setup.sql` must be applied once per environment (local dev + production). Add a note to the project's dev setup docs or README pointing to this script.
- The script is idempotent — safe to re-run if bucket state is unknown.
- Storage upload failures surface only as `console.warn` in the browser devtools; no user-facing feedback in this story.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e94-s04-supabase-storage-bucket-setup-requirements.md](docs/brainstorms/2026-04-19-e94-s04-supabase-storage-bucket-setup-requirements.md)
- Related code: `src/lib/sync/syncEngine.ts` lines 399–510 (`_uploadBatch`), 932–948 (`_doUpload` loop)
- Related code: `src/lib/sync/tableRegistry.ts` — `importedCourses`, `authors`, `importedPdfs`, `books` entries
- Related code: `src/services/OpfsStorageService.ts` — `getCoverUrl(bookId)` implementation
- Related code: `src/app/hooks/useBookCoverUrl.ts` — OPFS URL revocation pattern
- Related code: `src/db/schema.ts` — `courseThumbnails` table keyed by `courseId`
- Related tests: `src/lib/sync/__tests__/p2-course-book-sync.test.ts`
- Supabase Storage RLS: https://supabase.com/docs/guides/storage/security/access-control
