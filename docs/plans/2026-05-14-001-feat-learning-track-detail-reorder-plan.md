---
title: feat: Add drag-and-drop course reordering to Learning Track Detail page
type: feat
status: active
date: 2026-05-14
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
- R3. Entering edit mode does not auto-save
- R4. Exiting without changes is a no-op
- R5. Each course entry becomes draggable via its GripVertical handle
- R6. Drag handle always visible (not hover-only) during edit mode
- R7. Reordering uses 1-based position integers via `reorderCourse(pathId, fromIndex, toIndex)`
- R8. Gap entries are not draggable -- they retain fixed position
- R9. Course cards show elevated shadow and border highlight in edit mode
- R10. Locked/upcoming status indicators remain visible but visually softened
- R11. @dnd-kit/sortable vertical list strategy provides smooth animations
- R12. On "Done", new order persisted via `reorderCourse`
- R13. On persistence failure, toast error shown and previous order restored
- R14. No undo toast on reorder completion -- "Done" is the commitment point

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

- **PathTimeline.tsx** (`src/app/components/learning-path/PathTimeline.tsx`): Renders syllabus timeline with `CourseTimelineEntry` (local component, lines 137-401) and `GapTimelineEntry` (lines 53-133). GripVertical element already exists at line 197 with `opacity-0 group-hover:opacity-100`.
- **DashboardCustomizer.tsx** (`src/app/components/DashboardCustomizer.tsx`): Existing @dnd-kit sortable with `DndContext`, `SortableContext`, `verticalListSortingStrategy`, `DragOverlay`. Handle-only drag via `{...listeners}` on GripVertical.
- **VideoReorderDialog.tsx** (`src/app/components/course/VideoReorderDialog.tsx`): Same pattern with persistence via IndexedDB write. Shows error rollback pattern.
- **useLearningPathStore.ts** (`src/stores/useLearningPathStore.ts`): `reorderCourse(pathId, fromIndex, toIndex)` at line 594 handles optimistic update, syncableWrite persistence, and error rollback.

### Institutional Learnings

- **WCAG 2.5.7 single-pointer alternatives** (`docs/solutions/best-practices/wcag-2-5-7-single-pointer-drag-alternatives-2026-04-25.md`): All sortable surfaces should have MoveUpDownButtons for keyboard/pointer accessibility. Explicitly deferred to a follow-up per scope boundaries. When adding later: use `aria-disabled` not `disabled`, key ref maps by stable id, leverage existing `MoveUpDownButtons` component at `src/app/components/figma/MoveUpDownButtons.tsx`.

## Key Technical Decisions

- **DndContext inside PathTimeline**: When the `editable` prop is true, `PathTimeline` wraps the entries in `DndContext` + `SortableContext`. When false, renders the existing read-only layout. This keeps the edit-mode concern colocated with the timeline component rather than leaking it to the page level.

- **useSortable unconditionally on CourseTimelineEntry**: Called without conditional branching -- if no DndContext ancestor exists, useSortable returns inert refs. This avoids React hook rule violations while keeping the component single.

- **Handle-only drag activation**: `{...listeners}` on the GripVertical button only, `setNodeRef` on the card wrapper. The card's existing `onClick` for expand/collapse continues working when clicking outside the handle.

- **Gap entries excluded**: Only entries with a non-empty `courseId` are included in `SortableContext.items`. `GapTimelineEntry` remains unchanged.

- **Softened visuals via CSS class toggle**: In edit mode, add a modifier class to course cards that reduces opacity/contrast of lock icons and status badges. Progress data is unaffected -- the change is purely presentational.

## Open Questions

### Resolved During Planning

- [R5] Drag on handle only? Yes -- consistent with DashboardCustomizer and VideoReorderDialog patterns.
- [Technical] How to compose DndContext with PathTimeline? DndContext wraps inside PathTimeline when `editable` is true. CourseTimelineEntry uses useSortable unconditionally.
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
- "Done" calls `handleDoneEditing` which triggers persistence, then sets `isEditing = false`
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

