---
story_id: E67-S03
story_name: "Create FloatingActionToolbar and SelectionModeHeader"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 67.3: Create FloatingActionToolbar and SelectionModeHeader

Status: ready-for-dev

## Story

As a user,
I want to see a toolbar with available actions when I have items selected,
so that I can quickly perform bulk operations on my selection.

## Acceptance Criteria

**Given** no items are selected
**When** the page renders
**Then** the FloatingActionToolbar is not visible

**Given** the user selects their first item
**When** selectedCount becomes 1
**Then** the FloatingActionToolbar slides up from the bottom of the screen (200ms ease-out)
**And** displays: close [X] button, "1 selected" badge, and action buttons

**Given** the user selects 5 items
**When** the toolbar is visible
**Then** the badge updates to "5 selected" in real time

**Given** the user clicks the [X] close button on the toolbar
**When** clicked
**Then** all selections are cleared and the toolbar slides down and disappears

**Given** the viewport is wider than 1024px (desktop)
**When** the toolbar renders
**Then** action buttons show icon + full text label (e.g., "Archive", "Export", "Delete")

**Given** the viewport is between 640px and 1024px (tablet)
**When** the toolbar renders
**Then** action buttons show icon + abbreviated label

**Given** the viewport is narrower than 640px (mobile)
**When** the toolbar renders
**Then** action buttons show icons only with tooltips on long-press

**Given** a screen reader user focuses the toolbar
**When** focus enters the toolbar
**Then** it announces "Bulk actions for N selected items" via aria-label
**And** role="toolbar" is present
**And** arrow keys navigate between action buttons

**Given** items are selected
**When** the SelectionModeHeader renders above the list
**Then** it shows "{N} selected" text, a "Select All ({total})" button, and a "Clear" button
**And** the count is in an aria-live="polite" region

**Given** the user has prefers-reduced-motion enabled
**When** the toolbar appears or disappears
**Then** it shows/hides instantly without slide animation

## Tasks / Subtasks

- [ ] Task 1: Create FloatingActionToolbar component (AC: 1, 2, 3, 4)
  - [ ] 1.1 Create `src/app/components/bulk/FloatingActionToolbar.tsx`
  - [ ] 1.2 Portal to document body via `createPortal` to escape parent overflow/stacking contexts
  - [ ] 1.3 Position: `fixed bottom-4 left-1/2 -translate-x-1/2 z-40`
  - [ ] 1.4 Styling: `bg-card shadow-lg border rounded-2xl px-4 py-2 flex items-center gap-2`
  - [ ] 1.5 Close [X] button with `X` icon from lucide-react, calls `onClear`
  - [ ] 1.6 Selection count badge using shadcn `<Badge variant="secondary">`
  - [ ] 1.7 Conditionally render based on `selectedCount > 0`

