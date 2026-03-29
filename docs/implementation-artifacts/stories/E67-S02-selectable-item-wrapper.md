---
story_id: E67-S02
story_name: "Create SelectableItem Wrapper Component"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 67.2: Create SelectableItem Wrapper Component

Status: ready-for-dev

## Story

As a user,
I want to see a checkbox appear on list items so I can select them for bulk actions,
so that I can choose which items to operate on without leaving the list view.

## Acceptance Criteria

**Given** a user is browsing a list page on desktop and not in selection mode
**When** they hover over a list item
**Then** an unchecked checkbox fades in at the top-left corner of the item

**Given** a user is in selection mode
**When** they view any list item
**Then** all item checkboxes are visible (not just on hover)

**Given** a user clicks a checkbox on a list item
**When** the item was not previously selected
**Then** the item gets a bg-brand-soft/30 background tint and ring-2 ring-brand highlight
**And** the checkbox shows a checked state with brand color fill

**Given** a user is in selection mode and clicks on an item body (not the checkbox)
**When** selection mode is active
**Then** the item's selection state is toggled (prevents navigation to item detail)

**Given** a user is NOT in selection mode and clicks on an item body
**When** no items are selected
**Then** normal click behavior occurs (e.g., navigation to detail page)

**Given** a user is on a touch device
**When** they long-press an item for 300ms
**Then** the item enters selection mode and is selected
**And** haptic feedback triggers if the browser supports it (navigator.vibrate)

**Given** a user begins a long-press but releases before 300ms
**When** the pointer is lifted early
**Then** no selection occurs and normal click behavior proceeds

**Given** the user has prefers-reduced-motion enabled
**When** selection state changes
**Then** no fade/scale animations are applied; state changes are instant

**Given** the component wraps any child component
**When** rendered
**Then** the child component renders identically to its unwrapped version (no layout shift, no style interference)

## Tasks / Subtasks

- [ ] Task 1: Create SelectableItem component shell (AC: 9)
  - [ ] 1.1 Create `src/app/components/bulk/SelectableItem.tsx`
  - [ ] 1.2 Define props interface: `id: string`, `isSelected: boolean`, `isSelectionMode: boolean`, `onToggle: (id: string) => void`, `onLongPress?: (id: string) => void`, `itemLabel?: string`, `children: ReactNode`
  - [ ] 1.3 Render `position: relative` container wrapping children
  - [ ] 1.4 Ensure no layout shift — wrapper must not add margin/padding/border that changes child dimensions

- [ ] Task 2: Implement checkbox overlay (AC: 1, 2, 3)
  - [ ] 2.1 Use shadcn `<Checkbox>` component, positioned `absolute top-2 left-2 z-10`
  - [ ] 2.2 Desktop: checkbox hidden by default, visible on container hover via `group-hover:opacity-100` (Tailwind group pattern)
  - [ ] 2.3 When `isSelectionMode` is true, checkbox always visible (override hover-only)
  - [ ] 2.4 Checked state uses brand color fill (shadcn Checkbox handles this via design tokens)
  - [ ] 2.5 Tap area must be 44x44px minimum — use padding around 20x20px visual checkbox
  - [ ] 2.6 Add `aria-label="Select {itemLabel}"` to checkbox

- [ ] Task 3: Implement selected state styling (AC: 3)
  - [ ] 3.1 When `isSelected` is true, apply `bg-brand-soft/30 ring-2 ring-brand` to wrapper
  - [ ] 3.2 Use `rounded-[24px]` to match card border-radius from project design system
  - [ ] 3.3 All colors from design tokens — no hardcoded values

- [ ] Task 4: Implement click behavior toggle (AC: 4, 5)
  - [ ] 4.1 When `isSelectionMode` is true and user clicks item body (not checkbox), call `onToggle(id)`
  - [ ] 4.2 When `isSelectionMode` is true, call `event.preventDefault()` and `event.stopPropagation()` to block navigation
  - [ ] 4.3 When `isSelectionMode` is false, allow normal click-through (no interference)
  - [ ] 4.4 Checkbox click always calls `onToggle(id)` regardless of mode

