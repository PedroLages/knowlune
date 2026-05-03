---
title: "Course Content sidebar — companion PDFs hidden behind collapsed groups"
date: 2026-05-03
category: ui-bugs
module: lessons-tab
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - Companion PDFs matched to video lessons invisible in Course Content sidebar unless user had previously visited the PDF lesson directly
  - No material count badge on video lesson rows despite companion PDFs existing in grouped data
  - Users perceived "no PDFs available" even though matchMaterialsToLessons had correctly associated them
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags:
  - lessons-tab
  - pdf
  - sidebar
  - material-groups
  - course-content
  - react-state
  - collapsible
---

# Course Content sidebar -- companion PDFs hidden behind collapsed groups

## Problem

Imported courses with paired video+PDF files per lesson (same folder, matching stems like `01-Introduction.mp4` / `01-Introduction.pdf`) had companion PDFs correctly matched by `matchMaterialsToLessons` but invisible in the Course Content sidebar. Two UI-level omissions in `LessonsTab.tsx` prevented the matched data from reaching the rendered tree: the material count badge was hardcoded to zero, and the collapsible groups were never auto-expanded on first load.

## Symptoms

- Companion PDF sub-rows hidden inside collapsed `Collapsible` groups with no visible affordance that PDFs existed
- No `FileText` badge with count on video primary rows, even when `group.materials.length > 0`
- Users had to navigate to a PDF lesson directly (e.g. via URL or Materials tab) to trigger the existing expansion effect, at which point the sidebar showed the sub-rows -- but this discovery path was accidental

## What Didn't Work

- **Search/filter workarounds**: Search did force folder expansion but did not expand material groups, so companion PDFs remained hidden even when filtered.
- **Reloading the adapter**: No effect -- the state initializer only seeded expansion when the active `lessonId` was itself a material, which was never the case when viewing the parent video.

## Solution

Two changes in `src/app/components/course/tabs/LessonsTab.tsx`:

### 1. Pass real material count to LessonLink (line 390)

In `MaterialGroupRow`, the branch where `hasMaterials` is true (`group.materials.length > 0`) was passing `materialCount={0}` to `LessonLink`. The badge rendering branch (`materialCount > 0`) in `LessonLink` was unreachable.

**Before:**
```tsx
// line 390 in MaterialGroupRow (hasMaterials = true branch)
materialCount={0}
```

**After:**
```tsx
materialCount={group.materials.length}
```

The `!hasMaterials` early-return branch continues to pass `materialCount={0}`, which is correct -- groups without materials show no badge.

### 2. Auto-expand groups with companion PDFs on first load

Added a `useEffect` that seeds `expandedMaterialGroups` from material presence when `materialGroups` resolves, using a course-keyed `useRef` to avoid re-expanding after user manually collapses groups.

```tsx
const initialExpandDoneRef = useRef(false)
const lastCourseIdRef = useRef(courseId)
const prevMaterialGroupIdsRef = useRef<Set<string>>(new Set())

// Reset when courseId changes
useEffect(() => {
  if (lastCourseIdRef.current !== courseId) {
    initialExpandDoneRef.current = false
    lastCourseIdRef.current = courseId
  }
}, [courseId])

// Auto-expand groups with companion PDFs on first load
useEffect(() => {
  if (isLoading || materialGroups.length === 0) return

  const groupsWithMaterials = new Set(
    materialGroups.filter(g => g.materials.length > 0).map(g => g.primary.id)
  )

  if (!initialExpandDoneRef.current) {
    // First load: expand all groups that have companion materials
    if (groupsWithMaterials.size > 0) {
      setExpandedMaterialGroups(prev => {
        const next = new Set(prev)
        for (const id of groupsWithMaterials) next.add(id)
        return next
      })
    }
    initialExpandDoneRef.current = true
    prevMaterialGroupIdsRef.current = groupsWithMaterials
  } else {
    // Subsequent loads: merge only new groups, preserve manual collapse
    const newIds = [...groupsWithMaterials].filter(
      id => !prevMaterialGroupIdsRef.current.has(id)
    )
    if (newIds.length > 0) {
      setExpandedMaterialGroups(prev => {
        const next = new Set(prev)
        for (const id of newIds) next.add(id)
        return next
      })
    }
    prevMaterialGroupIdsRef.current = groupsWithMaterials
  }
}, [isLoading, materialGroups])
```

The existing `useState` initializer and the lesson-id-driven `useEffect` (lines 674-696) are left unchanged -- they still handle the case where the user navigates directly to a companion PDF URL.

## Why This Works

The data was already correct. `matchMaterialsToLessons` properly associated companion PDFs to their parent video lessons, and `adapter.getGroupedLessons()` returned `MaterialGroup` objects with populated `materials` arrays. The gap was purely in the UI layer: the two mechanisms that make this data visible (badge count and default expansion) were both disconnected from the data.

**Invariants the solution relies on:**

1. **`group.materials.length > 0` is a reliable signal** -- it directly reflects whether `matchMaterialsToLessons` found companion PDFs. No need for a separate "has companions" flag.
2. **Standalone PDFs are safe-by-construction** -- a standalone PDF lesson has `materials.length === 0` (it is itself a primary row, not a material of another lesson). The `!hasMaterials` branch renders it as a plain `LessonLink` without a collapsible toggle, and the auto-expand effect finds nothing to expand. No regression.
3. **The merge strategy preserves user agency** -- on first load all groups with materials expand. If the user collapses a group, the `initialExpandDoneRef` gate prevents re-expansion. On adapter reload (same course, new data), only *newly discovered* group IDs are merged into the expanded set; manually collapsed groups stay collapsed.
4. **The course-keyed ref prevents cross-course state bleed** -- switching courses resets `initialExpandDoneRef`, giving each course its own first-load expansion.

## Prevention

- **When building controlled collapsible UIs backed by async data**, verify that the initial expanded state is seeded from the data, not just from route-driven heuristics. A common anti-pattern is seeding expanded state only from the active route parameter and assuming users will arrive via that route.
- **When a UI branch is unreachable**, check whether the condition feeding it is correct. In this case, `materialCount > 0` was a valid branch in `LessonLink` but the caller always passed `0`, so the branch never rendered. A unit test asserting the badge element when `materialCount > 0` would have caught this.
- **Test scenarios to add** (16 were added in the PR in `LessonsTab.test.tsx`):
  - Group with materials renders badge count matching `materials.length`
  - Group with materials auto-expands on first load
  - Manual collapse works and survives adapter reload
  - Standalone PDF (no materials) renders without collapsible toggle
  - Material count zero when group has no materials

## Related Issues

- PR: https://github.com/PedroLages/knowlune/pull/493
- Plan: `docs/plans/2026-05-03-003-feat-course-content-sidebar-pdf-access-plan.md`
- Related plan (historical): `docs/plans/2026-05-03-001-fix-show-root-level-pdfs-in-sidebar-plan.md` (root-level standalone PDF filtering -- separate issue)
- Origin: `docs/brainstorms/2026-05-02-course-lesson-player-polish-requirements.md` (requirement R3)