**Goal:** When `editable` is true, wrap course entries in DndContext and SortableContext. Make CourseTimelineEntry work as a sortable item with handle-only drag activation.

**Requirements:** R5, R6, R7, R8, R11

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx` (DndContext wrapping, CourseTimelineEntry modifications)
- Test: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**
- Import DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors from `@dnd-kit/core`
- Import SortableContext, verticalListSortingStrategy, useSortable, arrayMove from `@dnd-kit/sortable`
- Import CSS from `@dnd-kit/utilities`
- In CourseTimelineEntry:
  - Call `useSortable({ id: entry.courseId })` at the top level (unconditional)
  - Apply `setNodeRef` to the outer container div
  - Apply `{...attributes}` to the outer container div
  - Apply `{...listeners}` to the GripVertical button only
  - Apply CSS transform/transition from useSortable to the outer container
  - Add `isDragging` class (`opacity-50 shadow-lg z-10`) when being dragged
- In PathTimeline render:
  - When `editable` is true, wrap the filteredEntries.map output in:
    ```
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={...} onDragEnd={...}>
      <SortableContext items={sortableEntryIds} strategy={verticalListSortingStrategy}>
        {filteredEntries.map(entry => ...)}
      </SortableContext>
      <DragOverlay>{activeEntry && <DragOverlayContent ... />}</DragOverlay>
    </DndContext>
    ```
  - `sortableEntryIds` = filtered entries with non-empty courseId (gap entries excluded via a separate code path)
  - Gap entries still render outside SortableContext but inside the DndContext (or split the render into sortable and non-sortable sections)
  - Handle `onDragEnd`: compute oldIndex/newIndex using active.id and over.id, find positions in the filtered entries array, call `onReorder(oldIndex, newIndex)`
  - Track activeId via state for DragOverlay
- Create a lightweight DragOverlay component for the course card being dragged (showing course name, module number, simplified card appearance)

**Patterns to follow:**
- DashboardCustomizer.tsx sensor configuration: `PointerSensor` with `activationConstraint: { distance: 5 }` and `KeyboardSensor`
- DashboardCustomizer.tsx DragOverlay pattern showing the dragged item above the list
- VideoReorderDialog.tsx for DragOverlayContent styling

**Test scenarios:**
- Happy path: CourseTimelineEntry renders normally (no DndContext ancestor) -- no errors, useSortable is inert
- Happy path: CourseTimelineEntry renders inside DndContext -- grip handle receives listeners
- Edge case: Single course entry -- no-op on drag (nothing to reorder with)
- Edge case: Gap entries are not included in SortableContext items
- Edge case: Drag gesture with distance < 5px does not activate (PointerSensor constraint)
- Integration: DragEndEvent with active over target at different position computes correct fromIndex/toIndex

**Verification:**
- CourseTimelineEntry renders without errors in both editable and non-editable modes
- Drag handle activates sorting via pointer drag
- Gap entries remain fixed and non-draggable

- [ ] **Unit 3: Persistence wiring and "Done" handler**

**Goal:** Wire the PathTimeline.onReorder callback to `store.reorderCourse`, and handle the "Done" button's save-and-exit flow. Include error handling with rollback.

**Requirements:** R3, R4, R12, R13, R14

**Dependencies:** Units 1, 2

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx`
- Test: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**
- Pass `onReorder` prop from LearningTrackDetail to PathTimeline as: `onReorder={(fromIndex, toIndex) => store.reorderCourse(trackId, fromIndex, toIndex)}`
- In LearningTrackDetail's handleDoneEditing:
  - `reorderCourse` is called per each drag event (so order is already updated live during drag)
  - "Done" handler just exits edit mode: `setIsEditing(false)`
  - If reorderCourse failed (caught via error state), show toast and optionally reset
