---
title: "fix: Unify URL-imported course card behavior with local File System Access imports"
type: fix
status: active
date: 2026-07-11
---

# fix: Unify URL-imported course card behavior with local File System Access imports

## Overview

URL-imported (server) course cards lack parity with local File System Access imports in three areas: hover video preview, thumbnail generation, and inventory accuracy. This plan fixes all three so server-imported courses behave identically to local imports.

## Problem Frame

When a user imports a course via URL (nginx autoindex server), the resulting course card differs from a locally-imported card in three ways:

1. **No hover video preview** — `ImportedCourseCard` explicitly excludes `course.source === 'server'` from the inline preview path. Only local courses with a `FileSystemFileHandle` get the preview.
2. **Black/empty thumbnail** — `autoGenerateThumbnailFromServer()` failures are silently swallowed in `persistScannedCourse()`. The `extractFrameFromServerVideo()` function lacks a timeout, retry logic, and idempotent cleanup.
3. **Inflated file counts** — The same course reports 97 videos via URL import vs. 53 via local folder import. This has a dual root cause: (a) `scanCourseFolderFromServer()` has no file URL deduplication, and (b) the server scanner recognizes 9 video extensions (`.mp4`, `.mkv`, `.webm`, `.ts`, `.mov`, `.avi`, `.m4v`, `.flv`, `.wmv`) while the local filesystem scanner only recognizes 5 (`.mp4`, `.mkv`, `.avi`, `.webm`, `.ts`). The extra 4 formats (`.mov`, `.m4v`, `.flv`, `.wmv`) are counted as videos during URL import but silently skipped during local import.

## Requirements Trace

### Hover Preview (R1–R4)

- **R1.** Server-imported course cards display an inline muted video preview on hover (1s delay), matching local import behavior.
- **R2.** Hover preview for server courses streams video directly via HTTP Range requests — no full-video blob download.
- **R3.** Hover end pauses the video, clears `src`, and calls `load()` to release network/decoder resources.
- **R4.** YouTube courses remain excluded from the inline preview path (existing YouTube-specific preview is separate).

### Thumbnail Generation (R5–R7)

- **R5.** Server thumbnail generation logs failures with diagnostic detail (courseId, videoUrl, error) at `console.warn` level.
- **R6.** `extractFrameFromServerVideo()` has a 15-second timeout, retries seek targets, and cleans up idempotently.
- **R7.** Thumbnail priority order is preserved: explicit user-selected cover → discovered course image → remote video frame → placeholder.

### Inventory Accuracy (R10–R14, R16)

- **R10.** `scanCourseFolderFromServer()` deduplicates files by canonical URL — same file counted once regardless of path variants.
- **R11.** Directory URL deduplication prevents re-scanning the same directory via aliases or variant URLs.
- **R12.** Parent-directory links and links outside the course base URL are not followed.
- **R13.** An import diagnostics report is produced with unique/deduplicated counts and sample duplicate paths.
- **R14.** URL and local imports of the same course produce equivalent file counts.
- **R16.** Server scanner video extension set is aligned with the local filesystem scanner (5 formats: `.mp4`, `.mkv`, `.avi`, `.webm`, `.ts`). Extra server-only formats (`.mov`, `.m4v`, `.flv`, `.wmv`) are classified as `'other'` and excluded from video counts unless the local scanner is also updated to support them.

### Test Coverage (R15)

- **R15.** All new behavior is covered by unit or integration tests.

## Scope Boundaries

- Only server-imported courses (`source: 'server'`) are in scope. Local, YouTube, and Drive imports are unchanged.
- Only the inline hover preview on the course card is in scope — the modal dialog preview (click-to-open) already partially supports server videos.
- Only `scanCourseFolderFromServer()` deduplication is in scope — local `scanCourseFolder()` and `scanCourseFolderFromHandle()` are not affected.
- Thumbnail *generation* quality (frame choice aesthetics) is out of scope — only reliability and observability are addressed.
- The existing `useVideoFromHandle` hook is not modified — server preview uses a separate code path.

