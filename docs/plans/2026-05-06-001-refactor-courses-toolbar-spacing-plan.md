---
title: "refactor: Courses toolbar grouping + spacing polish"
type: refactor
status: active
date: 2026-05-06
---

# refactor: Courses toolbar grouping + spacing polish

## Summary

Polish the Courses page control bar so Filter/Sort/View are clearly grouped, the Grid/List/Compact toggle reads as a true segmented control (consistent sizing + icon/label spacing), the grid column control is visibly separated, and accessibility basics (touch targets, focus visibility, contrast) are preserved.

---

## Problem Frame

The Courses toolbar currently reads like a single continuous strip of controls, which makes the “Compact” option feel link-like and makes the relationship between view mode and “Auto / 2 / 3 / 4 / 5” ambiguous. This plan tightens grouping, spacing rhythm, and control consistency so the toolbar is easier to scan and safer to interact with.

---

## Requirements

- R1. **Clear grouping**: Filter, Sort, and View sections read as distinct groups with stable wrap behavior on small screens.
- R2. **Segmented control consistency**: View mode segments (Grid/List/Compact) share equal height and horizontal padding, consistent selected state treatment, and consistent icon/label spacing.
- R3. **Separation of concerns**: Grid column control (“Auto/2/3/4/5”) is visually separated from view mode so “Compact” does not read like trailing text.
- R4. **Accessibility preserved/improved**: 44px minimum target sizes, focus-visible rings, and acceptable contrast for active/inactive states; keyboard navigation remains intact.
- R5. **Chip spacing sanity**: Status filter chips have consistent gaps and predictable wrapping; “Clear” affordance remains aligned and legible.

---

## Scope Boundaries

- No behavior changes to filtering, sorting, view-mode logic, or grid column logic.
- No changes to course cards, list rows, compact cards, or virtualization layout beyond toolbar control styling/layout.
- No global design-system changes; scope is limited to the Courses toolbar components and their immediate primitives usage.

### Deferred to Follow-Up Work

- Rename or relabel “Auto” if product wants explicit semantics (copy decision), separate from spacing/layout work.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/pages/Courses.tsx` — owns the toolbar layout and how sections are composed (Filter / Sort / View).
- `src/app/components/courses/ControlBarSection.tsx` — labeled group wrapper + optional divider.
- `src/app/components/courses/ViewModeToggle.tsx` — view-mode segmented control (ToggleGroup) with touch-target and focus-visible patterns.
- `src/app/components/courses/GridColumnControl.tsx` — grid columns ToggleGroup (“Auto/2/3/4/5”) with mobile hint.
- `src/app/components/figma/StatusFilter.tsx` — filter chips built with ToggleGroup; main source for “chip spacing” adjustments.
- `src/app/components/ui/toggle-group.tsx`, `src/app/components/ui/separator.tsx` — primitives that set baseline behavior.

### Design/A11y conventions already in-use

- Touch targets: `min-h-11 min-w-11` (44px) used in `ViewModeToggle` and `GridColumnControl`; Sort trigger uses `min-h-[44px]`.
- Focus visibility: `focus-visible:ring-*` used on toggle items; should remain consistent across chips and segmented controls.
- Tokens: use existing semantic utilities (`bg-brand`, `text-muted-foreground`, `ring-brand/30`, etc.) rather than hardcoded colors.

### Institutional Learnings (apply during implementation)

- `docs/solutions/best-practices/wcag-target-size-audit-2026-04-25.md`
  - If you add any spacing/target-size assertions, exclude hidden/sr-only and inline-prose links to keep audits actionable.
  - For “chip spacing” checks, prefer axis-aligned (L∞) gap between rects (matches how UI reads spacing in rows).
- `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md`
  - Avoid mutating decorative ring tokens; keep focus-visible styling additive and token-driven.
- `docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md`
  - Be careful with `ring-offset-*` in tight toolbars; it can expand boxes and create subtle overflow/scrollbars.
- `docs/reviews/audit/design-review-legal-2026-03-26.md`
  - If something visually looks like a link/control, ensure keyboard focus gets an equivalent affordance (ring/underline); never suppress outlines without replacement.

---

## Key Technical Decisions

- **KTD1 — Keep component boundaries**: implement the grouping + spacing polish by adjusting `Courses.tsx` composition and tightening classes within `ControlBarSection`, `ViewModeToggle`, `GridColumnControl`, and `StatusFilter` rather than introducing a new toolbar abstraction.
- **KTD2 — Treat view mode and grid columns as separate subgroups inside “View”**: preserve the single `ControlBarSection label="View"` but add explicit separation (gutter and/or divider) between the two controls so they no longer read as a single long segmented control.
- **KTD3 — Make “segmented” semantics visual, not behavioral**: do not change Radix roles/keyboard behavior; only normalize sizing, padding, and typography so all segments look equally clickable.

---

## Open Questions

### Resolved During Planning

- Should we treat “Auto/2/3/4/5” as pagination? **No** — it is `GridColumnControl` and should be visually separated from view mode.

### Deferred to Implementation

- Exact spacing tokens (e.g. `gap-2` vs `gap-3`, `px-3` vs `px-4`) should be decided by eyeballing the toolbar at 3 breakpoints (mobile / tablet / desktop) to avoid overfitting the plan to one screenshot.

---

## Implementation Units

- U1. **Refine toolbar grouping and wrap behavior in `Courses.tsx`**

**Goal:** Make Filter/Sort/View sections scanable, with consistent spacing and predictable wrapping.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/Courses.tsx`
- Test: `src/app/pages/__tests__/Courses.test.tsx` (light structural assertions only)

