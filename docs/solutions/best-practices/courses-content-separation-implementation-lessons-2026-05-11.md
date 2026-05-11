---
title: "Courses Content Separation and Filtering — Implementation Lessons"
date: 2026-05-11
category: best-practices
module: courses-page
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Implementing a multi-dimensional filter pipeline where tag counts must reflect the pre-tag subset rather than the post-tag subset
  - Rendering Zustand-connected UI inside a Radix Sheet/Drawer portal where function-reference selectors lose reactivity
  - Adding async store initialization guards to prevent flash of incorrect default state
  - Building filter stores that compose multiple independent filter dimensions
  - Adding responsive behavior at breakpoints that fall between existing useMediaQuery convenience hooks
tags:
  - filter-pipeline
  - tag-filter
  - zustand
  - is-loaded
  - set-filter
  - responsive-768px
  - radix-portal
  - primitive-subscriptions
  - course-filter-store
related_components:
  - filter-sidebar
  - course-store
---

# Courses Content Separation and Filtering — Implementation Lessons

## Context

PR [#560](https://github.com/PedroLages/knowlune/pull/560) added a right-side filter sidebar to the Courses page with track/standalone course separation, source filtering (All/YouTube), track visibility toggle, and tag-based filtering (feature branch `feature/ce-2026-05-11-courses-content-separation`). The implementation created 8 files with ~1,900 lines of new code spanning a Zustand filter store, a filter sidebar component with Sheet/Drawer responsive behavior, filter integration into the Courses page, and E2E tests.

Five non-obvious lessons emerged during this run, each addressing a subtle interaction between filter state management, React rendering, and UI framework behavior.

## Guidance

### 1. Tag Filter Pipeline Split: `preTagFilteredCourses` vs `finalFilteredCourses`

**Problem.** Tag counts in the sidebar must reflect the set of courses visible *before* the tag filter is applied. Without this split, selecting a tag reduces the pool of courses, which reduces the available tags, which can desaturate the very tag the user just selected. The tag counts appear to "zero out" as tags are selected, creating a confusing feedback loop.

**Solution.** Split the filter pipeline into two stages:

```typescript
// Courses.tsx — filter chain: track → source → status (pre-tag) → tags (final)

// preTagFilteredCourses is passed to the sidebar so all tag counts remain accurate
const preTagFilteredCourses = useMemo(() => {
  let result = showTrackCourses
    ? importedCourses
    : importedCourses.filter(c => !courseIdsInTracks.has(c.id))

  if (sourceFilter === 'youtube') {
    result = result.filter(c => c.source === 'youtube')
  }

  if (selectedStatuses.length > 0) {
    result = result.filter(c => selectedStatuses.includes(c.status))
  }

  return result
}, [importedCourses, courseIdsInTracks, showTrackCourses, sourceFilter, selectedStatuses])

const finalFilteredCourses = useMemo(() => {
  if (selectedTags.length === 0) return preTagFilteredCourses

  const tagSet = new Set(selectedTags.map(t => t.toLowerCase()))
  return preTagFilteredCourses.filter(c => c.tags.some(t => tagSet.has(t.toLowerCase())))
}, [preTagFilteredCourses, selectedTags])
```

The sidebar receives `availableCourses={preTagFilteredCourses}` and derives tag counts from it, so the counts always represent the set of courses after track/source/status filters but before tag selection. The grid renders from `finalFilteredCourses`, which includes the tag filter.

**Why this works.** The decoupling is semantic: tag counts answer the question "which tags are available among the currently relevant courses?" while the grid answers "which courses match all active filters?" These are different questions with different answers. Computing them from a single filtered set would force one answer to be correct at the expense of the other.

```typescript
// In CourseFilterSidebar.tsx — tag counts derived from pre-tag filter set
const { availableTags, tagCounts } = useMemo(() => {
  const countMap = new Map<string, number>()
  for (const course of availableCourses) {
    for (const tag of course.tags) {
      countMap.set(tag, (countMap.get(tag) ?? 0) + 1)
    }
  }
  // ...
}, [availableCourses])  // availableCourses = preTagFilteredCourses from parent
```

### 2. Radix Portal Rendering Isolation: Primitive Value Subscriptions Over Function References

**Problem.** The `SidebarHeaderContent` component (rendered inside the Sheet/Drawer header) was initially subscribing to the Zustand store with a function reference selector:

```typescript
// ❌ Wrong — function reference breaks reactivity inside Radix portal
const isAnyFilterActive = useCourseFilterStore(s => s.isAnyFilterActive())
```

This worked outside the portal but stopped triggering re-renders inside the Sheet/Drawer header because Radix renders header content in a React portal, which creates a separate rendering context. Zustand's subscription mechanism relies on React's reconciliation across the component tree, but portal-separated subtrees can have different subscription timing. The function reference (`isAnyFilterActive`) returns a new primitive (`boolean`) on each call, but the function identity is stable — Zustand only notifies subscribers when the selected value changes via `Object.is` comparison. Inside a portal, the shallow-equal check of the boolean return value can fail to propagate if the selector captures stale closure state.

**Solution.** Subscribe to the individual primitive values and compute the derived boolean locally:

```typescript
// ✅ Correct — subscribe to primitive values, compute locally
function SidebarHeaderContent({ isDrawer = false }: { isDrawer?: boolean }) {
  const source = useCourseFilterStore(s => s.source)          // string
  const showTrackCourses = useCourseFilterStore(s => s.showTrackCourses)  // boolean
  const selectedTags = useCourseFilterStore(s => s.selectedTags)          // string[]
  const isAnyActive = source !== 'all' || showTrackCourses || selectedTags.length > 0
  const clearFilter = useCourseFilterStore(s => s.clearFilter)
  // ...
}
```

**Why this works.** By subscribing to each primitive value individually, Zustand's `Object.is` comparison detects changes reliably regardless of rendering context. Each subscription returns a primitive (`string`, `boolean`, `string[]`) that changes value when the corresponding store field changes. The `isAnyActive` derivation runs locally, computed from fresh subscriptions every render, so it does not depend on a stale closure or portal propagation timing.

**General rule:** When subscribing to Zustand inside a Radix portal (Sheet, Drawer, Dialog, Popover), subscribe to primitive values — never to derived selectors that compute from a function reference. The derived computation can be done locally in the component body from the primitives.

### 3. `isLoaded` Guard Pattern for Async Store Initialization

**Problem.** `useLearningPathStore` initializes with `entries: []` — which is indistinguishable from "no tracks exist." On every cold page load and SPA navigation, before `loadPaths()` resolves, `courseIdsInTracks` is an empty set. This means all courses briefly appear as standalone (untracked), causing a visible flash before the store hydrates. When the store does hydrate, the course grid re-renders to hide the now-track-assigned courses, causing a jarring layout shift.

**Solution.** Add an `isLoaded: boolean` flag to the store that `loadPaths()` sets to `true` after completion:

```typescript
// In useLearningPathStore.ts
interface LearningPathState {
  // ...
  isLoaded: boolean  // Guard flag — follows useBookStore.isLoaded pattern
}

// In create():
isLoaded: false,

// In loadPaths():
loadPaths: async () => {
  if (get().isLoaded) return  // Skip if already loaded
  try {
    const paths = await db.learningPaths.toArray()
    const entries = await db.learningPathEntries.toArray()
    set({
      paths: sorted,
      entries,
      isLoaded: true,  // Mark ready after successful load
      // ...
    })
  } catch (error) {
    set({ error: 'Failed to load learning paths from database', isLoaded: true })
    // Also set isLoaded on error so the guard doesn't block forever
  }
},
```

Then in `Courses.tsx`, defer the filter pipeline output until `isLoaded` is true:

```typescript
const isLoaded = useLearningPathStore(s => s.isLoaded)

// ... later in render:
if (!isLoaded) {
  return <LoadingSkeleton />  // or use existing loading state
}
```

**Key properties of this pattern:**

- **Error case is also "loaded."** On error, `isLoaded` is set to `true` — this prevents the loading state from blocking the UI forever. The courses render without track information (all courses appear standalone), which is a graceful degradation rather than an infinite spinner.
- **Deduplication of first load.** The early return `if (get().isLoaded) return` prevents redundant database reads on subsequent calls, matching the `useBookStore.isLoaded` pattern.
- **Works with `useLazyStore` hook.** The store loads lazily via `useLazyStore(loadPaths)` in the component, which triggers the async load but doesn't block rendering. The `isLoaded` flag provides the render-readiness signal.

**Why this matters for UI stability.** Without this guard, the Courses page would flash untracked courses on every cold navigation, then shift the layout when track membership arrives. This is particularly bad for users who visit Courses frequently — they would see the flash on every page load. With the guard, the page shows a stable loading state until track membership is confirmed, then renders the correct view.

### 4. `setFilter(key, value)` Single-Dimension API

**Problem.** When a filter store exposes a `setFilters(object)` method that merges an entire state object, a caller changing one filter dimension must be careful to spread the existing state. A naive implementation like `setFilters({ source: 'youtube' })` silently clears `selectedTags`, `showTrackCourses`, and `selectedStatuses`. This bug appeared repeatedly in the Library tabbed IA refactor and was documented in a prior solution doc.

**Solution.** Expose a single-dimension setter that accepts a key and value, merging only that dimension:

```typescript
interface CourseFilters {
  source: 'all' | 'youtube'
  showTrackCourses: boolean
  selectedTags: string[]
  selectedStatuses: LearnerCourseStatus[]
}

// In the store:
setFilter: <K extends keyof CourseFilters>(key: K, value: CourseFilters[K]) => {
  set({ [key]: value })  // Zustand's set() does shallow merge — only [key] changes
},

clearFilter: key => {
  set({ [key]: DEFAULT_FILTERS[key] })
},

clearAllFilters: () => {
  set({ ...DEFAULT_FILTERS })
}
```

The TypeScript signature `setFilter(key: K, value: CourseFilters[K])` provides type safety — `setFilter('source', 'invalid')` is a compile error, and `setFilter('source', 'youtube')` is inferred correctly without type assertions.

**The companion functions:**

- `clearFilter(key)`: Resets a single dimension to its default, useful for the sidebar "Clear All" which only clears sidebar-managed filters (source, track toggle, tags) — it calls `clearFilter` three times rather than `clearAllFilters`.
- `clearAllFilters()`: Resets everything, used by the empty state "Clear all filters" button which should clear all filters including status.

**Why single-dimension is safer.** Multi-dimensional filter state is inherently independent — changing the source filter should not affect which tags are selected. The `setFilter(key, value)` API makes this contract explicit at the type level. A `setFilters(object)` API would either require the caller to spread current state (error-prone) or silently erase dimensions (bug-inducing).

This pattern reuses the established approach from `docs/solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md`.

### 5. 768px Responsive Boundary: Dedicated `useMediaQuery` Call

**Problem.** The Courses filter sidebar needed to switch between `Drawer` (bottom sheet, mobile) and `Sheet` (right panel, tablet/desktop) at 768px (`md` in Tailwind). However, the existing convenience hooks only cover 640px and 1024px breakpoints:

| Hook | Condition | Coverage |
|------|-----------|----------|
| `useIsMobile()` | `(max-width: 639px)` | Small phones |
| `useIsTablet()` | `(min-width: 640px) and (max-width: 1023px)` | Phablets + tablets |
| `useIsDesktop()` | `(min-width: 1024px)` | Desktop |

None of these detect the 768px boundary. `useIsMobile` (<640px) is too narrow — phones in landscape and large phones would get the Sheet. `useIsTablet` (640-1023px) is too broad — it covers both mobile and tablet behavior without distinguishing the 768px toggle point.

**Solution.** Call `useMediaQuery` directly with the specific breakpoint:

```typescript
// In CourseFilterSidebar.tsx
const isMobile = useMediaQuery('(max-width: 767px)')

// Use isMobile to switch between Drawer and Sheet
if (isMobile) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <SidebarHeaderContent isDrawer />
        {sidebarContent}
      </DrawerContent>
    </Drawer>
  )
}

return (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-[320px] sm:w-[380px] flex flex-col p-0">
      <SidebarHeaderContent />
      {sidebarContent}
    </SheetContent>
  </Sheet>
)
```

**Why this is better than adding a new convenience hook.** Adding a `useIsBelowMd()` hook would be over-generalization — the 768px boundary is specific to the Sheet/Drawer toggle behavior. The `useMediaQuery` hook accepts arbitrary CSS media query strings, so calling it directly with the exact breakpoint is the right level of abstraction. Adding a convenience hook for every Tailwind breakpoint would bloat `useMediaQuery.ts` with rarely-used variants.

**The pattern:** Use `useMediaQuery(query)` directly for component-specific breakpoints. Use the convenience hooks (`useIsMobile`, `useIsTablet`, `useIsDesktop`) for app-wide layout decisions (sidebar collapse, grid column changes). The two use cases have different stability requirements — app-wide breakpoints rarely change, while component-specific breakpoints are tuned per feature.

This pattern is consistent with the `CourseTimelineView` approach from PR #559, which also used `useMediaQuery('(max-width: 767px)')` directly.

## Why This Matters

These five lessons each solve a specific class of subtle bug that would be hard to diagnose after the fact:

1. **Tag filter pipeline** — a bug where tag counts zero out when selected is confusing and undermines trust in the filter UI. The split-pipeline pattern generalizes to any filter UI where one filter dimension counts options that another dimension controls.

2. **Portal rendering isolation** — a bug where Zustand subscriptions silently stop working in portal-rendered content is nearly impossible to debug without understanding both Zustand's `Object.is` notification mechanism and React portal rendering semantics. The fix is mechanical (subscribe to primitives, compute locally) but the root cause is subtle.

3. **Async initialization guards** — the "flash of wrong state" on page load is a common class of UI bug that degrades perceived performance. The `isLoaded` pattern is simple, composable, and follows an established codebase convention.

4. **Single-dimension setters** — a well-known anti-pattern that continues to resurface. The TypeScript-generic `setFilter(key, value)` pattern is self-documenting and type-safe.

5. **Breakpoint detection** — the existing convenience hooks cover the common cases. For component-specific breakpoints, calling `useMediaQuery` directly with the exact query is cleaner than proliferating convenience hooks.

## When to Apply

- When building filter pipelines where one dimension's options depend on the pre-filtered set (tags, categories, authors): apply the `preTagFilteredCourses` / `finalFilteredCourses` split pattern.
- When rendering Zustand-selector output inside any Radix portal (Sheet, Drawer, Dialog, Popover, HoverCard): subscribe to primitive values individually and compute derived booleans locally in the component body.
- When a Zustand store with async initialization exposes default state that is indistinguishable from a valid empty state: add an `isLoaded` flag and gate dependent computations.
- When adding filter state to any new page: use `setFilter(key, value)` single-dimension API, never `setFilters(object)`.
- When a component needs responsive behavior at a breakpoint not covered by existing convenience hooks: call `useMediaQuery(query)` directly rather than adding a new hook.

## Examples

**Good: preTagFilteredCourses passed to sidebar for accurate tag counts**
```tsx
<CourseFilterSidebar
  availableCourses={preTagFilteredCourses}
  courseIdsInTracks={courseIdsInTracks}
/>
```

**Good: primitive value subscriptions in portal-rendered header**
```tsx
function SidebarHeaderContent() {
  const source = useCourseFilterStore(s => s.source)
  const showTrackCourses = useCourseFilterStore(s => s.showTrackCourses)
  const selectedTags = useCourseFilterStore(s => s.selectedTags)
  const isAnyActive = source !== 'all' || showTrackCourses || selectedTags.length > 0
  // ...
}
```

**Good: isLoaded guard on async store initialization**
```typescript
isLoaded: false,
loadPaths: async () => {
  try {
    // ... load from Dexie
    set({ paths, entries, isLoaded: true })
  } catch (error) {
    set({ error: 'message', isLoaded: true }) // Graceful degradation
  }
}
```

**Good: setFilter with TypeScript generic key-value pair**
```typescript
setFilter: <K extends keyof CourseFilters>(key: K, value: CourseFilters[K]) => {
  set({ [key]: value })
}
```

**Good: dedicated useMediaQuery for component-specific breakpoint**
```typescript
const isMobile = useMediaQuery('(max-width: 767px)')
```

## Related

- PR [#560](https://github.com/PedroLages/knowlune/pull/560) — Courses Content Separation implementation
- Plan: `docs/plans/2026-05-11-001-feat-courses-content-separation-plan.md`
- `setFilter` single-dimension pattern: `docs/solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md`
- `isLoaded` pattern: `useBookStore` in `src/stores/useBookStore.ts`
- 768px `useMediaQuery` pattern: `docs/solutions/best-practices/course-timeline-syllabus-view-implementation-lessons-2026-05-11.md` (Lesson 4)
- rAF hydration guard (alternative to isLoaded): `docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md` (Lesson 1)
- Filter state management (BookFilters): `src/stores/useBookStore.ts`
