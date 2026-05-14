---
title: "Learning Track Detail Course Reordering -- SortableTimeline, Component Split, and @dnd-kit Patterns"
date: 2026-05-14
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Adding drag-and-drop sortable behavior to an existing component that uses motion.div for animations
  - Deciding how to handle useSortable's requirement for a SortableContext ancestor in @dnd-kit v10
  - Choosing collision detection strategy for variable-height sortable items
  - Designing edit-mode semantics (live persistence vs batch-on-done)
  - Integrating WCAG focus indicators with @dnd-kit drag handles
  - Managing filtered-entry index offsets when a parent component filters the sortable list
tags:
  - dnd-kit
  - sortable
  - use-sortable
  - component-split
  - animation-conflict
  - motion-div
  - closest-corners
  - collision-detection
  - live-persistence
  - drag-and-drop
  - reorder
  - learning-tracks
  - path-timeline
  - course-reordering
  - focus-visible-ring
  - wcag-keyboard
  - skip-course-id
  - implementation-lessons
related_components:
  - tooling
  - accessibility
---

# Learning Track Detail Course Reordering -- SortableTimeline, Component Split, and @dnd-kit Patterns

## Context

PR [#566](https://github.com/PedroLages/knowlune/pull/566) added an edit mode to the syllabus card on the Learning Track Detail page (`/learning-tracks/:trackId`), enabling drag-and-drop course reordering via `@dnd-kit/sortable`. The syllabus timeline (`PathTimeline`) had an existing read-only rendering using `CourseTimelineEntry` with a `motion.div` wrapper for unlock animations. Adding sortable behavior required reconciling `@dnd-kit`'s `useSortable` (which uses inline CSS transforms) with `motion.div`'s animation transforms, while respecting `@dnd-kit/sortable` v10's requirement that `useSortable` always has a `SortableContext` ancestor.

The implementation ran a standard CE pipeline with two review rounds. Round 1 found 7 issues, Round 2 found 1. Seven non-obvious lessons emerged from this run.

## Guidance

### 1. Component Split to Avoid Conditional Hook Calls in @dnd-kit v10

**Problem.** In `@dnd-kit/sortable` v10, calling `useSortable` without a `SortableContext` ancestor throws at runtime with "Could not find sortable context." This means you cannot conditionally call `useSortable` based on an `editable` flag -- the component must always have a `SortableContext` ancestor when mounted, or it crashes.

**Solution: Component split with two variants.**

Create a dedicated sortable variant that wraps the existing card content with `useSortable`:

```tsx
// SortableCourseTimelineEntry.tsx -- only rendered inside DndContext + SortableContext
export function SortableCourseTimelineEntry({ entry, info, ... }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.courseId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={cn('...', isDragging && 'opacity-50 shadow-lg z-10')}>
        {/* drag handle button with {...listeners} */}
        <button type="button" {...listeners}>
          <GripVertical />
        </button>
        {/* card content (intentionally duplicated -- see Lesson 2) */}
      </Card>
    </div>
  )
}
```

In the parent component, alternative between the two variants based on the `editable` flag:

```tsx
// PathTimeline.tsx
if (editable) {
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} ...>
      <SortableContext items={sortableEntryIds} strategy={verticalListSortingStrategy}>
        {filteredEntries.map(entry => (
          <SortableCourseTimelineEntry key={entry.courseId} ... />
        ))}
      </SortableContext>
    </DndContext>
  )
}

// Read-only mode: existing CourseTimelineEntry with motion.div
return (
  <>
    {filteredEntries.map(entry => (
      <CourseTimelineEntry key={entry.courseId} ... />
    ))}
  </>
)
```

**Why this works.** `useSortable` is never called without a `SortableContext` ancestor -- the `SortableCourseTimelineEntry` component only exists inside the `if (editable)` branch that wraps it in `DndContext` + `SortableContext`. This matches the existing codebase pattern used by `DashboardCustomizer.SortableSectionRow` and `VideoReorderDialog.SortableVideoRow`.

**Rejected alternative -- always render DndContext passively:** Would require making `DndContext` a no-op in non-edit mode (no sensors, no visual feedback) while consuming DOM and layout overhead. The component split is simpler, has no runtime overhead in read-only mode, and is consistent with existing patterns in the codebase.

### 2. motion.div and useSortable Transforms Cannot Coexist: Resolve via Component Split

**Problem.** `CourseTimelineEntry` wraps its card in a `<motion.div>` for unlock animations (opacity, scale transitions). `useSortable` controls positioning via CSS `transform` and `transition` inline styles. If both applied to the same element, the CSS transforms from `useSortable` and the Framer Motion transforms from `motion.div` would conflict -- each would overwrite the other's `transform` property.

**Solution.** The component split (from Lesson 1) also eliminates the animation conflict. The two approaches never coexist on the same element:

- **Read-only mode (editable=false):** `CourseTimelineEntry` renders the card inside `<motion.div>` for unlock animations. No `@dnd-kit` involvement.
- **Edit mode (editable=true):** `SortableCourseTimelineEntry` applies `useSortable` transforms via inline `style={...}`. No `motion.div` wrapper. The expanded lesson sections still use `motion.div` inside `AnimatePresence` (for collapse/expand animations), which do not conflict with the parent card's positioning transform.

This is the same pattern used by `DashboardCustomizer` and `VideoReorderDialog` -- both use inline `CSS.Transform.toString(transform)` without `motion.div`.

**The R1 review design finding.** The first implementation also included a subtle `GripVertical` icon in `CourseTimelineEntry` (read-only mode) at `opacity-0 group-hover:opacity-100`, as a visual hint that the items could be reordered. The R1 design review flagged this as incorrect because:
- The drag affordance suggests an action that is not available in read-only mode
- Users might try to grab the handle and get no response
- Drag affordances should only appear when the drag action is actually available

The fix removed the GripVertical from `CourseTimelineEntry` entirely -- the read-only variant has no drag-related elements at all.

### 3. Live Persistence per dragEnd (Not on "Done" Button)

**Problem.** Should `reorderCourse` be called on every `dragEnd` event (live persistence), or should drag updates be buffered and persisted only when the user clicks "Done"?

**Decision: Live persistence per dragEnd, matching the VideoReorderDialog pattern.**

```tsx
// handleDragEnd in PathTimeline -- called on every dragEnd
const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active, over } = event
  setActiveId(null)
  if (!over || active.id === over.id || !onReorder) return

  const activeEntryIndex = filteredEntries.findIndex(e => e.courseId === active.id)
  const overEntryIndex = filteredEntries.findIndex(e => e.courseId === over.id)
  if (activeEntryIndex === -1 || overEntryIndex === -1) return

  onReorder(activeEntryIndex, overEntryIndex)
}, [filteredEntries, onReorder])

// LearningTrackDetail -- onReorder calls store.reorderCourse
onReorder={(fromIndex, toIndex) => store.reorderCourse(pathId, fromIndex, toIndex)}
```

The "Done" button only exits edit mode -- it does not trigger persistence:

```tsx
// "Done" handler -- exits edit mode only
const handleDoneEditing = () => setIsEditing(false)
```

**Why live persistence is correct here:**
- `reorderCourse` already handles optimistic updates with automatic error rollback and `toast.error` on failure
- Each `dragEnd` is an atomic commitment point -- the user has expressed intent to put a course at a specific position
- There is no "save" mental model for reordering (unlike form data), so collecting drag operations into a batch before saving adds complexity without user benefit
- Matches `VideoReorderDialog`'s live-persistence pattern, providing consistent behavior across the app
- If all drags happened inside edit mode without issue, "Done" is a no-op -- no unnecessary writes

**Tests verify:**
- Dragging a course to a new position triggers `reorderCourse` with correct `fromIndex`/`toIndex`
- Entering edit mode and clicking "Done" without any drags makes zero `reorderCourse` calls
- Error rollback shows toast and restores previous order on persistence failure

### 4. closestCorners Handles Variable-Height Items Better Than closestCenter

**Problem.** The initial implementation used `collisionDetection={closestCenter}` (the default `@dnd-kit/core` strategy). During R1 design review, this caused the dragged item to snap to unintended positions because variable-height course cards have different center points that do not align intuitively with drop zones.

**Solution.** Switch to `collisionDetection={closestCorners}`:

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCorners}  // not closestCenter
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
```

`closestCorners` evaluates collision by comparing the four corners of the dragged element against the corners of each droppable. For variable-height items (where some cards have expanded descriptions, video counts, and duration badges while others are compact), this produces more intuitive drop positions because it considers the bounding rectangle rather than a single center point.

**When to use which:**
- `closestCenter`: Best for fixed-height items (uniform grid items, icon palettes)
- `closestCorners`: Best for variable-height items (cards with dynamic content, timeline entries with varying metadata), or when items have significantly different sizes

### 5. Focus-Visible Ring on Drag Handle for WCAG 2.4.7 Keyboard Accessibility

**Problem.** The drag handle button (`<button>` with `{...listeners}`) had no visible focus indicator. Keyboard users tabbing to the handle received no visual feedback, failing WCAG 2.4.7 (Focus Visible).

**Solution.** Add `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` to the drag handle button:

```tsx
<button
  type="button"
  className="... focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
  aria-label={`Drag to reorder module ${index + 1}`}
  {...listeners}
