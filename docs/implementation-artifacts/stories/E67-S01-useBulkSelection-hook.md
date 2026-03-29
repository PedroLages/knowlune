---
story_id: E67-S01
story_name: "Create useBulkSelection Hook"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 67.1: Create useBulkSelection Hook

Status: ready-for-dev

## Story

As a developer,
I want a reusable useBulkSelection hook that manages selection state with Set-based ID tracking,
so that any list page can add multi-select capability with consistent behavior.

## Acceptance Criteria

**Given** the hook is initialized with no arguments
**When** the component mounts
**Then** selectedIds is an empty Set, isSelectionMode is false, and selectedCount is 0

**Given** a user toggles an item ID that is not selected
**When** toggle(id) is called
**Then** the ID is added to selectedIds, isSelectionMode becomes true, and selectedCount increments by 1

**Given** a user toggles an item ID that is already selected
**When** toggle(id) is called
**Then** the ID is removed from selectedIds and selectedCount decrements by 1

**Given** a user toggles the last selected item
**When** toggle(id) is called and selectedIds becomes empty
**Then** isSelectionMode becomes false

**Given** a list of visible item IDs ["a", "b", "c"]
**When** selectAll(["a", "b", "c"]) is called
**Then** selectedIds contains all three IDs and selectedCount is 3

**Given** items are selected
**When** clearSelection() is called
**Then** selectedIds is empty, isSelectionMode is false, and selectedCount is 0

**Given** the hook is active on a page
**When** the component unmounts (user navigates away)
**Then** selection state is discarded (no persistence)

**Given** the hook returns isSelected(id) function
**When** called with a selected ID
**Then** it returns true in O(1) time

## Tasks / Subtasks

- [ ] Task 1: Create hook file with core selection state (AC: 1, 2, 3, 4)
  - [ ] 1.1 Create `src/hooks/useBulkSelection.ts`
  - [ ] 1.2 Implement `useState<Set<string>>` with immutable Set updates (new Set on each mutation)
  - [ ] 1.3 Derive `isSelectionMode` from `selectedIds.size > 0`
  - [ ] 1.4 Derive `selectedCount` from `selectedIds.size`
  - [ ] 1.5 Implement `toggle(id)` — adds if absent, removes if present, always creates new Set
  - [ ] 1.6 Implement `isSelected(id)` — returns `selectedIds.has(id)` (O(1))
  - [ ] 1.7 Wrap all returned functions in `useCallback` for stable references

- [ ] Task 2: Implement selectAll and clearSelection (AC: 5, 6)
  - [ ] 2.1 Implement `selectAll(visibleIds: string[])` — creates new Set from array
  - [ ] 2.2 Implement `clearSelection()` — sets state to empty Set

- [ ] Task 3: Implement keyboard shortcut registration (AC: 5, 6, 8)
  - [ ] 3.1 Accept optional `containerRef: RefObject<HTMLElement>` parameter
  - [ ] 3.2 Add `useEffect` keydown listener on container (or document if no ref)
  - [ ] 3.3 Handle `Cmd+A` / `Ctrl+A` — call `selectAll` with provided `visibleIds` callback, `preventDefault` to block browser select-all
  - [ ] 3.4 Handle `Escape` — call `clearSelection()`
  - [ ] 3.5 Handle `Delete` / `Backspace` — invoke `onDeleteRequest` callback prop if provided
  - [ ] 3.6 Only register shortcuts when `isSelectionMode` is true (except initial checkbox click which uses toggle directly)

- [ ] Task 4: Implement unmount cleanup (AC: 7)
  - [ ] 4.1 Selection state lives in component useState — automatically discarded on unmount
  - [ ] 4.2 Verify no refs or side effects leak (keyboard listener cleanup in useEffect return)

- [ ] Task 5: Write unit tests (all ACs)
  - [ ] 5.1 Create `src/hooks/__tests__/useBulkSelection.test.ts`
  - [ ] 5.2 Test initial state (empty Set, isSelectionMode false, count 0)
  - [ ] 5.3 Test toggle add/remove cycle
  - [ ] 5.4 Test isSelectionMode transitions (true when items selected, false when last removed)
  - [ ] 5.5 Test selectAll with array of IDs
  - [ ] 5.6 Test clearSelection resets everything
  - [ ] 5.7 Test isSelected returns correct boolean
  - [ ] 5.8 Use `renderHook` from `@testing-library/react` and `act` for state updates

## Dev Notes

### Architecture

- **Pure React hook** — no Zustand store. Selection is ephemeral UI state scoped per page (unmount clears it).
- This is the foundational hook for the entire E67 bulk operations epic. S02-S08 all depend on this.
- Returns a stable API contract that all integration stories (S06, S07, S08) consume.

### Hook Interface

```typescript
interface UseBulkSelectionOptions {
  containerRef?: RefObject<HTMLElement>
  onDeleteRequest?: () => void
  getVisibleIds?: () => string[]
}

interface UseBulkSelectionReturn {
  selectedIds: Set<string>
  isSelectionMode: boolean
  selectedCount: number
  toggle: (id: string) => void
  selectAll: (visibleIds: string[]) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
}
```

### Critical Implementation Details

- **Immutable Set updates**: Always `new Set(prev)` before `.add()` or `.delete()` — React won't re-render if same reference returned
- **useCallback stability**: All returned functions must be memoized to prevent unnecessary child re-renders in SelectableItem wrappers
- `isSelectionMode` is derived, not stored separately — avoids sync bugs between count and mode flag
- `selectedCount` is derived from `selectedIds.size` — no separate counter state

### Keyboard Shortcut Behavior

- `Cmd+A`: Must `event.preventDefault()` to block browser text selection. Only intercept when container has or contains focus.
- `Escape`: Clears selection. If nothing selected, no-op.
- `Delete/Backspace`: Only fires `onDeleteRequest` if items are selected. Does NOT perform deletion directly — that's S04's responsibility.

### Project Patterns to Follow

- **IDs**: Use `string` type (project uses `crypto.randomUUID()` — see `docs/project-context.md`)
- **No Zustand**: Zustand is for persistent/shared state. Selection is page-scoped ephemeral state — React useState is correct.
- **Testing**: Use Vitest + `@testing-library/react` `renderHook`. See existing hook tests pattern.

### Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useBulkSelection.ts` | The hook |
| `src/hooks/__tests__/useBulkSelection.test.ts` | Unit tests |

### Files to Reference (read-only)

| File | Why |
|------|-----|
| `docs/project-context.md` | ID format, Zustand selector rules |
| `src/hooks/useReducedMotion.ts` | Existing custom hook pattern reference |

### References

- [Source: _bmad-output/planning-artifacts/epics-bulk-operations.md#Story 67.1]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#State Management]
- [Source: docs/project-context.md#IDs and Dates]

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (keyboard listener removal)
- [ ] All returned functions wrapped in useCallback
- [ ] Set updates are immutable (new Set on every mutation)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

## Code Review Feedback

## Challenges and Lessons Learned
