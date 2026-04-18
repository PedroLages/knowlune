---
title: "Extract shared primitive when a second consumer appears"
date: 2026-04-18
category: docs/solutions/best-practices/
module: library
problem_type: best_practice
component: tooling
severity: medium
applies_when:
  - A component or page contains an internal helper component (e.g., a local `SectionHeading` defined inside a larger file) that is not exported
  - A new feature in the same module needs the identical visual or structural pattern
  - You're tempted to copy-paste the internal helper's JSX into the new consumer
tags: [react, components, refactoring, primitives, duplication, library, extraction, shared-components]
---

# Extract shared primitive when a second consumer appears

## Context

The Library module's `SmartGroupedView` contained an internal `SectionHeading` component — icon + label + optional count + optional subtitle + optional action slot. When E116-S01 introduced `LibraryShelfRow` (a new shelf primitive for the Library page), it needed the exact same heading structure. The options were:

1. Copy-paste the JSX from `SmartGroupedView`'s internal `SectionHeading`
2. Export `SectionHeading` from `SmartGroupedView` (awkward — it's an implementation detail of that view)
3. Extract a shared `LibraryShelfHeading` primitive that both consumers import

The session chose option 3 before the second copy existed. That's the decision rule this doc captures.

## Guidance

**When a second consumer of an internal component function appears, extract it to a shared primitive in the same module — don't duplicate, and don't re-export the internal.**

The trigger is *two consumers*, not *three*. Waiting for the third copy is a common antipattern: by then the two copies have usually drifted (different prop names, different edge-case handling, different class strings), and reconciling them is significantly more work than extracting at 2→3 would have been.

```typescript
// BEFORE — SmartGroupedView owns an internal heading
// src/app/components/library/SmartGroupedView.tsx
function SectionHeading({ icon: Icon, label, count, subtitle, actionSlot }: Props) {
  return (
    <header className="...">
      <Icon className="..." />
      <h2>{label}</h2>
      {typeof count === 'number' && <span>{count}</span>}
      {subtitle && <p>{subtitle}</p>}
      {actionSlot}
    </header>
  )
}

// AFTER — shared primitive, both SmartGroupedView and LibraryShelfRow import
// src/app/components/library/LibraryShelfHeading.tsx
export function LibraryShelfHeading({ icon, label, count, subtitle, actionSlot, 'data-testid': testId }: Props) {
  // ...identical JSX, now owned by one file
}
```

**Rules for the extraction:**

1. **Same module.** Put the primitive next to its consumers, not in a global `components/ui/` folder. Library-specific primitives belong in `src/app/components/library/`.
2. **Minimal prop surface.** Only the props both consumers actually need today. Add new props when a third consumer requires them, not speculatively.
3. **Consumers own their layout.** The primitive renders heading chrome; positioning, margins, and surrounding scrollers stay in each consumer.
4. **Name for the role, not the implementation.** `LibraryShelfHeading` describes what it is in the domain (a shelf heading), not how it's built (`IconLabelCountBlock`).

## Why This Matters

Duplication tax compounds nonlinearly. Two copies are a coincidence; three copies are a pattern; four copies are a maintenance trap. The cheapest moment to extract is at 2→3, because:

- Only one file has the full context of the pattern (the internal component's file)
- Test coverage for the internal component already exists — migrating it to the extracted primitive is mechanical
- No divergence has accumulated yet — the extracted primitive can be structurally identical to the original
- The second consumer can be written directly against the primitive, without ever going through a copy-paste step

Waiting until 3+ copies exist usually means:

- You now need to reconcile small divergences (did copy A handle the empty-count case the same as copy B?)
- Tests on the duplicated code have fragmented — some copies are tested, others aren't
- The PR that finally extracts the primitive touches N files and is harder to review

**Counter-signal — when NOT to extract at 2:** if the two consumers only share visual resemblance, not semantic role, extracting creates false coupling. If one uses the pattern for "group headings" and the other for "modal titles," they happen to look similar but will diverge as each evolves. Extract when both consumers are the same *thing* in the domain (both are shelf/section headings in the Library), not when they merely look alike.

## When to Apply

- Adding a new feature in a module that already has an internal helper component matching your needs
- During PR review, when you notice the diff would create a second copy of existing JSX
- When a design system pattern (heading, card, row, empty state) is about to appear in a second location within the same module
- When `grep` for a distinctive class-string combination returns exactly one existing location and your PR would add a second

## Examples

**Realized example (E116-S01):** `LibraryShelfHeading` extracted at PR #338. Both `SmartGroupedView` and `LibraryShelfRow` import it. Props: `{ icon, label, count?, subtitle?, actionSlot?, 'data-testid'? }`. No divergence possible — changes to the heading appearance propagate to both consumers atomically.

**Anti-example to avoid:**

```typescript
// DON'T — re-export the internal from SmartGroupedView
// src/app/components/library/SmartGroupedView.tsx
export function SectionHeading(...) { ... }  // now a public API of a view

// src/app/components/library/LibraryShelfRow.tsx
import { SectionHeading } from './SmartGroupedView'  // weird: a view exporting a primitive
```

Re-exporting the internal from its original home signals "this is part of SmartGroupedView's API," which constrains future refactors of SmartGroupedView. Extract to its own file so the primitive's lifecycle is independent of any one consumer.

**Forward-looking example (Library roadmap):** with 10+ Library stories planned (continue-listening shelves, author shelves, recently-added shelves, recommended shelves), every new shelf will consume `LibraryShelfHeading`. The extraction pays back within the next 1–2 stories.

## Related

- E116-S01: LibraryShelfRow primitive — PR #338, commits `24ac15088`, `0c5210c5`
- `src/app/components/library/LibraryShelfHeading.tsx` — the extracted primitive
- `src/app/components/library/SmartGroupedView.tsx` — first consumer
- `src/app/components/library/LibraryShelfRow.tsx` — second consumer
- Related learning: `docs/solutions/build-errors/react-children-toarray-ts2367-false-comparison-2026-04-18.md` (same story)
