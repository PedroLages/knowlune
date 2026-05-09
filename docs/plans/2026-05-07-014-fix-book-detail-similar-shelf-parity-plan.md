---
title: "fix: Book detail cover sizes, similar shelf parity, and edition duplicates"
type: fix
status: active
date: 2026-05-07
related: docs/plans/2026-05-07-011-feat-book-detail-page-plan.md
---

# fix: Book detail cover sizes, similar shelf parity, and edition duplicates

## Overview

Align `/library/:bookId` with the library grid conventions established in `BookCard`: **audiobooks use square covers** (album-art style); **ebooks use portrait `2/3`**. Update the **More like this** row so each tile matches those sizes, format badge icons, and hover motion. Investigate **duplicate titles** in recommendations—they are separate library items (often ebook + audiobook of the same work); the similarity algorithm dedupes by **book id** only, so both editions can surface.

## Problem Frame

On the book detail page, users see an audiobook hero with a **portrait** cover frame while the rest of the library (`BookCard`) shows **square** audiobook art. The similar-books carousel uses **uniform portrait** tiles and omits the **headphones / book** corner badges used on shelf cards. Carousel chrome (arrows, scroll) already comes from `LibraryMediaShelfRow`; visual mismatch comes from **card height/aspect** and **missing badges**, not from a second carousel implementation.

**Duplicate titles:** Tier 2 of `findSimilarBooks` includes **all** other books by the same author. If the user owns the same title as **EPUB and audiobook** (different `Book.id` values), both pass deduplication and appear as two carousel entries with the same cover art and title.

## Requirements Trace

- R1. Hero cover **aspect ratio and treatment** match `BookCard` for the same `book.format` (audiobook → square; epub/other → `aspect-[2/3]`).
- R2. **More like this** tiles match library shelf **cover geometry and format icons** (and comparable hover / shadow behavior) for each item’s format.
- R3. Horizontal shelf **navigation** matches the library page: reuse **`LibraryMediaShelfRow`** without forking; adjust only if shared layout constants (e.g. arrow vertical position) need retuning after tile height changes.
- R4. **Duplicates:** Document root cause; implement **work-level deduplication** so the carousel does not show two entries for the same title+author when they represent paired formats, without breaking legitimate same-author different titles.
- R5. **Tests** updated for similarity behavior and, where practical, detail/shelf UI regressions.

## Scope Boundaries

- **In scope:** `BookDetailHero` cover frame; `SimilarBooksShelf` / `SimilarBookCard`; `findSimilarBooks` deduplication rules; unit tests in `src/lib/__tests__/similarity.test.ts`; E2E extensions in `tests/e2e/library-book-detail.spec.ts`.
- **Out of scope:** Fetching different image URLs per format from ABS (covers are whatever is stored on `Book.coverUrl`); changing OPDS or sync pipelines; redesigning the entire detail page layout beyond cover parity.

### Deferred to Separate Tasks

- Optional **extract** of a shared “shelf tile” subcomponent used by both `BookCard` and `SimilarBookCard`—only if duplication after mirroring classes becomes painful (YAGNI until second duplication).

## Context & Research

### Relevant Code and Patterns

- **Canonical sizes:** `BookCard` — audiobook `aspect-square` + headphones badge; ebook `aspect-[2/3]` + book icon (`src/app/components/library/BookCard.tsx`).
- **Detail hero (bug):** Fixed `aspect-[2/3]` for all formats (`src/app/components/library/BookDetailHero.tsx` ~line 237).
- **Similar shelf (bug):** `SimilarBookCard` uses `aspect-[2/3]` for all and no format badge (`src/app/components/library/SimilarBooksShelf.tsx`).
- **Reference for edit dialog parity:** `EditorCoverSection` documents the same rule: audiobook square, `aspect-[2/3]` for ebook (`src/app/components/library/EditorCoverSection.tsx`).
- **Carousel shell:** `LibraryMediaShelfRow` provides scroll-snap row, hidden scrollbar, left/right chevrons, keyboard arrows (`src/app/components/library/LibraryMediaShelfRow.tsx`). `SimilarBooksShelf` already wraps it—parity is mostly **card content**, not a second carousel.
- **Duplicates:** `findSimilarBooks` uses `seenIds: Set<string>` keyed by **`book.id`** only (`src/lib/similarity.ts`). No collapse of same title+author across formats. `Book.linkedBookId` exists for paired editions (`src/data/types.ts`).

