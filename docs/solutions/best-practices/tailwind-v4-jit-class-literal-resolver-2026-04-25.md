---
title: "Tailwind v4 JIT requires complete class literals — use a per-branch resolver helper"
date: 2026-04-25
problem_type: best-practice
category: best-practices
module: styling
component: tailwind
tags: [tailwind, tailwind-v4, jit, react, design-tokens, e99-s02]
applies_when: "A user-controlled preference (column count, density, theme variant) needs to switch a component between several Tailwind utility class strings at runtime"
---

# Tailwind v4 JIT requires complete class literals — use a per-branch resolver helper

## Context

E99-S02 added a column-count preference (`'auto' | 2 | 3 | 4 | 5`) for the Courses grid. The natural-feeling implementation is to compose the class string dynamically: `` `grid-cols-${columns}` ``. **This silently breaks in Tailwind v4** — the JIT scanner reads source files for class-name literals, and template-string concatenation produces no literal it can detect. The class is missing from the production CSS bundle even though TypeScript and the dev build appear fine.

## Guidance

When a Tailwind class needs to switch based on runtime state, return **complete pre-written string literals from a pure helper**, one branch per possible value. Co-locate the helper next to the consuming component and unit-test every branch.

```ts
// src/app/components/courses/gridClassName.ts
import type { CourseGridColumns } from '@/stores/useEngagementPrefsStore'

export function getGridClassName(columns: CourseGridColumns): string {
  switch (columns) {
    case 'auto':
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'
    case 2:
      return 'grid grid-cols-1 sm:grid-cols-2 gap-[var(--content-gap)]'
    case 3:
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--content-gap)]'
    case 4:
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[var(--content-gap)]'
    case 5:
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'
    default: {
      const _exhaustive: never = columns
      void _exhaustive
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'
    }
  }
}
```

Three rules make this work:

1. **Every branch is a complete literal** — Tailwind's source scanner finds `lg:grid-cols-3`, `xl:grid-cols-5`, etc. verbatim.
2. **The helper lives in `src/`** — covered by `@source '../**/*.{js,ts,jsx,tsx}'` in `src/styles/tailwind.css`. A helper in a different root would need its own `@source` directive.
3. **Bake invariants into the prefix** — every branch starts with `grid grid-cols-1 sm:grid-cols-2`, so the "mobile is always 1 column" requirement holds without per-call-site logic.

## Why This Matters

The failure mode is silent. The dev build succeeds. TypeScript is happy. The class string appears in the DOM. But the CSS rule is absent from the production bundle, so the layout doesn't change. You only catch it by:

- Visually testing the production build, or
- Greppping `dist/assets/*.css` after `npm run build`, or
- Asserting class presence in an E2E test against the rendered DOM

A pure resolver moves this from a runtime invariant ("hope the JIT picked it up") to a build-time guarantee (literals are right there, in the file the scanner reads). It's also unit-testable in isolation and gives you a single grep target if a branch ever needs to change.

## When to Apply

- Any time a component's Tailwind class string depends on a discrete runtime value (enum, union, small numeric range).
- When migrating from Tailwind v3 (where unsafelist or the JIT's looser scanning sometimes covered template strings) — v4 is stricter.
- When the user-facing preference can change after first paint (vs. compile-time theme variants where `cva` works fine).

**Verification step (always include after `npm run build`):**

```bash
grep -o 'lg\\:grid-cols-3\|xl\\:grid-cols-5' dist/assets/*.css
```

If a branch's classes don't appear in the output, the JIT isn't seeing them — usually because (a) the helper file isn't covered by `@source`, (b) a branch returns a template-string concatenation rather than a literal, or (c) the file extension isn't in the `@source` glob.

## Examples

**Bad — silent JIT miss:**
```ts
// Looks reasonable. Does not work in Tailwind v4 production builds.
const className = `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns} gap-4`
```

**Bad — partial dynamic:**
```ts
// Same problem. The variable interpolation defeats the scanner.
const lgClass = `lg:grid-cols-${columns}`
const className = `grid grid-cols-1 sm:grid-cols-2 ${lgClass} gap-4`
```

**Good — per-branch literals:**
```ts
// Tailwind sees every utility class verbatim during source scanning.
const className = getGridClassName(columns) // returns a literal per branch
```

## Related

- `docs/solutions/best-practices/2026-04-25-engagement-prefs-bridge-checklist.md` — the persistence wiring used to make the preference round-trip through localStorage and Supabase (mirrored exactly for E99-S02 with no novel issues; the checklist already covers the bridge contract end-to-end).
- `.claude/rules/styling.md` — Knowlune Tailwind v4 + design-token rules.
- `src/app/components/courses/gridClassName.ts` — reference implementation.
- `src/app/components/courses/__tests__/gridClassName.test.ts` — branch-coverage tests including a canonical-default invariant that catches accidental drift from the pre-S02 hardcoded class string.
