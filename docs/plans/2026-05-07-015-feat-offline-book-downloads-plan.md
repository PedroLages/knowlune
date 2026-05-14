---
title: "feat: Offline book & audiobook downloads"
type: feat
status: shipped-with-gaps
date: 2026-05-07
deepened: 2026-05-14
origin: docs/brainstorms/2026-05-07-offline-book-downloads-requirements.md
---

# feat: Offline book & audiobook downloads

## Overview

Add user-initiated download of remote books (EPUB, PDF, M4B audiobook) for offline access. Downloaded content is stored in OPFS and identified by a per-device `offlinePath` field — the reader/player checks this path first, then falls back to the existing source dispatch. Includes progress tracking, streaming writes for large files, storage management, and persistent storage request.

**Status: All Units 1-5 are shipped.** This plan is kept as documentation of what was built and to track remaining gaps.

## Problem Frame

Knowlune users currently need an internet connection to read or listen to any book sourced from OPDS catalogs or Audiobookshelf servers. Locally imported files already work offline via OPFS, but remote-sourced content is stream-only or transiently cached (10-book LRU Cache API for EPUBs, stream-only for audiobooks). The app has all the infrastructure pieces — OPFS storage, BookContentService, a complete audiobook player — but no user-facing action to proactively download content for offline use.

(see origin: docs/brainstorms/2026-05-07-offline-book-downloads-requirements.md)

## What Was Built

All five units have been implemented and merged:

| Unit | Description | Status |
| --- | --- | --- |
| Unit 1 | DownloadManager service + Dexie v64 `downloads` table | Shipped |
| Unit 2 | DownloadButton (7-state), BookDetailHero, BookContextMenu, BookCard badge, offline CTA | Shipped |
| Unit 3 | Library downloaded-only filter pill | Shipped |
| Unit 4 | Storage management UI (StorageIndicator, DownloadStorageSection, quota warnings) | Shipped |
| Unit 5 | Persistent storage request via `navigator.storage.persist()` | Shipped, complete |

Git history (chronological):

- `1df64f4c` feat(downloads): add DownloadManager service + Dexie v64 downloads table
- `64074813` feat(downloads): add DownloadButton with 7-state machine to BookDetailHero
- `d428b987` feat(downloads): add context menu actions, BookCard badge, library filter, app init
- `620365c0` feat(downloads): add storage management, quota warnings, first-download persist
- `bb0a676c` fix(downloads): resolve P0-P3 review findings from retrospective code review
- `0351e453` fix(downloads): memoize useAllDownloadedBookIds selector to prevent infinite re-render

## Key Facts About the Implementation

### No HTTP Range Resume

During the post-merge review it was determined that HTTP Range resume is incompatible with the `pipeTo` streaming pattern (`createWritable({ keepExistingData: true })` + `seek()` does not compose with `pipeTo`). The implementation always fetches from scratch. Downloads that fail mid-stream must be restarted entirely. This is a known trade-off: simpler code, no OPFS partial-file management, but no partial-download resume for large files.

### Streaming Writes Work Correctly

`response.body.pipeTo(opfsWritable)` is used for near-constant memory regardless of file size, critical for 500MB+ audiobooks. However, there is **no TransformStream inserted for progress tracking** — the code pipes directly without intercepting the flow. Progress is reported as `totalSize` only after completion; no incremental progress is emitted during the streaming write.

### Recursive Retry

The `_performDownload` method calls itself recursively on retry, and `_drainQueue` is also recursive. These are not guarded by a depth limit, which poses a theoretical stack overflow risk if the retry+queue chain runs deep. An iterative loop would be more robust.

### Missing Tests

- No `DownloadManager.test.ts` unit tests exist
- No e2e test directory at `tests/e2e/downloads/`
- Only `useDownloadStore.test.ts` unit tests exist

## Remaining Gaps

These are known gaps that should be addressed in follow-up work:

### Gap 1: IndexedDB OPFS Fallback Bug

