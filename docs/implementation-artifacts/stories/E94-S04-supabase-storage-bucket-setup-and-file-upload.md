---
story_id: E94-S04
story_name: "Supabase Storage Bucket Setup and File Upload"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 94.04: Supabase Storage Bucket Setup and File Upload

## Story

As a learner who imports courses, books, and creates author profiles,
I want my thumbnails, author photos, PDF materials, and book cover images uploaded to Supabase Storage automatically when I sync,
so that these files are available on any device I sign in to, without me having to re-import them manually.

## Acceptance Criteria

**AC1 — All 6 Storage buckets created with correct configuration:**
The following buckets exist in Supabase Storage (created via migration or Supabase dashboard, documented in `supabase/storage-setup.sql`):
| Bucket name | Max file size | Purpose |
|---|---|---|
| `course-thumbnails` | 500 KB | Course cover images (200×112px JPEG) |
| `screenshots` | 2 MB | Course/video screenshots |
| `avatars` | 1 MB | User profile photos |
| `pdfs` | 100 MB | Imported PDF course materials |
| `book-files` | 200 MB | EPUB, PDF books (E94-S07, not this story) |
| `book-covers` | 2 MB | Book cover images |

**AC2 — User-scoped RLS on all 6 buckets:**
Each bucket has a policy that enforces `storage.foldername(name)[1] = auth.uid()::text`. File paths follow the format `{userId}/{recordId}/{filename}`. Cross-user access is blocked: User A cannot read User B's files.

**AC3 — `src/lib/sync/storageUpload.ts` module created:**
Exports:
```ts
export interface UploadResult {
  url: string    // public URL of the uploaded file
  path: string   // storage path: {userId}/{recordId}/{filename}
}

export async function uploadBlob(
  bucket: string,
  path: string,
  blob: Blob,
  options?: { contentType?: string }
): Promise<UploadResult>
```
- Uses `supabase.storage.from(bucket).upload(path, blob, { upsert: true })` — upsert prevents conflicts on re-upload
- On success: calls `supabase.storage.from(bucket).getPublicUrl(path)` and returns both URL and path
- On error: rethrows with a descriptive message: `[storageUpload] Failed to upload to ${bucket}/${path}: ${err.message}`
- File size enforcement: if `blob.size > maxSizeBytes`, throws `[storageUpload] File too large: ${blob.size} > ${maxSizeBytes}` **before** any network call
- Size limits enforced per bucket (see AC1) — pass maxSizeBytes as parameter

**AC4 — Course thumbnail upload on sync:**
After a `syncableWrite('importedCourses', 'put', course)` enqueues the course row, if `db.courseThumbnails.get(course.id)` returns a blob, upload it to `course-thumbnails/{userId}/{courseId}/thumbnail.jpg` and update `imported_courses.thumbnail_url` in Supabase with the returned Storage URL.
- `CourseThumbnail.blob` (Blob from Dexie `courseThumbnails` table) is the source
- Upload triggered from `src/lib/sync/storageSync.ts` (new file — see Task 4)
- `imported_courses` Supabase row's `thumbnail_url` column updated via `supabase.from('imported_courses').update({ thumbnail_url: url }).eq('id', courseId).eq('user_id', userId)`

**AC5 — Author photo upload on sync:**
If an `ImportedAuthor` record has a `photoHandle` (FileSystemFileHandle), read the file and upload to `avatars/{userId}/{authorId}/photo.jpg`. Update `authors.photo_url` in Supabase. Skip silently if `photoHandle` is absent or `getFile()` throws (handles become stale after page reload).

**AC6 — PDF file upload on sync:**
If an `ImportedPdf` record has a `fileHandle` (FileSystemFileHandle), read the file and upload to `pdfs/{userId}/{pdfId}/file.pdf`. Update `imported_pdfs.file_url` in Supabase. Skip silently if `fileHandle` is absent or stale.

**AC7 — Book cover upload on sync:**
If a `Book` record has `coverUrl` starting with `opfs-cover://` or `opfs://`, resolve the blob via `opfsStorageService.getCoverUrl(bookId)` (returns an object URL) → `fetch(objectUrl).then(r => r.blob())` → upload to `book-covers/{userId}/{bookId}/cover.jpg`. Update `books.cover_url` in Supabase. Skip if `coverUrl` is already an HTTPS URL (already uploaded). Skip if OPFS read fails.

