---
title: "feat: Multi-Provider Metadata Search in Book Editor"
type: feat
status: active
date: 2026-04-15
origin: .claude/plans/optimized-wishing-fiddle.md
---

## Overview

The Book Metadata Editor currently offers only Open Library for cover re-fetching and requires manual genre selection. This plan adds three additional metadata providers — Audnexus (Audible proxy), Google Books, and iTunes Search — with a unified search UI that replaces the single-provider button. Users can browse cover results from all providers and auto-fill empty metadata fields from the selected result.

## Problem Frame

Knowlune's audiobook metadata is particularly weak because Open Library has poor audiobook coverage — no narrator, no ASIN, no series data. Meanwhile, ebook metadata could be richer with Google Books' descriptions and categories. Users currently must manually fill these fields or accept gaps. The Audiobookshelf ecosystem solves this with Audnexus (a free caching proxy for Audible data), and the same approach works here.

## Requirements Trace

- R1. Add Audnexus, Google Books, and iTunes Search as metadata providers alongside Open Library
- R2. Unified "Search Covers & Metadata" UI replaces the single "Re-fetch from Open Library" button
- R3. Auto-fill empty metadata fields (description, genre, narrator, series, ISBN/ASIN) from selected result — single-provider model (no cross-provider merging)
- R4. Only fill blank fields; never overwrite pre-existing data
- R5. Format-aware provider prioritization (audiobooks → Audnexus/iTunes first; ebooks → Google Books/Open Library first)
- R6. Genre auto-detection from any provider's category data via existing `detectGenre()` function
- R7. Add `asin` field to `Book` type for audiobook identification
- R8. Graceful degradation: offline detection, per-provider timeouts, partial results when some providers fail
- R9. ABS sync remains one-way (ABS → Knowlune) — local edits don't write back

## Scope Boundaries

- **No AI/LLM genre detection** — more provider data through the existing keyword matcher is sufficient
- **Import flow unchanged** — this only affects the metadata editor, not book import
- **No Hardcover.app integration** — may be added in a future epic (see `docs/ideation/2026-04-15-books-page-ideation.md`)
- **No client-side rate limiting** — 1,000 req/day (Google Books keyless) and 100 req/min (Audnexus) are generous for a personal PWA

## Context & Research

### Relevant Code and Patterns

- `src/services/OpenLibraryService.ts` — template for new provider services: pure functions, 5s timeout via `AbortController`, `navigator.onLine` check, never-throw contract, `// silent-catch-ok` annotations
- `src/app/components/library/EditorCoverSection.tsx` — current "Re-fetch from Open Library" button with `onRefetchCover` callback prop (the extension point)
- `src/app/components/library/BookMetadataEditor.tsx` — editor dialog with cover preview, JPEG conversion via Canvas API (max 800x1200, 0.85 quality), `toJpeg()` utility
- `src/services/GenreDetectionService.ts` — `detectGenre(subjects: string[])` keyword matcher, already accepts generic string arrays
- `src/data/types.ts:732` — `Book` interface with all needed fields except `asin`
- `src/app/components/library/designConstants.ts` — shared styling constants (`ghostInputClass`, `labelClass`, `gradientCtaClass`)
- `server/index.ts` — Express proxy pattern with SSRF protection, rate limiting, cover caching (30-min TTL)

### Key Infrastructure

- **CSP `connect-src`** in `index.html:27` already allows `https://www.googleapis.com` (Google Books). Needs additions for `https://itunes.apple.com`, `https://api.audnex.us`, and `https://api.audible.com` (if browser-direct)
- **SSRF protection** in `src/lib/ssrfProtection.ts` — blocks loopback/link-local. Relevant only if Express proxy routes are added
- **Cover storage** via `opfsStorageService.storeCoverFile(bookId, blob)` in OPFS with IndexedDB fallback

### External References

- **Audnexus API**: `api.audnex.us/books/{ASIN}` — free, no auth, 100 req/min. Returns narrator, series, genres, cover, ASIN, runtime
- **Audible Catalog**: `api.audible.com/1.0/catalog/products` — semi-public search, no auth. CORS status unknown (test first, proxy if blocked)
- **Google Books API**: `googleapis.com/books/v1/volumes` — no API key needed for basic searches (1,000 req/day/IP), CORS-friendly
- **iTunes Search API**: `itunes.apple.com/search?entity=audiobook` — no auth, CORS-friendly, ~20 req/min

