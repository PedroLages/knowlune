# Story 83.6: Book Deletion with OPFS Cleanup

Status: done
Completed: 2026-04-05

## Story

As a learner,
I want to delete a book from my library and have all associated files cleaned up,
so that I can free storage space and keep my library organized.

## Acceptance Criteria

1. **Given** the user selects "Delete" from a book's context menu **When** the confirmation dialog appears **Then** it asks "Delete {title}? This will remove the book and all its highlights."

2. **Given** the user confirms deletion **When** the system processes it **Then** it deletes: the Book record from Dexie, all BookHighlight records for that bookId, all related flashcard source links, and the OPFS directory `/knowlune/books/{bookId}/` with all files within

3. **Given** deletion succeeds **When** complete **Then** a success toast appears: "{title} removed from your library" and the library view updates immediately

4. **Given** OPFS deletion fails **When** Dexie cleanup succeeds **Then** a warning toast appears but the Dexie records are still removed (partial cleanup is acceptable)

## Tasks / Subtasks

- [ ] Task 1: Create deletion confirmation dialog (AC: 1)
  - [ ] 1.1 Use shadcn `AlertDialog` (not `Dialog` — AlertDialog is semantically correct for destructive confirmations)
  - [ ] 1.2 Title: "Delete {title}?"
  - [ ] 1.3 Description: "This will remove the book and all its highlights. This action cannot be undone."
  - [ ] 1.4 Cancel button: `variant="outline"`
  - [ ] 1.5 Delete button: `variant="destructive"` with `min-h-[44px]`

- [ ] Task 2: Implement cascade deletion in `useBookStore` (AC: 2, 3, 4)
  - [ ] 2.1 Implement `deleteBook(bookId)` action with this sequence:
    1. Find book record for title (used in toast)
    2. Optimistic removal from local state
    3. Delete all `bookHighlights` where `bookId` matches (Dexie `where('bookId').equals(bookId).delete()`)
    4. Delete all flashcard source links for this book (if flashcards have `sourceBookId` field)
    5. Delete the `Book` record from Dexie
    6. Delete OPFS files via `OpfsStorageService.deleteBookFiles(bookId)` — wrapped in try/catch
    7. Emit `book:deleted` event via event bus
  - [ ] 2.2 If OPFS delete fails: log warning, show `toast.warning` but don't revert Dexie deletions
  - [ ] 2.3 If Dexie delete fails: revert optimistic update, show `toast.error`
  - [ ] 2.4 On success: `toast.success('{title} removed from your library')`

- [ ] Task 3: Wire deletion to context menu (AC: 1)
  - [ ] 3.1 Connect "Delete" context menu action (from S04) to open AlertDialog
  - [ ] 3.2 Pass book title and ID to confirmation dialog
  - [ ] 3.3 On confirm, call `deleteBook(bookId)`

- [ ] Task 4: Handle edge cases (AC: 4)
  - [ ] 4.1 Book with no highlights: deletion still succeeds (highlight query returns 0)
  - [ ] 4.2 Book with no OPFS files (IndexedDB fallback): clean up fallback `bookFiles` table entry
  - [ ] 4.3 Concurrent deletion: guard against double-delete (check book exists before proceeding)

## Dev Notes

### Cascade Deletion Order

The deletion order matters for data integrity:
1. **Highlights first** — they reference the book
2. **Flashcard links** — they reference highlights
3. **Book record** — parent entity
4. **OPFS files** — separate storage, best-effort cleanup

This is a new cleanup pattern in Knowlune. Existing delete operations (e.g., course deletion) don't have this multi-table cascade with external file cleanup. Document this pattern for future stories.

### OPFS Cleanup

`OpfsStorageService.deleteBookFiles(bookId)` should recursively remove `/knowlune/books/{bookId}/` directory. OPFS directory removal:
```typescript
async deleteBookFiles(bookId: string): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const knowlune = await root.getDirectoryHandle('knowlune')
  const books = await knowlune.getDirectoryHandle('books')
  await books.removeEntry(bookId, { recursive: true })
}
```

### NFR11 Compliance

NFR11 states: "Deleting a book cleans up both Dexie records and OPFS files." This story fully implements that requirement. The partial-cleanup fallback (AC4) is acceptable because OPFS failures are typically transient browser issues, and the user still gets a clean database state.

### AlertDialog vs Dialog

Use `AlertDialog` from shadcn (Radix) for destructive confirmations. It provides:
- `role="alertdialog"` (screen readers announce urgency)
- Cancel closes on Escape
- Focus management appropriate for destructive actions

### Dependencies on Previous Stories

- E83-S01: `useBookStore.deleteBook` skeleton, `OpfsStorageService.deleteBookFiles`, event bus `book:deleted`
- E83-S04: Context menu "Delete" action triggers this dialog

### Project Structure Notes

- New files: None (inline AlertDialog in Library page or extracted to `src/app/components/library/BookDeleteDialog.tsx` if complex)
- Modified files: `src/stores/useBookStore.ts` (implement full deleteBook), `src/app/pages/Library.tsx` (state for delete dialog)

### References

- [Source: _bmad-output/planning-artifacts/epics-books-audiobooks-library.md#E83-S06]
- [Source: _bmad-output/planning-artifacts/architecture-books-audiobooks-library.md#Cross-Cutting Concern 6: Storage lifecycle]
- [Source: src/app/components/ui/alert-dialog.tsx — shadcn AlertDialog component]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
