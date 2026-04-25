---
title: Virtualized List: ARIA, Focus Rescue, and Reduced-Motion Patterns
date: 2026-04-25
problem_type: best_practice
category: best-practices
module: courses
component: VirtualizedCoursesList
tags:
  - virtualization
  - tanstack-react-virtual
  - accessibility
  - aria
  - focus-management
  - prefers-reduced-motion
  - react
related:
  - docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md
  - docs/solutions/best-practices/2026-04-25-e2e-tests-need-guest-mode-init-script-post-e92-auth-gate.md
---

# Virtualized List: ARIA, Focus Rescue, and Reduced-Motion Patterns

## Context

E99-S05 added virtualization to the Courses page across three view modes (list, compact-grid, cozy-grid) using `@tanstack/react-virtual`. Four patterns proved load-bearing and worth capturing for future virtualized-list work (Library, Authors, Reports if they ever scale to needing it). A fifth lesson — wrap-don't-replace generic primitives — is already covered in [extract-shared-primitive-on-second-consumer-2026-04-18.md](extract-shared-primitive-on-second-consumer-2026-04-18.md); this doc focuses on the virtualization-specific patterns.

## Guidance

### 1. Use a fixed numeric threshold, not column-derived

Column-derived bypass thresholds (`items.length <= columns * 6`) trip too early at narrow viewports — at 1 column, only 6 items must be present before virtualization activates, which is wasteful overhead. A fixed integer (`VIRTUALIZATION_THRESHOLD = 30`) gives predictable behavior across all viewports.

```typescript
// Wrap a generic VirtualizedGrid with a feature-specific facade
export const VIRTUALIZATION_THRESHOLD = 30

if (courses.length < VIRTUALIZATION_THRESHOLD) {
  // Plain layout, no virtualizer
  return <PlainList courses={courses} />
}
return <VirtualizedListMode courses={courses} />
```

### 2. ARIA: prefer `aria-label="N items"` over `aria-rowcount` outside table/grid roles

VoiceOver (and historically NVDA) ignores `aria-rowcount` when applied outside `<table>` / `role="grid"` / `role="treegrid"` contexts. For `role="list"` containers, `aria-label` with a count string is the portable announcement.

```tsx
// On the scroll container
<div
  role="list"
  aria-label={`${courses.length} courses`}
  tabIndex={-1}
  ref={parentRef}
>
  {/* virtualized rows */}
</div>

// On each rendered row — use aria-posinset/aria-setsize, not aria-rowindex
<div
  role="listitem"
  aria-posinset={virtualRow.index + 1}
  aria-setsize={courses.length}
>
```

`aria-posinset` + `aria-setsize` are correct for `role="list"`. `aria-rowindex` belongs to grid/row roles only.

### 3. Focus rescue when a focused row is recycled

When `@tanstack/react-virtual` recycles a row out of the DOM and the row contained the focused element, focus drops to `document.body`. Screen readers and keyboard users lose orientation. The rescue pattern: post-render `useEffect` that detects body-focus and pulls focus back to the (focusable) container.

```tsx
const virtualRows = virtualizer.getVirtualItems()
useEffect(() => {
  const container = parentRef.current
  if (!container) return
  const active = document.activeElement
  if (active === document.body || active === document.documentElement) {
    container.focus({ preventScroll: true })
  }
}, [virtualRows])
```

Two requirements:
- Container must have `tabIndex={-1}` so it can be programmatically focused.
- Use `{ preventScroll: true }` to avoid triggering an unwanted scroll while rescuing.

The effect runs on every virtualizer render; the body cost is O(1) so this is fine. If the body of the effect grows, switch to a length-based dep or a ref-tracked previous activeElement.

### 4. `usePrefersReducedMotion` via `useSyncExternalStore`

For SSR-safe, reactive reads of motion preference, prefer `useSyncExternalStore` over a plain `useEffect` + `useState` pattern. Three callbacks: subscribe, getSnapshot, getServerSnapshot.

```typescript
function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}
function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function getReducedMotionServerSnapshot(): boolean {
  return false
}
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  )
}
```

Use cases in virtualization:
- Pass `shimmer={!prefersReducedMotion}` to `<Skeleton>` so the pulse animation is suppressed.
- Avoid smooth-scroll for programmatic `scrollToOffset` calls (note: `@tanstack/react-virtual` only supports `behavior: 'auto'` anyway, so this is mostly defensive for other scroll APIs).

### 5. Skeleton sized to estimateSize prevents CLS

For list-mode virtualization, set `Skeleton`'s height to match the row's `estimateSize`:

```typescript
const LIST_ROW_ESTIMATE_PX = 72 // matches ImportedCourseListRow height

<Skeleton
  shimmer={!prefersReducedMotion}
  className="w-full"
  style={{ height: `${LIST_ROW_ESTIMATE_PX}px` }}
/>
```

When the real card mounts and `measureElement` returns the actual height, the row swaps in place with zero layout shift.

## Why This Matters

- **Accessibility regressions are the silent killer of virtualized lists.** A 60fps virtualized list that strands focus on `document.body` or fails to announce row count is worse than an unvirtualized one. These four patterns close the gap.
- **Threshold predictability** affects performance and developer trust. A threshold derived from column count surprises developers who debug "why is virtualization active with only 6 items at mobile width."
- **Reactive motion preference reads** mean toggling the OS-level preference takes effect immediately without page reload.

## When to Apply

- Any new virtualized list / grid in the codebase.
- Backfilling accessibility into the existing `VirtualizedGrid` (used by Authors page).
- Building list-like primitives that may grow to need virtualization later (Library, Reports).

## Examples

See:
- [src/app/components/courses/VirtualizedCoursesList.tsx](../../../src/app/components/courses/VirtualizedCoursesList.tsx) — full reference implementation
- [src/app/components/VirtualizedGrid.tsx](../../../src/app/components/VirtualizedGrid.tsx) — generic primitive
- [src/app/components/courses/__tests__/VirtualizedCoursesList.test.tsx](../../../src/app/components/courses/__tests__/VirtualizedCoursesList.test.tsx) — unit-test patterns for virtualized components in jsdom (assert spacer height instead of row count, since jsdom has no scroll viewport)
- [tests/e2e/e99-s05-virtualization.spec.ts](../../../tests/e2e/e99-s05-virtualization.spec.ts) — E2E patterns: assert `<` total rows in DOM, scroll-to-bottom assertions, threshold bypass.

## Related Lessons

- **Wrap, don't replace** — when `VirtualizedGrid` already existed and was used by Authors, the right call was to add `VirtualizedCoursesList` as a Courses-specific facade that delegates to the generic component. See [extract-shared-primitive-on-second-consumer-2026-04-18.md](extract-shared-primitive-on-second-consumer-2026-04-18.md).
- **Pre-E92 E2E specs need guest-mode init** — the existing E99-S01/S02 specs were authored before the E92 auth gate landed and now fail without `sessionStorage.setItem('knowlune-guest', 'true')`. See [2026-04-25-e2e-tests-need-guest-mode-init-script-post-e92-auth-gate.md](../2026-04-25-e2e-tests-need-guest-mode-init-script-post-e92-auth-gate.md).