**AC8 — Storage upload runs AFTER row upsert, not before:**
The sync engine uploads metadata (Postgres row) first, then initiates file upload. If the row upsert fails, no Storage upload occurs. If the Storage upload fails, the row URL field remains null/old URL — not a fatal error; will retry on next sync cycle (the row is already in Supabase).

**AC9 — File size limits enforced:**
- A 501 KB thumbnail upload is rejected with a `[storageUpload] File too large` error before network call
- A 100 MB + 1 byte PDF upload is rejected before network call
- Size check happens in `uploadBlob()` when `maxSizeBytes` is passed

**AC10 — `book-files` bucket exists but is NOT used in this story:**
The `book-files` bucket is created (AC1) but all upload logic for book EPUB/PDF/audiobook files is deferred to E94-S07. No `storageSync.ts` code handles book file uploads.

**AC11 — Unit tests cover storageUpload module:**
New test file `src/lib/sync/__tests__/storageUpload.test.ts`:
- `uploadBlob` success: verifies Supabase upload called with correct bucket/path/blob; verifies returned URL matches `getPublicUrl` result
- `uploadBlob` size exceeded: rejects before network call; Supabase upload NOT called
- `uploadBlob` network error: rethrows with descriptive message
- Unauthenticated guard: if `supabase` is null, throws `[storageUpload] Supabase client not initialized`

**AC12 — `storageSync.ts` integration tests:**
New test file `src/lib/sync/__tests__/storageSync.test.ts`:
- Course with thumbnail → `uploadBlob` called with `course-thumbnails/{userId}/{courseId}/thumbnail.jpg`; Supabase row updated
- Course without thumbnail → `uploadBlob` NOT called
- Author with stale `photoHandle` → upload skipped silently (no error thrown or logged as error)
- Book with `opfs://` coverUrl → resolved, uploaded to `book-covers/...`, Supabase `books` row updated
- Book with `https://` coverUrl → upload skipped (already remote)

## Tasks / Subtasks

- [ ] Task 1: Create Storage bucket setup SQL `supabase/storage-setup.sql` (AC: 1, 2)
  - [ ] 1.1 Create the 6 buckets via SQL (or document that they must be created in the Supabase dashboard — Supabase Storage buckets cannot be created via `supabase db push` SQL migrations in self-hosted; use `INSERT INTO storage.buckets` with `public: false` and `file_size_limit` in bytes). Check existing `supabase/migrations/` to see if any Storage SQL is already present.
  - [ ] 1.2 For each bucket, set `file_size_limit` in bytes:
    - `course-thumbnails`: 512000 (500 KB)
    - `screenshots`: 2097152 (2 MB)
    - `avatars`: 1048576 (1 MB)
    - `pdfs`: 104857600 (100 MB)
    - `book-files`: 209715200 (200 MB)
    - `book-covers`: 2097152 (2 MB)
  - [ ] 1.3 Create RLS policies for each bucket using `CREATE POLICY` on `storage.objects`:
    - Allow SELECT for owner: `(storage.foldername(name))[1] = auth.uid()::text`
    - Allow INSERT for owner: same check on `(storage.foldername(name))[1]`
    - Allow UPDATE for owner: same check
    - Allow DELETE for owner: same check
    - Pattern: `USING (bucket_id = 'bucket-name' AND (storage.foldername(name))[1] = auth.uid()::text)`
  - [ ] 1.4 Verify by checking `storage.buckets` and `storage.policies` tables after applying

