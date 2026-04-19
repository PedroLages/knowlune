---
title: "feat: E94-S07 Book Files Storage Integration"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e94-s07-book-files-storage-integration-requirements.md
---

# feat: E94-S07 Book Files Storage Integration

## Overview

Extends the Supabase Storage sync layer (E94-S04/S05) to upload and download the primary book binary file (EPUB, PDF, audiobook) for each `Book` record. When a user syncs on Device A, the book file is uploaded to the `book-files` Storage bucket. When they sign in on Device B, the file is downloaded to OPFS or IndexedDB so it is readable offline without re-importing.

This is a **structural peer to E94-S04** (cover upload) and **E94-S05** (file download). All patterns — `uploadStorageFilesForTable` dispatch, `downloadStorageFilesForTable` dispatch, `_fetchWithSignedFallback`, `_isSupabaseStorageUrl`, per-table handler structure — are already established and must be followed exactly.

## Problem Frame

Book files currently exist only on the importing device. `Book.source` holds the local file reference (OPFS path, FileSystemFileHandle, or remote URL). No mechanism exists to propagate the actual binary to Supabase Storage or hydrate it on a new device. This story wires the missing upload and download sides for primary book files.

(see origin: `docs/brainstorms/2026-04-19-e94-s07-book-files-storage-integration-requirements.md`)

## Requirements Trace

- R1. `books` Postgres table gains a nullable `file_url TEXT` column (AC1)
- R2. `Book` TS type gains `fileUrl?: string | null` (AC2)
- R3. `tableRegistry.ts` strips `fileUrl` from standard sync payloads; maps `fileUrl ↔ file_url` (AC3, AC8)
- R4. `storageSync.ts` gains `_uploadBookFile` with source dispatch, size limit, idempotency guard, and URL writeback (AC4, AC5, AC6)
- R5. `storageDownload.ts` gains `_downloadBookFile` with local-presence check, signed-URL fallback, and OPFS/IDB storage (AC7)
- R6. Unit tests cover all upload and download scenarios with no regressions (AC9–AC12)

## Scope Boundaries

- No UI progress indicators for upload/download
- No E2E tests — unit coverage only (AC9–AC12)
- No changes to `EpubRenderer`, `BookContentService`, or reader components
- No Supabase RLS policy changes (bucket already configured in E94-S04)
- Only the primary book file per `Book` record — audiobook clip/segment files excluded
- No change to `STORAGE_TABLES` set membership — `'books'` is already a member

### Deferred to Separate Tasks

