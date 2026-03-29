# Story 83.4: Library Search, Filter, and Status Management

Status: ready-for-dev

## Story

As a learner,
I want to search my library by title or author and filter by reading status,
so that I can quickly find specific books in a growing collection.

## Acceptance Criteria

1. **Given** the user is on the Library page with multiple books **When** the user types in the search field **Then** books are filtered in real-time by title and author with a 300ms debounce

2. **Given** the search input **When** rendered **Then** it has `min-h-[44px]` for touch target compliance and a `Search` icon placeholder "Search books..."

3. **Given** the Library page shows status filter pills **When** the user taps a status pill (All, Want to Read, Reading, Finished, Abandoned) **Then** the library filters to show only books with that status

4. **Given** the "All" pill **When** rendered **Then** it shows a count badge (e.g., "All (24)")

5. **Given** the active filter pill **When** styled **Then** it uses `bg-brand text-brand-foreground rounded-full` and inactive pills use `bg-muted text-muted-foreground rounded-full hover:bg-muted/80`

6. **Given** a book in the library **When** the user right-clicks or long-presses a book card **Then** a context menu appears with "Edit", "Change Status", and "Delete" options

7. **Given** "Change Status" in context menu **When** selected **Then** a submenu shows all four status options and selecting one updates the book in Dexie with optimistic UI update

## Tasks / Subtasks

- [ ] Task 1: Create `LibraryFilters` component (AC: 1, 2, 3, 4, 5)
  - [ ] 1.1 Create `src/app/components/library/LibraryFilters.tsx`
  - [ ] 1.2 Status pill tabs: All | Want to Read | Reading | Finished | Abandoned
  - [ ] 1.3 Active pill: `bg-brand text-brand-foreground rounded-full px-4 py-1.5`
  - [ ] 1.4 Inactive pill: `bg-muted text-muted-foreground rounded-full px-4 py-1.5 hover:bg-muted/80`
  - [ ] 1.5 "All" pill with count badge
  - [ ] 1.6 Search input: shadcn `Input` with `Search` icon, `min-h-[44px]`, placeholder "Search books..."
  - [ ] 1.7 Debounce search at 300ms using `useCallback` + `setTimeout`/`clearTimeout` pattern
  - [ ] 1.8 View toggle buttons (LayoutGrid + List icons) — active: `bg-brand-soft text-brand-soft-foreground`, inactive: `text-muted-foreground hover:text-foreground`

- [ ] Task 2: Implement filtering logic in `useBookStore` (AC: 1, 3)
  - [ ] 2.1 Add `filteredBooks` computed getter that applies `filters.status` and `filters.search`
  - [ ] 2.2 Search filters by `book.title` and `book.author` (case-insensitive includes)
  - [ ] 2.3 Status filter checks `book.status === filters.status` (skip if "all")
  - [ ] 2.4 Add `setFilter(key, value)` action
  - [ ] 2.5 Add `bookCountByStatus` computed for pill count badges

- [ ] Task 3: Implement context menu for book cards (AC: 6, 7)
  - [ ] 3.1 Use shadcn `ContextMenu` wrapping each BookCard and BookListItem
  - [ ] 3.2 Menu items: Edit (opens BookMetadataEditor — placeholder for S05), Change Status (submenu), Delete (triggers deletion — placeholder for S06)
  - [ ] 3.3 Change Status submenu: 4 status options with checkmark on current
  - [ ] 3.4 Status change calls `useBookStore.updateBookStatus(bookId, newStatus)` with optimistic update
  - [ ] 3.5 On mobile: trigger via long-press (ContextMenu already handles this via Radix)

- [ ] Task 4: Wire filters into Library page (AC: 1-5)
  - [ ] 4.1 Add `LibraryFilters` to Library page above the grid/list
  - [ ] 4.2 Pass `useBookStore` filter state and setters
  - [ ] 4.3 Use `filteredBooks` for rendering instead of raw `books` array

- [ ] Task 5: Mobile responsive adaptations (AC: 2)
  - [ ] 5.1 Filter pills: horizontal scroll on mobile (`overflow-x-auto flex gap-2 pb-2`)
  - [ ] 5.2 Search + view toggle + filters on separate rows on mobile, inline on desktop
  - [ ] 5.3 All touch targets >= 44x44px

## Dev Notes

### Debounce Pattern

Do NOT install lodash for debounce. Use the standard React pattern:
```typescript
const timerRef = useRef<ReturnType<typeof setTimeout>>()
const handleSearch = useCallback((value: string) => {
  clearTimeout(timerRef.current)
  timerRef.current = setTimeout(() => {
    setFilter('search', value)
  }, 300)
}, [setFilter])
```

### Context Menu Pattern

Use shadcn's `ContextMenu` component from `src/app/components/ui/context-menu.tsx`. If not yet installed, add via `npx shadcn@latest add context-menu`. Radix's ContextMenu handles both right-click (desktop) and long-press (mobile) natively.

### Optimistic Updates

Status changes should update the local Zustand state immediately, then persist to Dexie. If Dexie write fails, revert the optimistic update and show `toast.error`. Pattern:
```typescript
updateBookStatus: async (bookId, status) => {
  const prev = get().books.find(b => b.id === bookId)
  // Optimistic update
  set(state => ({ books: state.books.map(b => b.id === bookId ? {...b, status, updatedAt: new Date().toISOString()} : b) }))
  try {
    await db.books.update(bookId, { status, updatedAt: new Date().toISOString() })
  } catch (error) {
    // Revert
    if (prev) set(state => ({ books: state.books.map(b => b.id === bookId ? prev : b) }))
    toast.error('Failed to update book status')
  }
}
```

### Dependencies on Previous Stories

- E83-S01: `useBookStore` (extend with filter state/actions)
- E83-S03: `BookCard`, `BookListItem` (wrap with ContextMenu)

### Project Structure Notes

- New files: `src/app/components/library/LibraryFilters.tsx`
- Modified files: `src/stores/useBookStore.ts` (add filtering), `src/app/pages/Library.tsx` (add filters), `src/app/components/library/BookCard.tsx` (wrap with ContextMenu), `src/app/components/library/BookListItem.tsx` (wrap with ContextMenu)

### References

- [Source: _bmad-output/planning-artifacts/epics-books-audiobooks-library.md#E83-S04]
- [Source: _bmad-output/planning-artifacts/ux-design-books-audiobooks-library.md#Filter Bar]
- [Source: src/app/components/ui/ — check if context-menu.tsx exists]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