### Deferred to Separate Tasks

- Hover preview for YouTube and Drive courses: future iteration if needed
- Video metadata extraction (duration, resolution) during server import: deferred to a separate performance optimization story

## Context & Research

### Relevant Code and Patterns

- [src/app/components/figma/ImportedCourseCard.tsx](src/app/components/figma/ImportedCourseCard.tsx) — The hover preview effect at lines 192-231 excludes `course.source === 'server'`. The modal dialog preview at lines 179-190 already partially supports server URLs via `previewSrc = firstVideo!.serverUrl!`.
- [src/hooks/useCourseCardPreview.ts](src/hooks/useCourseCardPreview.ts) — Composes `useHoverPreview(1000)` (1s delay) with `useReducedMotion`. Returns `showPreview`, `videoReady`, `previewHandlers`, and popover guard.
- [src/hooks/useHoverPreview.ts](src/hooks/useHoverPreview.ts) — Pure hover-with-delay hook. Timer-based, returns `{ active, handlers }`.
- [src/hooks/useVideoFromHandle.ts](src/hooks/useVideoFromHandle.ts) — Creates blob URLs from `FileSystemFileHandle`. Only works with local files; not applicable to server URLs.
- [src/lib/autoThumbnail.ts](src/lib/autoThumbnail.ts) — `autoGenerateThumbnailFromServer()` calls `extractFrameFromServerVideo()` which creates an offscreen `<video>`, seeks, and captures via canvas.
- [src/lib/thumbnailService.ts](src/lib/thumbnailService.ts) — `resizeImageToBlob()`, `fetchThumbnailFromUrl()`, `saveCourseThumbnail()`. Shared thumbnail persistence layer.
- [src/lib/courseServerService.ts](src/lib/courseServerService.ts) — `scanCourseFolderFromServer()` performs BFS traversal, `parseAutoindex()` parses nginx HTML, `fetchDirectoryListing()` fetches and parses.
- [src/lib/courseImport.ts](src/lib/courseImport.ts) — `persistScannedCourse()` orchestrates the full import pipeline including thumbnail generation at lines 935-967.
- [src/data/types.ts](src/data/types.ts) — `CourseSource = 'local' | 'youtube' | 'drive' | 'server'`. `ImportedVideo` has optional `serverUrl?: string`.

### Institutional Learnings

- **[course-import-data-integrity-2026-07-10.md](docs/solutions/database-issues/course-import-data-integrity-2026-07-10.md)** — Fix 4 documents the exact silent-catch pattern this plan addresses: hardcoded error strings (`'Failed to import'`) discarding actual `err.message`. The fix preserves the actual error and adds `console.error` as a diagnostic channel. Directly applicable to Unit 2's logging improvements.
- **[html5-video-scrub-preview-thumbnails-2026-06-08.md](docs/solutions/best-practices/html5-video-scrub-preview-thumbnails-2026-06-08.md)** — Warns that cross-origin video sources cause tainted-canvas errors unless CORS headers are present. The `extractThumbnailFromVideo` function in `thumbnailService.ts` works for same-origin blob URLs but will throw `SecurityError` for cross-origin server URLs without proper CORS headers. Unit 2's validation step addresses this by checking CORS headers before attempting extraction.
- **[implementation-lessons-url-batch-import-2026-06-28.md](docs/solutions/developer-experience/implementation-lessons-url-batch-import-2026-06-28.md)** — Documents the `FolderEntry` discriminated-by-convention pattern where `handle` and `serverUrl` are mutually exclusive fields on the same interface. The Lesson 3 branching pattern (scan step branches on source; downstream steps are source-agnostic) is the architecture Unit 1 extends: the card component must also branch at the preview source boundary.
- **[implementation-lessons-deferred-issues-hardening-2026-06-28.md](docs/solutions/developer-experience/implementation-lessons-deferred-issues-hardening-2026-06-28.md)** — Lesson 4 warns that `serverUrl` can be silently lost in multi-step import pipelines when `ImportItem` objects are created. Unit 2 must verify that `serverUrl` propagates correctly through the thumbnail generation path.
- **[stale-error-video-load-transition-2026-06-20.md](docs/solutions/logic-errors/stale-error-video-load-transition-2026-06-20.md)** — Documents the `!handle` guard clause pattern that conflates `undefined` (loading) and `null` (absent). Unit 1's `CoursePreviewSource` discriminated union avoids this by using explicit `type` tags rather than null-ish checks on optional fields.
- **[unified-course-card-shared-shell-pattern-2026-04-20.md](docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md)** — Confirms that `CardCover`, `CompletionOverlay`, and `CoverCornerChip` primitives are shared across all course card variants. The inline preview `<video>` element renders inside `CardCover` — no shell changes needed for Unit 1.

