---
title: "Book Detail Page — Implementation Lessons from /library/:bookId"
date: 2026-05-07
category: docs/solutions/best-practices
module: library
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when:
  - Building a dedicated detail page for library items (books, audiobooks, ebooks) in a React/TypeScript frontend
  - Implementing content-based similarity recommendations using local metadata (series, author, description keywords, genres)
  - Designing format-adaptive metadata displays that change available fields per format (ebook vs audiobook)
  - Handling share-button flows with clipboard API, AbortError filtering, and toast feedback
tags:
  - book-detail-page
  - similarity-algorithm
  - share-button
  - format-adaptive-metadata
  - library
  - performance-boundary
---

# Book Detail Page — Implementation Lessons from /library/:bookId

## Context

The `/library/:bookId` route originally re-rendered `LibraryPage` with a frecency record — a no-op that wasted a route. The "Details" button on hero and shelf tiles had no real destination. This feature replaced the no-op with a dedicated detail page showing rich metadata, a 5-tier similarity-based recommendation shelf, and action buttons with progressive error handling.

## Guidance

### Similarity algorithm (5-tier keyword matching)

`src/lib/similarity.ts` implements five tiers in descending priority:

1. **Same series** — books sharing `series` with the hero book, ordered by `seriesSequence`
2. **Same author** — other books by the same `author`, excluding the hero book
3. **Description keyword overlap** — bigram-weighted with stop-word removal (common English words `< 3 chars). Bigrams score 2× (more specific thematic signal) vs unigrams
4. **Genre + tag overlap** — supplemental signal for books without descriptions
5. **Deduplicate** across all tiers, exclude the hero book, take top 12

Key design decisions: the scoring pool is capped at 500 candidates (`MAX_SCORING_POOL`) to prevent main-thread jank. Beyond ~200 books, the query should debounce to a Web Worker or limit candidates. The module is standalone (`src/lib/similarity.ts`) so it can be replaced by a dedicated similarity service without touching page components.

```ts
// Excerpt — findSimilarBooks(hero, candidates)
const results = findSimilarBooks(heroBook, allBooks)
// Returns top 12 deduplicated, ordered by tier priority + score
```

### Format-adaptive metadata grid

`BookDetailHero` branches on `book.format === 'audiobook'` to show different stat rows:

| Stat position | Ebook | Audiobook |
|---|---|---|
| 1st | Reading Time (pages × 2 min) | Listening Time (seconds → "Xh Ym") |
| 2nd | Pages | Narrator |
| 3rd | Language (if available) | Language, or "Format: Audiobook" fallback |
| 4th | Released (from `publishDate`) | Released |

The grid gracefully omits rows when their backing data is absent — it never shows empty cells. The `StatGrid` component renders 2–4 items depending on availability.

### Share button progressive error handling

The share flow evolved across three review rounds into a three-tier cascade:

```ts
// BookDetailHero.tsx:165-185
const handleShare = useCallback(async () => {
  const url = `${window.location.origin}/library/${book.id}`
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: book.title, url })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return // user cancelled
      console.error('Share failed:', err)
      toast.error('Failed to share this book')
    }
  } else {
    try {
      await navigator.clipboard?.writeText(url)
      toast.info('Book URL copied to clipboard')
    } catch {
      toast.info(`Book URL: ${url}`)
    }
  }
}, [book.id, book.title])
```

Three tiers: native share (with AbortError filtering for user cancellation), clipboard write (with optional chaining guard + success toast), and a final toast fallback displaying the URL.

### Route wiring with returnTab preservation

The page reads `location.state.returnTab` to restore the user's previous library tab on back navigation, defaulting to `'continue'`:

```ts
// BookDetail.tsx
const location = useLocation()
const returnTab = (location.state as { returnTab?: string } | null)?.returnTab ?? 'continue'
```

This pattern is reusable for any detail page that needs referrer-aware back navigation.

## Why This Matters

Before this feature, clicking "Details" was a no-op. Now users see format-aware metadata, thematically relevant recommendations without any external API dependency, and a share flow that works across environments. The similarity algorithm is the most valuable internal artifact — it provides genuine recommendations using only local Dexie data, critical for an offline-first app. The progressive error handling pattern for the share button means sharing works across HTTPS, HTTP, and browsers without native share support.

## When to Apply

- When a list item needs more space than a tile or card can provide — build a detail page
- When implementing content recommendations without an external API — the 5-tier algorithm works on any entity with series/author/description/genre fields
- When any action button involves multiple fallback APIs — use the cascade pattern (native → clipboard → fallback)
- The `returnTab` pattern applies whenever a detail page has a back link to a tabbed parent

## Examples

- **Route wiring:** `/library/:bookId` in `routes.tsx:504-511` with lazy import and `SuspensePage` wrapper
- **Algorithm:** `findSimilarBooks()` in `src/lib/similarity.ts` — standalone, 5-tier, 500-candidate cap, 12 results max
- **Metadata grid:** `BookDetailHero.tsx:125-162` — format-branching with graceful field omission
- **Share cascade:** `BookDetailHero.tsx:165-185` — native share → clipboard → toast
- **Unit tests:** `src/lib/__tests__/similarity.test.ts` — 13 tests covering stop-word filtering, bigram weighting, tier ordering, deduplication, and empty-description handling

## Related

- [Plan: Book Detail Page](../../plans/2026-05-07-011-feat-book-detail-page-plan.md)
- [PR #536](https://github.com/PedroLages/knowlune/pull/536)
- [Library Page Tabbed IA Refactor Patterns](library-page-tabbed-ia-refactor-patterns-2026-05-02.md) — related returnTab pattern
- [Library Carousels — Unified BookTile with Composable Rails](library-carousels-unified-booktile-composable-rails-2026-05-05.md)