### Institutional Learnings

- See `docs/solutions/best-practices/book-detail-page-implementation-lessons-2026-05-07.md` for the five-tier similarity design; this plan **extends** deduplication behavior, not replace the tier structure.

### External References

- None required—behavior is entirely local UI parity and library data model.

## Key Technical Decisions

1. **Hero and tile aspect:** Branch on `book.format === 'audiobook'` exactly like `BookCard` (square vs `2/3`). Single source of truth for “what shape is this format” avoids drift.
2. **Work-level dedupe:** When inserting a candidate, treat **normalized `(title, author)`** as a secondary key: if a candidate matches an already-selected book on that key, **collapse to one**. The "More like this" row surfaces *other works* the user might enjoy — showing two cards with identical cover art and different format badges for a title the user already owns in both formats is visual noise, not discovery. The user already has both formats in their library; the dedupe keeps recommendations focused on new content.
   - If one of the pair matches **hero’s format**, prefer that edition (the user is already browsing in that format). **Trade-off acknowledged:** this means browsing the same work as an ebook vs audiobook may surface a different deduped tile in "More like this" — the recommendation is format-contextual rather than format-agnostic. This is intentional: showing the edition matching the format the user is currently exploring is more relevant than enforcing consistent results across format pages.
   - Additionally, when adding a book to results, proactively mark its `linkedBookId` as consumed (add to `seenIds` or `seenWorkKeys`) to prevent the linked edition from appearing later in a lower tier — even when titles differ slightly (sync hygiene). Check bidirectionally: if the candidate’s `linkedBookId` is already consumed, skip it; also consume the candidate’s own `linkedBookId` when the candidate is accepted.
   - **Data dependency:** `linkedBookId` bidirectional tracking is ~10 lines of code and silently no-ops when the field is null. Its value depends on how often paired editions are linked in production data. Before implementing, grep or log the proportion of books with a non-null `linkedBookId` to confirm the mechanism will actually fire. If the field is effectively unused, the title+author key alone carries the dedup.

3. **Normalize title for dedupe:** Trim, collapse internal whitespace, optional lowercase for comparison—**do not** strip punctuation aggressively enough to merge different works (keep it simple: `trim` + `toLowerCase` + whitespace normalization).
   - **Known limitation:** This conservative normalization only catches exact title matches. Real catalogs frequently have subtitle suffixes ("Name of the Wind: 10th Anniversary Edition"), edition markers ("Dune (Movie Tie-In)"), or series parentheticals. Users owning both formats where titles differ slightly will still see duplicates. This is a deliberate precision-over-recall choice — false positives (merging distinct works) are more confusing than false negatives (showing occasional duplicates). If variant-title duplicates prove common in production, a second pass can add optional subtitle/suffix stripping as a follow-up.

## Open Questions

### Resolved During Planning

- **Why two rows with the same title?** Tier 2 (same author) plus id-only dedupe; two formats ⇒ two `Book` rows ⇒ two results.

### Deferred to Implementation

- Whether **series** ordering should consider dedupe across formats when both are in the same series (likely covered by same title+author rule).

## Implementation Units

- [ ] **Unit 1: Format-aware hero cover**

**Goal:** Detail page hero shows square artwork frame for audiobooks and portrait for ebooks.

**Requirements:** R1

**Dependencies:** None

**Files:**

- Modify: `src/app/components/library/BookDetailHero.tsx`
- Modify: `src/app/pages/BookDetail.tsx` — skeleton currently uses unconditional `aspect-[2/3]`; make it format-aware (pass `book.format` to the skeleton, or fall back to a neutral `aspect-square` while loading so neither format suffers a layout shift)

**Approach:**

- Replace the single `aspect-[2/3]` wrapper with conditional classes: **`aspect-square`** when `book.format === ‘audiobook’`, else **`aspect-[2/3]`** (both `BookCard` and `EditorCoverSection` use this same logic for non-audio formats).
- Keep `max-w-[280px]` (or adjust so square and portrait feel balanced in the left column; square may need the same max **width** so height does not dominate—tune visually).
- Optionally align hover/shadow language with `BookCard` if the hero cover is interactive (currently static image—minimal motion is fine).

**Patterns to follow:** `BookCard` cover wrappers (`src/app/components/library/BookCard.tsx`).

**Test scenarios:**

