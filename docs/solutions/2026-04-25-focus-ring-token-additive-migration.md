---
module: a11y, theming
tags: [wcag, focus, design-tokens, css, tailwind-v4]
problem_type: best-practice
---

# Additive `--focus-ring` token vs mutating `--ring`

## Problem

WCAG 2.4.13 (AAA) requires keyboard focus indicators with a >=2px perimeter and >=3:1 contrast against adjacent backgrounds. Knowlune's `--ring` token (used by shadcn primitives via `ring-ring`) doubles as a generic "ring color" for non-focus contexts (data states, decorative borders). Mutating `--ring` to satisfy focus contrast risks regressing all those non-focus usages, especially in dark mode where the existing value (`oklch(0.45 0.05 270)`) was tuned for muted decoration.

## Solution

Add an additive `--focus-ring` token (parallel to `--ring`) defined in every theme variant — `:root`, `.dark`, `.clean`, `.dark.clean` — and expose it via Tailwind v4 with a single `--color-focus-ring: var(--focus-ring)` mapping in the `@theme` block. Then migrate **only the focus-visible utilities** that previously read from `--ring`:

```
focus-visible:ring-ring        ->  focus-visible:ring-focus-ring
focus-visible:border-ring      ->  focus-visible:border-focus-ring
```

The global `*:focus-visible` rule in `theme.css` flips to `outline: 2px solid var(--focus-ring)`. Non-focus ring usages (`ring-ring/30` on inputs in default state, decorative borders, etc.) keep `--ring` untouched.

## Why this works

1. **Blast radius is bounded.** A grep scope of `focus-visible:ring-ring` and `focus-visible:border-ring` enumerates every site that needs migration. Anything else still uses `--ring` and is unaffected.
2. **Per-theme tuning is independent.** `--focus-ring` can pick a different hue/lightness in dark mode than `--ring` did, without coupling.
3. **No shadcn upstream divergence.** Component class lists keep their original structure (still ring-based focus); only the token reference changes.
4. **Tailwind v4 makes it cheap.** One line in `@theme` (`--color-focus-ring: var(--focus-ring)`) creates `ring-focus-ring`, `border-focus-ring`, `outline-focus-ring`, `text-focus-ring` utilities for free.

## When to reach for this pattern

Anytime a design token does double duty (decorative + functional) and the functional purpose has hard accessibility/contrast requirements, prefer adding a sibling token over mutating the original. The same shape applied earlier in this codebase for `--brand-soft-foreground` (separate from `--brand`) so brand text on soft backgrounds could pass 4.5:1 without darkening the brand button color.

## Audit guardrail

The companion audit test (`tests/audit/focus-indicators.spec.ts`) prevents regression. It walks tab order across all major routes in light + dark, then for each focused element parses `getComputedStyle().outlineWidth/Style/Color` and the leading `box-shadow`, walks ancestors for the effective opaque background, and computes WCAG luminance contrast. A focus indicator is compliant if EITHER:

- `outline-style != none` AND `outline-width >= 2px` AND outline-color contrast vs effective bg `>= 3:1`, OR
- leading non-inset `box-shadow` with spread `>= 2px` AND shadow-color contrast vs effective bg `>= 3:1`.

Computed `outlineColor` and `boxShadow` color are returned in sRGB regardless of the source format (OKLCH, hex, named) — no manual color-space conversion is required.

## References

- Plan: `docs/plans/2026-04-25-005-feat-e66-s05-focus-indicator-enhancement-plan.md`
- Audit: `tests/audit/focus-indicators.spec.ts`
- Tokens: `src/styles/theme.css` (`--focus-ring`, `--color-focus-ring`)
- WCAG SC 2.4.13: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
