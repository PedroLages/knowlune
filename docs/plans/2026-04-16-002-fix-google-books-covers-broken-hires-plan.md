---
title: 'fix: Repair Google Books covers in Edit Book Details and enable hi-res cover selection'
type: fix
status: active
date: 2026-04-16
deepened: 2026-04-16
---

## fix: Repair Google Books covers in Edit Book Details and enable hi-res cover selection

## Overview

Two related cover image bugs in the "Edit Book Details" modal make Google Books covers non-functional:

1. **Bug 1 — Existing cover broken on modal open**: The editor passes `book.coverUrl` (a custom `opfs-cover://bookId` protocol string) directly to an `<img src>`, which browsers cannot render. The `useBookCoverUrl` hook already solves this for the rest of the app but is not used in the editor.

2. **Bug 2 — Google Books cover selection fails silently**: When the user selects a Google Books result from the search grid, `handleSelectResult` calls `fetch(result.coverUrl)` which fails with a CORS error. `books.google.com` never returns `Access-Control-Allow-Origin` headers — this is intentional Google CDN behavior. iTunes covers (via `*.mzstatic.com`) work because that CDN is CORS-enabled. Google Books thumbnails in `CoverSearchGrid` also fail silently due to a missing `books.google.com` entry in the CSP `img-src`.

Additionally, the current `zoom=1` thumbnail should be upgraded to `zoom=6` (the `extraLarge` image) when a result is selected, and the `edge=curl` visual artifact should be stripped from cover URLs.

## Problem Frame

Both bugs produce the same visible symptom — broken cover images — but have different root causes and live in different layers:

- **Bug 1** is in `BookMetadataEditor.tsx`: the `useEffect` that initializes the cover preview on modal open passes the raw storage protocol string instead of resolving it to a `blob:` URL.
- **Bug 2** is architectural: the browser cannot `fetch()` from `books.google.com` due to CORS, and the CSP blocks `<img>` from loading Google Books thumbnails. The fix requires a server-side proxy route (matching the established ABS proxy pattern) and a CSP update.
- **Resolution quality** is a tertiary improvement: replace `zoom=1` with `zoom=6` and strip `edge=curl` in the `coverUrl` for selected results.

## Requirements Trace

- R1. Opening the editor for a book with an OPFS-stored cover shows the correct cover image (not a placeholder)
- R2. Selecting a Google Books result in the cover search grid applies the cover to the editor preview
- R3. Google Books cover thumbnails render correctly in the `CoverSearchGrid` (no broken image icons)
- R4. The cover applied from Google Books is the highest resolution available from the search endpoint (zoom=6, no edge=curl)
- R5. Selected covers from all providers are persisted to OPFS on save (offline access preserved)
- R6. Modal close during an in-progress cover fetch does not corrupt state or create orphaned blob URLs

## Scope Boundaries

- No change to the save/OPFS persistence path — only the preview and fetch paths are changed
- No `fetch` from the `/volumes/{id}` detail endpoint (would require rate-limit management; the `zoom=6` URL from the search endpoint is sufficient for the quality goal)
- No changes to iTunes or OpenLibrary cover handling (already working correctly)
- No CSP changes beyond adding `books.google.com` to `img-src`

### Deferred to Separate Tasks

- Audible/Audnexus cover proxy (mentioned in prior plans as a separate unit)
- Cover lazy-loading or progressive enhancement in `CoverSearchGrid`
- `CoverSearchGrid` `selectedKey` stale state on re-search (minor visual inconsistency, not a cover bug)

## Context & Research

### Relevant Code and Patterns

- `src/app/components/library/BookMetadataEditor.tsx` — both bugs live here; lines 140-170 (Bug 1 useEffect), lines 260-300 (Bug 2 handleSelectResult)
- `src/app/hooks/useBookCoverUrl.ts` — canonical `isCancelled` guard pattern for async blob resolution; replicate in the editor useEffect
- `src/app/components/library/EditorCoverSection.tsx` — renders `<img src={coverPreviewUrl}>` with `onError` → `setImgError`; `isFetchingCover` prop controls spinner overlay
- `src/app/components/library/CoverSearchGrid.tsx` — uses `result.thumbnailUrl ?? result.coverUrl` as `<img src>`; thumbnails from Google Books are `books.google.com` domain, currently missing from CSP
- `src/services/GoogleBooksService.ts` — constructs `coverUrl` as `zoom=0` (valid), `thumbnailUrl` as `zoom=1`; the `edge=curl` parameter is not stripped here
- `src/services/CoverSearchService.ts` — `MetadataSearchResult` type; `provider` field distinguishes Google Books from iTunes
- `server/index.ts` — existing Express server (port 3001); AI proxy, calendar router, and middleware chain; target for the new cover proxy route
- `index.html` line 24 — CSP `img-src` currently missing `books.google.com`; `connect-src` already includes `books.google.com` (not needed there, needed in `img-src`)

