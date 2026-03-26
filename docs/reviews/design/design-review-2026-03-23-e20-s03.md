# Design Review Report — E20-S03: 365-Day Activity Heatmap

**Review Date**: 2026-03-23
**Reviewed By**: Claude (design-review agent via Playwright MCP)
**Story**: E20-S03 — 365-Day Activity Heatmap
**Branch**: `feature/e20-s03-365-day-activity-heatmap`
**Changed Files**:
- `src/app/components/reports/ActivityHeatmap.tsx`
- `src/app/pages/Reports.tsx` (integration)
- `src/styles/theme.css` (heatmap design tokens)
- `src/lib/activityHeatmap.ts` (grid/data logic)

**Affected Pages**: `/reports` (Study Analytics tab)

---

## Executive Summary

The 365-day activity heatmap is a well-executed implementation of the GitHub-style contribution graph pattern. The component renders a full year of study activity correctly, integrates cleanly into the Reports page, and introduces a thoughtful 5-level color scale using properly defined design tokens. Two issues require attention before merge: a WCAG contrast failure in the tooltip secondary text (2.99:1 against the dark tooltip background), and mobile cells that shrink to 8×8px rendering the grid almost imperceptible on small screens. Both are fixable with targeted changes.

---

## Findings by Severity

### Blockers (Must fix before merge)

**BLOCKER-1: Tooltip secondary text fails WCAG AA contrast (2.99:1)**

The tooltip for each cell uses a two-line layout: the date is white on the dark background (16.67:1 — passes), but the study time text beneath it uses `text-muted-foreground` (`rgb(101, 104, 112)`) against the tooltip's dark background (`rgb(28, 29, 43)`). The computed contrast ratio is **2.99:1**, well below the required 4.5:1 for normal text.

- **Location**: `src/app/components/reports/ActivityHeatmap.tsx:245`
- **Evidence**: Computed — `color: rgb(101, 104, 112)` on `background: rgb(28, 29, 43)` = 2.99:1
- **Impact**: Learners with low vision or in bright ambient conditions will struggle to read the study time value, which is the most informative part of the tooltip
- **Suggestion**: Use `text-primary-foreground` (white) or a lighter token on the tooltip secondary line, since `text-muted-foreground` is designed for light backgrounds only. The tooltip background is already dark enough to need high-contrast text throughout.

---

### High Priority (Should fix before merge)

**HIGH-1: Heatmap cells are 8×8px on mobile — practically invisible**

At 375px viewport width, each cell collapses to approximately 8×8px with `gap-[3px]`. At this size the entire heatmap is a barely-visible strip. The horizontal scroll container correctly prevents page overflow (`scrollWidth: 616px, clientWidth: 285px, isScrollable: true`), but the cells are far too small to read or interact with.

- **Location**: `src/app/components/reports/ActivityHeatmap.tsx:174–178`
- **Evidence**: Computed `getBoundingClientRect()` returns `{w: 8, h: 8}` at 375px viewport; screenshot `s20-mobile-heatmap-card.png` confirms near-invisible grid
- **Impact**: The heatmap conveys no useful information to mobile learners. At 8px with a 3px gap, cells also fall far below the 44×44px touch target guideline — though since cells are not interactive triggers (tooltip-only), touch target rules are less critical here, but visual legibility certainly is.
- **Suggestion**: Consider a two-tier approach: on mobile (`< sm`), replace the heatmap grid with a message directing the learner to the "View as table" mode (which renders perfectly on mobile at `scrollWidth: 277px`), or add a `min-w` floor so cells stay at least 10–11px. The "View as table" toggle is already implemented and works well at 375px — simply defaulting to table view on mobile would resolve this entirely.

**HIGH-2: "View as table" button semantics — aria-pressed vs role="switch"**