- Upload progress UI and download progress indicators: future UX story

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/storageSync.ts` — exact handler pattern to follow for `_uploadBookFile` (mirror `_uploadPdfFile` / `_uploadAuthorPhoto` for stale-handle guard; mirror `_uploadBookCover` for Dexie + Supabase writeback)
- `src/lib/sync/storageDownload.ts` — exact handler pattern to follow for `_downloadBookFile` (mirror `_downloadPdfFile` for blob-presence check + `db.table.update`; mirror `_downloadBookCover` for `_isSupabaseStorageUrl` guard)
- `src/lib/sync/storageUpload.ts` — `uploadBlob` signature: `(bucket, path, blob, { maxSizeBytes? })` → `{ url, path }`. Size guard is exclusive (`> not >=`). Throws `RangeError` on size violation.
- `src/lib/sync/tableRegistry.ts` line ~361 — `books` entry: `stripFields: ['source']`, `fieldMap: {}` → will gain `'fileUrl'` in stripFields and `{ fileUrl: 'file_url' }` in fieldMap
- `src/data/types.ts` line 741 — `ContentSource` union: only three variants: `{ type: 'local'; opfsPath: string }`, `{ type: 'remote'; url: string; auth? }`, `{ type: 'fileHandle'; handle: FileSystemFileHandle }`. **Note: the story's AC4 mentions `type: 'abs'` but this variant does not exist; ABS books use `type: 'remote'` or have no uploadable local file.**
- `src/services/OpfsStorageService.ts` — `readBookFile(opfsPath: string, bookId: string): Promise<File | null>`, `storeBookFile(bookId: string, file: File): Promise<string>` (returns `'indexeddb'` or an OPFS path)
- `src/db/schema.ts` line ~138 — `db.bookFiles: Table<{ bookId: string; filename: string; blob: Blob }>` (IndexedDB fallback when OPFS unavailable)
- `supabase/migrations/20260420000001_chapter_mappings.sql` — canonical migration format: `BEGIN;` / DDL / RLS / trigger / `COMMIT;`, with `IF NOT EXISTS` guards, cursor index pattern

### Institutional Learnings

- **E93 Closeout Pattern 1:** Direct Supabase `.update()` after Storage upload (not via syncableWrite) — avoids generating a new sync queue entry for the URL column writeback. All existing storage handlers (`_uploadBookCover`, `_uploadPdfFile`, etc.) follow this pattern.
- **E93 Closeout Pattern 2:** `stripFields` prevents the local `source` discriminated union (with potential FileSystemFileHandle) from being serialised into the Postgres upload payload. `fileUrl` must be added to `stripFields` for the same reason: a device with `fileUrl: null` must not overwrite a valid Storage URL set by another device via the standard LWW sync path.
- **Stale handle pattern:** `_uploadAuthorPhoto` shows the exact catch-return pattern for `DOMException` on `.getFile()`. No `console.warn` — silent return only.

### External References

None needed — the codebase has 5+ direct examples of the exact pattern (`_uploadCourseThumbnail`, `_uploadAuthorPhoto`, `_uploadPdfFile`, `_uploadBookCover`, `_downloadBookCover`, `_downloadPdfFile`, `_downloadAuthorPhoto`). Pattern is well-established.

## Key Technical Decisions

- **`fileUrl` in `stripFields` and `fieldMap`, not a `vaultField`:** The story explicitly frames `fileUrl` as write-through-Storage-only. Adding it to `stripFields` prevents overwrite; adding to `fieldMap` lets the download camelCaser set it on the first table-row sync. These are independent mechanisms that work in concert.
- **`fileHandle` property name is `handle`, not `fileHandle`:** `ContentSource` union uses `{ type: 'fileHandle'; handle: FileSystemFileHandle }`. The story's AC4 says `book.source.fileHandle.getFile()` — the correct call is `book.source.handle.getFile()`. TypeScript narrowing will catch this at compile time.
- **`'remote'` source means no uploadable file:** ABS and other remote-sourced books have `source.type === 'remote'` (or no source). Both mean return-early in `_uploadBookFile`. The story mentions `type: 'abs'` as a separate variant but it does not exist in the type system.
- **IndexedDB fallback in upload:** When `source.type === 'local'`, call `opfsStorageService.readBookFile(source.opfsPath, bookId)`. The service automatically falls back to `db.bookFiles` internally when OPFS is unavailable — no need to query `db.bookFiles` directly in `_uploadBookFile`.
- **Download does NOT update `db.books.fileUrl`:** AC7 spec says leave `fileUrl` on the Dexie record as-is (it holds the remote HTTPS URL from the table sync row). Only the Dexie `books` row's `fileUrl` field is already set by the table-level download camelCaser (`fieldMap: { fileUrl: 'file_url' }`). The download handler stores the file in OPFS/IDB but does not overwrite the HTTPS URL.
- **`_uploadBookFile` placed inside the per-entry `try/catch` shared loop vs independent `try/catch`:** The story (AC5) requires cover and file uploads to be independent. Per the existing `storageSync.ts` pattern, the outer loop has a single try/catch per entry that catches all handler errors. To make cover and file independent, wrap each call in its own `try { } catch { console.warn }` block inside the `case 'books':` branch. This matches the architectural intent expressed in the implementation notes.
- **`SIZE_LIMITS` constant update:** Add `'book-files': 209_715_200` (200 MB) following the same `as const` object structure.
- **Migration filename convention:** `20260421000001_books_file_url.sql` — date `20260421` is per the story's AC1, not today's date. Use this exact filename.

## Open Questions

### Resolved During Planning

- **Does `ContentSource` have an `'abs'` variant?** No. The AC4 description mentions it, but the actual type at `src/data/types.ts:741` has only `local`, `remote`, and `fileHandle`. ABS books use `remote` or have `absItemId`/`absServerId` metadata with no local uploadable binary. Plan reflects the actual type system.
- **Does `readBookFile` already handle IDB fallback?** Yes — `OpfsStorageService.readBookFile` internally checks `this._useIndexedDBFallback` and queries `db.bookFiles` automatically. No need to duplicate this in `_uploadBookFile`.
- **Which `_downloadBookFile` pattern to follow for local presence check?** Follow `_downloadPdfFile` (check `pdf?.fileBlob`) adapted for books: check `db.bookFiles.where('bookId').equals(bookId).toArray()` for IDB rows and `opfsStorageService.readBookFile(...)` for OPFS presence.

### Deferred to Implementation

- Exact MIME type for audiobook files (`.m4b`, `.mp3`) — runtime will derive from `file.type` or `file.name` extension; the implementer handles the fallback chain
- Whether `readBookFile(source.opfsPath, bookId)` returns null for IDB-stored books when the OPFS path argument is irrelevant — tests will verify the mock behaviour

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Upload path (Device A → Supabase Storage):
  syncEngine calls uploadStorageFilesForTable('books', entries, userId)
    ├── case 'books':
    │     try { _uploadBookCover(entry, userId) } catch { console.warn }   [existing]
    │     try { _uploadBookFile(entry, userId) } catch { console.warn }   [NEW]
    │
    └── _uploadBookFile:
          1. db.books.get(entry.recordId) → null? return
          2. book.fileUrl?.startsWith('https://') → return (already uploaded)
          3. book.source.type dispatch:
               'local'      → opfsStorageService.readBookFile(source.opfsPath, bookId)
               'fileHandle' → source.handle.getFile() [catch DOMException → return]
               'remote'     → return (no local binary)
          4. file null? → return
          5. uploadBlob('book-files', `${userId}/${bookId}/${file.name}`, file, { maxSizeBytes: 209_715_200 })
          6. db.books.update(bookId, { fileUrl: result.url })
          7. supabase.from('books').update({ file_url: result.url }).eq('id', bookId).eq('user_id', userId)

Download path (Supabase Storage → Device B):
  syncEngine calls downloadStorageFilesForTable('books', records, userId)
    ├── case 'books':
    │     await _downloadBookCover(record, userId)   [existing]
    │     await _downloadBookFile(record, userId)    [NEW]
    │
    └── _downloadBookFile:
          1. record.fileUrl not a Supabase Storage URL? → return
          2. Check local presence: bookFiles rows || opfsStorageService.readBookFile(...)
          3. Any local file found? → return (idempotent)
          4. _extractStoragePath(record.fileUrl)
          5. _fetchWithSignedFallback(fileUrl, 'book-files', path)
          6. opfsStorageService.storeBookFile(bookId, new File([blob], filename, { type }))
          7. (do NOT update db.books.fileUrl — fieldMap writeback already set it)
```