**Priority**: P0 — If OPFS is unavailable, downloads completely fail with no fallback path. DownloadManager writes directly to OPFS handles (lines 231-238) instead of going through `OpfsStorageService.storeBookFile()` which has an IDB fallback. This blocks the entire download feature on environments where OPFS is unavailable.

The Context section mentions "IndexedDB fallback via `db.bookFiles`" as a fallback when OPFS is unavailable. The implementation does not handle this case — if OPFS `navigator.storage.getDirectory()` fails, the download will fail with an unhandled error. The original plan assumed `OpfsStorageService` handled this transparently, but the DownloadManager writes directly to OPFS file handles rather than going through `OpfsStorageService.storeBookFile()`, so the fallback path is not exercised.

### Gap 2: Missing DownloadManager Unit Tests

**Priority**: P1 — Core download logic (happy path, cancel, retry, queue, error paths, initialization reconciliation, book deletion cascade) has zero unit test coverage. Regressions in the 10+ untested scenarios can ship silently.

No `src/services/__tests__/DownloadManager.test.ts` exists. The following scenarios are untested:

- Happy path download flow (fetch -> stream -> OPFS -> offlinePath)
- Cancel mid-download
- Remove download
- Retry with exponential backoff
- Queue serialization (two downloads, second enqueued)
- Error paths (403, 404, empty response, fetch failure)
- Visibility API pause/resume
- Persistent storage request logic
- Startup reconciliation (`initialize()`)
- Book deletion cascade cleanup

### Gap 3: Missing E2E Tests

**Priority**: P1 — The full download-to-offline-read flow spans multiple components (DownloadButton, DownloadManager, BookReader, library filter). Without E2E coverage, cross-component integration regressions go undetected.

No `tests/e2e/downloads/` directory exists. The following E2E scenarios are untested:

- Full download -> offline read flow
- Download button visibility (remote vs local vs ABS-sourced)
- Progress indicator updates during download
- Downloaded badge on book card
- Remove download flow (context menu -> confirmation -> removal)
- Library "Downloaded" filter
- Storage management section in Settings
- Quota warning toast thresholds
- Offline connectivity error CTA

### Gap 4: Missing Download Progress During Streaming Write

**Priority**: P2 — Progress ring appears stuck at 0% during streaming writes for large files. This is a UI/UX gap, not a correctness issue — downloads complete successfully regardless. Low user impact for small files (<10MB).

The `pipeTo(writable)` call does not use a `TransformStream` to intercept bytes and emit progress updates. The download reports `totalSize` only after completion. During the streaming phase, the UI shows `progress: 0` until the entire file is written. For large audiobooks (>100MB), the progress ring appears stuck at 0% for a noticeable duration.

**Fix approach**: Insert a `TransformStream` between `response.body` and `writable` that counts bytes written and updates `useDownloadStore` at a throttled rate (e.g., every 250ms or every 1MB, whichever comes first):

```typescript
const { readable, writable: transformWritable } = new TransformStream()
const writer = transformWritable.getWriter()
let bytesWritten = 0

const reader = response.body.getReader()
const pump = async () => {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytesWritten += value.byteLength
    writer.write(value)
    // Throttled progress update
    const now = Date.now()
    if (now - lastProgressUpdate > 250) {
      store.setDownloadState(bookId, { progress: bytesWritten })
      lastProgressUpdate = now
    }
  }
  writer.close()
}

await Promise.all([pump(), readable.pipeTo(writable)])
```

### Gap 5: Recursive Retry/Queue Risk

**Priority**: P2 — Recursion depth is bounded by retry count (max 3 retries in `_performDownload`, line 274) and queue depth (typically < 10, `_drainQueue` line 319). Stack overflow is theoretically possible but extremely unlikely in practice. Low risk until queue depths grow significantly.

Both `_performDownload` (retry) and `_drainQueue` use recursion without a depth guard. Each retry cycle calls `_performDownload` again (line 295), and the queue drain calls itself for each queued download (line 319). While unlikely in practice (max 3 retries, typical queue depth < 10), this violates the project's robustness conventions.

**Fix approach**: Convert `_drainQueue` to an iterative `while` loop. For retry, use a `for` loop instead of recursive `_performDownload` calls.

