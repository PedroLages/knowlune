# Design Review: E03-S08 — Global Notes Dashboard

**Date**: 2026-03-01
**Route**: `/notes`
**Viewports tested**: 1440px (desktop), 768px (tablet), 375px (mobile)

## Findings

### Blockers

1. **Tag filter badges not keyboard accessible** — `src/app/pages/Notes.tsx:379-390` and `:258-270`
   - Filter bar badges and note card tag badges use `<Badge>` which renders as `<span tabIndex="-1">`. Cannot be reached by Tab key and have no keyboard event handlers.
   - Fix: Add `tabIndex={0}`, `role="button"`, and `onKeyDown` handlers (Enter/Space) to both filter bar badges and note card tag badges.

2. **Muted foreground contrast below WCAG AA on body background** — `text-muted-foreground` (`rgb(100, 116, 139)`) against `#FAF5EE` yields 4.39:1, below 4.5:1 AA threshold.
   - Only fails on warm off-white body background; passes on white card backgrounds (4.76:1).
   - Fix: Slightly darken muted-foreground or ensure muted text always sits on card surfaces.

### What's Solid

- Card expand/collapse keyboard interaction is well-built (`role="button"`, `tabIndex=0`, `aria-expanded`, Enter/Space handler)
- Search highlighting correctly uses semantic `<mark>` elements
- `useMemo` chain for filtering/sorting/grouping is performant
- All three breakpoints render without horizontal overflow
- No hardcoded hex values in Notes.tsx — correct design token usage
- Correct `rounded-[24px]` on cards, correct `bg-blue-600` active states
- Empty state design is clean and informative
