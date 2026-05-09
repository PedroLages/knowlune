---
title: "feat: Offline book & audiobook downloads"
type: feat
status: active
date: 2026-05-07
origin: docs/brainstorms/2026-05-07-offline-book-downloads-requirements.md
---

# feat: Offline book & audiobook downloads

## Overview

Add user-initiated download of remote books (EPUB, PDF, M4B audiobook) for offline access. Downloaded content is stored in OPFS and identified by a per-device `offlinePath` field — the reader/player checks this path first, then falls back to the existing source dispatch. Includes progress tracking, HTTP Range resume, streaming writes for large files, storage management, and persistent storage request.

## Problem Frame

Knowlune users currently need an internet connection to read or listen to any book sourced from OPDS catalogs or Audiobookshelf servers. Locally imported files already work offline via OPFS, but remote-sourced content is stream-only or transiently cached (10-book LRU Cache API for EPUBs, stream-only for audiobooks). The app has all the infrastructure pieces — OPFS storage, BookContentService, a complete audiobook player — but no user-facing action to proactively download content for offline use.

(see origin: docs/brainstorms/2026-05-07-offline-book-downloads-requirements.md)

## Requirements Trace

### Core Download

- R1. Download button on book detail page and context menu for any remote book in the user's library
- R2. Downloaded content read by existing reader/player exactly like local imports — no new playback path
- R3. Full-file download with progress, HTTP Range resume on interruption
- R4. Streaming writes via `createWritable()` + `pipeTo` — no in-memory buffering of large files

### Offline Visibility

- R5. Download status indicator on book cards and detail page (not downloaded / downloading with progress / downloaded)
- R6. Library filter/shelf for downloaded (offline-available) books

### Storage Management

- R9. Storage indicator showing total OPFS space used by downloads, with per-book sizes
- R10. Remove individual downloads (frees OPFS space, reverts to remote source)
- R11. Removing a download does not delete the book from the library
- R12. Quota warnings at 70%, 85%, and 95% of available OPFS storage

### Platform Reliability

- R13. Request persistent storage via `navigator.storage.persist()` on first download
- R14. Foreground-managed downloads — pause on background, resume on foreground

### Offline Discovery

- R15. When a remote book fails to open due to no connectivity, show a helpful error with a "Download for Offline" CTA — so users discover the feature when they need it most

## Scope Boundaries

- **Out of scope**: DRM, encryption, or license enforcement on downloaded files
- **Out of scope**: Auto-downloading content (no background pre-fetching without user action)
- **Out of scope**: Downloading books the user doesn't already have in their library
- **Out of scope**: Peer-to-peer or torrent-based distribution
- **Out of scope**: Downloading entire ABS libraries or OPDS catalogs in bulk
- **Out of scope**: Background downloads while app is closed (web platform limitation)
- **Out of scope**: Multi-file MP3 audiobook downloads (chapter-per-file sources). The initial implementation supports single-file sources only (EPUB, PDF, M4B). Multi-file MP3 audiobooks may be addressed in a future iteration.

### Phased Rollout

R1 ("Download button on book detail page and context menu for any remote book") ships in two phases:

- **Phase 1 (initial implementation)**: Download button visible only for EPUB and PDF books sourced from OPDS catalogs or Supabase Storage. ABS-sourced books are gated behind `canDownload() === false` — the download button is hidden. This covers the most common library content and validates the download infrastructure before adding audiobook support.
- **Phase 2 (ABS activation)**: Gated on the [Pre-Implementation Gate](#abs-direct-download-verification) passing for the user's ABS instance. Once ABS direct file URLs with Range support are confirmed, `canDownload()` is updated to return `true` for ABS-sourced single-file audiobooks. No structural code changes are needed beyond the `resolveDownloadUrl()` implementation — the infrastructure from Phase 1 handles ABS downloads transparently.

This phased approach avoids building infrastructure for a source that may not support the required HTTP features, and limits the risk of a broken download UX for audiobook users during initial rollout. The `canDownload()` gate in Unit 2's `DownloadButton` component implements this check declaratively.

### Deferred to Separate Tasks

- **Export to Device (R7, R8)**: Saving downloaded files to the device filesystem for use with other apps. This serves a fundamentally different user need ("use Knowlune content in other apps") from offline reading. The export feature will be planned and implemented separately after the core offline download experience ships.

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
- **Storage quota**: `src/lib/storageQuotaMonitor.ts` — monitors IndexedDB storage via `navigator.storage.estimate()`, shows warnings at 80%+. Pattern to extend for OPFS downloads.
- **Storage management UI**: `src/app/components/settings/StorageManagement.tsx` — stacked bar chart, category legend, quota warnings, refresh. `src/app/components/library/StorageIndicator.tsx` — inline storage bar.
- **Dexie schema**: `src/db/schema.ts` — latest version 63. Migration pattern: `database.version(N).stores({...})`. Checkpoint schema for new installs at `src/db/checkpoint.ts`.
- **Book detail page**: `src/app/components/library/BookDetailHero.tsx` — "Read Now" / "Listen Now" primary action, share button, back navigation. No existing download action.
- **Book context menu**: `src/app/components/library/BookContextMenu.tsx` — Edit, Link Format, Re-scan Chapters, Change Status, Add to Shelf, Queue toggle, View Annotations, About Book, Delete. No existing download action.
- **Library page**: `src/app/pages/Library.tsx` — tabs (Continue, Browse, Collections, History), format tabs (Audiobooks/Ebooks/All), filters, grid/list/series view. `LibraryFilters` component.

### Institutional Learnings

- `docs/solutions/best-practices/book-detail-page-implementation-lessons-2026-05-07.md` — five-tier similarity design; relevant for maintaining consistency when adding download actions alongside existing menu items.
- `docs/solutions/e120-pwa-polish-lessons.md` — PWA polish lessons; relevant for persistent storage request and PWA install prompt patterns.

### External References

- Requirements document contains resolved research on OPFS quotas, ABS full-file download, background download limitations, and resumable download patterns (see origin document Research Findings section).
- HTTP Range requests: `If-Range` + `ETag` pattern for safe resume (see origin Prompt 4).
- OPFS append/resume: `createWritable({ keepExistingData: true })` + `seek(existingBytes)` (see origin Prompt 4).

## Key Technical Decisions

- **Separate `downloads` Dexie table, not a Book field**: Download progress is high-frequency and transient — updating `Book.updatedAt` on every progress tick would trigger unnecessary sync churn. A separate table isolates download state from the syncable Book record. A lightweight derived status is computed for UI display.
- **`offlinePath` field on Book, not source mutation**: When download completes, set `book.offlinePath` to the OPFS file path and persist via `db.books.put()`. The reader/player dispatch checks `offlinePath` first — if set and the file exists, read from OPFS; otherwise fall back to the existing `source` dispatch. This preserves `book.source` as the canonical remote URL for cross-device sync (other devices see `sourceType: 'remote'` and stream normally). `offlinePath` is local-only and never synced. When download is removed, clear `offlinePath` to `null`. This requires minimal reader/player changes — a single `if (book.offlinePath)` check before the existing dispatch.
- **Streaming writes via `pipeTo`**: `response.body.pipeTo(opfsWritable)` — near-constant memory regardless of file size. Critical for 500MB+ audiobooks. Follows the pattern validated in origin research (Prompt 4).
- **HTTP Range resume with ETag guard**: Store `{byteOffset, etag}` checkpoint in downloads table. On resume, send `Range: bytes={offset}-` + `If-Range: {etag}`. If server returns 200 instead of 206, the file changed — restart from scratch. Write to `.partial` temp file, rename to final filename on completion.
- **DownloadManager singleton service**: Follows the pattern established by `OpfsStorageService` and `BookContentService`. Class with instance methods, exported as singleton. Manages the full download lifecycle: URL resolution, fetch, streaming write, progress emission, offlinePath management, checkpoint persistence, cancellation, retry, and queue serialization.
- **Serialized download queue**: Downloads process one at a time to avoid bandwidth competition on mobile connections. Additional `startDownload()` calls enqueue as `'pending'` and are serviced FIFO. The UI shows queue position so users understand their second book is registered.

## Open Questions

### Resolved During Planning

- **Download status field location**: Separate `downloads` Dexie table. Rationale above in Key Technical Decisions.
- **Source mutation strategy**: Use `offlinePath` field on Book (not source mutation). Set on download complete, clear on remove. Reader/player dispatch checks `offlinePath` first — a minimal, centralized change. Rationale: `source` must stay as the canonical remote URL for cross-device sync. `offlinePath` is per-device and never synced.
- **Resume checkpoint storage**: IndexedDB via `downloads` table (`checkpoint` JSON field with `byteOffset` + `etag`). More reliable than inferring from OPFS file size (which could be corrupt on partial write).
- **Storage indicator location**: Both — inline on Library page (compact, always visible) and detailed management in Settings (per-book list, remove actions, quota breakdown).

### Deferred to Implementation

- **ABS raw file URL resolution**: The exact URL pattern for fetching the raw media file from ABS is determined by the Pre-Implementation Gate below (see [ABS Direct Download Verification](#abs-direct-download-verification)). Expected: item endpoint returns media URLs; may need `/api/items/{id}/file/{fileId}` or similar. The `DownloadManager` will have a `resolveDownloadUrl(book)` method that handles this — implementation discovers the exact pattern during the gate, not during coding.
- **EPUB remote URL handling**: For OPDS-sourced EPUBs, `book.source.url` may point to an OPDS acquisition endpoint rather than a direct file URL. The downloader may need to follow redirects or resolve acquisition links. Deferred until real OPDS sources are tested.
- **Exact file extension preservation**: For ABS audiobooks, the file extension (`.m4b` vs `.mp3`) must be preserved from the server response's `Content-Disposition` header or URL path. Implementation will determine the exact extraction logic.
- **Multi-file MP3 audiobook downloads**: The initial implementation supports single-file sources only (EPUB, PDF, M4B). Multi-file MP3 audiobooks (where each chapter is a separate file) cannot be downloaded with the single-file streaming approach. This is explicitly scoped out and deferred to a future iteration. The download button should not be shown for multi-file MP3 sources.

## Pre-Implementation Gate

### ABS Direct Download Verification

Before any implementation begins, verify that the user's Audiobookshelf instance supports direct file downloads with HTTP Range headers. This gate determines the scope for audiobook offline support.

**Procedure:**

1. Identify a known audiobook item in the ABS instance with known `itemId` and `fileId` values
2. Run `curl -I "https://<abs-instance>/api/items/{itemId}/file/{fileId}"` with the appropriate Bearer token
3. Verify the response includes:
   - `Content-Length` header (required for progress tracking)
   - `Accept-Ranges: bytes` header (required for resume support)
   - `Content-Type: audio/mp4` or similar (confirms it is the raw media file)
4. Test Range resume: `curl -H "Range: bytes=0-1023" -I "https://<abs-instance>/api/items/{itemId}/file/{fileId}"` — expect `HTTP 206 Partial Content` with `Content-Range` header
5. Test ETag support: check whether the response includes an `ETag` header (if absent, resume degrades to bare Range without `If-Range` guard)

**Go/No-Go Decision:**

- **Go (all headers present)**: Audiobook offline downloads are fully supported. Proceed with Unit 1 including ABS `resolveDownloadUrl()` implementation.
- **Partial (Range works, no ETag)**: Audiobook downloads work but without safe-change detection. Proceed with degraded mode (bare Range resume) — file corruption possible if source changes mid-download. Acceptable per risk table below.
- **No-Go (no Content-Length or Accept-Ranges)**: Audiobook offline downloads are blocked. Remove audiobook scope from this plan. EPUB and PDF downloads (OPDS + Supabase Storage) are unaffected.

**Result:** Document the outcome here after verification. If No-Go, update the Risks table and all references to ABS downloadable content accordingly.

## Implementation Units

### Unit 1: Download Manager Service & Persistence Layer

- [ ] **Unit 1: Download Manager Service & Persistence Layer**

**Goal:** Create the core download infrastructure — streaming download from URL to OPFS with resume support, progress tracking, state persistence, and offlinePath management. Downloads are serialized (one at a time) to avoid bandwidth competition on mobile.

**Requirements:** R2, R3, R4, R11, R14

**Dependencies:** None (foundational)

**Files:**
- Create: `src/services/DownloadManager.ts`
- Create: `src/stores/useDownloadStore.ts`
- Modify: `src/db/schema.ts` (add v64 migration for `downloads` table)
- Modify: `src/db/checkpoint.ts` (add `downloads` to checkpoint schema)
- Test: `src/services/__tests__/DownloadManager.test.ts`
- Test: `src/stores/__tests__/useDownloadStore.test.ts`

**Approach:**
- Singleton `DownloadManager` class with these public methods:
  - `startDownload(book: Book): Promise<void>` — full download lifecycle
  - `cancelDownload(bookId: string): void` — abort fetch, clean up partial
  - `removeDownload(bookId: string): Promise<void>` — delete OPFS file, restore remote source, remove download record
  - `getDownloadState(bookId: string): DownloadRecord | null` — current state lookup
  - `getAllDownloads(): Promise<DownloadRecord[]>` — all records for library filter
  - `resolveDownloadUrl(book: Book): Promise<string>` — resolve actual file URL (handles ABS indirection)
- New `downloads` Dexie table with schema: `id, bookId, status, progress, totalSize, opfsPath, originalSource, checkpoint, error, retryCount, createdAt, updatedAt`. Compound index on `[bookId+status]`.
- `DownloadRecord` interface tracking: `bookId`, `status` (`'pending' | 'downloading' | 'downloaded' | 'failed' | 'paused' | 'retrying'`), `progress` (bytes), `totalSize` (bytes from Content-Length), `opfsPath`, `originalSource` (serialized `ContentSource`), `checkpoint` (`{byteOffset, etag}`), `error`, `retryCount`.
- Zustand `useDownloadStore` for reactive UI state — mirrors active download progress at throttle rate (250ms max update frequency). Actions: `startDownload`, `cancelDownload`, `removeDownload`. Selectors: `useDownloadState(bookId)`, `useIsDownloading(bookId)`, `useIsDownloaded(bookId)`, `useAllDownloadedBookIds()`.
- Download flow (serialized — one active download at a time; additional `startDownload()` calls enqueue as `'pending'`):
  1. Check for existing partial download → resume if checkpoint exists and ETag matches (or byte offset > 0 for servers without ETag — bare Range request, no `If-Range`)
  2. Create `.partial` temp file in OPFS directory
  3. Fetch with `Range` header if resuming, `AbortController` for cancellation
  4. `response.body.pipeTo(writable)` with manual progress tracking via `TransformStream`
  5. On complete: validate `totalSize > 0`, rename `.partial` → final filename, set `book.offlinePath` via `db.books.put()`, clear checkpoint, set status `'downloaded'`
  6. On error: update checkpoint with current byte offset, begin exponential backoff retry (2s, 4s, 8s, max 3 attempts). Status transitions to `'retrying'` during backoff delay; only set `'failed'` after all retries are exhausted
- `offlinePath` management: on download complete, read the book via `db.books.get()`, set `book.offlinePath` to the OPFS path, write back via `db.books.put()`. On `removeDownload()`, clear `book.offlinePath` to `null`. The `downloads` table is local-only (not added to `SYNCABLE_TABLES`).
- **Startup reconciliation**: `DownloadManager.initialize()` called on app mount queries the `downloads` table for records with `status: 'downloading'` or `status: 'retrying'`, transitions them to `'paused'`, and hydrates the Zustand store so the UI shows paused downloads after page reload. Also scans for any books with `offlinePath` set but no downloads record, and reconciles by creating a `'downloaded'` record.
- **Hydration guarantee**: To prevent a flash-of-wrong-state (a downloaded book briefly appearing as remote on cold PWA launch), `DownloadManager.initialize()` must complete before the first React render. The boot sequence in `src/main.tsx` awaits `initialize()` before calling `ReactDOM.createRoot()`. The Zustand `useDownloadStore` also exposes a `hydrated: boolean` property set to `true` after `initialize()` finishes. UI consumers check `useDownloadStore((s) => s.hydrated)` and render a neutral/empty state (no download actions shown) until hydration confirms readiness. If `initialize()` fails (rare — Dexie read failure), the store defaults to `hydrated: true` with empty download state, so the app still renders gracefully.
- Visibility API integration: `document.addEventListener('visibilitychange', ...)` — pause active downloads when hidden, resume when visible. Downloads started while hidden are queued as `'pending'`.
- Retry with exponential backoff: 2s, 4s, 8s delays. Max 3 attempts. Failures after max retries set status `'failed'` with error message.
- `resolveDownloadUrl(book)` returns `book.source.url` for OPDS/remote sources. For ABS sources, may need to call ABS API to discover the direct file URL — stub with a pattern that implementation fills in.

**Patterns to follow:**
- `src/services/OpfsStorageService.ts` — singleton class pattern, OPFS file handle operations, directory layout (`/knowlune/books/{bookId}/`)
- `src/lib/sync/storageDownload.ts:199` — `_downloadBookFile()` fetch→OPFS pattern with local-presence check
- `src/services/BookContentService.ts` — remote fetch with auth header construction
- `src/app/hooks/useBulkImport.ts` — progress tracking with AbortController cancellation
- `src/lib/storageQuotaMonitor.ts` — singleton service pattern with throttled monitoring

**Mocking strategy (for unit tests):**

The `DownloadManager` tests mock three external systems. The existing `OpfsStorageService.test.ts` demonstrates the chain-of-mock-directories pattern used here (see `src/services/__tests__/OpfsStorageService.test.ts`).

- **Fetch mocking**: Use `vi.fn()` on `globalThis.fetch`. Each test provides a `Response` object with a `ReadableStream` body (e.g., from `new Blob([...]).stream()`), `headers` (including `Content-Length`, `Accept-Ranges`, `ETag`), and `status` (200/206/403). Test Range resume by having the mock return a response whose body stream starts at the requested byte offset and emits a `206` status.
- **OPFS mocking**: Create an in-memory mock implementing the `FileSystemDirectoryHandle`, `FileSystemFileHandle`, and `FileSystemWritableFileStream` interfaces used by `DownloadManager`. An in-memory `Map<string, Uint8Array>` serves as the backing store, keyed by mock path. This follows the existing pattern in `OpfsStorageService.test.ts` which chains `getDirectoryHandle()` → `getFileHandle()` → `createWritable()` through mock objects. The `.partial` → final rename flow is tested by asserting the mock map key after completion.
- **AbortController mocking**: Test cancellation by calling `controller.abort()` and asserting the fetch mock received `signal.aborted === true` and `writable.close()` was not called (partial file not finalized). Verify the pending queue advances to the next download.
- **Visibility API mocking**: Use `vi.spyOn(document, 'visibilityState', 'get')` to mock `document.visibilityState`. Manually dispatch `visibilitychange` events to test pause/resume transitions without real tab visibility changes.

**Test scenarios:**
- Happy path: `startDownload(remoteBook)` → file streams to OPFS → progress updates emitted → `book.offlinePath` set → status `'downloaded'`
- Happy path: `removeDownload(bookId)` → OPFS file deleted → `book.offlinePath` cleared → download record removed → book still in library (R11)
- Happy path: EPUB download completes → `BookContentService.getEpubContent()` checks `offlinePath` first, reads from OPFS (R2)
- Happy path: audiobook download completes → `useAudioPlayer.loadChapter()` checks `offlinePath` first, reads from OPFS (R2)
- Happy path: `DownloadManager.initialize()` → finds in-progress downloads in Dexie → transitions to `'paused'` → hydrates Zustand store
- Happy path: `DownloadManager.initialize()` → finds book with `offlinePath` set but no downloads record → creates `'downloaded'` record (reconciliation)
- Edge case: download interrupted mid-stream → checkpoint saved with byte offset → resume on next `startDownload()` → only remaining bytes fetched (R3)
- Edge case: server ETag changed since checkpoint → Range request returns 200 instead of 206 → download restarts from scratch
- Edge case: server has no ETag header → resume uses bare `Range` request without `If-Range` → 206 response → resume works in degraded mode
- Edge case: download already in progress for bookId → second `startDownload()` enqueues as `'pending'` (serialized queue)
- Edge case: download already completed for bookId → `startDownload()` is no-op
- Edge case: download a 500MB file → streaming write uses near-constant memory (verify no large buffer allocation) (R4)
- Edge case: `Content-Length: 0` or empty response body → download fails with validation error before `offlinePath` is set
- Edge case: OPFS unavailable → falls back to IndexedDB via existing `OpfsStorageService` fallback
- Edge case: two different books → `startDownload(A)` + `startDownload(B)` → B enqueued as pending, starts after A completes
- Error path: fetch returns 403/401 → retry with backoff → status `'retrying'` during delay → after max retries → status `'failed'` with error message
- Error path: fetch returns 404 → no retry → status `'failed'` immediately
- Error path: OPFS write fails (quota exceeded) → status `'failed'`, error preserved, `offlinePath` not set
- Error path: cancel during active download → AbortController triggered → partial file cleaned up → status reset, next pending download starts
- Integration: visibility change to hidden → active download pauses, status `'paused'` → visibility change to visible → download resumes from checkpoint (R14)
- Integration: download complete → `book.offlinePath` set via `db.books.put()` → other device syncing the book sees `sourceType: 'remote'` unchanged, streams normally

**Verification:**
- Unit tests for DownloadManager with mocked fetch and OPFS
- A remote book can be downloaded, read offline, and the download removed without affecting the library entry
- Streaming write memory stays under ~50MB for a 500MB file
- Interrupted downloads resume from checkpoint, not restart

---

### Unit 2: Download UI — Actions & Progress Indicators

- [ ] **Unit 2: Download UI — Actions & Progress Indicators**

**Goal:** Add download trigger buttons to BookDetailHero and BookContextMenu, with progress indicators and downloaded-state badges on book cards and the detail page.

**Requirements:** R1, R5, R10

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/components/library/DownloadButton.tsx`
- Modify: `src/app/components/library/BookDetailHero.tsx`
- Modify: `src/app/components/library/BookContextMenu.tsx`
- Modify: `src/app/components/library/BookCard.tsx` (add download status badge)
- Test: `tests/e2e/downloads/book-download-ui.spec.ts`

**Approach:**
- `DownloadButton` component (placed as a secondary icon button in the BookDetailHero action row, alongside Share — follows existing icon-button pattern):
  - State machine covering all 7 statuses:
    - `remote`: Download icon button with `aria-label="Download for offline"`
    - `pending` (queued): Download icon with subtle clock/hourglass overlay, tooltip "Queued"
    - `downloading`: Circular progress ring with percentage, `role="progressbar"` + `aria-valuenow`/`aria-valuemin={0}`/`aria-valuemax={100}` + `aria-label="Downloading: N% complete"`. Tapping shows Cancel action.
    - `paused`: Frozen progress ring with pause icon overlay, `aria-label="Download paused at N%"`
    - `retrying`: Progress ring with subtle pulsing "Retrying (N/3)..." label below
    - `downloaded`: Shows checkmark badge with `aria-label="Available offline"`; context menu and long-press provide "Remove Download". (Export to device is deferred to a separate task.)
    - `failed`: Error icon with "Retry" action, `aria-label="Download failed — tap to retry"`
  - Uses `useDownloadState(bookId)` selector from Zustand store
  - On click (remote): calls `downloadManager.startDownload(book)` with toast feedback
  - On click (downloading): cancels via `downloadManager.cancelDownload(bookId)`
  - Gated by `canDownload(book)`: returns false (button hidden) for ABS-sourced books until `resolveDownloadUrl()` is confirmed working. Initially only EPUB/PDF from OPDS and Supabase Storage URLs are downloadable.
  - Confirmation dialog for "Remove Download": title "Remove offline copy?", description "This will delete the downloaded file but keep the book in your library. You will need an internet connection to read or listen to it again.", buttons "Cancel" / "Remove"
  - Accessible live region: `aria-live="polite"` wrapper announces state transitions ("Download started for {title}", "Download complete — {title} available offline", "Download failed — tap to retry")
- `BookDetailHero` modifications:
  - Add `<DownloadButton>` as an icon button in the action row (alongside Share), following the existing compact icon-only secondary action pattern
- `BookContextMenu` modifications:
  - Remote + not downloading: "Download for Offline" item
  - Downloading / pending / paused / retrying: "Cancel Download" item
  - Downloaded: "Remove Download" item
  - Failed: "Retry Download" item
  - All new items placed after "Link Format" and before "Change Status", separated by `ContextMenuSeparator` (no section label — follows existing separator-only convention)
  - All items have `min-h-[44px]` touch targets with `aria-label` matching the visible label
- `BookCard` modifications:
  - Add a decorative (non-interactive) download status badge in the card corner: downloaded checkmark, downloading mini progress ring
  - Positioned to not conflict with existing format badge (top-right) — use top-left alongside or below the status badge
  - At mobile (<640px): badge is 20x20px max
  - Tapping the card still navigates to book detail (badge is decorative; download state detail is on the detail page)
  - Use `useIsDownloaded(bookId)` and `useDownloadState(bookId)` selectors
- Toast notifications:
  - Download started: info toast with book title
  - Download complete: success toast with "Available offline"
  - Download failed: error toast with retry action
  - Download removed: info toast
  - Download queued: subtle info toast "Queued — will download after current download completes"

**Patterns to follow:**
- `src/app/components/library/BookDetailHero.tsx` — existing action button layout, share icon-button pattern
- `src/app/components/library/BookContextMenu.tsx` — menu item structure, `ContextMenuSeparator`, `min-h-[44px]`, `aria-label` patterns
- `src/app/components/ui/progress.tsx` — existing Progress component (Radix-based)
- `src/app/components/library/StorageIndicator.tsx` — existing `role="status"` and `role="progressbar"` accessibility patterns
- `src/lib/toastHelpers.ts` — `toastSuccess`, `toastError`, `toastWithUndo` patterns
- `src/app/components/library/BookCard.tsx` — card badge/corner icon patterns (format badge)

**Test scenarios:**
- Happy path: tap "Download" on a remote book detail page → download starts → progress indicator appears with percentage → completes → checkmark badge appears (R1)
- Happy path: long-press book card → context menu → "Download for Offline" → download starts (R1)
- Happy path: download completes → "Downloaded" badge on book card (R5)
- Happy path: "Remove Download" from context menu → confirmation dialog → download removed → book card reverts to remote state (R10)
- Happy path: screen reader announces "Download complete — {title} available offline" on completion
- Edge case: already-downloaded book → DownloadButton shows split button with checkmark + chevron
- Edge case: app backgrounded during download → on return, DownloadButton shows "Paused at N%" with resume option
- Edge case: two downloads started → first shows progress, second shows "Queued" badge
- Edge case: local-import book → no download UI shown (source is already local)
- Edge case: fileHandle book → no download UI shown
- Edge case: ABS-sourced audiobook (canDownload=false) → DownloadButton hidden
- Edge case: download fails → error state shown with "Retry" button
- Edge case: cancel download mid-progress → UI reverts to "Download" button
- Edge case: rapid double-tap on Download → second tap enqueues (serialized)
- Edge case: retrying (2/3) → progress ring shows pulsing indicator with "Retrying..." label
- Edge case: mobile viewport (375px) → DownloadButton is compact icon-only, doesn't wrap action row
- Edge case: keyboard navigation → Tab to DownloadButton, Enter to activate, Escape to cancel confirmation dialog

**Verification:**
- Download button renders for remote books, not for local/fileHandle books
- Progress indicator updates in real-time during download
- Downloaded badge appears on book card after completion
- Remove download flow works end-to-end (confirmation → removal → UI update)

---

### Unit 3: Offline Library Filter

- [ ] **Unit 3: Offline Library Filter**

**Goal:** Add a "Downloaded" filter to the library so users can see only books available offline.

**Requirements:** R6

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/pages/Library.tsx` (or library filter component)
- Modify: `src/app/components/library/LibraryFilters.tsx` (if filters are extracted)
- Test: `tests/e2e/downloads/offline-filter.spec.ts`

**Approach:**
- Add "Downloaded" pill/chip to the existing library filter bar (alongside format tabs and status filters)
- Filter logic: query `downloads` table for all records with `status === 'downloaded'`, get their `bookId` values, filter the book list to only those IDs
- Works with existing format tabs (Audiobooks / Ebooks / All) — intersection of format + downloaded filter
- Works with existing search — intersection of search results + downloaded filter
- Persist filter state in URL search params (`?downloaded=true`) for shareable/bookmarkable URLs
- Empty state: "No downloaded books yet. Download books to access them offline." with a link to browse the library

**Patterns to follow:**
- `src/app/pages/Library.tsx` — existing tab/filter patterns, URL param persistence
- `src/app/components/library/LibraryFilters.tsx` — filter pill/chip component patterns
- Library empty states — existing empty state patterns for other filters

**Test scenarios:**
- Happy path: download a book → navigate to library → select "Downloaded" filter → only the downloaded book is shown (R6)
- Happy path: download multiple books → "Downloaded" filter shows all of them
- Happy path: "Downloaded" filter + "Audiobooks" format tab → only downloaded audiobooks
- Happy path: "Downloaded" filter + search query → intersection of both filters
- Edge case: no books downloaded → "Downloaded" filter shows empty state message
- Edge case: remove last download while filter is active → filter remains active, empty state appears
- Edge case: filter persists in URL → page refresh → filter still applied
- Edge case: filter works with both grid and list views

**Verification:**
- Downloaded filter correctly shows only downloaded books
- Filter composes with existing format tabs and search
- Empty state is clear and actionable
- URL param persistence works across navigation

---

### Unit 4: Storage Management UI

- [ ] **Unit 4: Storage Management UI**

**Goal:** Show download storage usage, per-book sizes in Settings, quota warnings at thresholds, and bulk management actions.

**Requirements:** R9, R10, R12

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/library/StorageIndicator.tsx` (include download storage in bar)
- Create: `src/app/components/settings/DownloadStorageSection.tsx`
- Modify: `src/app/pages/Settings.tsx` (add Offline Content section)
- Modify: `src/lib/storageQuotaMonitor.ts` (add OPFS quota awareness alongside IndexedDB)
- Test: `tests/e2e/downloads/storage-management.spec.ts`

**Approach:**
- `StorageIndicator` extension:
  - Query `downloads` table for total bytes of downloaded files
  - Include download storage in the existing usage bar (separate segment or combined with existing OPFS usage)
  - Show "X books downloaded · Y MB used" tooltip or label
- `DownloadStorageSection` component (Settings):
  - Section card in Settings: "Offline Content"
  - Per-book list: title, format icon, file size, "Remove" button
  - "Remove All Downloads" action at the bottom with confirmation dialog
  - Total storage used by downloads at the top
  - Sorted by size (largest first)
  - Empty state when no downloads
- Quota warnings (R12):
  - Extend `storageQuotaMonitor.ts` to monitor total browser storage via `navigator.storage.estimate()` (which includes OPFS + IndexedDB)
  - Replace the existing single 80% threshold with a graduated system: 70% (info toast), 85% (warning toast with "Manage Storage" action), 95% (error toast, persistent, "Storage nearly full" with link to Settings)
  - Update the existing `StorageIndicator` inline warning (currently >90%) to use the same three-threshold graduated coloring
  - Throttle checks to once per 5 minutes (follow existing pattern)
  - Trigger check after each download completes
- "Remove Download" per-book action: calls `downloadManager.removeDownload(bookId)`, updates the list

**Patterns to follow:**
- `src/app/components/settings/StorageManagement.tsx` — settings section card pattern, stacked bar, category legend
- `src/app/components/library/StorageIndicator.tsx` — inline storage bar with color coding
- `src/lib/storageQuotaMonitor.ts` — existing quota monitoring pattern, toast thresholds
- `src/lib/storageEstimate.ts` — per-category storage breakdown pattern
- `src/lib/toastHelpers.ts` — toast patterns with action buttons

**Test scenarios:**
- Happy path: download 3 books → StorageIndicator shows "3 books · 45 MB used" (R9)
- Happy path: open Settings → Offline Content → per-book list with sizes and remove buttons (R9)
- Happy path: "Remove" on a book → confirmation → download removed → list updates (R10)
- Happy path: "Remove All Downloads" → confirmation → all downloads removed → empty state
- Edge case: storage at 70% → info toast appears (R12)
- Edge case: storage at 85% → warning toast with "Manage Storage" action (R12)
- Edge case: storage at 95% → persistent error toast with Settings link (R12)
- Edge case: no downloads → StorageIndicator shows only existing book count (no download segment)
- Edge case: no downloads → Offline Content section shows empty state
- Edge case: storage estimate unavailable → graceful degradation (hide percentage-based warnings)

**Verification:**
- Storage indicator reflects download usage in real-time
- Per-book sizes are accurate (match file sizes from downloads table)
- Quota warnings fire at correct thresholds
- Remove actions work and update the UI immediately

---

### Unit 5: Persistent Storage

- [ ] **Unit 5: Persistent Storage**

**Goal:** Request persistent storage on first download to reduce OPFS eviction risk, especially on iOS. The existing `PWAInstallBanner` component (`src/app/components/PWAInstallBanner.tsx`) already handles the PWA install prompt — no new PWA prompt module is needed.

**Requirements:** R13

**Dependencies:** Unit 1

**Files:**
- Modify: `src/services/DownloadManager.ts` (add persist request on first download)
- Test: `src/services/__tests__/DownloadManager.test.ts` (persist behavior)

**Approach:**
- Persistent storage request (R13):
  - On first `startDownload()` call (track via `localStorage` flag `knowlune_storage_persist_requested`):
    1. Check `navigator.storage.persisted()` — if already granted, skip
    2. Call `navigator.storage.persist()` — returns boolean
    3. Log result: granted or denied (browser may show permission prompt or silently deny)
    4. Set `localStorage` flag so we don't request again
  - If denied, still proceed with download — persistent storage is a best-effort optimization

**Patterns to follow:**
- `src/lib/storageQuotaMonitor.ts` — localStorage flag pattern for throttling
- `src/app/components/PWAInstallBanner.tsx` — existing PWA install prompt (already handles `beforeinstallprompt`, dismiss persistence, standalone detection)

**Test scenarios:**
- Happy path: first download → `navigator.storage.persist()` called → granted → localStorage flag set (R13)
- Happy path: subsequent downloads → persist not called again (flag check)
- Edge case: persist already granted → skip persist() call
- Edge case: persist denied → download proceeds anyway

**Verification:**
- `navigator.storage.persist()` is called exactly once (on first download)
- Downloads work regardless of persist outcome

## System-Wide Impact

- **Interaction graph:** DownloadManager writes to Dexie (`downloads` table — local-only, not syncable). On download complete, sets `book.offlinePath` via `db.books.put()`. The `downloads` table is NOT added to `SYNCABLE_TABLES` — download state is per-device. On remove, clears `book.offlinePath` to `null`. BookCard, BookDetailHero, BookContextMenu, Library page all consume download state reactively via `useDownloadStore`. StorageIndicator and Settings consume download data for storage management. `DownloadManager.initialize()` runs on app mount to reconcile any orphaned state from interrupted sessions.
- **Book deletion cascade:** When a book is deleted via `useBookStore.deleteBook()`, the download record and any OPFS files must be cleaned up. Modify `deleteBook()` to call `downloadManager.removeDownload(bookId)` alongside the existing `opfsStorageService.deleteBookFiles(bookId)` call. Both operations should be wrapped in the same try/catch block with silent-catch-ok semantics.
- **Error propagation:** Download failures surface via toast notifications (following `toastHelpers.ts` patterns) and download state (`status: 'failed'`). Errors do not block the reader/player — if a download fails, the book remains readable via remote streaming (source is unchanged).
- **State lifecycle risks:** `offlinePath` is set via `db.books.put()` after the OPFS write succeeds. If OPFS write succeeds but `offlinePath` update fails, the file is orphaned in OPFS — `DownloadManager.initialize()` reconciles this on next app mount by scanning for books with OPFS files but missing download records. If the browser tab closes mid-write, the `.partial` file is cleaned up on next `initialize()` or on next download attempt (stale partial older than 24h). Downloads are serialized to avoid contention on the single active OPFS writable.
- **API surface parity:** The download action must be available in both BookContextMenu (right-click/long-press) and BookDetailHero (tap), following the existing pattern where key actions appear in both. Export to device is deferred to a separate task (see Scope Boundaries).
- **Integration coverage:** The full download→offline read flow requires testing across layers: UI triggers download (Unit 2) → DownloadManager fetches and stores (Unit 1) → `book.offlinePath` set in Dexie → reader/player checks `offlinePath` first, reads from OPFS on hit, falls back to source dispatch on miss. E2E tests in Unit 2 should cover this end-to-end.
- **Unchanged invariants:**
  - `Book.source` is never mutated by the download feature — it always reflects the canonical content source
  - `BookContentService.getEpubContent()` and `useAudioPlayer.loadChapter()` receive a single additional check: `if (book.offlinePath) { try OPFS read } else { existing dispatch }`. This is a minimal, centralized change.
  - `OpfsStorageService` API is unchanged — DownloadManager calls existing methods
  - Sync engine is unaffected — `offlinePath` is a local-only field (not in fieldMapper, not synced). Other devices see `sourceType: 'remote'` and stream normally.
  - Book deletion behavior is extended (not changed) — the existing cascade now also cleans up download state

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| **ABS direct file download may not be supported** — the raw file URL pattern is unverified against the user's ABS instance. If ABS does not serve files with Content-Length and Accept-Ranges headers, audiobook offline downloads will not work. | **Pre-implementation gate:** See [ABS Direct Download Verification](#abs-direct-download-verification) for the concrete `curl -I` + `Range` header verification protocol and go/no-go criteria. Run before any Unit 1 work begins. If No-Go, audiobook offline is blocked but EPUB/PDF from OPDS and Supabase Storage are unaffected. |
| ETag headers absent on some servers — `If-Range` guard degrades, and bare `Range` resume is less safe (file may have changed). | Store byteOffset without ETag when absent; use bare `Range` header for resume. This is degraded mode — a server-side file change mid-download will produce a corrupted result. Most servers don't change static media files, so this is an acceptable risk. |
| OPFS quota may be smaller than expected on some iOS devices | Persistent storage request (R13) + quota warnings (R12) give users visibility. Streaming writes prevent memory issues regardless of quota. Storage management lets users free space. |
| Large audiobook downloads (>500MB) may hit browser fetch limits | Streaming via `pipeTo` avoids buffering. If fetch itself fails on very large files, the resume mechanism means the user can retry without losing progress. Chunk sizing guidance from research (1-4MB mobile, 4-16MB desktop). |
| CORS headers on third-party servers (OPDS/ABS) may block Range requests or streaming fetches | Most OPDS/ABS servers serve with permissive CORS for their web clients. If a specific server blocks Range or streaming, downloads from that source will fail gracefully (status `'failed'` with error). This is a server configuration issue, not a client bug. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-07-offline-book-downloads-requirements.md](../brainstorms/2026-05-07-offline-book-downloads-requirements.md)
- Related code: `src/services/OpfsStorageService.ts`, `src/services/BookContentService.ts`, `src/lib/sync/storageDownload.ts`, `src/data/types.ts:838`, `src/app/hooks/useAudioPlayer.ts`, `src/app/components/library/BookDetailHero.tsx`, `src/app/components/library/BookContextMenu.tsx`, `src/db/schema.ts`, `src/lib/storageQuotaMonitor.ts`, `src/app/components/library/StorageIndicator.tsx`, `src/app/components/PWAInstallBanner.tsx`, `src/stores/useBookStore.ts`
- External docs: OPFS MDN — `createWritable()`, `pipeTo`, `navigator.storage.persist()`, `navigator.storage.estimate()`, File System Access API `showSaveFilePicker()`