- [ ] Task 2: Create `src/lib/sync/storageUpload.ts` (AC: 3, 9, 11)
  - [ ] 2.1 Import `supabase` from `@/lib/auth/supabase` (the singleton — already used by syncEngine.ts)
  - [ ] 2.2 Implement `uploadBlob(bucket, path, blob, options?)`:
    - Guard: if `supabase === null`, throw `[storageUpload] Supabase client not initialized`
    - Size guard: if `options?.maxSizeBytes && blob.size > options.maxSizeBytes`, throw `[storageUpload] File too large: ${blob.size} > ${options.maxSizeBytes} bytes for ${bucket}/${path}`
    - Upload: `const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: options?.contentType ?? blob.type })`
    - On error: throw `[storageUpload] Failed to upload to ${bucket}/${path}: ${error.message}`
    - Get URL: `const { data } = supabase.storage.from(bucket).getPublicUrl(path)`
    - Return `{ url: data.publicUrl, path }`
  - [ ] 2.3 Export `UploadResult` interface and `uploadBlob` function
  - [ ] 2.4 Write unit tests in `src/lib/sync/__tests__/storageUpload.test.ts` (AC: 11). Mock `supabase` client. Test: success path, size-exceeded path, network error path, null-client path.
  - [ ] 2.5 Run `npx tsc --noEmit` — zero type errors

- [ ] Task 3: Create `src/lib/sync/storageSync.ts` — upload orchestration (AC: 4, 5, 6, 7, 8, 10)
  - [ ] 3.1 Exports a single async function:
    ```ts
    export async function uploadStorageFilesForTable(
      tableName: string,
      recordId: string,
      userId: string,
    ): Promise<void>
    ```
    Called by the upload engine after a successful Postgres row upsert.
  - [ ] 3.2 Switch on `tableName`:
    **Case `'importedCourses'`** (AC: 4):
    - `const thumb = await db.courseThumbnails.get(recordId)` — reads from `courseThumbnails` Dexie table (keyed by `courseId`)
    - If no `thumb` or no `thumb.blob`: return early (no upload)
    - `const result = await uploadBlob('course-thumbnails', \`${userId}/${recordId}/thumbnail.jpg\`, thumb.blob, { maxSizeBytes: 512000, contentType: 'image/jpeg' })`
    - Update Supabase: `await supabase!.from('imported_courses').update({ thumbnail_url: result.url }).eq('id', recordId).eq('user_id', userId)`
    **Case `'authors'`** (AC: 5):
    - `const author = await db.table('authors').get(recordId)` — need the full record to access `photoHandle`
    - If no `author?.photoHandle`: return early
    - Wrap in try/catch: `const file = await author.photoHandle.getFile()` — stale handle throws, catch and return silently
    - `const result = await uploadBlob('avatars', \`${userId}/${recordId}/photo.jpg\`, file, { maxSizeBytes: 1048576, contentType: 'image/jpeg' })`
    - Update Supabase: `await supabase!.from('authors').update({ photo_url: result.url }).eq('id', recordId).eq('user_id', userId)`
    **Case `'importedPdfs'`** (AC: 6):
    - `const pdf = await db.table('importedPdfs').get(recordId)`
    - If no `pdf?.fileHandle`: return early
    - Wrap in try/catch: `const file = await pdf.fileHandle.getFile()`
    - `const result = await uploadBlob('pdfs', \`${userId}/${recordId}/file.pdf\`, file, { maxSizeBytes: 104857600, contentType: 'application/pdf' })`
    - Update Supabase: `await supabase!.from('imported_pdfs').update({ file_url: result.url }).eq('id', recordId).eq('user_id', userId)`
    **Case `'books'`** (AC: 7):
    - `const book = await db.table('books').get(recordId)`
    - If `!book?.coverUrl`: return early
    - If `book.coverUrl.startsWith('https://')`: return early (already uploaded)
    - If `book.coverUrl.startsWith('opfs-cover://') || book.coverUrl.startsWith('opfs://')`:
      - Resolve blob: `const objectUrl = await opfsStorageService.getCoverUrl(recordId)` → `const blob = await fetch(objectUrl).then(r => r.blob())` — wrap in try/catch, return silently on failure
      - `const result = await uploadBlob('book-covers', \`${userId}/${recordId}/cover.jpg\`, blob, { maxSizeBytes: 2097152, contentType: 'image/jpeg' })`
      - Update Supabase: `await supabase!.from('books').update({ cover_url: result.url }).eq('id', recordId).eq('user_id', userId)`
    **Default**: return (no file upload for this table)
  - [ ] 3.3 Import `opfsStorageService` from `@/services/OpfsStorageService` (already imported in BookImportDialog.tsx, BookMetadataEditor.tsx — pattern established)
  - [ ] 3.4 Write tests in `src/lib/sync/__tests__/storageSync.test.ts` (AC: 12). Mock `db`, `uploadBlob`, `opfsStorageService`, and `supabase` client. Test all scenarios from AC12.
  - [ ] 3.5 Run `npx tsc --noEmit` — zero type errors

