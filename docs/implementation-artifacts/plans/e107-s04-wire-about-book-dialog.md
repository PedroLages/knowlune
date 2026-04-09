# Implementation Plan: E107-S04 — Wire About Book Dialog

## Overview

Create an About Book dialog that displays book metadata (title, author, description, ISBN, tags, format) accessible from the context menu in BookCard and BookListItem components.

## Story Summary

**User Story:** As a reader, I want to view detailed information about a book from the library, so that I can see the book's metadata, description, and other details before reading.

**Acceptance Criteria:**
- AC-1: About Book dialog accessible from BookCard and BookListItem context menu
- AC-2: Dialog displays book metadata (title, author, description, publish date, ISBN, tags, format)
- AC-3: Dialog handles missing metadata gracefully with fallback text
- AC-4: Dialog accessible (keyboard nav, ARIA labels, focus trap)
- AC-5: Dialog works for EPUB and audiobook formats

## Dependencies

- **No blocking dependencies** - All prerequisite stories (E107-S01, E107-S02, E107-S03) are done
- **Epic 107 Status:** In-progress (3/7 stories complete)

## Existing Patterns to Follow

### Dialog Component Pattern
Reference: `src/app/components/library/LinkFormatsDialog.tsx`
- Use shadcn/ui Dialog components (Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription)
- Controlled state with `open` and `onOpenChange` props
- Structure: Header → Content → Footer
- Width: `max-w-md` (448px desktop)

### Menu Integration Pattern
Reference: `src/app/components/library/BookContextMenu.tsx` (lines 117-149)
- Add menu item before "Delete" separator
- Use `ContextMenuItem` with `onClick` handler
- Mirror in `DropdownMenu` for touch devices
- Include `data-testid` for testing

### Cover Image Pattern
Reference: `src/app/hooks/useBookCoverUrl.ts`
```typescript
const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
```
- Handles `opfs://`, `opfs-cover://`, and external URLs
- Returns `null` for missing covers

### Book Type Fields
Reference: `src/data/types.ts` (lines 679-705)
- Available: `title`, `author`, `description`, `tags`, `format`, `isbn`, `publishDate`, `fileSize`, `coverUrl`
- Format: `"epub"` | `"audiobook"`

## Implementation Tasks

### Task 1: Create AboutBookDialog Component
**File:** `src/app/components/library/AboutBookDialog.tsx`

**Structure:**
```tsx
interface AboutBookDialogProps {
  book: Book
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutBookDialog({ book, open, onOpenChange }: AboutBookDialogProps)
```

**Key Elements:**
1. Dialog shell using shadcn/ui Dialog components
2. Cover image with fallback icon (BookOpen for EPUB, Headphones for audiobook)
3. Title and author display
4. Description with fallback text
5. Metadata grid (2 columns): Format, Publish Date, ISBN, File Size
6. Tags display with Badge components

**Styling (from Design Guidance):**
- Dialog: `max-w-md` for desktop, full width mobile
- Cover: `w-32 h-48 rounded-xl overflow-hidden bg-muted`
- Text: `text-card-foreground`, labels in `text-muted-foreground`
- Spacing: `p-6` (24px), `space-y-4` (16px between sections)
- Border radius: `rounded-2xl`

**Fallback Text:**
- Author: "Unknown author" (italic, muted)
- Description: "No description available" (italic, muted)
- ISBN/File Size: "—" for missing values

### Task 2: Integrate Menu Item into BookContextMenu
**File:** `src/app/components/library/BookContextMenu.tsx`

**Changes:**
1. Add state: `const [aboutDialogOpen, setAboutDialogOpen] = useState(false)`
2. Add menu item (line ~127, before "Change Status" submenu):
```tsx
<ContextMenuItem
  onClick={() => setAboutDialogOpen(true)}
  data-testid="context-menu-about-book"
>
  About Book
</ContextMenuItem>
```
3. Mirror in DropdownMenu for touch devices
4. Add AboutBookDialog to render:
```tsx
<AboutBookDialog book={book} open={aboutDialogOpen} onOpenChange={setAboutDialogOpen} />
```

### Task 3: Design Tokens & Accessibility
**Colors:**
- `bg-card`, `text-card-foreground`, `border-border`
- `bg-brand-soft`, `text-brand-soft-foreground` for format badge
- `text-muted-foreground` for labels

**Accessibility (WCAG 2.1 AA+):**
- Dialog component includes focus trap (built-in)
- Add `aria-describedby="about-book-desc"` to DialogContent
- Add `aria-label="Close dialog"` to close button
- Ensure keyboard navigation: Tab through elements, Escape to close
- Add `data-testid` attributes for E2E testing

**Responsive:**
- Desktop: `max-w-md` (448px)
- Mobile: `w-full max-w-[calc(100vw-2rem)]`
- Layout: Horizontal (cover left, info right) on desktop; may stack on very small screens

### Task 4: Testing
**E2E Tests** (already created at `tests/e2e/story-e107-s04.spec.ts`):
- 10 test cases covering all ACs
- Tests for open/close, keyboard nav, accessibility, both formats

**Manual Testing Checklist:**
- [ ] Dialog opens from BookCard context menu
- [ ] Dialog opens from BookListItem
- [ ] Cover image displays correctly (EPUB and audiobook)
- [ ] Fallback text shows for missing metadata
- [ ] Keyboard navigation works (Tab, Escape)
- [ ] Focus trap works (can't tab outside dialog)
- [ ] Click outside closes dialog
- [ ] Responsive layout correct on mobile (375px) and desktop (1440px)
- [ ] Accessibility scan passes (axe-core)

## Implementation Order

1. **Create AboutBookDialog component** (new file)
   - Start with Dialog shell
   - Add cover image with fallback
   - Add title, author, description
   - Add metadata grid
   - Add tags display

2. **Integrate into BookContextMenu**
   - Add state for dialog open/close
   - Add menu items to ContextMenu and DropdownMenu
   - Wire up AboutBookDialog component

3. **Styling refinement**
   - Apply design tokens from theme.css
   - Ensure responsive behavior
   - Verify accessibility

4. **Testing**
   - Run E2E tests: `npm run test:e2e -- tests/e2e/story-e107-s04.spec.ts`
   - Manual testing in browser
   - Accessibility scan

## Risk Assessment

**What could go wrong?**
1. **Dialog state management** - Forgetting to add state to BookContextMenu
   - *Mitigation:* Follow LinkFormatsDialog pattern exactly
2. **Cover image URL resolution** - opfs:// URLs not resolving
   - *Mitigation:* useBookCoverUrl hook handles this
3. **Missing metadata handling** - Null/undefined values causing errors
   - *Mitigation:* Explicit fallback text for each field

**Rollback plan:**
- Changes are isolated to new component + menu item addition
- Safe to revert if issues arise
- No migration or data changes

**Existing patterns apply:**
- Dialog patterns from LinkFormatsDialog
- Menu integration from existing context menu items
- Cover resolution from useBookCoverUrl hook

## Notes

- **Make granular commits** after each task as save points
- **No external dependencies** - uses only existing patterns
- **Design guidance available** in story file with layout, tokens, and accessibility requirements
