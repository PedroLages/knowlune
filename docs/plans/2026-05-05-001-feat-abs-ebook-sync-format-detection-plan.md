---
title: "feat: Detect ebook format during ABS sync and wire to EPUB reader"
type: feat
status: active
date: 2026-05-05
---

# feat: Detect ebook format during ABS sync and wire to EPUB reader

## Overview

Audiobookshelf (ABS) sync currently hardcodes `format: 'audiobook'` for every synced item. This means ebooks from ABS open in the audiobook player instead of the fully-built EPUB reader. The fix adds format detection to the sync pipeline so ebooks are classified as `'epub'`, wired with the correct content source URL, and `BookContentService` can fetch them with Bearer auth.

## Problem Frame

When a user syncs their ABS library, `mapAbsItemToBook()` stamps every item `format: 'audiobook'` (line 175 of `useAudiobookshelfSync.ts`). The app's routing (`getBookDestinationPath`) and reader dispatch (`BookReader`) both key off `book.format`, so ABS ebooks are routed to `AudiobookRenderer` instead of `EpubRenderer`.

Even if format were correct, two downstream blockers prevent the EPUB from rendering:
1. `source.url` points to the server root, not an EPUB file download endpoint
2. `BookContentService.fetchRemoteEpub()` only handles Basic Auth, not Bearer tokens (which ABS uses)

## Requirements Trace

- **R1.** ABS items that are ebooks must be stored with `format: 'epub'` after sync
- **R2.** ABS items that are audiobooks must remain `format: 'audiobook'` (no regression)
- **R3.** Ebook items must have `source.url` pointing to a fetchable EPUB file endpoint on the ABS server
- **R4.** `BookContentService` must authenticate with Bearer tokens when fetching remote EPUBs
- **R5.** Ebook items must not synthesize dummy audio chapters
- **R6.** Existing audiobooks re-synced after this change must not be reclassified

## Scope Boundaries

- Only ABS sync is in scope — OPDS sync, local imports, and direct EPUB uploads are unchanged
- Format detection uses item-level metadata heuristics (narrators + duration), not library-type lookup
- PDF format detection from ABS is deferred (ABS primarily serves EPUBs for ebooks)
- Manually correcting a misclassified format after sync is deferred to a separate task

### Deferred to Separate Tasks

- **Library-type-based detection**: Fetching and caching ABS library metadata (`mediaType`) during server setup for a stronger format signal
- **Manual format override**: UI for correcting an auto-detected format on individual books
- **PDF support via ABS**: detecting and routing PDF items from ABS

### Deferred to Implementation Verification

- **ABS ebook endpoint confirmation**: Before Unit 1 is complete, verify that `GET /api/items/{id}/ebook` with `Authorization: Bearer <token>` returns the raw ebook file against a real ABS v2.x server. If the endpoint requires the token as a query parameter instead, fall back to `?token=` but document the credential exposure risk.
- **Startup reclassification migration**: Consider a lightweight startup check: for any book with `absItemId` set and `format: 'audiobook'` but no narrator metadata in its stored record, reclassify to `'epub'` without requiring a full re-sync. This fixes pre-existing misclassified items immediately on app load. If this proves complex, defer to the manual format override task above.

## Context & Research

### Relevant Code and Patterns

