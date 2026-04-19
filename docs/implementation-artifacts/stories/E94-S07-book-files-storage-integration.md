---
story_id: E94-S07
story_name: "Book Files Storage Integration"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 94.07: Book Files Storage Integration

## Story

As a learner who imports EPUB, PDF, and audiobook files locally,
I want my book binary files uploaded to Supabase Storage automatically when I sync, and downloaded to OPFS/IndexedDB when I sign in on a new device,
so that I can read or listen to my books on any device without re-importing them.

## Acceptance Criteria

**AC1 — `books` Postgres table gets `file_url` column:**
New migration `supabase/migrations/20260421000001_books_file_url.sql` adds:
```sql
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS file_url TEXT;
```
- Column is nullable TEXT (NULL until first sync upload)
- Rollback script `supabase/migrations/rollback/20260421000001_books_file_url_rollback.sql` drops the column
- Migration wrapped in `BEGIN; ... COMMIT;`
- No index needed (not queried by file_url)

**AC2 — `Book` TypeScript type gets `fileUrl` field:**
In `src/data/types.ts`, add `fileUrl?: string | null` to the `Book` interface (after `sourceUrl`). This field stores the Supabase Storage public URL for the book's primary file (EPUB, PDF, or audiobook). Optional for backward compatibility with existing Dexie rows that have no server-backed file.

**AC3 — `tableRegistry.ts` `books` entry strips `fileUrl` from standard upload payload:**
The `books` entry in `src/lib/sync/tableRegistry.ts` currently has `stripFields: ['source']`. Add `'fileUrl'` to `stripFields`:
```ts
stripFields: ['source', 'fileUrl'],
```
Rationale: `fileUrl` is written to Supabase directly by `storageSync.ts` after the Storage upload completes — not via the standard row sync payload. Stripping it prevents a stale or null value from overwriting a valid Storage URL in the `books` row during an incremental sync cycle.

**AC4 — `src/lib/sync/storageSync.ts` `_uploadBookFile` handler added:**
New internal handler in `storageSync.ts`:
```ts
async function _uploadBookFile(entry: SyncQueueEntry, userId: string): Promise<void>
```
- Reads the `Book` record from Dexie: `const book = await db.books.get(entry.recordId)`
- If no book, or `book.source` is null/undefined: return early
- Source dispatch:
  - If `book.source.type === 'local'` (has `opfsPath`): call `opfsStorageService.readBookFile(book.source.opfsPath, book.id)` to get a `File | null`
  - If `book.source.type === 'fileHandle'` (has file handle): wrap `book.source.fileHandle.getFile()` in try/catch — stale handle throws `DOMException`, catch and return silently
  - If `book.source` is a remote/ABS source (type `'remote'` or discriminated union variant without local file): return early — nothing to upload
  - Dexie IndexedDB fallback: `const rows = await db.bookFiles.where('bookId').equals(book.id).toArray()` — if rows exist, use `rows[0].blob` as the blob source
- If file/blob is null: return early (no file available to upload)
- Determine MIME type and filename from `file.name` (e.g. `book.epub`, `book.pdf`, `book.m4b`). Preserve the original extension from `file.name`; default to `book.epub` if name is unavailable.
- Size limit: 200 MB = `209_715_200` bytes (matches `book-files` bucket limit from `supabase/storage-setup.sql`)
- Upload: `await uploadBlob('book-files', \`${userId}/${book.id}/${filename}\`, blob, { maxSizeBytes: 209_715_200 })`
- After successful upload, write the URL back to both Dexie and Supabase:
  - Dexie: `await db.books.update(book.id, { fileUrl: result.url })`
  - Supabase: `await supabase!.from('books').update({ file_url: result.url }).eq('id', book.id).eq('user_id', userId)`

**AC5 — `STORAGE_TABLES` set updated to include `'books'` trigger for book files:**
`storageSync.ts` already exports `STORAGE_TABLES = new Set(['importedCourses', 'authors', 'importedPdfs', 'books'])`. The `'books'` entry currently only uploads the cover (via `_uploadBookCover`). Refactor `_uploadBookCover` to be called first, and add `_uploadBookFile` call after it, inside the same `try/catch` block for `'books'` in `uploadStorageFilesForTable`. Both uploads are independently try/caught — cover upload failure must not prevent file upload attempt:
```ts
case 'books':
  await _uploadBookCover(entry, userId)  // existing
  await _uploadBookFile(entry, userId)   // NEW
  break
```