### Institutional Learnings

- The ABS proxy decision (`project_abs_cors_proxy.md`): when a third-party service blocks CORS, the established pattern is a server-side Express proxy route. Server-to-server calls bypass CORS entirely and keep images in OPFS for offline access.
- `useBookCoverUrl` (`src/app/hooks/useBookCoverUrl.ts`): the `isCancelled` flag + `effectBlobUrl` variable inside the `useEffect` closure is the correct pattern for async blob URL lifecycle management. Copying this pattern avoids the race condition where a rapid open/close/open cycle causes a stale async result to overwrite the fresh one.

### External References

- **Google Books API image CORS**: `books.google.com/books/content` never returns `Access-Control-Allow-Origin`. Intentional Google CDN behavior — no configuration can change it.
- **Zoom parameter values**: `zoom=6` = `extraLarge` (~1280px wide) — the largest available from a search-endpoint URL. `zoom=0` is an undocumented alias for the same size but `zoom=6` is semantically clearer.
- **`edge=curl` parameter**: adds a visual page-curl artifact to the cover image. Stripping it via `.replace(/&edge=curl/, '')` yields a clean rectangular cover.
- **Server-side proxy for CORS bypass**: the proxy fetches the image server-to-server (no CORS constraint) and streams it back to the browser as a same-origin response.

## Key Technical Decisions

- **Server-side proxy for Google Books images** (not deferred HTTPS URL or canvas-taint workaround): Storing `https://books.google.com/...` as `book.coverUrl` would require network at every display and would bypass OPFS consistency. The canvas-taint path is not viable (Google Books CDN never sends CORS headers, making canvas `toBlob()` throw a `SecurityError`). The proxy approach is consistent with the ABS proxy decision and preserves offline access.

- **Replicate `isCancelled` guard directly in Bug 1 useEffect** (not via `useBookCoverUrl` hook): `BookMetadataEditor` already manages `coverPreviewUrl` state via `setSafeCoverPreviewUrl` (which handles blob URL revocation). Introducing `useBookCoverUrl` would split cover lifecycle management across two state managers. The `isCancelled` pattern is replicated directly — same safety guarantee, no new state coupling. Critical detail: `blobUrl` must be nulled out after being handed to `setSafeCoverPreviewUrl` so the cleanup function does not double-revoke it (`setSafeCoverPreviewUrl` already owns the lifecycle of that URL).

- **Upgrade `coverUrl` to `zoom=6` in `GoogleBooksService`** (not in `handleSelectResult`): URL quality belongs in the service layer. The `thumbnailUrl` stays at `zoom=1` (fast grid previews); only `coverUrl` is upgraded to `zoom=6` and `edge=curl` stripped.

- **Cover fetch cancellation tied to `abortControllerRef`**: `handleSelectResult`'s cover `fetch()` uses `AbortSignal.timeout(15_000)` which is not cancellable by `handleClose`. The fix uses the existing `abortControllerRef.current?.signal` so that closing the modal also cancels any in-progress cover fetch. This prevents stale state updates on closed modals.

- **CSP `img-src` update**: Add `https://books.google.com` to `img-src`. Required for `CoverSearchGrid` thumbnails — the grid uses `<img>` directly, which is blocked by CSP without this entry. Note: thumbnails display via `<img>` (needs `img-src`); selected-cover fetching goes through the proxy (same-origin, no `connect-src` needed).

## Open Questions

### Resolved During Planning

