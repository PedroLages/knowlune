---
date: 2026-04-19
topic: e94-s04-supabase-storage-bucket-setup
---

# E94-S04: Supabase Storage Bucket Setup and File Upload

## Problem Frame

The sync engine (E92) and library metadata sync (E94-S01 through S03) push Postgres row data to Supabase. But binary assets — course thumbnails, author photos, PDF course files, and book cover images — are stored locally as Blobs, FileSystemFileHandles, or OPFS paths. On a new device these files are absent even though their metadata rows arrive. This story creates the Storage infrastructure and upload pipeline so binary assets follow their metadata to Supabase, making the library visually complete and accessible on any device after sign-in.

## Requirements

**Storage Bucket Infrastructure**

- R1. Six Storage buckets must be created in Supabase: `course-thumbnails` (500 KB), `screenshots` (2 MB), `avatars` (1 MB, for author photos), `pdfs` (100 MB), `book-files` (200 MB), `book-covers` (2 MB). All 6 buckets are set to `public: false`.
- R2. Each bucket enforces user-scoped RLS covering SELECT, INSERT, and UPDATE: file paths follow `{userId}/{recordId}/{filename}`, and policies enforce `(storage.foldername(name))[1] = auth.uid()::text` on both `USING` (reads) and `WITH CHECK` (writes) clauses. This applies to all 6 buckets including `book-files`, even though its upload logic is E94-S07.
- R3. Bucket creation and RLS policies are captured in `supabase/storage-setup.sql` for reproducibility. Note: this is a separate manual-apply script (not a numbered migration), since Supabase Storage bucket creation via `INSERT INTO storage.buckets` is not idempotent through the standard migration runner in self-hosted setups.

**Upload Utility**
- R4. A new module `src/lib/sync/storageUpload.ts` exports `uploadBlob(bucket, path, blob, options?)` returning `{ url, path }`. It uses the existing `supabase` singleton from `src/lib/auth/supabase.ts`.
- R5. `uploadBlob` enforces file size limits before making any network call; size limit passed as `options.maxSizeBytes`.
- R6. Upload uses `upsert: true` to avoid conflicts on re-upload. Returns the public URL from `getPublicUrl()`.

**File Upload Triggers (post-upsert, per table)**
- R7. After a successful Postgres row upsert for `importedCourses`: upload the course thumbnail blob from `db.courseThumbnails.get(courseId)` to `course-thumbnails/{userId}/{courseId}/thumbnail.jpg`; update `imported_courses.thumbnail_url` in Supabase.
- R8. After a successful upsert for `authors`: if `photoHandle` (FileSystemFileHandle) is present and readable, upload to `avatars/{userId}/{authorId}/photo.jpg`; update `authors.photo_url`. Stale handles (throws on `getFile()`) are silently skipped — not logged as errors.
- R9. After a successful upsert for `importedPdfs`: if `fileHandle` is present and readable, upload to `pdfs/{userId}/{pdfId}/file.pdf`; update `imported_pdfs.file_url`. Stale handles silently skipped.
- R10. After a successful upsert for `books`: if `coverUrl` starts with `opfs-cover://` or `opfs://`, resolve via `opfsStorageService.getCoverUrl(bookId)` → fetch blob → upload to `book-covers/{userId}/{bookId}/cover.jpg`; update `books.cover_url`. If `coverUrl` is already `https://`, skip (already in Storage). OPFS read failures silently skipped.
- R11. Upload orchestration is encapsulated in a new `src/lib/sync/storageSync.ts` module, called from the sync engine upload loop after each successful Postgres upsert.
- R12. Storage upload failures are non-fatal: logged as `console.warn`, not thrown. The Postgres row is already persisted; retry happens on the next sync cycle.

**Sync Engine Integration**
- R13. `syncEngine.ts` calls `uploadStorageFilesForTable(tableName, recordId, userId)` only for tables with binary assets: `importedCourses`, `authors`, `importedPdfs`, `books`. Other tables are not affected.
- R14. Upload runs after the successful `bulkDelete` of queue entries — strictly after row persistence, never before.