**AC6 — Skip upload if `fileUrl` already points to a valid Supabase Storage URL:**
At the start of `_uploadBookFile`, after reading the `Book` from Dexie:
- If `book.fileUrl?.startsWith('https://')`: return early — file already uploaded; no re-upload
- This prevents duplicate uploads on incremental sync cycles

**AC7 — Download side: `storageDownload.ts` extended to download book files:**
New handler `_downloadBookFile` added to `storageDownload.ts`:
- Entry point: extend `STORAGE_DOWNLOAD_TABLES` to include `'books'` if not already (it already contains `'books'` for cover download). Add `_downloadBookFile` call after `_downloadBookCover` in the `'books'` dispatch.
- Guard: `if (!record.fileUrl || !_isSupabaseStorageUrl(record.fileUrl as string)) return`
- Check local presence: `const existingRows = await db.bookFiles.where('bookId').equals(record.id as string).toArray()` — skip if any row exists with the same `bookId`; also attempt `opfsStorageService.readBookFile` to check OPFS presence
- If no local file: fetch with signed URL fallback (reuse `_fetchWithSignedFallback` from same module)
- Store result via `opfsStorageService.storeBookFile(record.id as string, new File([blob], filename, { type: blob.type }))` — returns OPFS path or `'indexeddb'`
- Update Dexie `books` record: `await db.books.update(record.id as string, { fileUrl: result })`
  - Note: `fileUrl` is updated to the OPFS path (or `'indexeddb'`) so offline file resolution works. Do NOT overwrite with the remote HTTPS URL here — the remote URL is stored in Supabase; the local `fileUrl` in Dexie should reflect local storage.
- Large file handling: no timeout override, no artificial size cap in download direction; browser fetch handles streaming
- Download is non-fatal: wrapped in the per-record try/catch inherited from the outer loop

**AC8 — `Book.fileUrl` field mapped in `tableRegistry.ts` fieldMap:**
Add `fileUrl: 'file_url'` to the `books` entry `fieldMap: {}`:
```ts
fieldMap: { fileUrl: 'file_url' },
```
This allows the standard snake_case download phase to correctly camelCase `file_url → fileUrl` when applying Supabase rows to Dexie.

**AC9 — Unit tests cover `_uploadBookFile` in `storageSync.test.ts`:**
Add to the existing `src/lib/sync/__tests__/storageSync.test.ts`:
- Book with OPFS-backed file (source.type `'local'`, opfsPath set) → `opfsStorageService.readBookFile` called, `uploadBlob` called with `'book-files'` bucket, Supabase row updated, Dexie `db.books.update` called
- Book with `fileHandle` source → `fileHandle.getFile()` called, blob uploaded
- Book with stale `fileHandle` (throws DOMException) → upload skipped silently, no error thrown
- Book with `fileUrl` already starting with `https://` → upload skipped entirely (no `readBookFile`, no `uploadBlob`)
- Book with remote source (no local file) → upload skipped silently
- Book with no Dexie record → upload skipped silently
- Book with file exceeding 200 MB → `uploadBlob` throws RangeError; caught by outer try/catch in `uploadStorageFilesForTable`; `console.warn` emitted; does NOT rethrow

**AC10 — Unit tests cover `_downloadBookFile` in `storageDownload.test.ts`:**
Add to the existing `src/lib/sync/__tests__/storageDownload.test.ts`:
- Book with `fileUrl` (Supabase URL) and no local OPFS file → fetch called, `opfsStorageService.storeBookFile` called, `db.books.update` called with OPFS path
- Book with `fileUrl` (Supabase URL) but local file already exists (bookFiles rows present) → fetch NOT called
- Book with `fileUrl` that is null → download skipped
- Book with `fileUrl` that is not a Supabase URL (e.g. `opfs://…`) → download skipped
- Fetch returns 403 → signed URL fallback attempted → if signed URL succeeds, file stored

**AC11 — `storageSync.test.ts` and `storageDownload.test.ts` existing tests continue to pass.**
No regressions on existing cover upload/download scenarios.

**AC12 — `tableRegistry.ts` `books` `fieldMap` update does not break existing sync tests.**
Run `src/lib/sync/__tests__/tableRegistry.test.ts` — all assertions pass.

## Tasks / Subtasks