- **Storage model for Google Books covers?** → Proxy. Consistent with ABS decision. Preserves OPFS/offline. Canvas taint makes direct-image-to-blob infeasible.
- **Cancel cover fetch on modal close?** → Yes. Attach to `abortControllerRef.current?.signal`. Prevents ghost state updates.
- **Show loading spinner during OPFS cover resolution on open?** → Yes. `isFetchingCover(true)` at start, `false` on completion. Prevents visible placeholder flash.
- **Close search grid when Google Books cover fetch fails?** → Yes, and for all providers — the catch block in `handleSelectResult` is shared. This is an intentional behavioral improvement: the grid closes on any cover fetch failure (metadata auto-fill already ran). Toast already informs the user.
- **Does `*.googleusercontent.com` in `img-src` cover Google Books thumbnails?** → No. Thumbnails are served from `books.google.com`. Must add explicitly.

### Deferred to Implementation

- **Proxy response caching**: whether to add a short in-memory cache to the proxy route. Start without caching; add if profiling shows repeated requests.

## High-Level Technical Design

> _This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce._

```text
Google Books cover selection flow (post-fix):

Browser                     Express Server              books.google.com
  │                               │                           │
  │  handleSelectResult fires     │                           │
  │  result.provider = 'google-books'                        │
  │                               │                           │
  │  fetch('/api/cover-proxy?url=<encoded-zoom6-url>')        │
  │ ─────────────────────────────►│                           │
  │                               │  fetch(url, redirect:'error')  │
  │                               │ ─────────────────────────►│
  │                               │  image bytes (no CORS)    │
  │                               │ ◄─────────────────────────│
  │  image bytes (same-origin)    │  validate Content-Type    │
  │ ◄─────────────────────────────│                           │
  │                               │                           │
  │  toJpeg() → blob: URL         │                           │
  │  setSafeCoverPreviewUrl(blob)  │                           │
  │  newCoverBlob = jpegBlob       │                           │
  │  → saved to OPFS on save      │                           │

Bug 1 fix (modal open):

  useEffect (book, open)
    │
    ├─ isFetchingCover = true
    ├─ let isCancelled = false; let blobUrl = null  (closure vars)
    │
    ├─ [opfs-cover://] opfsStorageService.getCoverUrl(book.id) → blobUrl
    │     └─ if (!isCancelled): setSafeCoverPreviewUrl(blobUrl); blobUrl = null
    │                           ↑ null-out so cleanup does not double-revoke
    │
    └─ isFetchingCover = false
       cleanup: isCancelled = true; if (blobUrl) revoke(blobUrl)
```

## Implementation Units

- [ ] **Unit 1: Upgrade `coverUrl` resolution quality in `GoogleBooksService`**

**Goal:** Replace `zoom=1` → `zoom=0` with `zoom=1` → `zoom=6` for `coverUrl`, and strip `edge=curl` from both `coverUrl` and `thumbnailUrl`.

**Requirements:** R4

**Dependencies:** None

**Files:**

- Modify: `src/services/GoogleBooksService.ts`
- Test: `src/services/__tests__/GoogleBooksService.test.ts`

**Approach:**

- In `mapVolumeToResult`, change `.replace(/&zoom=\d/, '&zoom=0')` to `'&zoom=6'`.
- Strip `&edge=curl` from `thumbnailUrl` and `coverUrl` via an additional `.replace(/&edge=curl/, '')`.
- Both transforms are composable replacements on the HTTPS-upgraded URL.

**Patterns to follow:**

- Existing regex chain in `mapVolumeToResult` (`src/services/GoogleBooksService.ts` lines 87-91)

**Test scenarios:**

- Happy path: volume with thumbnail URL containing `zoom=1&edge=curl&source=gbs_api` → `coverUrl` has `zoom=6`, no `edge=curl`; `thumbnailUrl` has `zoom=1`, no `edge=curl`
- Happy path: volume with thumbnail URL containing `zoom=5` (smallThumbnail) → `coverUrl` has `zoom=6`
- Edge case: thumbnail URL with no `zoom` parameter → `coverUrl` is unchanged (replacement is no-op on non-match)
- Edge case: thumbnail URL with no `edge=curl` → URLs unaffected by the strip
- Regression: existing HTTPS upgrade test still passes (`http://` → `https://`)
- Update required: existing assertion `expect(result.coverUrl).toContain('zoom=0')` at test line 113 must be updated to `'zoom=6'` — it directly contradicts the change and will fail immediately without this update

**Verification:**

- `coverUrl` from search results contains `zoom=6` and has no `edge=curl`
- `thumbnailUrl` contains `zoom=1` and has no `edge=curl`
- All 8 existing tests pass after updating the `zoom=0` → `zoom=6` assertion on test line 113

---

