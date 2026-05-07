---
title: 'feat: Library media shelves — optional audio badge, overflow-only arrows, Listen Again tint'
type: feat
status: active
date: 2026-05-07
---

# feat: Library media shelves — optional audio badge, overflow-only arrows, Listen Again tint

## Summary

Polish the Library **Audiobooks / Ebooks** media rail experience: **`BookTile` ships the small audiobook corner badge** for format clarity (centered hover play overlay removed per visual direction); make horizontal **scroll chevrons larger** and **hide them entirely** when the shelf content fits the viewport; apply a **muted / greyed presentation** to tiles in **Listen Again / Read Again**. Browse grid audiobook **`BookCard`** omits the corner badge to match a calmer grid pattern. Changes touch shared rail primitives so **Continue Listening**, **Recently Added**, **Discover**, **Recent Series**, and **Listen Again** behave consistently.

---

## Problem Frame

Users find the top-right **Headphones** badge on audiobook covers visually noisy (especially combined with hover affordances) and want the **shelf scroll controls** to be easier to hit and to **disappear** when there is nothing to scroll. Finished or “again” content should read as **archived / replay** through a calmer, lower-contrast treatment.

---

## Requirements

- R1. **Library `BookTile`:** Remove the centered hover **play/open overlay**; **keep** the small top-right **Headphones** audiobook badge for format recognition. Progress bar and tile affordances otherwise unchanged.
- R2. **Browse tab parity:** Audiobook grid cards (`BookCard` square layout) no longer show the top-right Headphones badge, matching the media shelf art-first pattern.
- R3. **Larger chevrons** for horizontal shelf navigation (rails and legacy shelf row components used by media columns).
- R4. **Chevrons only when content overflows** the scroller (`scrollWidth` meaningfully greater than `clientWidth`). When all items fit, **no** scroll buttons (not merely disabled/ghosted).
- R5. R4 applies to **all** horizontal shelf implementations used by `LibraryMediaShelfColumn` — `LibraryRail` (Continue, Recently Added, Discover) and `LibraryMediaShelfRow` (Recent Series, Listen Again), and **Library**’s shared `LibraryShelfRow` primitive for any remaining in-app usage.
- R6. **Listen Again / Read Again** tiles are visually **greyed or desaturated** so users recognize them as replay / completed context while remaining clickable.

---

## Scope Boundaries

- **In scope:** `BookTile`, `BookCard` (audiobook branch), `LibraryRail` + `RailControls`, `LibraryShelfRow`, `LibraryMediaShelfRow`, `RecentBookCard` (Listen Again prop), `LibraryMediaShelfColumn` wiring, and unit tests that assert the old audio badge.
- **Out of scope:** OPDS browser, course/figma cards, `BookListItem` row format icons (list UI is not the same as cover art), changing shelf **data** or which books appear in each section, keyboard scroll behavior beyond what already exists.
- **Deferred to follow-up:** Unify `RecentBookCard` with `BookTile` for Discover/Again (already discussed in past plans) — this plan only adds a **tone** prop and keeps the current component split.

---

## Context & Research

### Relevant Code and Patterns

- **`src/app/components/library/BookTile.tsx`** — **No** centered hover play/open overlay (R1). **Headphones** badge remains `absolute top-2 right-2` with `data-testid` `book-tile-${id}-audio-badge`.
- **`src/app/components/library/BookCard.tsx`** — Audiobook square cover: **no** top-right Headphones badge (R2).
- **`src/app/components/library/rails/RailControls.tsx`** — Chevrons are `size-8` with `ChevronLeft/Right` at `size-4`; use `group-hover/rail` + `disabled:opacity-35` (R3–R4: grow controls; **hide** when no overflow, not just disable).
- **`src/app/components/library/rails/LibraryRail.tsx`** — Computes `canScrollLeft` / `canScrollRight` from scroll position; extend with **`hasOverflow`** when `scrollWidth` exceeds `clientWidth` (same `maxScrollLeft` computation).
- **`src/app/components/library/LibraryShelfRow.tsx`** — Same scroll math as `LibraryRail` but `group/shelf` and `size-9` buttons; must get the same overflow gate + larger hit targets.
- **`src/app/components/library/LibraryMediaShelfRow.tsx`** — Slightly larger buttons (`size-10`) but always visible on md+; align with overflow-only + sizing.
- **`src/app/components/library/LibraryMediaShelfColumn.tsx`** — Maps shelves to `LibraryRail` / `LibraryMediaShelfRow`; passes `RecentBookCard` for Again — add **muted** prop here only for that shelf.
- **Tests:** `BookTile` keeps audio-badge assertions where applicable; `LibraryMediaShelfColumn` / rail tests cover overflow affordances and muted Again shelf.

### Institutional Learnings

- See `docs/solutions/best-practices/library-carousels-unified-booktile-composable-rails-2026-05-05.md` — named `group/rail` scoping, `data-rail-tile` measurement, and why rails were split from ad-hoc shelf rows. This plan extends the rail contract with **overflow presence** and keeps **one** behavior across `LibraryRail` and `LibraryShelfRow` / `LibraryMediaShelfRow`.

### External References

- None required — native `Element.scrollWidth` / `clientWidth` and optional `ResizeObserver` for post-layout changes are sufficient.

---

## Key Technical Decisions