- [ ] Task 1: Add `file_url` column to `books` Postgres table (AC: 1)
  - [ ] 1.1 Create `supabase/migrations/20260421000001_books_file_url.sql`:
    ```sql
    BEGIN;
    ALTER TABLE public.books ADD COLUMN IF NOT EXISTS file_url TEXT;
    COMMIT;
    ```
  - [ ] 1.2 Create `supabase/migrations/rollback/20260421000001_books_file_url_rollback.sql`:
    ```sql
    BEGIN;
    ALTER TABLE public.books DROP COLUMN IF EXISTS file_url;
    COMMIT;
    ```
  - [ ] 1.3 Verify no other migration already adds this column (grep `file_url` in `supabase/migrations/`)

- [ ] Task 2: Update `Book` type and `tableRegistry.ts` (AC: 2, 3, 8)
  - [ ] 2.1 Open `src/data/types.ts`, locate `Book` interface (line ~760)
  - [ ] 2.2 Add `fileUrl?: string | null` after `sourceUrl?: string | null`
  - [ ] 2.3 Open `src/lib/sync/tableRegistry.ts`, locate `books` entry (line ~361)
  - [ ] 2.4 Update `stripFields: ['source']` → `stripFields: ['source', 'fileUrl']`
  - [ ] 2.5 Update `fieldMap: {}` → `fieldMap: { fileUrl: 'file_url' }`
  - [ ] 2.6 Run `npx tsc --noEmit` — zero type errors

- [ ] Task 3: Add `_uploadBookFile` to `storageSync.ts` (AC: 4, 5, 6, 9)
  - [ ] 3.1 Open `src/lib/sync/storageSync.ts`
  - [ ] 3.2 Add `SIZE_LIMITS['book-files']: 209_715_200` (200 MB) to the `SIZE_LIMITS` constant object
  - [ ] 3.3 Implement `_uploadBookFile(entry: SyncQueueEntry, userId: string): Promise<void>`:
    - `const book = await db.books.get(entry.recordId)` — return early if null
    - If `book.fileUrl?.startsWith('https://')`: return early (AC6)
    - Source resolution dispatch (see AC4 for full logic):
      - `source.type === 'local'` → `opfsStorageService.readBookFile(source.opfsPath, book.id)`
      - `source.type === 'fileHandle'` → try `source.fileHandle.getFile()` catch return
      - IndexedDB fallback: `db.bookFiles.where('bookId').equals(book.id).first()`
    - Determine `filename`: `file.name` or `'book.epub'` as default
    - `const result = await uploadBlob('book-files', \`${userId}/${book.id}/${filename}\`, blob, { maxSizeBytes: SIZE_LIMITS['book-files'] })`
    - `await db.books.update(book.id, { fileUrl: result.url })`
    - `await supabase!.from('books').update({ file_url: result.url }).eq('id', book.id).eq('user_id', userId)`
  - [ ] 3.4 Refactor `case 'books':` in `uploadStorageFilesForTable` to call both handlers (AC5):
    - Wrap `_uploadBookCover` and `_uploadBookFile` each in their own try/catch so one failure doesn't skip the other:
      ```ts
      case 'books':
        try { await _uploadBookCover(entry, userId) } catch (err) {
          console.warn('[storageSync] Cover upload failed', entry.recordId, err)
        }
        try { await _uploadBookFile(entry, userId) } catch (err) {
          console.warn('[storageSync] File upload failed', entry.recordId, err)
        }
        break
      ```
    - Remove the outer try/catch for `'books'` from the top-level loop (or keep it; both patterns are acceptable — the key is that cover and file are independently non-fatal)
  - [ ] 3.5 Run `npx tsc --noEmit` — zero type errors
  - [ ] 3.6 Write/update tests in `src/lib/sync/__tests__/storageSync.test.ts` (AC9, AC11)
  - [ ] 3.7 Run `npm run test:unit -- storageSync` — all pass

