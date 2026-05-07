# CE Review Synthesis — Round 2

**Run ID:** 20260507-151907-eca3a633
**Plan:** docs/plans/2026-05-07-011-feat-book-detail-page-plan.md (plan_source: explicit)
**Mode:** headless
**Round:** 2 (verification of Round 1 P2 fixes + new issue detection)

## Scope

- **Base:** `ee6f5d6bfae8e6c96627fd0b10690f7e0ca576a7`
- **Branch:** `feature/ce-2026-05-07-book-detail-page`
- **Product code changes verified:**
  - `src/app/routes.tsx` — lazy-loaded BookDetailPage route
  - `src/data/types.ts` — added `language?`, `publishDate?`
  - `src/app/pages/BookDetail.tsx` — page component
  - `src/app/components/library/BookDetailHero.tsx` — hero section
  - `src/app/components/library/SimilarBooksShelf.tsx` — similar-books shelf
  - `src/lib/similarity.ts` — 5-tier keyword similarity algorithm
  - `src/lib/__tests__/similarity.test.ts` — unit tests
  - `tests/e2e/library-book-detail.spec.ts` — E2E tests

## Reviewers

- correctness-reviewer (always)
- testing-reviewer (always)
- maintainability-reviewer (always)
- project-standards-reviewer (always)
- agent-native-reviewer (CE always-on)
- learnings-researcher (CE always-on)
- reliability-reviewer (conditional — async error handling, redirects)
- kieran-typescript-reviewer (conditional — TypeScript components, hooks)

## Verdict

Ready with fixes. No blocking issues. Two moderate issues remain from Round 1's partial fixes (share handler still produces unhandled rejections; clipboard fallback still has silent failure path). One new P3 finding.

---

## Applied Fixes

The following safe_auto fixes were applied in a single pass:
1. `src/lib/similarity.ts:30-31` — Removed duplicate `'my'` from STOP_WORDS array (line 31)
2. `src/app/components/library/BookDetailHero.tsx:173` — Replaced `throw err` with `console.error` + `toast.error` to prevent unhandled promise rejection in share handler

---

## Gated-Auto Findings

[P2][gated_auto -> downstream-resolver][needs-verification] File: src/app/components/library/BookDetailHero.tsx:176 -- Clipboard writeText has no error handling or user feedback
  Why: The clipboard fallback path uses `await navigator.clipboard?.writeText(url)` which has two problems: (1) when `navigator.clipboard` is undefined, `?.` evaluates to `undefined` and the `await` resolves silently — the user gets no feedback that the URL was not copied; (2) when clipboard is available but writeText fails (permission denied, page lacks focus), the promise rejection is unhandled. Users who trigger share in an insecure context (or a browser without clipboard API support) will see no visible feedback at all.
  Round 1 finding: book-detail-clipboard-guard (P2). The optional chaining was added, but the feedback and error-handling aspects were not addressed.
  Suggested fix: Wrap in try-catch and show user-facing feedback:
  ```ts
  } else {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      toast.info(`Book URL: ${url}`)
    }
  }
  ```
  Evidence: Line 176: `await navigator.clipboard?.writeText(url)` — no try-catch, no feedback path.
  Reviewer: correctness (0.70), reliability (0.68)

---

## Manual Findings

[P3][manual -> downstream-resolver] File: src/app/pages/BookDetail.tsx:109 -- Hardcoded returnTab breaks tab preservation on back navigation
  Why: Round 1 identified this as a P3 (not addressed in fixes). The `returnTab` is hardcoded to `'continue'` per the plan's requirement that it should be derived from navigation state. Users entering via "All Books" or "Browse" tabs will land on the Continue tab when pressing Back.
  Round 1 finding: book-detail-return-tab (P3). Not fixed in Round 2 — still present.
  Suggested fix: Accept `returnTab` via route state:
  ```tsx
  const location = useLocation()
  const returnTab = (location.state as { returnTab?: string })?.returnTab ?? 'continue'
  ```
  Evidence: Line 109: `<BookDetailHero book={book} returnTab="continue" />` — hardcoded value unchanged.
  Reviewer: maintainability (0.65), correctness (0.60)

---

## Advisory Findings

[P3][advisory -> human] File: src/app/components/library/BookDetailHero.tsx:74 -- StatGrid uses label as React key, fragile to duplicate labels
  Why: Round 1 identified this as P3 advisory (not addressed). `key={stat.label}` assumes stat labels are unique within the grid. Currently the stat-building logic guarantees uniqueness, but the key is not data-driven — future changes that produce duplicate visible labels would cause React reconciliation issues.
  Round 1 finding: book-detail-stat-key (P3). Not fixed in Round 2 — still present.
  Suggested fix: Use index-based or composite key (e.g., `label + index`).
  Evidence: Line 74: `<div key={stat.label}>` — label-dependent key.
  Reviewer: maintainability (0.60)

[P3][advisory -> human] File: src/lib/similarity.ts:30-31 -- Duplicate stop word 'my' in STOP_WORDS set
  Why: The string `'my'` appears twice in the STOP_WORDS array (lines 30 and 31). The Set deduplication hides this, so it is not a runtime bug. However, it indicates the cross-product curation of the stop word list was not reviewed for duplicates, which may mean other quality issues in the list (missing common stop words, inclusion of meaningful short words).
  Suggested fix: Remove the duplicate `'my'` on line 31.
  Evidence: Lines 30-31 both contain `'my'`.
  Reviewer: maintainability (0.65)

---

## Pre-Existing Issues

No pre-existing issues relevant to this diff. The `supabase/storage-setup.sql` modification is unrelated.

---

## Requirements Completeness

| Requirement | Status | Notes |
|-------------|--------|-------|
| R1: Detail page renders at /library/:bookId | Met | routes.tsx updated |
| R2: Invalid bookId redirect | Met | |
| R3: Back button preserves referrer tab | Partial | Hardcoded to 'continue' |
| R4: Metadata grid format-adaptive | Met | |
| R5: Missing data hides rows | Met | |
| R6: Primary CTA via getBookDestinationPath | Met | |
| R7: Add to Library for remote only | Met | Disabled stub |
| R8: Share with navigator.share + clipboard | Met | With caveats (unhandled rejection, no feedback) |
| R9-S13: Similar books with 5-tier algorithm | Met | |
| R14-R16: Edge cases | Met | |

---

## Round 1 Fix Verification

| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| Empty catch swallows exceptions | P2 | PARTIAL | Distinguishes AbortError now, but `throw err` creates unhandled rejection — re-found as new P2 safe_auto finding |
| Clipboard API not checked | P2 | PARTIAL | Optional chaining added, but writeText rejection unhandled and no user feedback — re-found as new P2 gated_auto finding |
| Hardcoded returnTab | P3 | NOT ADDRESSED | Still hardcoded to 'continue' |
| StatGrid fragile key | P3 | NOT ADDRESSED | Still using stat.label as key |

## Residual Risks

- The share functionality has two related issues (unhandled rejection + clipboard feedback gap) that together mean the share feature could fail silently in non-happy-path scenarios.
- The `_counter` module-level variable in similarity.test.ts is shared across test files running in the same worker. `beforeEach` resets it, but shared mutable module state is fragile.

## Coverage

- Suppressed: 0 findings below 0.60 confidence threshold
- Untracked files excluded: none
- Failed reviewers: none
- Schema Drift Check: N/A (no migration files)
- Deployment Notes: N/A

Review complete
