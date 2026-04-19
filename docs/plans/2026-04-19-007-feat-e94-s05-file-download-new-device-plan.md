---
title: "feat: E94-S05 — File Download on New Device (Supabase Storage → OPFS/Dexie)"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e94-s05-file-download-on-new-device-requirements.md
---

# feat: E94-S05 — File Download on New Device (Supabase Storage → OPFS/Dexie)

## Overview

Adds the download side of the E94 binary-asset sync pipeline. After E94-S04, binary assets
(course thumbnails, author photos, PDF files, book covers) are uploaded to Supabase Storage
during sync. This story completes the loop: when a learner signs in on a new device and
`_doDownload` pulls Postgres row metadata, it now also fetches the associated binary blobs
from Supabase Storage and stores them in OPFS / Dexie so the UI renders correctly without
requiring re-import.

The implementation mirrors the upload-side architecture (storageSync.ts): a dedicated
`storageDownload.ts` module with per-table handlers, non-fatal per-record error isolation,
and a signed-URL fallback for private-bucket 401/403 responses. It is wired into
`syncEngine._doDownload` after each table's `_applyRecord` loop, before the store refresh
callback fires.

## Problem Frame

After sign-in on a new device:
- Postgres rows arrive correctly via `_doDownload` (E92-S06).
- `imported_courses.thumbnail_url`, `authors.photo_url`, `imported_pdfs.file_url`, `books.cover_url` contain Supabase Storage URLs.
- No blob is present in local Dexie / OPFS — the UI shows broken images and stale placeholders.

This story adds `storageDownload.ts` and wires it into the download phase to resolve those
URLs to local blobs. (See origin: `docs/brainstorms/2026-04-19-e94-s05-file-download-on-new-device-requirements.md`)

## Requirements Trace

- R1. `storageDownload.ts`: exports `STORAGE_DOWNLOAD_TABLES` and `downloadStorageFilesForTable`. (AC1)
- R2. Course thumbnails fetched and stored in `db.courseThumbnails` when `thumbnailUrl` is a Supabase Storage URL and the local blob is absent or stale. (AC2)
- R3. Author photos fetched and stored as `photoBlob: Blob` on the `db.authors` record; `photoHandle` left untouched. (AC3)
- R4. PDF file blobs fetched and stored as `fileBlob: Blob` on `db.importedPdfs` records; no size cap applied. (AC4)
- R5. Book covers fetched, stored via `opfsStorageService.storeCoverFile(bookId, blob)`, and `db.books.coverUrl` updated to `opfs-cover://{bookId}`. (AC5)
- R6. Signed URL fallback: 401/403 response triggers `createSignedUrl(path, 3600)` and retry. (AC6)
- R7. Wired into `syncEngine._doDownload` after `_applyRecord` loop, before `refreshFn`. (AC7)
- R8. Local-presence checks prevent redundant downloads on incremental sync cycles. (AC8)
- R9. Dexie schema: `ImportedAuthor.photoBlob?: Blob`, `ImportedPdf.fileBlob?: Blob` — Dexie v55. (AC9)
- R10. `tableRegistry.ts` `stripFields` includes `photoBlob` and `fileBlob`. (AC9, derived)
- R11. Unit tests: 9 scenarios covering happy path, skip conditions, 403 fallback, null client, network error. (AC10)
- R12. `syncEngine.test.ts` passes without regressions; at least one smoke test for the new hook. (AC11)

## Scope Boundaries

- No UI changes (no progress indicator, no download-on-demand button).
- No book file (EPUB/audiobook) downloads — deferred to E94-S07.
- No screenshots bucket download — no Dexie landing table.
- No user profile avatar download — no consumer in this story.
- No progressive/streaming download with progress bar.
- No Service Worker caching.
- No retry queue for failed blob downloads — best-effort with signed URL fallback only.

### Deferred to Separate Tasks

