# Requirements: E94-S05 — File Download on New Device

**Source:** BMAD story `docs/implementation-artifacts/stories/E94-S05-file-download-on-new-device.md`
**Date:** 2026-04-19
**Epic context:** E94 — Library Sync (Supabase Storage). E94-S04 adds upload of binary assets from OPFS → Supabase Storage. This story adds the complementary download side: when a user signs in on a new device, binary files associated with synced rows (thumbnails, author photos, PDFs, book covers) are fetched from Supabase Storage and stored locally in OPFS/Dexie.

---

## Problem Statement

After E94-S04, binary assets (course thumbnails, author photos, PDF files, book covers) are uploaded to Supabase Storage during sync. However, the download phase (`_doDownload` in `syncEngine.ts`) only pulls Postgres row metadata — no binary files. On a new device, row data (e.g., `thumbnail_url`) arrives correctly but the referenced blob is absent from local storage. UI shows broken images or stale placeholders.

---

## User Story

As a learner who signs in on a new device,  
I want my course thumbnails, author photos, PDF files, and book covers downloaded automatically from Supabase Storage into the browser's local storage (OPFS / IndexedDB),  
so that these binary assets are immediately available without me having to re-import them.

---

## Acceptance Criteria (Extracted from BMAD Story)

### AC1 — `storageDownload.ts` module
New file `src/lib/sync/storageDownload.ts`. Exports:
- `STORAGE_DOWNLOAD_TABLES: Set<string>` = `new Set(['importedCourses', 'authors', 'importedPdfs', 'books'])`
- `downloadStorageFilesForTable(tableName: string, records: Record<string, unknown>[], userId: string): Promise<void>`

The orchestrator is non-fatal: per-record errors are caught, logged as `console.warn`, and skipped. Other tables silently ignored.

### AC2 — Course thumbnail download
For `importedCourses` records with a Supabase Storage `thumbnailUrl`:
- Fetch blob; store in `db.courseThumbnails.put({ courseId, blob, source: 'server', createdAt: record.updatedAt })`
- Skip if local thumb exists and is >= server `updatedAt`
- Skip silently on network failure

### AC3 — Author photo download
For `authors` records with a Supabase Storage `photoUrl`:
- Fetch blob; `db.authors.update(id, { photoBlob: blob })`
- Skip if local `photoBlob` already present
- `photoHandle` (FileSystemFileHandle) is device-local — untouched

### AC4 — PDF file download
For `importedPdfs` records with a Supabase Storage `fileUrl`:
- Fetch blob (no size cap — large PDFs expected); `db.importedPdfs.update(id, { fileBlob: blob })`
- Skip if local `fileBlob` present
- Do NOT create a `FileSystemFileHandle` (requires user interaction)

### AC5 — Book cover download
For `books` records with a Supabase Storage `coverUrl`:
- Fetch blob; `opfsStorageService.storeCoverFile(bookId, new File([blob], 'cover.jpg', ...))`
- `db.books.update(bookId, { coverUrl: \`opfs-cover://${bookId}\` })` — required for `useBookCoverUrl` hook
- Skip if local `coverUrl` already starts with `opfs-cover://` or `opfs://`

### AC6 — Signed URL fallback for private buckets
On 401/403 response from public URL fetch:
1. Extract `{bucket, path}` from public URL via `_extractStoragePath()`
2. `supabase.storage.from(bucket).createSignedUrl(storagePath, 3600)`
3. Retry fetch with signed URL
4. Fail silently if signed URL generation also fails

### AC7 — Wired into `syncEngine._doDownload`
After `_applyRecord` loop per table, before `refreshFn` call:
```ts
if (STORAGE_DOWNLOAD_TABLES.has(entry.dexieTable) && _userId) {
  await downloadStorageFilesForTable(entry.dexieTable, recordsToApply, _userId).catch(err =>
    console.warn('[syncEngine] Storage download failed for', entry.dexieTable, err)
  )
}
```

### AC8 — No duplicate downloads
Local-presence checks (per AC2–AC5) prevent redundant fetches on incremental sync cycles.

### AC9 — Dexie schema additions
- `ImportedAuthor` type: add `photoBlob?: Blob`
- `ImportedPdf` type: add `fileBlob?: Blob`
- Increment Dexie version (no index changes needed — optional fields)
- `src/db/__tests__/schema.test.ts` updated

