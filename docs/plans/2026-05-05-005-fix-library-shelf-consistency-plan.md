---
title: "fix: Library shelf sizing, hover animation, Browse grid, format badges, and Daily Highlights position"
type: fix
status: active
date: 2026-05-05
origin: docs/plans/2026-05-05-003-refactor-library-carousels-book-tile-plan.md
---

# fix: Library shelf sizing, hover animation, Browse grid, format badges, and Daily Highlights position

## Overview

Post-plan-003 refinements to the Library page. Addresses six UX issues: (1) BookTile cards in "Continue Listening" and "Recently Added" are smaller than Discover cards, breaking visual consistency; (2) hover animation on BookTile differs from Browse grid cards — smaller lift, weaker shadow, and top border-radius corners visibly clip on scale; (3) hover overlay shows text labels ("Continue"/"Open") instead of format-aware icons; (4) Browse tab desktop grid shows 5 columns instead of 6; (5) Browse tab BookCards show "Remote"/"Local" source labels that should be removed, and lack a format-distinguishing icon on the cover; (6) Daily Highlights renders at the bottom of the Continue tab instead of the top.

## Problem Frame

Plan 003 unified the Continue and Recently Added shelves under a shared `BookTile` component with 2:3 portrait covers (128px and 144px wide). The Discover shelf retained the existing `RecentBookCard` (square, 176–192px wide). This size mismatch between shelves on the same page creates a disjointed visual rhythm — items shrink and grow as the user scrolls down.

Additionally, `BookTile` uses a different hover vocabulary than `BookCard` (Browse grid): 4px lift vs 8px lift, weaker shadow, and 300ms image transition vs 500ms. When the thumbnail scales on hover, the parent's `overflow-hidden` + `border-radius` can fail to clip the composited layer in some browsers, producing sharp corners during the transition. The Browse grid does not exhibit this because its compositing context differs.

The hover overlay on BookTile currently shows a text button ("Continue" or "Open"). The user wants format-aware icons instead: a play icon for audiobooks and a book icon for ebooks — matching the media-forward design language.

## Requirements Trace

### BookTile Consistency (R1–R4)

- R1. BookTile cards in Continue Listening and Recently Added shelves must match the Discover shelf card size (square, `w-44 sm:w-48`).
- R2. BookTile hover animation must match BookCard: 8px lift (`-translate-y-2`), `shadow-[0_10px_30px_var(--shadow-brand)]`, 500ms image scale transition.
- R3. BookTile cover corners must remain rounded during hover scale — no visible corner clipping.
- R4. BookTile hover overlay must show an action-aware icon (PlayCircle for audiobooks, BookOpen for ebooks) instead of text.

### Browse Grid & Cards (R5–R7)

- R5. Browse tab desktop grid must show 6 columns (`xl:grid-cols-6`) instead of 5, including all inline grids in Library.tsx.
- R6. Browse tab BookCards must not show "Remote" or "Local" source labels.
- R7. Browse tab BookCards must show a small format icon (Headphones for audiobooks, BookOpen for ebooks) in the top-right corner of the cover.

### Daily Highlights Position (R8)

- R8. Daily Highlights section must render at the top of the Continue tab, between format tabs and the media hero, instead of at the bottom.

## Scope Boundaries

- Only the Library page Continue and Browse tabs are in scope. Collections and History tabs are unchanged.
- The Discover, Listen Again/Read Again, and Recent Series shelves are unchanged (they already use `RecentBookCard` with the desired sizing and animation).
- The `LibraryRail` primitives (rail header, controls, viewport) from plan 003 are not modified.
- The `ContinueShelfTile` legacy component (used by `LibraryContinueShelves`) is out of scope — it will be removed when the legacy shelf system is retired.

### Deferred to Separate Tasks

- Removing `ContinueShelfTile` entirely: deferred until the legacy `LibraryContinueShelves` / `LibraryDiscoveryShelves` are migrated.
- Unifying Discover and Listen Again shelves to also use BookTile: deferred — those shelves already use `RecentBookCard` with correct sizing.

## Context & Research

### Relevant Code and Patterns