- **Overflow flag:** Derive `hasOverflow` from the same scroller element as today: `maxScrollLeft = max(0, scrollWidth - clientWidth)`; treat **`hasOverflow` as `maxScrollLeft > 0`** (or match a 1–2px tolerance if sub-pixel rounding appears in a browser). Pass `hasOverflow` into control components; when `false`, render **no** chevron buttons (or `null`) so they do not appear on hover.
- **Resize / async layout:** `window` `resize` is already wired; if overflow appears only after **images** load, add a **`ResizeObserver` on the scroller** (or re-run affordances on `load` for `img` inside the rail) in implementation — plan defers exact hook shape to `ce-work`.
- **DRY option:** A small `useShelfScrollAffordances(scrollerRef)` hook returning `{ canLeft, canRight, hasOverflow, update }` reduces duplication across three files — use if it stays under ~40 lines and avoids over-abstraction.
- **Listen Again styling:** Prefer **`opacity` + `grayscale`** (or `text-muted-foreground` on metadata) on the **card wrapper** via a prop such as `tone="muted"` on `RecentBookCard`, applied only from `LibraryMediaShelfColumn` for the Again shelf; preserve click targets and focus rings.

---

## Open Questions

### Resolved During Planning

- **Which affordances on `BookTile`?** Ship **no** centered hover overlay; **keep** the corner **Headphones** badge on library tiles; **remove** badge on Browse `BookCard` only (R2).
- **Does Browse need rail changes?** Browse uses **`BookCard`** grid, not rails — R2 covers it.

### Deferred to Implementation

- Exact Tailwind classes for muted Again tiles (e.g. `opacity-75 grayscale` vs softer border) — validate against dark theme.

---

## Implementation Units

- U1. **~~Remove audiobook cover corner badge from BookTile and BookCard~~** → **Superseded:** R1 removes hover overlay on `BookTile` and **retains** the headphones badge; R2 still removes badge from `BookCard` only.

**Goal:** Satisfy R1 (tile overlay + badge) and R2 (Browse grid).

**Requirements:** R1, R2

**Shipped approach:** Delete centered overlay from `BookTile`; keep `*-audio-badge` test IDs; remove badge block from audiobook `BookCard`; update tests accordingly.

**Verification:** Library audiobook tile shows corner badge without center play-on-hover; Browse grid has no corner badge.

---

- U2. **Overflow-gated, larger chevrons across LibraryRail, LibraryShelfRow, LibraryMediaShelfRow**

**Goal:** Satisfy R3, R4, R5.

**Requirements:** R3, R4, R5

**Dependencies:** None (can parallelize with U1)

**Files:**
- Modify: `src/app/components/library/rails/RailControls.tsx`
- Modify: `src/app/components/library/rails/LibraryRail.tsx`
- Modify: `src/app/components/library/LibraryShelfRow.tsx`
- Modify: `src/app/components/library/LibraryMediaShelfRow.tsx`
- Optional create: `src/app/hooks/useShelfScrollAffordances.ts` (if extracted)
- Test: `src/app/components/library/rails/__tests__/LibraryRail.test.tsx`
- Test: `src/app/components/library/__tests__/LibraryShelfRow.test.tsx`

**Approach:** Add `hasOverflow` (or equivalent) next to existing scroll affordance updates; **if !hasOverflow**, do not render chevron buttons. Increase button diameter (e.g. `size-8` → `size-11` or `size-12`) and icon size (`size-4` → `size-6`) consistently. Consider `ResizeObserver` on the scroll container to re-measure when content dimensions change.

**Test scenarios:**
- Happy path: With many stub tiles and wide viewport mock (if needed), chevrons exist; with **one** narrow tile and **no** overflow, chevrons **not** in document (or `not.toBeVisible()` — prefer not rendered).
- Edge case: At exact fit (scrollWidth === clientWidth), `hasOverflow` false — no buttons.
- Note: jsdom often reports `scrollWidth === clientWidth`; tests may need **layout mocking** (`Object.defineProperty` on prototype) or focus on **conditional class/render** via exported test helpers — document the chosen approach in the PR if tests stay behavioral-only.

**Verification:** Manual: narrow viewport + many items → chevrons appear; widen until all tiles visible → chevrons disappear.

---

- U3. **Muted presentation for Listen Again / Read Again**

**Goal:** Satisfy R6.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/RecentBookCard.tsx`
- Modify: `src/app/components/library/LibraryMediaShelfColumn.tsx`
- Test: add or extend `src/app/components/library/__tests__/RecentBookCard.test.tsx` (if missing, create minimal file)

**Approach:** Add optional prop (e.g. `tone?: 'default' | 'muted'`) — when `muted`, apply wrapper classes for reduced emphasis (`opacity`, `grayscale`, optional `hover:opacity-100` for slight lift). Pass `tone="muted"` only for the Again shelf mapping.

**Test scenarios:**
- Happy path: `RecentBookCard` with `tone="muted"` applies expected utility classes or `data-*` attribute for stable assertion.
- Edge case: Default tone matches current appearance (no regression).

**Verification:** Visual check on Library → Audiobooks → scroll to Listen Again.

---

## System-Wide Impact

- **Interaction graph:** Browse grid audiobook cards omit the format badge; library `BookTile` keeps it; navigation and reader flows unchanged.
- **Unchanged invariants:** Shelf data selectors, `getAudiobookListenAgainShelf`, routing, and `data-testid` prefixes for tiles (`book-tile-${id}`, `book-tile-*-audio-badge` on library audiobooks).

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Tests fail on jsdom scroll metrics | Use layout mocks or assert render branches with overflow prop injection |
| Images loading change overflow after first paint | ResizeObserver or load listeners on scroller |
| Over-muted Again tiles hurt legibility | Tune opacity/grayscale; keep title contrast WCAG-friendly |

---

## Documentation / Operational Notes

- None unless product docs describe the Headphones badge — unlikely.

---

## Sources & References

- Related code: `src/app/components/library/BookTile.tsx`, `src/app/components/library/rails/LibraryRail.tsx`, `src/app/components/library/LibraryMediaShelfColumn.tsx`
- Learning doc: `docs/solutions/best-practices/library-carousels-unified-booktile-composable-rails-2026-05-05.md`
