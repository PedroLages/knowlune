---
story_id: E94-S05
story_name: "File Download on New Device"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 94.05: File Download on New Device

## Story

As a learner who signs in on a new device,
I want my course thumbnails, author photos, PDF files, and book covers downloaded automatically from Supabase Storage into the browser's local storage (OPFS / IndexedDB),
so that these binary assets are immediately available without me having to re-import them.

## Acceptance Criteria

**AC1 — `src/lib/sync/storageDownload.ts` module created:**
Exports a single orchestrator function:
```ts
export async function downloadStorageFilesForTable(
  tableName: string,
  records: Record<string, unknown>[],
  userId: string,
): Promise<void>
```
Called by the download phase of the sync engine after a batch of rows is applied to Dexie (i.e., after `_applyRecord` loop for that table). Non-fatal: each per-record download is independently try/caught; a single failure must not abort the rest. Only the 4 file-bearing tables trigger download logic: `importedCourses`, `authors`, `importedPdfs`, `books`. All other tables are silently ignored.

**AC2 — Course thumbnail download:**
For each `importedCourses` record whose `thumbnailUrl` is a Supabase Storage URL (starts with `https://` and includes `storage.supabase.co` or the configured Supabase host):
- Fetch the image blob via `fetch(record.thumbnailUrl)`
- Store it in `db.courseThumbnails.put({ courseId: record.id, blob, source: 'server', createdAt: new Date().toISOString() })`
- Only download if the local `db.courseThumbnails.get(record.id)` record is absent OR the server record's `updatedAt` is newer than the local `courseThumbnails` entry's `createdAt`
- Skip silently if fetch fails (network error, 403, etc.)

**AC3 — Author photo download:**
For each `authors` record whose `photoUrl` is a Supabase Storage URL:
- Fetch the image blob
- Store it in `db.authors` — NOT as a separate blob table; update the `photoBlob` field on the Dexie author record (new field, type `Blob | undefined`)
- `photoHandle` (FileSystemFileHandle) is a device-local construct and remains untouched — photo download stores a blob instead, not a handle
- Only download if `photoBlob` is absent on the local author record
- Skip silently if fetch fails

**AC4 — PDF file download:**
For each `importedPdfs` record whose `fileUrl` is a Supabase Storage URL:
- Fetch the PDF blob
- Store it in `db.importedPdfs` — update a new `fileBlob` field (type `Blob | undefined`) on the record; do NOT create a FileSystemFileHandle (requires user interaction)
- Only download if `fileBlob` is absent on the local PDF record
- Skip silently if fetch fails
- Large PDFs (>100 MB) are expected: do not apply an artificial size cap in the download direction. Browser fetch handles streaming.

**AC5 — Book cover download:**
For each `books` record whose `coverUrl` is a Supabase Storage URL:
- Fetch the cover image blob
- Store it via `opfsStorageService.storeCoverFile(bookId, new File([blob], 'cover.jpg', { type: 'image/jpeg' }))`
- Update `db.books` record: set `coverUrl` to `opfs-cover://${bookId}` so the existing `useBookCoverUrl` hook resolves it correctly
- Only download if the current `coverUrl` is NOT already `opfs-cover://` or `opfs://` prefixed (local cover already present)
- Skip silently if fetch or OPFS write fails

**AC6 — Signed URL generation for private buckets:**
All 4 Storage buckets (`course-thumbnails`, `avatars`, `pdfs`, `book-covers`) are private (RLS enforced). The stored URL (from E94-S04 upload) is a public URL that requires the authenticated Supabase client to access it. If a fetch attempt returns 403/401, generate a signed URL via:
```ts
const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600)
```
Then retry the fetch with the signed URL. The storage path can be extracted from the public URL by stripping the Supabase project prefix. Wrap this fallback in try/catch — if signed URL generation fails, skip silently.

**AC7 — Download triggered from `_doDownload` in `syncEngine.ts`:**
After the `_applyRecord` loop for a table, and only for file-bearing tables (`STORAGE_DOWNLOAD_TABLES`), call:
```ts
await downloadStorageFilesForTable(entry.dexieTable, recordsToApply, _userId).catch(err => {
  console.warn('[syncEngine] Storage download failed for', entry.dexieTable, err)
})
```
`STORAGE_DOWNLOAD_TABLES` is a `Set` exported from `storageDownload.ts`: `new Set(['importedCourses', 'authors', 'importedPdfs', 'books'])`.

