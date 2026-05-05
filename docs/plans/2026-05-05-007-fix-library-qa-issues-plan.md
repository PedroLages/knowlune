---
title: fix: Library QA — 6 visual issues from shelf consistency rollout
type: fix
status: active
date: 2026-05-05
---

# fix: Library QA — 6 visual issues from shelf consistency rollout

## Overview

Six visual/UX issues were discovered after the library shelf consistency implementation (plan 005). This plan addresses all six: removing unwanted chapter info from Browse cards, repositioning Daily Highlights, migrating Discover to the unified rail pattern, switching to icon-only format badges, fixing hover icon contrast on light covers, and preventing hover-lift animation clipping.

## Problem Frame

The shelf consistency work unified BookTile sizing and hover animations across Continue Listening and Recently Added shelves. Post-merge review found six issues:

1. **Browse tab shows "Chapter 1" for audiobooks** — The BookCard audiobook variant renders chapter title below the cover. This is progress noise in a Browse/discovery context; users don't need current-chapter info when browsing their full library.
2. **Daily Highlights should be at the very top** — In the Continue tab, DailyHighlightsStrip currently renders below LibraryFormatModeTabs. Daily Highlights is the most engaging content on the page and should appear first.
3. **Discover shelf has visible horizontal scrollbar + missing format icons** — Discover uses the older LibraryMediaShelfRow + RecentBookCard pattern, while Recently Added uses the newer LibraryRail + BookTile pattern. The user wants Discover to match the Recently Added experience.
4. **Format badges show text labels** — Both BookTile ("Audio" badge) and RecentBookCard ("Audio"/"eBook" pill) include text alongside the icon. The user wants icon-only indicators.
5. **Hover overlay play icon invisible on light covers** — The `bg-foreground/30` overlay with `text-white` icon blends into white/light book covers, making the action icon nearly invisible.
6. **Hover lift animation clips at the top** — When cards lift up (`-translate-y-2`), the top of the cover and rounded border disappear behind the section above. CSS spec: `overflow-x: auto` implicitly sets `overflow-y: auto`, creating a vertical clip boundary. The scroll containers lack top padding to accommodate the upward movement.

## Requirements Trace

- R1. BookCard audiobook variant in Browse grid must not show chapter title
- R2. DailyHighlightsStrip must render above LibraryFormatModeTabs on the Continue tab
- R3. Discover shelf must use the same LibraryRail + BookTile pattern as Recently Added (no visible scrollbar, format icon on cover)
- R4. Format indicators on BookTile and RecentBookCard must be icon-only (no "Audio", "eBook" text)
- R5. Hover overlay action icon must be clearly visible on all cover colors (light, dark, colorful)
- R6. Hover lift animation must not clip the top of cards in any horizontal scroll rail

## Scope Boundaries

- Only the six listed issues are in scope
- No changes to BookCard EPUB variant, LibraryMediaHero, DailyGoalRing, or YearlyGoalProgress
- No changes to shelf query logic or data layer
- RecentBookCard is updated for icon-only (R4) but not otherwise redesigned — the Listen Again / Read Again shelves continue using RecentBookCard via LibraryMediaShelfRow
- The "Listen Again" / "Read Again" shelves are not migrated to LibraryRail in this plan (user only flagged Discover)

### Deferred to Separate Tasks

- Migrate Listen Again / Read Again shelves to LibraryRail + BookTile: separate PR — those shelves still use LibraryMediaShelfRow + RecentBookCard
- Full removal of RecentBookCard component: once all consumers are migrated to BookTile

## Context & Research

### Relevant Code and Patterns