## Key Technical Decisions

- **Single-provider auto-fill**: When user selects a result, all metadata comes from that one provider. No cross-provider merging. Simpler, predictable, matches existing Open Library flow.
- **Only fill blank fields**: Auto-fill never overwrites pre-existing data. No per-field dirty tracking needed. If author/description already exist from import, they're preserved.
- **Replace existing button**: The unified search replaces "Re-fetch from Open Library" since Open Library is included as a provider. One button, no UX confusion.
- **No Google Books API key**: Keyless mode (1,000 req/day) is sufficient for a personal PWA. All four providers use the same browser-direct pattern. No Express proxy needed unless CORS blocks a provider.
- **Browser-direct for all providers (initially)**: Google Books, Open Library, iTunes are CORS-friendly. Audnexus likely is too. Audible catalog API needs CORS testing — add Express proxy only if blocked.
- **Cap results**: 5 results per provider, 15 total maximum. Prevents UI overload from Google Books returning 40 results.
- **AbortController cancellation**: New search cancels in-flight requests from previous search, preventing stale result interleaving.

## Open Questions

### Resolved During Planning

- **Single vs. merged auto-fill?** Single-provider. User selects one result, gets that provider's data.
- **What counts as "user-edited"?** Only fill blank fields. No dirty tracking complexity.
- **Replace or keep old button?** Replace. Unified search includes Open Library.
- **Google Books API key?** No key needed. Keyless mode sufficient for personal use.
- **Audnexus without ASIN?** Search Audible catalog by title+author first, get ASINs, then fetch Audnexus metadata for each ASIN. Skip Audnexus entirely for non-audiobook formats without ASIN.

### Deferred to Implementation

- **Audible CORS behavior**: Test `api.audible.com` from browser. If blocked, add Express proxy route following the ABS pattern. This is a runtime discovery.
- **Audnexus CORS behavior**: Same — test browser-direct first, proxy if needed.
- **Cover aspect ratio handling**: Audible covers are typically square (500x500) vs. book covers (2:3). The existing `toJpeg()` resizer handles this by fitting to max dimensions, but visual presentation in the grid may need tweaks.
- **Exact Audible search query parameters**: The catalog API accepts various params (`title`, `author`, `keywords`). Optimal query construction depends on testing with real data.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
User clicks "Search Covers & Metadata"
  │
  ├─ Check navigator.onLine → toast + abort if offline
  │
  ├─ Determine provider set by book.format:
  │   audiobook → [Audnexus, iTunes, Google Books, Open Library]
  │   ebook/pdf → [Google Books, Open Library]  (iTunes audiobook-only; Audnexus skipped without ASIN)
  │
  ├─ CoverSearchService.search(query, format)
  │   │
  │   ├─ Fire provider searches independently with per-provider .then()
  │   │   callbacks that accumulate results into state (enables progressive UI)
  │   │   each with 5s timeout + AbortController
  │   │
  │   └─ Collect results → dedupe by exact ASIN/ISBN match → sort by provider priority
  │
  ├─ CoverSearchGrid renders results grouped/badged by provider
  │
  └─ User selects a result:
      ├─ Set cover preview (fetch image → toJpeg → blob URL)
      ├─ Auto-fill empty fields from result.metadata
      └─ If genre is empty → detectGenre(result.metadata.genres)
