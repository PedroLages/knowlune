# Plan: Book Detail Page (Details Button Target)

**Created:** 2026-05-07
**Status:** draft
**Route:** `/library/:bookId` (already exists, currently renders LibraryPage again — a no-op)

## Goal

When a user clicks the "Details" button on the Library hero or a shelf tile, navigate to a dedicated book detail page matching the Figma-quality HTML mockup, adapted to Knowlune's design tokens and conventions.

## Current State

- `LibraryMediaHero.tsx:145-152` — "Details" button navigates to `/library/:bookId`
- `routes.tsx:502-508` — `/library/:bookId` renders `<LibraryPage />` (no detail view — just records a frecency visit)
- `AboutBookDialog.tsx` — modal dialog with metadata; separate from the "Details" button flow, only accessible via context menu
- `BookTile.tsx` / `BookCard.tsx` / `BookListItem.tsx` — shelf/card items have no "Details" action; they navigate directly to the reader

## Design Token Mapping (HTML Mockup → Knowlune)

The HTML mockup uses Material Design 3 tokens via Tailwind config. Mapping to Knowlune's `theme.css`:

| HTML (Material) | Knowlune | Usage |
|---|---|---|
| `bg-background` | `bg-background` | Page background |
| `text-on-surface` | `text-foreground` | Primary text |
| `text-on-surface-variant` | `text-muted-foreground` | Secondary text, metadata labels |
| `text-primary` | `text-brand` | Brand-colored text, stars |
| `bg-primary-container` | `bg-brand` | Primary CTA button fill |
| `text-on-primary` | `text-brand-foreground` | Primary CTA button text |
| `bg-secondary-container` | `bg-brand-soft` | Format badge, genre pills |
| `text-on-secondary-container` | `text-brand-soft-foreground` | Badge/pill text on soft bg |
| `bg-surface` | `bg-card` | Card surfaces |
| `bg-surface-container-low` | `bg-muted` | Input backgrounds, muted areas |
| `bg-surface-container-high` | `bg-accent` | Hover states, elevated surfaces |
| `bg-surface-container` | `bg-muted/50` | Card interior sections |
| `bg-surface-container-highest` | `bg-muted/70` | Avatar placeholder |
| `border-outline-variant` | `border-border` | Card borders, button outlines |
| `text-outline` | `text-muted-foreground` | Icon colors, label text |
| `shadow-sm` | `shadow-sm` | Card subtle shadows |
| `shadow-lg` | `shadow-lg` | Card hover elevation |
| `shadow-2xl` | `shadow-2xl` | Cover image shadow |
| `rounded-xl` | `rounded-xl` | Cards, buttons |
| `rounded-full` | `rounded-full` | Badges, avatars |

### Typography Mapping

The HTML mockup uses Inter + Manrope; Knowlune uses DM Sans + Space Grotesk. We keep Knowlune's font stack:

| HTML Class | Knowlune Equivalent |
|---|---|
| `font-headline-xl` (30px/38px, 700) | `text-3xl font-bold tracking-tight` |
| Title override (44px, 800) | `text-[44px] leading-tight font-extrabold tracking-tight` |
| `font-headline-lg` (20px/28px, 600) | `text-xl font-semibold` |
| `font-body-lg` (16px/24px, 500) | `text-base font-medium` |
| `font-body-md` (14px/20px, 400) | `text-sm` |
| `font-label-sm` (12px/16px, 600, 0.02em) | `text-xs font-semibold tracking-wider uppercase` |

## Data Mapping

### Available on `Book` (no schema changes needed)