## Requirements Trace

### Core Download

- [x] R1. Download button on book detail page and context menu for any remote book in the user's library
- [x] R2. Downloaded content read by existing reader/player exactly like local imports — no new playback path
- [ ] R3. ~~Full-file download with progress, HTTP Range resume on interruption~~ — **De-scoped**: Range resume incompatible with `pipeTo`. Download always fetches from scratch. Full progress reporting is also incomplete (see Gap 4).
- [x] R4. Streaming writes via `createWritable()` + `pipeTo` — no in-memory buffering of large files

### Offline Visibility

- [x] R5. Download status indicator on book cards and detail page (not downloaded / downloading with progress / downloaded)
- [x] R6. Library filter/shelf for downloaded (offline-available) books

### Storage Management

- [x] R9. Storage indicator showing total OPFS space used by downloads, with per-book sizes
- [x] R10. Remove individual downloads (frees OPFS space, reverts to remote source)
- [x] R11. Removing a download does not delete the book from the library
- [x] R12. Quota warnings at 70%, 85%, and 95% of available OPFS storage

### Platform Reliability

- [x] R13. Request persistent storage via `navigator.storage.persist()` on first download
- [ ] R14. ~~Foreground-managed downloads — pause on background, resume on foreground~~ — **De-scoped**: The `paused` download status exists but is only used for cancellation, not for visibility-based pause/resume. No `visibilitychange` listener was implemented in the download pipeline. The `paused` status may be reused if this feature is added later.

### Offline Discovery

- [~] R15. When a remote book fails to open due to no connectivity, show a helpful error with a "Download for Offline" CTA — **Partially shipped**: `BookReader` (lines 1161-1188) shows a connectivity error with `RemoteEpubError` handling and a "Try again" / "Retry" button, and `BookContentService.fetchRemoteEpub()` surfaces structured network errors. However, the "Download for Offline" CTA within the reader error UI was not implemented — the `DownloadButton` exists only on `BookDetailHero`, not in the reader error state.

## Scope Boundaries

- **Out of scope**: DRM, encryption, or license enforcement on downloaded files
- **Out of scope**: Auto-downloading content (no background pre-fetching without user action)
- **Out of scope**: Downloading books the user doesn't already have in their library
- **Out of scope**: Peer-to-peer or torrent-based distribution
- **Out of scope**: Downloading entire ABS libraries or OPDS catalogs in bulk
- **Out of scope**: Background downloads while app is closed (web platform limitation)
- **Out of scope**: Multi-file MP3 audiobook downloads (chapter-per-file sources). The initial implementation supports single-file sources only (EPUB, PDF, M4B). Multi-file MP3 audiobooks may be addressed in a future iteration.

## Context & Research

### Relevant Code and Patterns