### External References

- Nginx autoindex format is stable and well-documented — no external research needed.
- HTTP Range requests and CORS are standard browser APIs — no external research needed.
- Canvas `drawImage` with `<video>` source is a well-established pattern used throughout this codebase.

## Key Technical Decisions

- **Server preview uses direct `<video src={serverUrl}>` with `crossOrigin="anonymous"`**: Avoids downloading the entire video into a blob. The browser handles HTTP Range requests natively for `preload="metadata"` videos. This is simpler, faster, and avoids memory issues with large video files.
- **`CoursePreviewSource` discriminated union added to `ImportedCourseCard`**: The card component already has partial server awareness for the modal dialog. Formalizing the inline preview source type makes both paths consistent and testable.
- **Thumbnail extraction timeout at 15 seconds**: Balances slow server responses against user-visible hangs. Since thumbnail generation is fire-and-forget, a timeout that falls back to the placeholder is acceptable.
- **Canonical URL normalization in the scanner, not the parser**: Deduplication happens at the collection point (`scanCourseFolderFromServer`) rather than `parseAutoindex`. This keeps the parser pure and makes the dedup logic testable independently.
- **Diagnostics as console output, not a persisted record**: The diagnostics report is logged via `console.info` during import. It is not persisted to IndexedDB or displayed in the UI. This keeps the scope bounded while providing immediate debugging value.

## Open Questions

### Resolved During Planning

- **Should server hover preview use a blob or direct URL?** → Direct URL. HTTP Range request streaming avoids downloading the full video.
- **Should the existing `useVideoFromHandle` hook be extended for server URLs?** → No. A separate code path using a discriminated union type is cleaner and avoids overloading a hook designed for `FileSystemFileHandle`.
- **Should deduplication normalize query parameters?** → Yes, but only preserve meaningful ones. Strip `?t=`, `?v=` tracking params. Keep `?download=1` style params if present. Default to stripping all query params since nginx autoindex doesn't generate them.

### Deferred to Implementation

- Exact shape of `CoursePreviewSource` type: depends on how the existing preview effect is refactored.
- Exact canonical URL normalization regex: depends on real-world URL patterns observed during testing.
- Which query parameters are "meaningful": implement a conservative allowlist approach, refine if real URLs surface exceptions.

## Implementation Units

- [ ] **Unit 1: Server hover preview in ImportedCourseCard**

