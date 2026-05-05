---
title: "refactor: Courses page control bar and card UX improvements"
type: refactor
status: active
date: 2026-05-05
---

# refactor: Courses page control bar and card UX improvements

## Overview

Redesign the Courses page control bar from an undifferentiated row of mixed-purpose widgets into a clearly grouped, labeled toolbar. Improve card scan hierarchy and metadata density per view mode. Fix contrast and interaction-state issues that reduce readability and perceived quality on the dark UI. Clarify the page's semantic scope ("All Courses" vs "Imported Courses").

## Problem Frame

The Courses page has accumulated controls organically across E99-S01 through S04 (view mode toggle, grid column selector, status filter, sort dropdown). These controls now sit in one undifferentiated `flex-wrap` row with no visual grouping or labels. Users must parse a heterogeneous stripe of status pills, a sort dropdown, a view toggle, and a column selector — all at the same visual weight — before they can act. The filter bar's own `mb-6` margin and its "Status:" label sit outside the parent row, creating visual noise.

Card metadata differentiation between view modes exists but lacks intentionality: compact cards already show a thumbnail+title layout but still retain secondary metadata (file size, tag counts) that adds noise at small sizes. Grid cards show full metadata rows but feel cramped — progress bars, difficulty badges, and file size all compete in a tight wrap row. List rows present metadata inline but in an order better optimized for left-to-right scanability. The differentiation should be sharper: compact should strip everything non-essential, grid should surface richer metadata with room to breathe, and list should reorder for scanability. Secondary text has low contrast against the dark background. The page title says "All Courses" but the only section says "Imported Courses", creating silent confusion about scope.

## Requirements Trace

- R1. Control bar separates into labeled groups: Filters, Sort, View, with clear spacing/dividers
- R2. View toggle appears as a cohesive segmented control with strong active state
- R3. Grid column selector is visually subordinate to view toggle and appears only in grid mode
- R4. Card metadata differentiates intentionally per view mode: compact cards show only thumbnail, title, and progress overlay (hiding secondary metadata); grid cards surface full metadata (progress bar, tag counts, difficulty, file size) with high contrast and full-width layout; list rows present inline metadata in scannable order (title first, metadata inline, progress at end)
- R5. Secondary metadata meets WCAG AA contrast on dark backgrounds
- R6. Cards have clear hover/focus states with visible affordance
- R7. Page heading accurately reflects content scope

## Scope Boundaries

- No new filter types (search, date range, etc.) — purely grouping/labeling existing controls
- No new view modes — only improving existing grid/list/compact
- No data model or store changes
- No backend or API changes
- No changes to the course detail pages
- No virtualization changes (E99-S05 stays separate)

### Deferred to Separate Tasks

- Empty state for filtered results: already handled in `Courses.tsx` lines 286-289
- Loading skeletons per view mode: minor polish, not blocking
- Drag-and-drop reordering: out of scope for this refactor

## Context & Research

### Relevant Code and Patterns

- `src/app/pages/Courses.tsx` lines 228-261 — the control bar container (`flex flex-wrap gap-x-6 gap-y-2 items-start`) and its four children
- `src/app/components/figma/StatusFilter.tsx` — includes its own `mb-6` margin and "Status:" label; currently lives outside the shared row layout
- `src/app/components/courses/ViewModeToggle.tsx` — uses `ToggleGroup` with `variant="outline"`, brand-soft active state
- `src/app/components/courses/GridColumnControl.tsx` — separate `ToggleGroup` with mobile hint text
- `src/app/components/figma/ImportedCourseCard.tsx` — 802-line grid card with full metadata
- `src/app/components/figma/ImportedCourseCompactCard.tsx` — thumbnail+title only, already well-scoped
- `src/app/components/figma/ImportedCourseListRow.tsx` — list row with inline metadata
- `src/styles/theme.css` — design tokens for spacing, colors, and brand variants
- `src/app/components/ui/toggle-group.tsx` — base shadcn component

### Institutional Learnings

- The project uses design tokens exclusively — `bg-brand-soft`, `text-muted-foreground`, etc. (see `.claude/rules/styling.md`)
- Tailwind v4 requires string literals for class names; no dynamic concatenation
- Minimum touch target is 44×44px per WCAG 2.5.8 (enforced in E66)

## Key Technical Decisions

