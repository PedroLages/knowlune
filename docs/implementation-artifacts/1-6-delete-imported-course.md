---
story_id: E01-S06
story_name: "Delete Imported Course"
status: done
started: 2026-03-18
completed: 2026-03-18
reviewed: true
review_started: 2026-03-18
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 1.6: Delete Imported Course

## Story

As a learner,
I want to permanently remove an imported course from my library,
so that I can keep my course list clean and remove content I no longer need.

## Acceptance Criteria

**AC1 — Delete option in course card dropdown**
Given the course library is displayed
When the user opens the status dropdown on a course card
Then a "Delete course" option is visible below a separator
And it is styled with destructive/red coloring
And clicking it opens a confirmation dialog

**AC2 — Confirmation dialog**
Given the user clicked "Delete course"
When the confirmation dialog appears
Then it shows the course name
And offers "Cancel" and "Delete" buttons
And the "Delete" button is styled as destructive (red)

**AC3 — Deletion executes correctly**
Given the user confirms deletion
When the dialog is dismissed
Then the course disappears from the library immediately (optimistic update)
And all videos and PDFs for that course are removed from IndexedDB
And a success toast appears: "Course removed"
And the user remains on the Courses page (no navigation)

**AC4 — Cancellation**
Given the confirmation dialog is open
When the user clicks Cancel or presses Escape
Then the dialog closes and the course remains in the library unchanged

**AC5 — Error handling**
Given the Dexie transaction fails
When the optimistic update is rolled back
Then the course reappears in the library
And an error toast is shown: "Failed to remove course"

## Tasks / Subtasks

- [ ] Task 1: Add delete action to `ImportedCourseCard` dropdown (AC1, AC2, AC3, AC4)
  - [ ] 1.1 Subscribe to `removeImportedCourse` from `useCourseImportStore`
  - [ ] 1.2 Import `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` from `@/app/components/ui/alert-dialog` (no `AlertDialogTrigger` — dialog is controlled externally via `open` prop)
  - [ ] 1.3 Import `Trash2` from `lucide-react` and `DropdownMenuSeparator` from `@/app/components/ui/dropdown-menu`
  - [ ] 1.4 Add `deleteDialogOpen` state (`useState(false)`)
  - [ ] 1.5 Add `DropdownMenuSeparator` and "Delete course" `DropdownMenuItem` inside existing `DropdownMenuContent` (after status items), with `className="text-destructive focus:text-destructive gap-2"` and `data-testid="delete-course-menu-item"`
  - [ ] 1.6 Wrap an `AlertDialog` around the card (or render it alongside) controlled by `deleteDialogOpen`
  - [ ] 1.7 On confirm: call `await removeImportedCourse(course.id)`, show `toast.success('Course removed')`
  - [ ] 1.8 On error (importError in store): show `toast.error('Failed to remove course')`
  - [ ] 1.9 Add `data-testid="delete-confirm-dialog"` to `AlertDialogContent`, `data-testid="delete-confirm-button"` to `AlertDialogAction`

- [ ] Task 2: Write E2E test (AC1–AC5)
  - [ ] 2.1 Seed one imported course into IndexedDB via `indexedDB` fixture
  - [ ] 2.2 Assert "Delete course" item visible in status dropdown
  - [ ] 2.3 Assert Cancel closes dialog without removing course
  - [ ] 2.4 Assert confirm removes course card from DOM
  - [ ] 2.5 Assert success toast "Course removed" is visible (AC3)
  - [ ] 2.6 Assert IndexedDB `importedCourses` store is empty after deletion
  - [ ] 2.7 `afterEach`: clear `importedCourses`, `importedVideos`, `importedPdfs` stores

## Design Guidance

### Where to add the delete item

The existing `DropdownMenuContent` in `ImportedCourseCard.tsx:251` already handles `e.stopPropagation()`. Add inside the same `DropdownMenuContent`, after the status items loop:

```tsx
<DropdownMenuSeparator />
<DropdownMenuItem
  data-testid="delete-course-menu-item"
  className="text-destructive focus:text-destructive gap-2"
  onClick={() => setDeleteDialogOpen(true)}
>
  <Trash2 className="size-4" aria-hidden="true" />
  Delete course
</DropdownMenuItem>
```

### AlertDialog

Render `AlertDialog` as a sibling to the card content (not inside DropdownMenu), controlled externally:

```tsx
<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
  <AlertDialogContent data-testid="delete-confirm-dialog">
    <AlertDialogHeader>
      <AlertDialogTitle>Delete "{course.name}"?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently remove the course and all its content from your
        library. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        data-testid="delete-confirm-button"
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={handleDelete}
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### handleDelete

```tsx
const handleDelete = async () => {
  await removeImportedCourse(course.id)
  const { importError } = useCourseImportStore.getState()
  if (importError) {
    toast.error('Failed to remove course')
  } else {
    toast.success('Course removed')
  }
}
```

> **Note:** `removeImportedCourse` uses optimistic update — the course is removed from Zustand state synchronously before the Dexie transaction. If the transaction fails, the store rolls back (re-inserts the course) and sets `importError`. Check `importError` after the await to determine success.

### Accessibility

- `AlertDialog` (Radix) traps focus and announces to screen readers via `role="alertdialog"`
- Delete menu item must have visible destructive color (not icon alone)
- `AlertDialogDescription` provides context for screen readers

## Implementation Plan

See [plan](plans/e01-s06-delete-imported-course.md) for implementation approach.

## Implementation Notes

**Store method is already complete** — `useCourseImportStore.removeImportedCourse()` at `src/stores/useCourseImportStore.ts:66-98`:
- Optimistic Zustand update (removes course immediately)
- Dexie transaction deletes from `importedCourses`, `importedVideos`, `importedPdfs`
- Rollback on failure with `importError` set

**No schema changes needed** — deletion uses existing Dexie tables.

**Rollback sort-order side effect** — on Dexie failure, the store rollback appends the course at the end of the list (`[...state.importedCourses, courseToRemove]`), not its original position. The course reappears but may shift position in the library. This is a known limitation of the current store design — acceptable for MVP.

**Import path for `cn`** — this project uses `@/app/components/ui/utils` (not `@/lib/utils`). `ImportedCourseCard.tsx` already imports it correctly.

**Toast** — Sonner is already configured. Use `toast.success()` / `toast.error()` from `sonner`.

## Testing Notes

E2E spec file: `tests/e2e/e01-s06-delete-imported-course.spec.ts`

Seed pattern — use the helpers that already exist:
```ts
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { seedImportedCourses } from '../support/helpers/indexeddb-seed'
```
Use `indexedDB.clearStore('importedCourses')` (from the fixture) to clear before seeding.

- Seed one `importedCourses` record via `seedImportedCourses(page, [createImportedCourse({ name: 'Test Course' })])`
- Seed `importedVideos`/`importedPdfs` as empty (or with one entry) to validate cascade
- Serialize tests with `test.describe.configure({ mode: 'serial' })` (IDB is shared in Chromium)
- Seed `localStorage.setItem('knowlune-sidebar-v1', 'false')` before navigating to avoid sidebar overlay

**AC5 (error rollback):** Not covered by E2E — forcing Dexie to throw mid-transaction is not practical in a browser E2E context. Verify manually by temporarily throwing inside `removeImportedCourse` in the store.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] ~~No optimistic UI updates before persistence~~ — **N/A for this story**: optimistic delete is intentional (course removed from state before DB write, rolled back on failure)
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

**Reviewed 2026-03-18** — All ACs pass live testing. Fixes applied:
- Added `variant="destructive"` on delete DropdownMenuItem for proper focus/hover background
- Fixed focus return to status badge after dialog close (WCAG 2.4.3)
- Added 44px minimum touch targets on delete item and status badge
- Report: `docs/reviews/design/design-review-2026-03-18-e01-s06.md`

## Code Review Feedback

**Reviewed 2026-03-18** — 0 blockers. Fixes applied:
- Fixed Enter key on child elements triggering card navigation (`e.target !== e.currentTarget` guard)
- Added double-click guard with `deleting` state + disabled button
- Added `stopPropagation` on delete menu item for consistency
- Fixed hardcoded `ring-blue-600` → `ring-brand` (design token compliance)
- Added `removeImportedCourse` to unit test mock
- Added Escape key test for AC4
- Reports: `docs/reviews/code/code-review-2026-03-18-e01-s06.md`, `docs/reviews/code/edge-case-review-2026-03-18-e01-s06.md`

## Web Design Guidelines Review

**Reviewed 2026-03-18** — Keyboard a11y blocker found and fixed. Remaining pre-existing items:
- AlertDialog description contrast 3.88:1 (shared component — tracked separately)
- `statusConfig` hardcoded colors (pre-existing tech debt, not introduced by this PR)
- Report: `docs/reviews/design/design-review-2026-03-18-e01-s06.md`

## Challenges and Lessons Learned

- **AlertDialog outside DropdownMenu**: Radix `AlertDialog` must be rendered as a sibling to the card, not inside `DropdownMenuContent`. Nesting modal-like components inside a dropdown causes focus trapping conflicts — the dropdown unmounts on close, which would also unmount the dialog. Controlled via `open`/`onOpenChange` props instead of `AlertDialogTrigger`.

- **Unit test breakage from new menu item**: Adding the "Delete course" `DropdownMenuItem` increased the `menuitem` role count from 3 to 4, breaking the existing `toHaveLength(3)` assertion. Lesson: tests that assert exact counts on dynamic lists are brittle — prefer asserting specific items by name when possible.

- **Optimistic delete with error checking pattern**: The store's `removeImportedCourse` uses optimistic update (removes from Zustand immediately, then runs Dexie transaction). Error detection requires checking `importError` from `useCourseImportStore.getState()` after the `await`, not catching an exception — because the store catches internally and sets state. This is the established pattern from E01-S04/S05.

- **z-index for dropdown trigger**: Added `z-20` to the dropdown trigger container to ensure it stays above adjacent card elements during hover interactions.
