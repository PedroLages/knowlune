---
title: "Lesson badge numbering in Course Content sidebar uses local folder indices instead of global position"
date: 2026-05-04
category: ui-bugs
module: Course Lesson Player
problem_type: ui_bug
component: frontend_stimulus
severity: medium
symptoms:
  - "Lesson badge numbers in Course Content sidebar restart from 1 for each folder's items"
  - "Badge numbers on folder items do not match the global 'Lesson X of Y' counter at the top"
  - "Items in different folders display duplicate badge numbers (e.g. 1, 2, 3 in folder A and 1, 2, 3 in folder B)"
  - "The user reported 'lesson 4 appears under lesson 74'"
root_cause: logic_error
resolution_type: code_fix
related_components:
  - tooling
tags:
  - lesson-player
  - sidebar
  - lesson-badge
  - folder-tree
  - index-mismatch
---

# Lesson Badge Numbering in Course Content Sidebar Uses Local Folder Indices Instead of Global Position

## Problem

Lesson badge numbering was inconsistent in the Course Content sidebar on the lesson player page. Items inside collapsible folders displayed local indices (their position within the folder) instead of global indices. A user at global position 4 would see badge "1" because that was the first item in its folder. The "Lesson X of Y" counter at the top used correct global indices, making the two displays contradict each other.

## Symptoms

- Inside a collapsible folder, lesson badges showed as 1, 2, 3 regardless of their actual position in the overall course
- The "Lesson X of Y" counter at the top used global indices, creating a disconnect between the sidebar badges and the counter
- Root-level items (outside folders) displayed correct global indices
- Courses without folders rendered correctly — the bug only affected courses with folder-organized lessons

## What Didn't Work

- **Initial assumption that data ordering was the root cause**: The non-deterministic `toArray()` in `useCourseAdapter` was considered a possible cause, but switching to `sortBy('order')` alone does not fix the badge numbers — only makes them deterministic.
- **Prior fix attempt (session history)**: A prior session attempted to re-add `groupIndexMap` to `LessonsTab.tsx` but failed because it assumed the code structure from before the lesson-player-polish refactor. The `groupIndexMap` variable and surrounding comment block had been removed during that earlier refactor — the edit pattern referenced code that no longer existed.
- **The `groupIndexMap` was once present but was removed inadvertently**: During the lesson-player-polish implementation (2026-05-03), the `groupIndexMap` was replaced with folder expansion state management in a contiguous block edit. The numbering regression was not caught because the sidebar looked correct when only root-level items existed. The session historian confirmed this was an unintentional side effect, not a deliberate removal.

## Solution

Two files were changed:

### File 1: `src/app/components/course/tabs/LessonsTab.tsx`

Pass the `groupIndexMap` into `FolderTreeNode` and use global indices inside folder rendering.

**Before** (inside `FolderTreeNode`, the `.map()` callback used local iteration index):

```tsx
{node.items.map((group, idx) => (
  <MaterialGroupRow
    key={group.primary.id}
    index={idx}   // WRONG: idx resets to 0 for each folder
    // ...
  />
))}
```

**After** (looks up the global position from the pre-computed map):

```tsx
{node.items.map(group => {
  const originalIndex = groupIndexMap.get(group.primary.id) ?? 0
  return (
    <MaterialGroupRow
      key={group.primary.id}
      index={originalIndex}   // CORRECT: global position
      // ...
    />
  )
})}
```

Additionally:
1. Added `groupIndexMap: Map<string, number>` to the `FolderTreeNode` props interface
2. Passed `groupIndexMap={groupIndexMap}` from `LessonsTab` to each `<FolderTreeNode>` instance
3. Passed `groupIndexMap={groupIndexMap}` recursively from parent `FolderTreeNode` to child instances

The `groupIndexMap` itself was already computed correctly in `LessonsTab`:

```tsx
const groupIndexMap = useMemo(
  () => new Map(materialGroups.map((g, i) => [g.primary.id, i])),
  [materialGroups]
)
```

### File 2: `src/hooks/useCourseAdapter.ts`

Ensure deterministic lesson ordering from Dexie.

**Before:**

```tsx
const videos = await db.importedVideos.where('courseId').equals(courseId).toArray()
```

**After:**

```tsx
const videos = await db.importedVideos.where('courseId').equals(courseId).sortBy('order')
```

This makes `useCourseAdapter` consistent with all other query sites (`CourseOverview`, `EditCourseDialog`, `UnifiedCourseDetail`, `VideoReorderDialog`), which already used `.sortBy('order')`.

## Why This Works

The root cause had two parts:

1. **Local iteration index is wrong for folders**: `Array.prototype.map()` provides a second `index` argument that reflects the element's position within the iterated array, not its position in the full course. When `node.items` is the slice of items inside a single folder directory, `idx` resets to 0 for each folder. A folder with 3 lessons shows badges 1-3, even when their actual global positions are 4-6.

2. **Non-deterministic ordering amplified the problem**: `toArray()` on a Dexie query returns results in insertion order, which is undefined across sessions. When items arrived in non-sequential order, the local indices made even less sense relative to the "Lesson X of Y" header.

The `groupIndexMap` provides O(1) lookup of any lesson's global position from the full `materialGroups` array, computed with `useMemo` to avoid recalculation on re-renders. Combined with `sortBy('order')`, the lessons are deterministically ordered and correctly numbered regardless of folder nesting.

## Prevention

- **Never use the `index` parameter from `.map()` for display indices** when rendering items from a filtered or sliced array. Always compute the display index from the original data source using a pre-computed lookup map.
- **Always use deterministic sorting** when querying data for numbered lists. Prefer `sortBy('field')` over `toArray()` in Dexie queries — `sortBy` returns a sorted Promise<T[]> deterministically.
- **Check all code paths when modifying shared state**: The `groupIndexMap` was accidentally removed during an adjacent refactor because it shared the same `useMemo` block as newly added folder state. Isolate unrelated derived state into separate `useMemo` calls to prevent this.
- **Verify folder-enclosed rendering paths separately**: When the UI has recursive components with different rendering paths for root items, flat items, and folder items, ensure each path uses the correct index source.

## Related Issues

- [course-content-sidebar-pdf-discoverability-2026-05-03.md](../ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md) — Same component (`LessonsTab.tsx`), same pattern of a hardcoded display value instead of real data flowing through props
- [code-review-2026-04-04-sidebar-materials.md](../../reviews/code/code-review-2026-04-04-sidebar-materials.md) — Prior code review of `LessonsTab.tsx` that highlighted hooks ordering issues with the same `groupIndexMap` data structure