- [ ] Task 2: Implement slide animation (AC: 2, 10)
  - [ ] 2.1 Slide-up on enter: `translate-y-full -> translate-y-0` with `200ms ease-out`
  - [ ] 2.2 Slide-down on exit: reverse animation
  - [ ] 2.3 Use CSS transitions (not framer-motion — project doesn't use it)
  - [ ] 2.4 Check `useReducedMotion()` — if true, skip animation (instant show/hide)

- [ ] Task 3: Implement responsive action layout (AC: 5, 6, 7)
  - [ ] 3.1 Accept `actions: BulkAction[]` prop with `{ label, shortLabel?, icon: LucideIcon, variant, onClick }`
  - [ ] 3.2 Desktop (> 1024px): icon + full label
  - [ ] 3.3 Tablet (640-1024px): icon + `shortLabel` (or truncated label)
  - [ ] 3.4 Mobile (< 640px): icon only, wrapped in shadcn `<Tooltip>` showing label
  - [ ] 3.5 Use Tailwind responsive classes: `hidden lg:inline`, `hidden sm:inline lg:hidden`, etc.
  - [ ] 3.6 Overflow into "More" dropdown menu on mobile when > 4 actions (shadcn `<DropdownMenu>`)

- [ ] Task 4: Implement toolbar keyboard navigation (AC: 8)
  - [ ] 4.1 Add `role="toolbar"` to container
  - [ ] 4.2 Add `aria-label="Bulk actions for {selectedCount} selected items"`
  - [ ] 4.3 First action button gets `tabIndex={0}`, others get `tabIndex={-1}`
  - [ ] 4.4 Arrow left/right moves focus between buttons (roving tabindex pattern)
  - [ ] 4.5 Enter/Space activates focused button

- [ ] Task 5: Create SelectionModeHeader component (AC: 9)
  - [ ] 5.1 Create `src/app/components/bulk/SelectionModeHeader.tsx`
  - [ ] 5.2 Props: `selectedCount`, `totalCount`, `onSelectAll`, `onClear`
  - [ ] 5.3 Layout: flex row with "{N} selected" text, "Select All ({total})" button, "Clear" button
  - [ ] 5.4 Wrap count in `<span aria-live="polite">` for screen reader announcements
  - [ ] 5.5 Conditionally render: only visible when `selectedCount > 0`
  - [ ] 5.6 Use design tokens for all colors

- [ ] Task 6: Write unit tests (all ACs)
  - [ ] 6.1 Create `src/app/components/bulk/__tests__/FloatingActionToolbar.test.tsx`
  - [ ] 6.2 Create `src/app/components/bulk/__tests__/SelectionModeHeader.test.tsx`
  - [ ] 6.3 Test toolbar hidden when selectedCount=0
  - [ ] 6.4 Test toolbar visible when selectedCount > 0
  - [ ] 6.5 Test close button calls onClear
  - [ ] 6.6 Test badge displays correct count
  - [ ] 6.7 Test action buttons render with correct labels
  - [ ] 6.8 Test aria-label includes count
  - [ ] 6.9 Test SelectionModeHeader shows count and buttons

## Dev Notes

### Architecture

- **FloatingActionToolbar** is a generic, reusable component. It doesn't know about courses/notes/bookmarks — it receives an array of action descriptors and renders them. Integration stories (S06-S08) provide the specific actions.
- **SelectionModeHeader** sits above the list/grid and provides "Select All" and "Clear" controls.
- Both components are controlled — all state comes from props (driven by useBulkSelection hook).

### BulkAction Interface

```typescript
interface BulkAction {
  label: string        // Full label for desktop: "Archive"
  shortLabel?: string  // Abbreviated for tablet: "Arc."
  icon: LucideIcon     // Icon component from lucide-react
  variant?: 'default' | 'destructive' | 'brand' | 'brand-outline'
  onClick: () => void
}
```

### Portal Pattern

The toolbar must be portaled to `document.body` to escape parent `overflow: hidden`, `position: sticky`, or z-index stacking contexts. Use React's `createPortal`:

```typescript
return createPortal(<div className="fixed ...">...</div>, document.body)
```

### Roving Tabindex Pattern

For `role="toolbar"` keyboard navigation:
1. Only one button in the toolbar is in the tab order (`tabIndex={0}`)
2. Arrow keys move focus between buttons and update which has `tabIndex={0}`
3. Tab exits the toolbar to the next page element
4. Store active index in state, update on arrow key press

### Design Token Usage

| Visual | Token | Wrong Alternative |
|--------|-------|-------------------|
| Toolbar background | `bg-card` | `bg-white` |
| Toolbar shadow | `shadow-lg` | hardcoded box-shadow |
| Toolbar border | `border` (uses `--border` token) | `border-gray-200` |
| Count badge | `Badge variant="secondary"` | manual bg/text colors |
| Delete action | `variant="destructive"` | `bg-red-500` |

### Dependencies

- **E67-S01** (useBulkSelection) — provides selectedCount, clearSelection
- shadcn components: `Badge`, `Button`, `Tooltip`, `DropdownMenu`
- lucide-react icons: `X`, `MoreHorizontal`, plus action-specific icons

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/components/bulk/FloatingActionToolbar.tsx` | Floating toolbar |
| `src/app/components/bulk/SelectionModeHeader.tsx` | Header with count + Select All |
| `src/app/components/bulk/__tests__/FloatingActionToolbar.test.tsx` | Toolbar tests |
| `src/app/components/bulk/__tests__/SelectionModeHeader.test.tsx` | Header tests |

### Files to Reference (read-only)

| File | Why |
|------|-----|
| `src/app/components/ui/badge.tsx` | Badge component API |
| `src/app/components/ui/button.tsx` | Button variants including brand |
| `src/app/components/ui/tooltip.tsx` | Tooltip for mobile icon-only buttons |
| `src/app/components/ui/dropdown-menu.tsx` | "More" overflow menu |
| `src/hooks/useReducedMotion.ts` | Motion preference hook |

### References

- [Source: _bmad-output/planning-artifacts/epics-bulk-operations.md#Story 67.3]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Floating Action Toolbar]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Responsive Breakpoints]

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] No hardcoded colors — ESLint `design-tokens/no-hardcoded-colors` passes
- [ ] Portal to body (not rendered inline)
- [ ] `role="toolbar"` with `aria-label`
- [ ] Roving tabindex for arrow key navigation
- [ ] `aria-live="polite"` on selection count
- [ ] Reduced motion support
- [ ] Responsive layout tested at 3 breakpoints
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

## Code Review Feedback

## Challenges and Lessons Learned