- **Happy path:** Render detail for audiobook fixture → hero cover container has square aspect (assert computed style or stable `data-testid` + class).
- **Happy path:** Render detail for epub fixture → portrait `2/3`.
- **Edge case:** Book with missing cover still respects format aspect (placeholder/fallback).

**Verification:** Audiobook detail hero visually matches grid square cards; ebook matches portrait cards.

---

- [ ] **Unit 2: Similar row tiles — parity with `BookCard`**

**Goal:** Each similar book tile uses the correct aspect ratio, format badge (headphones vs book), and hover/transition classes consistent with the library grid.

**Requirements:** R2, R3

**Dependencies:** Unit 1 (conceptual alignment; can implement in parallel after agreeing class names)

**Files:**

- Modify: `src/app/components/library/SimilarBooksShelf.tsx`
- Optional: small shared constant file **only if** the team wants one place for `AUDIOBOOK_COVER_CLASSES` / `EBOOK_COVER_CLASSES` — prefer inline mirror of `BookCard` first.

**Approach:**

- In `SimilarBookCard`, branch like `BookCard`: audiobook → square container + top-right headphones badge; ebook → `aspect-[2/3]` + book icon badge (reuse the same badge markup/classes as `BookCard` for consistency).
- Match border-radius: change cover container from `rounded-xl` to `rounded-2xl` (add `overflow-hidden`) to match `BookCard` exactly.
- Align motion: e.g. `group-hover:-translate-y-2`, `duration-300`, `group-hover:scale-105` on the image to match the shelf card (Minor drift from current `-translate-y-1` is the point).
- Card width `w-48` may remain; square tiles will be **shorter** than portrait—acceptable if browse grid uses the same width bucket for squares (confirm against `Library` browse section). If browse uses different width, match browse **column width** for the active tab (implementer compares `Library.tsx` / browse grid classes).

**Patterns to follow:** `BookCard` (audiobook vs ebook branches).

**Test scenarios:**

- **Happy path:** Similar list includes one audiobook and one epub → correct aspect + badge for each (`data-testid` per format optional).
- **Integration:** `LibraryMediaShelfRow` still scrolls; left/right buttons remain usable after tile height change (manual or E2E smoke).

**Verification:** Side-by-side with `/library?tab=browse` (or primary browse surface)—tiles look like they belong to the same design system.

---

- [ ] **Unit 3: Carousel behavior — verify shared row, tune only if needed**

**Goal:** Arrows and scroll behavior match the library shelves; no duplicate carousel implementation.

**Requirements:** R3

**Dependencies:** Unit 2

**Files:**

- Modify only if necessary: `src/app/components/library/LibraryMediaShelfRow.tsx` (e.g. `top-[38%]` arrow position if vertically off after square tiles)

**Approach:**

- Confirm `SimilarBooksShelf` already uses `LibraryMediaShelfRow`—no new carousel.
- After Unit 2, if chevrons overlap tiles or appear vertically misaligned, adjust the arrow `top` percentage so the button center aligns with the vertical midpoint of the **tallest tile's cover area** (not the full card height). Target: chevron center sits at ~50% of the cover image height for both square and portrait tiles.
- **Acceptance criteria:** On a library shelf mixing audiobook (square) and ebook (portrait) tiles, both left and right chevron buttons are fully visible (no overlap with tile edges) and vertically centered on the cover images at all breakpoints ≥ `md`.

**Test expectation:** At `md+`, assert chevron buttons are visible and not clipped by tile edges. If a CSS-only nudge changes no behavior at narrow viewports, no additional test needed.

**Verification:** Side-by-side visual comparison with a library shelf row that mixes formats.

---

- [ ] **Unit 4: Similarity deduplication — same work, two formats**

**Goal:** Reduce duplicate **titles** in **More like this** when the library contains both ebook and audiobook of the same work.

**Requirements:** R4, R5

**Dependencies:** None (can parallel Unit 1–2)

**Files:**

- Modify: `src/lib/similarity.ts`
- Modify: `src/lib/__tests__/similarity.test.ts`

**Approach:**

