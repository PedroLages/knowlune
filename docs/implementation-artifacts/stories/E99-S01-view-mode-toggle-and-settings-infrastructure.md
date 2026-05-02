---
story_id: E99-S01
story_name: "View Mode Toggle and Settings Infrastructure"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 99.1: View Mode Toggle and Settings Infrastructure

## Story

As a learner browsing my course library,
I want to switch between grid, list, and compact views,
so that I can scan courses in the density that matches my current task.

## Acceptance Criteria

**Given** the Courses page is loaded
**When** I look at the page header (near the sort/filter controls)
**Then** I see a view-mode toggle with three options: Grid, List, Compact
**And** each option has an icon (LayoutGrid, List, LayoutGrid with denser variant) plus accessible label
**And** the currently-active mode is visually indicated (selected state)

**Given** I click the "List" option in the view-mode toggle
**When** the toggle state changes
**Then** `useEngagementPrefsStore.courseViewMode` updates to `'list'`
**And** the grid container swaps to a list renderer (empty in S01 — wired in S03)
**And** the selection persists to localStorage via the AppSettings bridge

**Given** I set the view mode to "Compact" and reload the page
**When** the Courses page renders
**Then** the Compact view is restored from persisted state

**Given** a signed-in user with Supabase sync enabled
**When** `courseViewMode` changes
**Then** the new value is written to Supabase via `saveSettingsToSupabase` (same bridge as `colorScheme`)
**And** appears on other devices after sync

**Given** I am on a mobile viewport (< 640px)
**When** I view the toggle
**Then** all three options remain tappable with 44×44px minimum touch targets
**And** icons-only labels are acceptable (full text may be hidden via `sr-only`)

**Given** the toggle is keyboard-focused
**When** I press ArrowLeft / ArrowRight
**Then** focus moves between options per `role="radiogroup"` semantics
**And** pressing Space / Enter activates the focused option

## Tasks / Subtasks

- [ ] Task 1: Extend `useEngagementPrefsStore` with `courseViewMode` (AC: 2, 3, 4)
  - [ ] 1.1 Add `courseViewMode: 'grid' | 'list' | 'compact'` to the store state (default `'grid'`)
  - [ ] 1.2 Add setter that bridges to `saveSettings({ courseViewMode })` and `saveSettingsToSupabase({ courseViewMode })` — mirror `colorScheme` bridge at `useEngagementPrefsStore.ts` lines ~76-99
  - [ ] 1.3 Add sanitiser in the localStorage rehydration block (reject unknown values, fall back to `'grid'`) — mirror the `colorScheme` `.includes(parsed.colorScheme)` pattern at lines ~46-47
  - [ ] 1.4 Add `courseViewMode` to the reset defaults