- **OPFS storage**: `src/services/OpfsStorageService.ts` — singleton with `storeBookFile()`, `readBookFile()`, `deleteBookFiles()`, `getStorageEstimate()`. Directory layout: `/knowlune/books/{bookId}/book.{ext}`. IndexedDB fallback via `db.bookFiles`.
- **Content source dispatch**: `src/data/types.ts` — `ContentSource` discriminated union (`local` | `remote` | `fileHandle`). Reader and player already dispatch on `source.type`. A new `offlinePath?: string` field on Book will be checked first: if set and the OPFS file exists, read from OPFS; otherwise fall back to `source` dispatch. This preserves the original source for cross-device sync and re-download.
- **Book type**: `src/data/types.ts:857` — `Book` interface with `source`, `format`, `fileSize`, `absServerId`, `absItemId`. Flat serializable fields `sourceType` and `sourceUrl` exist for sync. `offlinePath` will be added as a nullable, local-only field (never synced — OPFS paths are per-device).
- **Remote content fetching**: `src/services/BookContentService.ts` — fetches remote EPUBs with auth, caches in Cache API (LRU, max 10). Pattern for remote fetch with auth headers.
- **Sync download pattern**: `src/lib/sync/storageDownload.ts:199` — `_downloadBookFile()` fetches from Supabase Storage URL, stores via `opfsStorageService.storeBookFile()`. Signed URL fallback on 401/403. Local-presence checks for idempotency.
- **Audiobook player**: `src/app/hooks/useAudioPlayer.ts` — dispatches on `source.type`: remote ABS (streaming URL via `createPlaybackSession()`), local OPFS (`readBookFile()` + `createObjectURL()`), multi-file MP3.
- **Progress UI**: `src/app/components/ui/progress.tsx` — Radix Progress component. Used by bulk import (`useBulkImport.ts`) and new-device download overlay.
- **Toast patterns**: `src/lib/toastHelpers.ts` — `toastSuccess`, `toastWarning`, `toastError`, `toastPromise`. Duration constants in `src/lib/toastConfig.ts`.
- **Storage quota**: `src/lib/storageQuotaMonitor.ts` — monitors IndexedDB storage via `navigator.storage.estimate()`, shows warnings at 80%+. Extended for OPFS downloads with graduated thresholds.
- **Storage management UI**: `src/app/components/settings/StorageManagement.tsx` — stacked bar chart, category legend, quota warnings, refresh. `src/app/components/library/StorageIndicator.tsx` — inline storage bar.
- **Dexie schema**: `src/db/schema.ts` — latest version 63. Migration pattern: `database.version(N).stores({...})`. Checkpoint schema for new installs at `src/db/checkpoint.ts`.
- **Book detail page**: `src/app/components/library/BookDetailHero.tsx` — "Read Now" / "Listen Now" primary action, share button, back navigation. Download button added as secondary action.
- **Book context menu**: `src/app/components/library/BookContextMenu.tsx` — Edit, Link Format, Re-scan Chapters, Change Status, Add to Shelf, Queue toggle, View Annotations, About Book, Delete. Download action added.
- **Library page**: `src/app/pages/Library.tsx` — tabs (Continue, Browse, Collections, History), format tabs (Audiobooks/Ebooks/All), filters, grid/list/series view. `LibraryFilters` component. Downloaded filter pill added.

### Institutional Learnings

- `docs/solutions/best-practices/book-detail-page-implementation-lessons-2026-05-07.md` — five-tier similarity design; relevant for maintaining consistency when adding download actions alongside existing menu items.
- `docs/solutions/e120-pwa-polish-lessons.md` — PWA polish lessons; relevant for persistent storage request and PWA install prompt patterns.

## Key Technical Decisions

- **Separate `downloads` Dexie table, not a Book field**: Download progress is high-frequency and transient — updating `Book.updatedAt` on every progress tick would trigger unnecessary sync churn. A separate table isolates download state from the syncable Book record. A lightweight derived status is computed for UI display.
- **`offlinePath` field on Book, not source mutation**: When download completes, set `book.offlinePath` to the OPFS file path and persist via `db.books.put()`. The reader/player dispatch checks `offlinePath` first — if set and the file exists, read from OPFS; otherwise fall back to the existing `source` dispatch. This preserves `book.source` as the canonical remote URL for cross-device sync (other devices see `sourceType: 'remote'` and stream normally). `offlinePath` is local-only and never synced. When download is removed, clear `offlinePath` to `null`. This requires minimal reader/player changes — a single `if (book.offlinePath)` check before the existing dispatch.
- **Streaming writes via `pipeTo`**: `response.body.pipeTo(opfsWritable)` — near-constant memory regardless of file size. Critical for 500MB+ audiobooks. Follows the pattern validated in origin research.
- **No HTTP Range resume**: The `pipeTo` pattern is incompatible with OPFS `createWritable({ keepExistingData: true })` + `seek()`. Downloads always fetch from scratch. See Remaining Gaps for implications.
- **DownloadManager singleton service**: Follows the pattern established by `OpfsStorageService` and `BookContentService`. Class with instance methods, exported as singleton. Manages the full download lifecycle: URL resolution, fetch, streaming write, progress emission, offlinePath management, cancellation, retry, and queue serialization.
- **Serialized download queue**: Downloads process one at a time to avoid bandwidth competition on mobile connections. Additional `startDownload()` calls enqueue as `'pending'` and are serviced FIFO. The UI shows queue position so users understand their second book is registered.