- [ ] Task 4: Wire `storageSync.ts` into the upload engine (AC: 8)
  - [ ] 4.1 Open `src/lib/sync/syncEngine.ts` — find the upload batch section where Supabase `upsert` is called per table
  - [ ] 4.2 After a successful `upsert` (not insert-only, not delete) for a record, call:
    ```ts
    await uploadStorageFilesForTable(tableName, recordId, userId).catch(err => {
      // Intentional: Storage upload failures are non-fatal. The Postgres row is already
      // persisted. The file URL remains null/stale until the next sync cycle retries.
      console.warn('[syncEngine] Storage upload failed for', tableName, recordId, err)
    })
    ```
  - [ ] 4.3 Only call for tables that have Storage files: `['importedCourses', 'authors', 'importedPdfs', 'books']` — guard with a set check to avoid overhead on every upsert
  - [ ] 4.4 Import `uploadStorageFilesForTable` from `./storageSync`
  - [ ] 4.5 Confirm `book-files` uploads are NOT triggered here (E94-S07 scope — `'books'` case in `storageSync.ts` only uploads covers, not book files)
  - [ ] 4.6 Run existing `syncEngine.test.ts` — no regressions

- [ ] Task 5: Verify Supabase Storage client availability (AC: 3)
  - [ ] 5.1 Confirm `supabase` singleton in `src/lib/auth/supabase.ts` includes the `.storage` API — it does because `createClient()` includes it by default
  - [ ] 5.2 `supabase` is already imported and used in `syncEngine.ts`; `storageUpload.ts` follows the same import pattern: `import { supabase } from '@/lib/auth/supabase'`
  - [ ] 5.3 Run `npm run build` — no new import errors

- [ ] Task 6: Final verification
  - [ ] 6.1 Run `npm run test:unit -- storageUpload` — all tests pass
  - [ ] 6.2 Run `npm run test:unit -- storageSync` — all tests pass
  - [ ] 6.3 Run `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 6.4 Run `npm run lint` — zero new ESLint warnings/errors
  - [ ] 6.5 Manual smoke test: import a course with a thumbnail → trigger sync → verify `imported_courses.thumbnail_url` in Supabase contains a `storage.supabase.co` URL

## Key Existing Files (Read Before Implementing)

| File | Why relevant |
|---|---|
| `src/lib/auth/supabase.ts` | Supabase client singleton — import pattern for all sync files |
| `src/lib/sync/syncEngine.ts` | Upload loop — where to call `uploadStorageFilesForTable` |
| `src/lib/sync/tableRegistry.ts` | Registry — which tables have `stripFields: ['fileHandle']` etc. |
| `src/lib/sync/storageEstimate.ts` | Storage estimation — may inform quota logic (not this story) |
| `src/services/OpfsStorageService.ts` | OPFS/IndexedDB cover storage — must use `getCoverUrl()` to resolve `opfs://` paths to blobs |
| `src/data/types.ts` | `ImportedPdf`, `ImportedAuthor`, `CourseThumbnail`, `Book` types |
| `src/db/schema.ts` | Dexie schema — `courseThumbnails` table keyed by `courseId`, `importedPdfs.fileHandle` |
| `src/lib/sync/__tests__/p2-course-book-sync.test.ts` | Test pattern to follow (mocking db, auth, syncEngine) |
| `src/app/components/library/BookImportDialog.tsx` | Usage pattern for `opfsStorageService.storeCoverFile` |
| `src/app/components/library/BookMetadataEditor.tsx` | Usage pattern for `opfsStorageService.getCoverUrl` + `opfs-cover://` URL resolution |

## Implementation Notes

### Storage Upload Architecture Decision