- [`src/app/components/library/BookTile.tsx`](src/app/components/library/BookTile.tsx) — the unified tile (already implemented from plan 003). Two variants: `small` (w-32, 128px) and `denseContinue` (w-36, 144px). 2:3 portrait covers. Hover: `-translate-y-1` + `shadow-[0_8px_24px]` + 300ms scale. Overlay shows text CTA.
- [`src/app/components/library/BookCard.tsx`](src/app/components/library/BookCard.tsx) — Browse grid card. Audiobooks: `aspect-square`, EPUBs: `aspect-[2/3]`. Hover: `-translate-y-2` + `shadow-[0_10px_30px]` + 500ms scale. Has "Remote" badge (lines 121–129 audiobook, 214–222 EPUB). Has title `group-hover:text-brand`.
- [`src/app/components/library/RecentBookCard.tsx`](src/app/components/library/RecentBookCard.tsx) — Discover/Again card. `aspect-square`, `LIBRARY_SHELF_CARD_WIDTH_CLASS` (w-44 sm:w-48). Hover: `-translate-y-2` + `shadow-[0_10px_30px]` + 500ms scale. Bottom-right format pill ("Audio"/"eBook").
- [`src/app/components/library/LibraryMediaShelfColumn.tsx`](src/app/components/library/LibraryMediaShelfColumn.tsx) — renders Continue Listening (`BookTile denseContinue`), Recently Added (`BookTile small`), Discover (`RecentBookCard`), etc.
- [`src/app/components/library/SmartGroupedView.tsx`](src/app/components/library/SmartGroupedView.tsx) — Browse tab grid. `GRID_CLASSES = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'`.
- [`src/app/pages/Library.tsx`](src/app/pages/Library.tsx) — Continue tab rendering order (lines 790–855): `LibraryFormatModeTabs` → `LibraryMediaHero` → `LibraryMediaShelfColumn` → `ReadingQueue` → `DailyHighlightsStrip`.
- [`src/app/components/library/DailyHighlightsStrip.tsx`](src/app/components/library/DailyHighlightsStrip.tsx) — cinematic quote card with blurred cover background, currently rendered at bottom.
- [`src/app/components/library/shelfCardSizing.ts`](src/app/components/library/shelfCardSizing.ts) — `LIBRARY_SHELF_CARD_WIDTH_CLASS = 'w-44 sm:w-48'` used by Discover/Again shelves.

### Institutional Learnings

- Plan 003 refactored shelves from ad-hoc components to a unified `BookTile` + `LibraryRail` system. The present work is the consistency follow-up.
- Library UX regressions documented in [`docs/solutions/ui-bugs/search-palette-library-ux-regressions-2026-05-03.md`](docs/solutions/ui-bugs/search-palette-library-ux-regressions-2026-05-03.md).

## Key Technical Decisions

- **Square covers for BookTile**: Change both `small` and `denseContinue` variants from 2:3 portrait to `aspect-square`, matching Discover's `RecentBookCard`. This means audiobook square art fills the frame naturally without padding — the 12% padding workaround from plan 003 is no longer needed. Use `LIBRARY_SHELF_CARD_WIDTH_CLASS` for the container width.
- **Single variant is sufficient**: With both variants now the same square aspect ratio and same width, `denseContinue` only differs by showing progress. The `small` variant name becomes misleading. Keep both variant names for now but make their sizing identical to Discover — the only difference is progress display.
- **Hover animation unification**: Copy the BookCard hover vocabulary exactly: `group-hover/tile:-translate-y-2`, `group-hover/tile:shadow-[0_10px_30px_var(--shadow-brand)]`, `transition-transform duration-500` on the image. Keep the scoped `group/tile` namespace — it isolates tile hover from any future ancestor `group` classes that could be introduced between the rail and tile in the DOM tree.
- **Corner clipping fix**: Add `transform: translateZ(0)` to the cover container to force GPU compositing and a new stacking context, ensuring the parent's `overflow-hidden rounded-2xl` clips the scaled child image correctly during GPU-composited transforms. Use `isolate` as an additional stacking-context fallback for non-WebKit browsers, but `translateZ(0)` is the primary fix — `isolate` alone may not resolve the WebKit compositing bug.
- **Icon overlay instead of text**: Replace the text `<span>` in the overlay with a single large action icon (`PlayCircle` for audiobooks — suggesting "tap to play", `BookOpen` for ebooks — suggesting "tap to read"). This is an additive action hint, not a replacement for persistent format indicators. **The existing "Audio" format badge on BookTile is preserved** — format must remain distinguishable in the default (non-hover) state. The overlay icon serves a different purpose: it communicates the tap action, not the format.
- **Remove remote labels from Browse only**: Remove the "Remote" badge from `BookCard.tsx` (both audiobook metadata section and EPUB cover overlay). The source is still visible via the `LibrarySourceTabs` filter context at the top of the Browse tab.
- **Format icon placement**: Add a small `rounded-full bg-black/60 backdrop-blur` icon-only badge to the top-right corner of BookCard covers. Same visual style as `ContinueShelfTile` top-right icon and `RecentBookCard` bottom-right pill, but top-right for consistency with the EPUB `BookStatusBadge` placement and to avoid overlapping with the progress bar at the bottom.

