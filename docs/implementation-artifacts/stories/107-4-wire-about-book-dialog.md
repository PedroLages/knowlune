---
story_id: E107-S04
story_name: "Wire About Book Dialog"
status: done
started: 2026-04-09
completed: 2026-04-09
reviewed: true
review_started: 2026-04-09
review_gates_passed: ["pre-checks", "build", "lint", "type-check", "format-check", "unit-tests-skipped", "e2e-tests", "design-review", "code-review", "code-review-testing", "performance-benchmark", "security-review", "exploratory-qa"]
burn_in_validated: false
---

# Story 107.4: Wire About Book Dialog

## Story

As a reader,
I want to view detailed information about a book from the library,
so that I can see the book's metadata, description, and other details before reading.

## Acceptance Criteria

- **AC-1**: About Book dialog is accessible from BookCard and BookListItem context menu
- **AC-2**: Dialog displays book metadata (title, author, description, publish date, ISBN, tags, format)
- **AC-3**: Dialog handles missing metadata gracefully with fallback text
- **AC-4**: Dialog is accessible (keyboard navigation, ARIA labels, focus trap)
- **AC-5**: Dialog works for both EPUB and audiobook formats

## Tasks / Subtasks

- [ ] Task 1: Create AboutBookDialog component (AC: 2, 3, 4)
  - [ ] 1.1 Use Dialog component from shadcn/ui with proper ARIA attributes
  - [ ] 1.2 Layout: Title, author, cover image, description, metadata grid
  - [ ] 1.3 Metadata grid shows: format, publish date, ISBN, tags, file size
  - [ ] 1.4 Fallback text for missing fields (e.g., "Unknown author", "No description")
  - [ ] 1.5 Focus trap on dialog open, focus return on close

- [ ] Task 2: Add "About Book" menu item to BookContextMenu (AC: 1)
  - [ ] 2.1 Add menu item before "Delete" separator
  - [ ] 2.2 Add state management for dialog open/close
  - [ ] 2.3 Pass book prop to AboutBookDialog

- [ ] Task 3: Add "About Book" action to BookCard and BookListItem (AC: 1)
  - [ ] 3.1 Pass onAboutBook callback to context menu
  - [ ] 3.2 Wire up menu item click to open dialog

- [ ] Task 4: Add styling with theme tokens (AC: 2, 3)
  - [ ] 4.1 Use bg-card, text-card-foreground, border-border
  - [ ] 4.2 Consistent spacing with 8px grid
  - [ ] 4.3 Responsive layout (mobile: full width, desktop: max-w-md)

- [ ] Task 5: Add E2E test for About Book dialog (AC: 1, 4, 5)
  - [ ] 5.1 Test opening dialog from context menu
  - [ ] 5.2 Test keyboard navigation (Escape to close)
  - [ ] 5.3 Test with EPUB book
  - [ ] 5.4 Test with audiobook

- [ ] Task 6: Verify accessibility with axe-core (AC: 4)
  - [ ] 6.1 No a11y violations in dialog
  - [ ] 6.2 Focus management correct
  - [ ] 6.3 Screen reader announces dialog title

## Design Guidance

### Layout Structure

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐    │
│  │ DialogTitle (BookOpen icon) │    │
│  │ About Book                  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────┐  ┌──────────────────┐  │
│  │         │  │ Title            │  │
│  │  Cover  │  │ Author           │  │
│  │  Image  │  │ Format Badge     │  │
│  │         │  └──────────────────┘  │
│  │         │                       │
│  │         │  ┌──────────────────┐  │
│  │         │  │ Description      │  │
│  │         │  │ (multiline)      │  │
│  │         │  └──────────────────┘  │
│  └─────────┘                       │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Metadata Grid (2 columns)     │    │
│  │ Format | Publish Date         │    │
│  │ ISBN   | File Size            │    │
│  │ Tags   | (wrap)                │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Close button (right-aligned) │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Design Tokens (from theme.css)