```

## Implementation Units

- [ ] **Unit 1: Add `asin` field to Book type and expand store signature**

  **Goal:** Extend the Book interface with an optional ASIN field and ensure the metadata editor can persist `narrator` and `asin` via the store.

  **Requirements:** R3, R7

  **Dependencies:** None

  **Files:**
  - Modify: `src/data/types.ts`
  - Modify: `src/stores/useBookStore.ts`

  **Approach:**
  - Add `asin?: string` to the `Book` interface alongside `isbn`
  - ASIN is more reliable than ISBN for audiobooks (every Audible book has one)
  - Expand the `updateBookMetadata` function's `Pick` type in `useBookStore.ts` to include `narrator` and `asin` — currently the Pick only allows `title`, `author`, `isbn`, `description`, `tags`, `coverUrl`, `genre`, `series`, `seriesSequence`. Without this, auto-fill for narrator/ASIN will fail at the TypeScript level

  **Patterns to follow:**
  - Existing optional fields in `Book` interface (`isbn?: string`, `series?: string`)
  - Existing `Pick` type in `updateBookMetadata`

  **Test expectation:** None — pure type/signature expansion with no runtime behavior change.

  **Verification:**
  - `npx tsc --noEmit` passes with the new field and expanded Pick type

- [ ] **Unit 2: Create Audnexus service**

  **Goal:** Add Audible search + Audnexus metadata fetching as a new provider service.

  **Requirements:** R1, R8

  **Dependencies:** Unit 1 (ASIN type)

  **Files:**
  - Create: `src/services/AudnexusService.ts`
  - Test: `src/services/__tests__/AudnexusService.test.ts`

  **Approach:**
  - Two-step: search `api.audible.com/1.0/catalog/products` by title+author to get ASINs, then fetch `api.audnex.us/books/{ASIN}` for full metadata
  - If book already has an ASIN, skip Audible search and go directly to Audnexus
  - Mirror `OpenLibraryService.ts` pattern: pure functions, 5s timeout, `navigator.onLine` guard, never-throw, `skippedOffline` sentinel
  - Return normalized `MetadataSearchResult` shape (defined in Unit 5)
  - CORS note: if Audible API blocks browser requests, flag for Express proxy (Unit 8)

  **Patterns to follow:**
  - `src/services/OpenLibraryService.ts` — timeout, offline check, silent-catch

  **Test scenarios:**
  - Happy path: title+author search returns ASINs → Audnexus returns full metadata with cover, narrator, series, genres
  - Happy path: direct ASIN lookup returns metadata without Audible search step
  - Edge case: Audible search returns zero results → return empty array
  - Edge case: Audible returns ASINs but Audnexus fetch fails for all → return results with cover URLs from Audible but no rich metadata
  - Error path: network timeout after 5s → return empty (never throw)
  - Error path: offline → return `{ skippedOffline: true }` without making requests

  **Verification:**
  - Unit tests pass
  - Manual test: search for a known audiobook (e.g., "Project Hail Mary" by Andy Weir) returns Audnexus metadata

- [ ] **Unit 3: Create Google Books service**

  **Goal:** Add Google Books as a metadata provider for ebook and general book searches.

  **Requirements:** R1, R8

  **Dependencies:** None

  **Files:**
  - Create: `src/services/GoogleBooksService.ts`
  - Test: `src/services/__tests__/GoogleBooksService.test.ts`

  **Approach:**
  - Search `googleapis.com/books/v1/volumes?q=...` with title+author, optional ISBN
  - No API key (keyless mode, 1,000 req/day)
  - Return normalized `MetadataSearchResult` shape
  - Map `volumeInfo.categories` to genres string array for `detectGenre()`
  - Cap at 5 results via `maxResults=5` query param

  **Patterns to follow:**
  - `src/services/OpenLibraryService.ts` — timeout, offline check, silent-catch

  **Test scenarios:**
  - Happy path: title+author search returns volumes with covers, descriptions, ISBNs, categories
  - Happy path: ISBN search returns exact match
  - Edge case: book with no cover image in Google Books → result has `coverUrl: undefined`
  - Edge case: volume with no `volumeInfo.categories` → genres array is empty
  - Error path: network timeout → return empty array
  - Error path: offline → return `{ skippedOffline: true }`

  **Verification:**
  - Unit tests pass
  - Manual test: search for a known book returns Google Books metadata

- [ ] **Unit 4: Create iTunes Search service**

  **Goal:** Add iTunes as a provider, primarily for audiobook cover art.

  **Requirements:** R1, R8

  **Dependencies:** None

  **Files:**
  - Create: `src/services/ITunesSearchService.ts`
  - Test: `src/services/__tests__/ITunesSearchService.test.ts`

  **Approach:**
  - Search `itunes.apple.com/search?entity=audiobook&term=...`
  - Returns high-quality cover art (600px `artworkUrl600`) but limited metadata (no narrator, series, ISBN)
  - Cap at 5 results via `limit=5` query param
  - Return normalized `MetadataSearchResult` shape

  **Patterns to follow:**
  - `src/services/OpenLibraryService.ts` — timeout, offline check, silent-catch

  **Test scenarios:**
  - Happy path: title+author search returns audiobooks with high-res cover URLs and genre
  - Edge case: search returns non-audiobook results mixed in → filter by `wrapperType === 'audiobook'`
  - Edge case: artworkUrl100 present but artworkUrl600 absent → fall back to artworkUrl100
  - Error path: network timeout → return empty array
  - Error path: offline → return `{ skippedOffline: true }`

  **Verification:**
  - Unit tests pass
  - Manual test: search for a known audiobook returns iTunes results with covers

- [ ] **Unit 5: Create Cover Search aggregator service**

  **Goal:** Unified interface that queries all providers in parallel and returns deduplicated, format-prioritized results.

  **Requirements:** R1, R5, R8

  **Dependencies:** Units 2, 3, 4

  **Files:**
  - Create: `src/services/CoverSearchService.ts`
  - Test: `src/services/__tests__/CoverSearchService.test.ts`

  **Approach:**
  - Define `MetadataSearchResult` interface: `{ provider, coverUrl, thumbnailUrl, metadata: { title?, author?, narrator?, description?, genres?, series?, seriesSequence?, isbn?, asin? } }`
  - `searchCovers(query, format, onResults)` — accepts an `onResults` callback that fires per-provider as each resolves (enables progressive UI updates). Also accepts an `AbortSignal` for cancellation
  - Wrap existing `OpenLibraryService.fetchOpenLibraryMetadata()` in a thin adapter that normalizes `OpenLibraryResult` → `MetadataSearchResult` (Open Library is not re-implemented, just wrapped)
  - Fire each provider search independently with its own `.then()` that calls `onResults(providerResults)`. This enables the grid to show results progressively as each provider responds, rather than waiting for all to finish (unlike `Promise.allSettled` which resolves all-at-once)
  - Format-aware provider selection: audiobooks query all four; ebooks query Google Books + Open Library only (iTunes is audiobook-only; Audnexus is skipped without ASIN)
  - Results displayed grouped by provider, with higher-priority providers listed first (audiobook: Audnexus → iTunes → Google Books → Open Library; ebook: Google Books → Open Library)
  - Cap at 5 per provider, 10 total for ebooks, 15 for audiobooks
  - Deduplicate by exact ISBN/ASIN match within a single provider (not fuzzy title matching, not cross-provider)
  - When a selected result includes an ASIN, persist it to the Book object via `updateBookMetadata` so future searches can use direct Audnexus lookup

  **Patterns to follow:**
  - Per-provider `.then()` callbacks with shared `AbortController` (not `Promise.allSettled`)

  **Test scenarios:**
  - Happy path: all providers return results → combined list sorted by format priority, capped at 15
  - Happy path: audiobook format → Audnexus and iTunes results first
  - Happy path: ebook format → Google Books and Open Library results only (iTunes/Audnexus not queried)
  - Happy path: `onResults` callback fires once per provider as each resolves (progressive)
  - Edge case: one provider times out, others succeed → partial results via `onResults`, no error
  - Edge case: all providers return zero results → return empty array
  - Edge case: abort signal fired mid-flight → all pending requests cancelled, `onResults` stops firing
  - Integration: Open Library adapter correctly converts `OpenLibraryResult` → `MetadataSearchResult`
  - Integration: `searchCovers` correctly dispatches to each provider service and normalizes responses

  **Verification:**
  - Unit tests pass with mocked provider services
  - Integration test: real API call returns combined results (manual)

- [ ] **Unit 6: Update CSP connect-src and img-src**

  **Goal:** Allow browser-direct API requests and thumbnail image display for all provider domains.

  **Requirements:** R1, R2, R8

  **Dependencies:** None (should be done early to unblock all other units)

  **Files:**
  - Modify: `index.html`

  **Approach:**
  - **`connect-src` additions:**
    - `https://openlibrary.org` and `https://covers.openlibrary.org` — fix existing gap (Open Library calls currently work in dev via `localhost:*` but would fail in production)
    - `https://itunes.apple.com` — iTunes Search API
    - `https://api.audnex.us` — Audnexus metadata API
    - `https://api.audible.com` — Audible catalog search (remove if proxied via Unit 8)
    - `https://www.googleapis.com` already present (Google Books)
  - **`img-src` additions** (for displaying cover thumbnails directly in the search grid without fetching as blobs):
    - `https://covers.openlibrary.org` — Open Library covers
    - `https://is*.mzstatic.com` — iTunes/Apple artwork CDN
    - `https://m.media-amazon.com` — Audible/Audnexus cover images
    - `https://*.googleusercontent.com` already present (covers Google Books thumbnails)
  - The `img-src` additions enable the CoverSearchGrid to use `<img src>` directly for thumbnails (displaying 15 blob URLs would add unnecessary latency). The final selected cover still goes through the `fetch → toJpeg → blob` pipeline for storage.

  **Patterns to follow:**
  - Existing CSP entries in `index.html:24-27`

  **Test expectation:** None — infrastructure config change.

  **Verification:**
  - `npm run build` passes
  - Browser console shows no CSP violations when searching (manual test)
  - Thumbnail images load in the search grid without CSP errors

