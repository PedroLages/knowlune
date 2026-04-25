# E66-S05 Focus Indicator Enhancement and Compliance Audit — Requirements Brief

**Source story:** [docs/implementation-artifacts/stories/E66-S05-focus-indicator-enhancement.md](../implementation-artifacts/stories/E66-S05-focus-indicator-enhancement.md)
**Date:** 2026-04-25
**Status:** ready-for-dev
**Standard targeted:** WCAG 2.4.13 Focus Appearance (AAA)

## Goal

Ensure every interactive element in Knowlune renders a focus indicator that is at least a 2px perimeter and meets a 3:1 contrast ratio against all adjacent backgrounds, in both light and dark themes. Provide an automated audit test that catches regressions.

## User Story

As a low-vision or keyboard-only user, I want focus indicators to be clearly visible with sufficient contrast, so that I can always see which element has keyboard focus.

## Acceptance Criteria

- **AC1 — Global outline contrast:** The global focus style (outline against `--background`, `--card`, `--muted`, `--accent`, `--brand-soft`) achieves >= 3:1 contrast in both light and dark themes.
- **AC2 — Overview page perimeter:** Tabbing through every interactive element on the Overview page produces a visible focus indicator with at least a 2px perimeter and visible contrast against the element background.
- **AC3 — shadcn override compliance:** Components in `src/app/components/ui/` that override focus styles (Button, Input, Select, Checkbox, Switch, Radio, Tabs, Accordion, DropdownMenu, ContextMenu, NavigationMenu, Dialog, etc.) meet the same 3:1 / 2px requirements.
- **AC4 — Custom component compliance:** Custom interactive components in `src/app/components/figma/` and page-level components have focus indicators consistent with the global style.
- **AC5 — Automated audit:** An E2E test (`tests/audit/focus-indicators.spec.ts`) tabs across major pages, captures computed outline/box-shadow per focused element, calculates contrast against parent background, and reports non-compliant elements. Test runs against both themes. All listed elements are fixed.
- **AC6 — Both themes pass:** The focus indicator maintains 3:1 contrast on `bg-background` and `bg-card` in both light and dark themes.

## Context

### Current state

- Global ring token: `--ring` — light `oklch(0.708 0 0)` (medium gray), dark `oklch(0.45 0.05 270)` (purple-tinted gray).
- Most components: `focus-visible:ring-2 ring-ring ring-offset-2`.
- Enhanced helper: `.focus-ring-enhanced:focus-visible` adds `box-shadow: 0 0 0 3px var(--brand-soft)` (in `src/styles/animations.css` ~lines 208–214).
- Some components use `focus-visible:outline-none` and rely on alternative ring/box-shadow.

### Suspected gaps

- Dark `--ring` at `oklch(0.45 ...)` likely fails 3:1 against `--card` in dark mode.
- Components using `outline-none` without a fully compliant replacement.
- Dropdown items relying on `bg-accent` background change instead of an outline.

### Recommended approach

Introduce a dedicated `--focus-ring` token (separate from `--ring`) so that focus contrast can be tuned without disturbing other ring usages. Map it via Tailwind theme to `ring-focus-ring` / `outline-focus-ring`. Update the global focus rule and any component overrides to use the new token. Keep `.focus-ring-enhanced` aligned.

## Out of Scope

- Changing the visual identity of focus rings beyond what is required for compliance (no animation redesign, no thickness changes beyond 2px minimum).
- Refactoring shadcn primitives beyond focus-style fixes.
- Non-WCAG-2.4.13 a11y work (covered by other E66 stories).
- Migrating `--ring` itself — prefer additive `--focus-ring` token.

## Dependencies

- Existing tokens in `src/styles/theme.css` and Tailwind theme mapping in `src/styles/tailwind.css`.
- Playwright E2E harness with theme-toggle helper.
- WCAG luminance/contrast formula implementation in test (browser-side, OKLCH → sRGB conversion via `getComputedStyle` resolution).

## Definition of Done

- All ACs satisfied with passing audit test on both themes.
- No `outline: none` / `outline: 0` left without a compliant visible alternative.
- Theme tokens documented in `theme.css` with a comment explaining `--focus-ring` purpose.
- Story-level PR merged and `66-5-focus-indicator-enhancement-and-compliance-audit` marked `done` in `sprint-status.yaml`.

## Risks

- Changing focus visuals globally may affect snapshots / visual diffs in unrelated tests.
- OKLCH-to-sRGB conversion in the audit must use real computed colors (`window.getComputedStyle`) rather than reparsing tokens, otherwise contrast math is unreliable.
- `box-shadow`-only focus indicators must be detected; audit cannot assume `outline` is the only mechanism.