- [BookTile.tsx](src/app/components/library/BookTile.tsx) — unified tile with icon overlay, audio badge, hover animation
- [BookCard.tsx](src/app/components/library/BookCard.tsx) — grid card used in Browse tab; audiobook variant has chapter display at lines 133-142
- [RecentBookCard.tsx](src/app/components/library/RecentBookCard.tsx) — older compact card used by Discover and Listen Again shelves; has text-based format indicator
- [Library.tsx](src/app/pages/Library.tsx) — main library page; Continue tab layout at lines 790-797
- [LibraryMediaShelfColumn.tsx](src/app/components/library/LibraryMediaShelfColumn.tsx) — defines all five shelf sections; Discover and Listen Again use LibraryMediaShelfRow + RecentBookCard
- [LibraryRail.tsx](src/app/components/library/rails/LibraryRail.tsx) — unified rail primitive; used by Continue Listening and Recently Added shelves
- [RailViewport.tsx](src/app/components/library/rails/RailViewport.tsx) — scroll container with `overflow-x-auto` and `scrollbar-none` class
- [LibraryMediaShelfRow.tsx](src/app/components/library/LibraryMediaShelfRow.tsx) — older scroll container; also uses `overflow-x-auto`
- [shelfCardSizing.ts](src/app/components/library/shelfCardSizing.ts) — shared width constant (`w-44 sm:w-48`)
- [scrollbar-none utility](src/styles/index.css:310-315) — hides scrollbar via `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`

### Institutional Learnings

- [library-shelf-sizing-hover-consistency-2026-05-05.md](docs/solutions/ui-bugs/library-shelf-sizing-hover-consistency-2026-05-05.md) — solution doc from plan 005; documents the `translateZ(0)` corner-clipping fix and the unified sizing pattern

### External References