The upload pipeline is **after-row** (Postgres first, Storage second). This means:
- If Storage upload fails: the row is in Supabase but `*_url` column is null/old. On next sync, the engine re-upserts the row (LWW) and retries the Storage upload.
- If only Storage succeeds but row upsert failed: impossible by design (row upsert must succeed before Storage upload runs).

### File Handle Stale-Handle Problem

`FileSystemFileHandle` objects become invalid after page reload. When `getFile()` throws (typically `DOMException: The requested file could not be read`), `storageSync.ts` must catch silently and skip upload. Do NOT log as error (expected behavior). Use `console.debug` at most.

### `opfs-cover://` vs `opfs://` URL Schemes

Both schemes indicate locally stored covers in OPFS/IndexedDB. `opfsStorageService.getCoverUrl(bookId)` handles both. Call it and then `fetch(objectUrl).then(r => r.blob())` to get the Blob. Revoke the object URL after use with `URL.revokeObjectURL(objectUrl)`.

### CourseThumbnail Dexie Table

- Table: `courseThumbnails` (in `src/db/schema.ts`)
- PK: `courseId` (not `id` — this is different from other sync tables!)
- Access: `db.courseThumbnails.get(courseId)` — the key is the course ID string
- Type: `{ courseId: string; blob: Blob; source: ThumbnailSource; createdAt: string }`
- The blob is a 200×112px JPEG (from `thumbnailService.ts`)

### Supabase Storage `getPublicUrl` vs `createSignedUrl`

Use `getPublicUrl()` (not `createSignedUrl()`) — buckets are private but we control access via RLS, so public URLs work as long as the user is authenticated. The returned URL will be in the format: `https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}`.

### `supabase!` Non-Null Assertion

In `storageSync.ts`, the supabase guard should be in `uploadBlob()`. When calling Supabase from `storageSync.ts` for the row URL update, guard at the top of `uploadStorageFilesForTable` with `if (!supabase) return`. Do NOT use `!` (non-null assertion) without the guard.

### `syncEngine.ts` Upload Loop Reference

Look for the section in `syncEngine.ts` where successful upsert is logged/confirmed. The pattern is likely:
```ts
const { error } = await supabase.from(entry.supabaseTable).upsert(batch, { onConflict: 'id' })
if (!error) {
  // Success — delete from queue
  await db.syncQueue.bulkDelete(ids)
  // NEW: kick Storage uploads for file-bearing tables
}
```
Insert the `uploadStorageFilesForTable` call here, per record, NOT per batch (each record may have a different recordId).

## Testing Notes

### Test File Patterns (follow existing convention)

```ts
// storageUpload.test.ts
vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/file.jpg' } })
      })
    }
  }
}))
```

### Edge Cases to Test

1. Blob is empty (0 bytes) — still uploads (valid edge case for placeholder thumbnails)
2. Bucket name contains hyphens — `supabase.storage.from('course-thumbnails')` — standard, works fine
3. `supabase` is null (missing env vars) — `uploadBlob` throws immediately
4. Upload returns `error` object — message included in thrown error
5. `getPublicUrl` always returns a URL even if file doesn't exist (it's computed) — this is fine; we trust the upload succeeded

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — Storage upload failures logged as `console.warn`, not swallowed silently
- [ ] Stale file handle errors caught and skipped silently (use `console.debug`, NOT `console.error`)
- [ ] `supabase` null guard in `uploadBlob()` and at top of `uploadStorageFilesForTable()`
- [ ] `book-files` bucket created (AC1) but NO upload logic implemented for it (E94-S07 scope)
- [ ] Postgres row update (`imported_courses.thumbnail_url` etc.) uses `.eq('user_id', userId)` as a second filter for RLS safety
- [ ] OPFS object URLs are revoked after blob fetch (`URL.revokeObjectURL`)
- [ ] `storageUpload.ts` does NOT import any React or Zustand — pure utility
- [ ] `storageSync.ts` does NOT import React — pure utility (imports `db`, `supabase`, `uploadBlob`, `opfsStorageService`)
- [ ] `tsc --noEmit` clean
- [ ] Unit tests for `storageUpload.test.ts` and `storageSync.test.ts` pass
- [ ] Existing `syncEngine.test.ts` passes (no regressions from Task 4 hook)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