- [ ] **Unit 2: Add CSP `img-src` entry for Google Books domain**

**Goal:** Allow `<img>` tags to load images from `books.google.com` so `CoverSearchGrid` thumbnails render.

**Requirements:** R3

**Dependencies:** None

**Files:**

- Modify: `index.html`

**Approach:**

- In the `Content-Security-Policy` `img-src` directive, add `https://books.google.com` after the existing `https://covers.openlibrary.org` entry.
- Do not add to `connect-src` — `books.google.com` image fetches now go through the proxy (same-origin), not direct browser fetch.

**Test expectation:** none — CSP changes are validated by CoverSearchGrid rendering correctly in the browser; see Unit 6 verification

**Verification:**

- Google Books thumbnails render in `CoverSearchGrid` without CSP violations in the browser console

---

- [ ] **Unit 3: Add server-side cover proxy route to Express server**

**Goal:** Add a `/api/cover-proxy` route that fetches an image URL server-to-server and streams it to the browser, bypassing CORS restrictions for Google Books.

**Requirements:** R2, R5

**Dependencies:** None

**Files:**

- Modify: `server/index.ts`
- Modify: `vite.config.ts` — add `/api/cover-proxy` to the dev server proxy map (hard prerequisite; without this the route returns 404 in dev mode)
- Create: `server/routes/cover-proxy.ts`
- Test: `server/__tests__/cover-proxy.test.ts`

**Approach:**

- New Express route: `GET /api/cover-proxy?url=<encoded-image-url>`
- **SSRF protection — layered**:
  1. **Protocol check first**: reject any URL whose protocol is not `https:`. Guards against `file://`, `ftp://`, `http://`, and other schemes before domain validation. Pattern: the existing `isAllowedOllamaUrl` in `server/index.ts` enforces protocol — use `https:` only here.
  2. **Domain allowlist**: only forward requests to explicitly approved CDN domains (`books.google.com`, `covers.openlibrary.org`, `*.mzstatic.com`). This is the primary SSRF gate. IP-range rejection is not needed as a primary control for this hardcoded allowlist.
  3. **Redirect policy**: set `redirect: 'error'` on the server-side `fetch` call so HTTP redirects are never automatically followed. Upstream 3xx returns 502 rather than silently following the redirect to an unknown destination — prevents SSRF via redirect from allowlisted domains.
- **Content-Type validation**: after the upstream response arrives, check `Content-Type` before streaming. Only forward `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Reject any other type (including `image/svg+xml` — SVG allows inline script in certain browser contexts) with a 502.
- Fetch with a 10-second timeout. Return 502 with a descriptive JSON error body on any failure.
- Stream validated response bytes with `Cache-Control: public, max-age=3600`. Forward upstream `Content-Type` only after validation passes.
- **Rate limiting**: add a dedicated per-IP limiter for this route (60 req/min). The existing limiters (`absApiRateLimit`, `absCoverRateLimit`, `calendarRateLimit`) are mount-specific and do not cover this route. Pattern: `absCoverRateLimit` in `server/index.ts`.
- No auth required. Register the router in `server/index.ts` before the AI middleware chain.

**Patterns to follow:**

- `server/routes/calendar.ts` — simple Express route file with error handling
- `server/routes/models.ts` — router export pattern used in `server/index.ts`
- `isAllowedOllamaUrl` in `server/index.ts` — protocol enforcement pattern
- `absCoverRateLimit` in `server/index.ts` — per-route rate limiter pattern
- `server/__tests__/` — established location for server unit tests (e.g., `ollama-dev-proxy.test.ts`)

**Test scenarios:**

- Happy path: valid `https://books.google.com/books/content?id=abc&zoom=6` → proxies image bytes; response `Content-Type` is `image/jpeg`; `Cache-Control: public, max-age=3600` present
- Happy path: valid `https://covers.openlibrary.org/b/isbn/...` → proxies correctly
- Error path: `url` parameter missing → 400 with descriptive error body
- Error path: `url=http://books.google.com/...` (HTTP, not HTTPS) → 400 (protocol check)
- Error path: `url=ftp://books.google.com/image.jpg` → 400 (protocol check)
- Error path: `url=file:///etc/passwd` → 400 (protocol check)
- Error path: `url=https://evil.com/image.jpg` → 400 (not on domain allowlist)
- Error path: `url=https://192.168.1.1/image.jpg` → 400 (IP addresses are not valid allowlist domains)
- Error path: upstream returns 301 redirect to `https://internal-service/` → proxy returns 502 (redirect-follow disabled)
- Error path: upstream returns `Content-Type: text/html` → 502 (non-image content type rejected)
- Error path: upstream returns `Content-Type: image/svg+xml` → 502 (SVG rejected)
- Error path: upstream server times out → 502 with timeout message
- Error path: upstream server returns 404 → 502 with error body
- Edge case: URL with encoded `&` in query parameters → decoded correctly before fetching
- Edge case: 61st request from same IP within 60 seconds → 429 rate limit response

