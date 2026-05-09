---
title: "fix: Reading Goals modal layout and fit"
type: fix
status: active
date: 2026-05-08
---

# fix: Reading Goals modal layout and fit

## Overview

The Library page **Reading Goals** dialog (`ReadingGoalSettings`) shows broken layout: daily preset “chips” render as overly tall active highlights, the yearly goal numeric field appears as a narrow vertical sliver, content can overflow the viewport, and minor spacing issues (quote vs subtitle, heatmap legend). This plan addresses **CSS/layout only** — no changes to goal persistence or business rules.

## Problem Frame

Users open Reading Goals from the Library and see a cramped or malformed modal that does not match the design system and reduces confidence in the feature. The implementation lives in `src/app/components/library/ReadingGoalSettings.tsx` with shared `DialogContent` from `src/app/components/ui/dialog.tsx` (default **`display: grid`**, **`sm:max-w-lg`** overridden by caller **`max-w-4xl`**).

## Requirements Trace

- R1. **Preset selection** — Daily preset buttons must have **bounded height**; active state (border/background) must hug content, not stretch into tall strips within the grid row.
- R2. **Yearly stepper** — The number field between **−** / **+** must remain **readable width** at all modal breakpoints (no collapsed “sliver”).
- R3. **Viewport fit** — Dialog must **fit within the viewport** (max height + scroll as needed) on short screens and mobile; no clipped primary actions.
- R4. **Polish** — Improve subtitle ↔ quote spacing, daily header row alignment, heatmap legend breathing room (crowded “LESS … MORE”), footer alignment consistent with dialog padding.
- R5. **No behavior regressions** — Save, cancel, clear, and all existing controls behave the same.

## Scope Boundaries

- **In scope:** `ReadingGoalSettings`, optional small tweak to `CalendarHeatMap` legend row, tests that guard layout/visibility.
- **Out of scope:** Copy changes, new fields, API/store schema, ProgressRing math, heatmap data logic.

## Context & Research

### Relevant Code and Patterns

- **Dialog shell:** `DialogContent` merges `className`; base includes `grid`, `gap-4`, `max-w-[calc(100%-2rem)]`, `sm:max-w-lg`. Call site uses `rounded-2xl max-w-4xl` only — **layout mode stays grid** unless overridden. Prefer explicit **`flex flex-col max-h-[…] overflow-y-auto`** (or inner scroll region) so structure matches other tall modals and scrolling is predictable.
- **Preset grid:** `grid grid-cols-2 sm:grid-cols-4` with **default grid item stretch**; buttons use `flex flex-col` — row-equal heights can produce **tall cells** and prominent active borders. Fix: **`items-start`** on the preset grid and/or **`self-start w-full`** / **`h-auto`** on preset `<button>`s so height follows content.
- **Yearly row:** `flex items-center gap-3` with middle `flex-1` wrapping `Input` (`w-full min-w-0` in `input.tsx`). If a flex basis bug appears in nested flex/grid contexts, add **`min-w-[theme/size]`** (e.g. `min-w-16`–`min-w-24`) on the wrapper or input so the control cannot collapse below a readable width.
- **Heatmap:** `CalendarHeatMap` legend uses `flex justify-between` with tight label + “Less … More”; add **`gap-2`**, **`flex-wrap`**, or stack on **`xs`** if needed.
- **Institutional learnings:** Flex/grid interaction can cause misleading visuals (see `docs/solutions/ui-bugs/audiobook-cover-letterbox-flex-compression-2026-04-25.md`) — verify with **bounding box** or layout assertions, not class names alone.

### Institutional Learnings

- Tailwind v4 requires **literal class strings** for JIT (`docs/solutions/best-practices/tailwind-v4-jit-class-literal-resolver-2026-04-25.md`) — avoid dynamic `grid-cols-${n}`; this change should use static utilities only.

### External References

- None required — local shadcn Dialog + Tailwind patterns are sufficient.

## Key Technical Decisions

- **Decision:** Override `DialogContent` display/scroll for this dialog only (`flex flex-col`, `max-h-[min(90dvh,…)]`, `overflow-y-auto`), merged via existing `className` so global `dialog.tsx` stays unchanged unless a second modal needs the same pattern (then consider a shared variant later).
- **Decision:** Fix preset stretch with **grid `items-start`** and **explicit button sizing** rather than fixed pixel heights — preserves responsive presets.
- **Decision:** Add **one** regression test (E2E or RTL) that opens Reading Goals and asserts layout invariants (e.g. dialog visible, yearly input **bounding width** ≥ threshold, preset buttons’ **height/width ratio** reasonable) to avoid repeat of silent layout breakage.

## Open Questions

### Resolved During Planning

- **Root cause of tall presets?** Grid row stretch + full-height buttons in preset grid; address with `items-start` / `self-start` / `h-auto`.
- **Why yearly input sliver?** Collapsing flex track or grid ancestry — guard with `min-w-*` on middle column; verify after dialog `flex` fix.

