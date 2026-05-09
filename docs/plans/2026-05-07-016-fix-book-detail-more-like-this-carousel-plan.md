---
title: "fix: Book detail “More like this” — uniform square tiles, rail hover, hidden scrollbar"
type: fix
status: active
date: 2026-05-07
related:
  - docs/plans/2026-05-07-014-fix-book-detail-similar-shelf-parity-plan.md
  - docs/solutions/best-practices/library-carousels-unified-booktile-composable-rails-2026-05-05.md
---

# fix: Book detail “More like this” — uniform square tiles, rail hover, hidden scrollbar

## Overview

From the book detail screenshot (`/library/:bookId`): the **More like this** row mixes **short square** audiobook tiles with **taller portrait** ebook tiles; a **horizontal scrollbar** is visible; **prev/next chevrons** stay visible instead of revealing on shelf hover/focus like the primary Library **Continue / Discover / Recently Added** rails.

This plan makes the carousel **consistent with Library rails**: **every tile uses the audiobook footprint (square cover at fixed width `w-48`)**, swaps the shelf shell from **`LibraryMediaShelfRow`** to **`LibraryRail`** (hover/focus-within chevrons, `scrollbar-none` viewport), and adds **`data-rail-tile`** on each tile for correct tile-step scrolling.

## Problem Frame

Readers scanning recommendations expect a single visual rhythm across the row. Portrait ebook art in the same strip as square audiobooks forces uneven row height and draws attention to chrome (scrollbar + static arrows) instead of covers.

The Library **Continue Listening / Reading**, **Recently Added**, and **Discover** surfaces already standardized on **`LibraryRail`** (`group/rail` hover pattern, **`RailViewport`** scrollbar hiding). **More like this** still sits on **`LibraryMediaShelfRow`**, which keeps chevrons **always visible at `md+`** and hides scrollbars via ad hoc Tailwind utilities that **do not match** `RailViewport`’s `.scrollbar-none` layering—so some browsers/OS settings can still expose a scrollbar track.

### Relationship to open plan `2026-05-07-014`

[2026-05-07-014-fix-book-detail-similar-shelf-parity-plan.md](2026-05-07-014-fix-book-detail-similar-shelf-parity-plan.md) **Unit 2** calls for **similar tiles to mirror `BookCard`** (audiobook square, **ebook portrait `aspect-[2/3]`**). **This plan supersedes that requirement for “More like this” only**, per explicit product direction: **one size for all items in this row, defaulting to the audiobook (square) frame.** If 014 is implemented first, **reconcile or drop** its similar-row aspect rules for ebooks before merge; if this plan lands first, **amend 014’s Unit 2** so it does not reintroduce portrait ebooks in this shelf.

## Requirements Trace

- R1. **Uniform tile geometry** in **More like this**: audiobook and ebook covers share the **same square** aspect at the same width (match current **`w-48`** card width; cover uses **`object-cover`** inside the square—standard trim, no letterboxing unless already used elsewhere).
- R2. **Chevron behavior** matches **Library primary rails**: visible only on **`md+`**, **opacity 0** until **hover or focus-within** the shelf (`group/rail` contract from [library-carousels-unified-booktile-composable-rails-2026-05-05.md](../../solutions/best-practices/library-carousels-unified-booktile-composable-rails-2026-05-05.md)).
- R3. **No visible horizontal scrollbar** in that row while horizontal scroll remains available (trackpad, touch, keyboard).
- R4. **Scroll affordances** remain correct: overflow detection, disabled state at ends, **one-tile + gap** step when using chevrons (requires **`data-rail-tile`** on each tile root—same contract as **`BookTile`**).
- R5. **Regression coverage** via focused component tests + existing E2E identifiers stable (`similar-books-shelf`, `similar-book-*`).

## Scope Boundaries

- **In scope:** `SimilarBooksShelf` / **`SimilarBookCard`**; swapping shelf primitive to **`LibraryRail`** for this shelf only; **`data-testid`** wiring preserved for E2E.
- **Out of scope:** Migrating remaining **`LibraryMediaShelfRow`** consumers on Library (e.g. **Recent Series**, **Listen & Read Again**) unless a follow-up explicitly requests global parity—those remain **always-visible** chevrons by design until migrated.
- **Out of scope:** Changing **browse grid `BookCard`** portrait-vs-square rules globally; changing **similarity** algorithm or **`BookDetail`** hero (**unless** a shared implementation mistakenly couples hero to similar-row sizing—unlikely).

### Deferred to Separate Tasks

- Optional **extract** of a thin “square cover + format badge” fragment shared by **`BookTile`** and **`SimilarBookCard`** — only if duplication becomes painful (**YAGNI**).

## Context & Research

### Relevant code and patterns

