---
title: "fix: ABS ebook reader shows blank page"
type: fix
status: active
date: 2026-05-07
---

# fix: ABS ebook reader shows blank page

## Overview

ABS-synced ebooks render a blank screen in the reader. The root cause is a format-preservation rule in `bulkUpsertAbsBooks` that prevents existing ABS books from being reclassified after the format-detection feature landed. A secondary gap is that `fetchRemoteEpub` does not validate the response body is actually a ZIP/EPUB before handing it to epub.js, so non-EPUB content (PDFs, HTML error pages) produces a silent blank render instead of a clear error.

## Problem Frame

Before 2026-05-06, every ABS library item was hardcoded as `format: 'audiobook'`. Commit `40fe5f5a` added `detectFormat()` which correctly distinguishes ebooks (no narrators, no duration) from audiobooks. But `bulkUpsertAbsBooks` at `src/stores/useBookStore.ts:598` preserves `existing.format` during merge — so any book synced before the feature stays `'audiobook'` permanently. When the user opens it, `BookReader` renders `AudiobookRenderer` instead of the EPUB path. The audiobook player has no audio to play, producing the blank-screen symptom.

Even after fixing format migration, a second gap exists: `fetchRemoteEpub` in `BookContentService.ts` passes whatever the ABS server returns directly to epub.js with no content-type or magic-byte validation. If the server returns a PDF, an HTML error page (with 200 OK), or an empty body, epub.js fails silently — the iframe renders blank, and the user sees nothing until the 12-second timeout fires.

## Requirements Trace

- R1. ABS ebooks open in the EPUB reader and display their content
- R2. Existing ABS books (synced before format detection) migrate to the correct format on next sync
- R3. Non-EPUB content from the ebook endpoint surfaces a clear error, not a blank screen

## Scope Boundaries

- Only ABS-synced ebooks (`source.type === 'remote'` with Bearer auth)
- Format detection heuristic is unchanged — this plan fixes the merge rule and adds content validation
- Does not add PDF rendering support (PDFs that reach the EPUB reader will show a clear error)
- Does not change audiobook format detection or audiobook rendering

## Context & Research

### Relevant Code and Patterns

- `src/app/hooks/useAudiobookshelfSync.ts:144-221` — `mapAbsItemToBook()`: constructs remote ebook Book records
- `src/stores/useBookStore.ts:579-641` — `bulkUpsertAbsBooks()`: merge logic that preserves `existing.format`
- `src/services/BookContentService.ts:113-224` — `fetchRemoteEpub()`: fetches EPUB from ABS, caches result
- `src/app/pages/BookReader.tsx:485-522` — EPUB content loading effect; lines 1155-1203 — render conditions
- `src/app/components/reader/EpubRenderer.tsx:277-283` — passes `url` to `<EpubView>`
- `node_modules/epubjs/src/book.js:419-421` — `determineType()` returns `BINARY` for non-string input
- `node_modules/epubjs/src/book.js:251-254` — `open()` sets `this.archived = true` for binary input

### Institutional Learnings

- `docs/solutions/integration-issues/2026-04-24-abs-browser-direct-bearer-auth.md` — ABS REST calls use Bearer auth directly from the browser; covers and audio use `?token=` query param. Ebook downloads use the Bearer header path correctly.
- `docs/solutions/ui-bugs/library-shelf-sizing-hover-consistency-2026-05-05.md:173` — Format indicators must remain distinguishable without interaction. Not directly related but confirms format-awareness across the app.

### External References

- ABS API: `/api/items/:id/ebook/:fileid?` routes to `LibraryItemController.getEBookFile`
- Controller streams via `res.sendFile()` with no explicit Content-Type (Express infers from extension)
- Returns 404 (no body) when no ebook file exists; 400 for invalid file IDs

## Key Technical Decisions

- **Drop format preservation for ABS books**: The merge rule `format: existing.format` was added to prevent format flipping, but it locks in the pre-feature `'audiobook'` default permanently. Removing it for the format field specifically (while keeping it for status/progress/position) lets re-syncs correct the format.
- **Validate EPUB by magic bytes before passing to epub.js**: Check the first 2 bytes of the response for the ZIP magic number (`0x50 0x4B` = `PK`). If absent, throw a descriptive `RemoteEpubError` rather than letting epub.js fail silently. This catches PDFs, HTML error pages, and empty responses immediately.
- **Content-length zero check**: If `response.arrayBuffer()` returns 0 bytes, throw before epub.js receives it.

## Open Questions

