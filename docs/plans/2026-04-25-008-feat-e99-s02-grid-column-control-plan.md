---
title: "feat(E99-S02): Grid Column Control"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e99-s02-grid-column-control-requirements.md
---

# feat(E99-S02): Grid Column Control

## Overview

Add a grid-only column-count selector to the Courses page so learners can choose `Auto / 2 / 3 / 4 / 5` columns. The default `'auto'` preserves the existing responsive grid; concrete values cap the column count at the `lg` breakpoint and above. The preference persists via the same `useEngagementPrefsStore` + AppSettings + Supabase bridge pattern S01 used for `courseViewMode`.

## Problem Frame

Today the Courses grid hardcodes `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`. Users on large monitors want denser grids; users on small laptops want bigger cards. There is no control to trade card size for density. (See origin: `docs/brainstorms/2026-04-25-e99-s02-grid-column-control-requirements.md`.)

## Requirements Trace

- R1 (AC1): When `courseViewMode === 'grid'`, a column-count selector with `Auto, 2, 3, 4, 5` is visible with active option highlighted.
- R2 (AC2): Selecting `3` updates `useEngagementPrefsStore.courseGridColumns` to `3` and grid uses `grid-cols-3` at `lg` and above.
- R3 (AC3): `'auto'` renders the existing default responsive class string.
- R4 (AC4): Selector is hidden when `courseViewMode === 'list' | 'compact'`.
- R5 (AC5): Setting columns to `5` and reloading restores `5` from persisted state (AppSettings bridge + Supabase sync).
- R6 (AC6): On viewports `< 640px`, grid is always 1 column; selector remains visible with hint "Applies on larger screens".

## Scope Boundaries

- No slider / number-input UI (segmented control only — explicitly rejected in story).
- No column control on List or Compact views.
- No per-page column preferences (single global Courses pref).
- No change to the default responsive behavior when `'auto'` is selected.
- No new Supabase table/column — reuse existing `merge_user_settings` JSONB patch surface.

## Context & Research

### Relevant Code and Patterns

- `src/stores/useEngagementPrefsStore.ts` — S01 added `courseViewMode` with sanitiser, AppSettings bridge, Supabase sync. **Mirror exactly** for `courseGridColumns`.
- `src/lib/settings.ts`:
  - `AppSettings.courseViewMode?: CourseViewMode` (line ~71) and default at line ~100.
  - `VALID_COURSE_VIEW_MODE` sanitiser at line ~108/134.
  - `UserSettingsPatch.courseViewMode?: string` (line ~198).
  - Supabase hydration block at line ~440 calls `setPreference('courseViewMode', ...)`.
- `src/app/components/courses/ViewModeToggle.tsx` — shadcn `ToggleGroup` (`type="single"`, `variant="outline"`), 44×44 min targets via `min-h-11 min-w-11`, selected styling `data-[state=on]:bg-brand-soft data-[state=on]:text-brand-soft-foreground`. Use as the structural template for `GridColumnControl`.
- `src/app/pages/Courses.tsx` lines 287–294 — current `gridClassName` string literal (all three branches identical today; this plan replaces the grid branch with `getGridClassName(columns)`).
- `src/styles/tailwind.css` — `@source '../**/*.{js,ts,jsx,tsx}'` covers all of `src/`, so new files under `src/app/components/courses/` are already scanned.
- `tests/e2e/e99-s01-view-mode-toggle.spec.ts` — pattern for E99 series E2E tests (assert toggle state, persistence across reload).

### Institutional Learnings

- Tailwind v4 JIT requires complete string literals; dynamic `` `grid-cols-${n}` `` is silently dropped from the bundle. The resolver helper returning per-branch literals is the project-standard workaround (also used in S01).
- Brand-soft tokens already pass WCAG AA contrast in dark mode (see `.claude/rules/styling.md`). Reuse the same `data-[state=on]:bg-brand-soft data-[state=on]:text-brand-soft-foreground` pair the `ViewModeToggle` uses.
- Supabase sync is fire-and-forget; localStorage is source of truth. Anonymous/offline users are no-op (see `saveSettingsToSupabase`).

### External References

None — pattern is fully established locally; no external research warranted.

## Key Technical Decisions

