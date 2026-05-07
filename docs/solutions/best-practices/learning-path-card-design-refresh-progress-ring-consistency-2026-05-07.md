---
title: "Learning Path Card Design Refresh — Progress Ring Consistency and Positioning Lessons from PR #544"
date: 2026-05-07
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Adding a strokeWidth prop to an existing SVG ring component — follow the same optional-prop-with-default pattern already established by sibling ring components
  - Positioning an element to straddle a component boundary — choose between dynamic centering (translate-y-1/2) and fixed offset (-top-N) based on whether the element's size might change at runtime
  - Discovering pre-existing type errors in unrelated files during a refinement task — document them but do not fix them unless they block the task
tags:
  - progress-ring
  - stroke-width
  - component-consistency
  - ring-positioning
  - scope-management
  - pathprogressring
  - learning-paths
related_components:
  - documentation
---

# Learning Path Card Design Refresh — Progress Ring Consistency and Positioning Lessons from PR #544

## Context

PR [#544](https://github.com/PedroLages/knowlune/pull/544) shipped a targeted design refresh for learning path cards, matching a "Lumina" HTML reference mockup. The changes included taller card headers (h-24 to h-32), larger progress rings (72px to 80px) with bolder stroke width (3px to 8px), updated ring positioning, and improved cover upload error diagnostics.

During this small refinement, three implementation lessons emerged that apply beyond the specific PR context. This doc captures them.

## Guidance

### 1. Progress Ring strokeWidth Consistency: All Three Ring Components Now Share the Same Prop Pattern

The codebase has three SVG ring components that display circular progress:

| Component | File | Before PR #544 | After PR #544 |
|-----------|------|----------------|---------------|
| `library/ProgressRing` | `src/app/components/library/ProgressRing.tsx` | `strokeWidth` prop (default 8) | Unchanged (already had it) |
| `figma/ProgressRing` | `src/app/components/figma/ProgressRing.tsx` | `strokeWidth` prop (default 4) | Unchanged (already had it) |
| `figma/PathProgressRing` | `src/app/components/figma/PathProgressRing.tsx` | Stroke hardcoded per size preset | `strokeWidth` prop added (default per preset) |

PR #544 added an optional `strokeWidth?: number` prop to `PathProgressRing` following the same pattern as the other two rings. When provided, it overrides the config's default stroke value for the chosen size, and the radius is recomputed accordingly:

```typescript
// PathProgressRing — strokeWidth prop added, matching library/ProgressRing and figma/ProgressRing
interface PathProgressRingProps {
  size: number | 'sm' | 'md' | 'lg'
  progress: number
  strokeWidth?: number  // overrides default, follows sibling component pattern
  // ...
}

// Config resolution (order of precedence):
// 1. strokeWidth prop if provided
// 2. SIZES[preset].stroke if string preset
// 3. default 3 for numeric sizes

// When strokeWidth=S and size=N:
radius = (N - S * 2) / 2
circumference = 2 * Math.PI * radius
```

At the PR's target values (`size={80}`, `strokeWidth={8}`):
- `radius = (80 - 8 * 2) / 2 = 32`
- `circumference = 2 * Math.PI * 32 ≈ 201.06`

**Why consistency matters.** Before this change, a developer working with ring components had to remember which ones accepted `strokeWidth` and which had it baked into a size config. Adding the prop to `PathProgressRing` removes a special case: all three rings now accept the same `strokeWidth?: number` interface. Any future ring-like component should follow the same pattern.

**Pattern to follow for new ring components:**

```
strokeWidth?: number   // optional prop
Default: from component's internal SIZES config
When provided: overrides config stroke, adjusts radius accordingly
```

### 2. Ring Positioning: Fixed Offset (-top-10) vs Dynamic Centering (-translate-y-1/2)

The PR changed the ring container's positioning strategy to match a specific HTML design reference:

```
--- Before (dynamic centering via CSS transform):
<div className="absolute left-6 top-0 -translate-y-1/2">
  <PathProgressRing size={80} strokeWidth={8} progress={...} />
</div>

--- After (fixed pixel offset):
<div className="absolute left-6 -top-10">
  <PathProgressRing size={80} strokeWidth={8} progress={...} />
</div>
```

**The trade-off between the two approaches:**

| Approach | How it works | When to use | Risk |
|----------|-------------|-------------|------|
| `-translate-y-1/2` | CSS transform offsets the element by 50% of its own height — centers it on the boundary regardless of size | Ring size may change at runtime; want automatic centering | Ring position shifts if ring container height changes (e.g., different padding or ring size) |
| `-top-N` (fixed pixel) | Positions the element at a specific pixel offset from the parent's edge | Design specifies exact offset; ring dimensions are known at build time | Breaks if parent or child dimensions change; requires manual adjustment |

**Why `-top-10` won in this case.** The HTML reference explicitly used `-top-10` on a 96px ring badge (80px ring + `p-2` padding on both sides). The ring size (80px) and padding (`p-2`) are known constants — they do not change at runtime. A fixed offset is simpler, matches the reference exactly, and avoids the subtle positioning differences that `translate-y-1/2` can introduce when the ring container's computed height is fractional.

**Revisit this decision if:**
- The ring size becomes dynamic (e.g., configurable by user preference)
- The header height changes (currently `h-32`, was `h-24`)
- The component is reused in a context where the parent seam position is unknown

### 3. Pre-Existing Type Errors in Unrelated Files: Document, Don't Fix

During implementation, TypeScript compilation errors were discovered in two unrelated test files:

- `src/stores/__tests__/useCourseImportStore.test.ts`
- `src/app/components/course/__tests__/ImportedCourseCard.test.tsx`

These errors pre-existed the PR — they were not caused by the changes. The correct response was to note them and move on, not to derail the refinement task into an unrelated bug hunt.

**Decision framework for unrelated errors discovered during a task:**

| Condition | Action |
|-----------|--------|
| Error is in files touched by the current PR | Fix — the PR should leave every file it touches in a clean state |
| Error blocks the PR's build/lint/tests from passing | Fix — a passing CI is the entry criterion for review |
| Error is pre-existing in files not touched by the PR | Document and defer — fixing unrelated issues expands scope and risks introducing new defects outside the PR's review context |

The errors were documented in the PR description as discovered-but-unaddressed, giving reviewers visibility. They should be addressed in a dedicated follow-up task covering the course import module.

## Why This Matters

1. **Component consistency reduces cognitive load.** Developers working with ring components across the codebase now encounter the same `strokeWidth` prop pattern everywhere. This is the "extract shared primitive on second consumer" principle applied to prop interfaces.

2. **Positioning strategy should be a deliberate choice, not an accident.** The `-translate-y-1/2` vs `-top-N` decision depends on whether the element dimensions are dynamic or static. Documenting the trade-off prevents future developers from blindly following one pattern when the other is more appropriate.

3. **Scope discipline preserves focus.** Pre-existing errors in unrelated files are a distraction. Documenting them creates traceability without expanding the PR's scope. A refinement task that fixes every lint/type error it encounters will never ship.

## When to Apply

- When adding a sizing or styling prop to a component that has sibling components with similar concerns — check if the sibling components already expose the same prop and follow their pattern
- When positioning an element at a component boundary — choose dynamic centering (transform) if the element size is variable; choose fixed offset if both the parent and child dimensions are static and known
- When discovering unrelated errors during a focused task — document them and defer; do not expand scope

## Examples

**Stroke width prop consistency — before vs after PR #544:**

| Component | Before | After |
|-----------|--------|-------|
| `library/ProgressRing` | `strokeWidth` prop (default 8) | `strokeWidth` prop (default 8) |
| `figma/ProgressRing` | `strokeWidth` prop (default 4) | `strokeWidth` prop (default 4) |
| `PathProgressRing` | hardcoded per size (sm=3, md=3, lg=4) | `strokeWidth` prop (default 3) |

**Ring positioning decision table:**

| Context | Size stable? | Parent stable? | Recommended approach |
|---------|-------------|----------------|---------------------|
| Learning path card (80px ring, `h-32` header) | Yes | Yes | Fixed offset (`-top-10`) — simpler, matches design exactly |
| Dashboard overview ring (future, size may vary) | No | Yes | Dynamic centering (`-translate-y-1/2`) — self-centers at any size |

## Related

- [PR #544](https://github.com/PedroLages/knowlune/pull/544) — the PR that shipped these changes
- [Plan: Refresh Learning Path Card Design](../../plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md)
- [Learning Paths Card Navigation, Cover RLS, Progress Ring Sizing — Implementation Lessons](./learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md) — related ring-sizing lessons from PR #525 (moderate overlap: discusses ring sizing trade-offs at 48px vs 72px; this doc extends coverage to stroke width consistency and positioning strategy)
- `src/app/components/figma/PathProgressRing.tsx` — the component extended in this PR
- `src/app/components/library/ProgressRing.tsx` — sibling ring with the same `strokeWidth` pattern
- `src/app/components/figma/ProgressRing.tsx` — sibling ring with the same `strokeWidth` pattern
