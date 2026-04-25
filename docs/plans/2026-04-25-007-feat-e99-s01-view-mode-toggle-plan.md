---
title: "feat(E99-S01): View Mode Toggle and Settings Infrastructure"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e99-s01-view-mode-toggle-requirements.md
---

# feat(E99-S01): View Mode Toggle and Settings Infrastructure

## Overview

Add a `<ViewModeToggle />` to the Courses page header that lets users pick between Grid, List, and Compact views. Persist the choice to localStorage and Supabase using the existing `AppSettings` bridge inside `useEngagementPrefsStore`. In S01 the choice does not change the rendered view yet — list and compact renderers ship in S03/S04.

## Problem Frame

Course library users want to control density depending on context (browse vs. scan vs. drill-in). E99 will deliver three renderers; S01 lays the infrastructure: a typed, persisted, sync-enabled preference and a reusable, accessible toggle. (see origin: [docs/brainstorms/2026-04-25-e99-s01-view-mode-toggle-requirements.md](../brainstorms/2026-04-25-e99-s01-view-mode-toggle-requirements.md))

## Requirements Trace

- R1. Toggle visible in Courses header with three icon+label options and selected state
- R2. Selection updates `useEngagementPrefsStore.courseViewMode`
- R3. Selection persists to localStorage via `saveSettings`
- R4. Selection syncs to Supabase via `saveSettingsToSupabase` (mirrors `colorScheme`)
- R5. Mobile: 44×44 px touch targets, icon-only labels acceptable
- R6. Keyboard: ArrowLeft/ArrowRight navigation, Space/Enter activation, `role="radiogroup"` semantics

## Scope Boundaries

- No list-view renderer (deferred to E99-S03)
- No compact-grid renderer (deferred to E99-S04)
- No grid column count control (E99-S02)
- No virtualization (E99-S05)
- No change to the visual output of grid mode in S01
- No change to `useBookStore.libraryView` (book library toggle untouched)

### Deferred to Separate Tasks

- List view rendering: E99-S03
- Compact view rendering: E99-S04
- Column count selector: E99-S02
- Virtualization for large libraries: E99-S05

## Context & Research

### Relevant Code and Patterns

- `src/stores/useEngagementPrefsStore.ts` — existing Zustand store. Mirror the `colorScheme` flow:
  - Sanitiser pattern at lines ~46–47 (`['professional', 'vibrant', 'clean'].includes(parsed.colorScheme) ? parsed.colorScheme : defaults`)
  - Setter bridge at lines ~76–99 (calls `saveSettings({ colorScheme })` and debounced `saveSettingsToSupabase({ colorScheme })`)
  - Defaults reset
- `src/lib/settings.ts` — `AppSettings` interface (line 21), `defaults` (line 78), `getSettings` sanitisers (line 101+). Pattern: add a `VALID_*` array and a sanitiser branch.
- `src/app/components/ui/toggle-group.tsx` — shadcn `ToggleGroup` / `ToggleGroupItem` (already in repo)
- `src/app/pages/Courses.tsx` — header controls row (sort `<Select>` ~line 260) is where the toggle lives
- `src/app/pages/Library.tsx` lines 766–791 — book library toggle. Reference for visual style only; **do not** copy its store pattern (`useBookStore.libraryView` is local-only)
- Lucide icons already used elsewhere: `LayoutGrid`, `List`, `Rows3`

### Institutional Learnings

- Design tokens only — ESLint rule `design-tokens/no-hardcoded-colors` blocks hardcoded Tailwind colors
- Use `variant="brand"` on `<Button>`; for `data-state=on` styling on toggle items use `bg-brand-soft` + `text-brand-soft-foreground` to satisfy WCAG AA contrast
- Touch targets: `min-w-11 min-h-11` (WCAG 2.2 Target Size)
- Respect `prefers-reduced-motion` for selected-state transitions

### External References

- shadcn ToggleGroup uses Radix `ToggleGroup` under the hood with `type="single"` providing radiogroup semantics