**AC8 — No duplicate downloads on existing data:**
Before fetching any blob, check local presence (see AC2–AC5). If the asset already exists locally, skip the download. This prevents redundant network calls on incremental sync cycles after the first sync.

**AC9 — Dexie schema additions:**
- `authors` table: add `photoBlob?: Blob` field (no new index needed — query by `id`)
- `importedPdfs` table: add `fileBlob?: Blob` field (no new index needed)
- Increment Dexie version number if fields are added to existing tables
- Update `src/db/__tests__/schema.test.ts` to reflect schema changes

**AC10 — Unit tests cover storageDownload module:**
New test file `src/lib/sync/__tests__/storageDownload.test.ts`:
- Course with `thumbnailUrl` (Supabase URL, no local thumb) → fetch called, `db.courseThumbnails.put` called
- Course with `thumbnailUrl` but local thumb already exists and is same age → fetch NOT called
- Author with `photoUrl` (Supabase URL, no local `photoBlob`) → fetch called, `db.authors.update` called with blob
- PDF with `fileUrl` (Supabase URL, no local `fileBlob`) → fetch called, `db.importedPdfs.update` called with blob
- Book with `coverUrl` (Supabase URL, no local OPFS cover) → fetch called, `opfsStorageService.storeCoverFile` called, `db.books.update` called
- Book with `coverUrl` already `opfs-cover://xxx` → fetch NOT called
- Fetch returns 403 → signed URL fallback attempted → if signed URL fetch succeeds, blob stored
- Supabase client null → function returns early without error
- Network error during fetch → record skipped silently; no thrown error propagates