## Implementation Units

- [ ] **Unit 1: SQL Migration — Add `file_url` column to `books`**

**Goal:** Idempotent migration that adds a nullable TEXT `file_url` column to `public.books`, with rollback script.

**Requirements:** R1

**Dependencies:** None (runs after existing P2 library migration)

**Files:**
- Create: `supabase/migrations/20260421000001_books_file_url.sql`
- Create: `supabase/migrations/rollback/20260421000001_books_file_url_rollback.sql`

**Approach:**
- Follow the `20260420000001_chapter_mappings.sql` format: `BEGIN;` / DDL / `COMMIT;`, with explanatory comment header, dependency note, and rollback path reference
- `ALTER TABLE public.books ADD COLUMN IF NOT EXISTS file_url TEXT;` — no index (not queried by this column)
- No RLS change, no trigger — column is written by the Storage upload handler directly via Supabase client SDK, not by syncableWrite
- Rollback: `ALTER TABLE public.books DROP COLUMN IF EXISTS file_url;`

**Patterns to follow:**
- `supabase/migrations/20260420000001_chapter_mappings.sql` — header format, BEGIN/COMMIT pattern
- `supabase/migrations/rollback/20260420000001_chapter_mappings_rollback.sql` — rollback format

**Test scenarios:**
- Test expectation: none — pure DDL, no TypeScript or test surface