**Out of Scope (this story)**
- R15. The `book-files` bucket is created (R1) but no upload logic for EPUB/PDF/audiobook files is implemented — that is E94-S07.

## Success Criteria

- All 6 buckets exist in Supabase Storage with correct size limits and RLS policies.
- Cross-user access is blocked: User A cannot read User B's files via the Storage API.
- A course imported with a thumbnail: after sync, `imported_courses.thumbnail_url` contains a `storage.supabase.co` URL and the image loads on a new device.
- A 501 KB thumbnail upload is rejected before any network call is made.
- Existing `syncEngine.test.ts` passes without regression.
- Unit tests for `storageUpload.ts` and `storageSync.ts` pass.

## Scope Boundaries

- No UI changes — file upload is invisible infrastructure.
- No book file (EPUB/PDF/audiobook) upload — strictly E94-S07.
- No download/restore logic — that is E94-S05.
- No storage quota UI — that is E97-S02.
- `screenshots` and `avatars` buckets are created but no upload triggers for those are implemented in this story (avatars bucket is used for author photos via `authors` table; `screenshots` bucket is future use).
- Resolving Storage URLs to displayable image URLs (signed URL generation or client-side auth flow for private bucket images) is out of scope — handled by E94-S05 or the display layer.

## Key Decisions

- **After-row upload ordering**: Postgres row upserted first, then Storage upload attempted. If Storage fails, row URL stays null and retries on next sync — avoids blocking the sync queue on large file uploads.
- **Non-fatal Storage failures**: Storage upload errors are warnings, not blockers. The Dexie write and Postgres row are already durable. A silent retry on next cycle is safer than halting the sync engine.
- **Stale FileSystemFileHandle**: Browser file handles become invalid after page reload. Catch `DOMException` on `getFile()` and skip silently — this is expected, not an error.
- **OPFS URL resolution**: `opfsStorageService.getCoverUrl(bookId)` returns `string | null`. If null, skip. If non-null, fetch the blob via `fetch(objectUrl)` and revoke the object URL after use.
- **Private buckets + `getPublicUrl()`**: All buckets are `public: false`. `getPublicUrl()` still returns a URL, but that URL requires the Supabase authenticated client to resolve (RLS enforced server-side). This means URLs stored in Postgres columns (`thumbnail_url`, `photo_url`, etc.) are only accessible via the Supabase client with a valid session — direct browser `<img src="...">` tags pointing at Storage URLs will not work without using a signed URL or a server-side proxy. This is an accepted trade-off: images that need to render in `<img>` tags will require `createSignedUrl()` at display time (E94-S05 or the display layer, not this story). This story's job is to persist the Storage path so the URL can be resolved later — storing `getPublicUrl()` output as a stable path reference is correct.

## Dependencies / Assumptions

- E92 (sync engine upload loop) is complete and merged — confirmed by codebase state.
- E94-S01 (P2 Supabase migrations) created `imported_courses.thumbnail_url`, `authors.photo_url`, `imported_pdfs.file_url`, `books.cover_url` columns — confirmed merged.
- `supabase` singleton at `src/lib/auth/supabase.ts` includes `.storage` API — confirmed (standard `createClient()` behavior).
- `opfsStorageService` at `src/services/OpfsStorageService.ts` exposes `getCoverUrl(bookId): Promise<string | null>` — confirmed from codebase.
- `db.courseThumbnails` Dexie table is keyed by `courseId` (not `id`) — confirmed from `src/db/schema.ts`.

## Outstanding Questions

### Deferred to Planning

- [Affects R13][Technical] Exact line in `syncEngine.ts` to hook in — the successful-upsert path (after `bulkDelete`) differs between monotonic RPC calls, insert-only, and regular upsert branches. Planner should read lines ~409–501 of `src/lib/sync/syncEngine.ts` to identify the correct hook points for each of the four tables.
- [Affects R3][Technical] Supabase Storage bucket creation via SQL (`INSERT INTO storage.buckets`) vs. dashboard setup — confirm whether local self-hosted Supabase supports the SQL approach or requires the dashboard.

## Next Steps

-> `/ce:plan` for structured implementation planning