- **Decision: Use `Separator` + section labels for grouping** — Adding a vertical divider and small-label text ("Filter", "Sort", "View") is the lightest-touch approach that creates clear visual hierarchy without introducing new components. Alternative was a tabbed toolbar — rejected as over-engineering for four controls.
- **Decision: Move StatusFilter's "Status:" label into the parent bar** — The label currently sits inside `StatusFilter.tsx` with its own `mb-6`. Moving it to a consistent group-label pattern simplifies the layout and eliminates the margin conflict.
- **Decision: Use CSS `gap` + `flex` for alignment rather than a grid** — The toolbar has variable-width children; flex with gap handles responsive wrapping naturally.
- **Decision: Rename section heading from "Imported Courses" to "Your Courses"** — Avoids the "All Courses" vs "Imported Courses" mismatch while remaining accurate for the current single-source reality. Does not break any external references.

## Open Questions

### Resolved During Planning

- **Should we extract a shared `ControlBarSection` component?** Yes — it's a small wrapper (label + children + optional divider) that ensures consistent spacing and typography across the three groups. Single-file component.

### Deferred to Implementation

- **Exact spacing tokens for inter-group gaps** — Use `gap-6` as starting point; adjust visually during implementation.
- **Whether compact card title should increase from `text-xs` to `text-sm` on hover** — Minor polish; defer to visual testing.

## Implementation Units

- [ ] **Unit 1: Create `ControlBarSection` wrapper component**

**Goal:** Extract a reusable section wrapper with label, divider, and consistent spacing for toolbar groups.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `src/app/components/courses/ControlBarSection.tsx`
- Test: `src/app/components/courses/__tests__/ControlBarSection.test.tsx`

**Approach:**
- Small functional component: accepts `label`, optional `showDivider` (default true), `children`, `className`
- Renders a `<div>` with the section label as a small `text-xs text-muted-foreground uppercase tracking-wider` heading, then children below
- First section omits the left divider; subsequent sections render a `Separator orientation="vertical"` before the label
- Uses `flex items-center gap-3` for label + content alignment

**Patterns to follow:**
- `src/app/components/courses/ViewModeToggle.tsx` — component structure and prop typing conventions

**Test scenarios:**
- Happy path: renders label text and children
- `showDivider={false}`: no vertical separator rendered
- Default `showDivider={true}`: vertical separator rendered

**Verification:**
- Component renders with label and children in isolation
- No hardcoded colors (ESLint passes)

---

- [ ] **Unit 2: Restructure Courses.tsx control bar with grouped sections**

**Goal:** Replace the flat `flex-wrap` control row with three labeled groups (Filter, Sort, View) using `ControlBarSection`.

**Requirements:** R1, R3, R7

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/pages/Courses.tsx` (lines 228-261 — the control bar container)
- Modify: `src/app/components/figma/StatusFilter.tsx` (remove `mb-6`, remove "Status:" label — now handled by parent)

**Approach:**
- Wrap the control bar in a `<div className="flex flex-wrap items-center gap-6">` (replacing current `gap-x-6 gap-y-2`)
- Group 1 (Filter): `ControlBarSection label="Filter" showDivider={false}` containing `StatusFilter` (now without its own margin/label)
- Group 2 (Sort): `ControlBarSection label="Sort"` containing the existing `Select` dropdown
- Group 3 (View): `ControlBarSection label="View"` containing `ViewModeToggle` and (conditionally) `GridColumnControl` side by side
- Remove the `mb-6` from `StatusFilter.tsx` line 49 and the "Status:" span on line 50
- Change the section heading on Courses.tsx line 265 from "Imported Courses" to "Your Courses"

**Patterns to follow:**
- Current `Courses.tsx` control bar layout — preserve existing component wiring

**Test scenarios:**
- Happy path: three groups render with labels "Filter", "Sort", "View"
- Status filter label removed from StatusFilter: no duplicate "Status:" text
- Grid column control hidden when view mode is list or compact
- Page heading says "Your Courses" instead of "Imported Courses"
- Responsive: controls wrap on narrow viewports

**Verification:**
- Control bar renders three visually separated groups
- No duplicate "Status:" labels
- `npm run build` and lint pass

---

- [ ] **Unit 3: Strengthen ViewModeToggle active state and focus ring**

**Goal:** Increase the visual contrast of the selected view mode so it's instantly distinguishable at a glance.

**Requirements:** R2, R5

**Dependencies:** None (parallel with Unit 1)

**Files:**
- Modify: `src/app/components/courses/ViewModeToggle.tsx` (active state classes)

**Approach:**
- Enhance the active segment: `data-[state=on]:bg-brand data-[state=on]:text-brand-foreground` instead of `data-[state=on]:bg-brand-soft data-[state=on]:text-brand-soft-foreground`
- Add a subtle ring or stronger border: `data-[state=on]:ring-1 data-[state=on]:ring-brand/30`
- Ensure focus-visible ring is prominent: `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1`
- Keep `motion-safe:transition-colors` for smooth transitions

**Patterns to follow:**
- `src/app/components/courses/ViewModeToggle.tsx` — current structure
- `src/app/components/figma/StatusFilter.tsx` — pill-style active states as reference

**Test scenarios:**
- Happy path: selected segment has high-contrast brand fill
- Unselected segments are muted (`text-muted-foreground`)
- Focus-visible ring visible on keyboard navigation
- ARIA radiogroup semantics preserved (already handled by Radix ToggleGroup)
- `prefers-reduced-motion`: transitions suppressed

**Verification:**
- Selected state is visually dominant at arm's length
- Keyboard Tab → Arrow keys cycle through options

---

- [ ] **Unit 4: Increase contrast for card metadata text**

**Goal:** Raise secondary text and icon contrast to meet WCAG AA on dark backgrounds.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` (metadata row at line 684)
- Modify: `src/app/components/figma/ImportedCourseListRow.tsx` (metadata at lines 218-233)