**Verification:**
- `supabase/migrations/20260421000001_books_file_url.sql` uses `ADD COLUMN IF NOT EXISTS` (idempotent)
- Rollback script exists at `supabase/migrations/rollback/20260421000001_books_file_url_rollback.sql`
- No other migration already adds `file_url` to `books` (grep `file_url` in `supabase/migrations/`)

---

- [ ] **Unit 2: TypeScript Type + TableRegistry Update**

**Goal:** Add `fileUrl` to the `Book` interface, add it to `books` entry `stripFields`, and add `fileUrl: 'file_url'` to `books` entry `fieldMap`.

**Requirements:** R2, R3

**Dependencies:** Unit 1 (logical only — type change is independent of migration timing)

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/lib/sync/tableRegistry.ts`
- Test: `src/lib/sync/__tests__/tableRegistry.test.ts` (regression — must still pass)

**Approach:**
- `src/data/types.ts`: add `fileUrl?: string | null` to `Book` interface after `sourceUrl?: string | null` (line ~797). Include a comment referencing the story: `// E94-S07: Storage URL for primary book file; null until first sync upload`
- `src/lib/sync/tableRegistry.ts` `books` entry:
  - `stripFields: ['source', 'fileUrl']` — prevents null fileUrl from overwriting a valid Storage URL via standard LWW sync payload
  - `fieldMap: { fileUrl: 'file_url' }` — camelCaser maps `file_url` → `fileUrl` on download
- Run `npx tsc --noEmit` — zero type errors expected

**Patterns to follow:**
- `sourceUrl?: string | null` comment style in `src/data/types.ts` (lines 796–797)
- `stripFields: ['source']` → extend to `['source', 'fileUrl']`
- `fieldMap: {}` → `{ fileUrl: 'file_url' }` (see `sortOrder: 'position'` in `readingQueue` entry as example)

**Test scenarios:**
- Integration: `tableRegistry.test.ts` assertion that `books.stripFields` includes `'fileUrl'` and `books.fieldMap.fileUrl === 'file_url'` (add these assertions if not already present)
- Integration: existing tableRegistry tests must pass with no regressions (AC12)

**Verification:**
- `tsc --noEmit` clean after edit
- `books.stripFields` contains `'source'` and `'fileUrl'`
- `books.fieldMap.fileUrl === 'file_url'`

---

- [ ] **Unit 3: `_uploadBookFile` in `storageSync.ts`**

**Goal:** Add `_uploadBookFile(entry, userId)` handler and refactor the `'books'` case in `uploadStorageFilesForTable` to call both cover and file uploads with independent error handling.

**Requirements:** R4, R5 (upload side)

**Dependencies:** Unit 2 (`Book.fileUrl` must be typed)

**Files:**
- Modify: `src/lib/sync/storageSync.ts`
- Test: `src/lib/sync/__tests__/storageSync.test.ts`