- Large-PDF quota safeguard (download-on-demand toggle for PDFs > threshold): future UX story.
- Navigator.locks guard on `_doDownload` to prevent concurrent download race: separate performance story.
- Signed URL pre-generation at display time for rendered `<img>` tags: E94-S05 or display layer.

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/storageSync.ts` — upload peer; mirrors the per-table handler + non-fatal try/catch pattern exactly. This file is the canonical pattern to follow.
- `src/lib/sync/storageUpload.ts` — `uploadBlob()`: size-checked upsert returning public URL. Download does not reuse this; it uses `fetch()` directly. But `_isSupabaseStorageUrl()` analogous helper uses the same URL detection heuristic.
- `src/lib/sync/syncEngine.ts` `_doDownload()`: insertion point at lines ~847–875. After `recordsToApply` loop (line ~858) and cursor advance (line ~862), before `refreshFn` call (line ~869). The `STORAGE_DOWNLOAD_TABLES` guard mirrors the `STORAGE_TABLES` upload guard at line ~955.
- `src/services/OpfsStorageService.ts` `storeCoverFile(bookId, blob)`: takes a `Blob` directly (not a `File`). Line 133. Returns storage path string. Has OPFS + IndexedDB fallback.
- `src/lib/sync/__tests__/storageSync.test.ts` — mock pattern to follow: `vi.hoisted()` for mock factories, `vi.mock('@/db', ...)` with individual table stubs, `vi.stubGlobal('fetch', ...)`.
- `src/lib/sync/tableRegistry.ts` lines 320–338: `importedPdfs.stripFields: ['fileHandle']`, `authors.stripFields: ['photoHandle']`. Both entries need `photoBlob` / `fileBlob` appended to `stripFields`.
- `src/data/types.ts` `ImportedAuthor` (line 489) and `ImportedPdf` (line 219): add optional `photoBlob?: Blob` and `fileBlob?: Blob` fields respectively.
- `src/db/schema.ts` v54 (current latest): new version is v55. No index changes needed — both new fields are optional and not indexed.
- `src/db/checkpoint.ts` `CHECKPOINT_VERSION = 53`: checkpoint is behind the migration chain. v55 is added to the incremental chain only; checkpoint is NOT updated in this story (checkpoint updates are batched).

### Institutional Learnings

- `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md` — Pattern 3: append-only tables must use `created_at` as cursor. Confirms existing cursor pattern is correct; no action needed here.
- `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md` — The `storageDownload.ts` module should share the `_isSupabaseStorageUrl` / `_extractStoragePath` helpers with `storageSync.ts`. However, the upload side does not currently expose these as shared utilities. For this story: implement them as private helpers in `storageDownload.ts` and create an `src/lib/sync/storageHelpers.ts` shared utility only if a second consumer needs them (deferred per this pattern).
- ES2020 constraint (from memory): no `Promise.any`. Use sequential `for...of` loops, not `Promise.any` for signed URL fallback chain.

### External References

None needed — local patterns are strong and complete. `storageSync.ts` provides a 1:1 structural model.

## Key Technical Decisions

- **`storageDownload.ts` is a symmetrical peer to `storageSync.ts`**: Same structure — module-level `STORAGE_DOWNLOAD_TABLES` set, single exported `downloadStorageFilesForTable(tableName, records, userId)` function, private per-table handlers, non-fatal try/catch on each record iteration. This makes future maintenance predictable.

- **No shared `storageHelpers.ts` in this story**: `_isSupabaseStorageUrl` and `_extractStoragePath` are duplicated in `storageDownload.ts` rather than extracted to a shared module. Extraction deferred until a second consumer appears (pattern from `extract-shared-primitive-on-second-consumer` solution). The upload side (`storageSync.ts`) doesn't expose these yet.

- **`storeCoverFile(bookId, blob)` — Blob, not File**: The `OpfsStorageService.storeCoverFile` signature takes a `Blob` directly (confirmed in `src/services/OpfsStorageService.ts` line 133). The BMAD story incorrectly says `new File([blob], 'cover.jpg', ...)`. Implementation must use the actual API signature.

- **`db.books.coverUrl` update after OPFS write**: After `storeCoverFile` resolves, `db.books.update(bookId, { coverUrl: \`opfs-cover://${bookId}\` })` is required. Without this, `useBookCoverUrl` continues fetching the now-stale remote URL on every render.

- **`photoBlob` and `fileBlob` as fields on existing tables**: Consistent with the E83 pattern where book covers are stored via `opfsStorageService` rather than a separate blob table. Avoids new cross-table joins for display. Both fields are non-indexed optional additions.

- **Dexie v55 — schema-string change not required**: Adding optional fields to existing tables in Dexie does not require changing the index string. A new version with an empty `.stores({})` call is sufficient to trigger an upgrade callback. The upgrade callback can be a no-op since new fields are optional.

- **`_isSupabaseStorageUrl` must tolerate self-hosted Supabase**: Checks `url.includes('supabase.co/storage')` OR `url.includes(VITE_SUPABASE_URL fragment)`. Use `typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL` with a fallback empty string to keep the helper unit-testable in Vitest where `import.meta.env` may be undefined.

- **Insertion point in `_doDownload`**: After cursor advance, before `refreshFn`. This ensures the store refresh sees the freshly downloaded blobs rather than being notified before blobs arrive.

- **Per-record, not per-batch, download**: Download is dispatched per-record within each table batch (mirrors `uploadStorageFilesForTable` which loops over entries). This allows fine-grained error isolation.

## Open Questions

### Resolved During Planning

- **Does `storeCoverFile` take a `File` or `Blob`?** → `Blob` (confirmed from `OpfsStorageService.ts` line 133). Story doc says `File` — implementation must use `Blob`.
- **What Dexie version does this add?** → v55. Current latest in migration chain is v54 (E93-S05). Checkpoint is at 53 — not updated in this story.
- **Should `photoBlob` / `fileBlob` be in `stripFields`?** → Yes, confirmed. Must be added to `tableRegistry.ts` entries for `authors` and `importedPdfs`.
- **Does `_doDownload` already have a lock guard?** → No. Only `_doUpload` uses `navigator.locks`. Download is unguarded — concurrent download races are accepted as low-risk (idempotent `db.put`/`db.update` prevents data corruption).

### Deferred to Implementation

- **Exact regex/string-match for `_extractStoragePath`**: The URL format `https://{host}/storage/v1/object/public/{bucket}/{path}` is well-known, but the implementer should validate against the actual project URL before finalizing the regex.
- **Vitest `import.meta.env` availability**: The `_isSupabaseStorageUrl` helper needs to handle missing `import.meta.env` in tests. Exact guard syntax TBD at implementation time.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
_doDownload() (syncEngine.ts)
│
├─ for each tableEntry in tableRegistry:
│   ├─ fetch rows from Supabase (existing)
│   ├─ apply rows to Dexie via _applyRecord loop (existing)
│   ├─ advance lastSyncTimestamp cursor (existing)
│   ├─ [NEW] if STORAGE_DOWNLOAD_TABLES.has(entry.dexieTable) && _userId:
│   │     downloadStorageFilesForTable(tableName, recordsToApply, userId)
│   └─ call refreshFn (existing)
│
downloadStorageFilesForTable (storageDownload.ts)
│
├─ guard: !supabase || !STORAGE_DOWNLOAD_TABLES.has → return
├─ for each record:
│   ├─ try { dispatch per-table handler } catch { console.warn, continue }
│
per-table handlers:
  _downloadCourseThumbnail → check local db.courseThumbnails → fetch → db.courseThumbnails.put
  _downloadAuthorPhoto     → check local db.authors.photoBlob → fetch → db.authors.update
  _downloadPdfFile         → check local db.importedPdfs.fileBlob → fetch → db.importedPdfs.update
  _downloadBookCover       → check local db.books.coverUrl prefix → fetch → opfsStorageService.storeCoverFile → db.books.update

_fetchWithSignedFallback (private helper):
  fetch(url) → ok → return blob
           → 401/403 → extractStoragePath → createSignedUrl → fetch(signedUrl) → return blob
           → other error → throw (caller catches)
```

## Implementation Units

- [ ] **Unit 1: Dexie schema v55 + type additions**

**Goal:** Add `photoBlob?: Blob` to `ImportedAuthor` and `fileBlob?: Blob` to `ImportedPdf`; increment Dexie schema to v55; add both fields to `stripFields` in `tableRegistry.ts`.

**Requirements:** R9, R10

**Dependencies:** None — schema changes needed before any code reads these fields.

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/lib/sync/tableRegistry.ts`
- Test: `src/db/__tests__/schema.test.ts`

**Approach:**
- In `src/data/types.ts`: add `photoBlob?: Blob` to `ImportedAuthor` interface (after `photoHandle?`) and `fileBlob?: Blob` to `ImportedPdf` interface (after `fileHandle`).
- In `src/db/schema.ts`: add `database.version(55).stores({}).upgrade(async _tx => { /* no-op — optional fields, no index changes */ })` after the v54 block. Comment must reference this story (E94-S05).
- In `src/lib/sync/tableRegistry.ts`: update `importedPdfs.stripFields` from `['fileHandle']` to `['fileHandle', 'fileBlob']`; update `authors.stripFields` from `['photoHandle']` to `['photoHandle', 'photoBlob']`. Add inline comment: `// photoBlob/fileBlob: server-fetched blob, not uploadable (E94-S05)`.
- Do NOT update `CHECKPOINT_VERSION` or `CHECKPOINT_SCHEMA` — checkpoint updates are batched.

**Patterns to follow:**
- `src/db/schema.ts` v54 block for the version declaration pattern.
- `src/lib/sync/tableRegistry.ts` existing `stripFields` entries for format.

**Test scenarios:**
- Happy path: Dexie can store and retrieve a `Blob` in `authors.photoBlob` (confirm via schema test that field is accepted).
- Happy path: Dexie v55 migration succeeds from v54 — no errors thrown on open.
- Happy path: `tableRegistry` `authors` entry `stripFields` contains `photoBlob`; `importedPdfs` entry contains `fileBlob`.
- Edge case: Existing `ImportedAuthor` records without `photoBlob` remain valid (optional field, no migration needed).

**Verification:**
- `npx tsc --noEmit` — zero type errors on `ImportedAuthor.photoBlob` and `ImportedPdf.fileBlob`.
- `npm run test:unit -- schema` — all schema tests pass.

---

- [ ] **Unit 2: `storageDownload.ts` — core module**

**Goal:** Create `src/lib/sync/storageDownload.ts` with all per-table download handlers, `_isSupabaseStorageUrl`, `_extractStoragePath`, and `_fetchWithSignedFallback` helpers.

**Requirements:** R1, R2, R3, R4, R5, R6, R8

**Dependencies:** Unit 1 (types must exist before code can reference `photoBlob`/`fileBlob`).

**Files:**
- Create: `src/lib/sync/storageDownload.ts`
- Create: `src/lib/sync/__tests__/storageDownload.test.ts`

**Approach:**

*Module structure* — mirrors `storageSync.ts`:
- Exported constant: `STORAGE_DOWNLOAD_TABLES: Set<string>`
- Exported function: `downloadStorageFilesForTable(tableName, records, userId)`
- Private handler functions: `_downloadCourseThumbnail`, `_downloadAuthorPhoto`, `_downloadPdfFile`, `_downloadBookCover`
- Private helpers: `_isSupabaseStorageUrl`, `_extractStoragePath`, `_fetchWithSignedFallback`

*Per-table handlers* (all private):

`_downloadCourseThumbnail(record, userId)`:
- Extract `record.thumbnailUrl` (cast to `string | undefined`); if absent or not a Supabase URL → return.
- `const existing = await db.courseThumbnails.get(record.id as string)`.
- If `existing` and `existing.createdAt >= (record.updatedAt as string)` → return (local is fresh).
- `const blob = await _fetchWithSignedFallback(thumbnailUrl, 'course-thumbnails', storagePath)`.
- `await db.courseThumbnails.put({ courseId: record.id as string, blob, source: 'server', createdAt: record.updatedAt as string ?? new Date().toISOString() })`.

`_downloadAuthorPhoto(record, userId)`:
- Extract `record.photoUrl`; if absent or not Supabase URL → return.
- `const author = await db.authors.get(record.id as string)`.
- If `author?.photoBlob` → return (already present).
- Fetch blob; `await db.authors.update(record.id as string, { photoBlob: blob })`.

`_downloadPdfFile(record, userId)`:
- Extract `record.fileUrl`; if absent or not Supabase URL → return.
- `const pdf = await db.importedPdfs.get(record.id as string)`.
- If `pdf?.fileBlob` → return.
- Fetch blob (no size cap — pass no `maxSizeBytes`); `await db.importedPdfs.update(record.id as string, { fileBlob: blob })`.

`_downloadBookCover(record, userId)`:
- Extract `record.coverUrl`; if absent or not Supabase URL → return.
- Check the **Dexie** record (not the incoming `record`) for local cover: `const book = await db.books.get(record.id as string)`.
- If `book?.coverUrl?.startsWith('opfs-cover://') || book?.coverUrl?.startsWith('opfs://')` → return.
- `const blob = await _fetchWithSignedFallback(coverUrl, 'book-covers', storagePath)`.
- `await opfsStorageService.storeCoverFile(record.id as string, blob)` — takes `Blob` directly per actual API.
- `await db.books.update(record.id as string, { coverUrl: \`opfs-cover://${record.id}\` })`.

*Helper functions*:

`_isSupabaseStorageUrl(url)`:
- Guard: if not `https://` → false.
- True if `url.includes('supabase.co/storage')` or (env var guard) includes project URL storage path.
- Env guard: `const projectUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ?? ''`.
- Return `url.includes('supabase.co/storage') || (projectUrl !== '' && url.startsWith(projectUrl) && url.includes('/storage/'))`.

`_extractStoragePath(publicUrl)`:
- Pattern: `https://{host}/storage/v1/object/public/{bucket}/{...path}`.
- Split on `/storage/v1/object/public/`; if no split → return null.
- Remainder: `{bucket}/{path}`. Split on first `/` to extract bucket and path.
- Return `{ bucket, path }` or null.

`_fetchWithSignedFallback(url, bucket, storagePath)`:
- `const response = await fetch(url)`.
- If `response.ok` → return `response.blob()`.
- If `response.status === 401 || response.status === 403`:
  - Guard: `if (!supabase) throw new Error(...)`.
  - `const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600)`.
  - If `data?.signedUrl`: `const r2 = await fetch(data.signedUrl)`; if `r2.ok` → return `r2.blob()`; else throw.
  - Else throw.
- Else throw (other HTTP status — caller's try/catch handles).

**Patterns to follow:**
- `src/lib/sync/storageSync.ts` — entire file as structural reference.
- `src/lib/sync/__tests__/storageSync.test.ts` — `vi.hoisted()` mock factory pattern, `vi.stubGlobal('fetch')`.

**Test scenarios (9 required by AC10):**
- Happy path — Course with Supabase `thumbnailUrl`, no local thumb → `fetch` called once, `db.courseThumbnails.put` called with blob.
- Skip — Course with Supabase `thumbnailUrl`, local thumb `createdAt` >= `record.updatedAt` → `fetch` NOT called.
- Happy path — Author with Supabase `photoUrl`, no local `photoBlob` → `fetch` called, `db.authors.update` called with blob.
- Happy path — PDF with Supabase `fileUrl`, no local `fileBlob` → `fetch` called, `db.importedPdfs.update` called with blob.
- Happy path — Book with Supabase `coverUrl`, local `coverUrl` is NOT opfs-prefixed → `fetch` called, `opfsStorageService.storeCoverFile` called, `db.books.update` called setting `opfs-cover://`.
- Skip — Book with local `coverUrl` starting `opfs-cover://` → `fetch` NOT called.
- 403 fallback — `fetch` returns 403 → `createSignedUrl` called → second `fetch` with signed URL → blob returned and stored.
- Null client — `supabase` is null → `downloadStorageFilesForTable` returns early, no crash, no fetch calls.
- Network error — `fetch` throws (simulated `TypeError: Failed to fetch`) → record skipped silently (caught in per-record try/catch), no error propagated from `downloadStorageFilesForTable`.

**Verification:**
- `npm run test:unit -- storageDownload` — all 9 tests pass.
- `npx tsc --noEmit` — zero type errors.

---

- [ ] **Unit 3: Wire into `syncEngine._doDownload`**

**Goal:** Import `downloadStorageFilesForTable` and `STORAGE_DOWNLOAD_TABLES` from `storageDownload.ts`; call after `_applyRecord` loop per table, before `refreshFn`.

**Requirements:** R7, R12

**Dependencies:** Unit 2 (module must exist).

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Test: `src/lib/sync/__tests__/syncEngine.test.ts` (existing file — add smoke test)

**Approach:**
- Add import at top of `syncEngine.ts`: `import { downloadStorageFilesForTable, STORAGE_DOWNLOAD_TABLES } from './storageDownload'`.
- In `_doDownload`, after the `recordsToApply` apply loop and cursor advance block, insert:
  ```
  // E94-S05: After row application and cursor advance, download binary assets for
  // file-bearing tables. Non-fatal — wrapped in .catch().
  if (STORAGE_DOWNLOAD_TABLES.has(entry.dexieTable) && _userId) {
    await downloadStorageFilesForTable(entry.dexieTable, recordsToApply, _userId)
      .catch(err => console.warn('[syncEngine] Storage download failed for', entry.dexieTable, err))
  }
  ```
- The call must be AFTER `maxUpdatedAt` cursor update (so the cursor advances even if blob download fails) and BEFORE `refreshFn()` call (so UI sees blobs when store reloads).
- Guard `_userId` — this is already set by `syncEngine.start()` and mirrors the pattern at line ~924 in `_doUpload`.

**Patterns to follow:**
- Lines ~952–958 in `syncEngine.ts` — the `uploadStorageFilesForTable` hook in `_doUpload`. Exact same guard+await+catch pattern.

**Test scenarios:**
- Integration smoke — `_doDownload` processes an `importedCourses` table with one record → `downloadStorageFilesForTable` is called with `('importedCourses', [record], userId)`.
- Integration — `_doDownload` for a non-file-bearing table (e.g., `notes`) → `downloadStorageFilesForTable` is NOT called.
- Regression — all existing `syncEngine.test.ts` tests continue to pass (zero regressions).

**Verification:**
- `npm run test:unit -- syncEngine` — all existing tests pass + new smoke tests pass.
- `npx tsc --noEmit` — zero type errors.

---

- [ ] **Unit 4: Final integration verification**

**Goal:** Run full build + lint + type check + unit test suite to confirm the feature is production-ready.

**Requirements:** All.

**Dependencies:** Units 1–3 complete.

**Files:**
- No new files. May touch any file from Units 1–3 if fixes required.

**Approach:**
- `npm run build` — zero errors, bundle regression check (delta vs `docs/implementation-artifacts/performance-baseline.json`; flag if >25% increase).
- `npx tsc --noEmit` — zero type errors.
- `npm run lint` — zero new ESLint errors (design-tokens/no-hardcoded-colors will not flag pure-utility files; no-silent-catch must not flag the intentional `.catch(err => console.warn(...))` pattern).
- `npm run test:unit` — all unit tests pass including new `storageDownload.test.ts`.
- Manual smoke test: sign in on a second browser profile, trigger `fullSync`, observe browser DevTools → Network: Storage URLs should be fetched; DevTools → Application → IndexedDB: `courseThumbnails` table should contain new blob; Library UI should render images correctly.

**Test scenarios:**
- Test expectation: none — this is an integration verification unit with no new behaviorally distinct code.

**Verification:**
- All 4 automated checks pass without modification.
- Manual smoke confirms end-to-end blob delivery on a fresh browser profile.

## System-Wide Impact

- **Interaction graph:** `_doDownload` in `syncEngine.ts` gains a new async call per file-bearing table. The `refreshFn` (Zustand store reload) fires after blob downloads complete — UI sees fresh state in one tick rather than requiring a second refresh cycle. The upload hook in `_doUpload` is unchanged.
- **Error propagation:** `downloadStorageFilesForTable` is `.catch()`-wrapped at the callsite — failures are downgraded to `console.warn` and never propagate to `_doDownload`'s caller. Per-record errors inside the module are `try/catch`-wrapped — one bad record does not block others.
- **State lifecycle risks:** `db.books.update(bookId, { coverUrl: 'opfs-cover://...' })` runs after `_applyRecord` has already applied the server row. If `_applyRecord` later re-runs (incremental sync, same record, no change in `updatedAt`), LWW will not overwrite the `opfs-cover://` coverUrl — but only if the local `updatedAt >= server.updatedAt`. Risk: if the server sends the same record with the same `updatedAt` twice, LWW no-ops and the coverUrl remains `opfs-cover://` — correct. If server sends a newer record with a new https `coverUrl`, LWW overwrites the `opfs-cover://` — the download handler will then re-fetch and re-write on the next cycle. This is the correct behavior.
- **API surface parity:** `STORAGE_DOWNLOAD_TABLES` (download set) and `STORAGE_TABLES` (upload set, from `storageSync.ts`) are separate exports. Both cover the same 4 tables — intentional symmetry. No shared constant is introduced; if the table set diverges in a future story, each set can evolve independently.
- **Integration coverage:** The `syncEngine.test.ts` smoke test confirms the hook fires; `storageDownload.test.ts` covers all per-handler behavior in isolation with full mock coverage.
- **Unchanged invariants:** The upload pipeline (`storageSync.ts` + `storageUpload.ts` + `uploadStorageFilesForTable` hook in `_doUpload`) is not modified. `syncEngine.nudge()` and `syncEngine.fullSync()` semantics are unchanged. Existing `tableRegistry.ts` entries for other tables are not touched beyond adding `photoBlob`/`fileBlob` to `stripFields`.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| **IndexedDB quota exceeded by large PDF blobs** (>100 MB) | Story specifies no size cap — AC4. Document in `docs/known-issues.yaml` as LOW risk for follow-up UX story (download-on-demand toggle). |
| **`storeCoverFile` API mismatch** (BMAD story says `File`, actual API takes `Blob`) | Resolved during planning: use `Blob` per actual source. No workaround needed. |
| **Concurrent `_doDownload` calls** (rapid offline→online toggle) | `db.put`/`db.update` are idempotent; data safe. Double network calls may occur but are non-fatal. Accept for now. |
| **`import.meta.env.VITE_SUPABASE_URL` unavailable in Vitest** | Use defensive guard in `_isSupabaseStorageUrl`. In tests, mock the module or ensure env var is set via `vite.config.ts` test globals. |
| **Signed URL 1-hour TTL** | Signed URLs expire. If user goes offline right after URL generation and returns after 1 hour, the fallback will also fail. Download is skipped silently (next sync cycle will retry). Acceptable for MVP. |
| **`db.books.update` coverUrl overwritten by subsequent LWW** | If server sends newer `books` row with https coverUrl, LWW overwrites local `opfs-cover://`. Handler re-downloads on that cycle. Self-healing — no data loss. |

## Documentation / Operational Notes

- The `photoBlob` and `fileBlob` fields will grow IndexedDB storage. Users with large PDF libraries on multiple devices may see significant IndexedDB growth. No quota UI is added in this story (E97-S02 scope).
- `storageDownload.ts` is a pure utility module (no React, no Zustand imports). Safe to import in any non-React context — same invariant as `storageSync.ts` and `syncEngine.ts`.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e94-s05-file-download-on-new-device-requirements.md](docs/brainstorms/2026-04-19-e94-s05-file-download-on-new-device-requirements.md)
- **Upload peer (structural reference):** `src/lib/sync/storageSync.ts`
- **Upload tests (mock pattern):** `src/lib/sync/__tests__/storageSync.test.ts`
- **Engine download phase:** `src/lib/sync/syncEngine.ts` (`_doDownload`, lines ~733–876)
- **OPFS service API:** `src/services/OpfsStorageService.ts` (`storeCoverFile` line 133, `getCoverUrl` line 156)
- **E94-S04 plan (upload side):** `docs/plans/2026-04-19-006-feat-e94-s04-supabase-storage-bucket-setup-plan.md`
- **Sync patterns lessons:** `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`