- [ ] Task 4: Add `_downloadBookFile` to `storageDownload.ts` (AC: 7, 10, 11)
  - [ ] 4.1 Open `src/lib/sync/storageDownload.ts`
  - [ ] 4.2 Implement `_downloadBookFile(record: Record<string, unknown>, userId: string): Promise<void>`:
    - Guard: `if (!record.fileUrl || !_isSupabaseStorageUrl(record.fileUrl as string)) return`
    - Determine `bookId`: `const bookId = record.id as string`
    - Local presence check: `const existingRows = await db.bookFiles.where('bookId').equals(bookId).toArray()`; if rows exist → return early
    - Also try: `const opfsFile = await opfsStorageService.readBookFile(\`/knowlune/books/${bookId}/\`, bookId)` — if not null → return early
    - Extract storage path from URL via `_extractStoragePath(record.fileUrl as string)`
    - Fetch via `_fetchWithSignedFallback(record.fileUrl as string, 'book-files', path, userId)`
    - Determine filename from URL (last segment) or default `'book.epub'`
    - `await opfsStorageService.storeBookFile(bookId, new File([blob], filename, { type: blob.type }))`
    - Note: do NOT update `db.books.fileUrl` here — the OPFS path is the local resolution, but `fileUrl` on the Dexie record is set by the table sync row (which will contain the Supabase Storage URL). Leave that column as-is to preserve the remote URL for reference.
  - [ ] 4.3 Wire `_downloadBookFile` into the `'books'` dispatch in `downloadStorageFilesForTable` — call it after `_downloadBookCover`:
    ```ts
    case 'books':
      await _downloadBookCover(record, userId)
      await _downloadBookFile(record, userId)
      break
    ```
    Each call is wrapped in the per-record try/catch already present in the outer loop.
  - [ ] 4.4 Run `npx tsc --noEmit` — zero type errors
  - [ ] 4.5 Write/update tests in `src/lib/sync/__tests__/storageDownload.test.ts` (AC10, AC11)
  - [ ] 4.6 Run `npm run test:unit -- storageDownload` — all pass

- [ ] Task 5: Final verification
  - [ ] 5.1 `npm run test:unit` — all unit tests pass (zero regressions)
  - [ ] 5.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 5.3 `npm run lint` — zero new ESLint warnings/errors
  - [ ] 5.4 `npm run build` — clean build
  - [ ] 5.5 Manual smoke test:
    - Import a local EPUB or audiobook file in the Library
    - Sign in, trigger sync
    - Verify `book_file_url` in Supabase `books` row contains a `storage.supabase.co` URL
    - Open a second browser profile (incognito), sign in, wait for download sync
    - Verify the book file is accessible in OPFS / IndexedDB on the second device

## Implementation Notes

### Source Discriminated Union for Local Book Files

`Book.source` is a discriminated union (`ContentSource`):
```ts
| { type: 'local'; opfsPath: string }
| { type: 'fileHandle'; fileHandle: FileSystemFileHandle }
| { type: 'remote'; url: string }
| { type: 'abs'; absItemId: string; absServerId: string }
| { type: 'opds'; … }
```

Only `'local'` and `'fileHandle'` variants have uploadable binary data. The `'fileHandle'` variant may be stale (DOMException on `.getFile()`) — always wrap in try/catch. The `'local'` variant uses `opfsStorageService.readBookFile(opfsPath, bookId)`.

The `tableRegistry.ts` already strips the entire `source` field from upload payloads (serialization guard). This story adds `fileUrl` to `stripFields` for the same reason: we write it back via direct Supabase `.update()` after the Storage upload, not via the standard sync queue path.

### Why `fileUrl` Is In `stripFields`

The standard sync queue approach (syncableWrite → queue → upload → upsert) would include `fileUrl` in the `books` row upload. If a device has `fileUrl: null` (file not yet uploaded), the incremental sync would push that null, potentially overwriting a valid Storage URL that another device set. By stripping `fileUrl` from the normal upload, only `storageSync.ts` is responsible for setting it — after a successful Storage upload.

### Download File Naming Convention

Upload path: `{userId}/{bookId}/{file.name}` where `file.name` is taken from the original file (e.g., `my-book.epub`, `audiobook.m4b`). On download, the filename is extracted from the last URL segment. Use this filename when calling `opfsStorageService.storeBookFile(bookId, new File([blob], filename, { type }))`.

### Large File Handling (Up to 200 MB)

- Upload: enforced via `maxSizeBytes: 209_715_200` in `uploadBlob()` — throws `RangeError` before network call if exceeded. This is caught by the per-entry try/catch in `uploadStorageFilesForTable`.
- Download: no size cap applied. Browser streaming fetch handles arbitrarily large files. OPFS writes are sequential and efficient for large files. IndexedDB fallback stores the entire blob in memory — acceptable for sizes up to browser storage quota.
- The `opfsStorageService.storeBookFile` API accepts a `File` (which is a `Blob` subclass), so any format works.

### OPFS vs IndexedDB Fallback