**Approach:**
- Verify `text-muted-foreground` contrast ratio against card backgrounds in all themes (light, dark, vibrant, clean) using browser devtools
- If contrast < 4.5:1 in any theme, adjust the `--muted-foreground` token in `theme.css` (single source of truth) rather than per-component overrides
- Only if token-level fix is impractical (e.g., would break other surfaces): use `text-foreground/85` as a per-component fallback with verified 4.5:1 across all themes
- Increase icon stroke weight from `size-3.5` to `size-4` in metadata rows where space allows

**Patterns to follow:**
- Design token system — always prefer adjusting the semantic token over per-component opacity hacks

**Test scenarios:**
- Happy path: metadata text readable against card background at typical viewing distance
- Dark mode: contrast ratio ≥ 4.5:1 for all metadata text (verify with browser devtools)
- Light mode: no regression (tokens handle mode switching)

**Verification:**
- Visual check: metadata is clearly readable without squinting
- No hardcoded colors in diff

---

- [ ] **Unit 5: Add hover elevation to grid and compact cards**

**Goal:** Make cards feel clickable with a clear hover/focus affordance.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` (article element classes)
- Modify: `src/app/components/figma/ImportedCourseCompactCard.tsx` (article element classes)

**Approach:**
- On `ImportedCourseCard`, add `hover:shadow-md hover:scale-[1.01]` to the article wrapper (alongside existing `group` class)
- On `ImportedCourseCompactCard`, add `hover:ring-1 hover:ring-border` for a subtler effect at density
- Both: ensure `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1` is present
- Respect `motion-reduce:transition-none motion-reduce:hover:scale-100` for reduced motion

**Patterns to follow:**
- Card hover patterns in the Library page (if any)
- Existing `focus-visible` patterns already in card components

**Test scenarios:**
- Happy path: hover produces visible elevation/border change
- Focus-visible: keyboard focus shows clear ring
- Reduced motion: hover does not animate transform
- Click still navigates to course detail
- Touch devices (`@media(hover:none)`): no hover effect, card is directly tappable

**Verification:**
- Cards visually respond to hover
- Keyboard focus ring visible
- No layout shift on hover

---

- [ ] **Unit 6: Sharpen metadata density per view mode**

**Goal:** Intentionally differentiate what metadata each view mode shows so the mental model is "more detail as card size increases."

**Requirements:** R4

**Dependencies:** None (can run in parallel with Units 3, 4, 5)

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCompactCard.tsx` (hide secondary metadata)
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` (improve grid metadata layout)
- Modify: `src/app/components/figma/ImportedCourseListRow.tsx` (reorder inline metadata)

**Approach:**
- Compact cards (`ImportedCourseCompactCard.tsx`): verify it already strips secondary metadata (thumbnail + title + progress only). If so, no changes needed for compact. If any residual metadata exists, remove it.
- Grid cards (`ImportedCourseCard.tsx`): improve layout so full metadata set (progress bar, difficulty badges, tag counts, file size, momentum) has room to breathe — use full card width with clear visual hierarchy
- List rows (`ImportedCourseListRow.tsx`): reorder inline metadata for left-to-right scanability — title first, metadata inline, progress at end
- Each card component is already view-mode-specific (Courses.tsx renders the correct component). No `viewMode` conditional needed — modify each component's contents directly based on its role in the density hierarchy

**Test scenarios:**
- Happy path: compact card shows only thumbnail, title, and progress overlay — no file size or tag counts
- Grid card renders full metadata set (progress bar, difficulty, tag counts, file size)
- List row shows metadata in scannable order: title → metadata → progress
- Switching from compact to grid adds metadata; switching back removes it
- No layout shift when metadata sections appear/disappear

**Verification:**
- Each view mode shows the correct metadata subset
- Switching view modes updates card content without errors
- No hardcoded colors (ESLint passes)

---

- [ ] **Unit 7: Add "Clear filters" action to filter bar**

**Goal:** When filters are active, provide a visible escape hatch. Currently the "Clear" link is only inside StatusFilter — surface it prominently when any filter narrows results.

**Requirements:** R1

**Dependencies:** Unit 2

**Files:**
- Modify: `src/app/pages/Courses.tsx` (add filter summary near control bar)
- Modify: `src/app/components/figma/StatusFilter.tsx` (already has Clear button — no change needed)

**Approach:**
- Below the control bar (or inline at the end of the Filter section), when `selectedStatuses.length > 0`, show a small summary chip: "Filtered by: Active, Completed" with a clear-all button
- The existing "Clear" button inside `StatusFilter` remains as a fallback
- Use a subtle `bg-muted/50 rounded-full px-3 py-1 text-xs` chip style

**Test scenarios:**
- Happy path: filter summary appears when statuses are selected
- Clearing all statuses: summary disappears
- Multiple statuses: all listed in the chip
- No filters: no summary shown

**Verification:**
- Filter summary visible when filters active
- Clicking "Clear all" resets to unfiltered view

## System-Wide Impact

- **Interaction graph:** No new callbacks or middleware. Control bar changes are purely presentational — same handlers, same store writes.
- **Error propagation:** Unchanged — filter/sort failures already handled.
- **State lifecycle risks:** None — no new state.
- **API surface parity:** N/A — no API changes.
- **Unchanged invariants:** `useEngagementPrefsStore` shape and persistence remain identical. `StatusFilter` props interface unchanged. Card navigation behavior unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `text-muted-foreground` token value may be theme-dependent | Verify contrast in both light and dark modes before adjusting; prefer token-level fix over per-component overrides |
| Hover effects may cause layout shift in grid | Use `transform: scale` (GPU-composited) rather than padding/margin changes |
| ControlBarSection adds another component to maintain | It's ~30 lines; the abstraction pays for itself by ensuring consistent grouping |
| Renaming "Imported Courses" → "Your Courses" may affect tests | Grep for the heading text in test files and update assertions |

## Documentation / Operational Notes

- Update `Courses.tsx` inline comments to reference the new grouped layout
- If the `StatusFilter` "Status:" label removal affects any E2E tests, update test selectors

## Implementation Notes (Residual from Plan Review)

These notes were surfaced during adversarial plan review and should be tracked during implementation:

- **Medium — Grid card layout (Unit 6):** The plan says "improve layout" without specifying the target arrangement (2-column grid, stacked rows, dedicated columns). Define the concrete layout direction before implementing.
- **Medium — Cross-scheme visual verification (Units 3, 5):** Visual changes to active states and hover effects must be verified in all three color schemes (professional, vibrant, clean), not just the default Professional theme.
- **Low — muted-foreground token blast radius (Unit 4):** `--muted-foreground` is used 1,661 times across 410 files. A token-level fix could cause contrast regressions elsewhere. Use the `text-foreground/85` per-component fallback if token adjustment risk is too high.
- **Low — ControlBarSection divider coupling:** `showDivider={false}` on the first section ties styling to instance ordering. If sections are reordered, the divider logic must be manually relocated.

## Sources & References

- **Screenshots analyzed:** 6 screenshots from 2026-05-05 (control bar, all three view modes, filter close-up, compact mode)
- **Prior art:** E99-S01 (ViewModeToggle), E99-S02 (GridColumnControl), E99-S03 (List view), E99-S04 (Compact view) requirements and plans
- Related code: `src/app/pages/Courses.tsx`
- Related code: `src/app/components/courses/ViewModeToggle.tsx`
- Related code: `src/app/components/figma/StatusFilter.tsx`