## Implementation Units

- [ ] **Unit 1: Normalize BookTile sizing and hover animation**

**Goal:** Make BookTile cards match the Discover card size (square, w-44 sm:w-48) and adopt the BookCard hover vocabulary (8px lift, deeper shadow, 500ms image transition, fix corner clipping).

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/BookTile.tsx`
- Modify: `src/app/components/library/shelfCardSizing.ts`
- Test: `src/app/components/library/__tests__/BookTile.test.tsx`

**Approach:**
- Change both `VARIANT_SIZES` entries to use `LIBRARY_SHELF_CARD_WIDTH_CLASS` for the container and `aspect-square` for the cover frame (instead of the current w-32/w-36 + aspect-[2/3]).
- Remove the audiobook `p-[12%]` padding workaround — square covers now fill the square frame natively with `object-cover`.
- Update hover classes on the cover container: `group-hover/tile:-translate-y-2` (was `-translate-y-1`), `group-hover/tile:shadow-[0_10px_30px_var(--shadow-brand)]` (was `shadow-[0_8px_24px]`).
- Update image transition: `duration-500` (was `duration-300`).
- Keep the scoped `group/tile` namespace — it prevents ancestor `group` bleed if any future wrapper between the rail and tile introduces a bare `group` class. All 5 selectors carrying the `group-*/tile:` prefix (root, cover lift+shadow, image scale, overlay scrim, overlay content opacity) stay scoped.
- The overlay scrim and content opacity selectors (`group-hover/tile:bg-foreground/30`, `group-hover/tile:opacity-100`) must also have their hover values updated to match the new animation (they already use the correct namespace, just need timing/duration sync).
- Fix corner clipping: add `transform: translateZ(0)` (with `isolate` as a supplemental stacking-context fallback) to the cover container to force GPU compositing and a new stacking context that correctly clips composited child transforms to `rounded-2xl`. The `translateZ(0)` is the primary fix — `isolate` alone is insufficient for the WebKit compositing bug.
- **Preserve the "Audio" format badge (top-left)** on BookTile. Do NOT remove it. The hover overlay icon (Unit 2) is additive — it communicates the tap action, not the format. Audiobooks and ebooks must remain visually distinguishable in the default (non-hover) state to avoid a format-blindness regression.
- Keep the `denseContinue` variant distinct only by showing the progress bar and meta line. Both variants now use the same width and aspect ratio.

**Patterns to follow:**
- BookCard.tsx lines 86–96 (hover animation classes and timing)
- RecentBookCard.tsx lines 48–58 (square cover + LIBRARY_SHELF_CARD_WIDTH_CLASS usage)

**Test scenarios:**
- Happy path: BookTile `small` variant renders with `w-44 sm:w-48` container and `aspect-square` cover
- Happy path: BookTile `denseContinue` variant renders with same sizing, plus progress bar and meta text
- Happy path: hovering the cover container applies `-translate-y-2`, brand shadow, and 105% image scale with 500ms transition
- Edge case: audiobook with square cover art fills the square frame via `object-cover` (no padding, no brand background)
- Edge case: EPUB with existing portrait cover fills the square frame via `object-cover` (top/bottom may be cropped — acceptable for consistency)
- Edge case: hover scale does not produce visible sharp corners (verify `translateZ(0)` GPU compositing fix, with `isolate` as supplemental stacking context)
- Edge case: missing cover shows fallback icon centered in the square frame

**Verification:**
- BookTile cards in Continue Listening and Recently Added shelves are the same width as Discover cards at all breakpoints.
- Hover animation (lift distance, shadow intensity, image scale speed) matches Browse grid BookCards.
- Cover corners stay rounded throughout the hover transition.

---

- [ ] **Unit 2: Change BookTile hover overlay to format icon**

**Goal:** Replace the text button overlay ("Continue"/"Open") with a large format-aware icon (PlayCircle for audiobooks, BookOpen for ebooks).

**Requirements:** R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/library/BookTile.tsx`
- Modify: `src/app/components/library/LibraryMediaShelfColumn.tsx`

