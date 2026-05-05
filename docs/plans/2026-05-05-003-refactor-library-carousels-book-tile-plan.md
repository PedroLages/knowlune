---
title: "refactor: Library carousels + unified BookTile (Continue Listening + Recently Added)"
type: refactor
status: active
date: 2026-05-05
---

# refactor: Library carousels + unified BookTile (Continue Listening + Recently Added)

## Overview

Refactor the Library media shelves so **Continue Listening** and **Recently Added** share a single `BookTile` component with two size variants, consistent chevron controls, and a hidden visual scrollbar. Standardize all covers to a **2:3 portrait frame** (with audiobook padding rules), fix the “blue title” bug by using one title token everywhere, and keep progress UI exclusive to the Continue variant.

---

## Requirements

- R1. Continue Listening rail uses a **DENSE** tile variant (144×216 rendered) with more items visible; Recently Added uses **small** (128×192 rendered).
- R2. **Unified 2:3 portrait aspect ratio** for *all* tiles (ebooks + audiobooks).
- R3. Audiobook square covers render **padded inside** the 2:3 frame (no cropping); padding background uses a **soft, theme-aware brand surface** token.
- R4. One `BookTile` component with **two variants only**: `small` and `denseContinue`.
- R5. Unified badge system: **at most one badge per tile**, only for format — a single **“Audio”** chip. No competing top-right icons.
- R6. Progress display appears **only** on Continue variant: thin progress bar pinned to bottom edge of cover + one meta line `"{timeLeft} left · {percent}%"`.
- R7. Typography: **one title color token across all tiles** (fix current “one title is blue” hover effect bug), and one author token.
- R8. Rail navigation: **small chevron buttons** appear on hover/focus, **never** large overlay circles, and **must not obscure** cover art.
- R9. Rails must remain horizontally scrollable but **must not show a visible horizontal scrollbar**. Use hidden scrollbar utility (Firefox `scrollbar-width: none` + WebKit `::-webkit-scrollbar { display: none }`).
- R10. Hover/focus overlay on each tile exposes primary action: **“Continue”** (Continue rail) and **“Open”** (Recently Added).
- R11. Serve images at **2× rendered width** (retina-safe) for the two target sizes.
- R12. Accessibility: prev/next are real `<button>`s; focus is preserved on click; controls do not obscure content; strong visible focus rings; keyboard traversal remains possible without a visual scrollbar.

---

## Context & Research

### Relevant Code and Patterns

- Library route and shelves composition:
  - [`src/app/pages/Library.tsx`](src/app/pages/Library.tsx) (Continue tab renders `LibraryMediaShelfColumn`)
  - [`src/app/components/library/LibraryMediaShelfColumn.tsx`](src/app/components/library/LibraryMediaShelfColumn.tsx) (renders `LibraryMediaShelfRow` for Continue + Recently Added + others)
- Current rail implementation (chevrons + scroller):
  - [`src/app/components/library/LibraryMediaShelfRow.tsx`](src/app/components/library/LibraryMediaShelfRow.tsx) (media shelves)
  - [`src/app/components/library/LibraryShelfRow.tsx`](src/app/components/library/LibraryShelfRow.tsx) (general shelf primitive)
  - [`src/app/components/library/LibraryShelfHeading.tsx`](src/app/components/library/LibraryShelfHeading.tsx) (heading primitive)
- Current tiles/cards:
  - [`src/app/components/library/ContinueShelfTile.tsx`](src/app/components/library/ContinueShelfTile.tsx) (currently square cover + progress bar + icon)
  - [`src/app/components/library/RecentBookCard.tsx`](src/app/components/library/RecentBookCard.tsx) (currently square cover + “Audio/eBook” pill + blue-title-on-hover bug)
  - [`src/app/components/library/BookCard.tsx`](src/app/components/library/BookCard.tsx) (grid card; includes `group-hover:text-brand` title hover that causes “blue title” effect)
  - [`src/app/components/library/BookCoverImage.tsx`](src/app/components/library/BookCoverImage.tsx) (shared image with fallback)
  - [`src/app/components/library/shelfCardSizing.ts`](src/app/components/library/shelfCardSizing.ts) (`LIBRARY_SHELF_CARD_WIDTH_CLASS` currently `w-44 sm:w-48`)
