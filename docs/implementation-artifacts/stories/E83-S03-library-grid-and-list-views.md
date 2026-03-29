# Story 83.3: Library Grid and List Views

Status: ready-for-dev

## Story

As a learner,
I want to view my imported books in an attractive grid or list layout,
so that I can browse my library and see covers, titles, and reading progress at a glance.

## Acceptance Criteria

1. **Given** the user has imported one or more books **When** the user navigates to `/library` **Then** books display in a responsive grid (2 cols mobile, 3 cols tablet, 4-5 cols desktop) by default

2. **Given** the grid view **When** each BookCard renders **Then** it shows: cover image (`aspect-[2/3]` with placeholder if missing), title (2-line clamp), author, progress bar with percentage, and status badge overlay

3. **Given** the library view toggle **When** the user clicks between grid and list icons **Then** the view switches and the preference persists in `useBookStore.libraryView`

4. **Given** list view is selected **When** books render **Then** each row shows cover thumbnail (`size-16`), title, author, format, page count, progress bar, status dropdown, and "last read" relative time

5. **Given** a book card **When** the user clicks it **Then** it navigates to `/library/{bookId}`

6. **Given** a book card **When** the user hovers **Then** it shows `scale-[1.02]` transform with shadow increase

7. **Given** accessibility requirements **When** book cards render **Then** each has `role="article"` with `aria-label="{title} by {author}, {progress}% complete"` and is keyboard navigable via Tab/Enter

8. **Given** the library grid **When** rendering up to 500 books **Then** it completes in under 1 second (NFR6)

9. **Given** the user has no books imported **When** navigating to `/library` **Then** an empty state displays with `BookOpen` icon, "Your library is empty" heading, descriptive text, and a brand-variant Import button that acts as a drag-drop zone for EPUB files

## Tasks / Subtasks

- [ ] Task 1: Create `BookCard` component (AC: 2, 5, 6, 7)
  - [ ] 1.1 Create `src/app/components/library/BookCard.tsx`
  - [ ] 1.2 Cover image: `aspect-[2/3] rounded-xl object-cover`
  - [ ] 1.3 Cover placeholder (no image): `bg-muted flex items-center justify-center` with `BookOpen` icon
  - [ ] 1.4 Title: `text-sm font-medium line-clamp-2`
  - [ ] 1.5 Author: `text-xs text-muted-foreground`
  - [ ] 1.6 Progress bar: `h-1.5 rounded-full bg-muted` with `bg-brand` fill
  - [ ] 1.7 Status badge overlay (top-right of cover): pill showing status with color coding
  - [ ] 1.8 Card wrapper: `rounded-[24px] bg-card border border-border/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer`
  - [ ] 1.9 Hover: `hover:scale-[1.02] transition-transform`
  - [ ] 1.10 Accessibility: `role="article"` with `aria-label`, `focus-visible:ring-2 focus-visible:ring-brand`
  - [ ] 1.11 Click handler navigating to `/library/{bookId}`

- [ ] Task 2: Create `BookListItem` component (AC: 4, 5, 7)
  - [ ] 2.1 Create `src/app/components/library/BookListItem.tsx`
  - [ ] 2.2 Row layout: `flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer`
  - [ ] 2.3 Cover thumbnail: `size-16 rounded-lg object-cover flex-shrink-0`
  - [ ] 2.4 Title, author, format, page count metadata
  - [ ] 2.5 Status dropdown: shadcn `Select` with compact styling
  - [ ] 2.6 Progress bar (wider than grid) + "last read" relative time
  - [ ] 2.7 Same accessibility and click navigation as BookCard

- [ ] Task 3: Create `BookStatusBadge` component (AC: 2)
  - [ ] 3.1 Create `src/app/components/library/BookStatusBadge.tsx`
  - [ ] 3.2 Status color mapping: Reading=`bg-brand/90`, Finished=`bg-success/90`, Want to Read=`bg-gold/90`, Abandoned=`bg-muted-foreground/70`
  - [ ] 3.3 Small pill: `text-[10px] px-2 py-0.5 rounded-full text-white font-medium`

- [ ] Task 4: Implement Library page grid/list views (AC: 1, 3, 8)
  - [ ] 4.1 Update `src/app/pages/Library.tsx`
  - [ ] 4.2 Page header: "Books" title + "Import Book" button (brand variant with Plus icon)
  - [ ] 4.3 View toggle: `LayoutGrid` and `List` icon buttons with active/inactive styling
  - [ ] 4.4 Grid layout: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4`
  - [ ] 4.5 List layout: vertical stack of `BookListItem` rows
  - [ ] 4.6 Persist view preference in `useBookStore.libraryView`
  - [ ] 4.7 Load books from `useBookStore.loadBooks()` on mount

- [ ] Task 5: Implement empty state (AC: 9)
  - [ ] 5.1 Empty state: `BookOpen` icon `size-16 text-muted-foreground/40`
  - [ ] 5.2 Heading: "Your library is empty" in `text-lg font-medium`
  - [ ] 5.3 Description text about importing EPUBs
  - [ ] 5.4 Import button: `variant="brand"` with Plus icon, `min-h-[44px]`
  - [ ] 5.5 Wrap in drag-drop zone: `border-2 border-dashed border-border/50 rounded-[24px]`
  - [ ] 5.6 Drag over state: `border-brand bg-brand-soft/20`

- [ ] Task 6: Performance optimization for large libraries (AC: 8)
  - [ ] 6.1 Consider virtualization if library exceeds ~100 books (react-window or native CSS containment)
  - [ ] 6.2 Lazy load cover images with `loading="lazy"` on `<img>` tags
  - [ ] 6.3 Memoize BookCard with `React.memo` to prevent unnecessary re-renders

## Dev Notes

### Design Token Compliance

- Card background: `bg-card` (NOT `bg-white`)
- Border: `border-border/50` (NOT hardcoded gray)
- Progress bar track: `bg-muted`, fill: `bg-brand`
- Muted text: `text-muted-foreground` (NOT `text-gray-500`)
- Badge colors must use design tokens: `bg-brand`, `bg-success` — NOT hardcoded `bg-blue-600` or `bg-green-500`
- Status badge "Want to Read" uses `bg-gold/90` — verify this token exists in theme.css, or use `bg-warning/90` as fallback

### Relative Time Display

For "last read" in list view, use a lightweight relative time formatter. Do NOT add a new dependency — implement a small utility or use `Intl.RelativeTimeFormat`:
```typescript
function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('sv-SE')
}
```

### Dependencies on Previous Stories

- E83-S01: `useBookStore`, `Book` type, Library page placeholder, route registration
- E83-S02: `BookImportDialog` (triggered from Import button on this page)

### Project Structure Notes

- New files: `src/app/components/library/BookCard.tsx`, `src/app/components/library/BookListItem.tsx`, `src/app/components/library/BookStatusBadge.tsx`
- Modified files: `src/app/pages/Library.tsx` (major update from placeholder to full implementation)

### References

- [Source: _bmad-output/planning-artifacts/epics-books-audiobooks-library.md#E83-S03]
- [Source: _bmad-output/planning-artifacts/ux-design-books-audiobooks-library.md#Library Page — Page Layout, Book Card, Book List Item, Empty State]
- [Source: src/app/components/ui/ — shadcn component patterns]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