### Resolved During Planning

- Q: Is the `/api/items/{id}/ebook` endpoint correct? → A: Yes, confirmed in ABS source at `server/routers/ApiRouter.js` as `GET /items/:id/ebook/:fileid?`.
- Q: Does epub.js support ArrayBuffer input? → A: Yes, `determineType()` returns `BINARY` for non-string inputs, and `open()` routes to `openEpub()` which unzips via JSZip.
- Q: Why preserve format in merge at all? → A: It was added in `a3e6ef5b` as a safety measure to prevent format flipping during re-sync. It correctly protects user-edited formats but incorrectly locks in the old default.
- Q: ZIP magic byte check — 2 bytes or scan? → A: Check the first 2 bytes for `PK` (`0x50 0x4B`). See tradeoff documented in Risks table.
- Q: Do existing users need a one-time migration? → A: No. Dropping the preservation rule is sufficient — the next ABS catalog sync automatically corrects formats.

### Deferred to Implementation

- Whether to also check MIME type from the fetch response headers as a secondary signal (the ZIP magic byte check catches empty/invalid content regardless of Content-Type header)

## Implementation Units

- [ ] **Unit 1: Drop format preservation for ABS books in merge**

**Goal:** Allow re-sync to correct the format of existing ABS books from `'audiobook'` to `'epub'`.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/stores/useBookStore.ts`
- Modify: `src/stores/__tests__/useBookStore.test.ts` (update format preservation regression test at line ~551 to assert catalog format wins)

**Approach:**
- In `bulkUpsertAbsBooks()`, remove `format: existing.format` from the merge object at line 598.
- The spread `...book` (new data from `mapAbsItemToBook`) already contains the correctly detected format, so it will take effect on re-sync.
- Keep all other preserved fields: `id`, `status`, `progress`, `currentPosition`, `lastOpenedAt`, `createdAt`. These are user-data fields that should survive re-sync.
- No migration needed — the next ABS catalog sync automatically corrects formats.

**Patterns to follow:**
- Same merge pattern already in place; just removing one line.

**Test scenarios:**
- Happy path: Existing ABS book with `format: 'audiobook'` is re-synced; after merge, `format` is `'epub'` (pulled from new data).
- Happy path: New ABS book (no existing match) still gets `format: 'epub'` from `mapAbsItemToBook`.
- Edge case: Audiobook with narrators+duration still merges as `'audiobook'` (new format is `'audiobook'`, so no change).
- Edge case: User manually changed format — this is intentionally overwritten on re-sync. Document in commit message that manual format overrides for ABS books are not preserved (ABS is the source of truth for format).
- Regression: Existing test at `src/stores/__tests__/useBookStore.test.ts:551-591` asserts `format` preservation with the comment "Format must be preserved from the existing record." This test must be updated to assert the new behavior: catalog format wins on re-sync, while user-data fields (`status`, `progress`, `currentPosition`) remain preserved.

**Verification:**
- After re-sync, ABS ebooks show `format: 'epub'` in the store and open in the EPUB reader.
- ABS audiobooks remain `'audiobook'` and open in the audiobook player.

---

- [ ] **Unit 2: Validate EPUB content before passing to epub.js**

**Goal:** Surface a clear error when the ABS ebook endpoint returns non-EPUB content, instead of a silent blank screen.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/services/BookContentService.ts`
- Test: `src/services/__tests__/BookContentService.test.ts` (add validation tests to existing suite; file already exists with 384 lines covering fetch, auth, caching, and error handling)

**Approach:**
- In `fetchRemoteEpub()`, after `response.arrayBuffer()`, add two checks before returning:
  1. **Empty body check**: If `arrayBuffer.byteLength === 0`, throw `RemoteEpubError('Server returned empty content.', 'server', hasCached)`.
  2. **ZIP magic byte check**: Read the first 2 bytes of the ArrayBuffer via `new Uint8Array(arrayBuffer, 0, 2)`. The ZIP magic number is `[0x50, 0x4B]` (`PK`). If they don't match, throw `RemoteEpubError('The server returned a file that is not a valid EPUB. The file may be in an unsupported format.', 'unsupported-format', hasCached)`.
- Add `'unsupported-format'` to the `RemoteEpubErrorCode` union type.
- Both checks run before caching, so invalid content is never cached.

**Execution note:** The existing test suite at `src/services/__tests__/BookContentService.test.ts` (384 lines) covers fetch, auth headers, and error handling. Add tests for the new validation checks before modifying `fetchRemoteEpub`.