- [CSS Overflow spec](https://www.w3.org/TR/css-overflow-3/#overflow-properties) — `overflow-x: auto` + `overflow-y: visible` computes to `overflow-y: auto`; this is the root cause of R6 hover clipping

## Key Technical Decisions

- **Discover uses LibraryRail (not LibraryMediaShelfRow):** LibraryRail is the newer, tested pattern with proper scrollbar hiding and chevron controls. Discover currently uses no chevrons, but matching the Recently Added pattern is the explicit user request.
- **Action icon gets a dark backdrop circle:** For R5, the most reliable contrast fix across all cover colors is wrapping the icon in a `bg-black/60 backdrop-blur rounded-full` container. This works on white, black, and colorful covers. Increasing overlay opacity alone would not solve the white-icon-on-white-cover problem.
- **pt-2 added to scroll containers:** For R6, the fix is adding 8px top padding (`pt-2`) to both RailViewport and the LibraryMediaShelfRow scroller. This matches the existing `pb-2` bottom padding and gives the `-translate-y-2` (8px) lift room. Wrapping in a separate overflow-visible container would add DOM complexity for no gain.
- **Chapter info removal is a deletion, not a prop gate:** No component currently needs chapter info in Browse context. A prop to conditionally show/hide adds complexity with no current consumer. If a future view needs chapter info, a prop can be added then.

## Implementation Units

- [ ] **Unit 1: Remove chapter display from BookCard audiobook variant**

**Goal:** Remove the chapter title line shown below audiobook covers in the Browse grid.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/BookCard.tsx`

**Approach:**
- Remove the chapter rendering block (lines 133-142) from the audiobook return path in BookCard
- The block renders when `book.chapters.length > 0 && book.currentPosition?.type === 'time' && (book.progress ?? 0) > 0`
- The `findCurrentChapterTitle` helper (line 25) is only used by this block — remove it
- The `formatDuration` helper (line 41) is still used by the duration display below — keep it

**Patterns to follow:**
- Audiobook variant return already renders duration, NEW badge, and linked-format indicator — removing chapter won't leave a gap

**Test scenarios:**
- Happy path: Audiobook with chapters, progress > 0, currentPosition is time-based → chapter title is NOT rendered
- Edge case: Audiobook with empty chapters array → no chapter title (already the case, regression check)
- Edge case: Audiobook with chapters but progress = 0 → no chapter title (not in-progress)
- Edge case: Audiobook with chapters but currentPosition is undefined/null → no chapter title (no playback history)

**Verification:**
- `findCurrentChapterTitle` function no longer exists in BookCard.tsx
- Audiobook card renders in Browse grid without chapter text below metadata

- [ ] **Unit 2: Reorder Daily Highlights above format tabs**

**Goal:** Move DailyHighlightsStrip to render before LibraryFormatModeTabs in the Continue tab.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/Library.tsx`

**Approach:**
- In the Continue tab panel (lines 790-797), swap the order of `<LibraryFormatModeTabs />` and `<DailyHighlightsStrip />`
- Current order: FormatTabs → DailyHighlights → hero/shelves
- New order: DailyHighlights → FormatTabs → hero/shelves

**Patterns to follow:**
- Both components are self-contained with their own section/role wrappers — no shared state or layout coupling

**Test scenarios:**
- Happy path: Render Continue tab with books → DailyHighlightsStrip appears before LibraryFormatModeTabs in the DOM
- Regression: Render Browse tab → DailyHighlightsStrip is NOT rendered (Browse tab has its own layout, unaffected by this reorder)
- There is no existing Library.tsx unit test beyond auth-failed — visual verification via design review

**Verification:**
- In Library.tsx Continue tab JSX, `<DailyHighlightsStrip />` appears on a line before `<LibraryFormatModeTabs />`

- [ ] **Unit 3: Migrate Discover shelf to LibraryRail + BookTile**

**Goal:** Replace LibraryMediaShelfRow + RecentBookCard with LibraryRail + BookTile (small variant) for the Discover shelf, matching the Recently Added pattern.

**Requirements:** R3

**Dependencies:** None — this migration is functional with current BookTile. R4, R5, and R6 are systemic BookTile/rail fixes applied by Units 4-6 and will automatically benefit Discover once those units land.

**Files:**
- Modify: `src/app/components/library/LibraryMediaShelfColumn.tsx`
- Modify: `src/app/components/library/__tests__/LibraryMediaShelfColumn.test.tsx`

**Approach:**
- In LibraryMediaShelfColumn.tsx, change the Discover shelf from `<LibraryMediaShelfRow>` + `<RecentBookCard>` to `<LibraryRail>` + `<BookTile variant="small">`
- This matches the Recently Added pattern (lines 132-141): `LibraryRail` with icon, title, count, children as `BookTile` array
- Use `Compass` icon (already imported) and "Discover" title (already used)
- BookTile already has: format icon overlay, dark backdrop icon (after Unit 5), icon-only badge (after Unit 4), proper hover animation, and renders inside LibraryRail which has RailViewport with pt-2 (after Unit 6)
- Remove the `RecentBookCard` import if no longer used by this file (it's still used by Listen Again — keep if so)

**Patterns to follow:**
- Recently Added shelf at lines 132-141: `LibraryRail` with `BookTile variant="small"`
- Continue shelf at lines 120-130: `LibraryRail` with `BookTile variant="denseContinue" showProgress`

**Test scenarios:**
- Happy path: Discover shelf renders with LibraryRail section and BookTile children (not RecentBookCard)
- Happy path: Each BookTile in Discover uses "small" variant (no progress bar)
- Edge case: Discover shelf has no books → LibraryRail returns null (empty children guard)
- Integration: Discover tiles respond to hover with lift animation and icon overlay (covered by existing BookTile tests)
- Data flow: Each BookTile in Discover receives the correct `book` prop from `shelves.discover` — verify tile count matches data and each tile's `data-testid` references the correct book ID

**Verification:**
- `LibraryMediaShelfColumn.tsx` Discover section uses `<LibraryRail>` with `<BookTile variant="small">`
- No `RecentBookCard` import remains (if unused by Listen Again — otherwise keep)
- Existing `LibraryMediaShelfColumn` tests pass with updated expectations (specifically: Discover heading still renders, BookTile children reference correct book IDs)

- [ ] **Unit 4: Icon-only format indicators**

**Goal:** Remove text labels from format indicator badges, leaving only the icon.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/BookTile.tsx`
- Modify: `src/app/components/library/RecentBookCard.tsx`
- Modify: `src/app/components/library/__tests__/BookTile.test.tsx`

**Approach:**
- **BookTile:** In the audio badge (lines 172-183), remove the "Audio" text span. Keep only the `Headphones` icon inside the pill. Change the badge styling from `bg-brand-soft text-brand-soft-foreground` to match BookCard's icon-only pattern: `bg-black/60 backdrop-blur p-1.5` with `size-3.5 text-white` icon. The existing `aria-label="Audio format"` on the span preserves accessibility.
- **RecentBookCard:** In the format indicator (lines 66-70), the structure already uses `bg-black/60 backdrop-blur-md`. Remove the text span showing "Audio" or "eBook", keeping only the `FormatIcon` (already `size-3 text-white`). Update `aria-label` on the wrapper to indicate format for accessibility.

**Patterns to follow:**
- BookCard audiobook format badge (line 110-115): `<div className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur p-1.5 z-10"><Headphones className="size-3.5 text-white" /></div>`
- BookCard EPUB format badge (line 210-215): same structure with `BookOpen` icon
- Both BookTile and RecentBookCard adopt this exact pattern (icon size, padding, backdrop, positioning)

**Test scenarios:**
- Happy path: Audiobook BookTile renders audio badge with Headphones icon but NO "Audio" text
- Happy path: EPUB BookTile renders NO audio badge (still the case, regression check)
- Happy path: Audiobook RecentBookCard renders Headphones icon but NO "Audio" text
- Happy path: EPUB RecentBookCard renders BookOpen icon but NO "eBook" text
- Accessibility: Format indicator has appropriate aria-label for screen readers

**Verification:**
- `screen.getByText('Audio')` and `screen.getByText('eBook')` are not present in BookTile or RecentBookCard renders
- BookTile tests that referenced "Audio" text are updated to check for icon presence only

- [ ] **Unit 5: Fix hover overlay icon contrast on light covers**

**Goal:** Make the hover action icon (PlayCircle/BookOpen) visible regardless of the cover image color.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/BookTile.tsx`
- Modify: `src/app/components/library/__tests__/BookTile.test.tsx`

**Approach:**
- Currently: the overlay is `bg-foreground/30` and the icon is `text-white` — on white covers, both are nearly invisible
- Wrap the `ActionIcon` in a dark backdrop circle: `<div className="rounded-full bg-black/60 backdrop-blur-md p-2"><ActionIcon className="size-6 text-white" /></div>`
- This ensures the icon always has a dark background regardless of cover color
- Keep the existing overlay tint (bg-foreground/30) as an additional dimming layer
- The backdrop circle pattern is already used in BookCard's format badge (lines 110-115) and RecentBookCard's indicator (lines 66-70)

**Patterns to follow:**
- BookCard format badge: `bg-black/60 backdrop-blur p-1.5` with white icon

**Test scenarios:**
- Happy path: Hover overlay contains a dark backdrop circle wrapping the action icon
- Happy path: Action icon has `text-white` class for contrast against the dark backdrop
- Edge case (fallback): When no cover image, fallback icon renders (existing behavior, regression check)
- Accessibility: Action icon remains `aria-hidden="true"` (root aria-label provides accessible name)

**Verification:**
- The overlay div contains a child with `bg-black/60` and `rounded-full` classes wrapping the ActionIcon
- Existing tests for overlay icon and aria-hidden still pass

- [ ] **Unit 6: Fix hover lift animation clipping in scroll containers**

**Goal:** Prevent the 8px hover lift (`-translate-y-2`) from being clipped by scroll containers' implicit `overflow-y: auto`.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/rails/RailViewport.tsx`
- Modify: `src/app/components/library/LibraryMediaShelfRow.tsx`
- Modify: `src/app/components/library/LibraryShelfRow.tsx`

**Approach:**
- **RailViewport** (line 28): Add `pt-2` to the className. Currently has `pb-2` which protects bottom overflow; `pt-2` (8px) matches the `-translate-y-2` (8px) lift distance. The container becomes `pt-2 pb-2`.
- **LibraryMediaShelfRow scroller** (line 135): Add `pt-2` to match the existing `pb-2`. This protects the Discover, Listen Again, and Recent Series shelves.
- **LibraryShelfRow scroller** (line 165): Same pattern — `overflow-x-auto` with `pb-2` but no top padding. Add `pt-2` for the same reason.
- The 8px is exactly `-translate-y-2` in Tailwind's spacing scale (0.5rem = 8px).
- No DOM restructuring needed — the padding approach is minimal and sufficient.
- All three scrollers use the same `overflow-x-auto` pattern that implicitly creates `overflow-y: auto` per CSS spec.

**Patterns to follow:**
- The existing `pb-2` on both containers already handles bottom overflow from the scale-105 image transform

**Test scenarios:**
- Visual verification: Hover over a BookTile in any horizontal rail → card lifts up 8px without the top edge clipping
- Visual verification: Hover over a RecentBookCard in Discover/Listen Again → card lifts without clipping
- Regression: Horizontal scroll still works correctly (padding doesn't interfere with scroll behavior)
- Regression: Scrollbar remains hidden (scrollbar-none still applied)

**Verification:**
- `RailViewport` className includes `pt-2`
- `LibraryMediaShelfRow` scroller className includes `pt-2`

## System-Wide Impact

- **Interaction graph:** All six units touch the Library page's Continue and Browse tabs. No auth, data layer, or routing changes.
- **Error propagation:** No error handling changes.
- **State lifecycle risks:** None — purely presentational changes.
- **API surface parity:** BookTile and RecentBookCard props are unchanged; LibraryRail and LibraryMediaShelfRow props are unchanged.
- **Integration coverage:** Discover migration (Unit 3) switches the rendering component but uses the same data (`shelves.discover` from `libraryShelves`). Verify via LibraryMediaShelfColumn test.
- **Unchanged invariants:** BookTile variant prop, showProgress prop, data-testid attributes, and keyboard navigation remain unchanged. Shelf data queries and store selectors are untouched. The Continue Listening, Recently Added, Recent Series, and Listen Again shelves are not restructured.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Discover migration changes visual behavior (chevrons now appear on hover, unlike old LibraryMediaShelfRow) | This is the user's explicit request — they want Discover to match Recently Added |
| RecentBookCard is shared between Discover and Listen Again shelves | Keep RecentBookCard for Listen Again; only remove its use in Discover |
| Adding pt-2 to RailViewport pushes content down 8px, creating visual spacing change | pt-2 is 8px — negligible at shelf level; matches existing pb-2 approach |
| Icon-only badges may confuse new users about format | The icon (Headphones vs BookOpen) is unambiguous; BookCard already uses this pattern successfully |

## Documentation / Operational Notes

- No API, environment, or deployment changes
- After merge, run design review (`/design-review`) to verify all six fixes visually at 375px, 768px, and 1440px breakpoints

## Sources & References

- **Preceding plan:** [2026-05-05-005-fix-library-shelf-consistency-plan.md](docs/plans/2026-05-05-005-fix-library-shelf-consistency-plan.md)
- **Solution doc:** [library-shelf-sizing-hover-consistency-2026-05-05.md](docs/solutions/ui-bugs/library-shelf-sizing-hover-consistency-2026-05-05.md)
- Related code: [BookTile.tsx](src/app/components/library/BookTile.tsx), [BookCard.tsx](src/app/components/library/BookCard.tsx), [RecentBookCard.tsx](src/app/components/library/RecentBookCard.tsx), [LibraryRail.tsx](src/app/components/library/rails/LibraryRail.tsx), [RailViewport.tsx](src/app/components/library/rails/RailViewport.tsx), [LibraryMediaShelfRow.tsx](src/app/components/library/LibraryMediaShelfRow.tsx), [LibraryMediaShelfColumn.tsx](src/app/components/library/LibraryMediaShelfColumn.tsx), [Library.tsx](src/app/pages/Library.tsx)
