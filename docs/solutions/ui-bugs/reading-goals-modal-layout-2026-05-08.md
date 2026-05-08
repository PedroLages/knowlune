---
title: Reading Goals modal stretched presets and collapsed yearly field (Library)
date: 2026-05-08
last_updated: 2026-05-08
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

## Symptoms

- Active preset state looked like a **tall narrow** outline instead of a card hugging the number.
- **Yearly** `− | [input] | +` row: middle field **too narrow** to read the digit(s).
- On **short viewports**, primary actions at the bottom were **hard to reach** without awkward page-level scroll.
- **Past 13 weeks** heatmap: **Less … More** legend collided with the section label.

## What didn't work / false leads

- Treating the issue as **missing Tailwind utilities** in the bundle — the classes were present; layout was **grid/flex interaction**, not JIT drops (contrast: [tailwind-v4-jit-class-literal-resolver](../best-practices/tailwind-v4-jit-class-literal-resolver-2026-04-25.md) for dynamic class strings).
- Putting **`overflow-y-auto`** only on the outer **`DialogContent`** without **`flex` + `min-h-0`** discipline — scroll region and footer pinning still fight Radix’s **`fixed` + translate** centering unless the shell is explicitly **`flex flex-col`** with a **middle** scroll child.

## Root cause

1. **`DialogContent`** in [`src/app/components/ui/dialog.tsx`](../../../src/app/components/ui/dialog.tsx) defaults to **`display: grid`**. Nested grids **stretch** row heights by default; preset **`<button>`** cells grew to match the row, so borders traced **over-tall** frames.
2. The yearly row used **`flex-1`** on the middle column **without** a **`min-width` floor**; with flex **`min-w-auto`** defaults, the **number input** could shrink to a sliver.
3. Tall body + **footer in the same scroll flow** → short screens **hide** Cancel/Save.
4. [`CalendarHeatMap`](../../../src/app/components/library/CalendarHeatMap.tsx) legend used a single tight **`justify-between`** row with no **wrap / gap** breathing room.

Supplementary tone context from review memory: sub-44px targets and **`cn()`** usage are recurring themes elsewhere (auto memory [claude] — see [.claude/agent-memory/code-review/MEMORY.md](../../../.claude/agent-memory/code-review/MEMORY.md)); this fix explicitly used **`min-h-[44px]`** on type toggles and **`type="button"`** on interactive buttons.

## Solution

1. **Dialog shell** — On this instance only, pass **`className`** so **`flex flex-col`**, **`max-h-[min(90dvh,960px)]`**, **`min-h-0`**, **`overflow-hidden`** win over the base **`grid`** (tailwind-merge). Structure: **header + quote (`shrink-0`) → scrollable body (`flex-1 min-h-0 overflow-y-auto`) → footer (`shrink-0`, top border)**.
2. **Presets** — Grid **`items-start`**; buttons **`h-auto w-full self-start`**, **`type="button"`**; minutes/type radios **`type="button"`** too.
3. **Yearly stepper** — Row **`min-w-0`**; icon buttons **`shrink-0`**; middle wrapper **`min-w-24 flex-1`**.
4. **Yearly card** — Drop **`sticky`** (scroll container is the dialog body, not the page).
5. **Heatmap** — Legend **`flex-wrap`**, **`gap-x-4 gap-y-2`**, **`shrink-0`** on label spans.
6. **Automation** — **`data-testid="reading-goals-dialog"`**, **`library-reading-goals-trigger`**, **`library-reading-goals-menu-item`**.

## Why this works

**Flex column + `min-h-0`** is the same **viewport-safe modal shell** pattern documented for Authors ([`authors-sync-silent-reload-modal-layout-vitest-sonner-2026-05-04.md`](../developer-experience/authors-sync-silent-reload-modal-layout-vitest-sonner-2026-05-04.md)): outer shell **caps height** and **hides** overflow; **only** the middle region scrolls; footer stays reachable. **`items-start`** stops CSS Grid from **equalizing** row heights across cards when you want **content-sized** buttons.

## Prevention

- For **tall shadcn/Radix dialogs**, default to **column flex + middle scroll** + **`min-h-0`** on flex children — don’t rely on **`DialogContent`’s** default **`grid`** for complex layouts.
- For **grids of selectable cards**, use **`items-start`** / **`self-start`** when heights must follow content.
- For **`flex-1` + `<Input>`**, always sanity-check **`min-w-*`** on the wrapper and **`boundingBox()`** in Playwright for regressions.
- Library E2E: **`goto /library` → seed IndexedDB → `reload`** before opening UI that depends on books — avoids **RouteGuard** / redirect racing **`page.goto`** (Mobile Safari flaked when **`/` → `/library`** without reload).

## Tests

- [`tests/e2e/library-reading-goals-modal.spec.ts`](../../../tests/e2e/library-reading-goals-modal.spec.ts) — geometry assertions (yearly width, preset height band), short viewport **Save** visibility, mobile overflow menu path; runs across **chromium / Mobile Chrome / Mobile Safari / Tablet** projects.

## Related documentation

| Related | Relationship |
|---------|----------------|
| [Authors viewport-safe edit dialog](../developer-experience/authors-sync-silent-reload-modal-layout-vitest-sonner-2026-05-04.md) | **Moderate overlap** — same **flex column + `max-h` + inner scroll + pinned actions** recipe; different feature (Authors form vs Reading Goals). |
| [Audiobook cover letterbox / flex shrink](../ui-bugs/audiobook-cover-letterbox-flex-compression-2026-04-25.md) | **Low** — also flex/layout, but root cause was **`flex-shrink`** vs **`aspect-ratio`**, not dialog/grid. |
| [Tailwind v4 JIT literals](../best-practices/tailwind-v4-jit-class-literal-resolver-2026-04-25.md) | **Adjacent** — know when layout bugs are *not* missing CSS. |

GitHub issue search (`reading goals modal`): **no matching issues** returned in a quick `gh issue list` scan (2026-05-08).

## Compound metadata (Full pass)

- **Overlap vs prior artifact:** **High** with the lightweight version of this same file — this revision **supersedes** that content in place (richer sections, cross-links, `last_updated`).
- **`ce-compound-refresh`:** Not invoked — related docs above are **complementary**, not contradicted.
- **Session history synthesis:** Not run for this pass; say if you want a **Cursor session historian** pass merged into a future edit.

---

**What’s next?**

1. Continue workflow (e.g. open PR, merge)
2. Link from implementation story or plan if you track this fix there
3. Run `/ce-compound-refresh` with a narrow scope if you notice drift in dialog-layout docs
4. Re-read this file from `docs/solutions/ui-bugs/`
5. Other (describe)