The toggle button correctly uses `aria-pressed` (`aria-pressed={showTable}`), which is the right pattern for a toggle button. However, `aria-pressed` communicates a binary on/off state, but the button text also changes ("View as table" / "View as grid"). Screen readers will announce both the changed text and the `aria-pressed` state, which can be redundant or confusing (e.g., announcing "View as grid, pressed"). A cleaner pattern is to use `aria-pressed` without changing the button text, or drop `aria-pressed` and rely solely on the text change.

- **Location**: `src/app/components/reports/ActivityHeatmap.tsx:118–127`
- **Evidence**: `aria-pressed="false"` confirmed via browser audit; button text changes on click
- **Impact**: Moderate confusion for screen reader users — not broken, but double-signals the state
- **Suggestion**: Either keep the text change and remove `aria-pressed`, or keep `aria-pressed` and fix the text to a static label like "Accessible table view" with a visually-hidden state description. Either approach passes WCAG; the current combination is technically compliant but creates redundant announcements.

---

### Medium Priority (Fix when possible)

**MEDIUM-1: Inline `style=` for grid template — justified but documentable**

The heatmap grid uses `style={{ gridTemplateColumns: ..., gridTemplateRows: ... }}` to set dynamic column counts (line 175–178 in `ActivityHeatmap.tsx`). This is a necessary workaround since Tailwind cannot generate arbitrary `repeat(N, ...)` utilities at build time. The ESLint `react-best-practices/no-inline-styles` rule will warn on this.

- **Location**: `src/app/components/reports/ActivityHeatmap.tsx:175–178`
- **Evidence**: Confirmed inline style on the grid container
- **Impact**: None functionally; slight friction with the project's lint rules
- **Suggestion**: Add an `// eslint-disable-next-line react-best-practices/no-inline-styles` comment with a brief explanation ("Dynamic column count cannot use Tailwind utilities") to suppress the warning intentionally and communicate the rationale to future maintainers.

**MEDIUM-2: Month labels at 10px are below legible threshold at small viewports**

The month abbreviations (`Mar`, `Apr`, etc.) are rendered at `text-[10px]`. At desktop this reads fine but at mobile these labels, combined with 8px cells, produce a grid that no longer communicates a calendar structure. This is secondary to HIGH-1 but part of the same mobile legibility problem.

- **Location**: `src/app/components/reports/ActivityHeatmap.tsx:188`
- **Evidence**: Confirmed `fontSize: 10px` via `getComputedStyle`
- **Impact**: At desktop, 10px muted labels are acceptable as secondary labeling. At mobile, they become unreadable in the context of near-invisible cells.
- **Suggestion**: If the mobile grid is retained (rather than switching to table-default), consider `text-[11px] sm:text-[10px]` so that mobile gets slightly larger labels.

**MEDIUM-3: Recharts console warnings present on page (pre-existing, not from this story)**

Three Recharts "width/height -1" warnings appear in the console on page load, originating from other charts on the Reports page (BarChart, AreaChart). These are not caused by the heatmap component but degrade the overall console health of the page.

- **Location**: `src/app/pages/Reports.tsx` (Recharts chart containers)
- **Evidence**: Console output during review: "The width(-1) and height(-1) of chart should be greater than 0"
- **Impact**: Pre-existing issue; does not affect heatmap functionality
- **Suggestion**: Address separately — add explicit `height` to Recharts containers or ensure `min-h-[1px]` containers resolve before render.

---

### Nitpicks (Optional)

**NITPICK-1: No section heading visible to sighted users above the active-days count**

The heatmap component renders `"{n} active days in the past year"` as a `<p>` element with no visual label or sub-heading. The card `<h3>` ("365-Day Study Activity") provides the heading context, so this is semantically correct, but the header row feels slightly sparse — there is whitespace where a supporting label or date range indicator could appear.

- **Location**: `src/app/components/reports/ActivityHeatmap.tsx:112–117`
- **Suggestion**: Consider adding a date range label (e.g., "Mar 2025 – Mar 2026") next to or below the active-days count to orient the learner without requiring them to read the month labels on the grid.