- [ ] Task 2: Extend `AppSettings` schema + Supabase sync (AC: 4)
  - [ ] 2.1 Add `courseViewMode?: 'grid' | 'list' | 'compact'` to the `AppSettings` type
  - [ ] 2.2 Verify the Supabase `settings` table column accepts the new field (JSON column — no migration needed if stored in a JSONB column; check `supabase/migrations/` for settings schema)
  - [ ] 2.3 Add Dexie v-bump only if AppSettings is stored in a typed column (likely not — it's a `Record<string, unknown>` blob)

- [ ] Task 3: Create reusable `<ViewModeToggle />` component (AC: 1, 5, 6)
  - [ ] 3.1 Create `src/app/components/courses/ViewModeToggle.tsx`
  - [ ] 3.2 Use shadcn `ToggleGroup` (`role="radiogroup"` under the hood) with three `ToggleGroupItem`s
  - [ ] 3.3 Icons: `LayoutGrid` (grid), `List` (list), `Rows3` or `LayoutGrid` with tighter stroke (compact) — from `lucide-react`
  - [ ] 3.4 Accessible labels: "Grid view", "List view", "Compact view" (via `aria-label`)
  - [ ] 3.5 Props: `value: CourseViewMode`, `onChange: (v: CourseViewMode) => void`
  - [ ] 3.6 Ensure 44×44px minimum touch targets with `min-w-11 min-h-11`
  - [ ] 3.7 Use design tokens only — no hardcoded colors (`bg-muted`, `text-muted-foreground`, `data-[state=on]:bg-brand-soft data-[state=on]:text-brand-soft-foreground`)

- [ ] Task 4: Wire toggle into `Courses.tsx` (AC: 1, 2)
  - [ ] 4.1 Read `courseViewMode` from `useEngagementPrefsStore` at top of `Courses` component
  - [ ] 4.2 Render `<ViewModeToggle />` in the existing header controls row (next to sort/filter — search for the sort `<Select>` around line ~260)
  - [ ] 4.3 Update the existing grid container `gridClassName` to branch on `courseViewMode` — for S01, keep all three branches rendering the current grid (list/compact will be wired in S03/S04)
  - [ ] 4.4 Export `CourseViewMode` type from the store for consumers

- [ ] Task 5: Unit tests
  - [ ] 5.1 `ViewModeToggle.test.tsx`: renders 3 options, selected state reflects prop, onChange fires with correct value
  - [ ] 5.2 `useEngagementPrefsStore.test.ts`: `setCourseViewMode` updates state, persists to localStorage, sanitises invalid values

- [ ] Task 6: E2E test
  - [ ] 6.1 Create `tests/e2e/e99-s01-view-mode-toggle.spec.ts`
  - [ ] 6.2 Navigate to `/courses`, click "List", reload, assert "List" is still selected
  - [ ] 6.3 Assert toggle has 3 options with proper `aria-label`s

## Dev Notes

### Architecture Decision

Persist `courseViewMode` in `useEngagementPrefsStore` (not a new store) because it's a user-level display preference that should sync alongside `colorScheme`, `reducedMotion`, etc. The AppSettings bridge already handles Supabase sync, offline-first writes, and LWW conflict resolution — reuse it.

### Reference Pattern: `libraryView` in `useBookStore`

The book library (`src/app/pages/Library.tsx`) already implements grid/list toggle:

- Store: `src/stores/useBookStore.ts` lines 58, 111, 235 (`libraryView: 'grid' | 'list'`, `setLibraryView`)
- Usage: `src/app/pages/Library.tsx` lines 766-791 (tab-style buttons with `aria-selected`)

**Do NOT copy `useBookStore.libraryView` pattern** — it's a local UI store, not persisted to Supabase. `useEngagementPrefsStore` is the right home for cross-device sync.

### Reference Pattern: `colorScheme` bridge

`src/stores/useEngagementPrefsStore.ts` lines 76-99 already show:
1. Zustand setter → `saveSettings()` (AppSettings / localStorage)
2. Debounced `saveSettingsToSupabase()` for sync
3. Rehydration sanitiser that rejects unknown values

Mirror this exactly for `courseViewMode`.

### Key Constraints

- **Do NOT change the default visual output in S01** — S01 adds infrastructure + toggle. The list and compact *renderers* ship in S03 and S04. Until those ship, all three modes render the current grid.
- **Do NOT break the book library toggle** — `useBookStore.libraryView` is unrelated and stays.
- **Touch targets**: 44×44px minimum (use `min-w-11 min-h-11`) — WCAG 2.2 Target Size criterion.
- **Design tokens only** — never hardcode Tailwind colors (`bg-blue-*`, `text-gray-*`). Use `bg-brand-soft`, `text-muted-foreground`, etc.
- **No optimistic UI before persistence** — update state only after `saveSettings` succeeds (it's synchronous for localStorage — just call the setter).

### Files to modify

- `src/stores/useEngagementPrefsStore.ts` — add `courseViewMode` state, setter, sanitiser
- `src/app/components/courses/ViewModeToggle.tsx` — new file
- `src/app/pages/Courses.tsx` — add toggle to header, read store value
- `src/lib/settings.ts` (or wherever `AppSettings` lives) — extend type
- `tests/e2e/e99-s01-view-mode-toggle.spec.ts` — new E2E

### Out of scope (future stories)

- E99-S02: grid column count control (2/3/4/5/auto)
- E99-S03: list view renderer
- E99-S04: compact grid view renderer
- E99-S05: virtualization for large libraries

## Design Guidance

- **Placement**: In the existing header row alongside sort/filter controls — don't create a new row
- **Default**: `grid`
- **Icons**: `LayoutGrid`, `List`, `Rows3` from lucide-react (all already used elsewhere)
- **Visual style**: shadcn `ToggleGroup` with `variant="outline"` and `size="sm"` for desktop; `size="default"` on mobile (44×44 minimum)
- **Animation**: Respect `prefers-reduced-motion` — no transition on selected state if user opted out

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] No hardcoded colors (ESLint `design-tokens/no-hardcoded-colors` passes)
- [ ] `courseViewMode` added to AppSettings type with correct union
- [ ] Zustand setter bridges to both `saveSettings` (local) AND `saveSettingsToSupabase` (remote)
- [ ] Rehydration sanitiser rejects invalid values
- [ ] ViewModeToggle has `role="radiogroup"` semantics and 44px touch targets
- [ ] E2E test asserts persistence across reload
- [ ] No regression in book library toggle (`Library.tsx`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
