---
story_id: E66-S01
story_name: "Dragging Movement Alternatives"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 66.1: Dragging Movement Alternatives (WCAG 2.5.7)

## Story

As a user with motor impairments,
I want all drag-and-drop interactions to have single-pointer alternatives,
so that I can reorder items without needing to perform dragging movements.

## Acceptance Criteria

**Given** I am on the Learning Path Detail page with a sortable course list
**When** I look at each course row
**Then** I see "Move Up" and "Move Down" icon buttons alongside the drag handle
**And** each button has an accessible label: "Move [course name] up" / "Move [course name] down"

**Given** a course is the first item in the list
**When** I look at its controls
**Then** the "Move Up" button is disabled with `aria-disabled="true"`

**Given** a course is the last item in the list
**When** I look at its controls
**Then** the "Move Down" button is disabled with `aria-disabled="true"`

**Given** I click the "Move Down" button on a course
**When** the action completes
**Then** the course moves down one position in the list
**And** the list order is persisted
**And** keyboard focus remains on the same course's Move Down button

**Given** I am on the AI Learning Path page with sortable items
**When** I interact with the reorder controls
**Then** the same Move Up/Move Down button pattern is available

**Given** I am on the Video Reorder List (chapter editor)
**When** I interact with chapter items
**Then** Move Up/Move Down buttons are available alongside drag handles

**Given** I am using the Dashboard Customizer
**When** I want to reorder dashboard widgets
**Then** Move Up/Move Down buttons are available for each widget

**Given** I am using the Avatar Crop Dialog
**When** I want to position the crop area
**Then** nudge controls (+/- buttons or arrow inputs) are available for x, y, and zoom
**And** I can position the crop without dragging

## Tasks / Subtasks

- [ ] Task 1: Create reusable `MoveUpDownButtons` component (AC: all)
  - [ ] 1.1 Create `src/app/components/figma/MoveUpDownButtons.tsx` with ChevronUp/ChevronDown icons from lucide-react
  - [ ] 1.2 Accept props: `index`, `total`, `itemLabel`, `onMoveUp`, `onMoveDown`
  - [ ] 1.3 Disable Move Up when `index === 0`, disable Move Down when `index === total - 1`
  - [ ] 1.4 Use `aria-disabled="true"` (not `disabled` attribute) for disabled state — keeps element focusable for screen readers
  - [ ] 1.5 Ensure each button meets 44px minimum touch target (use `min-w-11 min-h-11` with padding)
  - [ ] 1.6 Use `aria-label` format: "Move [itemLabel] up" / "Move [itemLabel] down"

- [ ] Task 2: Add Move Up/Down to `LearningPathDetail.tsx` (AC: 1-4)
  - [ ] 2.1 Import `MoveUpDownButtons` into `SortablePathItem` component (line ~103)
  - [ ] 2.2 Place buttons adjacent to existing `{...listeners}` drag handle
  - [ ] 2.3 Implement `onMoveUp`/`onMoveDown` handlers that call `arrayMove` from `@dnd-kit/sortable` and persist new order
  - [ ] 2.4 Preserve focus on the moved item's button after reorder (use `requestAnimationFrame` + `ref.focus()`)

- [ ] Task 3: Add Move Up/Down to `AILearningPath.tsx` (AC: 5)
  - [ ] 3.1 Import `MoveUpDownButtons` into sortable item component (line ~48)
  - [ ] 3.2 Same pattern as Task 2

- [ ] Task 4: Add Move Up/Down to `VideoReorderList.tsx` (AC: 6)
  - [ ] 4.1 Import `MoveUpDownButtons` into `SortableVideoItem` component (line ~49)
  - [ ] 4.2 Implement reorder handlers

- [ ] Task 5: Add Move Up/Down to `YouTubeChapterEditor.tsx` (AC: 6)
  - [ ] 5.1 Two sortable contexts exist (lines ~586 and ~834) — add buttons to both
  - [ ] 5.2 Implement reorder handlers for chapter items

- [ ] Task 6: Add Move Up/Down to `DashboardCustomizer.tsx` (AC: 7)
  - [ ] 6.1 Import `MoveUpDownButtons` into `SortableWidgetItem` component (line ~59)
  - [ ] 6.2 Implement reorder handlers for widgets

- [ ] Task 7: Avatar Crop Dialog nudge controls (AC: 8)
  - [ ] 7.1 Locate avatar crop component (check for cropper/react-easy-crop usage)
  - [ ] 7.2 Add +/- buttons for X offset, Y offset, and Zoom
  - [ ] 7.3 Each nudge button adjusts by a small increment (e.g., 5px for position, 0.1 for zoom)
  - [ ] 7.4 Accessible labels: "Move crop left", "Move crop right", "Move crop up", "Move crop down", "Zoom in", "Zoom out"

- [ ] Task 8: Unit tests for `MoveUpDownButtons` component
  - [ ] 8.1 Test disabled states at first/last positions
  - [ ] 8.2 Test aria-label includes item name
  - [ ] 8.3 Test click handlers fire correctly

- [ ] Task 9: E2E audit test for drag alternatives
  - [ ] 9.1 Create `tests/e2e/e66-s01-drag-alternatives.spec.ts`
  - [ ] 9.2 Verify all `@dnd-kit/sortable` instances have adjacent Move Up/Down buttons
  - [ ] 9.3 Test reorder via buttons on LearningPathDetail page

## Design Guidance

- **Button style**: Use `variant="ghost"` with `size="icon"` from shadcn Button, matching existing icon button patterns
- **Placement**: Buttons should appear to the left of the drag handle (grip icon), in a vertical stack or horizontal pair
- **Colors**: Use `text-muted-foreground` for default state, `text-muted-foreground/50` for disabled — no hardcoded colors
- **Spacing**: 4px gap between Move Up and Move Down buttons
- **Mobile**: Buttons should be visible by default (not hidden behind overflow menu) since mobile users especially benefit from non-drag alternatives

## Implementation Notes

### Components to modify (all use `@dnd-kit/sortable` + `useSortable`):
1. `src/app/pages/LearningPathDetail.tsx` — SortablePathItem (line ~103)
2. `src/app/pages/AILearningPath.tsx` — sortable item (line ~48)
3. `src/app/components/figma/VideoReorderList.tsx` — SortableVideoItem (line ~49)
4. `src/app/components/figma/YouTubeChapterEditor.tsx` — two sortable contexts (lines ~586, ~834)
5. `src/app/components/DashboardCustomizer.tsx` — SortableWidgetItem (line ~59)

### Pattern for reorder without drag:
```typescript
function handleMoveUp(index: number) {
  const newItems = arrayMove(items, index, index - 1)
  setItems(newItems)
  // Persist and restore focus
  requestAnimationFrame(() => buttonRefs.current[index - 1]?.focus())
}
```

### Existing dependencies (already installed):
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — already in `package.json`
- `lucide-react` — use `ChevronUp` and `ChevronDown` icons

### Do NOT:
- Remove existing drag functionality — buttons are supplemental
- Use hardcoded colors — use design tokens
- Skip focus management after reorder — keyboard users need to track their position

## Testing Notes

- Focus management is the trickiest part — after reorder, the DOM re-renders and refs change
- Test both mouse click and keyboard Enter/Space on the buttons
- Verify `aria-disabled` is used instead of `disabled` for better screen reader experience
- Avatar crop nudge controls may need integration testing with whatever crop library is used

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
