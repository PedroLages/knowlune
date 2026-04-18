---
title: "TS2367: React.Children.toArray() strips falsy — boolean comparison always unreachable"
date: 2026-04-18
category: docs/solutions/build-errors/
module: library
problem_type: build_error
component: tooling
symptoms:
  - "TypeScript TS2367: This comparison appears to be unintentional because the types 'ReactChild | ReactPortal' and 'false' have no overlap"
  - "Build fails on component that guards against empty children using .every(c => c === null || c === undefined || c === false) on a Children.toArray() result"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [typescript, react, children, ts2367, build-error, children-toarray, falsy-values, type-narrowing]
---

# TS2367: React.Children.toArray() strips falsy — boolean comparison always unreachable

## Problem

When writing an `isChildrenEmpty` guard for a React component, comparing elements from `React.Children.toArray()` to `false`, `null`, or `undefined` triggers TypeScript error TS2367 and fails the build. The component cannot compile because TypeScript proves these comparisons can never be true.

## Symptoms

```
TS2367: This comparison appears to be unintentional because the types
'ReactChild | ReactPortal' and 'false' have no overlap.
```

Appears on any expression like:

```typescript
arr.every(c => c === null || c === undefined || c === false)
```

where `arr` is the return value of `React.Children.toArray()`.

## What Didn't Work

Adding a `.every()` check after `Children.toArray()` to filter out falsy children:

```typescript
// BROKEN — TS2367 on the false/null/undefined comparisons
function isChildrenEmpty(children: ReactNode): boolean {
  if (children === null || children === undefined || children === false) return true
  const arr = Children.toArray(children)
  return arr.length === 0 || arr.every(c => c === null || c === undefined || c === false)
}
```

**Why it fails:** The assumption was that `Children.toArray()` might preserve falsy values in its output array. It does not. The function's return type is `Array<Exclude<ReactChild, boolean | null | undefined>>`, so the resulting elements can never be `null`, `undefined`, or `false`. TypeScript correctly flags the comparisons as unreachable, producing TS2367.

The error was not caught during authoring — it was only caught by `tsc --noEmit` in the post-implementation quality gate. The component had already been committed before the type error was noticed. (session history)

## Solution

Remove the redundant `.every()` check entirely. After calling `Children.toArray()`, a length check of zero is sufficient:

```typescript
// CORRECT — Children.toArray() already strips all falsy nodes
function isChildrenEmpty(children: ReactNode): boolean {
  if (children === null || children === undefined || children === false) return true
  return Children.toArray(children).length === 0
}
```

The initial guard handles the case where `children` itself is a top-level falsy value (e.g., `{condition && <Component />}` evaluating to `false`). After that guard, `Children.toArray().length` is the complete source of truth.

For most cases where you only need to decide whether to render, you can collapse this further:

```typescript
// Shortest correct form — no separate guard needed for rendering decisions
if (Children.toArray(children).length === 0) return null
```

`Children.toArray()` handles `null`, `undefined`, and `false` inputs gracefully (returns `[]`), so a pre-call guard is only necessary if you need to distinguish "children was explicitly `false`" from "children was an empty array" — a distinction rarely meaningful in practice.

## Why This Works

`React.Children.toArray()` performs its own internal filtering pass. Per the React source and type signatures, it strips `null`, `undefined`, and boolean nodes before returning, yielding only actual renderable elements (`ReactChild | ReactPortal`). The TypeScript types reflect this contract precisely:

```typescript
// React type signature (simplified)
toArray(children: ReactNode): Array<ReactChild | ReactPortal>
// where ReactChild = ReactElement | string | number  (never includes boolean, null, or undefined)
```

`ReactChild` is structurally `ReactElement | string | number` — it never includes `boolean`, `null`, or `undefined`. Those types are excluded by definition, not by an explicit `Exclude` clause. Because the output can never contain falsy primitives, any comparison to `false`, `null`, or `undefined` on those elements is a type error — TypeScript can statically prove the comparison can never be true.

> **Note:** `ReactChild` was deprecated in React 18's type definitions in favor of `ReactNode`. The structural contract remains the same: `Children.toArray()` returns only renderable elements, never falsy primitives.

## Prevention

**Conceptual rule:** After `Children.toArray()`, trust the array length. Never inspect individual elements for `null`/`undefined`/`false` — they were already removed.

**Pattern to adopt for empty-children guards:**

```typescript
// Preferred: delegate filtering entirely to Children.toArray()
function isChildrenEmpty(children: ReactNode): boolean {
  return Children.toArray(children).length === 0
}
```

**Code review signal:** Any `.every()`, `.filter()`, or `.find()` on a `Children.toArray()` result that compares against `null`, `undefined`, or `false` is a bug. Flag it in review.

**Test cases to include for components with empty-children guards:**

```typescript
it('returns null when children is false', () => {
  const { container } = render(<MyComponent>{false}</MyComponent>)
  expect(container.firstChild).toBeNull()
})

it('returns null when children is null', () => {
  const { container } = render(<MyComponent>{null}</MyComponent>)
  expect(container.firstChild).toBeNull()
})

it('renders when at least one child is truthy', () => {
  const { getByText } = render(<MyComponent><span>hello</span></MyComponent>)
  expect(getByText('hello')).toBeInTheDocument()
})
```

## Related Issues

- Story E116-S01: LibraryShelfRow primitive — `src/app/components/library/LibraryShelfRow.tsx`
- Fix commit: `f1325639` (chore: remove redundant Children.toArray falsy checks — TS2367)