## Key Technical Decisions

- **Home for state:** `useEngagementPrefsStore` (cross-device user preference) — not a new store and not `useBookStore`. Rationale: piggybacks on the existing `AppSettings` ⇄ Supabase bridge; consistent with `colorScheme`.
- **Type:** `CourseViewMode = 'grid' | 'list' | 'compact'`, exported from the store.
- **Default:** `'grid'`.
- **Sanitiser:** mirror `colorScheme` — `VALID_COURSE_VIEW_MODE.includes(parsed.courseViewMode) ? parsed.courseViewMode : defaults.courseViewMode`. Add branch in both `useEngagementPrefsStore` rehydration and `getSettings` in `src/lib/settings.ts`.
- **Persistence path:** Zustand setter → `saveSettings({ courseViewMode })` synchronous local + debounced `saveSettingsToSupabase({ courseViewMode })`.
- **No Dexie migration / Supabase migration:** `AppSettings` is a JSON blob; new optional field is safe.
- **Toggle component:** shadcn `ToggleGroup type="single"` with `ToggleGroupItem` per mode. Provides `role="radiogroup"` + arrow-key nav for free.
- **S01 rendering:** read `courseViewMode` in `Courses.tsx` but keep all three branches rendering the existing grid (no visual change). Sets up the seam for S03/S04.

## Open Questions

### Resolved During Planning

- Where does state live? → `useEngagementPrefsStore`.
- Schema migration needed? → No (JSON blob in `AppSettings`).
- Default value? → `'grid'`.
- Icon for compact? → `Rows3` from lucide-react.

### Deferred to Implementation

- Exact placement order within the header controls row (left of sort or right of filter) — implementer picks based on visual balance.

## Implementation Units

- [ ] **Unit 1: Extend `AppSettings` with `courseViewMode`**

**Goal:** Add the new optional field + sanitiser to the persisted settings shape.

**Requirements:** R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/lib/settings.ts`

**Approach:**
- Add `courseViewMode?: 'grid' | 'list' | 'compact'` to `AppSettings`
- Add `courseViewMode: 'grid'` to `defaults`
- Add `VALID_COURSE_VIEW_MODE` constant array
- In `getSettings`, branch: if `parsed.courseViewMode` not in the valid list → reset to default
- Export `CourseViewMode` type alias for consumers

**Patterns to follow:**
- `colorScheme` field declaration (line 39), `VALID_REDUCE_MOTION` (line 96), sanitiser block (line 107+)

**Test scenarios:**
- Happy path: `getSettings()` returns `'grid'` when no value persisted
- Edge case: corrupted localStorage with `courseViewMode: 'xyz'` → falls back to `'grid'`
- Edge case: valid value `'list'` round-trips through localStorage

**Verification:**
- `AppSettings` type has the new field; existing tests still pass; corrupted-value test passes.

- [ ] **Unit 2: Extend `useEngagementPrefsStore` with `courseViewMode`**

**Goal:** Add state, setter, sanitiser, and Supabase bridge mirroring `colorScheme`.

**Requirements:** R2, R3, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/stores/useEngagementPrefsStore.ts`
- Test: `src/stores/__tests__/useEngagementPrefsStore.test.ts` (extend if exists; otherwise add minimum coverage in nearest existing test for the store)

**Approach:**
- Export `CourseViewMode` type
- Add `courseViewMode: CourseViewMode` to state interface and initial state (`'grid'`)
- Extend `setPref` (or equivalent) to handle the new key:
  - Local: `saveSettings({ courseViewMode: value })`
  - Remote: `void saveSettingsToSupabase({ courseViewMode: value })`
- Extend the rehydration sanitiser block (lines ~46–47): reject values not in `['grid','list','compact']`, fall back to `'grid'`
- Add to defaults reset path

**Patterns to follow:**
- `colorScheme` setter and sanitiser in same file (lines 46–99)

