# Design Review — E102-S02 Series Browsing

**Date:** 2026-04-06
**Branch:** `feature/e102-s02-series-browsing`
**Reviewer:** Claude Sonnet 4.6 (automated, Playwright MCP)
**Screenshots:** `docs/reviews/design/e102-s02-*.png`

## Verdict: PASS

Series browsing feature is visually correct, accessible, and responsive. No blockers.

## Tested Viewports

- Desktop (1280×800): Series view, grid toggle, expanded card
- Mobile (390×844): Series view expanded

## Findings

### LOW — Series cover image shows broken image alt text in collapsed state

**Observed:** The collapsed series card shows the browser's broken image icon with alt text "The Expans..." instead of falling back to the Headphones icon placeholder.

**Why it happens:** `SeriesCard.tsx` checks `coverUrl` truthiness — `getCoverUrl(server.url, firstBookId)` always returns a non-null URL string (e.g. `http://abs.test:13378/api/items/item-1/cover`), so `coverUrl` is always truthy even when the image fails to load. The `<img>` element has no `onError` fallback handler.

**Impact:** Visual only — broken image icon instead of placeholder headphones icon. Occurs whenever the ABS server is unreachable or books have no cover art.

**Fix:** Add `onError` handler to fall back to the Headphones icon:
```tsx
<img
  src={coverUrl}
  alt={`${series.name} series cover`}
  loading="lazy"
  className="h-full w-full object-cover"
  onError={(e) => { e.currentTarget.style.display = 'none' }}
/>
```
Or use a state-based fallback. Same issue affects individual book cover images in the expanded list.

**Priority:** LOW — occurs only when server unreachable; does not affect function.

---

### LOW — Series tab toggle does not persist when switching between source tabs

**Observed:** If user selects Series view, then clicks "All" source tab (which hides the toggle), then returns to "Audiobookshelf" tab, the view resets to "Grid". This is because `absViewMode` state is local to the Library component and is not reset, but the series view is hidden while "All" is active.

**Impact:** Minor UX inconsistency — expected behavior in most apps is that the last selected view persists. LOW severity since the loaded series data is cached in Zustand (`seriesLoaded: true`), so switching back to Series is instant.

**Priority:** LOW — acceptable UX, data is cached.

---

## Positive Observations

- **Grid/Series toggle** is well-integrated below the source tabs, follows the "pill tabs" pattern used elsewhere in the app.
- **Expanded book list** is clearly laid out — sequence numbers, progress bars, Done/percent labels, and Continue badge all render correctly.
- **Continue badge** (brand blue) correctly highlights "Caliban's War" (#2) as the next unfinished book.
- **Progress bars** show correct values: 100% (Done), 45%, 0%.
- **Chevron rotation** on expand/collapse is smooth and clear.
- **Mobile layout** is usable — all elements visible, Continue badge visible, Open buttons accessible.
- **Design tokens** used throughout — no hardcoded colors visible.
- **Dark mode** rendering is correct (tested in dark theme).

## Accessibility Spot-Check

- Toggle button has `aria-expanded` (visible in DOM via testid interaction).
- Series cover image has `alt` text: `"The Expanse series cover"`.
- Book list has `role="list"`, each book has `role="listitem"`.
- Interactive elements have adequate touch targets (min-h-[64px] for header row).

## Screenshots

- `e102-s02-library-grid.png` — Library page in grid view
- `e102-s02-abs-tab.png` — Audiobookshelf tab selected, Grid/Series toggle visible
- `e102-s02-series-view.png` — Series view collapsed
- `e102-s02-series-expanded.png` — Series card expanded, all books visible
- `e102-s02-series-mobile.png` — Mobile view, expanded
