---
title: "feat: Bulk course delete with undo"
type: feat
status: active
date: 2026-05-06
origin: docs/brainstorms/2026-05-06-bulk-course-delete-requirements.md
---

# feat: Bulk course delete with undo

## Overview

Add a selection mode to the Courses page that lets users select multiple courses via checkboxes and delete them all at once. A "Select" button in the control bar toggles selection mode, showing checkboxes on every course card across all three view modes (grid, compact, list). An action bar replaces the control bar while active, offering Select All, Deselect All, and Delete Selected. Deletions run sequentially (best-effort) and show an undo toast for 8 seconds after completion.

## Problem Frame

Users managing many courses can only delete them one at a time via the per-card dropdown menu. Deleting 10+ stale courses requires 10 separate interactions, each cascading to videos, PDFs, thumbnails, and sync queue entries. A bulk selection + delete flow eliminates this friction. (see origin: docs/brainstorms/2026-05-06-bulk-course-delete-requirements.md)

## Requirements Trace

**Selection Mode**
- R1. A "Select" button in the control bar enters selection mode. A "Cancel" button in the action bar exits selection mode
- R2. Checkbox appears on every course card across all three view modes
- R3. Pressing Escape exits selection mode and clears the current selection

**Action Bar**
- R4. Action bar replaces the control bar showing: selected count, Select All, Deselect All, Delete Selected (N), and a "Cancel" button to exit selection
- R5. "Select All" selects all courses matching the current status filter
- R6. "Delete Selected" is visually destructive-styled and disabled when zero items are selected

**Delete Execution**
- R7. On clicking "Delete Selected", all selected courses are deleted sequentially using `removeImportedCourse`
- R8. Best-effort batch: if any course deletion fails, remaining courses continue. Error toast lists failed courses
- R9. After deletion completes, selection mode exits and the course list reflects removed courses

**Undo**
- R10. On any successful deletions, an undo toast appears for 8 seconds. Tapping "Undo" restores successfully deleted courses
- R11. The undo toast auto-dismisses after the countdown. Once dismissed, successfully deleted courses are permanently removed

## Scope Boundaries

- Courses page only
- Imported courses only
- Single-page selection (does not persist across navigation)
- Undo is best-effort (does not survive page refresh)
- Undo re-queues `syncableWrite('importedCourses', 'add', ...)` for each restored course; deleted sync entries may already be in flight
- Undo restores course records only — child records (importedVideos, importedPdfs) and thumbnail files are not restored. Restored courses retain metadata (videoCount, pdfCount) but must be re-imported to recover actual content

## Context & Research

### Relevant Code and Patterns

- **Undo pattern**: `useAuthorStore.deleteAuthor` (`src/stores/useAuthorStore.ts:205-252`) — closure-captures deleted record, optimistic remove, syncableWrite delete, `toastWithUndo` with re-add callback
- **Selection state**: `CleanupActionsSection` (`src/app/components/settings/CleanupActionsSection.tsx`) — uses `Set<string>` for O(1) toggle, paired with `Checkbox` from shadcn/ui
- **Batch semantics**: `syncableWrite` has no transaction API (`docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md`) — each call commits independently. Use sequential iteration with collected `{ created, failed }` sets
- **Toast helper**: `toastWithUndo` from `src/lib/toastHelpers.ts` — uses Sonner's action button with configurable duration
- **Card components**: `ImportedCourseCard` (`src/app/components/figma/ImportedCourseCard.tsx`), `ImportedCourseCompactCard` (`src/app/components/figma/ImportedCourseCompactCard.tsx`), `ImportedCourseListRow` (`src/app/components/figma/ImportedCourseListRow.tsx`) — all use `removeImportedCourse` internally for single-course delete
- **Checkbox**: shadcn/ui `Checkbox` (`src/app/components/ui/checkbox.tsx`) wrapping Radix Checkbox.Root
- **Control bar**: `ControlBarSection` (`src/app/components/courses/ControlBarSection.tsx`) for grouped toolbar sections

### Institutional Learnings

- `syncableWrite` has no transaction semantics — compensate, don't try to roll back (`docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md`)
- Virtualized list focus rescue: when a focused row is recycled, redirect focus to the container with `tabIndex={-1}` (`docs/solutions/best-practices/2026-04-25-virtualized-list-aria-focus-and-reduced-motion-patterns.md`)
- Zustand async callbacks must guard against stale results with generation counters (`docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md`)

## Key Technical Decisions

