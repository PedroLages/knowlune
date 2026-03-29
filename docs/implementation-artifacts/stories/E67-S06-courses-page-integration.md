---
story_id: E67-S06
story_name: "Integrate Bulk Operations with Courses Page"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 67.6: Integrate Bulk Operations with Courses Page

Status: ready-for-dev

## Story

As a user,
I want to select and manage multiple courses at once from the Courses page,
so that I can efficiently clean up, archive, or export my course library.

## Acceptance Criteria

**Given** the user is on the Courses page with imported courses displayed
**When** the page renders
**Then** each ImportedCourseCard is wrapped in a SelectableItem component
**And** the SelectionModeHeader is present above the course grid (hidden when no selection)

**Given** the user selects 3 courses
**When** the FloatingActionToolbar appears
**Then** it shows actions: Archive, Export (JSON), Delete

**Given** the user clicks Delete with 3 courses selected
**When** the BulkConfirmDialog appears and user confirms
**Then** the 3 courses are removed via bulkDeleteCourses()
**And** the course list refreshes from the store
**And** a toast confirms "3 courses deleted"

**Given** the user clicks Archive with 2 courses selected
**When** the archive executes
**Then** the 2 courses receive archivedAt timestamps and are removed from the active list

**Given** the user clicks Export with courses selected
**When** the export triggers
**Then** selected courses are exported as JSON via exportAsJson()

**Given** the user presses Cmd+A while the course list is focused
**When** all visible courses are selected
**Then** the SelectionModeHeader shows "N selected" with "Select All" reflecting total count

**Given** the user presses Escape
**When** selection is active
**Then** all selections clear and the toolbar disappears

## Tasks / Subtasks

- [ ] Task 1: Wire useBulkSelection hook into Courses page (AC: 1, 6, 7)
  - [ ] 1.1 Import `useBulkSelection` into `src/app/pages/Courses.tsx`
  - [ ] 1.2 Initialize hook with containerRef pointing to course grid container
  - [ ] 1.3 Set up `getVisibleIds` callback returning current imported course IDs
  - [ ] 1.4 Wire `onDeleteRequest` to open BulkConfirmDialog for delete

- [ ] Task 2: Wrap ImportedCourseCard in SelectableItem (AC: 1)
  - [ ] 2.1 Import `SelectableItem` from `@/app/components/bulk/SelectableItem`
  - [ ] 2.2 Wrap each `<ImportedCourseCard>` in `<SelectableItem>` inside the map loop
  - [ ] 2.3 Pass: `id={course.id}`, `isSelected={isSelected(course.id)}`, `isSelectionMode`, `onToggle={toggle}`, `itemLabel={course.name}`
  - [ ] 2.4 Verify no layout shift — ImportedCourseCard renders identically when wrapped

- [ ] Task 3: Add SelectionModeHeader above grid (AC: 1, 6)
  - [ ] 3.1 Import `SelectionModeHeader` from `@/app/components/bulk/SelectionModeHeader`
  - [ ] 3.2 Render above course grid, passing `selectedCount`, `totalCount={importedCourses.length}`, `onSelectAll`, `onClear`
  - [ ] 3.3 Only visible when `isSelectionMode` is true

- [ ] Task 4: Add FloatingActionToolbar with course actions (AC: 2)
  - [ ] 4.1 Import `FloatingActionToolbar` from `@/app/components/bulk/FloatingActionToolbar`
  - [ ] 4.2 Define course-specific actions array:
    - Archive: `{ label: 'Archive', icon: Archive, variant: 'brand-outline', onClick: handleArchive }`
    - Export JSON: `{ label: 'Export', icon: Download, variant: 'brand-outline', onClick: handleExport }`
    - Delete: `{ label: 'Delete', icon: Trash2, variant: 'destructive', onClick: handleDelete }`
  - [ ] 4.3 Pass `selectedCount` and `onClear={clearSelection}`

- [ ] Task 5: Implement action handlers (AC: 3, 4, 5)
  - [ ] 5.1 `handleDelete`: Open BulkConfirmDialog with action='delete', entityType='courses', count
  - [ ] 5.2 `onConfirmDelete`: Call `bulkDeleteCourses(Array.from(selectedIds))`, show toast, clear selection, refresh store
  - [ ] 5.3 `handleArchive`: If count <= 5, call `bulkArchiveCourses()` directly. If > 5, open BulkConfirmDialog.
  - [ ] 5.4 `handleExport`: Get full course objects for selected IDs, call `exportAsJson(courses, 'courses')`, show toast, clear selection
  - [ ] 5.5 After each action: call `clearSelection()` and refresh the course list from store

