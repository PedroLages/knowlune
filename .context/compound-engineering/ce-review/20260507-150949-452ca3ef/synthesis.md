# CE Review Synthesis

**Run ID:** 20260507-150949-452ca3ef
**Plan:** docs/plans/2026-05-07-011-feat-book-detail-page-plan.md (plan_source: explicit)
**Mode:** headless

## Scope

- **Base:** `ee6f5d6bfae8e6c96627fd0b10690f7e0ca576a7`
- **Branch:** `feature/ce-2026-05-07-book-detail-page`
- **Product code changes:**
  - `src/app/routes.tsx` — lazy-loaded BookDetailPage route at `/library/:bookId`
  - `src/data/types.ts` — added `language?: string`, `publishDate?: string` to `Book`
  - `src/app/pages/BookDetail.tsx` — new page component with loading skeleton, book-not-found redirect
  - `src/app/components/library/BookDetailHero.tsx` — new hero section (cover, metadata, synopsis, actions)
  - `src/app/components/library/SimilarBooksShelf.tsx` — new similar-books shelf using LibraryMediaShelfRow
  - `src/lib/similarity.ts` — new 5-tier keyword similarity algorithm
  - `src/lib/__tests__/similarity.test.ts` — unit tests for similarity
  - `tests/e2e/library-book-detail.spec.ts` — E2E tests

## Intent

Implement a dedicated book detail page at `/library/:bookId` with a hero section (cover, format-aware metadata grid, synopsis, action buttons) and a "More like this" similar books shelf. The page is format-adaptive (ebook vs audiobook) with gracefully degrading metadata.

## Reviewers

- correctness-reviewer (always)
- testing-reviewer (always)
- maintainability-reviewer (always)
- project-standards-reviewer (always)
- agent-native-reviewer (CE always-on)
- learnings-researcher (CE always-on)
- performance-reviewer (conditional — similarity algorithm is compute-heavy with defined performance boundary)
- reliability-reviewer (conditional — async Dexie queries, error handling, redirects)
- adversarial-reviewer (conditional — 600+ lines of new executable code)
- kieran-typescript-reviewer (conditional — TypeScript components, hooks, utilities)

## Verdict

Ready with fixes. No blocking issues. Two moderate issues (catch swallowing, clipboard fallback) and two minor issues (hardcoded returnTab, fragile StatGrid key) to address.

---

## Applied Fixes

No safe_auto fixes were applied. All identified findings require design judgment or cross-module changes.

---

## Gated-Auto Findings

[P2][gated_auto -> downstream-resolver][needs-verification] File: src/app/components/library/BookDetailHero.tsx:170 -- Empty catch block swallows non-AbortError exceptions
  Why: The `handleShare` function's catch block swallows ALL exceptions from `navigator.share()`, not just `AbortError` (the expected user-cancellation signal). If a different error occurs (e.g., the Share API is in an inconsistent state after the `typeof` check passes), it is silently suppressed and the user receives no feedback that sharing failed.
  Suggested fix: Filter for `AbortError` and re-throw or log others:
  ```ts
  catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return // user cancelled
    }
    console.error('Share failed:', err)
    toast.error('Failed to share')
  }
  ```
  Evidence: Line 169-171: empty catch clause catches all error types with only a comment as justification.
  Reviewer: correctness (0.72), adversarial (0.68)

[P2][gated_auto -> downstream-resolver][needs-verification] File: src/app/components/library/BookDetailHero.tsx:173 -- Clipboard API fallback not checked for availability
  Why: The `else` branch calls `navigator.clipboard.writeText(url)` without checking whether the Clipboard API is available. In insecure contexts (plain HTTP, localhost in some browsers), or older browsers, `navigator.clipboard` may be undefined or the `writeText` call may throw. This would produce an unhandled promise rejection with no user feedback.
  Suggested fix: Guard the clipboard call with an availability check:
  ```ts
  } else if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
  } else {
    toast.info(`Book URL: ${url}`)
  }
  ```
  Evidence: Line 172-174: `await navigator.clipboard.writeText(url)` — no guard for API availability.
  Reviewer: correctness (0.70), reliability (0.65)

---

## Manual Findings

