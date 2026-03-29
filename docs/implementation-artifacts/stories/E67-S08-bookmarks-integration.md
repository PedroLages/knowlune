---
story_id: E67-S08
story_name: "Integrate Bulk Operations with Bookmarks List"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 67.8: Integrate Bulk Operations with Bookmarks List

Status: ready-for-dev

## Story

As a user,
I want to select and manage multiple bookmarks at once,
so that I can clean up old bookmarks or export them for reference.

## Acceptance Criteria

**Given** the user is viewing bookmarks in BookmarksList
**When** the list renders with bookmarks
**Then** each bookmark row is wrapped in a SelectableItem component

**Given** the user selects 4 bookmarks
**When** the FloatingActionToolbar appears
**Then** it shows actions: Export (JSON), Delete (no Archive for bookmarks)

**Given** the user clicks Delete with bookmarks selected and confirms
**When** the operation completes
**Then** bookmarks are removed via bulkDeleteBookmarks() and a toast confirms the count

**Given** the user clicks Export with bookmarks selected
**When** the export executes
**Then** a JSON file is downloaded containing the selected bookmarks' data

**Given** a bookmark is in selection mode
**When** the user clicks the bookmark row
**Then** the selection toggles (seek action is suppressed during selection mode)

## Tasks / Subtasks

- [ ] Task 1: Wire useBulkSelection hook into BookmarksList (AC: 1, 5)
  - [ ] 1.1 Import `useBulkSelection` into `src/app/components/BookmarksList.tsx`
  - [ ] 1.2 Initialize hook with containerRef pointing to bookmarks list container
  - [ ] 1.3 Set up `getVisibleIds` callback returning current bookmark IDs from props
  - [ ] 1.4 Wire `onDeleteRequest` to open BulkConfirmDialog for delete

- [ ] Task 2: Wrap bookmark rows in SelectableItem (AC: 1, 5)
  - [ ] 2.1 Import `SelectableItem` from `@/app/components/bulk/SelectableItem`
  - [ ] 2.2 Wrap each bookmark row in `<SelectableItem>`
  - [ ] 2.3 Pass: `id={bookmark.id}`, `isSelected={isSelected(bookmark.id)}`, `isSelectionMode`, `onToggle={toggle}`, `itemLabel={bookmark.label || bookmark.note}`
  - [ ] 2.4 Suppress `onSeek` behavior when `isSelectionMode` is true — SelectableItem's click interception handles this

- [ ] Task 3: Add SelectionModeHeader and FloatingActionToolbar (AC: 1, 2)
  - [ ] 3.1 Render `SelectionModeHeader` above bookmarks list
  - [ ] 3.2 Render `FloatingActionToolbar` with bookmark-specific actions (simpler than courses/notes):
    - Export JSON: `{ label: 'Export', icon: Download, variant: 'brand-outline', onClick: handleExport }`
    - Delete: `{ label: 'Delete', icon: Trash2, variant: 'destructive', onClick: handleDelete }`
  - [ ] 3.3 No Archive action for bookmarks (per spec)

- [ ] Task 4: Implement action handlers (AC: 3, 4)
  - [ ] 4.1 `handleDelete`: Open BulkConfirmDialog, on confirm call `bulkDeleteBookmarks(ids)`, toast, clear selection
  - [ ] 4.2 `handleExport`: Get full bookmark objects for selected IDs, call `exportAsJson(bookmarks, 'bookmarks')`, toast, clear selection
  - [ ] 4.3 After each action: notify parent to refresh bookmarks (BookmarksList receives items from parent)

- [ ] Task 5: Handle parent communication for data refresh (AC: 3)
  - [ ] 5.1 BookmarksList receives bookmarks from parent via props
  - [ ] 5.2 After bulk delete: call a parent callback (e.g., `onBookmarksChanged`) to trigger re-fetch
  - [ ] 5.3 Or use optimistic filtering: remove deleted IDs from the passed-in array locally
  - [ ] 5.4 Parent component (LessonPlayer.tsx) should refresh bookmarks after notification

- [ ] Task 6: Write E2E test (all ACs)
  - [ ] 6.1 Create `tests/e2e/bulk-operations-bookmarks.spec.ts`
  - [ ] 6.2 Seed IndexedDB with test bookmarks via factory
  - [ ] 6.3 Test: select bookmarks, verify toolbar shows only Export and Delete (no Archive)
  - [ ] 6.4 Test: delete with confirmation removes bookmarks
  - [ ] 6.5 Test: export triggers JSON download
  - [ ] 6.6 Test: clicking bookmark in selection mode toggles (doesn't seek)

## Dev Notes

### Architecture

- **Simplest integration** of the three (S06-S08). Bookmarks only have 2 actions: Export (JSON) and Delete. No Archive, no Markdown export.
- **BookmarksList is a child component** — it receives bookmarks as props from `LessonPlayer.tsx`. After bulk operations, the parent needs to know to refresh.
- Same wrapper pattern as S06 and S07.

### BookmarksList Component

Located at `src/app/components/BookmarksList.tsx`. This component:
- Receives bookmark items as props from parent (LessonPlayer)
- Each row has an `onSeek` handler for video navigation
- onSeek must be suppressed during selection mode (SelectableItem handles this)

### Bookmark Data Shape

Bookmarks use `VideoBookmark` type from `src/data/types.ts`:
```typescript
interface VideoBookmark {
  id: string
  courseId: string
  videoId: string
  timestamp: number
  note?: string
  label?: string
  createdAt: string
}
```

### Parent Refresh Pattern

BookmarksList doesn't own its data. Options for refresh after bulk delete:
1. **Callback prop**: Add `onBulkAction?: () => void` prop, parent calls refresh
2. **Optimistic local filter**: Maintain local `excludedIds` state, filter props before render
3. **Zustand event**: If bookmarks are in a store, refresh via store method

Option 2 (optimistic local filter) is simplest and consistent with the pattern used in S06/S07.

### Dependencies

- **E67-S01** through **E67-S05** (all foundation stories)

### Files to Modify

| File | Change |
|------|--------|
| `src/app/components/BookmarksList.tsx` | Add bulk selection integration |

### Files to Create

| File | Purpose |
|------|---------|
| `tests/e2e/bulk-operations-bookmarks.spec.ts` | E2E tests |

### Files to Reference (read-only)

| File | Why |
|------|-----|
| `src/app/pages/LessonPlayer.tsx` | Parent component that renders BookmarksList |
| `src/data/types.ts` | VideoBookmark type definition |

### References

- [Source: _bmad-output/planning-artifacts/epics-bulk-operations.md#Story 67.8]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Action Handlers table]

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] BookmarksList internal rendering not modified — only wrapped
- [ ] onSeek suppressed during selection mode
- [ ] Only 2 actions: Export JSON and Delete (no Archive)
- [ ] Parent notified to refresh after bulk operations
- [ ] Toast uses toastSuccess/toastError helpers
- [ ] No hardcoded colors
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

## Code Review Feedback

## Challenges and Lessons Learned
