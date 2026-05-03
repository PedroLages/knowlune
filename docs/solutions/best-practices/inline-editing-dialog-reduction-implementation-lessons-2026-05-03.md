---
title: Inline Editing Dialog Reduction — Implementation Lessons
date: 2026-05-03
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Replacing modal dialogs with inline editing patterns in list/detail views
  - Using Zustand stores where Map-like data structures need reactive tracking
  - Building click-to-edit components that sit inside Link-wrapped card containers
  - Implementing optimistic delete with undo window and persistent state
  - Comparing two similar but diverged components for deduplication
tags:
  - inline-editing
  - zustand
  - map-reactivity
  - click-propagation
  - persist-timing
  - undo-pattern
  - deduplication
  - textarea-keyboard
related_components:
  - tooling
---

# Inline Editing Dialog Reduction — Implementation Lessons

## Context

This feature replaced three modal dialogs (rename, edit description, delete confirmation) on the learning-path management surface with inline editing and an immediate-delete-plus-undo-toast pattern. The plan was straightforward on paper -- create a click-to-edit component, wire it into two pages, add undo support to the store, remove ~250 lines of dialog code. In practice, five non-obvious pitfalls emerged that the plan critic, design review, and dedup scan caught before they became bugs. This document captures those learnings so the next inline-editing or undo-delete feature avoids them.

## Guidance

### 1. Zustand does not track native Map mutations -- use immutable Record replacement

When the store's `pendingDeletes` field was first implemented as a `Map<string, ...>`, the plan critic flagged that Zustand's shallow-equality change detection cannot observe native `Map.set()` or `Map.delete()`. Calling `set({ pendingDeletes })` after `map.set(...)` produces the same object reference that Zustand already holds, so subscribers never re-render.

**Wrong approach (native Map):**

```typescript
// Zustand will NOT detect this change
const pending = state.pendingDeletes
pending.set(pathId, { path, entries, timer })
set({ pendingDeletes: pending }) // same reference, no re-render
```

**Correct approach (immutable Record replacement):**

```typescript
// Zustand detects the new object reference
const pendingDeletes = { ...state.pendingDeletes }
pendingDeletes[pathId] = { path, entries, timer }
set({ pendingDeletes }) // new reference, triggers re-render
```

The same pattern applies to deletions:

```typescript
const pendingDeletes = { ...get().pendingDeletes }
delete pendingDeletes[pathId]
set({ pendingDeletes })
```

This is the single most important invariant for Zustand stores that hold mutable container types. `Record` with spread-based immutable replacement is the standard pattern; `Map` and `Set` should only be used inside Zustand when reactivity is not required (e.g., a transient cache that callers never subscribe to).

The plan critic caught this during document review before a single line of code was written -- plan-level review of data structure choices consistently pays off.

### 2. Links wrapping click-to-edit components need both stopPropagation AND preventDefault

Path cards on the list page are wrapped in a React Router `<Link>`, making the entire card clickable to navigate to the detail page. When `InlineEditableField` is rendered inside the card, clicking the text to edit must NOT navigate.