`opfsStorageService.storeBookFile(bookId, file)` automatically handles the OPFS/IndexedDB split:
- OPFS available: writes to `navigator.storage.getDirectory()` at `/knowlune/books/{bookId}/{filename}`; returns the OPFS path string
- OPFS unavailable: writes to `db.bookFiles` table as `{ bookId, filename, blob: file }`; returns `'indexeddb'`

Both paths are transparent to the upload/download modules — just call `storeBookFile` and trust the service.

### `_uploadBookFile` and Cover Upload Independence

E94-S04's `_uploadBookCover` already handles the `'books'` case in `uploadStorageFilesForTable`. This story adds `_uploadBookFile` as a peer call. The refactor wraps each in its own try/catch (not the shared outer loop try/catch) so a 200 MB file upload failure does not prevent the cover from uploading (or vice versa).

### No UI Changes Required

Book files download to OPFS/IndexedDB transparently. The existing `BookContentService` and `EpubRenderer` already resolve local files from OPFS. When the download phase writes `opfsStorageService.storeBookFile(bookId, file)`, the OPFS path is registered and the reader will find the file on next open. No new UI components, progress indicators, or error states are needed in this story (E94-S06 / E94-S04 UX is out of scope here).

## Testing Notes

### Mock Pattern for `opfsStorageService` in Upload Tests

```ts
vi.mock('@/services/OpfsStorageService', () => ({
  opfsStorageService: {
    readBookFile: vi.fn().mockResolvedValue(new File(['epub content'], 'book.epub', { type: 'application/epub+zip' })),
    storeBookFile: vi.fn().mockResolvedValue('/knowlune/books/book-id/book.epub'),
  }
}))
```

### Mock Pattern for `db.bookFiles` in Download Tests

```ts
vi.mock('@/db', () => ({
  db: {
    books: { get: vi.fn(), update: vi.fn() },
    bookFiles: { where: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) },
  }
}))
```

### Edge Cases

1. `book.source` is undefined (pre-E94-S02 Dexie row with no `source` field) → early return (no upload)
2. `book.source.type === 'abs'` → no local file, return early
3. File is 200 MB exactly → size guard allows it (`blob.size > maxSizeBytes`, not `>=`)
4. File is 200 MB + 1 byte → `RangeError` thrown, caught by per-entry try/catch, `console.warn` emitted
5. OPFS `storeBookFile` throws (quota exceeded) → caught by per-record try/catch in download loop; skip silently
6. Concurrent downloads of same book (two sync cycles overlap) → `storeBookFile` is idempotent (overwrites); no data corruption
7. `fileUrl` in Dexie is `'indexeddb'` (OPFS fallback result stored as local fileUrl on a previous device) → the `startsWith('https://')` guard in `_uploadBookFile` will NOT skip it; the upload will attempt to read from OPFS/IndexedDB and upload — this is correct behavior, it will upload the file and then overwrite `fileUrl` with the real HTTPS URL

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] Migration `20260421000001_books_file_url.sql` uses `ADD COLUMN IF NOT EXISTS` (idempotent)
- [ ] Rollback script exists at `supabase/migrations/rollback/20260421000001_books_file_url_rollback.sql`
- [ ] `Book.fileUrl?: string | null` added to `src/data/types.ts`
- [ ] `tableRegistry.ts` `books` entry: `stripFields: ['source', 'fileUrl']` and `fieldMap: { fileUrl: 'file_url' }`
- [ ] `_uploadBookFile` returns early if `book.fileUrl?.startsWith('https://')` (no re-upload)
- [ ] `_uploadBookFile` returns early if `book.source` is a remote/ABS type (no local file to upload)
- [ ] Stale `fileHandle.getFile()` errors caught silently (not `console.error`)
- [ ] Cover and file uploads in `uploadStorageFilesForTable 'books'` case are independently non-fatal
- [ ] `_downloadBookFile` checks local presence before fetching (idempotent on incremental sync)
- [ ] Signed URL fallback in download path wired correctly (reuses `_fetchWithSignedFallback`)
- [ ] No artificial size cap in download direction (AC7 large file requirement)
- [ ] `npm run test:unit -- storageSync` all pass
- [ ] `npm run test:unit -- storageDownload` all pass
- [ ] Existing `syncEngine.test.ts` passes (no regressions)
- [ ] `tableRegistry.test.ts` passes (no regressions)
- [ ] `tsc --noEmit` clean
- [ ] `npm run build` clean

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