- Introduce a **`seenWorkKeys`** `Set<string>` (separate from `seenIds` to avoid namespace collision between book UUIDs and title strings): a normalized `title|author` string.
- When considering a candidate, if `workKey` is already seen, compare the existing and candidate entries per **Key Technical Decisions**: prefer the entry matching the hero's format; if neither matches hero format, prefer the audiobook edition; if both share the same format, keep the higher-tier/score entry. When the candidate is preferred, remove the existing entry from `results` and `seenIds` and insert the candidate in its place.
- Integrate **`linkedBookId`** bidirectionally: (a) when adding book A to results, also add `A.linkedBookId` to `seenIds` so B is blocked from appearing later; (b) when evaluating a candidate, if `candidate.linkedBookId` is already in `seenIds`, skip it. This handles both orderings — whether the linked pair arrives before or after its counterpart in the tier walk.
- Preserve existing tier ordering; dedupe should **not** reorder within tier beyond dropping duplicates.
- **Test factory:** The `makeBook` helper in `similarity.test.ts` enumerates return fields explicitly; add `linkedBookId` to the return object so tests can seed linked-format pairs.

**Test scenarios:**

- **Happy path:** Hero ebook; candidates include same-title audiobook and ebook → only one appears.
- **Happy path:** Two different titles by same author → both still appear.
- **Edge case:** Same title, different authors (rare) → should **not** dedupe (author part of key).
- **Edge case:** Linked pair via `linkedBookId` → only one card.
- **Regression:** Existing tier priority tests in `similarity.test.ts` still pass.

**Verification:** New unit tests green; duplicate-title case from user library no longer appears in carousel when both formats exist.

---

- [ ] **Unit 5: E2E and docs touchpoints**

**Goal:** Guard regressions at the route level and keep internal docs honest.

**Requirements:** R5

**Dependencies:** Units 1–4

**Files:**

- Modify: `tests/e2e/library-book-detail.spec.ts`
- Optional: `docs/solutions/best-practices/book-detail-page-implementation-lessons-2026-05-07.md` — one paragraph on work-level dedupe (only if changed behavior is stable)

**Approach:**

- Extend E2E: seed paired duplicate author + same title, two formats → assert only one similar tile (or assert **count** of visible tiles with that title ≤ 1). Use `data-testid` on similar cards if needed.
- Add a check that audiobook detail page hero uses square (e.g. class or layout assertion).

**Verification:** `tests/e2e/library-book-detail.spec.ts` passes in CI.

## User-Facing Success Criteria

- Users can identify a book's format at a glance from the detail hero cover shape — square = audiobook, portrait = ebook — without needing to read the format label.
- No duplicate-title entries appear in "More like this" for any user library containing dual-format works (same title + author in both ebook and audiobook).
- Similar-shelf tiles look like they belong to the same design system as the library browse grid (same aspect ratios, format badges, corner rounding, and hover behavior).

## System-Wide Impact

- **Interaction graph:** `findSimilarBooks` consumed only from `BookDetail.tsx` today—grep for other callers before changing export shape.
- **State lifecycle risks:** None; pure function change.
- **Unchanged invariants:** Tier priorities (series → author → keyword → genre-tag); `MAX_RESULTS` / pool caps.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Aggressive title normalization merges distinct books | Keep key as `(normalizedTitle, normalizedAuthor)`; document edge cases |
| Conservative normalization misses variant-title duplicates (subtitles, edition markers) | Documented as known limitation in KTD #3; follow up with subtitle stripping if common in production data |
| `linkedBookId` incomplete in data | Title+author dedupe still helps; linkage is additive. Verify `linkedBookId` population rate via grep before implementing bidirectional tracking |
| Square tiles change carousel height and arrow overlap | Unit 3 visual pass; single CSS constant if needed |

## Documentation / Operational Notes

- Brief developer note in `similarity.ts` header comment explaining **work-level** dedupe for dual formats.

## Sources & References

- **Related plan:** [2026-05-07-011-feat-book-detail-page-plan.md](2026-05-07-011-feat-book-detail-page-plan.md)
- **Code:** `src/app/components/library/BookDetailHero.tsx`, `src/app/components/library/SimilarBooksShelf.tsx`, `src/app/components/library/BookCard.tsx`, `src/lib/similarity.ts`, `src/app/components/library/LibraryMediaShelfRow.tsx`
- **Tests:** `src/lib/__tests__/similarity.test.ts`, `tests/e2e/library-book-detail.spec.ts`
- **Learning doc:** [docs/solutions/best-practices/book-detail-page-implementation-lessons-2026-05-07.md](../../solutions/best-practices/book-detail-page-implementation-lessons-2026-05-07.md)