**Verification:**

- `GET /api/cover-proxy?url=<google-books-zoom6-url>` returns image bytes (both dev and prod)
- `http://`, `ftp://`, `file://`, non-allowlisted domains all return 400
- Upstream redirect to any destination returns 502 (redirect following disabled)
- `image/svg+xml` upstream responses return 502
- Rate limiter returns 429 after 60 requests/minute from same IP

---

- [ ] **Unit 4: Fix Bug 1 — resolve existing cover on modal open using `isCancelled` pattern**

**Goal:** When the editor opens for a book with an OPFS-stored cover, display the actual cover image instead of a placeholder.

**Requirements:** R1, R6

**Dependencies:** None (OPFS covers do not need the proxy)

**Files:**

- Modify: `src/app/components/library/BookMetadataEditor.tsx`
- Test: `src/app/components/library/__tests__/BookMetadataEditor.test.tsx` (create if not exists)

**Approach:**

- In the `useEffect` at line 141, replace `setSafeCoverPreviewUrl(book.coverUrl)` (line 166) with an async OPFS resolution:
  - Set `isFetchingCover(true)` before the async call
  - Declare `let isCancelled = false` and `let blobUrl: string | null = null` at the top of the effect closure
  - If `book.coverUrl` starts with `opfs-cover://` or `opfs://`: call `opfsStorageService.getCoverUrl(book.id)`, store the result in `blobUrl`, guard with `if (!isCancelled)`, call `setSafeCoverPreviewUrl(blobUrl)`, then immediately set `blobUrl = null` — this null-out is critical because `setSafeCoverPreviewUrl` takes ownership of the blob URL lifecycle; if `blobUrl` still holds the reference when the cleanup runs, it will be revoked a second time (double-revoke), invalidating the live cover image
  - If `book.coverUrl` starts with `http(s)://` or `data:image/`: call `setSafeCoverPreviewUrl(book.coverUrl)` directly (no resolution needed)
  - If `book.coverUrl` is absent: call `setSafeCoverPreviewUrl(null)`
  - Set `isFetchingCover(false)` in a `finally` block
  - Cleanup: set `isCancelled = true`; revoke `blobUrl` only if it is still non-null (i.e., the async path completed but `isCancelled` blocked `setSafeCoverPreviewUrl`, leaving the blob unclaimed)
- Do NOT use the `useBookCoverUrl` hook — it would introduce a second state manager for `coverPreviewUrl`

**Patterns to follow:**

- `src/app/hooks/useBookCoverUrl.ts` lines 44-98 — `isCancelled` guard + `effectBlobUrl` closure variable pattern
- `setSafeCoverPreviewUrl` in `BookMetadataEditor.tsx` lines 131-138 — handles blob URL revocation on replacement; the null-out after handoff prevents double-revoke

**Test scenarios:**

- Happy path: open editor for book with `opfs-cover://bookId` coverUrl → `opfsStorageService.getCoverUrl` called with `book.id`; cover preview shows blob URL; `isFetchingCover` transitions true → false
- Happy path: open editor for book with `https://covers.openlibrary.org/...` coverUrl → preview set directly without OPFS call
- Happy path: open editor for book with no coverUrl → preview is null; placeholder shown
- Edge case: modal closes before OPFS resolution completes → `isCancelled` flag prevents stale `setSafeCoverPreviewUrl` call; resolved blob URL is revoked by cleanup; no state update
- Edge case: `opfsStorageService.getCoverUrl` throws → `isFetchingCover` set to false; cover preview remains null; no unhandled promise rejection
- Edge case: modal open/close/open in rapid succession → only the second open's resolution reaches `setSafeCoverPreviewUrl`; first resolution revokes its blob in cleanup
- Integration: spinner overlay (`isFetchingCover=true`) appears during OPFS resolution and disappears on completion

