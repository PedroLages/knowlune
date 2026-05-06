---
title: "Bulk course delete — implementation lessons from sequential deletion over optimistic stores"
date: 2026-05-07
category: best-practices
module: courses
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Implementing batch mutations where each individual mutation does its own optimistic state management and rollback
  - Adding undo to multi-item operations where the undo target is a subset of the pre-operation state
  - Adding selection mode to list views with multiple card/cell variants
  - Detecting operation success when the underlying mutation swallows errors
tags:
  - bulk-operations
  - undo-pattern
  - optimistic-state
  - sequential-deletion
  - selection-mode
  - z-index-layering
  - courses
related_components:
  - imported-course-cards
  - zustand-stores
---

# Bulk course delete — implementation lessons from sequential deletion over optimistic stores

## Context

The bulk course delete feature added selection mode to the Courses page with checkboxes on all three card variants (grid, compact, list), a batch `removeImportedCourses` store action, and an undo toast. The existing `removeImportedCourse` (single-course) already implemented optimistic removal from Zustand + rollback on failure, so the batch variant had to compose over it. See the plan at `docs/plans/2026-05-06-006-feat-bulk-course-delete-plan.md` and PR #528.

Several non-obvious constraints and invariants emerged during implementation and review. These lessons apply broadly to any batch operation over optimistic stores in this codebase.

## Guidance

### 1. Sequential iteration (not parallel) over optimistic store mutations

Each `removeImportedCourse` call does:
1. Optimistic `set()` to remove the course from Zustand
2. Async Dexie + sync queue writes
3. On failure: rollback `set()` to re-insert the course

If two calls run in parallel via `Promise.allSettled`, their rollbacks race. Call A's rollback re-inserts a course while Call B has already optimistically removed it — state becomes inconsistent. Sequential iteration avoids this entirely because each call completes (or fully rolls back) before the next starts.

```typescript
// Sequential — each call completes before the next starts
for (const id of courseIds) {
  await get().removeImportedCourse(id)
  // Check result immediately while state is settled
  const stillExists = get().importedCourses.find(c => c.id === id)
  if (stillExists) {
    failed.push({ id, name: stillExists.name })
  } else {
    deleted.push(course)
  }
}
```

Do not use `Promise.all` or `Promise.allSettled` when each sub-operation modifies the same Zustand store and has rollback logic. The shared state is the race surface.

### 2. Undo must restore only successfully deleted items, not the full pre-deletion snapshot

The natural first approach is to capture all courses before deletion and restore all of them on undo. This is wrong when some deletions fail.

Initial (buggy) pattern:
```typescript
const snapshot = courseIds.map(id => findCourse(id)).filter(Boolean)

// ... deletion loop ...

// ❌ Undo restores everything in snapshot, including courses that were never deleted
toastWithUndo({
  onUndo: async () => {
    for (const course of snapshot) { /* re-add */ }  // BUG
    set(state => ({ importedCourses: [...snapshot, ...state.importedCourses] }))  // BUG
  }
})
```

If 2 of 5 courses failed to delete, the snapshot still contains all 5. On undo, all 5 get restored — including the 2 that were still in state (creating duplicates) or were already fully processed and should not be touched.

Fix: Use the `deleted` array (which only contains courses confirmed removed):
```typescript
// ✅ Undo restores only what was actually deleted
toastWithUndo({
  onUndo: async () => {
    for (const course of deleted) {
      await syncableWrite('importedCourses', 'add', course as unknown as SyncableRecord)
    }
    set(state => ({
      importedCourses: [...deleted, ...state.importedCourses],
    }))
  }
})
```

### 3. Detecting failure when the underlying mutation swallows errors

`removeImportedCourse` catches errors internally and rolls back the optimistic removal. It never throws and never returns a success/failure signal. The batch action detects failure by inspecting Zustand state after each call resolves:

```typescript
await get().removeImportedCourse(id)
const stillExists = get().importedCourses.find(c => c.id === id)
if (stillExists) {
  // The course was re-inserted — deletion failed
  failed.push({ id, name: stillExists.name })
} else {
  deleted.push(course)
}
```

This works because:
- On success: the course is removed from Zustand (optimistic) and from Dexie.
- On failure: the internal `.catch` re-inserts the course into Zustand via `set()`.

**Invariant**: After `removeImportedCourse(id)` resolves, the course is in Zustand state if and only if the deletion failed. This invariant is what makes the post-call check reliable.

### 4. Z-index layering for selection checkboxes over existing card overlays

All three card variants already have positioned elements (completion badges, progress rings, status badges) at specific z-index values. The selection checkbox must sit above all of them. The z-index values needed per variant:

| Card variant | Checkbox z-index | Competing element | Competing z-index |
|---|---|---|---|
| ImportedCourseCard | `z-40` | Completion badge | `z-30` |
| ImportedCourseCompactCard | `z-20` | Status badge | `z-10` |
| ImportedCourseListRow | N/A (inline flex) | N/A | N/A |