The initial implementation used only `e.stopPropagation()` on the click handler. The design review caught that `stopPropagation` alone is insufficient -- React Router's `<Link>` uses an `onClick` handler that calls `event.preventDefault()` internally to intercept the navigation. While `stopPropagation` prevents parent React event handlers from firing, the browser's native `<a>` click behavior can still navigate in some scenarios (especially with modifier keys or when React's synthetic event delegation reaches the anchor).

**Correct pattern:**

```typescript
const handleClick = useCallback(
  (e: React.MouseEvent) => {
    e.stopPropagation()  // prevent React parent handlers from firing
    e.preventDefault()   // prevent the browser's native anchor navigation
    if (!isEditing) {
      enterEdit()
    }
  },
  [isEditing, enterEdit]
)
```

The same pairing is needed on the editing input/textarea elements to prevent clicks on the input from bubbling to the card's Link:

```typescript
<input
  onClick={e => e.stopPropagation()}
  // ...
/>
```

Without both calls, edge cases arise: Shift+click on the edit field could open a new tab, and focus/blur interactions could trigger parent-level navigation in some browser/React Router versions.

### 3. InlineEditableField vs EditableTitle: when NOT to deduplicate

The codebase already had `EditableTitle` from E1C-S02 -- an inline-editable component used on course headers. During the dedup scan, the question arose: should `InlineEditableField` be merged with `EditableTitle`?

The answer was **no**, and the reason is a concrete metric: **parameter divergence > 3**.

| Parameter | `EditableTitle` | `InlineEditableField` |
|-----------|----------------|----------------------|
| Edit trigger | Button with pencil icon | Click-to-edit on text itself |
| Input mode | `input` only | `input` or `textarea` |
| Keyboard save | Enter only | Enter (input) / Ctrl+Enter (textarea) |
| Validation | Non-empty enforcement with error message | Caller decides (blind save) |
| Visual confirmation | None | Green border flash (1.8s) |
| Click propagation | N/A (no Link wrapper) | Must stopPropagation + preventDefault |
| Empty/placeholder | Shows "Click to edit" placeholder | Shows placeholder or "Click to edit" fallback |
| Focus handling | Auto-focus + select-all on mount | auto-focus via setTimeout(0) |

That is 8 diverged concerns. The rule of thumb: if merging two components would require more than 3 conditional branches to cover their differences, keep them separate. A merged component that handles both cases would be harder to understand, test, and maintain than two focused components.

The dedup scan correctly classified this as a false positive. When a dedup tool flags two similarly-shaped components, count the parameter/behavior divergences before attempting extraction.

### 4. Textarea inline editing requires Ctrl+Enter save pattern

When `InlineEditableField` renders as a `<textarea>` (used for path descriptions), pressing Enter should insert a newline, not save. This matches user expectations for multi-line text fields in every editor. The save action moves to `Ctrl+Enter` (or `Cmd+Enter` on macOS).

```typescript
const handleTextareaKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      commitSave()
    } else if (e.key === 'Escape') {
      setDraftValue(originalValue.current)
      setIsEditing(false)
    }
    // Plain Enter passes through to insert newline
  },
  [commitSave]
)
```

Contrast with the `input` mode, where Enter always saves (since single-line inputs have no use for newline insertion):

```typescript
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commitSave()
    } else if (e.key === 'Escape') {
      setDraftValue(originalValue.current)
      setIsEditing(false)
    }
  },
  [commitSave]
)
```

The component accepts an `as` prop (`'input' | 'textarea'`) and switches keyboard handlers accordingly. Do not use the same Enter-to-save behavior for both modes -- it makes multi-line editing unusable.

### 5. restorePath must await persistWithRetry before clearing pendingDeletes

This was the most subtle invariant in the undo-delete implementation. The `restorePath` method re-inserts a deleted path and its entries into in-memory state and then persists them via `syncableWrite`. If `pendingDeletes` is cleared *before* persistence completes, and persistence fails, the state and Dexie diverge:

- In-memory state: path is back (optimistic update already applied)
- `pendingDeletes`: entry is gone (cleared prematurely)
- Dexie: path still missing (persist failed)

If the user then clicks "Undo" again, `restorePath` finds no `pendingDeletes` entry and returns early -- a silent no-op. The path is permanently lost from Dexie despite appearing in state until the next reload.

**Correct order:**

```typescript
restorePath: (pathId: string) => {
  const pending = get().pendingDeletes[pathId]
  if (!pending) return

  clearTimeout(pending.timer)

  // 1. Optimistic state update (immediate)
  set(state => ({
    paths: [...state.paths, pending.path],
    entries: [...state.entries, ...pending.entries],
    error: null,
  }))

  // 2. Persist FIRST, then clear pendingDeletes on success
  persistWithRetry(async () => {
    await syncableWrite('learningPaths', 'put', pending.path)
    for (const entry of pending.entries) {
      await syncableWrite('learningPathEntries', 'put', entry)
    }
  })
    .then(() => {
      // 3. Only clear pendingDeletes AFTER successful persistence
      const pendingDeletes = { ...get().pendingDeletes }
      delete pendingDeletes[pathId]
      set({ pendingDeletes })
    })
    .catch(error => {
      // 4. On failure, keep pendingDeletes so Undo can be retried
      console.error('[LearningPathStore] Failed to persist restored path:', error)
      toast.error('Failed to restore path — retry Undo')
    })
}
```

The invariant: **pendingDeletes is the authority on whether a path is in the undo window**. It must only be cleared after the path is safely back in Dexie. Clearing it before persistence creates a state where the path exists in memory but has no recovery path -- invisible on the next `loadPaths()`.

The same principle applies in the opposite direction: `_finalizeDelete` also uses immutable replacement to clear the `pendingDeletes` entry, but only after the persist call succeeds. If persistence fails, the entry is retained to prevent re-finalization attempts.

## Why This Matters

These five learnings share a common thread: the gap between what works on paper and what works in the runtime. Plan review, design review, and dedup scanning each caught a different class of issue that would have been expensive to debug after the fact:

- Plan review caught the **data structure** issue (Map reactivity) -- architecture-level, caught before code existed
- Design review caught the **interaction** issue (click propagation) -- UX-level, caught during visual testing
- Dedup scan caught the **abstraction timing** issue (component merge) -- maintenance-level, caught before tech debt accumulated

The specific patterns (immutable Record for Zustand containers, stopPropagation+preventDefault on Link-wrapped editables, Ctrl+Enter for textarea save, persist-before-clear sequencing) are reusable across any feature that combines inline editing with navigation surfaces and undo mechanics.

## When to Apply

- When replacing any modal dialog with inline editing on a clickable card surface
- When adding Map/Set-like state to a Zustand store that subscribers need to observe
- When building an `EditableField`-style component -- check existing components (like `EditableTitle`) before creating a new one, using the >3 parameter divergence test
- When implementing any optimistic-mutation-plus-undo pattern where in-memory markers gate recovery -- always persist before clearing the marker
- When adding textarea-based inline editing -- use Ctrl+Enter to save, plain Enter for newlines

## Examples

### Detecting Map reactivity issues in plan review

Before implementing a new Zustand field, ask: "Will subscribers need to observe mutations to this data?" If yes, and the data is Map/Set-shaped, use `Record` or an array with immutable replacement. This is checkable during plan review -- no code needed.

### Dedup decision heuristic

When a tool flags two components as duplicates:

1. List the parameters and behaviors of each
2. Count the divergences
3. If >3 divergences, keep them separate
4. If <=3 divergences, the shared one can absorb the differences with a reasonable number of conditional branches

### Persist-before-clear invariant template

For any undo pattern with a deletion marker:

```
1. Apply optimistic update to in-memory state
2. Show undo toast with recovery callback
3. On recovery: persist → on success: clear marker; on failure: keep marker + retry hint
4. On timer expiry: persist → on success: clear marker; on failure: keep marker + log
```

Never clear the marker before the persist resolves. The marker is the source of truth for whether recovery is possible.

## Related

- [curriculum-composer-implementation-lessons-2026-05-03.md](curriculum-composer-implementation-lessons-2026-05-03.md) -- same module, different feature (dialog composition vs inline editing)
- [zustand-stale-async-results-generation-counter-2026-05-03.md](zustand-stale-async-results-generation-counter-2026-05-03.md) -- related Zustand pattern (stale async results, different mechanism)
- PR: https://github.com/PedroLages/knowlune/pull/498
- Plan: docs/plans/2026-05-03-008-feat-inline-editing-dialog-reduction-plan.md
- Component: `src/app/components/figma/InlineEditableField.tsx`
- Store: `src/stores/useLearningPathStore.ts` (lines 282-409)
- Compared component: `src/app/components/figma/EditableTitle.tsx`