**Approach:**
- Add `'book-files': 209_715_200` to `SIZE_LIMITS` constant (follows existing pattern)
- Implement `_uploadBookFile(entry: SyncQueueEntry, userId: string): Promise<void>`:
  1. Read `Book` from `db.books.get(entry.recordId)` — return early if null or if `book.source` is absent
  2. Idempotency guard: if `book.fileUrl?.startsWith('https://')` return early (already uploaded)
  3. Source dispatch using TypeScript narrowing:
     - `source.type === 'local'`: call `opfsStorageService.readBookFile(source.opfsPath, entry.recordId)` → `File | null`
     - `source.type === 'fileHandle'`: try `source.handle.getFile()` — catch DOMException (stale handle) → return silently
     - `source.type === 'remote'`: return early (no uploadable local binary)
  4. If resolved file is null → return early
  5. Determine `filename` from `file.name`; fallback to `'book.epub'` if empty
  6. Call `uploadBlob('book-files', \`${userId}/${entry.recordId}/${filename}\`, file, { maxSizeBytes: SIZE_LIMITS['book-files'] })`
  7. Writeback: `db.books.update(entry.recordId, { fileUrl: result.url })`
  8. Writeback: `supabase!.from('books').update({ file_url: result.url }).eq('id', entry.recordId).eq('user_id', userId)`
- Refactor `case 'books':` in the outer loop to call cover and file in **independent** `try/catch` blocks (not the shared outer loop `try/catch`):
  ```
  case 'books':
    try { await _uploadBookCover(entry, userId) } catch (err) { console.warn('[storageSync] Cover upload failed', entry.recordId, err) }
    try { await _uploadBookFile(entry, userId) } catch (err) { console.warn('[storageSync] File upload failed', entry.recordId, err) }
    break
  ```
  Note: the outer per-entry try/catch still wraps the entire switch — this is fine since the inner catches now absorb both upload errors, making the outer catch only reachable for unexpected bugs.

**Patterns to follow:**
- `_uploadAuthorPhoto` — stale handle catch-return pattern (catch block is empty, just `return`)
- `_uploadBookCover` — Dexie + Supabase writeback pattern
- `_uploadPdfFile` — FileSystemFileHandle path

**Test scenarios:**
- Happy path: book with `source.type === 'local'` → `opfsStorageService.readBookFile` called, `uploadBlob` called with `'book-files'` bucket, `db.books.update` called with result URL, Supabase `books` row updated
- Happy path: book with `source.type === 'fileHandle'` → `source.handle.getFile()` called, blob uploaded, URL written back
- Edge case: book with `fileUrl` already starting with `'https://'` → `uploadBlob` NOT called, no Dexie/Supabase update
- Edge case: book with `fileUrl === 'indexeddb'` → upload proceeds (the `https://` guard does not block it), `readBookFile` called
- Edge case: `source.type === 'remote'` → return early, no upload
- Edge case: no Dexie record for entry → return early, no upload
- Error path: `source.type === 'fileHandle'` and `handle.getFile()` throws `DOMException` → upload skipped silently, no error thrown or logged
- Error path: file exceeds 200 MB → `uploadBlob` throws `RangeError` — caught by the inner `try/catch`; `console.warn` emitted; does NOT rethrow; no Dexie/Supabase update
- Integration (independence): cover upload throws → file upload still attempted (and vice versa); outer loop proceeds to next entry

**Verification:**
- `tsc --noEmit` clean
- `npm run test:unit -- storageSync` all pass (including existing cover/course/author/pdf tests)
- Independent error handling verified: throwing in `_uploadBookCover` does not prevent `_uploadBookFile` from running

---

- [ ] **Unit 4: `_downloadBookFile` in `storageDownload.ts`**

**Goal:** Add `_downloadBookFile(record, userId)` handler and extend the `'books'` dispatch to call it after cover download.

**Requirements:** R5 (download side)

**Dependencies:** Unit 2 (`Book.fileUrl` typed), Unit 1 (migration, for Supabase column to exist)