**Verification:**

- Opening editor for a book with a stored cover shows the cover, not a placeholder
- `isFetchingCover` is `true` during resolution and `false` after
- Modal close during resolution does not trigger state updates or console warnings

---

- [ ] **Unit 5: Fix Bug 2 — replace `fetch(result.coverUrl)` with proxy fetch for Google Books**

**Goal:** When a Google Books result is selected, route the cover fetch through the server-side proxy instead of fetching directly from `books.google.com`.

**Requirements:** R2, R5, R6

**Dependencies:** Unit 3 (proxy route must exist)

**Files:**

- Modify: `src/app/components/library/BookMetadataEditor.tsx`
- Test: `src/app/components/library/__tests__/BookMetadataEditor.test.tsx`

**Approach:**

- In `handleSelectResult` (line 260), determine the effective cover URL before fetching:
  - If `result.provider === 'google-books'` and `result.coverUrl` exists: construct `/api/cover-proxy?url=${encodeURIComponent(result.coverUrl)}`
  - Otherwise: use `result.coverUrl` directly (iTunes, OpenLibrary, Audnexus are CORS-enabled)
- Replace `AbortSignal.timeout(15_000)` with `abortControllerRef.current?.signal ?? AbortSignal.timeout(15_000)` — cancels the cover fetch when `handleClose` fires
- In the `catch` block (line 273): add `setShowSearchGrid(false)` — this closes the grid on any cover fetch failure, not just Google Books. This is an intentional improvement: metadata auto-fill already ran, the grid staying open creates a confusing selected-but-not-applied state. The change is shared across all providers.
- No other logic changes — `toJpeg()` and `setSafeCoverPreviewUrl` paths are unchanged

**Patterns to follow:**

- Existing `fetch(result.coverUrl, { signal: AbortSignal.timeout(15_000) })` in `handleSelectResult`
- `abortControllerRef` cancellation pattern in `handleSearchCovers` (line 239)

**Test scenarios:**

- Happy path: select Google Books result → `fetch` called with `/api/cover-proxy?url=<encoded-coverUrl>`, not directly to `books.google.com`; grid closes after selection
- Happy path: select iTunes result → `fetch` called with iTunes URL directly (no proxy wrapping); grid closes after selection
- Happy path: proxy fetch returns image bytes → `toJpeg()` converts to JPEG blob; `setSafeCoverPreviewUrl` sets preview; `newCoverBlob` set; grid closes
- Error path: proxy fetch fails (502, network error) → toast shown; `setShowSearchGrid(false)` called; `newCoverBlob` unchanged
- Error path: iTunes cover fetch fails (network error) → toast shown; grid closes (intentional — shared catch path)
- Error path: modal closed before cover fetch completes → `abortControllerRef` signal aborted; no state updates after abort
- Edge case: `result.coverUrl` is undefined for a Google Books result → cover fetch block skipped entirely; metadata auto-fill still runs; grid closes normally

**Verification:**

- Selecting a Google Books result applies the cover to the editor preview
- Selecting an iTunes result continues to work as before
- Modal close during cover fetch produces no console warnings

---

- [ ] **Unit 6: Visual verification — Google Books covers render end-to-end**

**Goal:** Confirm that all three surface areas (editor existing cover, editor Google Books selection, CoverSearchGrid thumbnails) render correctly in the browser.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Units 1–5

**Files:**

- Test: `tests/e2e/library-book-metadata-editor.spec.ts` (create or extend)

**Approach:**

- Start dev server with the Express backend running
- Open "Edit Book Details" for a book with a stored OPFS cover → verify cover renders (not placeholder)
- Click "Search Covers & Metadata" → verify Google Books thumbnail grid cards show cover images (not broken icons)
- Select a Google Books result → verify cover preview updates in the editor
- Verify the cover URL in the editor preview is a `blob:` URL (not `books.google.com` or `opfs-cover://`)
- Save → verify `book.coverUrl` is an `opfs-cover://` URL (cover persisted to OPFS)

**Patterns to follow:**

- Existing E2E tests in `tests/e2e/` for modal interaction patterns
- `tests/e2e/library.spec.ts` for library page context setup

**Test scenarios:**