- **Sequential deletes (not parallel)**: `removeImportedCourse` uses optimistic Zustand `set()` on success and rollback `set()` on failure. Parallel execution via `Promise.allSettled` would create races on shared state — one call's rollback can re-insert courses another call just removed. Sequential avoids this entirely. IndexedDB write contention under `persistWithRetry` provides limited throughput benefit from parallelism anyway.
- **Selection state as `Set<string>` in Courses page**: Follows the `CleanupActionsSection` pattern. O(1) add/remove/check. Threaded into card components via `renderItem` closure — no changes to `VirtualizedCoursesList` needed because `renderItem` already captures outer scope.
- **Undo via closure-captured snapshot**: Follows `useAuthorStore.deleteAuthor` pattern. Before deletion, capture the full courses array (each course includes its videos/PDFs as fields). On undo, iterate captured records calling `syncableWrite('importedCourses', 'add', course)` for each. In-memory only — does not survive page refresh. Acceptable per scope boundaries.
- **Undo duration: 8 seconds**: Uses `TOAST_DURATION.LONG` (8000ms). The 5-second window in the origin document is too tight for accidental-delete recovery (user must notice, read, and act). Gmail's undo send uses 30 seconds; 8 seconds is the codebase's established "long" duration. Note: This deviates from the origin requirement's 5-second window; 8 seconds is the established long duration in the codebase.
- **Selection survives filter changes**: When a user selects courses under one filter then clears/changes the filter, selected courses remain selected. The action bar count reflects the total selection, not just visible selections. This prevents invisible-selection accidents — the user always knows how many are selected.

## Implementation Units

- [ ] **Unit 1: Extend course card components with selection props**

**Goal:** Add `selected` and `onToggleSelect` props to all three card variants, render a checkbox overlay when selection mode is active.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`
- Modify: `src/app/components/figma/ImportedCourseCompactCard.tsx`
- Modify: `src/app/components/figma/ImportedCourseListRow.tsx`
- Test: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx`
- Test: `src/app/components/figma/__tests__/ImportedCourseCompactCard.test.tsx`
- Test: `src/app/components/figma/__tests__/ImportedCourseListRow.test.tsx`

**Approach:**
- Add optional props to each card's interface:
  ```typescript
  selected?: boolean
  onToggleSelect?: (courseId: string) => void
  ```
- When `onToggleSelect` is defined (selection mode active), render a Checkbox overlaid on the top-left corner of the card. When undefined (normal browsing), render the existing card unchanged.
- Checkbox uses `stopPropagation` on its click handler so the card's own click handler doesn't fire on checkbox clicks (avoiding double-toggle).
- Checkbox has a semi-transparent backdrop (`bg-background/80 rounded-full p-0.5`) to ensure contrast regardless of card cover image.
- Follow the shadcn/ui `Checkbox` pattern from `CleanupActionsParts.tsx`: `checked={selected} onCheckedChange={checked => onToggleSelect(course.id)}`.

**Patterns to follow:**
- `CleanupActionsParts.tsx` — Checkbox + selection toggle pattern
- `ImportedCourseCard.tsx:113-120` — existing props interface

**Test scenarios:**
- Happy path: When `onToggleSelect` is provided, a checkbox renders on the card. Clicking the checkbox calls `onToggleSelect` with the course ID.
- Happy path: When `onToggleSelect` is undefined (default), no checkbox renders and the card looks identical to current behavior.
- Edge case: Checkbox click does not trigger the card's navigation click handler (event propagation stopped).
- Edge case: `selected={true}` shows the checkbox as checked; `selected={false}` shows it unchecked.

**Verification:**
- All three card variants render a checkbox in the top-left corner when `onToggleSelect` is provided
- Existing card behavior (navigation, dropdown menus, status changes) is unchanged when selection mode is off
- Existing tests pass without modification

---

- [ ] **Unit 2: Courses page — selection state and action bar**

**Goal:** Add selection mode toggle, selection state management (`Set<string>`), and the action bar to the Courses page.