>
  <GripVertical className="size-4" aria-hidden="true" />
</button>
```

Open questions from the R2 review also caught that the button needs `type="button"` to prevent default form submission if the component is used inside a form context. This is a standard shadcn/ui convention -- always add `type="button"` to any `<button>` that is not a form submit trigger.

**Related patterns:** The existing `docs/solutions/best-practices/wcag-2-5-7-single-pointer-drag-alternatives-2026-04-25.md` documents the broader WCAG requirement for drag-and-drop surfaces (single-pointer alternatives via MoveUpDownButtons). The focus-visible ring addresses WCAG 2.4.7 specifically -- it provides keyboard focus visibility for the drag handle itself. A follow-up adding `MoveUpDownButtons` for the learning track timeline would address WCAG 2.5.7.

### 6. Intentional Card Content Duplication (Third Instance of the Deferred Extraction Pattern)

**Problem.** `SortableCourseTimelineEntry` renders the same card content as `CourseTimelineEntry` (module number, status badge, title, description, stats, action button, expandable lessons). Both components share the `TimelinePrimitives` (StatusCircle, EntryActionButton, LessonRow) that were extracted at the third consumer in the syllabus unification story. Should the card-level rendering also be shared?

**Decision: Intentional duplication, documented explicitly.**

```typescript
// SortableCourseTimelineEntry header comment:
// NOTE: The card content rendered below intentionally duplicates
// CourseTimelineEntry's renderCardContent. The two components diverge
// significantly in wrapper structure (useSortable CSS transforms vs
// motion.div) and expanded-lesson rendering paths, making a shared
// abstraction more costly than the duplication.
```

**Why extraction was not warranted:**
- The wrapper structure is fundamentally different: `SortableCourseTimelineEntry` needs `setNodeRef`, `style` (from `useSortable`), and `{...attributes}` on its wrapper div; `CourseTimelineEntry` needs `motion.div` for unlock animations
- The expanded-lesson rendering paths differ: `SortableCourseTimelineEntry` conditionally renders inside `DndContext` with drag overlay considerations
- Extracting a shared `CourseTimelineCard` would require the shared component to accept both `motion.div` props and `useSortable` props, creating a leaky abstraction that serves neither variant well
- The documented duplication is ~120 lines of JSX in a 340-line component file -- manageable and self-contained

This is the third instance of the "intentional duplication vs extraction" pattern in the learning-paths codebase (following `StatusCircle`/`LessonRow` in the course timeline view, and the `PathTimeline` content in `CourseTimelineView`). The pattern now has a clear decision framework:
- **At 2 consumers:** Extract only if both are in the same domain; otherwise document deferral
- **At 3 consumers across domains:** Extract (as happened with `TimelinePrimitives`)
- **When wrapper structure diverges fundamentally:** Do not extract -- the abstraction cost exceeds duplication cost

### 7. skipCourseId + editable Coupling: Documented but Unguarded Latent Bug

**Problem.** When `LearningTrackDetail` renders with `skipCourseId` (skipping a course that appears elsewhere in the navigation), `filteredEntries` excludes that course. The `handleDragEnd` handler computes `activeEntryIndex` and `overEntryIndex` against `filteredEntries`, not the full `entries` array. If `onReorder()` is used upstream to update the parent's entry ordering, the caller receives indices relative to the filtered list -- which would produce wrong results when applied to the full list.

**Decision: Document the coupling with a NOTE comment, but do not guard at runtime.**

```typescript
// NOTE: When skipCourseId is active, filteredEntries excludes the skipped
// course, so the indices passed to onReorder are relative to the filtered
// list, not the full `entries` array. If onReorder() is used upstream to
// update the parent's entry ordering, the caller must account for this
// offset -- either by mapping indices back to the full list or by ensuring
// skipCourseId is never set when editable is true.
const activeEntryIndex = filteredEntries.findIndex(e => e.courseId === activeCourseId)
const overEntryIndex = filteredEntries.findIndex(e => e.courseId === overCourseId)
```

**Why no runtime guard:**
- The current `onReorder` usage only calls `store.reorderCourse(pathId, fromIndex, toIndex)`, which operates on the store's internal ordering -- this is index-based and matched against the store's own entry list, which already excludes `skipCourseId` entries
- Adding a runtime guard would couple `PathTimeline` to knowledge of its parent's filtering logic
- The coupling is unlikely to trigger bugs because `skipCourseId` is only set on `LearningTrackDetail` (the same page that renders the timeline), and in practice, the skipped course is not part of the sortable interaction
- Future developers modifying the `onReorder` callback must read the NOTE and account for the offset if they use indices for non-store operations

**The lesson for future similar patterns:** When a component filters its input list, any index-based callbacks it exposes carry implicit offsets. Documenting the behavior is the minimum safeguard. A stronger safeguard would be to pass `courseId` rather than index, or to add a runtime assertion that `activeEntryIndex !== expectedIndex` before calling `onReorder`. For now, the NOTE is sufficient given the actual usage pattern.

## Why This Matters

These seven lessons form a reusable playbook for adding sortable behavior to any React component:

1. **Component split** is the canonical pattern for adding `@dnd-kit/sortable` to an existing component with `motion.div` -- it avoids both the "no SortableContext" error and the animation conflict in one decision
2. **Live persistence** on every `dragEnd` (not on "Done") is the right default for reordering UIs where the user's intent is expressed per-drag and the store already handles optimistic updates with rollback
3. **closestCorners** is the right collision detection default for variable-height card-based sortable lists
4. **Grip handle visibility** should strictly match edit-mode state -- no drag affordances in read-only mode
5. **WCAG 2.4.7 focus indicators** on drag handles are easy to miss during implementation but caught by design review
6. **Intentional duplication** is the right call when the wrapper structure diverges (useSortable vs motion.div), even though extraction is the default instinct
7. **Index-offset coupling** in filtered lists is a documented but unguarded risk -- a NOTE comment is the minimum, and future callers must read it

Collectively, these patterns were validated through two review rounds with concrete findings converging toward zero (R1: 7 findings, R2: 1 finding).

## When to Apply

- Before adding `@dnd-kit/sortable` to an existing component with `motion.div`, plan the component split from the start -- retrofitting is harder than designing for it
- When designing the edit-mode UX contract, decide on live-persistence vs batch-on-done based on whether the store has rollback semantics. If it does (like `reorderCourse`), live per dragEnd is simpler and matches user expectations
- For variable-height sortable items, default to `closestCorners` during planning -- changing it later means the collision behavior changes subtly and may affect tests
- Add `type="button"` and WCAG focus-visible rings to all drag handle buttons during initial implementation, not during review
- When the parent filters the sortable list, document the index-offset coupling with an explicit NOTE near the drag handler code
- When choosing between extraction and duplication for sortable card content, assess wrapper structure divergence first. If `useSortable` CSS transforms and `motion.div` are fundamentally incompatible (as they are here), duplication is the correct choice

## Examples

### Before/After: Component Split

**Before** (single component, conditional `useSortable` -- throws):
```tsx
function CourseTimelineEntry({ editable, ... }: Props) {
  // CRASH: useSortable called without SortableContext in non-edit mode
  const { ... } = editable ? useSortable({ id }) : {}
  return <motion.div>{/* content */}</motion.div>
}
```

**After** (two components, no conditional hooks):
```tsx
// Non-edit mode
function CourseTimelineEntry({ ... }: Props) {
  return <motion.div>{/* read-only content */}</motion.div>
}