- Happy path: open editor with OPFS cover → cover displays, not placeholder icon
- Happy path: search covers → Google Books grid card shows thumbnail image
- Happy path: select Google Books result → editor preview updates with cover image
- Happy path: save after selecting Google Books cover → cover persisted (book shows cover in library view)
- Error path: dev server not running → cover proxy returns 502; toast shown; editor remains functional

**Verification:**

- No broken image icons in any of the three surfaces
- No CSP violations in browser console related to `books.google.com`
- Cover round-trips correctly through proxy to OPFS on save

## System-Wide Impact

- **Interaction graph:** `handleSelectResult` now constructs a proxy URL for Google Books before fetching. `handleClose` (via `abortControllerRef`) now also cancels in-progress cover fetches. The `useEffect` for modal open now calls `opfsStorageService.getCoverUrl` asynchronously.
- **Error propagation:** Proxy failures (502) surface as toast warnings in `handleSelectResult`'s catch block. OPFS resolution failures in the Bug 1 fix surface as `null` preview (no cover shown, no toast — same behavior as before the fix).
- **State lifecycle risks:** The `isCancelled` guard prevents stale OPFS resolutions from overwriting fresh state. `blobUrl` is nulled out after handoff to `setSafeCoverPreviewUrl` to prevent double-revoke. Aborting via `abortControllerRef` prevents cover fetch state updates after modal close.
- **API surface parity:** No changes to `MetadataSearchResult` type or `CoverSearchService` aggregation. `GoogleBooksService` URL quality improvement is backward-compatible — callers still receive `coverUrl` and `thumbnailUrl` fields, just with better resolution.
- **Integration coverage:** `vite.config.ts` must have a `/api/cover-proxy` entry in the dev server proxy map — without it the route returns 404 in dev mode. This is a hard prerequisite handled in Unit 3.
- **Unchanged invariants:** iTunes, OpenLibrary, and Audnexus cover fetching paths are not modified. The OPFS save path in `handleSave` is not modified. The `toJpeg()` conversion is not modified.

## Risks & Dependencies

| Risk                                                                                   | Mitigation                                                                                                                         |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| SSRF via protocol smuggling (`file://`, `ftp://`, `http://`)                           | Reject any URL whose protocol is not `https:` before domain allowlist check — explicit in Unit 3                                   |
| SSRF via HTTP redirect following from an allowlisted domain                            | Set `redirect: 'error'` on server-side fetch; upstream 3xx returns 502, never followed                                             |
| Malicious or unexpected upstream `Content-Type` (e.g. `image/svg+xml`)                 | Validate content-type before streaming; only jpeg/png/webp/gif forwarded; SVG → 502                                                |
| No rate limiting on `/api/cover-proxy` (existing limiters are mount-specific)          | Add dedicated per-IP limiter (60 req/min) in Unit 3; pattern: `absCoverRateLimit`                                                  |
| Vite dev proxy config missing `/api/cover-proxy` (route returns 404 in dev without it) | Add entry to `vite.config.ts` — listed as required file in Unit 3, not deferred                                                    |
| Double-revoke of OPFS blob URL in Bug 1 useEffect                                      | Null out `blobUrl` after handoff to `setSafeCoverPreviewUrl`; explicit in Unit 4 approach                                          |
| Google Books CDN changes domain                                                        | Allowlist in proxy is single source of truth; update allowlist if URLs change                                                      |
| Proxy adds latency to cover selection                                                  | Acceptable: user-action-triggered, 100-200ms overhead is imperceptible                                                             |
| DNS rebinding against allowlisted CDN domains                                          | Low risk: hardcoded well-known CDNs not under attacker control; no DNS pre-resolution step (creates TOCTOU window without benefit) |

## Documentation / Operational Notes

- The proxy allowlist in `server/routes/cover-proxy.ts` must be updated if new image CDN domains are added in future provider implementations
- `vite.config.ts` proxy entries and Express server routes must stay in sync for dev mode

## Sources & References

- Related code: `src/app/hooks/useBookCoverUrl.ts` — `isCancelled` pattern to replicate
- Related code: `src/app/components/library/BookMetadataEditor.tsx` lines 131-170, 260-300
- Related code: `server/index.ts` — proxy server structure
- External docs: Google Books API — `books.google.com` CORS behavior (confirmed no CORS headers, April 2026)
- External docs: Google Books zoom parameter — `zoom=6` = `extraLarge`, `edge=curl` removal
- Memory: `project_abs_cors_proxy.md` — ABS CORS proxy architectural precedent
