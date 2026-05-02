---
title: "feat: E66-S05 Focus Indicator Enhancement and Compliance Audit"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e66-s05-focus-indicator-enhancement-requirements.md
---

# feat: E66-S05 Focus Indicator Enhancement and Compliance Audit

## Overview

Bring keyboard focus indicators to WCAG 2.4.13 (AAA) compliance in Knowlune by introducing a dedicated `--focus-ring` token, normalizing global and component-level focus styles, and adding an automated audit test that catches future regressions in both light and dark themes.

## Problem Frame

Today's `--ring` token is shared between many shadcn ring usages. Dark mode `--ring` (`oklch(0.45 0.05 270)`) is suspected to fail 3:1 contrast against `--card` and several muted surfaces. Some primitives use `outline-none` and rely on background-only focus signals. We need an additive, low-blast-radius fix plus an automated guardrail. (See origin: [docs/brainstorms/2026-04-25-e66-s05-focus-indicator-enhancement-requirements.md](../brainstorms/2026-04-25-e66-s05-focus-indicator-enhancement-requirements.md).)

## Requirements Trace

- R1 (AC1, AC6): Global focus outline meets 3:1 contrast vs `--background`, `--card`, `--muted`, `--accent`, `--brand-soft` in light + dark themes.
- R2 (AC2): Overview page focusable elements show a >= 2px perimeter focus indicator.
- R3 (AC3): shadcn primitives that override focus styles meet the same 3:1 / 2px bar.
- R4 (AC4): Custom components in `figma/` and pages do not regress focus visibility.
- R5 (AC5): Automated focus-indicator audit test exists, runs across major routes, both themes, reports specific non-compliant elements.
- R6: All elements flagged by the audit are fixed before merge.

## Scope Boundaries

- No animation redesign of focus indicators beyond what compliance requires.
- No restructuring of shadcn primitives outside focus styles.
- Do not change `--ring` itself globally; introduce additive `--focus-ring` token instead.
- Clean theme (E100) tokens are also updated to keep parity but no visual identity change for that scheme.

### Deferred to Separate Tasks

- Broader a11y work for E66 (target size, drag, auth, focus-not-obscured) is owned by sibling stories.

## Context & Research

### Relevant Code and Patterns

- `src/styles/theme.css` — token definitions; `--ring` defined at lines 43, 142 (light/dark) and 376/443 (clean).
- `src/styles/tailwind.css` — Tailwind theme map (`--color-ring: var(--ring)` ~line 565); global focus rules ~line 657 (`*:focus-visible`, `button:focus-visible`, `a:focus-visible`, `[role='button']:focus-visible`).
- `src/styles/animations.css` ~line 208 — `.focus-ring-enhanced:focus-visible` uses `outline: 2px solid var(--brand)`.
- `src/app/components/ui/` — shadcn primitives; review for `focus-visible:`, `focus:`, `outline-none`.
- `tests/audit/focus-not-obscured.spec.ts` — sibling audit pattern (E66-S03) for tabbing across routes; reuse helpers and structure.
- `tests/helpers/dismiss-onboarding.ts` — onboarding dismissal helper.

### Institutional Learnings

- `docs/solutions/` — prior a11y stories used additive tokens (e.g., `--brand-soft-foreground`) rather than mutating shared tokens to avoid regression blast radius.
- E66-S03 plan at `docs/plans/2026-04-25-001-feat-e66-s03-focus-not-obscured-plan.md` — established the per-route tab walker pattern.

### External References

- WCAG 2.4.13 Focus Appearance (AAA): minimum perimeter 2px and 3:1 contrast vs adjacent colors.
- Resolving `getComputedStyle(...).outlineColor` returns sRGB (`rgb(...)`) regardless of OKLCH source — safe to use directly in luminance math.

## Key Technical Decisions

