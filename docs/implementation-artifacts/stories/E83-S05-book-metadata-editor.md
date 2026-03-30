# Story 83.5: Book Metadata Editor

Status: ready-for-dev

## Story

As a learner,
I want to view and edit my book's metadata after import,
so that I can correct titles, authors, or genres that were not auto-detected accurately.

## Acceptance Criteria

1. **Given** the user selects "Edit" from a book's context menu **When** the BookMetadataEditor dialog opens **Then** it shows editable fields for title, author, ISBN, description, and genre with current values pre-populated

2. **Given** the editor dialog **When** the cover image is displayed **Then** the user has options to re-fetch from Open Library API or upload a custom image

3. **Given** the user edits fields and clicks Save **When** the save action runs **Then** the Book record in Dexie is updated and the library view reflects changes immediately

4. **Given** the user clicks Cancel **When** the dialog closes **Then** no changes are persisted

5. **Given** the user is editing book metadata **When** they interact with the Tags field **Then** they can type tag names and press Enter or comma to add them as chips **And** each tag chip has an X button to remove it **And** tags are free-text (no predefined list), stored in the Book's `tags: string[]` field **And** existing tags from other books are suggested via autocomplete as the user types

## Tasks / Subtasks

- [ ] Task 1: Create `BookMetadataEditor` dialog (AC: 1, 2, 3, 4)
  - [ ] 1.1 Create `src/app/components/library/BookMetadataEditor.tsx`
  - [ ] 1.2 Use shadcn `Dialog` with `DialogContent max-w-lg`
  - [ ] 1.3 Cover image section: display current cover with two action buttons below:
    - "Re-fetch from Open Library" (uses `OpenLibraryService` from S02)
    - "Upload custom cover" (file picker accepting `.jpg`, `.png`, `.webp`)
  - [ ] 1.4 Form fields: title (`Input`), author (`Input`), ISBN (`Input`), description (`Textarea`), genre (`Select` with same options as import dialog)
  - [ ] 1.5 Pre-populate all fields from current `Book` record
  - [ ] 1.6 Save button: `variant="brand"`, Cancel button: `variant="outline"`
  - [ ] 1.7 Both buttons `min-h-[44px]` for touch compliance
  - [ ] 1.8 Accessibility: proper `Label` on all form fields, focus trap within dialog

- [ ] Task 2: Implement save logic (AC: 3)
  - [ ] 2.1 Add `updateBookMetadata(bookId, updates)` action to `useBookStore`
  - [ ] 2.2 Optimistic update: update local state immediately, persist to Dexie
  - [ ] 2.3 If cover image changed, store new cover in OPFS via `OpfsStorageService`
  - [ ] 2.4 Update `updatedAt` timestamp on save
  - [ ] 2.5 Show `toast.success('Book details updated')` on success
  - [ ] 2.6 Revert optimistic update + `toast.error` on failure

- [ ] Task 3: Implement cover re-fetch (AC: 2)
  - [ ] 3.1 Re-fetch button calls `OpenLibraryService` with current ISBN or title+author
  - [ ] 3.2 Show loading spinner on cover area during fetch
  - [ ] 3.3 If cover found, update preview in dialog (not persisted until Save)
  - [ ] 3.4 If not found, show `toast.info('No cover found on Open Library')`

- [ ] Task 4: Implement custom cover upload (AC: 2)
  - [ ] 4.1 File input accepting image types
  - [ ] 4.2 Preview uploaded image in dialog
  - [ ] 4.3 On Save, store uploaded cover in OPFS at `/knowlune/books/{bookId}/cover.jpg`
  - [ ] 4.4 Convert to JPEG if needed for consistency

- [ ] Task 5: Wire editor to context menu (AC: 1)
  - [ ] 5.1 Connect "Edit" context menu action (from S04) to open `BookMetadataEditor`
  - [ ] 5.2 Pass selected book data to editor dialog

- [ ] Task 6: Implement tag editor (AC: 5)
  - [ ] 6.1 Create tag input with chip display using shadcn `Badge` components for each tag
  - [ ] 6.2 On Enter or comma keypress, add current input value as new tag (trimmed, deduplicated)
  - [ ] 6.3 X button on each badge removes the tag
  - [ ] 6.4 Autocomplete: query distinct tags from all books in Dexie, show as suggestions below input
  - [ ] 6.5 Persist tags array to Book record on save

## Dev Notes

### Form Validation

- Title is required (minimum 1 character)
- Author is required (minimum 1 character)
- ISBN, description, genre are optional
- Use controlled inputs with local state in the dialog (not directly mutating store)
- Only persist on Save click, not on individual field changes

### Cover Image Handling

- Cover stored as JPEG in OPFS: `/knowlune/books/{bookId}/cover.jpg`
- If user uploads PNG/WebP, convert to JPEG using Canvas API:
  ```typescript
  async function toJpeg(file: File): Promise<Blob> {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await new Promise(r => img.onload = r)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    return new Promise(r => canvas.toBlob(b => r(b!), 'image/jpeg', 0.85))
  }
  ```
- Maximum cover dimensions: 800x1200 (resize if larger to save OPFS space)

### Tags and Filtering

Tags are stored per-book in E83-S01. The tag editor is in this story (E83-S05). Filtering by tags should be added to E83-S04 (Library Search Filter) — add a tag filter dropdown that shows all distinct tags from the library. If E83-S04 is already complete when this story runs, add tag filtering as a follow-up chore.

### Dependencies on Previous Stories

- E83-S01: `useBookStore`, `OpfsStorageService`, `Book` type
- E83-S02: `OpenLibraryService` (re-fetch cover)
- E83-S04: Context menu "Edit" action triggers this dialog

### Project Structure Notes

- New files: `src/app/components/library/BookMetadataEditor.tsx`
- Modified files: `src/stores/useBookStore.ts` (add `updateBookMetadata`), `src/app/pages/Library.tsx` (state for editor dialog visibility)

### References

- [Source: _bmad-output/planning-artifacts/epics-books-audiobooks-library.md#E83-S05]
- [Source: _bmad-output/planning-artifacts/ux-design-books-audiobooks-library.md#Book Import Dialog — reuse form field patterns]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
