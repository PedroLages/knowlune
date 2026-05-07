---
title: fix: Align library book card “more” control with format badge
type: fix
status: active
date: 2026-05-07
---

# fix: Align library book card “more” control with format badge

## Overview

The touch-friendly **more actions** trigger (`MoreVertical`) on library book covers sits visually **lower** than the **format badge** (e.g. `Headphones` in a circular pill on audiobook cards). Both are anchored near the top corners, but the trigger currently uses a **44×44px** minimum size with **centered** flex alignment, which vertically centers the glyph inside a tall hit box. The format badge uses **`top-2` + `p-1.5` + small icon** — a compact stack whose **visible** icon sits higher and reads as the “header” row. This plan adjusts the menu trigger so its **visible icon shares the same inset and optical vertical alignment** as the badge while **preserving** an adequate pointer target.

## Problem Frame

Users perceive the kebab/ellipsis control and the headphone badge as a **single top chrome row** on the cover. Today they appear on **different baselines**, which looks broken and inconsistent with the rest of the library polish (see related solution doc on format badges and overlays).

## Requirements Trace

- **R1.** On hover/focus (and touch where applicable), the **visible** `MoreVertical` icon aligns **on the same horizontal band** as the format badge icon on the same card (audiobook and ebook covers wrapped by `BookContextMenu`).
- **R2.** **WCAG 2.5.5 (minimum target size):** the interactive target for the more-actions control remains **at least 44×44 CSS pixels** (or an equivalent documented exception is not used — prefer meeting the minimum).
- **R3.** Existing **behavior** is unchanged: dropdown opens, `data-testid="book-more-actions"` remains, context menu still works, no regression in shelves or Browse grid consumers.

## Scope Boundaries

- **In scope:** `BookContextMenu` dropdown trigger styling/layout only (and tests if needed to lock alignment).
- **Out of scope:** Redesign of badge or menu UX, moving badges to a shared slot inside `BookCard`, changing Discover/`BookTile` internal layout, or new Figma work.

### Deferred to Separate Tasks

- None.

## Context & Research

### Relevant Code and Patterns

- **`BookContextMenu`** wraps `children` in `group relative` and positions the trigger with `absolute top-2 left-2`, **`min-h-[44px] min-w-[44px]`**, `flex items-center justify-center` — this centers the icon in the large box and causes the **low** optical position (`src/app/components/library/BookContextMenu.tsx`).
- **`BookCard`** format badges use **`absolute top-2 right-2`** with **`p-1.5`** and **`size-3.5`** icons (`src/app/components/library/BookCard.tsx`). **BookTile** uses the same **`top-2 right-2 p-1.5`** pattern for audiobooks (`src/app/components/library/BookTile.tsx`).
- Consumers: **`Library.tsx`**, **`SmartGroupedView.tsx`**, **`LocalSeriesView.tsx`**, **`LibraryMediaShelfColumn.tsx`** wrap cards/tiles with `BookContextMenu` — a single fix in the menu component propagates everywhere.

### Institutional Learnings

- **`docs/solutions/ui-bugs/library-shelf-sizing-hover-consistency-2026-05-05.md`** — format badge placement, hover overlays, and consistency between `BookTile` / `BookCard`; relevant for verifying **no overlap** or z-index regression after layout change.
- **`docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md`** — touch-safe stacking and **`(hover:none)`** considerations for corner controls (parallel pattern; ensure trigger does not become harder to tap).

### External References

- None required; local layout/touch-target patterns are sufficient.

## Key Technical Decisions

- **Decision:** Keep **`min-h-[44px] min-w-[44px]`** on the trigger for accessibility, but **pin the visible icon to the same corner inset as format badges** (`p-1.5` from the trigger’s top-left, analogous to badge `p-1.5` from top-right). Concretely: use **`items-start justify-start`** with **`p-1.5`** (and retain `touch-manipulation`) so the glyph occupies the **same optical row** as `Headphones`/`BookOpen`, while the remaining button padding extends the hit area **down and to the right** (and optionally slightly past `top-2`/`left-2` if clipping is observed — verify visually).

  **Rationale:** Centering a small icon in a 44px square anchored at `top-2` shifts the glyph **~9–11px** lower than a `p-1.5` badge on the opposite corner; start-aligned padding matches the badge’s geometry.

