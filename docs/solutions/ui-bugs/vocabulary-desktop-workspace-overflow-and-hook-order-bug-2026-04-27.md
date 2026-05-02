---
title: Vocabulary desktop workspace overflow + hook-order crash fix
date: 2026-04-27
category: ui-bugs
module: vocabulary
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Selected phrase / long text overflowed horizontally on desktop, escaping the viewport"
  - "Mobile list clamping hid critical meaning with no way to view the full word/definition/context"
  - "Library media shelf row could crash on rerender due to a hook placed after an early return"
root_cause: logic_error
resolution_type: code_fix
severity: high
related_components:
  - library
  - tailwind-v4
  - testing_framework
tags:
  - vocabulary
  - overflow
  - overflow-wrap
  - line-clamp
  - responsive-layout
  - sticky-rail
  - react-hooks
  - playwright
---

# Vocabulary desktop workspace overflow + hook-order crash fix

## Problem

The Vocabulary page (`/vocabulary`) could visually break on real content: long saved phrases (word/definition/context/book title) could force horizontal overflow beyond the viewport. While hardening this UI, two correctness bugs were also found and fixed:

- `LibraryMediaShelfRow` violated the Rules of Hooks (hook after early return) and could crash on empty → non-empty transitions.
- Vocabulary review mode could fall through to list UI while still in `viewMode="review"` if the reviewable set changed mid-session.

## Symptoms

- Horizontal scrolling / clipped layout in Vocabulary when content was long or had few break opportunities.
- Clamping alone made rows visually tidy but hid meaning on mobile, where the desktop right rail isn’t available.
- React runtime error in the Library media shelf row when rerendering across empty/non-empty children.
- Vocabulary could show list UI while still “in review” (inconsistent state) when the current review item disappeared.

## What Didn't Work

- **Relying on default wrapping** (or only `break-words`) wasn’t sufficient for worst-case strings. Some tokens still expand a flex/grid container if there are no usable soft breaks.
- **Clamping-only** prevented overflow but created a product bug on small screens: users couldn’t reliably see the full word/definition/context.

## Solution

### 1) Make long text unbreakable-safe everywhere it renders

Use Tailwind `break-words` plus `[overflow-wrap:anywhere]` on the actual text nodes, and clamp only where appropriate to keep dense lists tidy.

- List card (`VocabularyCard`): `src/app/components/vocabulary/VocabularyCard.tsx`
- Review card (`ReviewCard`): `src/app/components/vocabulary/ReviewCard.tsx`

### 2) Use desktop width intentionally (two-pane list + sticky right rail)

On `lg+`, render a two-pane grid: left list + sticky right rail (`data-testid="vocabulary-rail"`). Keep list rows compact (clamp) and show the selected item’s full details (wrap-first) in the rail.

- `src/app/pages/Vocabulary.tsx`

### 3) Preserve meaning on mobile with a details dialog (not just unclamping)

On non-desktop viewports, selecting an item opens a details dialog with full wrapping so clamping never blocks comprehension.

- `src/app/components/vocabulary/VocabularyDetailsDialog.tsx`

### 4) Fix the correctness edge cases

- **Rules of Hooks crash**: ensure hooks run unconditionally in `LibraryMediaShelfRow` by moving derived children computation above effects and only returning `null` after hooks.
  - `src/app/components/library/LibraryMediaShelfRow.tsx`
  - Regression test: `src/app/components/library/__tests__/LibraryMediaShelfRow.test.tsx`

- **Review-mode fall-through**: if `viewMode === "review"` but the current review item becomes unavailable (reviewable set changed), force exit review mode consistently.
  - `src/app/pages/Vocabulary.tsx`

### 5) Add regression coverage for overflow

Add a Playwright E2E test that seeds a long vocabulary item and asserts **no horizontal overflow**, including nested scroll containers, not just the document root.

- `tests/e2e/vocabulary.spec.ts`

## Why This Works

- `[overflow-wrap:anywhere]` is the “never overflow” escape hatch: it forces breaks even for long unbroken tokens and prevents flex/grid containers from expanding horizontally.
- Keeping clamping in dense surfaces (list/review) while adding a **details surface** (rail/dialog) avoids the “tidy but unusable” trap.
- The hook-order fix restores stable hook execution across renders, preventing React’s “rendered fewer hooks than expected” class of crashes.
- The review-mode guard ensures UI mode stays coherent even when the underlying reviewable set changes due to store updates.

## Prevention

- **UI overflow**: Any time a page displays user-sourced or imported text in a constrained layout, apply `min-w-0` to shrinking flex children and use `break-words` + `[overflow-wrap:anywhere]` on long text nodes. Pair `line-clamp-*` with a way to view full content (rail/dialog).
- **Hooks safety**: Never place hooks after an early return. If you need an “empty state returns null”, compute emptiness early but keep the hooks unconditional; gate behavior inside the effect/callback.
- **Regression tests**:
  - `tests/e2e/vocabulary.spec.ts` guards horizontal overflow (document + `main#main-content` + any substantial overflowing element).
  - `src/app/components/library/__tests__/LibraryMediaShelfRow.test.tsx` guards hook-order regressions on empty ↔ non-empty rerenders.

## Related Issues

- `docs/solutions/ui-bugs/audiobook-cover-letterbox-flex-compression-2026-04-25.md` (similar class of “Tailwind looks right, layout constraints are wrong”; uses geometry-style assertions)
