---
story_id: E99-S02
story_name: "Grid Column Control"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 99.2: Grid Column Control

## Story

As a learner with a large monitor (or, conversely, a smaller laptop),
I want to control how many course columns are shown in grid view,
so that I can trade card size for density based on my screen and how many courses I have.

## Acceptance Criteria

**Given** the Courses page is in Grid view (`courseViewMode === 'grid'`)
**When** I open the view-mode toggle area
**Then** a column-count selector is visible (segmented control or icon-button row)
**And** options include: Auto (default), 2, 3, 4, 5 columns
**And** the active option is visually indicated

**Given** I select "3 columns"
**When** the selection is applied
**Then** `useEngagementPrefsStore.courseGridColumns` updates to `3`
**And** the grid container uses exactly `grid-cols-3` at `lg` breakpoint and above
**And** lower breakpoints still respect responsive minimums (2 on `sm`, 1 on mobile)

**Given** I select "Auto" (the default)
**When** the grid renders
**Then** the existing responsive pattern applies: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`

**Given** `courseViewMode === 'list'` or `'compact'`
**When** I view the header controls
**Then** the column-count selector is hidden (grid-only control)

**Given** I set columns to 5 and reload
**When** the page renders
**Then** 5 columns is restored from persisted state (via AppSettings bridge)

**Given** I'm on a mobile viewport (< 640px)
**When** I view the grid
**Then** column count is always 1 regardless of the persisted preference
**And** the selector remains visible but is labeled "Applies on larger screens"

## Tasks / Subtasks

- [ ] Task 1: Extend `useEngagementPrefsStore` with `courseGridColumns` (AC: 2, 5)
  - [ ] 1.1 Add `courseGridColumns: 'auto' | 2 | 3 | 4 | 5` (default `'auto'`)
  - [ ] 1.2 Setter + AppSettings bridge + Supabase sync (mirror S01 pattern)
  - [ ] 1.3 Rehydration sanitiser — coerce invalid values to `'auto'`

- [ ] Task 2: Extend `<ViewModeToggle />` OR create `<GridColumnControl />` (AC: 1, 4)
  - [ ] 2.1 Recommended: separate `GridColumnControl` component so it can be hidden/shown based on `courseViewMode`
  - [ ] 2.2 Render only when `courseViewMode === 'grid'`
  - [ ] 2.3 Use shadcn `ToggleGroup` or small icon buttons with number labels (2, 3, 4, 5, Auto)
  - [ ] 2.4 Accessible labels: "Auto columns", "2 columns", "3 columns", "4 columns", "5 columns"
  - [ ] 2.5 44×44px minimum touch targets

- [ ] Task 3: Build grid className resolver helper (AC: 2, 3, 6)
  - [ ] 3.1 Create `src/app/components/courses/gridClassName.ts`
  - [ ] 3.2 Export `getGridClassName(columns: CourseGridColumns): string`
  - [ ] 3.3 `auto` → `'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'`
  - [ ] 3.4 `2` → `'grid grid-cols-1 sm:grid-cols-2 gap-[var(--content-gap)]'`
  - [ ] 3.5 `3` → `'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--content-gap)]'`
  - [ ] 3.6 `4` → `'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[var(--content-gap)]'`
  - [ ] 3.7 `5` → `'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'`
  - [ ] 3.8 Unit test this helper — pure function, easy to cover

- [ ] Task 4: Wire into `Courses.tsx` (AC: 2, 3)
  - [ ] 4.1 Replace hardcoded `gridClassName` string at `Courses.tsx` line ~277 with `getGridClassName(courseGridColumns)`
  - [ ] 4.2 Add `<GridColumnControl />` adjacent to `<ViewModeToggle />` in the header row
  - [ ] 4.3 Conditionally render based on `courseViewMode === 'grid'`

- [ ] Task 5: Tests
  - [ ] 5.1 Unit: `gridClassName.test.ts` covers all 5 branches
  - [ ] 5.2 Unit: `GridColumnControl.test.tsx` — rendering, selected state, onChange
  - [ ] 5.3 E2E `tests/e2e/e99-s02-grid-columns.spec.ts`: select 3 columns, assert class has `lg:grid-cols-3`, reload, assert persistence

## Dev Notes

### Why a resolver helper?

Tailwind v4 scans source for class literals. Dynamic class construction like `` `grid-cols-${n}` `` fails JIT detection. Returning complete string literals per branch guarantees Tailwind includes all classes in the bundle.

**Confirm `@source` directive** in `src/styles/tailwind.css` includes all files that use these classes — if the resolver is in a new file, it must be covered.

### Key Constraints

- **Do NOT build a slider / input-number UI** — segmented control is faster, more accessible, and avoids screen-size mismatch (slider at 3.7 columns is meaningless).
- **Do NOT forget the `auto` branch** — it's the default and most users will stay there.
- **Mobile always collapses to 1 column** — don't try to honor 3-column at 320px; that's broken.
- **Hide the control when not in grid mode** — seeing "3 columns" while in List view is confusing.
- **The gap token `var(--content-gap)` is already in use** — keep it; it's the project's standard spacing.

### Files to modify

- `src/stores/useEngagementPrefsStore.ts` — add `courseGridColumns`
- `src/app/components/courses/GridColumnControl.tsx` — new
- `src/app/components/courses/gridClassName.ts` — new helper
- `src/app/pages/Courses.tsx` — wire in
- AppSettings type — extend

### Dependencies

- Blocks nothing
- **Blocked by E99-S01** — needs `courseViewMode` to exist in the store

## Design Guidance

- **Placement**: Immediately to the right of the view-mode toggle when in grid mode
- **Visual**: Small number buttons `[Auto][2][3][4][5]` with selected state
- **Mobile**: Stack below the view-mode toggle or hide entirely — narrow screens can't honor column count anyway

## Pre-Review Checklist

- [ ] All changes committed
- [ ] Tailwind classes verified present in production bundle (run `npm run build` and grep `dist/assets/*.css`)
- [ ] Grid column control hidden when not in grid mode
- [ ] Touch targets 44×44px
- [ ] Design tokens only
- [ ] E2E asserts persistence + Tailwind class present in DOM
- [ ] Default `'auto'` preserves current responsive behavior exactly

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document]