| Mockup Field | Book Property | Notes |
|---|---|---|
| Cover image | `coverUrl` | Via `useBookCoverUrl` hook |
| Title | `title` | — |
| Author | `author` | Optional; show "Unknown author" fallback |
| Format badge | `format` | "Audiobooks" / "Ebooks" |
| Rating | `rating` | 1-5 user rating; show with star icon or hide if unset |
| Synopsis | `description` | HTML — sanitize via `sanitizeDescriptionHtml` |
| Reading Time | `totalDuration` | Audiobooks: seconds → "Xh Ym"; Ebooks: compute from `totalPages` (~2 min/page) |
| Pages | `totalPages` | Optional; hide row if missing |
| ISBN | `isbn` | Optional |
| File Size | `fileSize` | Bytes → formatted string |

### Not Yet on `Book` (add as optional, populate over time)

| Mockup Field | Handling |
|---|---|
| Language (`language`) | Add `language?: string` to `Book`. ABS API returns `language` for audiobooks — populate during sync. For EPUBs/PDFs, the field will be `undefined` until metadata extraction is added. Hide the stat row when missing. |
| Release Year (`publishDate`) | Add `publishDate?: string` to `Book`. ABS API returns `publishDate` / `publishedYear` in item metadata. Populate during sync for audiobooks. Hide the stat row when missing. |
| Rating (stars) | `Book.rating` (1-5, user's own) already exists. Show as "Your rating" with star icon instead of the mockup's community aggregate "4.8 Rating". If unset, hide the rating element. |

## Components to Create

### 1. `BookDetailPage` — `src/app/pages/BookDetail.tsx`

Page component rendered at `/library/:bookId`. Structure:
- Back navigation (arrow button returning to `/library?tab=${returnTab}` where `returnTab` is derived from navigation state (via `useNavigation` or route state), defaulting to `'continue'` when unknown)
- `BookDetailHero` — cover + metadata + actions
- `SimilarBooksShelf` — "More like this" horizontal scroll

### 2. `BookDetailHero` — `src/app/components/library/BookDetailHero.tsx`

Two-column responsive layout matching the mockup:

```
┌──────────────────────────────────────────────────────────────┐
│ [cover 2/3]  │  Format badge · ★ Your rating                 │
│              │  Title (44px extrabold)                        │
│              │  Author / Narrator                             │
│              │  ┌──────────┬──────────┬──────────┬──────────┐│
│              │  │  Time    │ Pages/   │ Language │ Released ││
│              │  │          │ Narrator │          │          ││
│              │  └──────────┴──────────┴──────────┴──────────┘│
│              │  Synopsis                                      │
│              │  Description text...                           │
│              │  [Read/Listen Now] [Add to Library] [Share]    │
└──────────────────────────────────────────────────────────────┘
```

**Metadata grid adapts by format:**

| Stat | Ebook | Audiobook |
|---|---|---|
| **Time** | Reading Time — `totalPages` × 2 min/page → "5h 45m" | Listening Time — `totalDuration` seconds → "12h 30m" |
| **Second stat** | Pages — `totalPages` → "312 Pages" | Narrator — `narrator` → "Shane Parrish" |
| **Third stat** | Language — `language` → "English" | Format — "Audiobook" |
| **Fourth stat** | Released — `publishDate` → "2023" | Released — `publishDate` → "2023" |

Fields gracefully hide when their data is missing (e.g., no narrator, no language, no publishDate). The grid always shows 2–4 stats depending on data availability — never shows empty cells.
```

Props: `{ book: Book }`

**Cover image:** Full-bleed blurred version as background (matching current `LibraryMediaHero` pattern), with sharp cover in the left column. Aspect ratio `aspect-[2/3]`, `rounded-xl`, `shadow-2xl`.

**Primary CTA:** Uses `getBookDestinationPath()` for navigation — same as the hero's "Continue Reading/Listening" behavior but labeled "Read Now" / "Listen Now" based on format.

**"Add to Library" button:** Only shown for server-sourced books not yet in local library (books with `source.type === 'remote'` but missing local file). Otherwise hidden — the book is already in the library.

**Share button:** Icon-only, uses `navigator.share()` if available, otherwise copies the book URL to clipboard.

### 3. `SimilarBooksShelf` — `src/app/components/library/SimilarBooksShelf.tsx`

Horizontal scrollable shelf reusing the existing `LibraryMediaShelfRow` pattern.

```
┌─────────────────────────────────────────────────────┐
│ More like this                    [◀] [▶]          │
│ Books on mental models, economics...                │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│ │ cover│ │ cover│ │ cover│ │ cover│ │ cover│      │
│ │ title│ │ title│ │ title│ │ title│ │ title│      │
│ │author│ │author│ │author│ │author│ │author│      │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
└─────────────────────────────────────────────────────┘
```

**Similarity algorithm** (keyword-based, no ML/API dependency):

1. **Same series** (highest priority) — books sharing `series` with the hero book, ordered by `seriesSequence`
2. **Same author** — other books by the same `author`, excluding the hero book
3. **Description keyword overlap** — the richest signal for thematic matching:
   - Strip HTML from both hero and candidate book descriptions
   - Remove stop words (common English words: "the," "a," "in," "of," etc.)
   - Extract significant bigrams (2-word phrases) and unigrams from the hero description
   - Score each candidate by how many overlapping terms appear in its description
   - Higher weight for bigram matches (more specific thematic signal)
4. **Same genre + tag overlap** — supplemental signal for books without descriptions
5. **Deduplicate** across all tiers, exclude the hero book itself, take top 12

This produces genuinely related results (e.g., "The Great Mental Models" would surface other decision-making/cognitive bias books even across different genres) while degrading gracefully when metadata is sparse.

**Performance boundary:** When the candidate pool exceeds ~200 books, the similarity keyword overlap query (tier 3) should either (a) debounce to a Web Worker via `new Worker()` or (b) limit scoring to the first 500 candidates (sorted by frecency) to prevent main-thread jank. This is a documented performance boundary -- revisit if the user's library grows beyond ~1,000 books.

**Scope note:** The similarity algorithm (particularly the keyword overlap scoring with bigrams and stop-word removal) is a non-trivial NLP-like component that requires careful implementation and testing. It is in-scope for this story but should be built as a standalone, well-tested utility module (`src/lib/similarity.ts`) to simplify future replacement or deferral to a dedicated similarity service.

Each card is a clickable `<BookTile>` variant or a simpler `SimilarBookCard` showing:
- Cover image (2/3 aspect, rounded-xl)
- Title (truncated to 1 line)
- Author (truncated to 1 line)

Card width: `w-48` (192px) matching the mockup. Clicking navigates to that book's detail page.

## Files to Modify

| File | Change |
|---|---|
| `src/app/routes.tsx` | Replace `<LibraryPage />` at `/library/:bookId` with `<BookDetailPage />` |
| `src/data/types.ts` | Add `language?: string` and `publishDate?: string` to `Book` interface |
| `src/app/components/library/LibraryMediaHero.tsx` | (No changes needed — Details button already navigates to `/library/:bookId`) |
| `src/app/components/library/BookTile.tsx` | Optional: add a secondary "Details" tap target on shelf tiles (defer to future story) |

## Files to Create

| File | Purpose |
|---|---|
| `src/app/pages/BookDetail.tsx` | Page component |
| `src/app/components/library/BookDetailHero.tsx` | Hero section |
| `src/app/components/library/SimilarBooksShelf.tsx` | "More like this" shelf |
| `tests/e2e/library-book-detail.spec.ts` | E2E tests |

## Implementation Steps

1. **Add `language` and `publishDate` to `Book` interface** — optional fields in `types.ts`; no migration needed (Dexie schema handles optional fields automatically)
2. **Create `BookDetailHero`** — two-column hero with cover, metadata grid, synopsis, action buttons
3. **Create `SimilarBooksShelf`** — Dexie similarity query + horizontal scroll shelf using existing `LibraryMediaShelfRow`
4. **Create `BookDetailPage`** — compose hero + similar shelf + back navigation to `/library`
5. **Update `routes.tsx`** — wire `/library/:bookId` to `BookDetailPage`
6. **Handle edge cases** — missing cover, missing author, missing description, missing optional metadata, empty similar books
7. **E2E tests** — navigate from hero Details button, verify all sections render, test empty/missing data states

## Edge Cases

- Book not found (invalid `bookId` in URL) → redirect to `/library` with toast
- Book has no cover → fallback icon (`BookOpen` / `Headphones`)
- Book has no description → hide synopsis section
- No similar books found → hide the entire "More like this" section
- Mobile (< 768px) → stack columns vertically; cover above metadata
- Loading state → skeleton while Dexie query resolves

## Acceptance Criteria

### Navigation
- [ ] Navigating to `/library/:bookId` with a valid ID renders the book detail page (not LibraryPage)
- [ ] Navigating to `/library/:bookId` with an invalid/missing ID redirects to `/library` and shows a toast error
- [ ] Back button returns to `/library` with the referrer tab preserved; defaults to `continue` when unknown

### Metadata Grid (Format-Adaptive)
- [ ] For ebook format: shows "Reading Time" (from `totalPages` × 2 min/page) and "Pages" in the first two stat positions
- [ ] For audiobook format: shows "Listening Time" (from `totalDuration`) and "Narrator" in the first two stat positions
- [ ] Third stat shows "Language" when `language` is present; omitted when missing
- [ ] Fourth stat shows "Released" (from `publishDate`) when present; omitted when missing
- [ ] The grid displays 2-4 stats depending on data availability -- never shows empty cells or placeholders
- [ ] Missing `totalPages` (ebook) or `totalDuration` (audiobook) gracefully hides the Time row
- [ ] Missing narrator (audiobook) gracefully hides the Narrator row
- [ ] Missing `isbn` and `fileSize` do not appear in the grid (they are not part of the 4-stat layout)

### Action Buttons
- [ ] Primary CTA button ("Read Now" / "Listen Now") is always visible for any book in the library
- [ ] Primary CTA navigates via `getBookDestinationPath()`, matching the hero's "Continue" behavior
- [ ] "Add to Library" is visible only for remote-sourced books (`source.type === 'remote'`) not yet in the local library
- [ ] "Add to Library" is hidden when the book is already in the local library
- [ ] "Share" is always visible; uses `navigator.share()` on supported browsers, copies URL to clipboard as fallback

### Similar Books Shelf
- [ ] Shelf appears when at least one similar book is found
- [ ] Shelf is hidden entirely when no similar books exist
- [ ] Similarity follows the 5-tier algorithm: same series > same author > keyword overlap > genre/tag > dedup
- [ ] Same-series books appear first, ordered by `seriesSequence`
- [ ] Same-author books exclude the hero book itself
- [ ] Description keyword overlap scores use bigram-weighted matching with stop-word removal
- [ ] Top 12 results are shown, de-duplicated across tiers
- [ ] Each card shows cover, title (1-line truncated), and author (1-line truncated)
- [ ] Cards are 192px wide (`w-48`) with 2/3 aspect covers
- [ ] Clicking a card navigates to that book's detail page at `/library/:bookId`

### Edge Cases
- [ ] Book not found → redirect with toast
- [ ] Missing cover → fallback icon (`BookOpen` / `Headphones`)
- [ ] Missing description → synopsis section hidden
- [ ] No similar books → "More like this" section hidden
- [ ] Mobile < 768px → columns stack vertically, cover above metadata
- [ ] Loading state shows skeleton while Dexie query resolves
- [ ] Empty library handled gracefully

### Performance
- [ ] Similarity query does not cause visible main-thread jank (frame drops) on libraries up to ~200 books
- [ ] Beyond 200 candidates, the query limits the scoring pool or offloads to a Web Worker