- [ ] **Unit 7: Build CoverSearchGrid component**

  **Goal:** Create the search results UI component showing cover thumbnails with provider badges and metadata preview.

  **Requirements:** R2, R3, R4, R5

  **Dependencies:** Unit 5 (aggregator service types)

  **Files:**
  - Create: `src/app/components/library/CoverSearchGrid.tsx`
  - Modify: `src/app/components/library/EditorCoverSection.tsx`
  - Modify: `src/app/components/library/BookMetadataEditor.tsx`

  **Approach:**
  - `CoverSearchGrid` receives `results: MetadataSearchResult[]`, `onSelect: (result) => void`, `isSearching: boolean`
  - Grid layout: 3 columns on desktop, 2 on mobile. Each card shows cover thumbnail (direct `<img src>` to provider URL — CSP `img-src` updated in Unit 6), provider badge, and metadata indicators (icons for narrator, series, description availability)
  - Empty state: "No results found. Try adjusting the title or author."
  - Loading state: skeleton cards with provider indicators
  - Progressive results: grid updates as each provider resolves via `onResults` callback (parent accumulates results in state, grid re-renders incrementally)
  - Replace `EditorCoverSection`'s "Re-fetch from Open Library" button with "Search Covers & Metadata" button
  - When searching, expand the cover section to show the grid below the cover preview
  - Selection handler lives inside `BookMetadataEditor` (not `CoverSearchGrid`) because it needs access to `toJpeg()`. Note: `toJpeg()` is currently a private function inside `BookMetadataEditor.tsx` — either extract to a shared utility like `src/lib/imageUtils.ts`, or keep the selection handler in the parent and pass as a callback. Flow: fetch cover image → `toJpeg()` → update preview, then auto-fill empty fields, then `detectGenre()` if genre is blank
  - Add ASIN input field to the editor form for audiobooks (alongside ISBN), so auto-filled ASINs are visible and editable
  - Auto-fill only runs on explicit user click of a result card (not on result arrival)

  **Patterns to follow:**
  - `EditorCoverSection.tsx` — existing cover section structure
  - `designConstants.ts` — shared styling constants
  - shadcn/ui `Button`, `Badge` components
  - Design tokens (never hardcoded colors)
  - `min-h-[44px]` touch targets, `data-testid` attributes

  **Test scenarios:**
  - Happy path: search returns results → grid displays cover thumbnails with provider badges
  - Happy path: user selects a result → cover preview updates, empty fields auto-filled, genre detected
  - Edge case: result has no cover image → show placeholder with provider name
  - Edge case: book already has author and description → those fields preserved after selection, only blank fields filled
  - Edge case: all providers return nothing → empty state message displayed
  - Edge case: user triggers new search while previous is loading → previous cancelled, new results replace old
  - Error path: offline → toast warning, no search initiated
  - Integration: selecting a result with genres triggers `detectGenre()` and populates genre dropdown

  **Verification:**
  - Component renders correctly with mock data
  - Auto-fill only writes to empty fields
  - Search cancellation works (no stale results)
  - Responsive layout at 375px, 768px, 1440px

