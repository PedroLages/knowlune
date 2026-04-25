# E99-S01 Requirements: View Mode Toggle and Settings Infrastructure

**Story file:** [docs/implementation-artifacts/stories/E99-S01-view-mode-toggle-and-settings-infrastructure.md](../implementation-artifacts/stories/E99-S01-view-mode-toggle-and-settings-infrastructure.md)
**Date:** 2026-04-25
**Epic:** E99 — Course Library Density & View Modes

## Title

View Mode Toggle and Settings Infrastructure for Courses Page

## User Value

As a learner browsing my course library, I want to switch between grid, list, and compact views so that I can scan courses in the density that matches my current task. The selection must persist locally and sync across devices via Supabase.

## Acceptance Criteria

1. **Toggle visible in Courses header**
   - Three options (Grid, List, Compact) rendered as a single `role="radiogroup"` toggle
   - Each option has a Lucide icon (`LayoutGrid`, `List`, `Rows3`) plus accessible label
   - Active mode shows a selected visual state

2. **State updates on selection**
   - Clicking an option updates `useEngagementPrefsStore.courseViewMode`
   - The grid container reads the value (in S01, all three branches still render the existing grid — list/compact renderers ship in S03/S04)

3. **Persistence**
   - Selection persists to localStorage via the AppSettings bridge (`saveSettings`)
   - Reload restores the previously selected mode

4. **Supabase sync**
   - When signed in with sync enabled, `courseViewMode` writes through `saveSettingsToSupabase` (mirrors `colorScheme` bridge)
   - Other devices receive the new value after sync

5. **Mobile usability**
   - All three options keep ≥44×44 px touch targets at viewports < 640 px
   - Icon-only labels acceptable; full text may be `sr-only`

6. **Keyboard a11y**
   - ArrowLeft/ArrowRight move focus between options (radiogroup semantics)
   - Space/Enter activates the focused option

## Context & Constraints

- **Reference pattern:** mirror the `colorScheme` bridge in `src/stores/useEngagementPrefsStore.ts` (lines ~46–47 sanitiser, ~76–99 setter + Supabase bridge).
- **Do not adopt:** `useBookStore.libraryView` — that store is local-only and not the right home for sync.
- **AppSettings:** extend the type with `courseViewMode?: 'grid' | 'list' | 'compact'`. JSON blob storage means no Dexie v-bump or Supabase migration expected.
- **Design tokens only:** ESLint blocks hardcoded colors. Use `bg-brand-soft`, `text-brand-soft-foreground`, `bg-muted`, `text-muted-foreground`.
- **Reduced motion:** respect `prefers-reduced-motion` for selected-state transitions.
- **No regression:** book library toggle must keep working unchanged.

## Dependencies

- Existing `useEngagementPrefsStore` (Zustand) and `AppSettings` bridge
- Existing `saveSettingsToSupabase` debounced writer
- shadcn `ToggleGroup` / `ToggleGroupItem`
- `lucide-react` icons (`LayoutGrid`, `List`, `Rows3`)

## Files to touch

- `src/stores/useEngagementPrefsStore.ts` — add state, setter, sanitiser, defaults reset
- `src/lib/settings.ts` (or wherever `AppSettings` lives) — extend type
- `src/app/components/courses/ViewModeToggle.tsx` — new component
- `src/app/pages/Courses.tsx` — render toggle in header row, read store value, branch (no-op in S01)
- `tests/unit/...` — store + component unit tests
- `tests/e2e/e99-s01-view-mode-toggle.spec.ts` — persistence + a11y E2E

## Out of Scope

- E99-S02 grid column count control
- E99-S03 list-view renderer
- E99-S04 compact-grid renderer
- E99-S05 virtualization
- Any change to the visual output for grid mode (S01 = infrastructure only)

## Test Strategy (high-level)

- **Unit:** ViewModeToggle renders 3 options, selected state reflects prop, onChange fires with correct value. Store: setter updates state + persists, sanitiser rejects invalid values.
- **E2E:** Navigate `/courses`, click "List", reload, assert "List" still selected; assert all three options have proper `aria-label`s.

## Definition of Done

- All ACs pass; ESLint design-token rule clean; no hardcoded colors.
- Setter bridges both `saveSettings` and `saveSettingsToSupabase`.
- Rehydration sanitiser rejects unknown values → falls back to `'grid'`.
- ViewModeToggle keyboard-accessible with `role="radiogroup"`, 44×44 touch targets.
- E2E verifies persistence across reload.
- Book library toggle still works.