**NITPICK-2: Legend "Less / More" text placement is slightly ambiguous**

The legend reads "Less [squares] More". The "Less" and "More" labels are separate `<span>` elements separated from the square sequence by a flex gap. On very narrow screens, the `flex-wrap` may cause "Less" to appear on a different line from the squares it labels.

- **Location**: `src/app/components/reports/ActivityHeatmap.tsx:260–276`
- **Suggestion**: Low risk — the flex-wrap implementation is reasonable. If a line break does occur, it reads correctly because "Less" is the first element and the squares follow. No change strictly needed.

**NITPICK-3: Today indicator "Today" in legend has no aria-label**

The "Today" legend item in the bottom-right is a plain `<div>` with a ring style and the text "Today" next to it. No ARIA label is attached to the ring indicator div itself.

- **Location**: `src/app/components/reports/ActivityHeatmap.tsx:277–279`
- **Evidence**: `<div className="size-3 rounded-[3px] ring-2 ring-brand ...">` — no `aria-label`
- **Suggestion**: The surrounding text "Today" provides sufficient context for sighted users; since the div is purely decorative in the legend context (the actual today cell has a full `aria-label`), this is acceptable. An `aria-hidden="true"` on the legend ring div would make the intent explicit.

---

## What Works Well

1. **Design token usage is exemplary.** The five heatmap levels (`--heatmap-empty` through `--heatmap-level-4`) are correctly defined in `theme.css` using `color-mix(in oklab, ...)` for both light and dark mode. Zero hardcoded hex colors appear in the component. The green progression reads naturally as an intensity scale.

2. **Dark mode is polished.** The heatmap at dark mode (screenshot `s13-dark-heatmap.png`) transitions cleanly — the empty cells use the dark-mode `--muted` token for the baseline, and the active cells maintain their green identity without appearing garish. The "Today" ring uses `--brand` which adapts correctly to the dark blue-purple in dark mode.

3. **Accessibility architecture is thoughtful.** The grid has a meaningful `role="group"` with a full `aria-label` summarizing active days. Every individual cell has `role="img"` and a descriptive `aria-label` ("Fri, Dec 6: 45 min studied"). All decorative elements (month labels, day labels, padding cells) are correctly `aria-hidden`. The `tabIndex={0}` on cells enables keyboard navigation, and Radix Tooltip natively opens on focus — so keyboard users can navigate to any cell and receive the tooltip.

4. **"View as table" toggle is a genuine accessibility win.** The monthly summary table is well-structured with proper `<thead>/<tbody>`, left-aligned text column, right-aligned numeric columns, `tabular-nums` for alignment, and the table's own `aria-label`. On mobile, the table view renders perfectly (scroll width fits within 375px), making it the ideal fallback for small screens.

5. **`motion-safe:` prefix is applied to all animations.** Cell hover scale and shadow transitions are wrapped in `motion-safe:` Tailwind modifiers, meaning users with `prefers-reduced-motion: reduce` see no animation. This is correct behavior per the design principles.

6. **Loading skeleton is semantically correct.** The skeleton uses `aria-busy="true"` and `aria-label="Loading activity heatmap"`, giving screen readers a meaningful announcement during the async data fetch.

7. **Heading hierarchy is clean.** The page maintains a proper H1 → H2 → H3 hierarchy: "Reports" (H1), "Study Analytics" (H2, sr-only), and all card titles as H3. The heatmap card's "365-Day Study Activity" fits correctly at H3 level.

---