- **Additive token**: introduce `--focus-ring` (with light, dark, clean light, clean dark variants) and Tailwind mapping `--color-focus-ring`. Keep `--ring` untouched to avoid affecting non-focus ring usages.
- **Global rule update**: rewrite `*:focus-visible` rule in `tailwind.css` to use `outline: 2px solid var(--focus-ring); outline-offset: 2px;` and drop `outline-none` overrides.
- **shadcn audit policy**: where a primitive uses `focus-visible:ring-ring` keep the ring class but ALSO ensure outline fallback via global rule (no `outline-none`). Where primitive uses `outline-none` without compliant replacement, replace with `focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2`.
- **Audit math**: in-browser `getComputedStyle` reads outline-color and box-shadow as sRGB. Compute luminance via WCAG formula. Walk DOM ancestors for first non-transparent background color; calculate ratio against that.
- **Both indicators counted**: audit accepts compliance via either `outline` (>=2px solid, 3:1) OR `box-shadow` ring (`0 0 0 Npx color` with N>=2 and 3:1).
- **Token values** (initial proposal — finalize during work via measurement):
  - Light `--focus-ring`: `oklch(0.45 0.18 265)` (deep brand-leaning blue, >=3:1 against cream + cards).
  - Dark `--focus-ring`: `oklch(0.78 0.16 265)` (light blue, >=3:1 against `--card` and `--background`).
  - Clean light/dark: reuse Apple blue `#005bc1` / `#4da3ff` (already passes).

## Open Questions

### Resolved During Planning

- "Modify `--ring` or add `--focus-ring`?" → Add `--focus-ring`. Lower blast radius and keeps shadcn ring semantics intact.
- "Detect outline OR box-shadow?" → Both, since some primitives use box-shadow rings.

### Deferred to Implementation

- Final OKLCH values for `--focus-ring` in light/dark default themes — requires programmatic contrast measurement against all five reference backgrounds; resolve in Unit 1.
- Specific shadcn primitives needing fixes — enumerated by Unit 3's grep + manual triage.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
theme.css ──▶ defines --focus-ring (light, dark, clean light, clean dark)
   │
tailwind.css ──▶ maps --color-focus-ring; rewrites *:focus-visible to use outline: 2px solid var(--focus-ring)
   │
shadcn/ui primitives (button.tsx, input.tsx, ...) ──▶ removed `outline-none` w/o replacement
   │
focus-indicators.spec.ts ──▶ tab through routes × themes
                              ├─ read getComputedStyle(activeElement).outline*, box-shadow
                              ├─ resolve effective background color via ancestor walk
                              ├─ compute WCAG contrast ratio
                              └─ assert outline-width >= 2 AND ratio >= 3.0