**Test scenarios:**
- Happy path: `setCourseViewMode('list')` updates state to `'list'`
- Happy path: setter calls `saveSettings` and `saveSettingsToSupabase` with `{ courseViewMode: 'list' }`
- Edge case: rehydration with invalid value `'foo'` → state initialises to `'grid'`
- Integration: setter persistence is observable by reading `getSettings()` after the call

**Verification:**
- Store exposes `courseViewMode` and a setter; Supabase bridge invoked on change.

- [ ] **Unit 3: Create `<ViewModeToggle />` component**

**Goal:** Reusable, accessible toggle with three icon+label options.

**Requirements:** R1, R5, R6

**Dependencies:** Unit 2 (for the type export)

**Files:**
- Create: `src/app/components/courses/ViewModeToggle.tsx`
- Test: `src/app/components/courses/__tests__/ViewModeToggle.test.tsx`

**Approach:**
- Props: `value: CourseViewMode`, `onChange: (v: CourseViewMode) => void`, optional `className`
- Use shadcn `ToggleGroup type="single"` + `ToggleGroupItem` for each mode
- Icons: `LayoutGrid` (grid), `List` (list), `Rows3` (compact) from `lucide-react`
- Accessible labels via `aria-label` on each item: "Grid view", "List view", "Compact view"
- Visible labels via `<span className="sr-only md:not-sr-only">` so mobile shows icons-only but desktop can show text
- Touch targets: `min-w-11 min-h-11` on each item
- Selected styling: `data-[state=on]:bg-brand-soft data-[state=on]:text-brand-soft-foreground`; idle: `text-muted-foreground hover:bg-muted`
- Reduced motion: gate transition utilities behind `motion-safe:transition-colors`
- Guard the `onValueChange` callback: ToggleGroup may emit `''` when clicking the active item — ignore non-mode values