**Patterns to follow:**
- Same error pattern as existing `RemoteEpubError` throws for 401, 403, 404, timeout, and network errors.

**Test scenarios:**
- Happy path: Valid EPUB (starts with `PK`) passes validation and is returned.
- Error path: Empty ArrayBuffer (0 bytes) throws `RemoteEpubError` with code `'server'`.
- Error path: PDF file (starts with `%PDF`) throws `RemoteEpubError` with code `'unsupported-format'`.
- Error path: HTML error page (starts with `<!`) throws `RemoteEpubError` with code `'unsupported-format'`.
- Edge case: EPUB with leading content before ZIP magic (e.g., BOM, whitespace) — rejected with `'unsupported-format'` error. Valid EPUB files must have `PK` at byte 0 per the ZIP specification; a prefix means the source file is corrupted. Early rejection with a clear error is better than epub.js silently failing.
- Integration: Error message is displayed in the reader error UI (existing `loadError` rendering at BookReader.tsx:1161).

**Verification:**
- Opening a PDF from ABS shows "The server returned a file that is not a valid EPUB" error with retry button.
- Opening a valid EPUB from ABS loads normally.
- Empty response shows "Server returned empty content" error.

---

- [ ] **Unit 3: Add unit tests for ABS ebook format detection integration**

**Goal:** Verify the full mapping pipeline correctly produces EPUB-ready book records.

**Requirements:** R1

**Dependencies:** None (can proceed in parallel with Units 1-2)

**Files:**
- Modify: `src/app/hooks/__tests__/useAudiobookshelfSync.map.test.ts`

**Approach:**
- Add a test that verifies `mapAbsItemToBook` produces a book where `format === 'epub'` AND the source URL ends with `/api/items/{id}/ebook`.
- Add a test verifying the source URL for a trailing-slash server URL does not double the path separator.
- These tests already exist partially (lines 282-318); add edge cases for empty API key and URL construction.

**Test scenarios:**
- Happy path: Ebook item → `format: 'epub'`, source URL points to `/api/items/{id}/ebook`.
- Edge case: Server URL with trailing slash → source URL has single `/api/...`.
- Edge case: Empty API key → `source.auth` is `undefined`, book still has correct format and URL.

**Verification:**
- All tests pass (`npx vitest run src/app/hooks/__tests__/useAudiobookshelfSync.map.test.ts`).

## System-Wide Impact

- **Interaction graph:** `bulkUpsertAbsBooks` is called by `useAudiobookshelfSync.syncCatalog()`. The format field change affects how the library page displays the book card (audiobook vs ebook icon) and which reader component opens.
- **Error propagation:** New `RemoteEpubError` code `'unsupported-format'` flows through the existing `loadError` → error UI path in BookReader. No new error boundaries needed.
- **State lifecycle risks:** Removing format preservation means a re-sync could flip a book from audiobook to ebook if the ABS metadata changes (e.g., narrators removed). This is correct behavior — ABS is the source of truth.
- **Unchanged invariants:** `status`, `progress`, `currentPosition`, `lastOpenedAt`, `createdAt` remain preserved during merge. Format switching does not reset reading progress.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| User manually changed format and re-sync overwrites it | ABS is the source of truth for format; manual overrides are not a supported workflow for remote books. Documented in commit message. |
| ZIP magic byte check rejects valid EPUBs with BOM/whitespace prefix | This is intentional — a valid ZIP/EPUB has `PK` at byte 0 per the spec. ABS serves raw files from disk with no transformation, so a prefix means the source is corrupted. Early rejection with a clear error is preferable to epub.js silently failing. |
| Existing books need re-sync to pick up format fix | Users must trigger a manual sync or wait for the next automatic sync. The fix is passive — no immediate migration required. |

## Sources & References

- Origin: User bug report — ABS ebook reader shows blank page
- `src/stores/useBookStore.ts:598` — format preservation line to remove
- `src/services/BookContentService.ts:190` — `response.arrayBuffer()` with no validation
- `src/app/hooks/useAudiobookshelfSync.ts:201` — `mapAbsItemToBook` format assignment
- ABS source: `server/routers/ApiRouter.js` — `GET /items/:id/ebook/:fileid?`
- ABS source: `server/controllers/LibraryItemController.js` — `getEBookFile` streams via `res.sendFile()`
- epub.js source: `node_modules/epubjs/src/book.js:419-421` — `determineType()` returns `BINARY` for ArrayBuffer
- Related commits: `40fe5f5a`, `a3e6ef5b`