**Goal:** Enable inline video preview on hover for server-imported courses, matching local import behavior.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`

**Approach:**
1. Define a `CoursePreviewSource` discriminated union type within the component file:
   - `{ type: 'local'; handle: FileSystemFileHandle }`
   - `{ type: 'server'; url: string }`
   - `null`
2. Remove `course.source === 'server'` from the early-return condition in the preview effect (line 193).
3. After querying `db.importedVideos` and finding the first video, determine the preview source:
   - If the video has a `fileHandle` → `{ type: 'local', handle: fileHandle }`
   - If the video has a `serverUrl` but no `fileHandle` → `{ type: 'server', url: serverUrl }`
   - Otherwise → `null`
4. For local sources, continue using `useVideoFromHandle()` to produce `previewBlobUrl`.
5. For server sources, use `firstVideo.serverUrl` directly as the `src` attribute.
6. Compute `inlinePreviewSrc`:
   ```
   previewSource?.type === 'server' ? previewSource.url : previewBlobUrl
   ```
7. Add server-specific loading and error state (separate from the `useVideoFromHandle`-derived `previewLoading`/`previewError`):
   - `serverPreviewLoading`: set to `true` when the server video starts loading, cleared on `onCanPlay`
   - `serverPreviewError`: set to the error message on `onError`, cleared on successful load
   - The existing `previewLoading`/`previewError` from `useVideoFromHandle` cannot be reused — when the handle is null (server video), the hook returns `error: 'file-not-found'` unconditionally
8. Render the server `<video>` element with event handlers and accessibility attributes:
   ```
   <video
     ref={serverVideoRef}
     src={inlinePreviewSrc}
     crossOrigin="anonymous"
     muted
     autoPlay
     playsInline
     loop
     preload="metadata"
     aria-hidden="true"
     onLoadStart={() => setServerPreviewLoading(true)}
     onCanPlay={() => { setServerPreviewLoading(false); setVideoReady(true); }}
     onError={() => setServerPreviewError('Server video failed to load')}
   />
   ```
9. Gate the loading overlay and error badge on the server-specific state:
   - Loading: `showPreview && (previewLoading || serverPreviewLoading)`
   - Error: `showPreview && serverPreviewError && !serverPreviewLoading`
   - The existing "Preview unavailable" badge (line 405) must be extended to also check `serverPreviewError`
10. On hover end (when `showPreview` transitions to `false`), clean up server video resources:
    - Pause the video
    - Remove `src` attribute
    - Call `video.load()` to release network/decoder resources
    - Reset `serverPreviewLoading` and `serverPreviewError`
11. Keep YouTube exclusion intact: `course.source === 'youtube'` continues to skip the preview.

**Patterns to follow:**
- Existing modal dialog preview in the same component (lines 179-190, 876-919) already distinguishes server vs. local videos — mirror that pattern for the inline preview.
- The `useEffect` at lines 192-231 already handles cancellation via a `cancelled` flag — preserve that pattern.

**Test scenarios:**
- Happy path: Server course with `serverUrl` on first video → hover triggers inline `<video>` preview after 1s delay, video plays muted and looped
- Happy path: Local course with `fileHandle` on first video → existing hover preview behavior unchanged
- Happy path: Server course hover ends → video pauses, `src` cleared, `load()` called, network activity stops
- Edge case: Server course with zero videos → no preview attempt, no error
- Edge case: Server course where first video has both `fileHandle` and `serverUrl` → prefer `fileHandle` (local path)
- Edge case: Rapid hover/unhover → only the latest hover state applies (cancellation flag prevents stale async work)
- Edge case: YouTube course → preview exclusion preserved, no regression
- Error path: Server video URL returns 404 or CORS error → preview shows "Preview unavailable" badge (existing error UI at lines 405-412)
- Error path: Server video URL redirects to HTML/login page → video fails to load, "Preview unavailable" shown

**Verification:**
- Hovering a server-imported course card shows a playing muted video preview
- Moving the mouse away stops the preview and releases network resources (verify via browser DevTools Network tab)
- Local course hover preview continues to work unchanged
- YouTube course cards do not attempt hover preview

---

- [ ] **Unit 2: Server thumbnail extraction hardening**

**Goal:** Make server thumbnail generation reliable, observable, and resilient to edge cases.

**Requirements:** R5, R6, R7

**Dependencies:** None (can be done in parallel with Unit 1)

**Files:**
- Modify: `src/lib/autoThumbnail.ts`
- Modify: `src/lib/courseImport.ts`

**Approach:**

In `src/lib/courseImport.ts` (persistScannedCourse, lines 956-965):
1. Add `console.warn` logging to the `autoGenerateThumbnailFromServer` catch block with `courseId`, `videoUrl`, and error detail.
2. Verify that `firstVideo.serverUrl` propagates correctly through the thumbnail generation path by adding a `console.debug` log of the URL at the point `autoGenerateThumbnailFromServer` is called. This addresses the known issue from `implementation-lessons-deferred-issues-hardening-2026-06-28.md` Lesson 4 where `serverUrl` can be silently lost during `ImportItem` creation.

In `src/lib/autoThumbnail.ts` (extractFrameFromServerVideo):
3. Add a 15-second timeout that rejects with a descriptive error if frame extraction doesn't complete.
4. Handle `loadeddata` event in addition to existing `loadedmetadata`/`seeked`.
5. Implement seek retry logic:
   - Primary: `min(duration * 0.1, 3)` seconds
   - Fallback 1: `0.1` seconds
   - Fallback 2: `0` (currentTime 0)
6. Make cleanup idempotent using a `settled` flag:
   - On any resolution path (success, timeout, error), run cleanup exactly once
   - Cleanup: clear `video.src`, call `video.load()`
   - Reject only once using the `settled` flag checked before reject/resolve
   - Use named function references for event handlers so they can be removed with `removeEventListener` during cleanup (or use `AbortController` signal via `addEventListener`'s `{ signal }` option for automatic listener cleanup on abort)
7. Add a pre-capture validation in the `seeked`/`loadeddata` handler:
   - `video.videoWidth > 0 && video.videoHeight > 0`
   - `video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA` (value 2)
   - If not valid, attempt next fallback or reject

**Note on pre-validation (R8/R9):** The existing error-handling paths in `extractFrameFromServerVideo` already detect CORS failures (SecurityError in canvas `toBlob`), format errors (MEDIA_ERR_SRC_NOT_SUPPORTED via `error` event), and network errors. Adding separate HTTP pre-validation requests would add latency per import and duplicate the validation `fetchThumbnailFromUrl` already performs. The diagnostic logging in step 1 makes these failures observable without the pre-validation overhead.

**Patterns to follow:**
- Existing `extractThumbnailFromVideo()` in `thumbnailService.ts` for the event-driven seek/capture pattern
- Existing validation in `fetchThumbnailFromUrl()` in `thumbnailService.ts` for Content-Type checking
- `AbortController` usage in `courseServerService.ts` for timeout patterns

**Test scenarios:**
- Happy path: Valid server video URL → thumbnail generated and persisted, displayed on card
- Happy path: Thumbnail already exists → `autoGenerateThumbnailFromServer` returns early (idempotent)
- Happy path: Explicit user-selected cover → thumbnail generation skipped entirely (priority preserved)
- Happy path: Discovered course image → image used as thumbnail, video extraction skipped
- Happy path: `serverUrl` propagation verified → debug log confirms correct URL at thumbnail call site
- Edge case: Video with `duration = Infinity` (live stream) → seek to 0, extract frame
- Edge case: Video shorter than 3s → seek to `min(duration * 0.1, duration / 2)`
- Edge case: Video with zero `videoWidth`/`videoHeight` at first seek → retry, eventual fallback to placeholder
- Error path: 15-second timeout → logged warning with `[ServerThumbnail]` prefix, card shows gradient placeholder
- Error path: CORS blocks canvas access → `SecurityError` caught by existing `seeked` handler, logged with URL and error detail
- Error path: Video format not supported → `MEDIA_ERR_SRC_NOT_SUPPORTED` caught by existing `error` event handler, logged
- Error path: Network error during video load → caught by existing `error` event, logged
- Error path: `resizeImageToBlob` throws → caught, logged, placeholder shown

**Verification:**
- Server-imported courses show a generated thumbnail (not black/empty)
- Browser console shows `[ServerThumbnail]` warnings with diagnostic detail when generation fails
- Thumbnail generation timeout does not block the import flow
- Thumbnail priority chain (explicit cover → image → video → placeholder) is preserved

---

- [ ] **Unit 3: Server inventory URL deduplication**

**Goal:** Eliminate duplicate file entries during server course scanning and align video format recognition with the local scanner, so URL import counts match local import counts.

**Requirements:** R10, R11, R12, R13, R14, R16

**Dependencies:** None (can be done in parallel with Units 1 and 2)

**Files:**
- Modify: `src/lib/courseServerService.ts` (Part A: extension alignment, `canonicalizeUrl` helper)
- Modify: `src/lib/courseImport.ts` (Part B: dedup logic in `scanCourseFolderFromServer` at line 1608)

**Approach:**

**Part A — Extension set alignment (R16):**

1. Audit the two video extension sets:

   - Server scanner (`courseServerService.ts` lines 37-47): `.mp4`, `.mkv`, `.webm`, `.ts`, `.mov`, `.avi`, `.m4v`, `.flv`, `.wmv` (9 formats)
   - Local scanner (`fileSystem.ts`): `.mp4`, `.mkv`, `.avi`, `.webm`, `.ts` (5 formats)

2. Remove the 4 extra formats (`.mov`, `.m4v`, `.flv`, `.wmv`) from `VIDEO_EXTENSIONS` in `courseServerService.ts` so the server scanner classifies them as `'other'` — matching local import behavior.
3. Files with these extensions will still appear in the directory listing (classified as `'other'`) but won't be counted as videos, PDFs, images, or captions. This preserves discoverability without inflating counts.

**Part B — Canonical URL deduplication (R10, R11, R12, R13):**

1. Add a `seenFileUrls: Set<string>` to `scanCourseFolderFromServer()`.
2. Define a `canonicalizeUrl(url: string): string` helper:
   - Parse with `new URL()`
   - Remove URL fragment (`#...`)
   - Normalize duplicate slashes in pathname (e.g., `//` → `/`)
   - Decode and re-encode the pathname to normalize encoding variants
   - Strip query parameters by default (nginx autoindex doesn't generate them)
   - Preserve only known-meaningful query params via an allowlist if needed
   - Return the normalized href
3. Before adding any video, PDF, image, or caption file to its respective array, compute its canonical URL and check `seenFileUrls`. Skip if already seen.
4. Deduplicate `pendingDirs` by canonical URL:
   - Normalize directory URLs (strip trailing slash, normalize encoding)
   - Skip directories whose canonical URL is already in the `seen` set
   - Skip parent-directory links (`../`) — already filtered by `parseAutoindex`
   - Skip directory URLs outside the course base URL path
   - Skip directory aliases that resolve to an already-scanned canonical URL
5. Track skip counts for diagnostics:
   - `duplicateVideoUrls: string[]` — first 20 duplicate video URLs
   - `duplicatePdfUrls: string[]` — first 20 duplicate PDF URLs
   - `duplicateDirUrls: string[]` — first 20 duplicate directory URLs
6. After the scan completes but before building the `ScannedCourse`, emit a diagnostics report:
   ```
   console.info('[scanServer] Import diagnostics:', {
     courseName,
     uniqueDirs: seen.size,
     uniqueVideos: videos.length,
     duplicateVideosSkipped: duplicateVideoUrls.length,
     uniquePdfs: pdfs.length,
     duplicatePdfsSkipped: duplicatePdfUrls.length,
     firstDuplicateVideoUrls: duplicateVideoUrls.slice(0, 20),
     firstDuplicateDirUrls: duplicateDirUrls.slice(0, 20),
   })
   ```

**Patterns to follow:**
- The existing `seen` Set and BFS pattern in `scanCourseFolderFromServer()` for directory tracking
- The existing `normalizeBaseUrl()` helper in `courseServerService.ts` for trailing-slash normalization
- `parseAutoindex()` already filters `../` — don't duplicate that logic

**Test scenarios:**
- Happy path: Scan a server folder with no duplicates → all files counted exactly once
- Happy path: Scan a server folder where symlinks cause duplicate entries → duplicates skipped
- Happy path: Scan a server folder with URL-encoded path variants → canonical normalization deduplicates
- Happy path: Scan a server folder with `.mov`/`.m4v`/`.flv`/`.wmv` files → classified as `'other'`, not counted as videos
- Happy path: Scan a server folder with `.mp4`/`.mkv`/`.avi`/`.webm`/`.ts` files → still classified as videos (no regression)
- Happy path: Repeated import of the same server URL → idempotent (existing re-import logic handles this)
- Edge case: Directory URL with and without trailing slash → treated as same directory
- Edge case: File URLs with fragment (`#anchor`) → fragment stripped before dedup check
- Edge case: File URLs with double slashes (`//`) → normalized before dedup check
- Edge case: Directory entry that is a symlink back to an ancestor directory → not followed (outside base URL check)
- Edge case: Empty server folder with no files → scan completes, zero counts
- Edge case: Server folder where every file is a duplicate → all skipped, diagnostics report shows full duplicate list
- Error path: Network error fetching a subdirectory → that directory is skipped, other directories continue
- Integration: Compare import of "Real Vision Academy - Real Investing Course" via URL vs. local → equivalent video/PDF counts

**Verification:**
- URL import of a course reports the same video count as local import of the same folder
- Console diagnostics report shows deduplication statistics during import
- No regression in server scan functionality for folders without duplicates

---

- [ ] **Unit 4: Tests for server course card parity**

**Goal:** Add test coverage for all three fix areas to prevent regression.

**Requirements:** R15

**Dependencies:** Units 1, 2, 3 (test against the fixed behavior)

**Files:**
- Modify: `src/lib/__tests__/autoThumbnail.test.ts` (extend existing tests with server thumbnail coverage)
- Modify: `src/lib/__tests__/courseServerService.test.ts` (extend existing tests with canonicalizeUrl and dedup coverage)
- Modify: `tests/e2e/story-e69-s02.spec.ts` (or create a dedicated spec if more appropriate)

**Approach:**

Unit tests (Vitest):
1. `autoThumbnail.test.ts`:
   - Mock `document.createElement('video')` to test `extractFrameFromServerVideo`:
     - Successful frame capture with `loadeddata` + `seeked` events
     - Timeout after 15 seconds
     - Seek fallback chain (10% → 0.1s → 0)
     - CORS blocking (canvas `toBlob` throws SecurityError)
     - Video error event (MEDIA_ERR_SRC_NOT_SUPPORTED)
     - Idempotent cleanup (only one rejection, listeners removed)
     - Zero-dimension video (videoWidth=0, videoHeight=0) → retry
     - Valid dimension video → successful capture
   - Test `autoGenerateThumbnailFromServer`:
     - Idempotent when thumbnail already exists
     - Calls `extractFrameFromServerVideo` and persists result

2. `courseServerService.test.ts`:
   - Test `canonicalizeUrl`:
     - Removes fragments
     - Normalizes double slashes
     - Normalizes encoding variants
     - Strips query parameters
   - Test deduplication in scan results:
     - Same file URL appearing twice → counted once
     - Directory with and without trailing slash → scanned once
     - File with URL-encoded path vs. decoded path → same canonical URL
   - Test parent-directory exclusion:
     - Directory link outside course base URL → not followed
   - Test diagnostics report shape:
     - Unique counts match actual array lengths
     - Duplicate arrays populated when duplicates found

E2E tests (Playwright):

<!-- markdownlint-disable MD029 -->
3. Server course card hover preview:
   - Mock a server course entry with `serverUrl` via IndexedDB seeding
   - Hover the card → verify `<video>` element appears in the card cover
   - Move mouse away → verify video is paused and `src` is cleared
4. Server thumbnail display:
   - Seed a course with a pre-generated thumbnail in `courseThumbnails`
   - Verify thumbnail image renders in the card (not the gradient placeholder)
5. Failed server preview:
   - Seed a server course with an invalid `serverUrl`
   - Hover card → verify "Preview unavailable" badge appears (not a crash)
<!-- markdownlint-enable MD029 -->

**Execution note:** Write unit tests test-first where feasible — the new pure functions (`canonicalizeUrl`, validation helpers) are well-suited for TDD.

**Patterns to follow:**
- Existing Vitest tests in `src/stores/__tests__/` for mock patterns
- Existing E2E tests in `tests/e2e/` for IndexedDB seeding patterns via Playwright fixtures
- `FIXED_DATE` for deterministic time in tests (per [testing/test-patterns.md](.claude/rules/testing/test-patterns.md))

**Verification:**
- `npm run test:unit` passes with new unit tests
- `npm run test:e2e` passes with new E2E scenarios
- Coverage includes happy path, error path, and edge cases for all three fix areas

## System-Wide Impact

- **Interaction graph:** `ImportedCourseCard` → `useCourseCardPreview` → `useHoverPreview`. No callback/middleware changes. The preview effect is self-contained within the card component.
- **Error propagation:** Thumbnail and preview failures are non-fatal — they surface via `console.warn` and the "Preview unavailable" badge. No toast or modal errors are added.
- **State lifecycle risks:** The `CoursePreviewSource` state in `ImportedCourseCard` is local React state, cleaned up on unmount via the existing `cancelled` flag pattern. Server video cleanup (pause, clear src, load) must run reliably on hover-end — a ref-based approach ensures the `<video>` element is accessible for cleanup even if the component re-renders.
- **API surface parity:** The `scanCourseFolderFromServer` function signature does not change — only internal deduplication logic. No callers need updates.
- **Integration coverage:** Server scan + persist + card render is the critical integration path. The E2E tests in Unit 4 cover this.
- **Unchanged invariants:**
  - Local course import flow (scanCourseFolder → persistScannedCourse) is not modified
  - YouTube course card behavior is not modified
  - Drive course card behavior is not modified
  - The `useVideoFromHandle` hook is not modified
  - The Dexie schema is not modified
  - The sync/syncableWrite pipeline is not modified

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Some nginx servers may not support Range requests or return correct CORS headers, causing server preview to fail silently | The "Preview unavailable" badge handles this gracefully; validation in Unit 2 catches it early |
| Canonical URL normalization may not cover all edge cases (IDN, IPv6, unusual encodings) | Conservative implementation — only normalize what we've observed. Log unexpected patterns for future refinement |
| Idempotent cleanup race: `extractFrameFromServerVideo` could theoretically reject twice if both timeout and error fire | The `settled` flag pattern (single boolean, checked before reject/resolve) prevents double-settlement |
| E2E tests for server preview require a reachable video server or mocked fetch | Use Playwright route interception to mock video responses rather than requiring a live server |

## Sources & References

- **Origin document:** Feature description in the invoking command (no separate requirements document)
- Related code: [src/app/components/figma/ImportedCourseCard.tsx](src/app/components/figma/ImportedCourseCard.tsx)
- Related code: [src/lib/autoThumbnail.ts](src/lib/autoThumbnail.ts)
- Related code: [src/lib/thumbnailService.ts](src/lib/thumbnailService.ts)
- Related code: [src/lib/courseServerService.ts](src/lib/courseServerService.ts)
- Related code: [src/lib/courseImport.ts](src/lib/courseImport.ts)
- Related code: [src/hooks/useCourseCardPreview.ts](src/hooks/useCourseCardPreview.ts)
- Related code: [src/hooks/useHoverPreview.ts](src/hooks/useHoverPreview.ts)
- Related code: [src/hooks/useVideoFromHandle.ts](src/hooks/useVideoFromHandle.ts)
- Related code: [src/data/types.ts](src/data/types.ts)