```

## Implementation Units

- [ ] **Unit 1: Add `--focus-ring` token and Tailwind mapping**

**Goal:** Introduce dedicated focus-ring token across all four theme variants and expose it via Tailwind.

**Requirements:** R1, R6

**Dependencies:** None

**Files:**
- Modify: `src/styles/theme.css`
- Modify: `src/styles/tailwind.css`

**Approach:**
- In `theme.css`, add `--focus-ring` to the four theme blocks: default `:root` (light), `.dark` block, `.clean` block, `.clean.dark` block.
- In `tailwind.css` `@theme` block, add `--color-focus-ring: var(--focus-ring);` near the existing `--color-ring` mapping.
- Pick initial values per Key Technical Decisions; validate by computing WCAG contrast against `--background`, `--card`, `--muted`, `--accent`, `--brand-soft` for each theme. Adjust until all >= 3:1.
- Document the token with a brief comment block explaining the WCAG 2.4.13 purpose and that it is intentionally separate from `--ring`.

**Patterns to follow:**
- Existing additive tokens like `--brand-soft-foreground` in `theme.css`.

**Test scenarios:**
- Test expectation: none -- styling token addition; behavior verified through Unit 5's audit test.

**Verification:**
- All four theme variants define `--focus-ring`.
- `bg-focus-ring`, `text-focus-ring`, `outline-focus-ring`, `ring-focus-ring` Tailwind utilities resolve.

- [ ] **Unit 2: Update global focus-visible rule**

**Goal:** Make the global `*:focus-visible` rule use `--focus-ring` with a 2px outline and 2px offset, removing the `outline-ring/50` border-only treatment for focus.

**Requirements:** R1, R2

**Dependencies:** Unit 1

**Files:**
- Modify: `src/styles/tailwind.css`
- Modify: `src/styles/animations.css` (align `.focus-ring-enhanced` if needed)

**Approach:**
- Replace the existing `*:focus-visible` block (~tailwind.css:660) with `outline: 2px solid var(--focus-ring); outline-offset: 2px;`.
- Keep specialized `button/a/[role=button]:focus-visible` rule but ensure it does not set `outline: none`.
- Update `.focus-ring-enhanced:focus-visible` in `animations.css` to use `var(--focus-ring)` for consistency (currently `var(--brand)`).

**Patterns to follow:**
- Current rule structure in `tailwind.css` ~lines 655–680.

**Test scenarios:**
- Happy path: After global rule update, default focus indicator on `<button>` resolves to `outline: 2px solid <focus-ring color>` per `getComputedStyle`.
- Edge: An `<a>` with no explicit focus override still inherits the global outline.

**Verification:**
- Manual tab through Overview shows visible outlines on all controls.
- No element shows `outline-style: none` on focus-visible (asserted by Unit 5 audit).

- [ ] **Unit 3: Remediate shadcn primitive focus overrides**

**Goal:** Find all `outline-none` / `outline: 0` overrides in `src/app/components/ui/` that are not paired with a compliant visible alternative, and fix them.

**Requirements:** R3

**Dependencies:** Units 1, 2

**Files:**
- Modify (as identified): `src/app/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `checkbox.tsx`, `switch.tsx`, `radio-group.tsx`, `tabs.tsx`, `accordion.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `navigation-menu.tsx`, `dialog.tsx`, others surfaced by grep.

**Approach:**
- Grep `src/app/components/ui/` for `outline-none`, `outline:0`, `focus-visible:`, `focus:`. Catalog each occurrence.
- For each: keep ring-based focus where it already passes contrast (use `ring-focus-ring` instead of `ring-ring` when needed); ensure no `outline-none` exists without a compliant `focus-visible:` outline / box-shadow replacement.
- Prefer adding `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]` where ring approach is brittle (e.g., dropdown items currently relying on `bg-accent` only).
- Where existing ring tokens already pass after Unit 1/2 (because outline now wins), leave class lists untouched.

**Patterns to follow:**
- shadcn idioms already used in `button.tsx` for ring-based focus.
- Class composition via `cn()` from `src/lib/utils.ts`.

**Test scenarios:**
- Integration: Tab to a `DropdownMenuItem` — focused item shows visible outline OR box-shadow ring meeting 2px / 3:1 (asserted by Unit 5).
- Integration: Focused `<Input>` shows a perceptible focus indicator distinct from hover state.
- Edge: `Tabs` trigger at active state still shows focus when keyboard-focused (focus + selected state coexist).

**Verification:**
- Audit test from Unit 5 reports zero non-compliant elements across enumerated routes.

- [ ] **Unit 4: Sweep custom components and pages**

**Goal:** Catch any custom focus overrides in `src/app/components/figma/` and page-level components.

**Requirements:** R4

**Dependencies:** Unit 2

**Files:**
- Review/modify as needed in `src/app/components/figma/**` and `src/app/pages/**`.

**Approach:**
- Grep for `outline-none`, `focus-visible:` outside `components/ui/`. Review each.
- Ensure any custom focus class composes with global outline (do not strip outline) or supplies a compliant alternative.

**Test scenarios:**
- Test expectation: none directly -- coverage rolled up into Unit 5 audit per route.

**Verification:**
- Audit finds no non-compliant custom-component focuses.

- [ ] **Unit 5: Automated focus-indicator audit test**

**Goal:** Add a Playwright audit that walks tab order across major routes in both themes and asserts each focused element has a compliant indicator.

**Requirements:** R5, R6

**Dependencies:** Units 1–4 (test must pass)

**Files:**
- Create: `tests/audit/focus-indicators.spec.ts`
- Reuse: `tests/helpers/dismiss-onboarding.ts`

**Approach:**
- Mirror structure of `tests/audit/focus-not-obscured.spec.ts`.
- Routes: `/`, `/my-class`, `/courses`, `/reports`, `/settings`. Two themes: default (light) and `.dark` toggled on `<html>`.
- Helper `getFocusIndicatorReport(page)` runs in `page.evaluate()`:
  - Reads `getComputedStyle(active)` and parses `outline-width`, `outline-style`, `outline-color`, plus `box-shadow`.
  - Walks ancestors to find first non-transparent `background-color` (sRGB).
  - Computes WCAG luminance + contrast ratio.
  - Returns `{ selector, outlineWidthPx, outlineStyle, contrastRatio, mechanism: 'outline'|'box-shadow'|'none' }`.
- Test loops `Tab` up to MAX_TABS=50 per route, collects findings, fails with a structured list of non-compliant entries (page, selector, mechanism, width, ratio).
- Toggle theme by `await page.evaluate(() => document.documentElement.classList.add('dark'))` between halves.

**Patterns to follow:**
- Tab walker + finding aggregation pattern in `tests/audit/focus-not-obscured.spec.ts`.
- Sidebar localStorage seed pattern from test-patterns guidance to avoid mobile sheet overlay (desktop viewport here, but stay defensive).

**Test scenarios:**
- Happy path: Default theme, `/` route — every focused element reports outline-width >= 2 AND contrast >= 3.0.
- Happy path: Dark theme, `/courses` — same expectation.
- Edge: Element with `outline-style: none` but `box-shadow: 0 0 0 2px <color>` — counted via box-shadow mechanism.
- Edge: Element with transparent background (e.g., overlay button) — ancestor walk resolves a concrete background before computing contrast.
- Error path: A deliberately non-compliant element (validated by manual test fixture or by failing the assertion when introduced) produces a clear, actionable failure message including selector.
- Integration: Theme toggling between halves of the spec does not leak focus state across routes.

**Verification:**
- `npx playwright test tests/audit/focus-indicators.spec.ts --project=chromium` passes.
- Failure output, when forced (e.g., temporarily setting `outline: none` on a button), lists the offending selector and computed values.

## System-Wide Impact

- **Interaction graph:** All keyboard-focusable elements globally — buttons, links, inputs, custom roles. Outline now layers on top of any existing ring/box-shadow.
- **Error propagation:** N/A (CSS + test).
- **State lifecycle risks:** None.
- **API surface parity:** No JS API change. Tailwind utility additions are additive.
- **Integration coverage:** Audit test covers main routes × both themes. Not full route enumeration (intentional, mirrors sibling audits).
- **Unchanged invariants:** `--ring` token value unchanged; existing ring usages on non-focus surfaces are unaffected. Light theme visual identity unchanged outside focus state.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| New focus-ring color clashes visually with brand palette in light theme | Pick value within brand hue family; review during work; restrict to focus-visible state only. |
| Audit flake from animation/transition timing on focus | Use Playwright auto-wait via `page.keyboard.press('Tab')` and read style synchronously inside `evaluate`; no `waitForTimeout`. |
| Visual snapshot tests elsewhere drift due to outline thickness change | Outline already 2px in many components; if snapshot diffs occur, update snapshots in same PR. |
| OKLCH→sRGB conversion mismatch | Use `getComputedStyle` which already returns sRGB; do not parse OKLCH manually. |
| Box-shadow parsing complexity | Limit detection to leading `0 0 0 Npx <color>` pattern; treat unparseable shadows conservatively (require outline as fallback). |

## Documentation / Operational Notes

- Add a brief comment in `theme.css` near `--focus-ring` describing the WCAG 2.4.13 rationale.
- No runtime ops impact.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-25-e66-s05-focus-indicator-enhancement-requirements.md](../brainstorms/2026-04-25-e66-s05-focus-indicator-enhancement-requirements.md)
- Sibling plan: [docs/plans/2026-04-25-001-feat-e66-s03-focus-not-obscured-plan.md](2026-04-25-001-feat-e66-s03-focus-not-obscured-plan.md)
- Code: `src/styles/theme.css`, `src/styles/tailwind.css`, `src/styles/animations.css`
- Test pattern: `tests/audit/focus-not-obscured.spec.ts`
- Standard: WCAG 2.4.13 Focus Appearance (AAA)