**Colors:**
- Dialog background: `bg-card` (#ffffff)
- Text: `text-card-foreground` (#1c1d2b)
- Borders: `border border-border` (rgba(0, 0, 0, 0.07))
- Muted labels: `text-muted-foreground` (#656870)
- Format badge background: `bg-brand-soft` (#d0d2ee)
- Format badge text: `text-brand-soft-foreground` (#3d46b8)

**Typography:**
- Headings: `font-heading` (Space Grotesk Variable)
- Body: `font-body` (DM Sans)
- Title: `text-lg font-semibold`
- Labels: `text-xs font-medium uppercase tracking-wider text-muted-foreground`

**Spacing (8px grid):**
- Dialog padding: `p-6` (24px)
- Section spacing: `space-y-4` (16px between sections)
- Cover/image gap: `gap-4` (16px)
- Metadata grid gap: `gap-3` (12px)
- Border radius: `rounded-2xl` for dialog, `rounded-xl` for cards

**Layout:**
- Desktop: `max-w-md` (448px) centered
- Mobile: `w-full max-w-[calc(100vw-2rem)]`
- Cover image size: `w-32 h-48` (128px × 192px) - aspect ratio 2:3
- Fallback icon: `size-12` centered

### Component Patterns

**1. Dialog Shell (from LinkFormatsDialog pattern):**
```tsx
<DialogContent className="max-w-md" aria-describedby="about-book-desc">
  <DialogHeader>
    <DialogTitle className="flex items-center gap-2">
      <BookOpen className="size-5" aria-hidden="true" />
      About Book
    </DialogTitle>
    <DialogDescription id="about-book-desc">
      Book details and metadata
    </DialogDescription>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

**2. Cover Image Pattern (from BookCard/LinkFormatsDialog):**
```tsx
<div className="w-32 h-48 flex-shrink-0 rounded-xl overflow-hidden bg-muted">
  {resolvedCoverUrl ? (
    <img src={resolvedCoverUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      {book.format === 'audiobook' ? (
        <Headphones className="size-12 text-muted-foreground" />
      ) : (
        <BookOpen className="size-12 text-muted-foreground" />
      )}
    </div>
  )}
</div>
```

**3. Metadata Grid (2-column layout):**
```tsx
<div className="grid grid-cols-[auto_1fr] gap-y-3 gap-x-4 text-sm">
  <span className="text-muted-foreground">Format</span>
  <span className="font-medium">{book.format.toUpperCase()}</span>

  <span className="text-muted-foreground">Published</span>
  <span className="font-medium">{publishDate || 'Unknown'}</span>

  {/* ... */}
</div>
```

**4. Tags Display (from BookMetadataEditor pattern):**
```tsx
<div className="flex flex-wrap gap-1.5">
  {tags.map(tag => (
    <Badge key={tag} variant="secondary" className="text-xs">
      {tag}
    </Badge>
  ))}
</div>
```

**5. Fallback Text Pattern:**
```tsx
{author ? (
  <p className="text-base font-medium">{author}</p>
) : (
  <p className="text-base font-medium text-muted-foreground italic">
    Unknown author
  </p>
)}
```

### Accessibility Requirements (WCAG 2.1 AA+)

**Keyboard Navigation:**
- Focus trap: Dialog component handles this automatically
- Escape to close: Built into Dialog component
- Tab order: Cover → Title → Author → Description → Metadata → Close button

**ARIA Attributes:**
- `role="dialog"` on DialogContent (automatic)
- `aria-labelledby="dialog-title"` on DialogContent
- `aria-describedby="about-book-desc"` for description
- `aria-label` on close button: "Close dialog"
- `alt=""` on decorative cover image

**Focus Management:**
- Focus moves to first focusable element on open
- Focus returns to triggering element on close
- No focus indicators visible (use `focus-visible:ring-2 focus-visible:ring-brand`)

**Screen Reader:**
- Dialog title is announced: "About Book dialog, [Book Title]"
- Description provides context: "Book details and metadata"
- Labels for metadata fields are properly associated

**Contrast:**
- All text meets 4.5:1 contrast ratio (verified by theme tokens)
- Muted text (`text-muted-foreground`) still passes contrast
- Badge backgrounds use `bg-brand-soft` with `text-brand-soft-foreground` for WCAG AA

### Responsive Behavior

**Desktop (≥640px):**
- `max-w-md` (448px)
- Horizontal layout: Cover (left) + Info (right)
- Metadata grid: 2 columns

**Mobile (<640px):**
- `w-full max-w-[calc(100vw-2rem)]`
- Vertical layout: Cover (top) + Info (bottom)
- Metadata grid: 2 columns (maintained, may wrap on very small)

**Dialog positioning:**
- Centered horizontally and vertically
- Margin: `sm:my-8` on desktop
- Full viewport consideration: Prevent overflow on small screens

### Animation & Motion

**Dialog enter/exit:**
- Uses shadcn/ui default dialog animations
- Fade in: 150ms ease-out
- Scale in: subtle scale(0.95) → scale(1)

**Micro-interactions:**
- Hover on cover: subtle scale (105%) + shadow
- Focus states: `focus-visible:ring-2 focus-visible:ring-brand`
- Badge hover: `hover:bg-brand-soft/80`

**Respect `prefers-reduced-motion`:**
- Dialog component handles this automatically
- No custom animations needed

### Icon Usage

**Lucide React icons:**
- `BookOpen` (title icon): `size-5` in header
- `Headphones` (audiobook fallback): `size-12` for cover placeholder
- `X` (close): Built into Dialog component
- Use `aria-hidden="true"` on decorative icons

### Menu Item Integration (BookContextMenu pattern)

**Context menu item (before Delete separator):**
```tsx
<ContextMenuItem
  onClick={onAboutBook}
  data-testid="context-menu-about-book"
>
  About Book
</ContextMenuItem>

<ContextMenuSeparator />

<ContextMenuItem className="text-destructive">
  Delete
</ContextMenuItem>
```

**Dropdown menu item (same order):**
```tsx
<DropdownMenuItem onClick={onAboutBook}>
  About Book
</DropdownMenuItem>

<DropdownMenuSeparator />

<DropdownMenuItem className="text-destructive">
  Delete
</DropdownMenuItem>
```

## Implementation Plan

See [plan](../plans/e107-s04-wire-about-book-dialog.md) for implementation approach.

## Implementation Notes

- **Dialog component**: Use shadcn/ui Dialog component which includes focus trap and ARIA attributes
- **Menu placement**: Add "About Book" menu item before the separator that precedes "Delete"
- **Metadata display**: Book type has these fields - title, author, description, tags, format (epub/audiobook), publishDate, isbn, fileSize
- **Cover image**: Use useBookCoverUrl hook for consistent cover resolution

## Testing Notes

- E2E test should verify: dialog opens from context menu, displays book info, closes on Escape/click outside
- Accessibility test with axe-core should pass with no violations
- Test with both EPUB and audiobook to ensure format-specific metadata displays correctly

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors (or have silent-catch-ok comment)
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern
- [ ] CRUD completeness: For any entity this story touches, verify Create/Read/Update/Delete paths all exist
- [ ] At every non-obvious code site, add `// Intentional: <reason>` comment
- [ ] For every `useEffect` or async callback that reads Zustand state: confirm it reads from `get()` inside the callback
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Challenges and Lessons Learned

### Data Model Alignment
The original story plan listed `publishDate` as an available field in the Book interface, but this field doesn't exist in the actual type definition (`src/data/types.ts`). This was discovered during TypeScript compilation. **Resolution:** Removed the publishDate field from the AboutBookDialog component and updated the E2E test to match the actual available fields (format, ISBN, fileSize). This highlights the importance of verifying field availability against the actual type definition rather than relying on story documentation.

### Lint Hygiene
Two minor lint warnings were caught during pre-checks: an unused import (`BookOpen`) and a catch block without visible feedback. Both were quickly addressed with a `// silent-catch-ok` comment and import cleanup. Keeping the codebase lint-clean at the story level prevents accumulation of tech debt.

### Dialog Pattern Consistency
Following the existing `LinkFormatsDialog` pattern proved valuable for consistent state management, menu item placement, and keyboard interaction handling. The shadcn/ui Dialog component includes built-in accessibility features (focus trap, ARIA attributes) that reduced custom implementation effort.