- [ ] **Unit 8: Express proxy for Audible API (conditional)**

  **Goal:** Add Express proxy route for Audible catalog API if CORS blocks browser-direct requests.

  **Requirements:** R1, R8

  **Dependencies:** Unit 2 (Audnexus service — test CORS during implementation)

  **Execution note:** This unit is conditional. During Unit 2 implementation, test `api.audible.com` from the browser. If CORS allows it, skip this unit entirely. If blocked, implement the proxy.

  **Files:**
  - Modify: `server/index.ts` (inline route, following ABS pattern — no server refactor)
  - Modify: `src/services/AudnexusService.ts` (switch Audible search to use proxy)

  **Approach:**
  - Add `/api/audible/proxy/*` route following the ABS proxy pattern
  - No auth headers needed (Audible catalog is public)
  - Apply SSRF protection via `isAllowedProxyUrl()` if accepting any user-configurable URLs (fixed URLs may not need it)
  - 10s timeout with `AbortSignal`
  - Update `AudnexusService.ts` to call `/api/audible/proxy/...` instead of `api.audible.com` directly

  **Patterns to follow:**
  - `server/index.ts` ABS proxy routes
  - `server/routes/models.ts` error handling pattern

  **Test scenarios:**
  - Happy path: proxy forwards search request to Audible, returns results
  - Error path: Audible API timeout → proxy returns 504
  - Error path: Audible API returns non-200 → proxy forwards status code

  **Verification:**
  - Audnexus service works end-to-end (either browser-direct or via proxy)