**Files:**
- Modify: `src/lib/sync/storageDownload.ts`
- Test: `src/lib/sync/__tests__/storageDownload.test.ts`

**Approach:**
- Implement `_downloadBookFile(record: Record<string, unknown>, _userId: string): Promise<void>`:
  1. Guard: `const fileUrl = record['fileUrl'] as string | undefined` — return early if falsy or `!_isSupabaseStorageUrl(fileUrl)`
  2. `const bookId = record['id'] as string`
  3. Local presence check A: `db.bookFiles.where('bookId').equals(bookId).toArray()` — if any rows exist, return early (file already in IDB)
  4. Local presence check B: `opfsStorageService.readBookFile(\`/knowlune/books/${bookId}\`, bookId)` — if non-null, return early (file already in OPFS)
  5. `const pathInfo = _extractStoragePath(fileUrl)` — return if null (malformed URL)
  6. `const blob = await _fetchWithSignedFallback(fileUrl, pathInfo.bucket, pathInfo.path)`
  7. Determine `filename` from last URL segment: `decodeURIComponent(fileUrl.split('/').pop() ?? 'book.epub')`
  8. `await opfsStorageService.storeBookFile(bookId, new File([blob], filename, { type: blob.type }))`
  9. Do NOT update `db.books.fileUrl` — the `fieldMap: { fileUrl: 'file_url' }` from Unit 2 already sets it via the table-row sync path to the remote HTTPS URL
- Extend `case 'books':` dispatch:
  ```
  case 'books':
    await _downloadBookCover(record, userId)  // existing
    await _downloadBookFile(record, userId)   // NEW
    break
  ```
  Both are wrapped by the existing per-record `try/catch` in the outer loop.

**Patterns to follow:**
- `_downloadPdfFile` — `_isSupabaseStorageUrl` guard + `db.table.get` presence check + `db.table.update` writeback
- `_downloadBookCover` — `opfsStorageService` usage, `_extractStoragePath` + `_fetchWithSignedFallback` chain
- `_isSupabaseStorageUrl` and `_extractStoragePath` are module-private — use directly within the same file

**Test scenarios:**
- Happy path: `record.fileUrl` is a Supabase Storage URL, no local IDB rows, OPFS not present → `_fetchWithSignedFallback` called (implicitly via fetch mock), `opfsStorageService.storeBookFile` called with `File` object, `db.books.update` NOT called
- Edge case: `record.fileUrl` is null → download skipped entirely
- Edge case: `record.fileUrl` starts with `'opfs://'` (not a Supabase URL) → download skipped
- Edge case: `db.bookFiles` rows already exist for `bookId` → fetch NOT called (local presence check)
- Error path: `fetch` returns 403 → `_fetchWithSignedFallback` attempts signed URL fallback → if signed URL succeeds, `storeBookFile` called; if signed URL also fails, error thrown and caught by outer per-record try/catch (non-fatal)
- Integration (non-fatality): `storeBookFile` throws (quota exceeded) → outer try/catch absorbs; next record processed normally; `console.warn` emitted by outer loop

**Verification:**
- `tsc --noEmit` clean
- `npm run test:unit -- storageDownload` all pass (including existing cover/course/author/pdf tests — AC11)

---

- [ ] **Unit 5: Final Verification**

**Goal:** Confirm all quality gates pass end-to-end after all units land.

**Requirements:** R6 (AC9–AC12)

**Dependencies:** Units 1–4

**Files:**
- No new files — runs existing test suite + build

**Approach:**
- `npm run test:unit` — all unit tests pass, zero regressions across storageSync, storageDownload, tableRegistry, syncEngine test suites
- `npx tsc --noEmit` — zero TypeScript errors
- `npm run lint` — zero new ESLint errors
- `npm run build` — clean production build

**Test scenarios:**
- Test expectation: none — this unit is verification only, not feature-bearing

**Verification:**
- All four test files (`storageSync.test.ts`, `storageDownload.test.ts`, `tableRegistry.test.ts`, `syncEngine.test.ts`) pass with zero failures