- `src/app/hooks/useAudiobookshelfSync.ts:121-198` — `mapAbsItemToBook()`: hardcodes `format: 'audiobook'` at line 175, sets `source.url` to server root at line 183, synthesizes dummy audio chapters at lines 137-155
- `src/app/hooks/useAudiobookshelfSync.ts:286-290` — sync loop: filters out non-book `mediaType` but does not distinguish ebook vs audiobook
- `src/services/BookContentService.ts:113-148` — `fetchRemoteEpub()`: only handles Basic Auth (`'username' in source.auth`); no Bearer path
- `src/services/AudiobookshelfService.ts:306-309` — `getCoverUrl()`: pattern for constructing ABS file URLs with `?token=` query param
- `src/data/types.ts:783` — `BookFormat = 'epub' | 'pdf' | 'audiobook'`
- `src/data/types.ts:838-841` — `ContentSource` with `{ type: 'remote'; url: string; auth?: RemoteAuth }`
- `src/data/types.ts:833-835` — `RemoteAuth = { username; password? } | { bearer }`
- `src/data/types.ts:1044-1070` — `AbsLibrary` and `AbsLibraryItem` types
- `src/app/pages/BookReader.tsx` — dispatches `EpubRenderer` vs `AudiobookRenderer` by `book.format`
- `src/stores/useBookStore.ts:579-605` — `bulkUpsertAbsBooks()`: merge preserves existing `id`/`status`/`progress` but **replaces** `format` and `source` from newly-mapped books on re-sync

### Institutional Learnings

- **docs/solutions/best-practices/format-pairing-cross-format-position-translation-2026-04-25.md**: Never call ABS chapter endpoints during library sync (N+1 fan-out). Item-level metadata from the list endpoint is sufficient for format detection.
- **docs/solutions/best-practices/audiobook-prefs-hydration-allow-list-pattern-2026-04-25.md**: Treat external format values as untrusted input. Gate with allow-list membership checks.
- **docs/solutions/sync/abs-sync-qa-fix-patterns-2026-04-24.md**: Auth guards must short-circuit sync cycles on failed credentials; deadlock guard pattern for Promise.all callbacks.
- **docs/solutions/sync/e96-closeout-sync-patterns-2026-04-19.md**: Per-row read-before-write during hydration prevents bulkPut from clobbering locally-set fields.

## Key Technical Decisions