- PathTimeline calls `onReorder` for each dragEnd event
- When `editable` changes from true to false without any drag events, it is a no-op (no extra persistence writes)

**Patterns to follow:**
- `reorderCourse` already handles optimistic update, syncableWrite, reorderHistory recording
- No additional toast on "Done" per R14

**Test scenarios:**
- Happy path: Dragging a course to a new position and clicking "Done" -- reorderCourse called with correct indices
- Edge case: Entering edit mode and clicking "Done" without any drags -- no reorderCourse calls made
- Error path: If reorderCourse throws, toast.error shown, previous order restored (handled by reorderCourse's existing catch block)
- Unit: onReorder prop passes through to store.reorderCourse with correct pathId

**Verification:**
- Resulting order persists in the store
- No unnecessary writes on cancel/no-change

- [ ] **Unit 4: Visual treatment for edit mode**

**Goal:** Apply visual changes during edit mode: always-visible grip handle, elevated card shadows, softened progress state indicators.

**Requirements:** R6, R9, R10

**Dependencies:** Units 1, 2

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx`

**Approach:**
- Pass `isEditing` boolean prop to CourseTimelineEntry
- **Grip handle visibility (R6):** When `isEditing`, override the GripVertical container's opacity classes: `cn('flex-shrink-0 ...', isEditing && 'opacity-100', !isEditing && 'opacity-0 group-hover:opacity-100')`
- **Elevated shadow (R9):** When `isEditing`, add `shadow-md border-brand/20 ring-1 ring-brand/5` classes to the Card, replacing the default hover shadow
- **Drag handle during drag:** When `isDragging` from useSortable, add `opacity-50 shadow-lg z-10` to the course card
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

**Goal:** Add comprehensive unit tests covering PathTimeline in edit mode, CourseTimelineEntry with useSortable, and the drag interaction contract.

**Requirements:** All

**Dependencies:** Units 1-4

**Files:**
- Modify: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**
- Add a describe block "PathTimeline edit mode" with tests:
  - `renders Edit button in syllabus header` (if testing in page context)
  - `displays grip handle at full opacity when editable is true`
  - `displays grip handle at hover-only opacity when editable is false`
  - `renders without error when editable is true with no DndContext` (useSortable inert)
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
| useSortable called without DndContext ancestor might throw | Check @dnd-kit/sortable v10 behavior -- if it errors, wrap CourseTimelineEntry with a conditional that only uses useSortable when inside a DndContext (use DndContext consumer or context check). This is unlikely but worth verifying during implementation. |
| Drag handle activation conflicts with card expand/collapse click | Handle-only activation ensures clicks on the card body (outside GripVertical) still trigger collapse/expand. Verify during unit tests. |
| Animation-sort conflict with motion.div wrapping | CourseTimelineEntry's outer motion.div and Card useSortable transform may interact. Use transform from useSortable and disable motion animation during edit mode, or compose transforms. |
| Gap entries visible in sortable item list can receive drop events | Exclude gap entries from SortableContext.items. The drag handler should only compute indices within the sortable (non-gap) entry list. |

## Documentation / Operational Notes

- The WCAG 2.5.7 single-pointer alternative (MoveUpDownButtons) is explicitly deferred. When adding it later, follow the pattern in `docs/solutions/best-practices/wcag-2-5-7-single-pointer-drag-alternatives-2026-04-25.md` and use the existing `src/app/components/figma/MoveUpDownButtons.tsx` component.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-14-learning-track-detail-reorder-requirements.md`
- **Related code:** `src/app/components/learning-path/PathTimeline.tsx`, `src/app/components/DashboardCustomizer.tsx`, `src/app/components/course/VideoReorderDialog.tsx`, `src/stores/useLearningPathStore.ts`
- **Institutional learning:** `docs/solutions/best-practices/wcag-2-5-7-single-pointer-drag-alternatives-2026-04-25.md`
- **Related PRs/issues:** Existing edit-path-dialog for creation/editing reorder