## System-Wide Impact

- **Interaction graph:** `uploadStorageFilesForTable` is called by the sync engine post-batch. The `'books'` case now has two independent upload phases (cover + file). Any caller of `uploadStorageFilesForTable` gets the new behaviour automatically — no additional wiring needed.
- **Error propagation:** Both upload handlers are try/caught independently inside `case 'books':`. The outer per-entry try/catch remains. Failures are `console.warn` non-fatal — same as all other storage handlers in E94.
- **State lifecycle risks:** `fileUrl` is write-through-Storage-only (stripped from standard sync payload). The only device that can set a valid `https://` `fileUrl` on Supabase is the one that completed the Storage upload. Other devices receive the value via the download table-row sync, where `fieldMap: { fileUrl: 'file_url' }` camelCases it correctly.
- **API surface parity:** `STORAGE_TABLES` already includes `'books'`. `STORAGE_DOWNLOAD_TABLES` already includes `'books'`. No set membership change needed.
- **Integration coverage:** The interaction between `fieldMap: { fileUrl: 'file_url' }` (table-row sync sets remote URL on Dexie) and `storeBookFile` (download handler stores the actual binary) requires that the table-row sync runs before the storage download handler. The sync engine already applies table rows first, then calls `downloadStorageFilesForTable` — this ordering invariant is preserved.
- **Unchanged invariants:** `_uploadBookCover`, `_downloadBookCover`, and all other storage handlers are unchanged in behavior. The `books` case refactor only adds independent wrapping for the cover call — behaviour of `_uploadBookCover` itself is not altered.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `ContentSource.fileHandle` uses `handle` property, not `fileHandle` | TypeScript narrowing in `_uploadBookFile` will catch at compile time — `tsc --noEmit` after Unit 3 is mandatory |
| Cover + file upload independence broken by outer try/catch swallowing both | Per-unit tests assert that a throwing cover handler does not prevent file handler from running (Unit 3 integration test) |
| Download handler overwrites Dexie `fileUrl` with OPFS path, breaking remote URL reference | Decision: do NOT call `db.books.update` in `_downloadBookFile`. Verified via Unit 4 test asserting `mockBooksUpdate` NOT called |
| `readBookFile(opfsPath, bookId)` returns null for IDB-stored files when `opfsPath` is irrelevant | `opfsStorageService` internally queries `db.bookFiles` by `bookId` — works regardless of `opfsPath` value. Unit 3 happy-path test verifies file is resolved |
| Migration `20260421000001` conflicts with an existing file | Grep `file_url` in `supabase/migrations/` before writing (Unit 1 verification step) |
| `fileUrl: 'indexeddb'` on a Dexie record (set by prior `storeBookFile` call) incorrectly skips upload | The `startsWith('https://')` guard explicitly does NOT match `'indexeddb'` — upload proceeds correctly. Unit 3 edge-case test covers this |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e94-s07-book-files-storage-integration-requirements.md](docs/brainstorms/2026-04-19-e94-s07-book-files-storage-integration-requirements.md)
- **BMAD story:** [docs/implementation-artifacts/stories/E94-S07-book-files-storage-integration.md](docs/implementation-artifacts/stories/E94-S07-book-files-storage-integration.md)
- Related code: `src/lib/sync/storageSync.ts`, `src/lib/sync/storageDownload.ts`, `src/lib/sync/storageUpload.ts`
- Related code: `src/lib/sync/tableRegistry.ts` (books entry, ~line 361)
- Related code: `src/services/OpfsStorageService.ts` (readBookFile, storeBookFile)
- Related code: `src/data/types.ts` (ContentSource union, Book interface)
- Related code: `src/db/schema.ts` (bookFiles table definition)
- Prior E94 stories: E94-S04 (cover upload), E94-S05 (file download), E94-S06 (chapter mappings)