**Approach:**
- Import `PlayCircle` from lucide-react.
- Remove the `overlayAction` prop — the action icon is now derived from `book.format`.
- In the overlay div, replace the text `<span>` with a single large icon (e.g., `size-10` or `size-12`): `PlayCircle` for audiobooks, `BookOpen` for ebooks.
- Keep the same overlay appearance behavior: scrim fades in on hover/focus, icon fades in with `opacity-0 group-hover/tile:opacity-100`.
- Icon should be white or near-white on the dark scrim for contrast.
- Update the root element `aria-label` from `` {`${overlayAction} ${book.title}`} `` to a format-derived pattern, e.g., `` {`${book.format === 'audiobook' ? 'Play' : 'Open'} ${book.title}`} ``.
- Add `aria-hidden="true"` to the overlay icon (it's decorative; the root aria-label provides the accessible name).
- Update `LibraryMediaShelfColumn` to stop passing `overlayAction` to BookTile.

**Patterns to follow:**
- BookCard.tsx line 107 — `CheckCircle2` icon over semi-transparent overlay for finished state (size and positioning reference)
- BookCard.tsx line 78–82 — `<div role="link" aria-label={...}>` pattern for root element accessible name

**Test scenarios:**
- Happy path: hovering an audiobook BookTile shows a PlayCircle icon (not text)
- Happy path: hovering an ebook BookTile shows a BookOpen icon (not text)
- Happy path: icon is centered in the cover with the dark scrim background
- Edge case: keyboard focus (Tab) triggers the same overlay reveal as hover
- Edge case: overlay does not appear when book has no resolved cover (fallback icon already visible)

**Verification:**
- No text labels appear on BookTile hover — only icons.
- Icons correctly distinguish audiobooks (PlayCircle) from ebooks (BookOpen).

---

- [ ] **Unit 3: Increase Browse grid to 6 columns on desktop**

**Goal:** Change the Browse tab grid from 5 to 6 columns at the `xl` breakpoint.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/SmartGroupedView.tsx`
- Modify: `src/app/pages/Library.tsx` (two inline grids at ~line 1047 and ~line 1374)

**Approach:**
- Change `GRID_CLASSES` in SmartGroupedView from `xl:grid-cols-5` to `xl:grid-cols-6`.
- Also change the inline grid at Library.tsx line ~1047 (`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6`) to `xl:grid-cols-6`. This grid renders BookCards when a specific format tab (audiobooks/ebooks) is active.
- Change the AbsPaginationSentinel skeleton loader grid at Library.tsx line ~1374 from `xl:grid-cols-5` to `xl:grid-cols-6` for cosmetic consistency.
- With sidebar (220px + 24px margin) and main content padding (48px), the available content width at 1280px viewport is ~988px. At 6 columns with gap-6, cards are ~145px wide. If cards feel cramped (title truncation before ~15 chars, or card width below 150px), reduce gap to `gap-4` (~151px per card).
- Target: maintain ≥44px touch targets and readable titles.

**Patterns to follow:**
- SmartGroupedView.tsx line 31 — the existing `GRID_CLASSES` constant

**Test scenarios:**
- Happy path: at viewport width >= 1280px (xl breakpoint), the grid displays 6 BookCards per row
- Edge case: at lg breakpoint (1024px), still 4 columns
- Edge case: at sm/md breakpoints, 2 and 3 columns respectively (unchanged)

**Verification:**
- Desktop viewport shows 6 audiobook/ebook cards per row in the Browse tab grid.

---

- [ ] **Unit 4: Remove remote/local labels + add format icon to BookCard**

**Goal:** Remove "Remote" source labels from BookCard (both audiobook and EPUB variants) and add a small format icon badge to the top-right corner of covers.

**Requirements:** R6, R7

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/BookCard.tsx`
- Test: `tests/e2e/library-browse.spec.ts` (update any assertions referencing remote badges)

**Approach:**
- **Remove remote labels:**
  - Audiobook metadata section (lines 121–129): remove the `{book.source.type === 'remote' && (...)}` block showing the Cloud icon + "Remote" text.
  - EPUB cover overlay (lines 214–222): remove the `FormatBadge` + remote badge block from the top-left corner. Note: removing the `FormatBadge` from EPUBs means format is indicated only by the new top-right icon (see below) and the `linkedBookId` "Also as..." line.
- **Add format icon:**
  - Add a small `absolute top-2 right-2` icon badge to both audiobook and EPUB cover containers.
  - Style: `rounded-full bg-black/60 backdrop-blur p-1.5` with a white icon (`size-3.5` or `size-4`).
  - Audiobooks: `Headphones` icon.
  - EPUBs/PDFs: `BookOpen` icon.
  - Add `aria-label` for accessibility (e.g., "Audiobook format", "Ebook format").
- Keep the `BookStatusBadge` on EPUBs — move the status badge from `top-2 right-2` to `top-2 left-2` (filling the vacated format badge slot), so the new format icon occupies `top-2 right-2` consistently across both audiobook and EPUB variants.
- For audiobooks: add the format icon at `top-2 right-2` since there's currently no badge there (the status/remote info is below the cover in metadata). Render the format icon AFTER the finished overlay in JSX order (or with explicit `z-10`) so it stays visible above the `bg-background/40` finish scrim.

**Patterns to follow:**
- ContinueShelfTile.tsx lines 86–88 — top-right format icon with `rounded-full bg-black/60 px-2 py-1 backdrop-blur`
- RecentBookCard.tsx lines 66–71 — bottom-right format pill with icon + label

**Test scenarios:**
- Happy path: audiobook BookCard in Browse grid shows Headphones icon in top-right corner of cover
- Happy path: EPUB BookCard in Browse grid shows BookOpen icon in top-right corner of cover
- Happy path: no "Remote" or "Local" text visible on any BookCard in the Browse grid
- Edge case: audiobook with `source.type === 'remote'` still shows no "Remote" label
- Edge case: EPUB status badge is repositioned to not overlap with the new format icon
- Edge case: finished audiobook — format icon is still visible (not hidden by the finished overlay)

**Verification:**
- Browse tab grid cards show only a format icon on the cover, no source labels.
- Format icon reliably distinguishes audiobooks from ebooks.

---

- [ ] **Unit 5: Move Daily Highlights to top of Continue tab**

**Goal:** Reposition the Daily Highlights section from the bottom of the Continue tab to the top, between the format mode tabs and the media hero.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/Library.tsx`

**Approach:**
- In the Continue tab panel (lines 790–855), move `<DailyHighlightsStrip />` from its current position after `<ReadingQueue />` to between `<LibraryFormatModeTabs />` and the conditional media hero/shelves block.
- The new order becomes: `LibraryFormatModeTabs` → `DailyHighlightsStrip` → `LibraryMediaHero` → `LibraryMediaShelfColumn` → `ReadingQueue`.
- No props changes needed — `DailyHighlightsStrip` is self-contained.

**Test scenarios:**
- Happy path: Daily Highlights section renders above the media hero in the Continue tab
- Happy path: Daily Highlights section renders for both Audiobooks and Ebooks format modes
- Edge case: when no highlights exist (empty state), the section returns null — hero and shelves render directly below format tabs with no gap
- Edge case: Daily Highlights does NOT render in the Browse, Collections, or History tabs

**Verification:**
- On the Continue tab, Daily Highlights is the first content section below the format mode tabs.

---

- [ ] **Unit 6: Update tests**

**Goal:** Update existing tests to reflect the changed component behavior and cover new functionality.

**Requirements:** R1–R8 (regression prevention)

**Dependencies:** Units 1–5

**Files:**
- Modify: `src/app/components/library/__tests__/BookTile.test.tsx`
- Modify: `src/app/components/library/__tests__/LibraryMediaShelfColumn.test.tsx`
- Update: `tests/e2e/library-browse.spec.ts` (if remote badge assertions exist)
- Update: `tests/e2e/library-continue.spec.ts` (if Daily Highlights position or BookTile overlay assertions exist)

**Approach:**
- Update BookTile unit tests: verify square sizing, new hover classes, icon overlay (no text), and removed Audio badge.
- Update LibraryMediaShelfColumn tests: verify no `overlayAction` prop is passed to BookTile.
- Update E2E tests: remove any assertions checking for "Remote" text in Browse grid. Add assertions for format icons on BookCards. Update Daily Highlights position assertions.

**Test scenarios:**
- (Covered by unit-specific scenarios in Units 1–5)

**Verification:**
- All existing tests pass after changes.
- New test coverage for format icons, icon overlay, and Daily Highlights position.

## System-Wide Impact

- **Interaction graph:** BookTile changes affect `LibraryMediaShelfColumn` → Continue tab. BookCard changes affect `SmartGroupedView` → Browse tab. DailyHighlightsStrip move affects Library.tsx Continue tab rendering order.
- **Unchanged invariants:** `RecentBookCard` (Discover/Again shelves) is unmodified. `LibraryRail` primitives are unmodified. `ContinueShelfTile` legacy path is unmodified. Collections and History tabs are unmodified.
- **API surface parity:** The `BookTile` component drops the `overlayAction` prop (breaking change). Verify no other consumers exist beyond `LibraryMediaShelfColumn`.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| EPUB portrait covers cropped to square | Acceptable trade-off for visual consistency. EPUB covers in horizontal shelves (Continue/Recently Added) will `object-cover` fill the square frame — top/bottom may be cropped. This already happens in the Browse grid for audiobooks. |
| `overlayAction` prop removal breaks undiscovered consumers | Grep for `overlayAction` and `BookTile` imports before removing. If other consumers exist, keep the prop as optional with a fallback to the icon. |
| Corner clipping fix (`isolate`) may have side effects on z-index stacking | `isolate` creates a new stacking context. Test that overlay elements, badges, and progress bar still render correctly within the cover container. |
| 6-column grid may make cards too small on 1280px viewports | Test at 1280px width. If cards feel cramped, reduce gap from `gap-6` to `gap-4` for the xl breakpoint. |

## Sources & References

- **Origin plan:** [docs/plans/2026-05-05-003-refactor-library-carousels-book-tile-plan.md](2026-05-05-003-refactor-library-carousels-book-tile-plan.md)
- Related code:
  - [src/app/components/library/BookTile.tsx](src/app/components/library/BookTile.tsx)
  - [src/app/components/library/BookCard.tsx](src/app/components/library/BookCard.tsx)
  - [src/app/components/library/RecentBookCard.tsx](src/app/components/library/RecentBookCard.tsx)
  - [src/app/components/library/LibraryMediaShelfColumn.tsx](src/app/components/library/LibraryMediaShelfColumn.tsx)
  - [src/app/components/library/SmartGroupedView.tsx](src/app/components/library/SmartGroupedView.tsx)
  - [src/app/pages/Library.tsx](src/app/pages/Library.tsx)
  - [src/app/components/library/DailyHighlightsStrip.tsx](src/app/components/library/DailyHighlightsStrip.tsx)
  - [src/app/components/library/shelfCardSizing.ts](src/app/components/library/shelfCardSizing.ts)