The checkbox and completion badge sit at the same coordinates (`top-3 left-3`), so they visually overlap. This is documented as a known-issue (`KI-bulk-checkbox-badge-overlap`) accepted because selection mode is transitory and completion progress is also visible via the card-bottom progress bar.

**Lesson**: When adding overlays to cards that already have overlays, audit z-index stacking per variant. A single global z-index value is unlikely to work for all variants because each has a different structure and set of positioned elements.

### 5. Card click suppression in selection mode is a coordinated change across all three card variants

When selection mode is active, clicking a card should toggle its checkbox, not navigate to the course detail. This requires an early-return guard in the click handler (and keyboard handler) of every card variant:

```typescript
function handleCardClick(e: React.MouseEvent) {
  guardNavigation(e)
  if (onToggleSelect) {
    onToggleSelect(course.id)
    return  // suppress navigation
  }
  // ... normal navigation ...
}
```

The same guard is needed in the `onKeyDown` handler for Enter/Space. The pattern is identical across all three card components.

**Lesson**: Any change to card click behavior must be implemented in all card variants simultaneously. The `renderItem` closure in `Courses.tsx` threads `onToggleSelect` consistently, but each card component must independently decide what to do with it.

### 6. Escape key exits selection mode with proper React cleanup

The Escape key listener uses a `useEffect` that only registers when selection mode is active:

```typescript
useEffect(() => {
  if (!selectionMode) return
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setSelectionMode(false)
      setSelectedIds(new Set())
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [selectionMode])
```

Key details:
- The effect depends on `[selectionMode]`, so it re-registers only when the mode changes, not on every render.
- The cleanup function removes the listener, preventing stale handlers on unmount.
- Both `setSelectionMode(false)` and `setSelectedIds(new Set())` are called together to reset the full selection state.

### 7. Generation counter pattern was not needed (and why)

The plan anticipated needing the generation counter pattern (from `zustand-stale-async-results-generation-counter-2026-05-03.md`) to prevent stale callbacks if the user navigates away mid-batch. This turned out to be unnecessary because:

1. Sequential execution means each iteration reads fresh store state via `get()`.
2. The undo toast has a fixed 8-second window — if the user navigates away during deletion, the remaining courses still process (they are individually robust to navigation).
3. Individual `removeImportedCourse` calls already handle rollback internally.

**Lesson**: The generation counter pattern is needed when an async callback runs after navigation and must NOT apply its result. It is NOT needed when the operation reads fresh state on each iteration and is safe to run to completion regardless of navigation.

## Why This Matters

These patterns recur whenever you compose batch operations over individual mutations that manage their own optimistic state. The codebase has several stores that follow the same pattern as `removeImportedCourse` (optimistic remove + rollback + syncableWrite). Future batch operations on any of these stores will face the same constraints:

- Author deletion (`useAuthorStore.deleteAuthor`)
- Any future delete-by-id that uses optimistic removal

Understanding the sequential-over-optimistic invariant and the undo-snapshot trap prevents subtle data corruption bugs that only surface under partial failure conditions.

## When to Apply

- When implementing a batch delete/update over an existing single-item store action that does optimistic state management
- When adding selection mode to any list or grid view
- When the undo callback must selectively restore a subset of the pre-operation state (failed items must be excluded)
- When you need to detect success/failure from a mutation that swallows errors internally

## Examples

### Before/after: Undo snapshot fix

**Before (buggy)** — The undo callback references `snapshot`, the full pre-deletion state:
```typescript
const snapshot = courseIds.map(id => findCourse(id)).filter(Boolean)
// ... deletion loop that collects deleted[] and failed[] ...
toastWithUndo({
  onUndo: async () => {
    for (const course of snapshot) {  // BUG: includes failed items
      await syncableWrite('importedCourses', 'add', course)
    }
  }
})
```

This duplicates courses that never got deleted and ignores that some may have been partially processed.

**After (correct)** — The undo callback references only the `deleted` array:
```typescript
const snapshot = courseIds.map(id => findCourse(id)).filter(Boolean)
// ... deletion loop that collects deleted[] and failed[] ...
toastWithUndo({
  onUndo: async () => {
    for (const course of deleted) {  // Only courses that were actually removed
      await syncableWrite('importedCourses', 'add', course)
    }
  }
})
```

## Related

- [Plan: Bulk course delete](docs/plans/2026-05-06-006-feat-bulk-course-delete-plan.md) — background, requirements, and technical decisions
- [PR #528](https://github.com/PedroLages/knowlune/pull/528) — implementation with code review findings (z-index, undo snapshot, tests)
- [Single write path for synced mutations](single-write-path-for-synced-mutations-2026-04-18.md) — syncableWrite architecture that underlies the undo mechanism
- [Paths as Study Plan — SyncableWrite Batching](paths-as-study-plan-implementation-lessons-2026-05-04.md) — syncableWrite has no transaction semantics, each call commits independently
- [Preventing Stale Async Results in Zustand Stores](zustand-stale-async-results-generation-counter-2026-05-03.md) — generation counter pattern that was considered but not needed here
- [Known issue: KI-bulk-checkbox-badge-overlap](docs/known-issues.yaml) — accepted trade-off for z-index overlap
