---
title: "fix: Restore full visibility of selected gradient preset rings in Change Cover dialog"
type: fix
status: active
date: 2026-05-08
---

# fix: Restore full visibility of selected gradient preset rings in Change Cover dialog

## Overview

In **Change Cover** (`PathCoverDialog`), the **selected** gradient preset tile shows a blue selection ring that is **cut off** on the bottom and right (and thin on top/bottom of the upload zone in some cases). The user asked to fix borders for **selected** squares/boxes — scoped here to the **gradient preset grid**; the dashed upload target is optional follow-up if clipping persists there separately.

## Problem Frame

Selection styling uses an **outer** Tailwind `ring` with `ring-offset` and `scale-105` on the selected preset. A prior fix (see [docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md](docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md), section 4) added **`overflow-hidden`** on the preset **grid** to clip box-model expansion and **eliminate spurious scrollbars** in the dialog. That **clips** anything that draws outside each cell — including the selection ring — so rings on edge and corner tiles look broken.

**Requirements trace**

- R1. Selected preset: selection indicator **fully visible** on all eight tiles (especially corners and right/bottom edges).
- R2. **No regression** of the 2026-05-05 behavior: dialog body should not gain **horizontal** (or spurious vertical) scrollbars when selecting or hovering presets.
- R3. Focus-visible affordance remains **visible and WCAG-consistent** with the rest of the app (keyboard users).

## Scope Boundaries

- **In scope:** Gradient preset grid in [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx) — selected-state visuals and grid container overflow.
- **Out of scope (unless verification shows a shared root cause):** Upload “Choose image file” dashed outline clipping; other dialogs.

### Deferred to Separate Tasks

- If upload area clipping is **independent** (e.g. scroll ancestor), track as a **separate one-line fix** after preset grid is resolved.

## Context & Research

### Relevant Code and Patterns

- [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx) — Preset grid at **`grid grid-cols-4 gap-2 overflow-hidden`**; buttons use **`ring-2 ring-brand ring-offset-1`** and **`scale-105`** when selected, **`focus-visible:ring-2 … ring-offset-2`**, **`hover:scale-105`** when not selected.
- [src/data/pathCoverGradients.ts](src/data/pathCoverGradients.ts) — unchanged; preset list is not part of this fix.
- Parallel patterns: [src/app/components/library/CoverSearchGrid.tsx](src/app/components/library/CoverSearchGrid.tsx) (selected `ring` + `border-brand`), [src/app/components/reader/ReaderSettingsPanel.tsx](src/app/components/reader/ReaderSettingsPanel.tsx) — inner selection rings; useful if choosing **border/ring-inset** instead of outer ring.

### Institutional Learnings

- **Scrollbar vs clip tradeoff:** Section 4 of [learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md](docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md) documents that **`ring-offset` + `scale`** expanded the box and caused scrollbars; **`overflow-hidden` on the grid** fixed scrollbars but **clips** overflow — which now surfaces as **invisible ring segments**. The replacement approach should **avoid outer overflow** without reintroducing scrollbars.
- [learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md) — related note on **ring-offset** and horizontal overflow at document level (less central here than grid clipping).

### External References

- None required; standard Tailwind v4 **`ring-inset`**, **`border`**, and layout containment are sufficient.

## Key Technical Decisions

1. **Prefer selection UI that does not extend outside the button’s border box** — e.g. **`ring-inset`** and/or **`border-2 border-brand`** (and matching `rounded-lg`), and **remove `scale-105` from the selected state** so the selected tile does not grow past grid tracks. This addresses R1 and reduces pressure to clip the grid (R2).
2. **Revisit `overflow-hidden` on the grid** — After (1), try **removing** `overflow-hidden`. If **hover** `scale-105` on unselected tiles still causes scrollbar or jitter, prefer **milder hover** (e.g. smaller scale or no scale) or **small symmetrical padding** on the grid (`p-0.5` / `gap` tweak) **before** re-applying `overflow-hidden`, to avoid re-breaking R1.
3. **Align `focus-visible` with selected** — avoid double-ring confusion; use inset ring or a single consistent pattern for **keyboard focus** vs **selected** ([docs/solutions/2026-04-25-focus-ring-token-additive-migration.md](docs/solutions/2026-04-25-focus-ring-token-additive-migration.md) is background on focus tokens).

## Open Questions

### Resolved During Planning

- **Why rings are clipped:** `overflow-hidden` on the preset grid plus outer `ring`/`ring-offset`/scale.
- **User scope:** **Selected** preset tiles first; upload dashed box only if still broken after grid fix.

### Deferred to Implementation

- Whether **hover scale** must be reduced once inset rings ship — validate in browser (R2).

## Implementation Units

- [x] **Unit 1: PathCoverDialog — preset selection and grid overflow**

**Goal:** Selected gradient tiles show a **fully visible** selection indicator; dialog does not exhibit **spurious scrollbars** when selecting or hovering presets.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/components/learning-path/PathCoverDialog.tsx`
- Test: `src/app/components/learning-path/__tests__/PathCoverDialog.test.tsx` (create)

**Approach:**

- Update selected-state classes: move to **inset** selection (`ring-inset` and/or **inner border**) and **drop `scale-105` from selected**; keep or soften hover scale per R2.
- Remove grid **`overflow-hidden`** if selection/hover no longer protrude; if scrollbars return, iterate per Key Technical Decisions (padding / milder hover) rather than defaulting back to clipping rings.
- Harmonize **`focus-visible`** styles with the new selected appearance (single clear focus ring strategy).

**Patterns to follow:** Other pickers using **border + ring** on selected cells (e.g. `CoverSearchGrid`, `ReaderSettingsPanel`).

**Test scenarios:**

- **Happy path:** Open dialog with a path; click a preset; `aria-pressed` is true for that button; selected styling applies (assert key class tokens or role/pressed, not pixel-perfect color).
- **Edge case:** Select the **last** preset (`rose-red`); still **save-enabled** and pressed state correct (covers corner tile without depending on screenshot).
- **Integration:** None required for pure presentation — if a snapshot test exists elsewhere for Learning Paths, optional smoke only.

**Verification:**

- Manually: open Change Cover, select **each corner preset**, confirm ring/border **fully visible**; resize viewport / keyboard Tab through grid — no **horizontal scrollbar** on dialog body and focus remains visible.

## System-Wide Impact

- **Unchanged invariants:** `updatePathCover`, upload/remove flows, `GRADIENT_PRESETS` data, card display in `PathCardHeader`.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Scrollbars return after removing grid `overflow-hidden` | Reduce hover scale, add grid padding, or inset-only rings; avoid re-clipping rings as first resort |
| Focus ring and selected state visually noisy | Single clear pattern (inset + aria-pressed); test keyboard |

## Sources & References

- **Prior scrollbar fix (context for overflow-hidden):** [docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md](docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md)
- **Component:** [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx)
