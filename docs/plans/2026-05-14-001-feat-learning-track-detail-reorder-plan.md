---
title: feat: Add drag-and-drop course reordering to Learning Track Detail page
type: feat
status: active
date: 2026-05-14
deepened: 2026-05-14
origin: docs/brainstorms/2026-05-14-learning-track-detail-reorder-requirements.md
---

# feat: Add drag-and-drop course reordering to Learning Track Detail page

## Overview

Users who create learning tracks have no way to reorder courses once the track is created. The syllabus timeline on `/learning-tracks/:trackId` is read-only. This feature adds an edit mode to the syllabus card with drag-and-drop reordering via @dnd-kit/sortable, and persists the new order through the existing `useLearningPathStore.reorderCourse()` API.

## Problem Frame

The only reordering UX lives inside the creation/editing dialog. On the detail page, courses display in fixed position order with no way to rearrange them. Users must delete and re-add courses or navigate away to make structural changes. This creates friction for anyone who needs to re-sequence their learning track after creation.

(see origin: `docs/brainstorms/2026-05-14-learning-track-detail-reorder-requirements.md`)

## Requirements Trace

- R1. Syllabus header gains "Edit" button to toggle edit mode
- R2. "Edit" becomes "Done" in edit mode; "Done" persists and exits
- R3. Entering edit mode does not auto-save. Changes begin with the first drag action.
- R4. Exiting edit mode without having performed any drags is a no-op.
- R5. Each course entry becomes draggable via its GripVertical handle
- R6. Drag handle always visible (not hover-only) during edit mode
- R7. Reordering uses 1-based position integers via `reorderCourse(pathId, fromIndex, toIndex)`
- R8. Gap entries are not draggable -- they retain fixed position
- R9. Course cards show elevated shadow and border highlight in edit mode
- R10. Locked/upcoming status indicators remain visible but visually softened
- R11. @dnd-kit/sortable vertical list strategy provides smooth animations
- R12. Each dragEnd event persists the new order immediately via `reorderCourse`, which handles optimistic updates and error rollback
- R13. On persistence failure, toast error shown and previous order restored (rollback handled by `reorderCourse`'s existing catch block)
- R14. No undo toast on reorder completion -- each dragEnd is its own commitment point, consistent with the VideoReorderDialog pattern. "Done" only exits edit mode.

## Scope Boundaries

- No new npm packages (all @dnd-kit packages already installed)
- No data model changes (`LearningPathEntry.position` and `reorderCourse` already support this)
- No gap-entry reordering
- No drag-to-add functionality
- No keyboard-reorder buttons (WCAG 2.5.7 single-pointer alternative -- documented as deferred)
- No multi-select or batch reorder
- No undo toast on "Done"
- Edit mode does not affect hero banner CTA

## Context & Research

### Relevant Code and Patterns

- **PathTimeline.tsx** (`src/app/components/learning-path/PathTimeline.tsx`): Renders syllabus timeline with `CourseTimelineEntry` (local component) and `GapTimelineEntry`. GripVertical element already exists. Outer `<motion.div>` wrapper around Card with unlock animation (`opacity`, `scale`). **The plan must account for animation conflict between motion.div and useSortable CSS transforms** -- see Key Technical Decisions.

- **DashboardCustomizer.tsx** (`src/app/components/DashboardCustomizer.tsx`): Existing @dnd-kit sortable. **Critical pattern**: `DndContext` + `SortableContext` always render together inside the conditional panel. `SortableSectionRow` calls `useSortable` unconditionally but only renders inside those contexts -- the component is never mounted outside `SortableContext`. Uses inline styles `{ transform: CSS.Transform.toString(transform), transition }` (no motion.div). Handle-only drag via `{...listeners}` on GripVertical. PointerSensor with `activationConstraint: { distance: 5 }`.

- **VideoReorderDialog.tsx** (`src/app/components/course/VideoReorderDialog.tsx`): Same pattern -- `DndContext` wraps all groups, `SortableContext` wraps each group's videos. `SortableVideoRow` calls `useSortable` unconditionally but only renders inside `SortableContext`. **Persistence pattern**: live per dragEnd (not on a "Save" button) -- `onReorder` fires optimistically, then `persistVideoOrder` writes to IndexedDB, with rollback on failure via `toast.error`. Uses inline styles (no motion.div).

- **useLearningPathStore.ts** (`src/stores/useLearningPathStore.ts`): `reorderCourse(pathId, fromIndex, toIndex)` handles optimistic update, syncableWrite persistence, and error rollback -- called per dragEnd in the pattern.

### Institutional Learnings

- **WCAG 2.5.7 single-pointer alternatives** (`docs/solutions/best-practices/wcag-2-5-7-single-pointer-drag-alternatives-2026-04-25.md`): All sortable surfaces should have MoveUpDownButtons for keyboard/pointer accessibility. Explicitly deferred to a follow-up per scope boundaries. When adding later: use `aria-disabled` not `disabled`, key ref maps by stable id, leverage existing `MoveUpDownButtons` component at `src/app/components/figma/MoveUpDownButtons.tsx`.

## Key Technical Decisions

- **DndContext always rendered when in edit mode, with sortable/non-sortable component split**: In `@dnd-kit/sortable` v10, calling `useSortable` without a `SortableContext` ancestor throws ("Could not find sortable context") -- it does not return inert refs. To avoid this, the component rendering `useSortable` must always have a `SortableContext` ancestor when mounted.

  **Chosen approach: component split, matching DashboardCustomizer and VideoReorderDialog patterns.**
  
  - Create a new `SortableCourseTimelineEntry` component that wraps the existing card content with `useSortable`, using inline styles (`CSS.Transform.toString(transform)`) for transform/transition.
  - When `editable` is true, PathTimeline renders `SortableCourseTimelineEntry` for course entries (inside `DndContext` + `SortableContext`) and `GapTimelineEntry` unchanged (outside `SortableContext`).
  - When `editable` is false, PathTimeline renders the existing `CourseTimelineEntry` with its `<motion.div>` wrapper unchanged.
  - This avoids conditional hooks, matches the existing codebase pattern (neither DashboardCustomizer nor VideoReorderDialog conditionally calls hooks), and keeps the motion.div behavior for non-edit mode.

  **Rejected alternative -- always render DndContext passively:** Would require making DndContext a no-op in non-edit mode (no sensor handlers, no visual feedback) while consuming DOM and layout overhead. Unnecessary complexity for no benefit.

- **Live persistence per dragEnd, consistent with VideoReorderDialog**: `reorderCourse` is called on every `dragEnd` event, not just on "Done". This matches the VideoReorderDialog pattern (line 489-506 in VideoReorderDialog.tsx). `reorderCourse` already handles optimistic updates with automatic rollback on failure. "Done" only exits edit mode. Requirements R3/R12/R14 are adjusted to match this semantic (see Requirements Trace).

- **Animation conflict resolved by component split**: In non-edit mode, `CourseTimelineEntry` keeps its existing `<motion.div>` wrapper for unlock animations. In edit mode, `SortableCourseTimelineEntry` uses `useSortable` with inline `CSS.Transform.toString(transform)` and no `motion.div` -- consistent with how DashboardCustomizer and VideoReorderDialog handle transforms. This eliminates the animation conflict entirely because the two approaches never coexist on the same element.

- **Handle-only drag activation**: `{...listeners}` on the GripVertical button only, `setNodeRef` on the card wrapper. The card's existing `onClick` for expand/collapse continues working when clicking outside the handle.

- **Gap entries excluded**: Only entries with a non-empty `courseId` are included in `SortableContext.items`. `GapTimelineEntry` remains unchanged. Gap entries render outside `SortableContext` but inside the DndContext (or outside both -- they are always non-sortable).

- **Softened visuals via CSS class toggle**: In edit mode, add a modifier class to course cards that reduces opacity/contrast of lock icons and status badges. Progress data is unaffected -- the change is purely presentational.

## Open Questions

### Resolved During Planning

- [R5] Drag on handle only? Yes -- consistent with DashboardCustomizer and VideoReorderDialog patterns.
- [Technical] How to compose DndContext with PathTimeline? Component split: sortable variant (`SortableCourseTimelineEntry`) when `editable`, existing `CourseTimelineEntry` when not. `DndContext` + `SortableContext` wrap only when `editable` is true.
- [Technical] useSortable called without SortableContext throws in v10. How to avoid? Use the component-split approach -- `useSortable` lives only inside `SortableCourseTimelineEntry`, which is only rendered inside `SortableContext`. This matches the pattern used by `SortableSectionRow` (DashboardCustomizer) and `SortableVideoRow` (VideoReorderDialog).
- [Technical] Animation conflict between motion.div and useSortable transforms? Resolved by the component split -- non-edit mode uses motion.div (CourseTimelineEntry), edit mode uses inline CSS transforms from useSortable (SortableCourseTimelineEntry). They never render on the same element.
- [Technical] Live persistence per dragEnd vs batching on "Done"? Live persistence per dragEnd matches VideoReorderDialog pattern and is functionally safe since `reorderCourse` handles optimistic updates with rollback. Requirements adjusted to match.
- [R10] How to soften progress visuals? Lower opacity on Lock icon, reduce contrast on status badge. Keep labels visible.

### Deferred to Implementation

- [R9] Exact elevated shadow token to use -- follow existing theme.css shadow tokens. Wire with a className toggle.
- [R10] Exact opacity values for softened progress states -- choose during implementation, aim for ~50% opacity on lock icons and muted badge text.

## Implementation Units

- [ ] **Unit 1: Edit mode toggle and props plumbing**

**Goal:** Add `isEditing` state to LearningTrackDetail, render "Edit"/"Done" button in the syllabus card header, thread `editable` and `onReorder` through PathTimeline.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx`
- Modify: `src/app/components/learning-path/PathTimeline.tsx`

**Approach:**
- Add `const [isEditing, setIsEditing] = useState(false)` in `LearningTrackDetail`
- In the syllabus card header section (lines 525-532), add an "Edit" button next to the course count. When `isEditing`, show a "Done" button (variant="brand") instead.
- "Done" calls `handleDoneEditing` which sets `isEditing = false` (persistence already happened per-dragEnd -- "Done" only exits edit mode)
- "Edit" simply sets `isEditing = true`
- Add `editable` prop (boolean, default false) and `onReorder` callback prop to `PathTimelineProps`
- Pass `editable={isEditing}` and `onReorder={(fromIndex, toIndex) => store.reorderCourse(pathId, fromIndex, toIndex)}` from LearningTrackDetail to PathTimeline

**Test scenarios:**
- Unit: LearningTrackDetail renders "Edit" text in syllabus header by default
- Unit: Clicking "Edit" changes button text to "Done"
- Unit: Clicking "Done" exits edit mode (button reverts to "Edit")
- Integration: Calling onReorder flows through to store.reorderCourse with correct pathId

**Verification:**
- Syllabus card header shows "Edit" in view mode and "Done" in edit mode

- [ ] **Unit 2: Sortable infrastructure in PathTimeline**

**Goal:** When `editable` is true, wrap course entries in DndContext and SortableContext. Create a sortable variant of CourseTimelineEntry that works with handle-only drag activation, avoiding the motion.div animation conflict via component split.

**Requirements:** R5, R6, R7, R8, R11

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/components/learning-path/SortableCourseTimelineEntry.tsx` (new component wrapping card content with useSortable)
- Modify: `src/app/components/learning-path/PathTimeline.tsx` (DndContext wrapping, conditional render of sortable vs non-sortable entries)
- Test: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**
- **Create `SortableCourseTimelineEntry.tsx`**, a new component that renders the same card content as `CourseTimelineEntry` but wraps it in:
  - `useSortable({ id: entry.courseId })` at the top level (always called -- the component only renders inside SortableContext)
  - `setNodeRef` on the Card wrapper div
  - `{...attributes}` on the wrapper div
  - `{...listeners}` on the GripVertical button only
  - Transform/transition from useSortable via **inline style** (`CSS.Transform.toString(transform)`), NOT motion.div -- matching DashboardCustomizer and VideoReorderDialog patterns
  - `isDragging` class (`opacity-50 shadow-lg z-10`) when being dragged
  - Reuses the same shared render-card-content function/logic to avoid duplication
- **No motion.div wrapper** in SortableCourseTimelineEntry -- this avoids the animation conflict entirely since motion.div only exists in the non-edit CourseTimelineEntry
- In PathTimeline's render:
  - Pre-compute the filtered entries list (as today)
  - When `editable` is true, wrap course entries in:
    ```
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={...} onDragEnd={...}>
      <SortableContext items={sortableEntryIds} strategy={verticalListSortingStrategy}>
        {filteredEntries.map(entry => {
          if (gap entry) return <GapTimelineEntry .../>; // outside SortableContext
          return <SortableCourseTimelineEntry .../>;
        })}
      </SortableContext>
      <DragOverlay>{activeEntry && <DragOverlayContent ... />}</DragOverlay>
    </DndContext>
    ```
  - When `editable` is false, render unchanged (existing CourseTimelineEntry with motion.div)
  - `sortableEntryIds` = filtered entries with non-empty courseId (gap entries excluded)
  - Gap entries render before/after the SortableContext (or outside it) -- they keep their position fixed
  - Handle `onDragEnd`: compute oldIndex/newIndex using active.id and over.id, find positions in the sortable entries array, call `onReorder(oldIndex, newIndex)`
  - Track activeId via state for DragOverlay
- Create a lightweight DragOverlay component for the course card being dragged (simplified card: course name, module number, grip handle)

**Patterns to follow:**
- DashboardCustomizer.tsx sensor configuration: `PointerSensor` with `activationConstraint: { distance: 5 }` and `KeyboardSensor`
- DashboardCustomizer.tsx's SortableSectionRow pattern: inline style for transform/transition (not motion.div), handle-only activation
- VideoReorderDialog.tsx's DragOverlayContent styling
- Existing CourseTimelineEntry's card content for the shared render function

**Test scenarios:**
- Happy path: CourseTimelineEntry renders without errors in non-editable mode (motion.div, no useSortable) -- no regression
- Happy path: SortableCourseTimelineEntry renders inside DndContext + SortableContext -- grip handle receives listeners, no errors
- Edge case: Single course entry -- no-op on drag (nothing to reorder with)
- Edge case: Gap entries are not included in SortableContext items
- Edge case: Drag gesture with distance < 5px does not activate (PointerSensor constraint)
- Edge case: SortableCourseTimelineEntry never errors with "Could not find sortable context" because it's always rendered inside SortableContext
- Integration: DragEndEvent with active over target at different position computes correct fromIndex/toIndex
- Integration: Toggling edit mode on/off alternates between CourseTimelineEntry and SortableCourseTimelineEntry without errors

**Verification:**
- CourseTimelineEntry renders without errors in non-editable mode (no regression)
- SortableCourseTimelineEntry renders without errors inside editable mode
- Drag handle activates sorting via pointer drag
- Gap entries remain fixed and non-draggable
- No animation conflict -- motion.div only renders in non-edit mode

- [ ] **Unit 3: Persistence wiring per dragEnd event**

**Goal:** Wire the PathTimeline.onReorder callback to `store.reorderCourse`, called on every dragEnd event (live persistence, matching VideoReorderDialog pattern). Error rollback handled by reorderCourse's existing mechanism.

**Requirements:** R3, R4, R12, R13, R14

**Dependencies:** Units 1, 2

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx`
- Test: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**
- Pass `onReorder` prop from LearningTrackDetail to PathTimeline as: `onReorder={(fromIndex, toIndex) => store.reorderCourse(trackId, fromIndex, toIndex)}`
- `reorderCourse` is called per each dragEnd event (live persistence, not batched on "Done") -- matching the VideoReorderDialog pattern
- "Done" button handler just exits edit mode: `setIsEditing(false)` -- no additional persistence call
- When no drag events occurred and "Done" is clicked (no-op scenario), no reorderCourse calls were made
- `reorderCourse` already handles optimistic update, syncableWrite persistence, reorderHistory recording, and error rollback with toast.error -- PathTimeline's onReorder is fire-and-forget

**Patterns to follow:**
- VideoReorderDialog's live-persistence pattern: reorder on dragEnd, rollback via onReorder(videos) on failure
- `reorderCourse` for optimistic update, syncableWrite, reorderHistory recording
- No additional toast on "Done" per R14

**Test scenarios:**
- Happy path: Dragging a course to a new position triggers reorderCourse with correct fromIndex/toIndex
- Integration: reorderCourse's existing error handling shows toast and restores previous order on failure
- Edge case: Entering edit mode and clicking "Done" without any drags -- no reorderCourse calls made (verified via spy/mock)
- Unit: onReorder prop passes through to store.reorderCourse with correct pathId

**Verification:**
- Resulting order persists in the store after each dragEnd
- No unnecessary writes on cancel/no-change

- [ ] **Unit 4: Visual treatment for edit mode**

**Goal:** Apply visual changes during edit mode: always-visible grip handle, elevated card shadows, softened progress state indicators.

**Requirements:** R6, R9, R10

**Dependencies:** Units 1, 2

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx`
- Modify: `src/app/components/learning-path/SortableCourseTimelineEntry.tsx`

**Approach:**
- Pass `isEditing` boolean prop to SortableCourseTimelineEntry (edit mode visual treatments apply to the sortable variant; CourseTimelineEntry is the read-only variant and unchanged)
- **Grip handle visibility (R6):** When `isEditing`, override the GripVertical container's opacity classes: `cn('flex-shrink-0 ...', isEditing && 'opacity-100', !isEditing && 'opacity-0 group-hover:opacity-100')`
- **Elevated shadow (R9):** When `isEditing`, add `shadow-md border-brand/20 ring-1 ring-brand/5` classes to the Card, replacing the default hover shadow
- **Drag handle during drag:** When `isDragging` from useSortable in SortableCourseTimelineEntry, add `opacity-50 shadow-lg z-10` to the course card
- **Softened progress states (R10):** When `isEditing`, reduce opacity of the Lock icon in locked entries: `cn(..., isEditing && 'opacity-50')`. Optionally reduce contrast of the status badge background. Keep labels visible so users can still see module status.

**Patterns to follow:**
- Existing card shadow tokens in theme.css (use `shadow-md`, `ring-brand/5`)
- DashboardCustomizer's isDragging styling pattern

**Test scenarios:**
- Happy path: In edit mode, grip handle has full opacity (not hover-gated)
- Happy path: In edit mode, course cards have elevated shadow class
- Happy path: Lock icon on locked entries has reduced opacity in edit mode
- Edge case: isEditing transitions from true to false -- visual state resets to normal
- Integration: isDragging class applied during an active drag operation

**Verification:**
- Visual state changes correctly toggle with isEditing
- No visual regressions in non-edit mode

- [ ] **Unit 5: Unit tests for edit mode and sortable behavior**

**Goal:** Add comprehensive unit tests covering PathTimeline in edit mode, SortableCourseTimelineEntry with useSortable, and the drag interaction contract.

**Requirements:** All

**Dependencies:** Units 1-4

**Files:**
- Modify: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**
- Add a describe block "PathTimeline edit mode" with tests:
  - `renders Edit button in syllabus header` (if testing in page context)
  - `displays grip handle at full opacity when editable is true`
  - `displays grip handle at hover-only opacity when editable is false`
  - `renders SortableCourseTimelineEntry inside DndContext when editable is true` (verify DndContext + SortableContext wrapping)
  - `renders non-sortable CourseTimelineEntry when editable is false` (no DndContext wrapper)
  - `marks gap entries as non-draggable` (they don't receive sortable data attributes)
  - `does not crash with single entry in edit mode`
- Add tests for visual treatment:
  - `applies elevated shadow class when editable is true`
  - `applies softened lock icon opacity when editable is true`

**Test scenarios:**
- Happy path: Entry renders in edit mode with all visual indicators
- Happy path: Edit mode toggles on/off without errors
- Edge case: Empty entries array in edit mode renders nothing
- Edge case: All gap entries in edit mode -- no sortable items

**Verification:**
- All existing tests continue to pass (no regressions)
- New edit mode tests cover the core interaction contract

- [ ] **Unit 6: E2E test for drag-and-drop reordering**

**Goal:** Add an end-to-end test that seeds a learning track with multiple courses, enters edit mode, performs a drag-and-drop reorder, and verifies persistence across reload.

**Requirements:** R1-R14

**Dependencies:** Units 1-4

**Files:**
- Create: `tests/e2e/learning-track-reorder.spec.ts`

**Approach:**
- Seed a learning path with 3 courses in the test database
- Navigate to `/learning-tracks/:trackId`
- Verify the syllabus shows courses in their initial order
- Click "Edit" to enter edit mode
- Use Playwright's `dragTo` or manual drag simulation to move a course card from position 2 to position 1
- Click "Done" to exit edit mode
- Reload the page and verify the new order persists
- Bonus: verify error state if persistence fails (mock DB failure)

**Patterns to follow:**
- `tests/e2e/learning-path-detail.spec.ts` for test setup and seeding pattern using `seedIndexedDBStore` and `indexedDB.seedImportedCourses`
- `tests/utils/test-time.ts` for `FIXED_DATE`

**Test scenarios:**
- Happy path: Drag a course to a new position, persist, reload, verify order
- Happy path: Enter edit mode, click "Done" without dragging -- no change to order
- Edge case: Attempting to drag a gap entry -- gap entry does not move
- Edge case: Dragging the first course to the last position via animation-based movement

**Verification:**
- E2E test passes in Chromium
- Existing E2E tests pass (no regressions)

## System-Wide Impact

- **Interaction graph:** PathTimeline gains two new props (`editable`, `onReorder`) but keeps backward compatibility via defaults. No callers outside LearningTrackDetail need updating.
- **Error propagation:** `reorderCourse` already handles optimistic update and error rollback. PathTimeline's onReorder is fire-and-forget from the component's perspective.
- **State lifecycle risks:** Entering edit mode without dragging and clicking "Done" must be a no-op -- no stale persistence calls.
- **Unchanged invariants:** The read-only PathTimeline behavior (no `editable` prop, or `editable=false`) is unchanged. Existing test suite must pass without modification. Gap entries, hero banner, and progress sidebar are unaffected.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| useSortable called without SortableContext ancestor throws in v10 | Component split approach (see Key Technical Decisions): SortableCourseTimelineEntry only renders when inside DndContext+SortableContext, and non-edit mode renders CourseTimelineEntry without useSortable. useSortable is never called without an ancestor. |
| Drag handle activation conflicts with card expand/collapse click | Handle-only activation ensures clicks on the card body (outside GripVertical) still trigger collapse/expand. Verify during unit tests. |
| Animation-sort conflict between motion.div and useSortable transforms | Eliminated by component split. Non-edit mode: CourseTimelineEntry uses motion.div for unlock animations. Edit mode: SortableCourseTimelineEntry uses inline CSS transforms from useSortable (no motion.div). The two approaches never coexist on the same element. Consistent with DashboardCustomizer and VideoReorderDialog patterns. |
| Gap entries visible in sortable item list can receive drop events | Exclude gap entries from SortableContext.items. The drag handler should only compute indices within the sortable (non-gap) entry list. |

## Documentation / Operational Notes

- The WCAG 2.5.7 single-pointer alternative (MoveUpDownButtons) is explicitly deferred. When adding it later, follow the pattern in `docs/solutions/best-practices/wcag-2-5-7-single-pointer-drag-alternatives-2026-04-25.md` and use the existing `src/app/components/figma/MoveUpDownButtons.tsx` component.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-14-learning-track-detail-reorder-requirements.md`
- **Related code:** `src/app/components/learning-path/PathTimeline.tsx`, `src/app/components/DashboardCustomizer.tsx`, `src/app/components/course/VideoReorderDialog.tsx`, `src/stores/useLearningPathStore.ts`
- **Institutional learning:** `docs/solutions/best-practices/wcag-2-5-7-single-pointer-drag-alternatives-2026-04-25.md`
- **Related PRs/issues:** Existing edit-path-dialog for creation/editing reorder