**Requirements:** R1, R3, R4, R5, R6, R9

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/pages/Courses.tsx`
- Test: `src/app/pages/__tests__/Courses.test.tsx`

**Approach:**
- Add local state:
  ```typescript
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  ```
- Add a "Select" button as a new `ControlBarSection` (between Sort and View sections) when courses exist. Clicking it sets `selectionMode = true`.
- When `selectionMode` is true, replace the entire control bar with an action bar containing:
  - Item count: `"{N} selected"`
  - "Select All" button — adds all `sortedImportedCourses` IDs to the Set
  - "Deselect All" button — clears the Set
  - "Delete Selected (N)" button — destructive-styled, disabled when Set is empty
  - "Cancel" button — exits selection mode, clears selection
- Thread `selected` and `onToggleSelect` into card components via `renderItem` closure. In selection mode, card-body clicks toggle selection (do not navigate to course detail). All three card variants must suppress their navigation `onClick` when `onToggleSelect` is provided. The checkbox itself uses `stopPropagation` so its toggle doesn't fire the card-body toggle twice.
  ```typescript
  renderItem={course => {
    const CardComponent = /* pick based on viewMode */
    return <CardComponent
      course={course}
      selected={selectedIds.has(course.id)}
      onToggleSelect={selectionMode ? handleToggleSelect : undefined}
      /* ... existing props */
    />
  }}
  ```
- Add a `useEffect` for Escape key listener that exits selection mode and clears selection.
- After delete completes (Unit 3 callback), exit selection mode and clear selection.

**Patterns to follow:**
- `CleanupActionsSection.tsx` — `Set<string>` selection state management
- `Courses.tsx:243-285` — existing control bar structure

**Test scenarios:**
- Happy path: Clicking "Select" enters selection mode, checkboxes appear on cards. Clicking "Cancel" exits.
- Happy path: Clicking a card in selection mode toggles its checkbox. Selected count updates.
- Happy path: "Select All" adds all filtered course IDs to the Set. "Deselect All" clears it.
- Happy path: "Delete Selected" is disabled when no courses selected, enabled when >=1 selected.
- Edge case: Pressing Escape exits selection mode and clears selection.
- Edge case: Changing filter while selection mode is active — previously selected courses remain selected even if hidden by the new filter. Action bar count reflects total selection.
- Edge case: No courses (empty state) — Select button is hidden.
- Edge case: In selection mode, clicking a card body toggles the checkbox rather than navigating to course detail.

**Verification:**
- Selection mode toggle works correctly
- Action bar shows correct selected count
- Select All respects active status filter (only selects filtered courses)
- Escape exits selection mode
- Card checkboxes appear/disappear with selection mode

---

- [ ] **Unit 3: Store — batch delete with undo**

**Goal:** Add a `removeImportedCourses` action to the store that deletes multiple courses sequentially with undo support.

**Requirements:** R7, R8, R10, R11

**Dependencies:** Unit 1

**Files:**
- Modify: `src/stores/useCourseImportStore.ts`
- Test: `src/stores/__tests__/useCourseImportStore.test.ts`

**Approach:**
- Add a new store action:
  ```typescript
  removeImportedCourses: async (courseIds: string[]) => { ... }
  ```
- **Capture snapshot**: Before any deletion, look up the full `ImportedCourse` records for all IDs from the current store state. Store in a closure-captured array (for undo only — not for rollback, since `removeImportedCourse` handles its own rollback).
- **Sequential deletion (no batch optimistic removal)**: Iterate over IDs, calling `removeImportedCourse(id)` for each. Each call handles its own optimistic removal from Zustand and its own rollback on failure. This avoids the race condition where batch `set()` makes `courseToRemove` undefined inside the inner function, which would break rollback and author cleanup. Since `removeImportedCourse` swallows errors internally, detect failure by checking Zustand state after each call: if the course still exists in `useCourseImportStore.getState().importedCourses`, the deletion failed. Collect `{ deleted: IdAndName[], failed: IdAndName[] }`. Courses disappear from the list one at a time as they are processed, providing natural progress feedback.
- **Undo toast**: After all deletes complete, if any succeeded, call `toastWithUndo`:
  ```typescript
  toastWithUndo({
    message: `${deleted.length} ${deleted.length === 1 ? 'course' : 'courses'} deleted`,
    onUndo: async () => {
      for (const course of capturedCourses) {
        await syncableWrite('importedCourses', 'add', course as SyncableRecord)
      }
      set(state => ({
        importedCourses: [...capturedCourses, ...state.importedCourses]
      }))
      toast.success(`${capturedCourses.length} ${capturedCourses.length === 1 ? 'course' : 'courses'} restored`)
    },
    duration: TOAST_DURATION.LONG, // 8000ms
  })
  ```
  Note: Undo restores the course record and re-queues sync entries, but child records (videos, PDFs) are not restored — their sync delete entries are already committed. Restored courses will have `videoCount` metadata but 0 actual video records. The course must be re-imported to recover content. This fidelity ceiling is documented in the scope boundaries.
- **Error toast**: If any courses failed, show a separate error toast: `"Failed to delete N courses: {names}"`.
- **No rollback needed**: Since each `removeImportedCourse` handles its own rollback internally, the batch action only needs to collect results. If all courses fail, each one's individual rollback has already re-inserted it into Zustand state — no additional batch rollback is needed.
- **Delete button guard**: Disable or debounce the "Delete Selected" button during an active batch deletion to prevent double-clicks from starting overlapping batches.

**Patterns to follow:**
- `useAuthorStore.deleteAuthor` (`src/stores/useAuthorStore.ts:205-252`) — closure-capture + optimistic remove + toastWithUndo + rollback on failure
- `toastWithUndo` from `src/lib/toastHelpers.ts`

**Test scenarios:**
- Happy path: Deleting 3 courses removes them from the list, shows undo toast. Tapping Undo restores all 3.
- Happy path: Deleting 1 course shows singular message "1 course deleted".
- Error path: If 2 of 5 courses fail to delete, 3 are removed, error toast lists the 2 failed courses by name.
- Error path: If all courses fail, optimistic removal is rolled back, error toast shown, no undo toast.
- Edge case: Undo re-queues `syncableWrite('add', ...)` for each restored course.
- Edge case: Deleting 0 courses is a no-op (should be prevented by R6 disabled button).

**Verification:**
- Batch delete removes selected courses from the list
- Undo toast appears and clicking Undo restores courses
- Partial failures are reported correctly
- Total failure rolls back the optimistic removal

---

- [ ] **Unit 4: E2E smoke test**

**Goal:** End-to-end test covering the bulk delete flow across view modes.

**Requirements:** R1-R11

**Dependencies:** Units 1-3

**Files:**
- Create: `tests/e2e/courses-bulk-delete.spec.ts`

**Approach:**
- Seed 5 courses via test factory
- Test the full flow: enter selection mode → select 3 courses → verify count → Select All → Deselect All → Delete 2 → verify undo toast → verify courses removed → verify undo restores them
- Test in grid view mode (the default). Compact and list modes share the same selection logic through `renderItem` so one view mode is sufficient for E2E.
- Test Escape key exits selection mode

**Test scenarios:**
- Happy path: Select 3 courses, delete them, verify they're gone from the list. Tap Undo, verify they return.
- Happy path: "Select All" selects all visible courses. Verify count matches total.
- Edge case: Escape exits selection mode. Verify checkboxes disappear.
- Edge case: "Delete Selected" is disabled when nothing is selected.
- Edge case: Toast auto-dismisses and courses remain deleted.

**Verification:**
- E2E test passes reliably
- Full user flow works end-to-end

## System-Wide Impact

- **Interaction graph**: Selection mode is local to the Courses page. No cross-page or cross-component state. The `study-log-updated` event listener on Courses already handles list refresh after mutations.
- **Error propagation**: Batch delete surfaces errors via toast (not thrown). Individual `removeImportedCourse` failures are caught and collected. Sync queue errors are already handled silently within `syncableWrite`.
- **State lifecycle risks**: Optimistic removal followed by batch async deletes — if the user navigates away mid-deletion, the optimistic removal persists (courses are gone from state) but some Dexie deletes may not have completed. The `removeImportedCourse` catch block already performs Zustand rollback for individual failures. For navigation-during-batch, the generation counter pattern from learnings mitigates stale callbacks.
- **Unchanged invariants**: `removeImportedCourse` (single-course) is unchanged. All three card components remain backward-compatible — `selected` and `onToggleSelect` are optional props that default to undefined. Existing tests pass without modification.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Undo re-queues sync `add` entries that race with in-flight `delete` entries | Acceptable — the scope boundary documents this. LWW semantics on Supabase mean the last write wins. If delete arrives after add, the course is deleted server-side but restored locally — user can re-import. |
| Optimistic removal then navigate away mid-batch | Generation counter pattern prevents stale callbacks. `removeImportedCourse` already handles individual rollback. Courses still in the batch that haven't been processed yet remain in Dexie but removed from Zustand — they reappear on next `loadImportedCourses()`. |
| Thumbnail object URLs lost on undo | Acceptable — these are ephemeral (page-session lifetime). Restored courses will regenerate thumbnails on next `loadImportedCourses()` or page reload. |
| Large selections (100+ courses) cause noticeable sequential delete delay | Each `removeImportedCourse` involves multiple Dexie writes + sync queue entries. For 100+ courses this could take 5-10 seconds. The action bar should remain visible during deletion (no spinner in v1 — the UI naturally updates as cards disappear optimistically). If this becomes a UX issue, a progress indicator can be added in a follow-up. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-06-bulk-course-delete-requirements.md](../brainstorms/2026-05-06-bulk-course-delete-requirements.md)
- Related code: `src/stores/useAuthorStore.ts:205-252` (undo pattern)
- Related code: `src/app/components/settings/CleanupActionsSection.tsx` (selection pattern)
- Related code: `src/lib/toastHelpers.ts` (toastWithUndo helper)
- Related code: `src/stores/useCourseImportStore.ts:108-165` (removeImportedCourse)
- Learnings: `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`
- Learnings: `docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md`
- Learnings: `docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md`