- **Detail shelf:** `src/app/components/library/SimilarBooksShelf.tsx` — **`LibraryMediaShelfRow`** wrapper; **`SimilarBookCard`** uses **format-dependent** aspect today (`aspect-square` vs `aspect-[2/3]`) → **violates R1** as soon as both formats appear.
- **Target shell:** `src/app/components/library/rails/LibraryRail.tsx` — composes **`RailHeader`** → **`LibraryShelfHeading`**, **`RailControls`** (hover/focus chevrons), **`RailViewport`** (`scrollbar-none`, snap).
- **Scroll measurement:** `src/app/components/library/rails/RailControls.tsx` — queries **`[data-rail-tile]`** on the viewport; **`BookTile`** sets **`data-rail-tile`** on its outer **`div`** (`src/app/components/library/BookTile.tsx`).
- **Legacy shelf (current detail):** `src/app/components/library/LibraryMediaShelfRow.tsx` — chevrons **always opaque** when overflow; scroller **`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`** (not **`scrollbar-none`**).
- **Older Library primitive with hover:** `src/app/components/library/LibraryShelfRow.tsx` — **`group/shelf`** hover pattern; **`LibraryRail`** intentionally uses **`group/rail`** naming to avoid cascade bugs in nested rails (see solutions doc).

### Institutional learnings

- [library-carousels-unified-booktile-composable-rails-2026-05-05.md](../../solutions/best-practices/library-carousels-unified-booktile-composable-rails-2026-05-05.md) — **`group/rail`** scoping, **`data-rail-tile`** contract, **`pointer-events-none` until hover**, double **`requestAnimationFrame`** after smooth scroll for affordance updates.

### External references

- None — behavior is repo-local UX parity.

## Key technical decisions

1. **Prefer `LibraryRail` over patching `LibraryMediaShelfRow`** for this shelf so behavior matches migrated Library rails **without** changing every remaining **`LibraryMediaShelfRow`** consumer.
2. **Force `aspect-square` for all formats** in **`SimilarBookCard`** only — keeps **`BookCard` / Browse** semantics unchanged elsewhere.
3. **Single `data-testid` root:** pass **`data-testid="similar-books-shelf"`** into **`LibraryRail`** (its root **`section`** consumes it); **remove** the redundant outer **`<section data-testid="similar-books-shelf">` wrapper** unless E2E needs both—currently only **`similar-books-shelf`** is asserted in **`tests/e2e/library-book-detail.spec.ts`**.
4. **`data-rail-tile`** on **`SimilarBookCard`’s** outer **`w-48`** container (mirror **`BookTile`** placement) so **`RailControls`** measures the intended width.

### Resolved during planning

- **“Which Library pattern?”** — **Continue / Discover / Recently Added** use **`LibraryRail`** (`LibraryMediaShelfColumn.tsx`). That is the reference for hover chrome and scrollbar treatment.

### Deferred to implementation

- Fine-tune **`top-[38%]`** chevron vertical alignment after all tiles are square (likely minimal change versus mixed-aspect baseline).

## High-Level technical design

> *Illustrative only — directional guidance for review, not code to reproduce.*

```
SimilarBooksShelf
  └── LibraryRail (group/rail, data-testid=similar-books-shelf)
        RailHeader(title="More like this", icon=BookHeart, count=N)
        RailControls (←/→ hover + focus-within)
        RailViewport.scrollbar-none
              └── Snap wrappers
                    └── SimilarBookCard (data-rail-tile, w-48, aspect-square cover)
```

## Implementation units

- [ ] **Unit 1: Uniform square covers on similar tiles**

**Goal:** Audiobooks and ebooks in **More like this** share identical cover frame dimensions.

**Requirements:** R1

**Dependencies:** None

**Files:**

- Modify: `src/app/components/library/SimilarBooksShelf.tsx` ( **`SimilarBookCard`** )
- Test: `src/app/components/library/__tests__/SimilarBooksShelf.test.tsx` (new)

**Approach:**

- Remove format branch that applies **`aspect-[2/3]`** to ebooks; use **`aspect-square`** for **all** **`book.format`** values in this component only.
- Keep **headphones / book** corner badges and hover motion already aligned with shelf cards unless they conflict with the new geometry.
- Set **`data-rail-tile`** on the **`w-48`** outer interactive container (**same semantic role as **`BookTile`’s** root).

**Patterns to follow:** Square cover framing in **`BookTile`** (**`sizes.cover`** use **`aspect-square`** for small variants)—visual language, not necessarily shared code.

**Test scenarios:**

- **Happy path:** Render shelf with **one audiobook, one epub** → both cover wrappers include **square** aspect class (DOM class assertion).
- **Edge case:** **`pdf`** format in similar list (**if surfaced**) → still **square** frame.

**Verification:** Manual side-by-side: no tile is taller than another in the **cover** region; ebooks are center-cropped via **`object-cover`**, not stretched.

---

- [ ] **Unit 2: Swap shelf shell to `LibraryRail`**

**Goal:** Hover/focus-within chevrons + **`scrollbar-none`** viewport parity with Library primary rails.

**Requirements:** R2, R3, R4