- [ ] Task 5: Implement long-press detection (AC: 6, 7)
  - [ ] 5.1 `onPointerDown` starts 300ms setTimeout storing timer ref
  - [ ] 5.2 On timeout: call `onLongPress(id)` (or `onToggle(id)` if no longPress handler), trigger `navigator.vibrate?.(10)` for haptic
  - [ ] 5.3 `onPointerUp` / `onPointerCancel` / `onPointerLeave` clears timer if < 300ms elapsed
  - [ ] 5.4 Set a `longPressTriggered` ref flag to prevent click event from firing after long-press
  - [ ] 5.5 Clear `longPressTriggered` flag on next `onPointerDown`

- [ ] Task 6: Implement reduced motion support (AC: 8)
  - [ ] 6.1 Import `useReducedMotion()` from `src/hooks/useReducedMotion.ts` (existing hook)
  - [ ] 6.2 When reduced motion enabled: skip fade-in animation on checkbox, skip scale animation on selection
  - [ ] 6.3 Use `transition-opacity duration-150` only when motion is allowed; instant otherwise

- [ ] Task 7: Write unit tests (all ACs)
  - [ ] 7.1 Create `src/app/components/bulk/__tests__/SelectableItem.test.tsx`
  - [ ] 7.2 Test checkbox visibility on hover (desktop)
  - [ ] 7.3 Test checkbox always visible when isSelectionMode=true
  - [ ] 7.4 Test selected state applies correct classes
  - [ ] 7.5 Test click behavior in selection mode (toggles) vs normal mode (passes through)
  - [ ] 7.6 Test long-press timer (mock setTimeout)
  - [ ] 7.7 Test child component renders unmodified

## Dev Notes

### Architecture

- **Wrapper pattern**: SelectableItem wraps existing card components (ImportedCourseCard, NoteCard, BookmarkRow) without modifying them. This is a key architectural decision — existing card internals remain untouched.
- **No internal state**: All selection state comes from props (driven by useBulkSelection hook from S01). This component is a pure controlled component.

### Component API

```typescript
interface SelectableItemProps {
  id: string
  isSelected: boolean
  isSelectionMode: boolean
  onToggle: (id: string) => void
  onLongPress?: (id: string) => void
  itemLabel?: string  // for aria-label on checkbox
  children: React.ReactNode
}
```

### Critical Implementation Details

- **No layout shift**: The wrapper must use `position: relative` only. No added padding/margin/border that would change the child component's visual appearance. The checkbox is absolutely positioned within the relative container.
- **Click interception**: During selection mode, clicks on the item body toggle selection instead of navigating. This requires `event.preventDefault()` + `event.stopPropagation()` on the wrapper's onClick. When NOT in selection mode, the wrapper must be transparent to clicks.
- **Long-press cleanup**: Timer must be cleared in the useEffect cleanup AND on pointer events. Use `useRef` for the timer ID. Memory leak risk if component unmounts during long-press.
- **Haptic feedback**: `navigator.vibrate?.(10)` — optional chaining handles browsers without Vibration API. 10ms is a subtle tap feel.

### Design Token Usage

| Visual | Token | Wrong Alternative |
|--------|-------|-------------------|
| Selected background | `bg-brand-soft/30` | `bg-blue-100` |
| Selected ring | `ring-brand` | `ring-blue-500` |
| Checkbox checked | Handled by shadcn Checkbox | N/A |

### Dependencies

- **E67-S01** (useBulkSelection hook) — provides isSelected, isSelectionMode, toggle
- shadcn `<Checkbox>` component — already available in project
- `useReducedMotion()` — existing hook at `src/hooks/useReducedMotion.ts`

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/components/bulk/SelectableItem.tsx` | Wrapper component |
| `src/app/components/bulk/__tests__/SelectableItem.test.tsx` | Unit tests |

### Files to Reference (read-only)

| File | Why |
|------|-----|
| `src/app/components/ui/checkbox.tsx` | shadcn Checkbox component API |
| `src/hooks/useReducedMotion.ts` | Existing reduced motion hook |
| `src/styles/theme.css` | Design token definitions |

### References

- [Source: _bmad-output/planning-artifacts/epics-bulk-operations.md#Story 67.2]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Selection State Visual Language]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Accessibility]

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] No hardcoded colors — ESLint `design-tokens/no-hardcoded-colors` passes
- [ ] Touch targets >= 44x44px for checkbox
- [ ] `aria-selected` on wrapper, `aria-label` on checkbox
- [ ] No layout shift when wrapping child components
- [ ] Long-press timer cleaned up on unmount
- [ ] Reduced motion support via `useReducedMotion()`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

## Code Review Feedback

## Challenges and Lessons Learned