## Open Questions

### Resolved During Planning

- **Download status field location**: Separate `downloads` Dexie table. Rationale above in Key Technical Decisions.
- **Source mutation strategy**: Use `offlinePath` field on Book (not source mutation). Set on download complete, clear on remove. Reader/player dispatch checks `offlinePath` first — a minimal, centralized change. Rationale: `source` must stay as the canonical remote URL for cross-device sync. `offlinePath` is per-device and never synced.
- **Storage indicator location**: Both — inline on Library page (compact, always visible) and detailed management in Settings (per-book list, remove actions, quota breakdown).

### Deferred to Implementation

- **ABS raw file URL resolution**: The exact URL pattern for fetching the raw media file from ABS is determined by the Pre-Implementation Gate. Expected: item endpoint returns media URLs; may need `/api/items/{id}/file/{fileId}` or similar. The `DownloadManager` has a `resolveDownloadUrl(book)` method that handles this — implementation discovers the exact pattern during the gate, not during coding.
- **EPUB remote URL handling**: For OPDS-sourced EPUBs, `book.source.url` may point to an OPDS acquisition endpoint rather than a direct file URL. The downloader may need to follow redirects or resolve acquisition links. Deferred until real OPDS sources are tested.
- **Exact file extension preservation**: For ABS audiobooks, the file extension (`.m4b` vs `.mp3`) must be preserved from the server response's `Content-Disposition` header or URL path. Implementation will determine the exact extraction logic.
- **Multi-file MP3 audiobook downloads**: The initial implementation supports single-file sources only (EPUB, PDF, M4B). Multi-file MP3 audiobooks (where each chapter is a separate file) cannot be downloaded with the single-file streaming approach. This is explicitly scoped out and deferred to a future iteration. The download button should not be shown for multi-file MP3 sources.

## Pre-Implementation Gate (Superseded)

The ABS Direct Download Verification gate was not run before shipping. The implementation ships with `resolveDownloadUrl()` using `book.sourceUrl` / `book.source.url` / `book.fileUrl` directly. ABS-sourced books with `canDownload() === false` will have the download button hidden. This is acceptable because ABS download support was initially gated behind Phase 2, and the Phase 1 implementation covers OPDS and Supabase Storage sources.

Future work to enable ABS downloads should verify Range support and Content-Length headers on the target ABS instance before attempting downloads.

## System-Wide Impact

- **Interaction graph:** DownloadManager writes to Dexie (`downloads` table — local-only, not syncable). On download complete, sets `book.offlinePath` via `db.books.put()`. The `downloads` table is NOT added to `SYNCABLE_TABLES` — download state is per-device. On remove, clears `book.offlinePath` to `null`. BookCard, BookDetailHero, BookContextMenu, Library page all consume download state reactively via `useDownloadStore`. StorageIndicator and Settings consume download data for storage management. `DownloadManager.initialize()` runs on app mount to reconcile any orphaned state from interrupted sessions.
- **Book deletion cascade:** When a book is deleted via `useBookStore.deleteBook()`, the download record and any OPFS files must be cleaned up. Modify `deleteBook()` to call `downloadManager.removeDownload(bookId)` alongside the existing `opfsStorageService.deleteBookFiles(bookId)` call. Both operations should be wrapped in the same try/catch block with silent-catch-ok semantics.
- **Error propagation:** Download failures surface via toast notifications (following `toastHelpers.ts` patterns) and download state (`status: 'failed'`). Errors do not block the reader/player — if a download fails, the book remains readable via remote streaming (source is unchanged).
- **State lifecycle risks:** `offlinePath` is set via `db.books.put()` after the OPFS write succeeds. If OPFS write succeeds but `offlinePath` update fails, the file is orphaned in OPFS — `DownloadManager.initialize()` reconciles this on next app mount by scanning for books with OPFS files but missing download records. If the browser tab closes mid-write, the incomplete file is cleaned up on next `initialize()` or on next download attempt (stale partial older than 24h). Downloads are serialized to avoid contention on the single active OPFS writable.
- **API surface parity:** The download action is available in both BookContextMenu (right-click/long-press) and BookDetailHero (tap), following the existing pattern where key actions appear in both. Export to device is deferred to a separate task (see Scope Boundaries).
- **Integration coverage:** The full download->offline read flow requires testing across layers: UI triggers download (Unit 2) -> DownloadManager fetches and stores (Unit 1) -> `book.offlinePath` set in Dexie -> reader/player checks `offlinePath` first, reads from OPFS on hit, falls back to source dispatch on miss. E2E tests should cover this end-to-end but are currently missing.
- **Unchanged invariants:**
  - `Book.source` is never mutated by the download feature — it always reflects the canonical content source
  - `BookContentService.getEpubContent()` and `useAudioPlayer.loadChapter()` receive a single additional check: `if (book.offlinePath) { try OPFS read } else { existing dispatch }`. This is a minimal, centralized change.
  - `OpfsStorageService` API is unchanged — DownloadManager calls existing methods
  - Sync engine is unaffected — `offlinePath` is a local-only field (not in fieldMapper, not synced). Other devices see `sourceType: 'remote'` and stream normally.
  - Book deletion behavior is extended (not changed) — the existing cascade now also cleans up download state

