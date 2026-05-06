---
date: 2026-05-06
topic: bulk-course-delete
---

# Bulk Course Delete

## Problem Frame

Users managing many courses can only delete them one at a time via the per-card dropdown menu. Deleting 10+ stale courses requires 10 separate interactions, each cascading to videos, PDFs, thumbnails, and sync queue entries. A bulk selection + delete flow eliminates this friction.

## Requirements

**Selection Mode**

- R1. A toggle button in the control bar (alongside Filter/Sort/View) enters and exits selection mode. While active, the button is visually distinct (e.g., filled or highlighted).
- R2. In selection mode, a checkbox appears on every course card across all three view modes (grid, compact, list). Tapping a card toggles its selection. Tapping the checkbox also toggles it.
- R3. Pressing Escape exits selection mode and clears the current selection.

**Action Bar**

- R4. When selection mode is active, an action bar replaces the control bar area. It shows: the count of selected items, a "Select All" button, a "Deselect All" button, a "Delete Selected (N)" button, and an "Exit selection" action (same as the toggle button that entered it).
- R5. "Select All" selects all courses matching the current status filter (not just the courses visible on screen). When no filter is active, all courses on the page are selected.
- R6. "Delete Selected" is visually destructive-styled and disabled (or hidden) when zero items are selected.

**Delete Execution**

- R7. On clicking "Delete Selected", all selected courses are deleted. The store's existing per-course delete logic (`removeImportedCourse` — cascade to videos, PDFs, thumbnails, sync queue, author cleanup) is reused for each course. Deletions run sequentially to avoid IndexedDB transaction contention and Zustand state races.
- R8. If any individual course deletion fails, the remaining courses in the batch continue to be deleted (best-effort). Failed deletions are surfaced via an error toast listing which courses could not be deleted.
- R9. After deletion completes (success or partial), selection mode exits and the course list reflects the removed courses.

**Undo**

- R10. On any successful deletions, an undo toast appears: "N courses deleted. Undo?" with a visible countdown (~5 seconds). Tapping "Undo" restores all successfully deleted courses to their prior state. If some courses failed to delete (R8), a separate error toast lists those — the undo toast covers only the successful subset.
- R11. The undo toast auto-dismisses after the countdown. Once dismissed, successfully deleted courses are permanently removed (sync delete entries have already been queued). Failed courses (R8) are not affected.

## Success Criteria

- User can select N courses and delete them in a single interaction instead of N separate ones
- Deletion is recoverable within a 5-second window via undo
- Selection mode does not interfere with normal browsing when not active

## Scope Boundaries

- Courses page only (not applicable to Authors, Learning Paths, or other pages)
- Imported courses only (the only course type currently on this page)
- Single-page selection (selection does not persist across page navigation)
- Undo restores course data locally but does not roll back sync queue entries already written (undo re-queues syncableWrite 'create' for each restored course)

## Key Decisions

- **Toggle button (not always-visible checkboxes)**: Keeps the UI clean during normal browsing. Checkboxes add visual noise when not needed.
- **Undo toast (not confirmation dialog)**: Snappier flow for confident users. Gmail pattern — the undo window is the safety net.
- **Best-effort batch delete**: Partial failures don't block the rest of the batch. Failed courses are reported so the user can retry individually.

## Dependencies / Assumptions

- Assumes `useCourseImportStore.removeImportedCourse()` works reliably for individual deletes (already proven in single-course delete flow)
- Selection state is managed in the Courses page component and threaded into card components via props — no architectural changes to `VirtualizedCoursesList` are needed (selection IDs are captured in the `renderItem` closure)

## Outstanding Questions

### Resolve Before Planning

_None_

### Deferred to Planning

- [Affects R8][Technical] Batch error handling: `removeImportedCourse` throws on failure and performs internal Zustand rollback. The batch caller must wrap each call in try/catch to continue on failure. Failed course IDs must be collected for the error toast.
- [Affects R10][Technical] Undo implementation: hold deleted course snapshots in memory (closure-captured before deletion). This does not survive page refresh — acceptable per scope boundary that undo is best-effort. Each snapshot must include the full entity tree (course, videos, PDFs, thumbnail blob reference, author link) to support full restoration.
- [Affects R2][Technical] Checkbox placement on each card variant — grid (`ImportedCourseCard`), compact (`ImportedCourseCompactCard`), list (`ImportedCourseListRow`). Each component's props interface must be extended with `selected: boolean` and `onToggleSelect: (courseId: string) => void`.
- [Affects R7][Technical] Selection state survives filter changes: when a user selects courses under one filter, then removes/changes the filter, previously selected courses remain selected even if they are no longer visible. The action bar count reflects the total selection, not just visible selections.

## Next Steps

-> `/ce:plan` for structured implementation planning
