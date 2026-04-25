# E99-S02 — Grid Column Control: Requirements

**Story:** E99-S02
**Date:** 2026-04-25
**Source story file:** `docs/implementation-artifacts/stories/E99-S02-grid-column-control.md`

## Title

Grid Column Control for Courses Page

## Problem / User value

Learners on large monitors want denser course grids; learners on smaller laptops want larger cards. Today, the Courses page hardcodes a responsive grid (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`). Users cannot trade card size for density. Add a grid-only column-count selector so learners can pick Auto / 2 / 3 / 4 / 5 columns.

## Acceptance Criteria (verbatim from story)

1. **AC1 — Selector visible in grid mode**
   - Given Courses page in Grid view (`courseViewMode === 'grid'`)
   - Then a column-count selector with options `Auto, 2, 3, 4, 5` is visible
   - Active option visually indicated.

2. **AC2 — Selecting "3 columns" applies grid-cols-3 at lg+**
   - Selecting 3 updates `useEngagementPrefsStore.courseGridColumns` to `3`
   - Grid container uses `grid-cols-3` at `lg` and above
   - Lower breakpoints respect responsive minimums (2 on `sm`, 1 on mobile).

3. **AC3 — Auto preserves current responsive default**
   - With `courseGridColumns === 'auto'`, grid uses `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`.

4. **AC4 — Hidden in list/compact**
   - When `courseViewMode === 'list' | 'compact'`, the column selector is hidden.

5. **AC5 — Persistence**
   - Setting columns to 5 and reloading restores 5 (via AppSettings bridge / Supabase sync).

6. **AC6 — Mobile collapses to 1 column**
   - On viewports < 640px, grid is 1 column regardless of preference
   - Selector remains visible with hint "Applies on larger screens".

## Implementation guidance (from Dev Notes)

- Add `courseGridColumns: 'auto' | 2 | 3 | 4 | 5` (default `'auto'`) to `useEngagementPrefsStore`, with setter, AppSettings bridge, Supabase sync mirroring S01 (`courseViewMode`).
- Sanitiser on rehydration coerces invalid → `'auto'`.
- New helper `src/app/components/courses/gridClassName.ts` exporting `getGridClassName(columns)` returning **complete string literals per branch** (Tailwind v4 JIT requires literals; dynamic concatenation breaks the bundle).
  - `auto` → `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]`
  - `2` → `grid grid-cols-1 sm:grid-cols-2 gap-[var(--content-gap)]`
  - `3` → `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--content-gap)]`
  - `4` → `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[var(--content-gap)]`
  - `5` → `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]`
- New `src/app/components/courses/GridColumnControl.tsx` — separate from `<ViewModeToggle />` so visibility is conditional. Use shadcn `ToggleGroup` (single-select) with number/`Auto` labels. Accessible labels per option. 44×44px min touch targets.
- Wire into `src/app/pages/Courses.tsx` line ~277: replace hardcoded `gridClassName` literal with `getGridClassName(courseGridColumns)`. Render `<GridColumnControl />` adjacent to `<ViewModeToggle />` only when `courseViewMode === 'grid'`.
- Confirm `@source` directive in `src/styles/tailwind.css` covers the new files.

## Tests

- Unit: `gridClassName.test.ts` — all 5 branches return correct literal.
- Unit: `GridColumnControl.test.tsx` — render, selected state, onChange triggers store setter.
- E2E: `tests/e2e/e99-s02-grid-columns.spec.ts` — select 3 columns, assert DOM has `lg:grid-cols-3`, reload, assert persistence.

## Out of scope

- Slider / number-input UI (explicitly rejected — segmented control only).
- Column control on List or Compact views.
- Per-page column preferences (single global pref).
- Changing the default responsive behavior for `auto`.

## Dependencies

- **Blocked by E99-S01** (`courseViewMode` must already exist in store). S01 is complete on main.

## Constraints

- Tailwind v4: only string literals, no dynamic class construction.
- Mobile (< 640px) always 1 column.
- Use `var(--content-gap)` token (project standard).
- Design tokens only (ESLint enforced).
- WCAG AA, 44×44px touch targets.

## Definition of done

- All 6 ACs pass.
- Unit + E2E tests green.
- `npm run build`, `npm run lint`, `npx tsc --noEmit` all clean.
- Tailwind classes confirmed present in `dist/assets/*.css`.
- Pre-Review Checklist items in story all checked.