[P3][manual -> downstream-resolver] File: src/app/pages/BookDetail.tsx:108 -- Hardcoded returnTab breaks tab preservation on back navigation
  Why: The plan specifies that `returnTab` should be derived from navigation state (via `useNavigation` or route state) to preserve the referrer tab. Currently hardcoded to `'continue'`, which means users who entered via the "All Books" or "Browse" tab will always land on the Continue tab when pressing Back. This is a UX regression from the plan's stated behavior.
  Suggested fix: Accept `returnTab` via route state:
  ```tsx
  const location = useLocation()
  const returnTab = (location.state as { returnTab?: string })?.returnTab ?? 'continue'
  ```
  Evidence: Line 108: `<BookDetailHero book={book} returnTab="continue" />` — hardcoded value.
  Reviewer: maintainability (0.65), correctness (0.60)

---

## Advisory Findings

[P3][advisory -> human] File: src/app/components/library/BookDetailHero.tsx:74 -- StatGrid uses label as React key, fragile to duplicate labels
  Why: `key={stat.label}` assumes stat labels are unique within the grid. Currently the stat-building logic guarantees uniqueness, but the key is not data-driven — future changes that produce duplicate visible labels would cause React reconciliation warnings or rendering bugs.
  Suggested fix: Use index-based or composite key.
  Evidence: Line 74: `<div key={stat.label}>` — label-dependent key is fragile.
  Reviewer: maintainability (0.60)

---

## Pre-Existing Issues

No pre-existing issues directly relevant to this diff. The `supabase/storage-setup.sql` modification is unrelated to the book detail page feature and was excluded from review scope.

---

## Requirements Completeness (plan_source: explicit)

| Requirement | Status | Notes |
|------------|--------|-------|
| R1: Navigate to /library/:bookId renders detail page | Met | routes.tsx updated |
| R2: Invalid bookId redirects to /library with toast | Met | BookDetail.tsx handles |
| R3: Back button preserves referrer tab | Partially met | Hardcoded to 'continue'; route state not wired |
| R4: Metadata grid format-adaptive | Met | Full implementation |
| R5: Missing data hides rows gracefully | Met | Null checks throughout |
| R6: Primary CTA via getBookDestinationPath | Met | |
| R7: "Add to Library" for remote books only | Met | showAddToLibrary prop + disabled stub |
| R8: Share button with navigator.share() + clipboard fallback | Met | With caveats (see findings) |
| R9: Similar books shelf with 5-tier algorithm | Met | Full implementation |
| R10: 12 max results, deduplicated | Met | |
| R11: Performance boundary at 200 candidates | Met | MAX_SCORING_POOL = 500 |
| R12: Mobile responsive (columns stack) | Met | grid-cols-1 md:grid-cols-2 |
| R13: Loading skeleton while Dexie resolves | Met | DetailSkeleton component |
| R14: Book not found redirect | Met | |
| R15: Missing description hides synopsis | Met | Conditional render |
| R16: Missing cover shows fallback icon | Met | BookCoverImage fallbackIcon |

**Unaddressed requirements flagged as findings:**
- R3 (referrer tab preservation) flagged as P3 manual finding above.

---

## Residual Risks

- Share functionality has two related issues (catch + clipboard guard) that together mean the share feature could fail silently in edge cases.
- The `_counter` module-level variable in similarity.test.ts is shared across test files running in the same worker. The `beforeEach` resets it, but if a test forgets to clean up, author names could be non-deterministic.
- SimilarBooksShelf memoizes `SimilarBookCard` with `useBookCoverUrl` hook inside — works correctly but any future hook modification that bypasses memoization could cause stale renders.

## Learnings & Past Solutions

No past issues related to this specific feature were found in `docs/solutions/`. The similarity algorithm and book detail page are new additions.

## Agent-Native Gaps

None identified. All new components and routes follow standard React Router + Dexie patterns that are agent-accessible.

## Testing Gaps

- No test coverage for the Clipboard API unavailability path in the share handler.
- No E2E test verifying `showAddToLibrary` is hidden when the book is in the local library.
- No unit test for `formatDuration` or `estimateReadingTime` helpers (edge cases like seconds=0, minutes-only durations).
- E2E tests do not verify that the synopsis HTML rendering is secure against script injection (the `sanitizeDescriptionHtml` function is the existing pattern, but no E2E assertion validates XSS prevention).

## Coverage

- Suppressed: 0 findings below 0.60 confidence threshold
- Untracked files excluded: none
- Failed reviewers: none
- Schema Drift Check: N/A (no migration files in diff)
- Deployment Notes: N/A (no migration files or schema.rb changes)

Review complete