**Dependencies:** Unit 1 ( **`data-rail-tile`** should exist before relying on **`RailControls`** measurement—can land same commit).

**Files:**

- Modify: `src/app/components/library/SimilarBooksShelf.tsx`
- Optionally modify comment blocks / file header explaining **LibraryRail** choice

**Approach:**

- Replace **`LibraryMediaShelfRow`** import/usage with **`LibraryRail`** from **`src/app/components/library/rails/LibraryRail.tsx`**.
- Map props: **`icon={BookHeart}`**, **`title="More like this"`** (**`RailHeader`** maps **`title` → `LibraryShelfHeading` `label`**), **`count={similarBooks.length}`**, **`data-testid="similar-books-shelf"`**.
- Drop duplicate outer **`<section data-testid="similar-books-shelf">`** wrapper if **`LibraryRail`’s** root carries the **test id** (**avoid duplicate landmarks** unless tests require nesting—currently they do not).
- Preserve **`memo`** on **`SimilarBookCard`** unchanged unless profiling says otherwise.

**Patterns to follow:** **`LibraryMediaShelfColumn`** **`LibraryRail`** usage for prop shape and **`data-testid`** prefix behavior.

**Test scenarios:**

- **Happy path:** With overflow mocked (reuse **`mockMediaScrollerOverflow`** pattern from **`LibraryMediaShelfRow.test.tsx`** if helpful), **`similar-books-shelf-scroll-left`** / **`-right`** buttons exist (`md` breakpoint not easily simulated in JSDOM—prefer **presence in DOM when `hasOverflow`** from hook or **snapshot of class tokens** **`group-hover/rail`** on section).
- **Integration (lightweight):** Assert rendered **`RailViewport`** (or **`data-testid`** `${testId}-scroller`) has **`scrollbar-none`** class token.
- **Edge case:** **Zero** similar books → component returns **`null`** ( **`LibraryRail`** also returns **`null`** on empty children—confirm **`SimilarBooksShelf`** still short-circuits **`similarBooks.length === 0`** so we never construct empty rail).

**Verification:** Browser QA on **`/library/:bookId`** with **≤12** items: **no scrollbar gutter**; **chevrons appear on shelf hover / keyboard focus-within**, hidden on **`sm`** per **`md:flex`** in **`RailControls`**.

---

- [ ] **Unit 3: E2E and identifier audit**

**Goal:** Existing book-detail journeys keep stable selectors; add assertions that encode the UX contract where cheap.

**Requirements:** R5

**Dependencies:** Units 1–2

**Files:**

- Modify: `tests/e2e/library-book-detail.spec.ts` (extend only if new behavior needs coverage— e.g. **scroller** **`data-testid`** becomes **`similar-books-shelf-scroller`** vs former **`similar-books-row-scroller`**; update only if tests reference **old id**).

**Approach:**

- Grep **`similar-books-row`** — today only **`SimilarBooksShelf.tsx`** defines it; E2E does **not** use it → likely **no E2E change** unless implementing agent adds assertions.
- Optional: **`md` viewport** E2E that **hover** triggers opacity—**often flaky**; prefer **`focus-within`** test (keyboard **Tab** focus on scroller?) only if stable in Playwright fixtures.

**Test scenarios:**

- **Regression:** Existing **“shows similar books”** and **navigation** specs still pass unchanged.

**Verification:** **`tests/e2e/library-book-detail.spec.ts`** green in CI.

## System-wide impact

- **Interaction graph:** Only **`SimilarBooksShelf`** consumers (**`BookDetail`**) affected.
- **`findSimilarBooks`:** Unchanged.
- **Unchanged invariants:** **`LibraryMediaShelfRow`** behavior for non-detail shelves.

## Risks & dependencies

| Risk | Mitigation |
|------|------------|
| **Plan 014** reintroduces portrait ebooks in similar row | Edit **014 Unit 2** or merge order checklist; cite this plan |
| **`data-rail-tile`** missing → percent-based fallback scroll feels wrong | Unit test asserts attribute on card root |
| JSDOM cannot prove **`md:` chevron visibility** | Rely on visual QA + class token smoke test |

## Documentation / operational notes

- One-line refresh in **`SimilarBooksShelf.tsx`** file header (**LibraryRail** + **why** ebooks are square **here only**).

## Sources & References

- Screenshot asset (user-provided analysis): uneven portrait vs square tiles; visible scrollbar; static chevrons.
- Related plan: [2026-05-07-014-fix-book-detail-similar-shelf-parity-plan.md](2026-05-07-014-fix-book-detail-similar-shelf-parity-plan.md)
- Learning doc: [library-carousels-unified-booktile-composable-rails-2026-05-05.md](../../solutions/best-practices/library-carousels-unified-booktile-composable-rails-2026-05-05.md)
- Code: `SimilarBooksShelf.tsx`, `rails/LibraryRail.tsx`, `rails/RailViewport.tsx`, `rails/RailControls.tsx`, `LibraryMediaShelfRow.tsx`, `BookTile.tsx`