**AC11 — Integration: existing `syncEngine.test.ts` passes without regressions.**
The new `downloadStorageFilesForTable` call in `_doDownload` must be covered by at least a smoke test: download phase for an `importedCourses` record triggers download orchestration.

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/sync/storageDownload.ts` (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [ ] 1.1 Export `STORAGE_DOWNLOAD_TABLES: Set<string>` = `new Set(['importedCourses', 'authors', 'importedPdfs', 'books'])`
  - [ ] 1.2 Implement `downloadStorageFilesForTable(tableName, records, userId): Promise<void>`
    - Guard: `if (!supabase || !STORAGE_DOWNLOAD_TABLES.has(tableName)) return`
    - For each record, dispatch to the per-table handler inside a try/catch; on error: `console.warn(...)` and continue
  - [ ] 1.3 Implement `_downloadCourseThumbnail(record, userId)`:
    - Extract `record.thumbnailUrl` (string | undefined)
    - If not a Supabase storage URL → return early
    - Check local: `const existing = await db.courseThumbnails.get(record.id)`
    - Skip if existing and `existing.createdAt >= record.updatedAt` (server not newer)
    - Fetch blob (with signed URL fallback on 403/401 — see AC6 helper)
    - `await db.courseThumbnails.put({ courseId: record.id, blob, source: 'server', createdAt: record.updatedAt ?? new Date().toISOString() })`
  - [ ] 1.4 Implement `_downloadAuthorPhoto(record, userId)`:
    - Extract `record.photoUrl`; guard for Supabase storage URL
    - Check local: `const author = await db.authors.get(record.id)` — skip if `author?.photoBlob`
    - Fetch blob (with fallback); `await db.authors.update(record.id, { photoBlob: blob })`
  - [ ] 1.5 Implement `_downloadPdfFile(record, userId)`:
    - Extract `record.fileUrl`; guard for Supabase storage URL
    - Check local: `const pdf = await db.importedPdfs.get(record.id)` — skip if `pdf?.fileBlob`
    - Fetch blob (large fetch — no timeout override, use default browser fetch); `await db.importedPdfs.update(record.id, { fileBlob: blob })`
  - [ ] 1.6 Implement `_downloadBookCover(record, userId)`:
    - Extract `record.coverUrl`; guard for Supabase storage URL
    - Check local: skip if current `record.coverUrl` already starts with `opfs-cover://` or `opfs://`
    - Additionally check Dexie `db.books.get(record.id)` — if local record's `coverUrl` is opfs-prefixed → skip
    - Fetch blob; `await opfsStorageService.storeCoverFile(record.id, new File([blob], 'cover.jpg', { type: blob.type || 'image/jpeg' }))`
    - `await db.books.update(record.id, { coverUrl: \`opfs-cover://${record.id}\` })`
  - [ ] 1.7 Implement `_fetchWithSignedFallback(url, bucket, storagePath, userId): Promise<Blob>`:
    - `const response = await fetch(url)`
    - If `response.ok` → return `response.blob()`
    - If `response.status === 401 || response.status === 403`:
      - `const { data } = await supabase!.storage.from(bucket).createSignedUrl(storagePath, 3600)`
      - If `data?.signedUrl` → `const r2 = await fetch(data.signedUrl)` → if ok return `r2.blob()`
    - Throw on unrecoverable error (caller's try/catch handles)
  - [ ] 1.8 Implement `_isSupabaseStorageUrl(url: string): boolean`:
    - Returns true when `url.startsWith('https://')` AND (`url.includes('supabase.co/storage') || url.includes(import.meta.env.VITE_SUPABASE_URL)`)
    - Handles both hosted Supabase (`.supabase.co`) and self-hosted (custom domain from env)
  - [ ] 1.9 Implement `_extractStoragePath(publicUrl: string): { bucket: string; path: string } | null`:
    - Pattern: `https://{host}/storage/v1/object/public/{bucket}/{path}`
    - Returns `{ bucket, path }` or null if pattern doesn't match
    - Used to derive bucket and path for `createSignedUrl` fallback
  - [ ] 1.10 Run `npx tsc --noEmit` — zero type errors

- [ ] Task 2: Update Dexie schema for new blob fields (AC: 9)
  - [ ] 2.1 Open `src/db/schema.ts` — locate `authors` table type / schema definition
  - [ ] 2.2 Add `photoBlob?: Blob` to the `ImportedAuthor` type in `src/data/types.ts` (or schema.ts if types are co-located)
  - [ ] 2.3 Open `importedPdfs` table type — add `fileBlob?: Blob` to `ImportedPdf` type
  - [ ] 2.4 Increment Dexie version in `src/db/schema.ts`:
    - New version block must NOT change existing index definitions (adding optional fields to an existing table does not require index changes)
    - Confirm the upgrade callback is empty (no data migration needed — new fields are optional)
  - [ ] 2.5 Update `src/db/__tests__/schema.test.ts` — add tests for presence of new version and field accessibility
  - [ ] 2.6 Run `npx tsc --noEmit` — confirm no type errors on new fields

- [ ] Task 3: Wire `storageDownload.ts` into `syncEngine.ts` `_doDownload` (AC: 7, 11)
  - [ ] 3.1 Import `{ downloadStorageFilesForTable, STORAGE_DOWNLOAD_TABLES }` from `'./storageDownload'` at top of `syncEngine.ts`
  - [ ] 3.2 In `_doDownload`, after the `_applyRecord` loop for each table entry, add:
    ```ts
    if (STORAGE_DOWNLOAD_TABLES.has(entry.dexieTable) && _userId) {
      await downloadStorageFilesForTable(entry.dexieTable, recordsToApply, _userId).catch(err => {
        console.warn('[syncEngine] Storage download failed for', entry.dexieTable, err)
      })
    }
    ```
    Insert AFTER the `maxUpdatedAt` cursor update and BEFORE the `refreshFn` call — store refresh happens last so the UI sees fresh data after blobs are written.
  - [ ] 3.3 Run existing `syncEngine.test.ts` — zero regressions
  - [ ] 3.4 Run `npx tsc --noEmit` — zero type errors

- [ ] Task 4: Write unit tests for `storageDownload.ts` (AC: 10)
  - [ ] 4.1 Create `src/lib/sync/__tests__/storageDownload.test.ts`
  - [ ] 4.2 Mock `@/lib/auth/supabase` (storage.createSignedUrl), `@/db` (db.courseThumbnails, db.authors, db.importedPdfs, db.books), `@/services/OpfsStorageService` (storeCoverFile), and global `fetch`
  - [ ] 4.3 Write all tests specified in AC10 (9 scenarios)
  - [ ] 4.4 Run `npm run test:unit -- storageDownload` — all pass

- [ ] Task 5: Final verification
  - [ ] 5.1 `npm run test:unit` — all unit tests pass
  - [ ] 5.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 5.3 `npm run lint` — zero new ESLint warnings/errors
  - [ ] 5.4 `npm run build` — clean build
  - [ ] 5.5 Manual smoke test: sign in on a second browser profile (simulating new device), trigger `fullSync`, observe console — verify `[syncEngine] Storage download...` logs appear and images resolve in the UI

## Implementation Notes

### Download Architecture Decision

Downloads are triggered from the **download phase**, not the upload phase. The sequence per table in `_doDownload` is:
1. Fetch rows from Supabase (incremental, cursor-based)
2. Apply rows to Dexie (LWW / conflict strategy)
3. **NEW:** Download binary assets for applied rows → store in Dexie/OPFS

This keeps Storage downloads co-located with row downloads. They run per table-batch, not per record in isolation.

### Why `photoBlob` and `fileBlob` Not Separate Tables

`courseThumbnails` already uses a dedicated Dexie table (separate from `importedCourses`) because E83 established that pattern. However, `photoBlob` on `authors` and `fileBlob` on `importedPdfs` are added as optional fields on the existing records rather than new tables — consistency with `opfsStorageService` which handles books, and avoidance of new cross-table joins. The blob fields are not uploaded to Supabase (stripped by `stripFields` — note: `storageSync.ts` upload path does not touch these fields, only `photoHandle` and `fileHandle`).

### `_isSupabaseStorageUrl` Heuristic

The check must tolerate self-hosted Supabase (custom domain from `VITE_SUPABASE_URL`) and hosted Supabase (`*.supabase.co`). Detect by checking both. Do not regex-match the full path — just the domain presence is sufficient.

### Signed URL Fallback (AC6)

Private bucket RLS allows authenticated reads. The public URL returned by `getPublicUrl()` in storageUpload.ts actually requires authentication on a private bucket — an unauthenticated fetch will return 403. The signed URL created with `createSignedUrl(path, 3600)` adds a 1-hour token to the URL and bypasses RLS at the CDN layer. Always try the public URL first (may work in the same session) and fall back to signed URL only on 4xx.

### OPFS Book Cover Integration

`opfsStorageService.storeCoverFile(bookId, file)` is the existing E83 API. After storing, the `coverUrl` on the Dexie `books` record must be updated to `opfs-cover://${bookId}` — this is the URL scheme that `useBookCoverUrl` resolves. Without this update, the UI would try to fetch the now-stale remote URL on every render.

### `stripFields` and New Blob Fields

`photoBlob` and `fileBlob` must NOT be uploaded to Supabase. Confirm `tableRegistry.ts` entries for `authors` and `importedPdfs` include these in `stripFields`. If not present, add them in this story.

### Supabase Client Null Guard

`storageDownload.ts` imports `supabase` from `@/lib/auth/supabase`. Guard at the top of `downloadStorageFilesForTable`: `if (!supabase) return`. Same pattern as `storageUpload.ts` and `storageSync.ts`.

## Testing Notes

### Mock Pattern for fetch

```ts
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  blob: vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' })),
})
```

For 403 fallback tests:
```ts
global.fetch = vi.fn()
  .mockResolvedValueOnce({ ok: false, status: 403 })   // public URL fails
  .mockResolvedValueOnce({ ok: true, blob: ... })        // signed URL succeeds
```

### Edge Cases to Test

1. `thumbnailUrl` is null → skip (no crash)
2. `thumbnailUrl` is a non-Supabase URL (e.g. Unsplash) → skip (not a storage URL)
3. `userId` is empty string → guard and return early (don't attempt signed URL with bad params)
4. OPFS unavailable → `opfsStorageService.storeCoverFile` uses IndexedDB fallback — no crash
5. Concurrent downloads of same record (two download cycles overlap) — `db.update` is idempotent

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] `supabase` null guard at top of `downloadStorageFilesForTable`
- [ ] Per-record try/catch in all download loops — one failure must not abort the rest
- [ ] `photoBlob` and `fileBlob` added to `stripFields` in `tableRegistry.ts` for their respective tables
- [ ] Book cover: `db.books.update` called to set `coverUrl` to `opfs-cover://...` after OPFS write
- [ ] No size cap applied in download direction for PDFs (AC4)
- [ ] `_extractStoragePath` correctly parses both `supabase.co` and self-hosted URLs
- [ ] `STORAGE_DOWNLOAD_TABLES` exported and used in `syncEngine.ts`
- [ ] Dexie version incremented if schema changed
- [ ] `schema.test.ts` updated
- [ ] `tsc --noEmit` clean
- [ ] `npm run test:unit -- storageDownload` all pass
- [ ] `syncEngine.test.ts` no regressions (Task 3.3)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