### Deferred to Implementation

- Exact `max-h` token (`90dvh` vs `90vh`) — pick after visual check on iOS safe-area if needed.

## Implementation Units

- [ ] **Unit 1: Dialog shell and scrolling**

- **Goal:** Modal fits viewport; body scrolls; actions remain reachable.
- **Requirements:** R3, R5
- **Dependencies:** None
- **Files:**
  - Modify: `src/app/components/library/ReadingGoalSettings.tsx`
- **Approach:**
  - Extend `DialogContent` `className` so **`flex flex-col`** wins over base `grid` (tailwind-merge), set **`max-h-[min(90dvh,960px)]`** (or equivalent), **`overflow-y-auto`**, keep **`max-w-4xl`** and horizontal margin from base `max-w-[calc(100%-2rem)]`.
  - Optional: **`min-h-0`** on a middle wrapper if a child flex prevents scrolling.
- **Patterns to follow:** Other dialogs that use long bodies + `overflow-y-auto` (grep `DialogContent` in repo).
- **Test scenarios:**
  - **Happy path:** Open Reading Goals on a short viewport (Playwright viewport height ~600); dialog scrolls, Save/Cancel visible after scroll.
  - **Edge case:** `max-w-4xl` still respects horizontal `calc(100%-2rem)` on narrow screens.
- **Verification:** Manual + E2E viewport scenario; no horizontal overflow on 320px width.

- [ ] **Unit 2: Preset grid, yearly stepper, and visual polish**

- **Goal:** Correct proportions for presets and yearly control; minor spacing fixes.
- **Requirements:** R1, R2, R4, R5
- **Dependencies:** Unit 1 (or parallel if careful — same file; prefer sequential to avoid merge conflicts)
- **Files:**
  - Modify: `src/app/components/library/ReadingGoalSettings.tsx`
  - Modify: `src/app/components/library/CalendarHeatMap.tsx` (legend spacing only if still tight)
- **Approach:**
  - Preset container: **`items-start`**; buttons **`self-start w-full`**, optional **`min-h-0`**; ensure active border wraps content height.
  - Yearly row: middle column **`min-w-20`** (or similar) + confirm **`Input`** fills; disable flex shrink on icon buttons already `size-11`.
  - Header: add **`mt-1`** or **`space-y-1`** between description and quote; daily section title row: **`items-baseline`** or **`items-center`** for “30 minutes” label.
  - `ProgressRing` container: **`max-w-full`** / scale down on **`sm`** if ring clips.
- **Patterns to follow:** Existing `cn()` and `Button`/`Input` usage in same file.
- **Test scenarios:**
  - **Happy path:** Select preset 30 minutes — button bounding box height within reasonable range vs width (E2E `boundingBox()` or RTL).
  - **Happy path:** Yearly input shows full number (e.g. `12`–`365`) without clipping.
  - **Edge case:** Switch minutes ↔ pages; presets reflow without overlap.
- **Verification:** Matches screenshot expectations; no stretched active state.

- [ ] **Unit 3: Regression coverage**

- **Goal:** Lock layout behavior so flex/grid changes do not regress unnoticed.
- **Requirements:** R1–R5
- **Dependencies:** Units 1–2
- **Files:**
  - Create or modify: `tests/e2e/...` (new spec or extend Library regression) **or** `src/app/components/library/__tests__/ReadingGoalSettings.test.tsx` if RTL layout assertions are enough.
- **Approach:**
  - E2E: navigate Library → open Reading Goals (match trigger: text **“Reading Goals”** or `data-testid` if present — add **`data-testid`** on trigger only if missing and stable).
  - Assert dialog **`getByRole('dialog')`**, yearly input width, at least one preset control geometry.
- **Patterns to follow:** `tests/support/fixtures`, guest/session setup per `CLAUDE.md` for Library routes.
- **Test scenarios:**
  - **Integration:** Open dialog → preset grid and yearly stepper visible → save still closes dialog (optional smoke).
- **Verification:** New test passes in CI.

## System-Wide Impact

- **Interaction graph:** Library header control → `ReadingGoalSettings` only.
- **Error propagation:** None.
- **State lifecycle:** Unchanged (`useReadingGoalStore`).
- **Unchanged invariants:** Storage key, goal shape, toast copy.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `flex` override fights `DialogContent` base utilities | Pass conflicting utilities in `className` last; verify merged output in devtools |
| Playwright flakiness on bounding boxes | Use generous thresholds or `toBeGreaterThan` on width only |

## Documentation / Operational Notes

- None unless post-merge design review notes the modal pattern.

## Sources & References

- **Origin document:** None (no matching `docs/brainstorms/*-requirements.md` for this dialog).
- Related code: `src/app/components/library/ReadingGoalSettings.tsx`, `src/app/components/ui/dialog.tsx`, `src/app/components/library/CalendarHeatMap.tsx`, `src/app/pages/Library.tsx`
- Related story: `docs/implementation-artifacts/stories/E86-S05-reading-goals.md`
