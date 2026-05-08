---
title: Reading Goals modal stretched presets and collapsed yearly field (Library)
date: 2026-05-08
category: ui-bugs
module: library
problem_type: ui_bug
component: react
symptoms:
  - Daily preset buttons showed tall active highlights (border filled a stretched cell)
  - Yearly book count input appeared as a narrow vertical sliver between steppers
  - Modal body overflowed short viewports; footer actions could scroll out of reach
  - Heatmap legend "Less / More" crowded the section title
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components:
  - library
  - shadcn-dialog
  - tailwind-v4
tags:
  - dialog
  - flexbox
  - css-grid
  - playwright
  - reading-goals
---

# Reading Goals modal stretched presets and collapsed yearly field (Library)

## Problem

On Library → **Reading goals**, the settings dialog in [`src/app/components/library/ReadingGoalSettings.tsx`](../../../src/app/components/library/ReadingGoalSettings.tsx) rendered with broken proportions: preset tiles stretched vertically, the yearly numeric field collapsed, and long content did not fit smaller viewports cleanly.

## Root cause

1. **`DialogContent`** from [`src/app/components/ui/dialog.tsx`](../../../src/app/components/ui/dialog.tsx) defaults to **`display: grid`**. The dialog body used nested grids; preset buttons lived in a row-stretched grid without **`items-start`**, so cells grew to the row height and the bordered buttons looked like tall strips.
2. The yearly **`- | input | +`** row used **`flex-1`** on the middle column without a **`min-width`** guard; combined with nested **`min-w-0`** behavior on inputs, the field could shrink to a sliver.
3. No **`max-height` / scroll** region: the footer sat in the same flow as a tall body, so short viewports hid primary actions.
4. [`CalendarHeatMap`](../../../src/app/components/library/CalendarHeatMap.tsx) legend used a single tight **`justify-between`** row.

## Solution

- Override this dialog’s `DialogContent` **`className`** with **`flex flex-col`**, **`max-h-[min(90dvh,960px)]`**, **`min-h-0`**, **`overflow-hidden`**, and move scroll to an inner **`flex-1 min-h-0 overflow-y-auto`** wrapper so **Cancel / Save** stay pinned above the fold.
- Preset grid: **`items-start`**; buttons **`h-auto w-full self-start`** and **`type="button"`**; daily type toggles also **`type="button"`**.
- Yearly row: **`min-w-0`** on the flex row, **`shrink-0`** on icon buttons, **`min-w-24 flex-1`** on the input wrapper.
- Remove **`sticky`** on the yearly card (scroll is the dialog body, not the page).
- Heatmap legend: **`flex-wrap`**, **`gap-x-4 gap-y-2`**, **`shrink-0`** labels.
- **`data-testid="reading-goals-dialog"`**, **`library-reading-goals-trigger`**, **`library-reading-goals-menu-item`** for automation.

## Why this works

Tailwind **`flex`** on the shell (merged after the base **`grid`**) yields a predictable column: header + quote (shrink‑0) + scrollable main + footer (shrink‑0). **`items-start`** on the preset grid stops grid tracks from forcing equal row heights on the buttons. **`min-w-24`** guarantees a readable input track. Inner scroll avoids Radix dialog clipping while keeping actions visible.

## Prevention

- When a **`DialogContent`** holds a tall layout, prefer **`flex flex-col`** + **`min-h-0`** scroll child rather than relying on default **`grid`** children stretching.
- For **grids of selectable cards**, use **`items-start`** (or **`self-start`** on items) when card height should follow content.
- In **`flex`** rows with **`flex-1`** inputs, keep **`min-w-*`** or **`min-w-0`** paired deliberately and test **`boundingBox()`** in Playwright.
- Add E2E geometry checks when a bug was purely layout (see [`tests/e2e/library-reading-goals-modal.spec.ts`](../../../tests/e2e/library-reading-goals-modal.spec.ts)).

## Tests

- [`tests/e2e/library-reading-goals-modal.spec.ts`](../../../tests/e2e/library-reading-goals-modal.spec.ts) — desktop/tablet/mobile projects; **`goto /library` → seed → reload`** avoids RouteGuard redirects; asserts yearly width, preset height band, footer visibility, mobile overflow path.