- Existing scrollbar-hiding utilities (already present — reuse, don’t invent):
  - [`src/styles/index.css`](src/styles/index.css) defines `.scrollbar-none { scrollbar-width:none; }` + WebKit hidden scrollbar.
  - Several components already use `scrollbar-none` or inline `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.

### Institutional Learnings

- Library UX regressions / palette-related work recently touched library surfaces:
  - [`docs/solutions/ui-bugs/search-palette-library-ux-regressions-2026-05-03.md`](docs/solutions/ui-bugs/search-palette-library-ux-regressions-2026-05-03.md)

### External References

- W3C/WAI carousel accessibility guidance (informing button semantics + focus handling + non-obscuring controls). (No new dependency required.)

---

## Key Technical Decisions

- Use **one new rail primitive** (header + controls + viewport) for Library media shelves rather than further mutating `LibraryMediaShelfRow`/`LibraryShelfRow` separately, to keep chevrons/scroll behavior consistent across rails and prevent drift.
- Implement chevron scroll as **“one tile chunk”** per click (not viewport percentage) by measuring the first tile’s rendered width + gap and scrolling by that delta.
- Keep existing scroll affordance state (`canScrollLeft/right`) but trigger visibility via **hover/focus-within** on the rail container (not always-visible on desktop).
- Reuse `.scrollbar-none` in `src/styles/index.css` (already matches the requirement) and remove per-component ad-hoc scrollbar hiding where feasible.
- Fix “blue title” bug by centralizing tile typography classes (title color token and hover behavior) into the new `BookTile`, and ensuring legacy components no longer apply `group-hover:text-brand` for these rails.

---

## Component Spec

### RailHeader

- **Props**: `icon`, `title`, `count?`, `subtitle?`, `viewAll?` (optional action).
- **Implementation**: reuse existing `LibraryShelfHeading` for baseline styling/semantics, but wrap it with a narrower “rail header” adapter so shelves can pass an action slot in a consistent way.
- **Behavior**:
  - Title is the semantic heading (`h2` for top-level shelves inside Continue tab, consistent with existing `LibraryMediaShelfRow` default).
  - Optional subtitle renders below title.
  - Optional “View all” renders right-aligned; uses existing `ShelfSeeAllLink` patterns if it matches.

### RailControls (prev/next chevrons)

- **Elements**: real `<button type="button">`.
- **Visibility**:
  - Default hidden; appears on **hover** of the rail section and on **focus-within** (keyboard users).
  - Never renders large overlay circles; use small chevrons (roughly 32–36px hit target with internal 16px icon).
- **Placement**:
  - Positioned outside the cover art area: align to the rail’s left/right padding area, not over the tiles.
  - Ensure chevrons do not overlap cover images (use container padding and negative margins carefully).
- **Accessibility**:
  - `aria-label="Scroll left"` / `"Scroll right"`.
  - Preserves focus on click (do not focus-shift to the scroller; keep the button focused).
  - Visible focus ring consistent with app (use existing focus ring utilities/tokens already used on buttons).
- **Scroll behavior**:
  - Smooth scroll.
  - Scroll delta is **one tile width + gap** per click:
    - Measure: `firstTile.getBoundingClientRect().width` and computed `gap` from the scroller (or measure delta between first two tiles’ left offsets).
    - Delta = `(tileWidth + gap) * N`, where `N` can be 1 (default) or 2 for dense variant if needed, but keep consistent across rails unless UX demands otherwise.

### RailViewport

- **Container**: a horizontally scrollable div (`overflow-x-auto`).
- **Scrollbar**: apply `scrollbar-none` utility (from `src/styles/index.css`) so the scrollbar is not visually exposed while scroll remains functional.
- **Interaction**:
  - Trackpad/touch swipe works naturally.
  - Keyboard users can:
    - Tab to chevrons and activate them.
    - Tab into tiles; scrolling should naturally follow focused tile (ensure focus styles are strong).
    - Optional: keep left/right arrow key support *only* if it doesn’t conflict with tile-level keyboard interaction; otherwise rely on chevrons + tab focus.
- **Scroll-snap** (optional): allowed but not required. If used, apply `snap-x snap-mandatory` and per-item `snap-start`.

### BookTile (two variants: `small`, `denseContinue`)

- **Aspect ratio**: fixed **2:3** portrait frame for the cover container for both variants.
- **Sizes**:
  - `small`: 128×192 rendered.
  - `denseContinue`: 144×216 rendered.
  - Ensure image requests are at least **2×** width of rendered width (e.g., 256w and 288w) via existing cover URL tooling (`useBookCoverUrl`) or image URL parameters (defer exact URL strategy to implementation if current cover URLs are opaque).
- **Cover rendering rules**:
  - Ebooks: render cover image filling the 2:3 frame (`object-cover`) as today for portrait covers.
  - Audiobooks: treat source art as square; render centered within 2:3 frame with **padding** and **no cropping**:
    - Outer frame remains 2:3.
    - Inner square art uses `object-contain` and a padding inset.
    - Background uses a soft, theme-aware brand surface token (prefer an existing token/class; if none, derive from current `bg-brand-soft` / `bg-card` surfaces).
- **Overlay (hover/focus)**:
  - On hover/focus within tile, show a subtle scrim and the primary action button:
    - Continue rail: “Continue”
    - Recently Added: “Open”
  - Overlay must not introduce extra competing icons; the only adornment aside from overlay is the single badge (Audio) when applicable.
- **Click/keyboard**:
  - Entire tile is focusable and navigates on Enter/Space (current pattern uses `role="link"` + `tabIndex=0`).
  - Prefer converting to a real `<a>` or `<Link>` only if consistent with the rest of Library; otherwise preserve current pattern but ensure focus ring is visible.

### BadgeSystem (single “Audio” chip)

- **Rule**: at most one badge; only for audiobooks; label “Audio”.
- **Placement**: top-left within the cover frame, inset (e.g., 8px).
- **Styling**:
  - Use one tokenized surface + text color (reuse from `FormatBadge` if suitable, but simplify to only “Audio” for these tiles).
  - Avoid black translucent pills used today in `RecentBookCard` and icon-only bubble in `ContinueShelfTile`.

### ProgressDisplay (Continue-only)

- **Bar**: thin progress bar pinned to bottom edge of cover frame (inside cover container).
- **Meta line**: single line beneath title/author (or as the second metadata line) formatted exactly:
  - `"{timeLeft} left · {percent}%"`
  - For ebooks (page-based), map to a timeLeft approximation only if already available; otherwise use a consistent “X pages left” would violate the locked copy. Since decision is locked, treat non-audio continue as showing the same format by:
    - using `{timeLeft}` derived from pages remaining only if it is already presented as “pages left” today; if not feasible, defer calculation details to implementation but keep output format consistent.
  - Percent is rounded.

### TypographyRules

- **Title**: single token/class across both rails (no “blue title”/brand hover). Titles should remain readable; hover can affect underline/opacity rather than color.
- **Author**: single muted token/class.
- Apply these rules in `BookTile` so both variants inherit the same typography.

---

## File Changes

### Modify (existing)

- [`src/app/components/library/LibraryMediaShelfColumn.tsx`](src/app/components/library/LibraryMediaShelfColumn.tsx)
  - Switch Continue + Recently Added shelves to render the new `BookTile` instead of `ContinueShelfTile`/`RecentBookCard`.
  - Keep other shelves (Discover/Again/Series) unchanged in this refactor unless they already reuse the same primitives without extra scope creep.
- [`src/app/components/library/LibraryMediaShelfRow.tsx`](src/app/components/library/LibraryMediaShelfRow.tsx)
  - Either replace with a thin wrapper around the new rail primitive (preferred) or migrate call sites to the new rail and deprecate this component.
  - Ensure chevrons become hover/focus-visible (currently always visible on md+ with `md:flex` and no group-hover gating).
  - Replace viewport-percent scrolling (`clientWidth * 0.9`) with “one tile chunk” scrolling.
  - Replace inline scrollbar hiding (`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`) with `.scrollbar-none` utility usage.
- [`src/app/components/library/ContinueShelfTile.tsx`](src/app/components/library/ContinueShelfTile.tsx)
  - Deprecate for these shelves; keep temporarily for migration, then remove once no longer referenced.
- [`src/app/components/library/RecentBookCard.tsx`](src/app/components/library/RecentBookCard.tsx)
  - Deprecate for these shelves; remove the format pill + blue-title hover usage once replaced.
- [`src/app/components/library/FormatBadge.tsx`](src/app/components/library/FormatBadge.tsx)
  - Optional: either reuse for the “Audio” chip (by constraining) or leave as-is and create a dedicated minimal audio badge component for tiles.
- [`src/app/components/library/shelfCardSizing.ts`](src/app/components/library/shelfCardSizing.ts)
  - Replace the ambiguous width class (`w-44 sm:w-48`) with variant-specific sizing tokens for `BookTile` (or introduce new exports that `BookTile` uses). This is the place the codebase already uses to standardize shelf sizing.
- [`src/styles/index.css`](src/styles/index.css)
  - No new utility needed: `.scrollbar-none` already exists and matches the requirement. Ensure new rail viewport uses it.

### Create (new)

- [`src/app/components/library/BookTile.tsx`](src/app/components/library/BookTile.tsx)
  - Single tile component for Library shelves, with `variant: 'small' | 'denseContinue'`, unified 2:3 cover frame, audiobook padding rule, hover/focus overlay action, unified typography, optional progress display (Continue-only), and single “Audio” badge.
- [`src/app/components/library/rails/LibraryRail.tsx`](src/app/components/library/rails/LibraryRail.tsx)
  - New rail primitive that composes `RailHeader`, `RailControls`, and `RailViewport` with consistent chevron visibility rules and one-tile scrolling.
- [`src/app/components/library/rails/RailViewport.tsx`](src/app/components/library/rails/RailViewport.tsx)
  - The horizontally scrollable container with `scrollbar-none` and optional scroll-snap.
- [`src/app/components/library/rails/RailControls.tsx`](src/app/components/library/rails/RailControls.tsx)
  - Prev/next buttons with hover/focus-within reveal, non-obscuring placement, and one-tile scroll-by logic (uses refs/measurement).
- [`src/app/components/library/rails/RailHeader.tsx`](src/app/components/library/rails/RailHeader.tsx)
  - Wrapper over `LibraryShelfHeading` to standardize title/count/subtitle/view-all for rails.

### Tests (add/adjust)

- [`src/app/components/library/__tests__/LibraryMediaShelfColumn.test.tsx`](src/app/components/library/__tests__/LibraryMediaShelfColumn.test.tsx)
  - Update expectations to assert the new `BookTile` variants are rendered for Continue + Recently Added.
- [`src/app/components/library/__tests__/LibraryMediaShelfRow.test.tsx`](src/app/components/library/__tests__/LibraryMediaShelfRow.test.tsx)
  - Replace/port tests to the new rail primitive; verify chevrons appear on hover/focus-within, are `<button>`, and scrolling updates affordance state.
- New: [`src/app/components/library/__tests__/BookTile.test.tsx`](src/app/components/library/__tests__/BookTile.test.tsx)
  - Variant sizing class selection; badge rule (Audio only); overlay CTA copy; progress-only-on-continue.
- New: [`src/app/components/library/rails/__tests__/LibraryRail.test.tsx`](src/app/components/library/rails/__tests__/LibraryRail.test.tsx)
  - Scroll-by-one-tile-chunk logic (measurement mocked), focus preservation on button click, and scrollbar-hidden class present.

---

## Migration / Cutover Strategy

- Step 1: Introduce new rail primitive (`LibraryRail` + subcomponents) and new `BookTile` while leaving existing `LibraryMediaShelfRow`, `ContinueShelfTile`, and `RecentBookCard` intact.
- Step 2: Update `LibraryMediaShelfColumn` to use the new `LibraryRail` + `BookTile` **only for**:
  - Continue Listening/Reading shelf (`denseContinue` variant, progress enabled, CTA “Continue”)
  - Recently Added shelf (`small` variant, no progress, CTA “Open”)
- Step 3: Ensure `LibraryMediaShelfRow` is either:
  - converted into a wrapper around `LibraryRail` (so other shelves automatically get the improved controls without changing call sites), or
  - left as-is while the new rail is used only for the two targeted shelves (minimizes blast radius).
- Step 4: Once no references remain, remove or archive `ContinueShelfTile` and `RecentBookCard` (and update any E2E tests referencing their `data-testid` values).
- Step 5: Audit other rails (Discover/Again) for opportunistic follow-up migration — **defer** unless explicitly desired, to keep scope bounded.

---

## Before / After Summary

- **Before**:
  - Continue + Recently Added tiles are **square**, with different ad-hoc badges and inconsistent overlay actions.
  - Chevron buttons are present but not consistently hover/focus-revealed; scroll distance is viewport-based.
  - Some tiles use `group-hover:text-brand` causing the **blue title** bug.
  - Scrollbar hiding is implemented via inline CSS selectors in multiple places.
- **After**:
  - Continue + Recently Added both use `BookTile` with **2:3 portrait frame**; audiobook art is **padded** inside frame.
  - Exactly **one** badge maximum per tile: **“Audio”** chip only.
  - Continue-only progress: **thin bar at bottom of cover + “{timeLeft} left · {percent}%”** line.
  - Chevrons are **small**, appear on **hover/focus-within**, and **do not obscure cover art**.
  - Rails remain horizontally scrollable but the **visible scrollbar is gone** via `.scrollbar-none`.
  - Titles use a single token; the **blue title** effect is removed.

---

## Open Questions

- Q1. For non-audio “Continue Reading”, what is the canonical `{timeLeft}` string to match the locked format `"{timeLeft} left · {percent}%"` without introducing new estimations? If no existing time-left concept exists for ebooks, plan is to derive `{timeLeft}` from pages remaining in a consistent “Xm” equivalent only if there is already a duration estimator; otherwise defer exact logic while keeping UI contract unchanged.