## System-Wide Impact

- **Interaction graph:** `CoverSearchService` → individual provider services → external APIs. `BookMetadataEditor` → `CoverSearchService` → `GenreDetectionService`. No callbacks or middleware affected.
- **Error propagation:** Each provider fails independently (never-throw contract). Aggregator collects partial results. UI shows whatever succeeded. All errors are toast-level user feedback, never crashes.
- **State lifecycle risks:** AbortController cancellation on re-search prevents stale results. Cover blobs are ephemeral (ObjectURL) until saved to OPFS on dialog save. No new Zustand store or IndexedDB schema needed.
- **API surface parity:** The import flow (`BookImportDialog`, `useBulkImport`) still uses Open Library only. Extending import to multi-provider is a separate scope.
- **Unchanged invariants:** ABS sync remains one-way. Book import flow unchanged. Existing cover storage via OPFS unchanged. GenreDetectionService's core `detectGenre()` function signature unchanged (accepts `string[]`).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Audible catalog API blocks browser CORS | Test first; Express proxy route ready as Unit 8 (conditional) |
| Audnexus API blocks browser CORS | Same — test first, proxy if needed |
| Google Books keyless rate limit (1,000/day) | Sufficient for personal PWA. Can add API key later if needed |
| Audible catalog API is undocumented/semi-public | May require marketplace headers or specific user-agent. If unreliable, Audnexus path degrades gracefully — books without ASIN simply skip this provider |
| External API response format changes | Services return normalized types; only the individual service needs updating |
| Dialog size with search grid | Grid is collapsible/expandable; scrollable within existing `max-h-[60vh]` container |

## Sources & References

- **Origin document:** [.claude/plans/optimized-wishing-fiddle.md](.claude/plans/optimized-wishing-fiddle.md)
- **Ideation context:** [docs/ideation/2026-04-15-books-page-ideation.md](docs/ideation/2026-04-15-books-page-ideation.md)
- Related code: `src/services/OpenLibraryService.ts`, `src/services/AudiobookshelfService.ts`
- Related types: `src/data/types.ts:732` (Book interface)
- Editor components: `src/app/components/library/BookMetadataEditor.tsx`, `src/app/components/library/EditorCoverSection.tsx`
- Express proxy: `server/index.ts`
- CSP config: `index.html:27`
- Memory: `project_abs_cors_proxy.md` — ABS CORS proxy decision context