### AC10 — Unit tests (9 scenarios)
File: `src/lib/sync/__tests__/storageDownload.test.ts`
1. Course: URL present, no local thumb → fetch + put called
2. Course: URL present, local thumb same age → fetch NOT called
3. Author: URL present, no `photoBlob` → fetch + update called
4. PDF: URL present, no `fileBlob` → fetch + update called
5. Book: Supabase URL, no local cover → fetch + storeCoverFile + update called
6. Book: `opfs-cover://` already → fetch NOT called
7. Fetch 403 → signed URL fallback → if signed URL ok → blob stored
8. `supabase` is null → return early, no crash
9. Network error during fetch → record skipped silently, no thrown error

### AC11 — `syncEngine.test.ts` no regressions
Plus at least one smoke test: download cycle for `importedCourses` triggers download orchestration.

---

## Dependencies & Context

### Files to read before implementing
| File | Relevance |
|---|---|
| `src/lib/sync/storageSync.ts` | Upload peer — mirrors pattern for download |
| `src/lib/sync/storageUpload.ts` | `uploadBlob` — understand upload side; `_isSupabaseStorageUrl` analogous helper needed |
| `src/lib/sync/syncEngine.ts` | `_doDownload` — insertion point for AC7 |
| `src/lib/sync/tableRegistry.ts` | `stripFields` — `photoBlob`/`fileBlob` must be added if absent |
| `src/services/OpfsStorageService.ts` | `storeCoverFile(bookId, file)` API for AC5 |
| `src/db/schema.ts` | Dexie version + table definitions for AC9 |
| `src/data/types.ts` | `ImportedAuthor`, `ImportedPdf`, `Book` types for AC9 |
| `src/lib/sync/__tests__/storageSync.test.ts` | Test mock pattern to follow |

### What E94-S04 established (do not re-implement)
- `uploadBlob()` in `storageUpload.ts` — upload utility (no download equivalent needed; direct `fetch()` used instead)
- `storageSync.ts` — upload orchestration per table (download mirrors this pattern)
- `STORAGE_TABLES` set in `storageSync.ts` — export for `syncEngine.ts` upload gate (download uses `STORAGE_DOWNLOAD_TABLES`)
- Supabase Storage bucket definitions and RLS policies

### Environment constraints
- ES2020 target — no `Promise.any`; use `Promise.allSettled` for parallel patterns
- Dexie 4 quirks: `sortBy` returns `Promise<T[]>`, async upgrades cannot read auth
- `supabase` is a singleton imported from `@/lib/auth/supabase`; may be null if env vars missing
- `opfsStorageService` is a singleton from `@/services/OpfsStorageService`; has OPFS + IndexedDB fallback

---

## Out of Scope

- Book file downloads (EPUB/PDF/audiobook blobs for reading) — deferred to E94-S07
- Screenshots bucket downloads — no Dexie table to land them
- Avatars bucket for user profile photo (separate from author photos) — no Dexie author table consumer in this story
- Progressive/streaming download with progress indicator — future UX story
- Background Service Worker caching — out of scope for this sprint
- Error retry queue for failed blob downloads — future story; current story uses best-effort (one attempt + signed URL fallback)

---

## Risks

1. **Blob size in IndexedDB for PDFs**: storing 100MB+ PDF blobs in IndexedDB (via `fileBlob` on `importedPdfs`) may hit quota limits on some browsers. Plan B: show download-on-demand button instead of auto-download for PDFs > configurable threshold. _Not blocking AC4_ — AC4 specifies no size cap, so implement as specified; risk is documented for future story.
2. **Concurrent download cycles**: if two `_doDownload` calls run simultaneously (e.g., rapid offline→online), both may attempt to fetch and write the same blob. `db.put`/`db.update` are idempotent so the data won't corrupt, but double network calls may occur. Acceptable for now; navigator.locks upload guard does not protect download.
3. **`import.meta.env.VITE_SUPABASE_URL` in `_isSupabaseStorageUrl`**: `import.meta.env` is not available in Vitest unit tests without vite plugin setup. May need to fall back to `process.env` or a simple `supabase.co` heuristic. Test environment must mock or set the env var.
4. **Signed URL 1-hour TTL**: signed URLs expire. If the user is offline when the URL is generated and comes back online after 1 hour, the signed URL will fail. The story doesn't require retry — this is acceptable given the TTL is 1 hour and the scenario is unlikely.