**Approach:**
- Keep the top-level row as `flex flex-wrap`, but ensure each `ControlBarSection` stays internally cohesive (label + content) and that section-to-section spacing remains consistent when wrapped.
- Ensure the “View” section’s internal layout is stable: `ViewModeToggle` and `GridColumnControl` should remain aligned vertically and not collapse into link-like text at wrap boundaries.

**Patterns to follow:**
- Existing `ControlBarSection` usage in `Courses.tsx`.

**Test scenarios:**
- Happy path — toolbar renders Filter/Sort/View labeled sections when courses exist.
- Edge case — when status filter is absent (no imported courses), Sort/View sections still render and layout doesn’t break.

**Verification:**
- At mobile width, controls wrap without labels detaching from their control cluster; at desktop width, controls appear in one row with stable gaps.

---

- U2. **Make `ViewModeToggle` a visually consistent segmented control**

**Goal:** Normalize segment height, padding, icon sizing, and icon↔label spacing across Grid/List/Compact.

**Requirements:** R2, R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/courses/ViewModeToggle.tsx`
- Test: `src/app/components/courses/__tests__/ViewModeToggle.test.tsx`

**Approach:**
- Ensure every `ToggleGroupItem` uses the same layout primitives:
  - `inline-flex items-center justify-center`
  - consistent `px-*` across segments
  - consistent `gap-2` (≈8px) between icon and label
- Standardize icon size (keep at `size-4` unless design requires `size-[18px]`; pick one and apply to all).
- Keep selected treatment consistent and sufficiently high-contrast using existing tokens; do not mix “filled” for one segment and “plain text” for others.

**Patterns to follow:**
- Existing `min-h-11 min-w-11` and `data-[state=on]` styling patterns already present in this file.

**Test scenarios:**
- Happy path — still renders three radio items with accessible labels.
- Regression — each item still includes `min-h-11` and `min-w-11`.
- Regression — the icon element is present for each item and shares the same size class.
- Regression — items include layout classes that ensure vertical centering (`items-center`) and consistent gap (`gap-2`).

**Verification:**
- “Compact” visually reads as a third equal segment (not trailing link text) at desktop widths.

---

- U3. **Add explicit separation between view mode and grid columns**

**Goal:** Prevent the view-mode control and grid-columns control from reading as one continuous segmented strip.

**Requirements:** R3, R4

**Dependencies:** U2 (best done after view-mode normalization)

**Files:**
- Modify: `src/app/pages/Courses.tsx`
- Modify (optional): `src/app/components/courses/GridColumnControl.tsx` (only if needed to align heights/padding)
- Test: `tests/e2e/e99-s02-grid-columns.spec.ts` (small extension) or `tests/e2e/accessibility-courses.spec.ts`

**Approach:**
- Within the “View” section wrapper, insert a clear gutter and/or a vertical separator between `ViewModeToggle` and `GridColumnControl`.
- Ensure the separator does not reduce touch targets or create awkward focus rings (separator should be non-focusable).
- Keep mobile hint (“Applies on larger screens”) intact.

**Patterns to follow:**
- `ControlBarSection` divider pattern (`Separator orientation="vertical"`).

**Test scenarios:**
- Happy path — in grid view, grid columns control is still present and operable.
- A11y regression — tabbing moves between view-mode radios and grid-column radios in a predictable order; focus ring is visible on both groups.

**Verification:**
- Users no longer perceive “Compact Auto” as one combined label; the controls read as two separate clusters.

---

- U4. **Tighten `StatusFilter` chip spacing and interaction affordance**

**Goal:** Ensure chips wrap cleanly with consistent gaps, and “Clear” aligns with the chips without looking detached.

**Requirements:** R5, R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/StatusFilter.tsx`
- Test expectation: none — rely on existing page tests + manual verification (this is primarily spacing/styling).

**Approach:**
- Remove any redundant wrapper gaps (currently both the container div and ToggleGroup include `gap-2`); ensure the spacing source of truth is one place.
- Ensure chip internal layout is consistent (`inline-flex items-center gap-1` or `gap-1.5`) and that icon size/vertical alignment doesn’t pull text off baseline.
- Ensure “Clear” remains a clear affordance but does not read like part of the chip row (small left margin + baseline alignment).

**Patterns to follow:**
- Existing chip/pill styles in `Courses.tsx` filter-summary chip.

**Test scenarios:**
- Test expectation: none — styling-only change.

**Verification:**
- At narrow widths, chips wrap with even gaps; “Clear” stays aligned and does not overlap/wrap awkwardly.

---

## System-Wide Impact

- **Interaction graph:** No logic changes; only layout/styling for toolbar components.
- **Error propagation:** None.
- **State lifecycle risks:** None.
- **API surface parity:** Maintains existing Radix ToggleGroup semantics and store persistence.
- **Integration coverage:** Existing E2E accessibility scan for `/courses` should catch focus/role regressions.
- **Unchanged invariants:** View-mode and grid-columns persistence behavior remains unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Spacing tweaks accidentally reduce touch targets | Keep `min-h-11 min-w-11` assertions in unit tests; spot-check in browser |
| Contrast regressions in selected states | Stick to semantic tokens already used (`bg-brand`, `text-brand-foreground`, etc.); keep existing `data-[state=on]` patterns |
| Grouping changes break wrap layout on small screens | Verify at mobile/tablet/desktop breakpoints; keep wrap predictable by grouping within sections |

---

## Sources & References

- Related components: `src/app/pages/Courses.tsx`, `src/app/components/courses/ViewModeToggle.tsx`, `src/app/components/courses/GridColumnControl.tsx`, `src/app/components/courses/ControlBarSection.tsx`, `src/app/components/figma/StatusFilter.tsx`
- Existing tests: `src/app/components/courses/__tests__/ViewModeToggle.test.tsx`, `src/app/pages/__tests__/Courses.test.tsx`, `tests/e2e/accessibility-courses.spec.ts`

