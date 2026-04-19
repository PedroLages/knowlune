# Requirements: E94-S07 Book Files Storage Integration

## Origin
BMAD story: `docs/implementation-artifacts/stories/E94-S07-book-files-storage-integration.md`

## Problem / Goal
Learners import EPUB, PDF, and audiobook files locally. When sync runs, those binary files must be uploaded to Supabase Storage (`book-files` bucket) so a second device can download them automatically on sign-in — without re-importing.

## Context & Dependencies
- Epic E94: Supabase Storage sync layer
- E94-S04 introduced `_uploadBookCover` for the `'books'` case in `storageSync.ts` and the `book-files` Storage bucket (`supabase/storage-setup.sql`)
- E94-S05 introduced `storageDownload.ts` with `_downloadBookCover`, signed-URL fallback, and `_fetchWithSignedFallback`
- E94-S06 added `chapter-mappings` sync; unrelated but same sprint
- Sync engine (E92): `syncableWrite`, `SyncQueueEntry`, `tableRegistry.ts`, `uploadStorageFilesForTable`, `STORAGE_TABLES`
- `Book.source` discriminated union already exists in `src/data/types.ts`
- `opfsStorageService.readBookFile` / `storeBookFile` exist in `src/services/OpfsStorageService.ts`
- `uploadBlob` helper exists in `storageSync.ts`

## Acceptance Criteria (summary)

**AC1** — SQL migration `supabase/migrations/20260421000001_books_file_url.sql` adds nullable TEXT column `file_url` to `public.books`; rollback script drops it.

**AC2** — `Book` TypeScript type in `src/data/types.ts` gets `fileUrl?: string | null` after `sourceUrl`.

**AC3** — `tableRegistry.ts` `books` entry adds `'fileUrl'` to `stripFields` (prevents null overwriting a valid Storage URL in standard sync payloads).

**AC4** — `src/lib/sync/storageSync.ts` gains `_uploadBookFile(entry, userId)`:
- Reads `Book` from Dexie; returns early if null, if `fileUrl` already starts with `https://` (no re-upload), or if source has no local file (remote/ABS)
- Resolves file: `source.type === 'local'` → `opfsStorageService.readBookFile`; `source.type === 'fileHandle'` → `.getFile()` with DOMException catch; IndexedDB fallback via `db.bookFiles`
- 200 MB size limit enforced via `maxSizeBytes: 209_715_200`
- After upload: writes `fileUrl` back to Dexie `db.books.update` and Supabase `books.file_url`

**AC5** — `uploadStorageFilesForTable 'books'` case calls `_uploadBookCover` then `_uploadBookFile` in independent try/catch blocks — neither failure blocks the other.

**AC6** — Covered in AC4: `https://` prefix guard prevents re-upload.

**AC7** — `storageDownload.ts` gains `_downloadBookFile(record, userId)`:
- Guards: `fileUrl` must exist and be a Supabase Storage URL
- Checks local presence (IndexedDB rows + OPFS); skips if already present
- Fetches via `_fetchWithSignedFallback`; stores via `opfsStorageService.storeBookFile`
- No size cap on download; non-fatal (wrapped in outer try/catch)
- Does NOT overwrite `db.books.fileUrl` — preserves remote HTTPS URL on the Dexie record

**AC8** — `tableRegistry.ts` `books` `fieldMap` gets `fileUrl: 'file_url'` so download sync correctly camelCases the column.

**AC9 / AC10 / AC11 / AC12** — Unit tests in `storageSync.test.ts` and `storageDownload.test.ts` cover all upload/download variants; existing tests pass with no regressions.

## Out of Scope
- UI progress indicators for upload/download (deferred — E94-S06/E94-S04 UX not in scope)
- E2E tests (unit coverage only per AC9–AC12)
- Changes to `EpubRenderer`, `BookContentService`, or any reader component
- Supabase RLS policy changes (bucket already configured in E94-S04)
- Upload of audiobook clip/segment files (only primary book file per book record)

## Key Risks
1. **Stale fileHandle** — must catch DOMException silently; any throw here would abort the whole sync entry
2. **Large files (up to 200 MB)** — `uploadBlob` size guard must throw `RangeError` cleanly; outer try/catch must not rethrow
3. **`fileUrl: 'indexeddb'`** — the `https://` guard correctly allows re-upload in this case; test must verify this
4. **Cover + file upload independence** — refactoring the `'books'` case from a single try/catch to dual independent try/catch is a surgical change; must not regress cover upload behavior
5. **Download non-fatality** — if `storeBookFile` throws (e.g., quota exceeded), the per-record try/catch must absorb it silently

## Files Likely Touched
- `supabase/migrations/20260421000001_books_file_url.sql` (new)
- `supabase/migrations/rollback/20260421000001_books_file_url_rollback.sql` (new)
- `src/data/types.ts` — `Book.fileUrl`
- `src/lib/sync/tableRegistry.ts` — `stripFields`, `fieldMap`
- `src/lib/sync/storageSync.ts` — `_uploadBookFile`, refactor `'books'` case
- `src/lib/sync/storageDownload.ts` — `_downloadBookFile`, extend `'books'` dispatch
- `src/lib/sync/__tests__/storageSync.test.ts` — new test cases
- `src/lib/sync/__tests__/storageDownload.test.ts` — new test cases