- **Decision:** Do **not** remove the 44px minimum without replacement; if a future refactor uses an invisible hit-slop layer, document it — **not** in this pass unless implementation shows clipping or overlap issues.

## Open Questions

### Resolved During Planning

- **Why does the user say the headphone is “correct” but the dots are wrong?** The badge uses compact padding; the menu uses a tall centered hit box — fix by aligning flex distribution and padding, not by moving the badge.

### Deferred to Implementation

- **Exact Tailwind class string:** Minor tweaks (`rounded-full` on the trigger for parity, subtle backdrop) are optional — implementer verifies against light and dark covers and **does not** change menu visibility semantics without checking hover/`group-focus-within` behavior.

## Implementation Units

- [ ] **Unit 1: Realign `BookContextMenu` more-actions trigger**

**Goal:** Match vertical optical alignment between `MoreVertical` and the format badge on the same cover while keeping ≥44×44px target.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**

- Modify: `src/app/components/library/BookContextMenu.tsx`
- Test: `tests/e2e/regression/story-e110-s01.spec.ts`, `tests/e2e/regression/story-e110-s02.spec.ts`, `tests/e2e/regression/story-e110-s03.spec.ts`, `tests/e2e/library-tabs.spec.ts`

**Approach:**

- Replace **`items-center justify-center`** with **`items-start justify-start`** on the `DropdownMenuTrigger` button; add **`p-1.5`** so the icon inset matches **`BookCard` / `BookTile`** badge padding; keep **`min-h-[44px] min-w-[44px]`** and `absolute top-2 left-2 z-10`.
- Optionally mirror badge **size** classes on the icon if needed (`h-3.5 w-3.5` is already used).
- Manually verify: audiobook grid card (Browse), a shelf tile wrapped by the same menu, and ebook portrait card — **dots and format icon on one visual row**.

**Patterns to follow:**

- Format badge geometry in `BookCard.tsx` and `BookTile.tsx` (`top-2`, `p-1.5`, z-index `z-10`).

**Test scenarios:**

- **Happy path — Integration:** From Library Browse, hover a book card; **`book-more-actions`** remains clickable and opens dropdown (existing E2E flows in story-e110 specs).
- **Regression — Integration:** `library-tabs.spec.ts` expectation that **`book-more-actions`** is attached still passes.
- **Edge case — Touch / hit target:** On a narrow viewport or touch device, trigger remains tappable without the dropdown firing accidentally when tapping the cover (spot-check; no new test required unless implementation adds pointer-event layers).

**Verification:**

- Screenshots or local visual check: **left menu icon** and **right format badge** share a **single horizontal band**; no overlap with progress bar or finished overlay; WCAG target size still met.

## System-Wide Impact

- **Interaction graph:** All surfaces wrapping tiles/cards with `BookContextMenu` inherit the change — **Library** grid/list, **media shelves**, **grouped** and **series** views.
- **Unchanged invariants:** Context menu content, long-press behavior, `ContextMenu` vs `DropdownMenu` split, dialog flows (`LinkFormatsDialog`, delete confirm).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Hit target feels offset from visible icon | Keep 44×44 minimum on the **button**; icon pinned top-left with `p-1.5`; user-test tap on cover edges |
| Z-index clash with new badges in the future | Both controls already `z-10`; document in PR if stacking changes |

## Documentation / Operational Notes

- Optional follow-up: one line in `docs/solutions/` if this class of **“centered glyph in min-size button”** recurs elsewhere.

## Sources & References

- Related code: `src/app/components/library/BookContextMenu.tsx`, `src/app/components/library/BookCard.tsx`, `src/app/components/library/BookTile.tsx`
- Related learning: [docs/solutions/ui-bugs/library-shelf-sizing-hover-consistency-2026-05-05.md](docs/solutions/ui-bugs/library-shelf-sizing-hover-consistency-2026-05-05.md)