- **Resolver helper returns literal strings, not class fragments** — guarantees Tailwind JIT inclusion and gives a single, easily-tested branching point.
- **Separate component (`GridColumnControl`) rather than extending `ViewModeToggle`** — keeps conditional visibility (`courseViewMode === 'grid'`) at the page level and avoids coupling unrelated controls.
- **`'auto' | 2 | 3 | 4 | 5` union (not just `number`)** — narrow type forces exhaustiveness in the resolver and the sanitiser, mirrors the S01 `CourseViewMode` shape.
- **Mirror S01's persistence wiring exactly** — extend `EngagementPrefs`, add sanitiser branch, AppSettings bridge in `setPreference`, JSONB key in `UserSettingsPatch`, hydration branch in `hydrateSettingsFromSupabase`. No new abstractions.
- **Mobile selector remains visible with a hint** — UX clarity per AC6; do not hide on small viewports.
- **`useEngagementPrefsStore` selector usage** — read `courseGridColumns` with a selector function the same way S01 reads `courseViewMode` to avoid unnecessary re-renders.

## Open Questions

### Resolved During Planning

- *Where to render the helper file?* → `src/app/components/courses/gridClassName.ts` (story spec).
- *Should the type include `1` for explicit single-column?* → No. AC6 forces 1-column on mobile already; adding `1` to the union duplicates intent and adds a no-op branch. Stop at `auto | 2 | 3 | 4 | 5`.
- *Should the selector hide on mobile?* → No (AC6) — keep visible with "Applies on larger screens" hint.

### Deferred to Implementation

- Exact label format for the active hint on mobile (`Applies on larger screens` vs. shorter form) — choose during component build; wording in story is canonical.
- Whether to expose `courseGridColumns` in the Settings page UI — out of scope for S02; toggle only ships in the Courses header.

## Implementation Units

- [ ] **Unit 1: Extend persistence layer with `courseGridColumns`**

**Goal:** Add the `courseGridColumns` field across the store, AppSettings, sanitiser, Supabase patch type, and Supabase hydration — mirroring the S01 `courseViewMode` pattern end-to-end.

**Requirements:** R2, R5, R6 (mobile force-to-1 lives in the resolver, but persisted value stays untouched).

**Dependencies:** None (S01 already merged).

**Files:**
- Modify: `src/stores/useEngagementPrefsStore.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/stores/__tests__/useEngagementPrefsStore.test.ts` (or create if absent)

**Approach:**
- In `useEngagementPrefsStore.ts`:
  - Add `export type CourseGridColumns = 'auto' | 2 | 3 | 4 | 5`.
  - Add `VALID_COURSE_GRID_COLUMNS: CourseGridColumns[] = ['auto', 2, 3, 4, 5]`.
  - Extend `EngagementPrefs` with `courseGridColumns: CourseGridColumns` and default `'auto'`.
  - Extend `loadPersistedPrefs` to coerce invalid values to `'auto'`.
  - Extend `setPreference` to bridge `courseGridColumns` to `saveSettings({ courseGridColumns })` + dispatch `settingsUpdated` + call `saveSettingsToSupabase({ courseGridColumns: <value as string|number> })`.
  - Extend `resetToDefaults` to include `courseGridColumns` in the AppSettings save payload.
- In `src/lib/settings.ts`:
  - Add `courseGridColumns?: CourseGridColumns` to `AppSettings` (import the type from the store).
  - Add `courseGridColumns: 'auto'` to `defaults`.
  - Add a sanitiser branch in `getSettings` mirroring `VALID_COURSE_VIEW_MODE`.
  - Add `courseGridColumns?: string | number` to `UserSettingsPatch`.
  - Add a hydration branch in `hydrateSettingsFromSupabase` (next to the `courseViewMode` block at ~line 440) that validates against the union and calls `setPreference('courseGridColumns', ...)`.

**Patterns to follow:**
- `courseViewMode` end-to-end wiring in `useEngagementPrefsStore.ts` and `src/lib/settings.ts`.

**Test scenarios:**
- Happy path: setting `courseGridColumns` to `3` updates store state and writes to localStorage.
- Edge case: invalid persisted value (`'7'`, `null`, `'foo'`) is coerced to `'auto'` on load.
- Edge case: `resetToDefaults` returns `courseGridColumns` to `'auto'`.
- Integration: setting `courseGridColumns` triggers `settingsUpdated` window event (the AppSettings bridge).

**Verification:**
- `getSettings().courseGridColumns` returns the persisted value after a write.
- A bogus localStorage payload no longer throws and falls back to `'auto'`.

---

- [ ] **Unit 2: Build `getGridClassName` resolver helper**

**Goal:** Centralise the branching grid class string in a pure function so Tailwind JIT picks up every literal and the logic is unit-testable.

**Requirements:** R2, R3, R6.

**Dependencies:** Unit 1 (uses the `CourseGridColumns` type).

**Files:**
- Create: `src/app/components/courses/gridClassName.ts`
- Test: `src/app/components/courses/__tests__/gridClassName.test.ts`