- [ ] Task 6: Implement optimistic UI for delete/archive (AC: 3, 4)
  - [ ] 6.1 Before calling service: filter selected IDs from rendered list
  - [ ] 6.2 On service success: confirm removal, toast success
  - [ ] 6.3 On service failure: restore items, toast error
  - [ ] 6.4 Use store's `loadImportedCourses()` to refresh after success

- [ ] Task 7: Add BulkConfirmDialog for destructive actions (AC: 3)
  - [ ] 7.1 Import `BulkConfirmDialog` from `@/app/components/bulk/BulkConfirmDialog`
  - [ ] 7.2 Manage dialog open/close state
  - [ ] 7.3 Pass appropriate consequences text for course delete: "This will permanently remove {count} courses and their associated progress, notes, and bookmarks"

- [ ] Task 8: Write E2E test (all ACs)
  - [ ] 8.1 Create `tests/e2e/bulk-operations-courses.spec.ts`
  - [ ] 8.2 Seed IndexedDB with test courses via factory
  - [ ] 8.3 Test: select course via checkbox, verify toolbar appears
  - [ ] 8.4 Test: Cmd+A selects all visible courses
  - [ ] 8.5 Test: delete with confirmation removes courses
  - [ ] 8.6 Test: Escape clears selection

## Dev Notes

### Architecture

- This is the first integration story — it establishes the wiring pattern that S07 and S08 follow.
- **Do NOT modify ImportedCourseCard** — all selection behavior is added via the SelectableItem wrapper and page-level hook.
- The Courses page already uses `useCourseImportStore` for course data. After bulk operations, call `loadImportedCourses()` to refresh from IndexedDB.

### Courses Page Current Structure

The Courses page (`src/app/pages/Courses.tsx`) renders imported courses in a grid. The integration points are:
1. Course grid container — wrap each card in SelectableItem
2. Above grid — insert SelectionModeHeader
3. Page level — add FloatingActionToolbar and BulkConfirmDialog

### Store Refresh Pattern

After bulk delete/archive, refresh the store to reflect changes:
```typescript
const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
// After bulk operation:
await loadImportedCourses()  // Re-fetches from Dexie
```

Use individual selector (project rule): `useCourseImportStore(state => state.importedCourses)` — never destructure full store.

### Active vs Archived Filter

After S04 adds `archivedAt`, the Courses page should only show courses where `archivedAt` is undefined/null. Add a filter:
```typescript
const activeCourses = importedCourses.filter(c => !c.archivedAt)
```

### Dependencies

- **E67-S01** (useBulkSelection hook)
- **E67-S02** (SelectableItem wrapper)
- **E67-S03** (FloatingActionToolbar, SelectionModeHeader)
- **E67-S04** (bulkOperationsService, BulkConfirmDialog)
- **E67-S05** (exportService for JSON export)

### Files to Modify

| File | Change |
|------|--------|
| `src/app/pages/Courses.tsx` | Add bulk selection integration |

### Files to Create

| File | Purpose |
|------|---------|
| `tests/e2e/bulk-operations-courses.spec.ts` | E2E tests |

### Files to Reference (read-only)

| File | Why |
|------|-----|
| `src/app/components/figma/ImportedCourseCard.tsx` | Card component being wrapped |
| `src/stores/useCourseImportStore.ts` | Store selectors and loadImportedCourses |

### References

- [Source: _bmad-output/planning-artifacts/epics-bulk-operations.md#Story 67.6]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Component Hierarchy]
- [Source: docs/project-context.md#Zustand Store Selectors]

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] ImportedCourseCard not modified internally — only wrapped
- [ ] Zustand selectors use individual selector pattern (no destructuring)
- [ ] Active courses filter excludes archived items
- [ ] Store refreshed after bulk operations
- [ ] Toast uses toastSuccess/toastError helpers
- [ ] No hardcoded colors
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

## Code Review Feedback

## Challenges and Lessons Learned
