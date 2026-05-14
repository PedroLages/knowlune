---
date: 2026-05-14
topic: learning-track-detail-reorder
---

# Learning Track Detail — Course Reordering

## Problem Frame

Users who create learning tracks have no way to reorder courses once the track is created. The only reordering option exists in the creation/editing dialog. On the detail page (`/learning-tracks/:trackId`), the syllabus timeline is read-only — courses display in fixed order with no way to rearrange them. This forces users to delete and re-add courses or leave the detail page to make structural changes.

## Requirements

**Edit Mode Entry**
- R1. The syllabus card header ("Syllabus" title row) gains an "Edit" button that toggles the timeline into edit mode.
- R2. While in edit mode, the "Edit" button changes to "Done" to confirm and save the new order.
- R3. Entering edit mode does not auto-save any previous reordering; exiting via "Done" persists the current order.
- R4. Exiting edit mode without changes is a no-op (no unnecessary writes).

**Drag-and-Drop Reordering**
- R5. In edit mode, each course entry in the timeline becomes draggable via its existing `GripVertical` handle (already rendered at `PathTimeline.tsx` line 197, currently `opacity-0`).
- R6. The drag handle is always visible (not just on hover) during edit mode.
- R7. Reordering follows the same positional logic as `useLearningPathStore.reorderCourse(pathId, fromIndex, toIndex)` — entries are 1-based position integers in `LearningPathEntry.position`.
- R8. Gap entries (courses not in the user's library) are not draggable in edit mode — they retain their fixed position and can only be resolved via the existing gap resolution flow.

**Visual Changes During Edit Mode**
- R9. Course cards show the drag handle visibly (full opacity) during edit mode and receive a subtle visual treatment (e.g., elevated shadow, border highlight) to indicate they are sortable.
- R10. Locked/upcoming status indicators and module labels remain visible but the distinction between "completed", "in-progress", and "locked" is visually softened since reordering should not be blocked by progress state.
- R11. AnimatePosition changes (the drag overlay item floats naturally, other items shift to make room) via @dnd-kit/sortable's vertical list strategy — already used in `DashboardCustomizer` and `VideoReorderDialog`.

**Persistence and Undo**
- R12. On "Done", the new order is persisted via `reorderCourse()` which writes each updated `LearningPathEntry` through `syncableWrite` (existing behavior).
- R13. If persistence fails, a toast error is shown and the previous order is restored optimistically (existing `reorderCourse` error handling).
- R14. No undo toast on reorder completion — the "Done" button serves as the commitment point. Individual move undo can be added later if usage data warrants it.

## Success Criteria
- A user can enter an edit mode on the learning track detail page, drag a course to a new position via its grip handle, and tap "Done" to save
- The new order persists across page reloads
- Gap entries remain in place and are not draggable
- Existing progress tracking (completed/in-progress/locked) remains correct after reordering
- The reorder history table (`reorderHistory`) records the move for AI personalization

## Scope Boundaries
- No new npm packages — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are already available
- No data model changes — `LearningPathEntry.position` and `reorderCourse` already support this
- No gap-entry reordering — gap entries stay fixed
- No drag-to-add functionality — this is pure reordering, not course addition
- No keyboard-reorder (up/down buttons) — drag-and-drop only for this pass
- No multi-select or batch reorder — single-course drag at a time
- No undo toast on "Done" — commitment point is explicit
- Edit mode does not affect the hero banner CTA — it remains functional during editing

## Key Decisions
- **Edit mode toggle over always-on drag**: Keeps the timeline clean for reading/navigation and avoids accidental drags. Pattern matches other edit-mode toggles in the app.
- **Always-visible grip handles in edit mode**: The grip handle already exists in the DOM — making it visible is trivial and communicates affordance clearly.
- **Softened progress visuals during editing**: Prevents the "locked" appearance from misleading users into thinking they can't reorder. Progress is not lost by reordering — position and progress are independent.
- **reorderCourse over custom persistence**: Avoids duplicating syncableWrite logic. The store method already handles optimistic updates, error rollback, and reorder history recording.

## Dependencies / Assumptions
- `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/utilities` ^3.2.2 are already installed (confirmed in `package.json`)
- `useLearningPathStore.reorderCourse(pathId, fromIndex, toIndex)` is the existing API for persisting reorders (confirmed in `useLearningPathStore.ts` line 594)
- `PathTimeline` component already has a `GripVertical` element per course entry at `PathTimeline.tsx` line 197 with `opacity-0 group-hover:opacity-100`
- The existing `@dnd-kit` usage patterns in `DashboardCustomizer` and `VideoReorderDialog` provide implementation reference

## Outstanding Questions

### Deferred to Planning
- [Affects R5] Should drag-and-drop be on the entire card or only on the grip handle? (Existing patterns in `DashboardCustomizer` and `VideoReorderDialog` use handle-only — likely consistent)
- [Affects R10] Exact visual treatment for softened progress states during edit mode (needs design exploration — could be lower opacity lock icons, or removing the lock label entirely)
- [Affects R9] Exact elevated shadow style during edit mode (follows existing card shadow tokens in `theme.css`)
- [Technical] Does wrapping `PathTimeline` in a `DndContext` require extracting a sortable variant of `CourseTimelineEntry`, or can `useSortable` be composed into the existing component cleanly? (Needs code exploration)

## Next Steps
-> /ce:plan for structured implementation planning