**Approach:**
- Export `getGridClassName(columns: CourseGridColumns): string` returning the exact string literals from the story spec for each of the 5 branches.
- All branches start with `grid grid-cols-1 sm:grid-cols-2` (so AC6's mobile-1-column behavior is automatic).
- Use a `switch` for exhaustiveness; let TypeScript catch missing branches if the union changes.

**Patterns to follow:**
- Pure helper modules elsewhere in `src/app/components/` — no React imports, no side effects.

**Test scenarios:**
- Happy path: each of the 5 inputs (`'auto', 2, 3, 4, 5`) returns its expected string literal verbatim (5 cases).
- Edge case: every returned string includes `grid-cols-1 sm:grid-cols-2` (AC6 invariant).
- Edge case: `'auto'` matches the current hardcoded `Courses.tsx` literal exactly (regression-proof).

**Verification:**
- All 5 branch strings are present in the source file (greppable for `grid-cols-3`, `grid-cols-4`, `grid-cols-5`, `lg:grid-cols-3`, `xl:grid-cols-5`).
- After `npm run build`, `dist/assets/*.css` contains all 5 column classes.

---

- [ ] **Unit 3: Build `GridColumnControl` component**

**Goal:** Render a shadcn `ToggleGroup` with 5 options (`Auto, 2, 3, 4, 5`), wired to the store, with accessible labels and 44×44 min touch targets. Mobile shows a hint "Applies on larger screens".

**Requirements:** R1, R6.

**Dependencies:** Unit 1 (store has `courseGridColumns` and setter).

**Files:**
- Create: `src/app/components/courses/GridColumnControl.tsx`
- Test: `src/app/components/courses/__tests__/GridColumnControl.test.tsx`

**Approach:**
- Props: `{ value: CourseGridColumns; onChange: (next: CourseGridColumns) => void; className?: string }` — same shape as `ViewModeToggle`.
- `OPTIONS` array: `[{ value: 'auto', label: 'Auto columns' }, { value: 2, label: '2 columns' }, ...]`.
- `<ToggleGroup type="single" variant="outline" value={String(value)} onValueChange={...}>` — coerce string → union via lookup table; ignore Radix's empty-string deselect emission (same pattern as `ViewModeToggle`).
- Each `<ToggleGroupItem>`:
  - `aria-label` = full label (e.g. "3 columns").
  - Visible label = the short form (`Auto`, `2`, `3`, `4`, `5`).
  - Classes: `min-h-11 min-w-11 px-3 text-muted-foreground data-[state=on]:bg-brand-soft data-[state=on]:text-brand-soft-foreground motion-safe:transition-colors`.
- Below the toggle group on `< sm` viewports, render a `<p className="text-xs text-muted-foreground sm:hidden mt-1">Applies on larger screens</p>` hint.
- `data-testid="course-grid-column-control"` on the `ToggleGroup`; `data-testid="course-grid-columns-{value}"` on each item.
- `aria-label="Course grid column count"` on the group.

**Patterns to follow:**
- `src/app/components/courses/ViewModeToggle.tsx` (structure, classes, `onValueChange` deselect-guard).

**Test scenarios:**
- Happy path: renders 5 toggle items with correct labels and the active item has `data-state="on"`.
- Happy path: clicking an inactive item calls `onChange` with the correct typed value (`'auto'` for the `Auto` button, `3` for the `3` button).
- Edge case: clicking the already-active item does NOT call `onChange` (deselect-guard).
- Edge case: each item exposes `aria-label` matching the long form ("Auto columns", "2 columns", ...).
- Edge case: at `< sm` viewports the "Applies on larger screens" hint is visible (test by class assertion — `sm:hidden` present).

**Verification:**
- All 5 buttons render. Active state visually distinct via `data-state` attribute.
- Component compiles without TS errors and passes lint (no hardcoded colors, uses brand tokens).

---

- [ ] **Unit 4: Wire into `Courses.tsx`**

**Goal:** Replace the hardcoded grid string with `getGridClassName(courseGridColumns)` and render `<GridColumnControl />` adjacent to `<ViewModeToggle />`, conditionally on `courseViewMode === 'grid'`.

**Requirements:** R1, R2, R3, R4.

**Dependencies:** Units 1, 2, 3.

**Files:**
- Modify: `src/app/pages/Courses.tsx`

**Approach:**
- Add `const courseGridColumns = useEngagementPrefsStore(state => state.courseGridColumns)` next to the existing `courseViewMode` selector (~line 44).
- Adjacent to the existing `<ViewModeToggle .../>` (~line 241), conditionally render:
  ```
  {courseViewMode === 'grid' && (
    <GridColumnControl
      value={courseGridColumns}
      onChange={cols => setEngagementPref('courseGridColumns', cols)}
    />
  )}
  ```
- In the `gridClassName` prop expression (~line 287–294), replace the `'grid'` branch with `getGridClassName(courseGridColumns)`. Leave the `list` and `compact` branches untouched (they ship later in S03/S04).
- Import `GridColumnControl` and `getGridClassName` at the top of the file.

**Patterns to follow:**
- Existing `ViewModeToggle` usage at line 241–243.

**Test scenarios:**
- Covered by Unit 5 E2E (no new unit tests for the page wiring itself).

**Verification:**
- In Grid view, the grid container's `className` includes the literal returned by `getGridClassName(courseGridColumns)`.
- In List/Compact view, no `GridColumnControl` is in the DOM (`data-testid` absent).

---

- [ ] **Unit 5: E2E test — selection, class assertion, persistence**

**Goal:** Validate AC1, AC2, AC4, AC5 end-to-end with Playwright.

**Requirements:** R1, R2, R4, R5.

**Dependencies:** Unit 4.

**Files:**
- Create: `tests/e2e/e99-s02-grid-columns.spec.ts`

**Approach:**
- Mirror the structure of `tests/e2e/e99-s01-view-mode-toggle.spec.ts`.
- Test 1: Navigate to Courses page (ensure grid mode is active by default). Click `data-testid="course-grid-columns-3"`. Assert the courses grid container `className` includes `lg:grid-cols-3`. Reload. Assert the `3` button is `data-state="on"` (persistence). Assert the grid `className` still includes `lg:grid-cols-3`.
- Test 2: Switch view mode to `list` via `data-testid="course-view-mode-list"`. Assert `data-testid="course-grid-column-control"` is not visible (AC4).
- Test 3: Switch back to grid. Click `Auto`. Assert grid `className` matches the default responsive literal exactly.

**Patterns to follow:**
- `tests/e2e/e99-s01-view-mode-toggle.spec.ts` for setup, selectors, and reload-persistence assertion idioms.
- E2E test patterns from `.claude/rules/testing/test-patterns.md` (deterministic time, IDB seeding helpers).

**Test scenarios:**
- Happy path: select `3` columns → grid has `lg:grid-cols-3`.
- Integration: reload after selection → preference restored, button still active, grid class still applied.
- Edge case: switch to List view → column control not in DOM.
- Edge case: select `Auto` → grid uses the canonical default responsive class string.

**Verification:**
- Spec passes in Chromium (`npm run test:e2e -- e99-s02-grid-columns`).
- Spec passes burn-in if anti-pattern signals trigger it.

## System-Wide Impact

- **Interaction graph:** `setPreference('courseGridColumns', n)` → `persistPrefs` (localStorage), `saveSettings` (AppSettings localStorage), `dispatchEvent('settingsUpdated')`, `saveSettingsToSupabase` (fire-and-forget RPC `merge_user_settings`).
- **Error propagation:** Supabase sync errors are swallowed with `console.warn` (offline-first invariant); localStorage corruption is sanitised on read. No new failure modes vs. S01.
- **State lifecycle risks:** None new. The sanitiser ensures stale or hand-edited values cannot crash hydration.
- **API surface parity:** `merge_user_settings` accepts arbitrary JSONB patches today; adding `courseGridColumns` requires no migration.
- **Integration coverage:** E2E in Unit 5 covers the bridge end-to-end (UI click → reload → restored value).
- **Unchanged invariants:** `courseViewMode` behavior (S01), default Auto responsive grid behavior (Auto branch), and List/Compact rendering (still pending S03/S04) are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Tailwind JIT drops a class because it appears only via dynamic concatenation | Resolver helper returns complete literal strings; verified by grepping `dist/assets/*.css` after build. |
| Type drift between store `CourseGridColumns` and AppSettings/UserSettingsPatch | Store exports the union as the single source of truth; both other modules import it. |
| Existing users with no `courseGridColumns` in localStorage / Supabase | `defaults` + sanitiser fall back to `'auto'`, which renders identically to today's hardcoded grid. |
| Selector visibility flicker when toggling view mode | Conditional render (`courseViewMode === 'grid' && ...`); React handles unmount cleanly. |

## Documentation / Operational Notes

- No docs updates required; story file's `## Challenges and Lessons Learned` section will capture anything novel during implementation.
- No rollout flag — change is additive and falls back to today's behavior when the user hasn't set a preference.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-25-e99-s02-grid-column-control-requirements.md`
- **Story:** `docs/implementation-artifacts/stories/E99-S02-grid-column-control.md`
- **Pattern reference (S01):** `src/stores/useEngagementPrefsStore.ts`, `src/lib/settings.ts`, `src/app/components/courses/ViewModeToggle.tsx`, `tests/e2e/e99-s01-view-mode-toggle.spec.ts`
- **Styling rules:** `.claude/rules/styling.md`