## Risks & Dependencies

| Risk | Mitigation |
| --- | --- |
| **No HTTP Range resume** — downloads that fail mid-stream must restart entirely. Large audiobook downloads (>500MB) are especially vulnerable. | Streaming via `pipeTo` avoids memory pressure. Users can retry on failure. The absence of resume is a conscious trade-off: keeping the code simple and avoiding partial-file management complexity. |
| **Missing TransformStream progress** — no incremental progress reporting during the streaming write phase. The UI appears stuck at 0% for large files. | The download completes correctly; this is a UI UX gap, not a correctness gap. See Gap 4 in Remaining Gaps for the fix approach. |
| **OPFS quota may be smaller than expected on some iOS devices** | Persistent storage request (R13) + quota warnings (R12) give users visibility. Streaming writes prevent memory issues regardless of quota. Storage management lets users free space. |
| **Large audiobook downloads (>500MB) may hit browser fetch limits** | Streaming via `pipeTo` avoids buffering. If fetch itself fails on very large files, the user can retry. |
| **CORS headers on third-party servers (OPDS/ABS) may block streaming fetches** | Most OPDS/ABS servers serve with permissive CORS for their web clients. If a specific server blocks streaming, downloads from that source will fail gracefully (status `'failed'` with error). This is a server configuration issue, not a client bug. |
| **No IndexedDB fallback** — if OPFS `navigator.storage.getDirectory()` fails, the download fails with an unhandled error. | This is a known gap (see Gap 1). The original plan assumed `OpfsStorageService` would handle the fallback, but DownloadManager writes directly to OPFS handles. |
| **Recursive retry/queue without depth guard** — theoretical stack overflow risk. | Unlikely in practice (max 3 retries, typical queue depth < 10). See Gap 5 for fix approach. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-07-offline-book-downloads-requirements.md](../brainstorms/2026-05-07-offline-book-downloads-requirements.md)
- Related code: `src/services/DownloadManager.ts`, `src/stores/useDownloadStore.ts`, `src/app/components/library/DownloadButton.tsx`, `src/app/components/settings/DownloadStorageSection.tsx`, `src/app/components/settings/StorageManagement.tsx`, `src/app/pages/Library.tsx`, `src/app/components/library/BookDetailHero.tsx`, `src/app/components/library/BookContextMenu.tsx`, `src/app/components/library/BookCard.tsx`, `src/lib/storageQuotaMonitor.ts`, `src/app/components/library/StorageIndicator.tsx`, `src/db/schema.ts`
- External docs: OPFS MDN — `createWritable()`, `pipeTo`, `navigator.storage.persist()`, `navigator.storage.estimate()`