- **Format detection: item metadata heuristic over library-type lookup**: Checking `narrators` and `duration` on each item's `media.metadata` avoids an extra API call (`fetchLibraries`) per sync cycle. Library-type lookup can be added later as a stronger signal without changing the item-mapping interface.
- **Detection rule: positive audiobook signal only**: If an item has narrators AND duration, it's an audiobook. Everything else defaults to `'epub'`. This avoids false audiobook classifications and is conservative — a misclassified audiobook (no narrator metadata) would open in the EPUB reader rather than playing audio, which is less confusing than the reverse.
- **Ebook file URL: Bearer-only auth, no query-param token**: Ebooks use `{serverUrl}/api/items/{itemId}/ebook` with no embedded credentials in the URL. Authentication is handled exclusively by the `Authorization: Bearer` header from `source.auth = { bearer: apiKey }`, which the existing sync infrastructure already sets for all ABS items (line 185 of `useAudiobookshelfSync.ts`). This avoids credential leakage through server logs, CDN caches, proxy logs, browser history, and Referer headers — all of which capture query parameters. Unlike the cover image endpoint (which uses `?token=` because `<img>` tags can't set headers), ebook downloads use `fetch()` where Bearer headers are the correct auth channel.
- **Bearr auth in BookContentService: additive, non-breaking**: The existing Basic Auth path is preserved. Bearer auth is added as a parallel branch, gated on `'bearer' in source.auth`, following the `RemoteAuth` discriminated union. This is the mechanism that delivers the API key for the ebook download.

## Implementation Units

- [ ] **Unit 1: Format detection and ebook wiring in mapAbsItemToBook**

**Goal:** Detect whether an ABS item is an ebook or audiobook from its media metadata, and set `format`, `source.url`, and `chapters` accordingly.

**Requirements:** R1, R2, R3, R5

**Dependencies:** None

**Files:**
- Modify: `src/app/hooks/useAudiobookshelfSync.ts`
- Test: `src/app/hooks/__tests__/useAudiobookshelfSync.map.test.ts` (new)

**Approach:**
- Extract a `detectFormat(absItem: AbsLibraryItem): BookFormat` helper that checks narrators and duration
- Use the same narrator resolution as existing code: normalize from both `narrators` (handling `string | { name: string }` shapes) and `narratorName` (comma-separated string) fallback paths before checking non-emptiness
- Use the same duration fallback as existing code: `absItem.media.metadata.duration || absItem.media.duration`
- If item has non-empty narrators AND a positive duration → `'audiobook'`
- Otherwise → `'epub'`
- In `mapAbsItemToBook`: call `detectFormat()`, conditionally set `source.url` — for ebooks use `{serverUrl}/api/items/{itemId}/ebook` (no query-param token; auth handled by Bearer header in `source.auth`, which is already set for all ABS items at line 185); for audiobooks keep existing server root URL
- Skip dummy chapter synthesis for ebooks (return empty `chapters` array or omit the fallback)
- Gate the format through an allow-list (`VALID_FORMATS`) before returning

**Patterns to follow:**
- Existing `source.auth.bearer` handling at line 185 of `useAudiobookshelfSync.ts` (already sets `{ bearer: apiKey }` for all ABS items)
- Inline the same `replace(/\/+$/, '')` trailing-slash stripping already used at line 183 of `useAudiobookshelfSync.ts`, or export `normalizeBaseUrl` from `AudiobookshelfService.ts`

**Test scenarios:**
- Happy path: ABS item with narrators=["Jane Doe"] and duration=3600 → `format: 'audiobook'`, keeps server root URL
- Happy path: ABS item with no narrators and no duration → `format: 'epub'`, gets ebook download URL without embedded credentials (auth via Bearer header)
- Happy path: ABS item with empty narrators array and no duration → `format: 'epub'`
- Edge case: ABS item with narrators but no duration → `format: 'epub'` (needs both signals)
- Edge case: ABS item with duration but no narrators → `format: 'epub'` (needs both signals)
- Edge case: ABS item with narrators=["Solo"] and duration=0 → `format: 'epub'` (zero duration treated as absent)
- Edge case: Ebook chapters array is empty (no dummy audio chapter synthesized)
- Integration: `bulkUpsertAbsBooks` merge preserves existing book `id` while updating `format` and `source` on re-sync

**Verification:**
- Sync an ABS server with ebooks → ebooks appear in library with `format: 'epub'` and correct ebook download URL
- Sync an ABS server with audiobooks → audiobooks remain `format: 'audiobook'` (no regression)
- Ebook items navigate to `/library/:id/read` and render `EpubRenderer`

---

- [ ] **Unit 2: Bearer auth support in BookContentService.fetchRemoteEpub**

**Goal:** Extend `fetchRemoteEpub()` to send Bearer tokens when `source.auth` uses the `{ bearer }` variant, so ABS ebook downloads authenticate correctly.

**Requirements:** R4

**Dependencies:** Unit 1 (ebooks must have `format: 'epub'` and correct `source.url` before this matters; `source.auth = { bearer: apiKey }` is already set for all ABS items by the existing sync infrastructure at line 185 of `useAudiobookshelfSync.ts`)

**Files:**
- Modify: `src/services/BookContentService.ts`
- Test: `src/services/__tests__/BookContentService.test.ts` (new, or extend existing)

**Approach:**
- In `fetchRemoteEpub()`, before the `fetch()` call, add a branch: if `source.auth` has `'bearer' in source.auth`, set `Authorization: Bearer ${source.auth.bearer}`
- Preserve existing Basic Auth path unchanged
- The `RemoteAuth` discriminated union already supports both variants — no type changes needed

**Patterns to follow:**
- Existing Basic Auth header construction at lines 131-148 of `BookContentService.ts`

**Test scenarios:**
- Happy path: `source.auth = { bearer: 'token123' }` → fetch includes `Authorization: Bearer token123` header
- Happy path: `source.auth = { username: 'u', password: 'p' }` → fetch includes `Basic` header (existing behavior preserved)
- Edge case: `source.auth` is undefined → no Authorization header sent
- Edge case: `source.auth = { bearer: '' }` → sends `Authorization: Bearer ` (empty token, ABS returns 401)
- Error path: ABS returns 401 with Bearer token → `RemoteEpubError` with `type: 'auth'` thrown, cache fallback checked

**Verification:**
- Fetch an EPUB from ABS with Bearer auth → file downloads and renders
- Fetch an EPUB with Basic auth (OPDS) → still works (no regression)

---

- [ ] **Unit 3: Type update for AbsLibrary.mediaType**

**Goal:** Broaden the `AbsLibrary.mediaType` type to accept `'ebook'` (which newer ABS versions return) so the field doesn't lose type safety.

**Requirements:** Non-blocking polish

**Dependencies:** None

**Files:**
- Modify: `src/data/types.ts`

**Approach:**
- Change `AbsLibrary.mediaType` from `string // 'book' | 'podcast'` to `'book' | 'podcast' | 'ebook' | (string & {})` (exhaustive union with string fallback for forward compatibility)
- This is a non-breaking widening — all existing code that checks `mediaType === 'book'` continues to work

**Patterns to follow:**
- The `(string & {})` pattern preserves autocomplete for known values while accepting unknown future values

**Test scenarios:**
- Test expectation: none — type-level change only, verified by `npx tsc --noEmit`

**Verification:**
- TypeScript compilation passes with no new errors

## System-Wide Impact

- **Interaction graph:** `mapAbsItemToBook` → `bulkUpsertAbsBooks` → Dexie `books` table → `getBookDestinationPath` → `BookReader` dispatch. The format field ripples through routing and reader selection. No callbacks, middleware, or observers are affected.
- **Error propagation:** If Bearer auth fails in `BookContentService`, the existing `RemoteEpubError` with cache-fallback logic handles it. No new error paths are introduced.
- **State lifecycle risks:** `bulkUpsertAbsBooks` replaces `format` and `source` on re-sync. A properly-tagged audiobook (with both narrators and duration in ABS metadata) will not be reclassified. However, audiobooks that lack narrator metadata in ABS may be reclassified as `'epub'` on re-sync (see Risks table). An ebook previously misclassified as audiobook will be corrected on next sync.
- **API surface parity:** The ABS ebook download endpoint (`/api/items/{id}/ebook`) uses Bearer header auth (via `source.auth`, wired by Unit 2), unlike the cover endpoint which uses `?token=` query params (necessary because `<img>` tags can't set headers). Both endpoints are authenticated; they differ in auth channel because their consumers have different capabilities.
- **Integration coverage:** The full chain (sync → store → route → reader → content fetch) spans 5 modules. E2E test coverage of an ebook sync-and-read flow is recommended but not required for this plan (the ABS test server fixture would need ebook items).
- **Unchanged invariants:** Podcast filtering (`mediaType !== 'book'`) is preserved. OPDS sync is untouched. Local EPUB imports are untouched. The `RemoteAuth` type is unchanged. Audiobook playback is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Some audiobooks lack narrator metadata in ABS, causing false `'epub'` classification | Detection requires BOTH narrators AND duration. If a real audiobook has neither, it's a data quality issue on the ABS side. Users can re-sync after fixing ABS metadata. Manual format override is deferred to a follow-up. |
| ABS ebook download endpoint may differ across ABS versions | The `/api/items/{id}/ebook?token=` pattern is standard in ABS v2.x. If an older server returns 404, the existing error handling in `BookContentService` surfaces it. |

## Sources & References

- **Related code:** `src/app/hooks/useAudiobookshelfSync.ts:121-198` (mapAbsItemToBook), `src/services/BookContentService.ts:113-148` (fetchRemoteEpub), `src/services/AudiobookshelfService.ts:306-309` (getCoverUrl pattern)
- **Related plans:** `docs/plans/2026-04-19-015-feat-e95-s05-opds-abs-server-sync-plan.md` (ABS sync infrastructure)
- **Institutional:** `docs/solutions/best-practices/format-pairing-cross-format-position-translation-2026-04-25.md`, `docs/solutions/best-practices/audiobook-prefs-hydration-allow-list-pattern-2026-04-25.md`