## Detailed Findings Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | BLOCKER | `ActivityHeatmap.tsx:245` | Tooltip secondary text: 2.99:1 contrast (WCAG AA requires 4.5:1) |
| 2 | HIGH | `ActivityHeatmap.tsx:174–178` | Mobile cells collapse to 8×8px — grid near-invisible at 375px |
| 3 | HIGH | `ActivityHeatmap.tsx:118–127` | `aria-pressed` + changing button text creates redundant screen reader announcements |
| 4 | MEDIUM | `ActivityHeatmap.tsx:175–178` | Inline `style=` for grid template (justified but needs lint suppression comment) |
| 5 | MEDIUM | `ActivityHeatmap.tsx:188` | Month labels 10px font — acceptable desktop, unreadable at mobile scale |
| 6 | MEDIUM | `Reports.tsx` (pre-existing) | Recharts console warnings on page load |
| 7 | NITPICK | `ActivityHeatmap.tsx:112–117` | No date range label to orient the learner |
| 8 | NITPICK | `ActivityHeatmap.tsx:260–276` | Legend "Less/More" flex-wrap edge case |
| 9 | NITPICK | `ActivityHeatmap.tsx:277–279` | Legend "Today" ring div missing `aria-hidden="true"` |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 (normal text) | Partial Fail | Muted text in tooltip: 2.99:1. All other text passes (muted on white: 5.57:1, muted on warm bg: 5.14:1) |
| Text contrast ≥ 3:1 (large text) | Pass | No large text at risk |
| Keyboard navigation | Pass | `tabIndex={0}` on all cells; tab traversal reaches cells correctly; Radix Tooltip opens on focus |
| Focus indicators visible | Pass | Global `*:focus-visible` outline applied; cells have `focus-visible:outline-2 focus-visible:outline-ring` |
| Heading hierarchy | Pass | H1 → H2 (sr-only) → H3; no skipped levels |
| ARIA labels on interactive elements | Pass | Toggle button has text label; grid has `aria-label`; cells have descriptive `aria-label` |
| Semantic HTML | Pass | Grid uses `role="group"`, cells use `role="img"`, table uses semantic `<table>/<thead>/<tbody>` |
| Form labels associated | N/A | No form inputs in this component |
| `prefers-reduced-motion` | Pass | All animations use `motion-safe:` prefix |
| Color not sole information indicator | Pass | Tooltips provide text; table view provides full text alternative |
| Screen reader summary | Pass | Grid `aria-label` announces active day count; individual cells readable |
| `aria-busy` on loading state | Pass | Skeleton uses `aria-busy="true"` and `aria-label` |
| `aria-pressed` on toggle | Partial | Toggle correctly uses `aria-pressed` but combined with changing button text creates redundant announcements |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Desktop (1440px) | Pass | Grid renders correctly across full year (53 weeks), month labels spaced appropriately, today ring indicator visible, legend legible |
| Tablet (768px) | Pass | Grid scrolls horizontally within its container, no page-level overflow, layout adapts cleanly |
| Mobile (375px) | Partial Fail | No page-level horizontal overflow (correct), but cells collapse to 8×8px rendering grid near-invisible. "View as table" works perfectly and is the practical solution. |

---

## Recommendations

1. **Fix the tooltip contrast (BLOCKER-1) immediately.** Change `text-muted-foreground` on line 245 of `ActivityHeatmap.tsx` to use a lighter text color appropriate for the dark tooltip background. This is a one-line change.

2. **Address mobile legibility (HIGH-1) with the table-default approach.** The "View as table" fallback already exists and works perfectly on mobile. The simplest fix is to default `showTable` to `true` when the viewport is mobile, using a `useMediaQuery` hook or an `sm:` breakpoint-driven initial state. This also gives mobile users immediately actionable data rather than a decorative graphic.

3. **Resolve the `aria-pressed` redundancy (HIGH-2).** Remove `aria-pressed` and rely on the button's changing text ("View as table" / "View as grid") to communicate state. This is the more natural pattern when button text already conveys the toggle state.

4. **Add the lint suppression comment for the inline style (MEDIUM-1).** A one-line comment prevents future developers from misidentifying this intentional exception as a violation.

---

*Screenshots captured during review are stored at `/tmp/s1-*.png` through `/tmp/s20-*.png` (ephemeral, not committed).*