// Edit mode (only rendered inside SortableContext)
function SortableCourseTimelineEntry({ ... }: Props) {
  const sortable = useSortable({ id: entry.courseId })
  return <div ref={sortable.setNodeRef} style={{ transform, transition }}>
    {/* editable content with drag handle */}
  </div>
}
```

### Before/After: Grip Handle in Read-Only Mode

**Before** (subtle grip handle in read-only -- false affordance):
```tsx
// CourseTimelineEntry.tsx
<div className="opacity-0 group-hover:opacity-100 text-muted-foreground/50">
  <GripVertical className="size-4" aria-hidden="true" />
</div>
```

**After** (no grip handle in read-only mode):
```tsx
// CourseTimelineEntry.tsx -- no GripVertical at all
<div>{/* card content only */}</div>

// SortableCourseTimelineEntry.tsx -- grip handle always visible
<button type="button" className="opacity-100 ..." {...listeners}>
  <GripVertical className="size-4" aria-hidden="true" />
</button>
```

## Related

- PR [#566](https://github.com/PedroLages/knowlune/pull/566) -- Learning Track Detail Course Reordering
- Plan: `docs/plans/2026-05-14-001-feat-learning-track-detail-reorder-plan.md`
- Requirements: `docs/brainstorms/2026-05-14-learning-track-detail-reorder-requirements.md`
- WCAG 2.5.7 single-pointer alternatives: `docs/solutions/best-practices/wcag-2-5-7-single-pointer-drag-alternatives-2026-04-25.md` (deferred follow-up for MoveUpDownButtons on the learning track timeline)
- Intentional duplication at 2 consumers: `docs/solutions/best-practices/course-timeline-syllabus-view-implementation-lessons-2026-05-11.md` (Lesson 2 -- same pattern, earlier PR)
- Extraction at third consumer: `docs/solutions/best-practices/course-detail-syllabus-unification-implementation-lessons-2026-05-12.md` (Lesson 1 -- TimelinePrimitives extraction)
- DashboardCustomizer pattern reference: `src/app/components/DashboardCustomizer.tsx`
- VideoReorderDialog pattern reference: `src/app/components/course/VideoReorderDialog.tsx`
- Source file: `src/app/components/learning-path/SortableCourseTimelineEntry.tsx`
- Source file: `src/app/components/learning-path/PathTimeline.tsx`