**Patterns to follow:**
- shadcn ToggleGroup usage elsewhere in repo
- Library page toggle visual cadence (don't copy state plumbing)

**Test scenarios:**
- Happy path: renders 3 items, each with the correct icon and `aria-label`
- Happy path: when `value="list"`, that item has `data-state="on"` and others are `off`
- Happy path: clicking an item invokes `onChange` with that mode value
- Edge case: clicking the already-selected item does NOT call `onChange` with `''` (filtered)
- A11y: container has `role="radiogroup"` (provided by ToggleGroup)
- A11y: each item has `min-h-11 min-w-11` classes (touch target)

**Verification:**
- Component compiles, ESLint passes (no hardcoded colors), unit tests pass.

- [ ] **Unit 4: Wire `<ViewModeToggle />` into `Courses.tsx`**

**Goal:** Render the toggle in the existing header row, hooked to the store.

**Requirements:** R1, R2

**Dependencies:** Units 2, 3

**Files:**
- Modify: `src/app/pages/Courses.tsx`

**Approach:**
- Read `courseViewMode` and `setCourseViewMode` from `useEngagementPrefsStore`
- Render `<ViewModeToggle value={courseViewMode} onChange={setCourseViewMode} />` in the header controls row near the sort `<Select>` (~line 260)
- Reference `courseViewMode` somewhere downstream (e.g., a `viewMode` prop passed to the existing grid container, or a no-op branch) so the variable isn't unused — keep all three branches rendering the current grid for now
- Add a brief comment marking the seam: `// S01: all branches render grid; list/compact renderers ship in S03/S04`

**Patterns to follow:**
- Existing header row layout in `Courses.tsx`
- Existing `useEngagementPrefsStore` consumers in the file (if any) for hook ordering

**Test scenarios:**
- Test expectation: covered by E2E in Unit 6 (page-level integration). No new unit test needed for the wiring itself.

**Verification:**
- Visiting `/courses` shows the toggle; clicking changes selected state; grid still renders unchanged.

- [ ] **Unit 5: Unit tests for store + component**

**Goal:** Cover the new store branch and component behaviour.

**Requirements:** R2, R3, R6

**Dependencies:** Units 2, 3

**Files:**
- Test: `src/stores/__tests__/useEngagementPrefsStore.test.ts` (or co-located)
- Test: `src/app/components/courses/__tests__/ViewModeToggle.test.tsx`

**Approach:**
- Store tests: setter updates state, setter calls `saveSettings`/`saveSettingsToSupabase` (mock the module), sanitiser rejects invalid persisted values
- Component tests: see Unit 3 scenarios

**Patterns to follow:**
- Existing tests in `src/stores/__tests__/` and `src/app/components/**/__tests__/`

**Test scenarios:**
- See Units 2 & 3.

**Verification:**
- `npm run test:unit` passes; coverage on the new store branch.

- [ ] **Unit 6: E2E test for persistence + a11y**

**Goal:** Validate end-to-end that toggle persists across reload and meets a11y.

**Requirements:** R3, R5, R6

**Dependencies:** Unit 4

**Files:**
- Create: `tests/e2e/e99-s01-view-mode-toggle.spec.ts`

**Approach:**
- Navigate to `/courses`
- Assert toggle has 3 options with correct `aria-label`s ("Grid view", "List view", "Compact view")
- Click "List view" → assert `data-state="on"` on that item
- Reload → assert "List view" still selected
- (Optional) Keyboard: focus toggle, press ArrowRight, assert focus moves and Space activates

**Patterns to follow:**
- Existing E2E specs in `tests/e2e/` — follow project test patterns (deterministic time, no `waitForTimeout` without justification, prefer factory seeding)

**Test scenarios:**
- Happy path: toggle visible with 3 labelled options
- Happy path: selection persists across reload
- A11y: keyboard arrow navigation between options

**Verification:**
- E2E spec passes locally on Chromium.

## System-Wide Impact

- **Interaction graph:** New write path through `saveSettingsToSupabase` (already used by other prefs). No new RPCs.
- **Error propagation:** Supabase write is fire-and-forget (`void`-prefixed) consistent with `colorScheme`; offline writes queue via the existing sync engine.
- **State lifecycle risks:** None new. Sanitiser prevents corrupted-localStorage propagation.
- **API surface parity:** Mirrors `colorScheme` everywhere: AppSettings field, sanitiser, Zustand state, setter, defaults reset, Supabase bridge.
- **Integration coverage:** E2E covers cross-layer persistence (store → AppSettings → localStorage → reload).
- **Unchanged invariants:**
  - `useBookStore.libraryView` continues to work — book library is untouched
  - Existing `AppSettings` consumers (theme, fontSize, etc.) unaffected
  - Grid rendering unchanged in S01

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Hardcoded colors slipping into the toggle | Use design tokens only (`bg-brand-soft`, `text-muted-foreground`); ESLint rule blocks at save-time |
| Corrupted localStorage propagating bad value | Sanitiser in both `getSettings` and the store rehydration |
| Mobile touch target regression | `min-w-11 min-h-11` enforced; verified by E2E + design review |
| Sync regression for `colorScheme` from refactor | Keep changes additive — do not modify the existing `colorScheme` branch |
| ToggleGroup emits `''` on deselect | Filter in `onValueChange` so `onChange` only fires for valid modes |

## Documentation / Operational Notes

- No user-facing docs needed for S01 (toggle is self-explanatory)
- Update epic-99 status in sprint-status.yaml after merge

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-25-e99-s01-view-mode-toggle-requirements.md](../brainstorms/2026-04-25-e99-s01-view-mode-toggle-requirements.md)
- **Story file:** [docs/implementation-artifacts/stories/E99-S01-view-mode-toggle-and-settings-infrastructure.md](../implementation-artifacts/stories/E99-S01-view-mode-toggle-and-settings-infrastructure.md)
- Reference code: `src/stores/useEngagementPrefsStore.ts`, `src/lib/settings.ts`, `src/app/pages/Courses.tsx`, `src/app/pages/Library.tsx`
