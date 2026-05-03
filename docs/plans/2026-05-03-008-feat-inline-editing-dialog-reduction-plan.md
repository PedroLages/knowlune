---
title: feat: Replace learning-path edit/delete dialogs with inline editing and undo toast
type: feat
status: active
date: 2026-05-03
origin: docs/brainstorms/2026-05-03-learning-paths-04-inline-editing-dialog-reduction-requirements.md
---

# feat: Replace learning-path edit/delete dialogs with inline editing and undo toast

## Overview

Replace the three remaining dialogs on the learning-path management surface -- `RenameDialog`, `EditDescriptionDialog`, and `DeleteConfirmDialog` -- with lighter-weight inline editing and an immediate-delete-plus-undo-toast pattern. This removes ~250 lines of dialog code from `LearningPaths.tsx` and applies the same inline editing treatment to the detail page header. Together with the already-shipped `CurriculumComposer` (which replaced `CreatePathDialog`), this reduces the dialog count from 4 to 1.

## Problem Frame

The learning-path list page currently uses three separate modal dialogs for basic CRUD operations: rename, description edit, and delete confirmation. Each carries modal overhead (open/close state, `useEffect` synchronization, form submission, focus trapping, portal rendering). For single-field text changes and a confirm-delete pattern, this complexity is disproportionate. The requirements doc proposes replacing them with inline editing (click-to-edit on the rendered text) and immediate-delete-plus-undo-toast (Sonner), matching conventions in Notion, Linear, and similar tools.

(see origin: docs/brainstorms/2026-05-03-learning-paths-04-inline-editing-dialog-reduction-requirements.md)

## Requirements Trace

- R1. Path name on path cards becomes click-to-edit with Enter/Escape/Blur handling
- R2. Path description on path cards becomes click-to-edit with the same pattern
- R3. Inline editing inputs need visible focus ring, font matching, and screen-reader announcements
- R4. Save operations call existing store methods (`renamePath`, `updateDescription`); brief visual confirmation (no toast)
- R5. Detail page header name and description become inline-editable using the same pattern
- R6. Inline editing must not conflict with existing action buttons (share, AI reorder, delete) on the detail page
- R7. Replace `DeleteConfirmDialog` with immediate deletion + Sonner undo toast (5-second window)
- R8. Deleted path held in `pendingDeletes` map (in-memory, not persisted) for undo window; finalized after expiry
- R9. Undo toast persists across page navigation (Sonner is global); finalized on next store write if toast expires
- R10. Delete on detail page navigates back to path list after deletion or undo expiry
- R11-R14. Delete the three dialog components (`RenameDialog`, `EditDescriptionDialog`, `DeleteConfirmDialog`); `CreatePathDialog` already replaced by `CurriculumComposer`

## Scope Boundaries

- Only path name and description are inline-editable -- course entries are not (they use drag-and-drop + MoveUpDownButtons)
- The `CurriculumComposer` dialog (Idea #1) is out of scope -- this plan covers rename, description edit, and delete only
- No changes to path sharing, AI reorder, or other secondary actions
- The undo mechanism is local-only (in-memory `pendingDeletes` map, deferred Dexie removal) -- no server-side soft-delete
- No bulk delete or bulk edit operations
- The delete action on the dropdown menu stays; only its behavior changes from confirm-dialog to immediate-delete

## Context & Research

### Relevant Code and Patterns

- **Store**: `src/stores/useLearningPathStore.ts` -- already has `renamePath`, `updateDescription`, `deletePath` with optimistic updates and rollback. The store uses `zustand` with `persistWithRetry` and `syncableWrite` for persistence.
- **Path list page**: `src/app/pages/LearningPaths.tsx` -- defines `RenameDialog`, `EditDescriptionDialog`, `DeleteConfirmDialog` as private components (~250 lines). Contains `PathCard` component that renders name/description as read-only text in `CardContent` and opens dialogs via DropdownMenu items.
- **Path detail page**: `src/app/pages/LearningPathDetail.tsx` -- renders name/description as `<h1>` and `<p>` in its header. Does not use `PathCardHeader` for title/description rendering. Has delete functionality via AI-reorder/share buttons area (currently does not expose a delete action -- this will be added per R10).
- **PathCardHeader**: `src/app/components/figma/PathCardHeader.tsx` -- gradient header only (no title/description rendering). Does not need modification for this feature.
- **Sonner**: Already installed globally via `<Toaster />` in `src/main.tsx`. Used throughout the codebase via `import { toast } from 'sonner'`. Supports `action` prop for undo buttons and `duration` for auto-dismiss.
- **Focus ring pattern**: `ring-2 ring-brand ring-offset-2` convention used across the codebase (see `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md`).
- **Existing store delete pattern**: `deletePath` captures prevState snapshot, applies optimistic removal, persists with `syncableWrite`, and rolls back on failure with `toast.error`.

### Institutional Learnings

- `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md` -- focus ring tokens use additive approach (`ring-2 ring-brand`) rather than replacing `focus:outline-none`
- Store tests in `src/stores/__tests__/useLearningPathStore.test.ts` (780 lines) follow a pattern of loading fixture data into Dexie, calling store methods, and asserting state + DB. The `renamePath`, `updateDescription`, and `deletePath` tests provide templates for the new `deleteWithUndo` / `restorePath` tests.

## Key Technical Decisions

- **`InlineEditableField` as a new shared component** (not inlined in each page): The same click-to-edit pattern is needed in both `PathCard` (list page) and `LearningPathDetail` header. Extracting a reusable component avoids duplication and ensures consistent behavior (focus ring, aria, confirmation flash). Located at `src/app/components/figma/InlineEditableField.tsx`.
- **Blur saves (not cancel)**: matches Notion/Linear behavior. Escape is the explicit cancel action. (see origin: Section "Key Decisions")
- **Undo over confirm**: Immediate delete with Sonner undo toast. The 5-second window is short enough that an in-memory hold is trivial. (see origin: Section "Key Decisions")
- **`pendingDeletes` is in-memory only**: Not persisted to sessionStorage or IndexedDB. If the user refreshes, the undo is lost and the path remains deleted (in-memory state is rebuilt from Dexie on next load). This keeps the implementation simple and avoids split-brain between sessionStorage and Dexie. The requirements doc confirms this is acceptable (see origin: Deferred questions, R8).
- **Store methods: `deletePathWithUndo` and `restorePath`** (new methods, not replacing `deletePath`): The existing `deletePath` is used by `clearPath` and `generatePath` internally. Overloading it with undo logic would risk unintended undo-toast side effects. The new `deletePathWithUndo` wraps `deletePath`'s logic with the pending-deletes timer. The existing `deletePath` is preserved for internal use.
- **No change to `PathCardHeader`**: The component only renders a gradient background and badges. Name/description rendering happens in `PathCard` (list page) and the header div (detail page). Inline editing goes where the text is rendered.
- **Detail page delete navigates back**: After `deletePathWithUndo`, the detail page navigates to `/learning-paths`. The undo toast is global (Sonner) and survives navigation. If the user clicks Undo, `restorePath` puts the path back and the toast dismisses -- the user stays on the list page (path is restored in the grid).

## Open Questions

### Resolved During Planning

- **Should inline edit input auto-grow or use fixed width?** Deferred to implementation. Card-based vs. detail layout naturally dictates: cards use a fixed `w-full` input within the card body; the detail page uses a wider, naturally expanding input. The `InlineEditableField` component accepts a `className` prop for layout control.
- **Should the `pendingDeletes` map be persisted to sessionStorage?** No -- keep it in-memory only (matches requirements doc preference for simplicity).
- **Does the detail page currently use `PathCardHeader` for name/description?** No -- it renders its own `<h1>` and `<p>`. The `InlineEditableField` component is added directly to the detail page header rather than via `PathCardHeader`.

### Deferred to Implementation

- **Multi-tab delete scenario**: If a user deletes a path in Tab A while Tab B is viewing it, Dexie's `on('changes')` will trigger a store reload in Tab B. The exact behavior is deferred to implementation -- it depends on whether the store subscribes to Dexie changes. This is an existing concern, not introduced by this feature.
- **Auto-grow vs. fixed-width for detail page inputs**: The detail page's wider layout may benefit from auto-grow input width. Deferred until the component is tested in context.
- **Exact visual confirmation animation**: The requirements doc specifies "input border transition to green for 1 second." The exact CSS animation (border color transition vs. green checkmark flash) is deferred to implementation for visual testing.

## Implementation Units

### Unit 1: Add `deletePathWithUndo` and `restorePath` to the store

**Goal:** Add the pending-deletes infrastructure to the learning path store so that delete operations can be undone within a 5-second window.

**Requirements:** R7, R8, R9

**Dependencies:** None

**Files:**
- Modify: `src/stores/useLearningPathStore.ts`
- Test: `src/stores/__tests__/useLearningPathStore.test.ts`

**Approach:**
- Add a `pendingDeletes` field to the state interface: `Map<string, { path: LearningPath; entries: LearningPathEntry[]; timer: ReturnType<typeof setTimeout> }>`
- Add `deletePathWithUndo(pathId)`: captures the path and its entries, calls the existing optimistic-remove logic, stores the snapshot in `pendingDeletes`, shows a Sonner toast with `action: { label: 'Undo', onClick: () => restorePath(pathId) }` and `duration: 5000`, and starts a 5-second `setTimeout` that calls `finalizeDelete`.
- Add `restorePath(pathId)`: retrieves the snapshot from `pendingDeletes`, clears the timer, re-inserts path and entries into state, persists via `syncableWrite`, and dismisses the toast.
- Add private `finalizeDelete(pathId)`: persists the Dexie deletions via `syncableWrite` (same logic as current `deletePath`'s persist block), removes from `pendingDeletes`.
- The existing `deletePath` method is preserved unchanged for internal callers (`clearPath`, `generatePath`).

**Patterns to follow:**
- Existing `deletePath` method in `src/stores/useLearningPathStore.ts` (lines 222-268) -- capture prevState, optimistic update, persist with rollback
- Sonner toast with action pattern: `toast('message', { action: { label: 'Undo', onClick: fn }, duration: 5000 })`

**Test scenarios:**
- Happy path: `deletePathWithUndo` removes path from state, shows undo toast, stores in pendingDeletes
- Happy path: `restorePath` re-inserts path + entries into state, dismisses toast, clears pendingDeletes
- Happy path: After 5 seconds, `finalizeDelete` persists deletion to Dexie and removes from pendingDeletes
- Happy path: `deletePathWithUndo` for path with entries -- captures and restores entries alongside path
- Edge case: Calling `deletePathWithUndo` on a non-existent path is a no-op
- Edge case: Calling `restorePath` after the timer has expired is a no-op (path already finalized)
- Edge case: Calling `deletePathWithUndo` on the same path twice before timer expires -- second call is a no-op (path already in pendingDeletes)
- Error path: If `finalizeDelete`'s Dexie write fails, log error and keep pendingDeletes entry (no rollback -- path is already removed from state)
- Integration: Verify the existing `deletePath` (direct delete, no undo) still works for `clearPath` and `generatePath` internal callers

**Verification:**
- Store tests pass for all new methods
- Existing `deletePath` tests continue to pass unchanged

---

### Unit 2: Create `InlineEditableField` component

**Goal:** Create a reusable component for click-to-edit text fields with keyboard support, accessibility, and visual confirmation.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Create: `src/app/components/figma/InlineEditableField.tsx`
- Test: `src/app/components/figma/__tests__/InlineEditableField.test.tsx`

**Approach:**
- Props: `value: string`, `onSave: (value: string) => void`, `as?: 'input' | 'textarea'` (default `'input'`), `className?: string`, `placeholder?: string`, `maxLength?: number`, `ariaLabel?: string`
- Renders as read-only text when not editing; clicking text switches to an `<input>` or `<textarea>`
- Enter saves, Escape cancels, blur saves
- On save: calls `onSave(value)`, shows brief green border flash (add/remove CSS class with 1s duration), exits edit mode
- On cancel: reverts to original value, exits edit mode
- Focus ring: `ring-2 ring-brand ring-offset-2` while editing
- Font matching: inherit font size/weight from parent via `className` prop or default styling
- Screen reader: `aria-label={ariaLabel || 'Edit field'}` on the input element; `role="textbox"` as appropriate
- Internal state: `isEditing`, `draftValue`, `originalValue` (captured on edit start)

**Patterns to follow:**
- shadcn/ui Input component styling (`src/app/components/ui/input.tsx`)
- shadcn/ui Textarea component styling (`src/app/components/ui/textarea.tsx`)
- Focus ring convention: `ring-2 ring-brand ring-offset-2`

**Test scenarios:**
- Happy path: Clicking read-only text enters edit mode with input pre-filled with current value
- Happy path: Typing new text and pressing Enter saves via `onSave` and exits edit mode
- Happy path: Typing new text and blurring saves via `onSave` and exits edit mode
- Happy path: Pressing Escape reverts to original value and exits edit mode without calling `onSave`
- Happy path: Visual confirmation (green border class) appears briefly after successful save
- Happy path: Component renders as `<textarea>` when `as="textarea"` prop is set
- Edge case: Saving with unchanged value still calls `onSave` (no early return -- allows "re-save")
- Edge case: Saving with empty/whitespace-only value still calls `onSave` (validation is caller's responsibility)
- Edge case: Rapidly clicking edit-save-edit sequences correctly (no stale state)
- Accessibility: Input receives auto-focus on edit mode; `aria-label` is applied
- Accessibility: Escape key exits edit mode; Tab key triggers blur/save

**Verification:**
- Component tests pass for all scenarios above
- Component renders correctly in both `input` and `textarea` modes

---

### Unit 3: Update `PathCard` in `LearningPaths.tsx` for inline editing

**Goal:** Replace the rename and description-edit dialog flows with inline editing on the path card text.

**Requirements:** R1, R2, R3, R4, R11, R12

**Dependencies:** Unit 2

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`
- Test: `src/app/pages/__tests__/LearningPaths.test.tsx`

**Approach:**
- Import `InlineEditableField` from `@/app/components/figma/InlineEditableField`
- In `PathCard`, replace the read-only `<h3>` for path name with:
  ```tsx
  <InlineEditableField
    value={path.name}
    onSave={(name) => renamePath(path.id, name)}
    ariaLabel={`Edit path name: ${path.name}`}
    maxLength={100}
  />
  ```
- Replace the read-only `<p>` for path description with:
  ```tsx
  <InlineEditableField
    value={path.description || ''}
    onSave={(desc) => updateDescription(path.id, desc)}
    as="textarea"
    ariaLabel={`Edit path description`}
    placeholder="Add a description..."
    maxLength={500}
  />
  ```
- Remove the "Rename" and "Edit Description" items from the DropdownMenu
- Remove the `Pencil` and `FileText` icon imports if no longer needed
- The `onRename` and `onEditDescription` callback props on `PathCard` are no longer needed -- clean them up from the `PathCard` interface and the parent's rendering

**Patterns to follow:**
- Existing `PathCard` structure in `src/app/pages/LearningPaths.tsx` (lines 264-426)
- Keep the existing Link wrapper around the card content -- the `InlineEditableField` stops click propagation when entering edit mode (it calls `e.stopPropagation()` on the text click to prevent Link navigation)

**Test scenarios:**
- Happy path: Clicking path name text on a card switches to edit mode
- Happy path: Editing path name and pressing Enter saves and shows visual confirmation
- Happy path: Editing path name and pressing Escape reverts
- Happy path: Clicking path description text switches to edit mode (textarea)
- Happy path: Editing description and blurring saves
- Edge case: Clicking the card area outside the title/description navigates to the detail page (Link intact)
- Edge case: The dropdown menu no longer shows "Rename" or "Edit Description" items
- Edge case: Path without description shows placeholder text when editing
- Accessibility: Name input has `aria-label`; description textarea has `aria-label`

**Verification:**
- Page tests pass (updated for inline editing behavior)
- Existing import wizard tests continue to pass
- Dropdown menu still shows "Import Course" and "Delete" items

---

### Unit 4: Update `PathCard` for delete-with-undo

**Goal:** Replace the `DeleteConfirmDialog` flow with immediate deletion and an undo toast.

**Requirements:** R7, R8, R13

**Dependencies:** Unit 1, Unit 3

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`
- Test: `src/app/pages/__tests__/LearningPaths.test.tsx`

**Approach:**
- In `PathCard`'s dropdown menu, change the "Delete" item from `onSelect={() => onDelete(path)}` to direct call: `onSelect={() => deletePathWithUndo(path.id)}`
- Import `deletePathWithUndo` from the store (via selector or `useLearningPathStore.getState()`)
- The undo toast is shown by `deletePathWithUndo` (Unit 1) -- no additional toast handling needed in the page
- Remove the `onDelete` callback prop from `PathCard`
- Remove the `deletePath` state from the parent `LearningPaths` component
- Remove the `DeleteConfirmDialog` JSX rendering from the parent

**Patterns to follow:**
- Sonner toast pattern used elsewhere: `toast.success('...')` or `toast('...', { action: ... })` -- Unit 1 encapsulates this

**Test scenarios:**
- Happy path: Clicking "Delete" in dropdown immediately removes the path card from the grid
- Happy path: An undo toast appears after delete; clicking "Undo" restores the path card
- Happy path: After 5 seconds, the toast dismisses and the delete is finalized
- Edge case: Deleting the only remaining path shows the empty state (existing behavior)
- Edge case: Deleting a path while search filter is active -- path disappears from filtered view; undo restores it
- Regression: The `DeleteConfirmDialog` is no longer rendered in the component tree

**Verification:**
- Page tests pass (updated for undo behavior)
- No `AlertDialog` imports remain in `LearningPaths.tsx` (unless used elsewhere on the page)

---

### Unit 5: Update `LearningPathDetail` header for inline editing and delete

**Goal:** Make the path name and description on the detail page inline-editable, and add a delete action with undo toast that navigates back to the list.

**Requirements:** R5, R6, R10

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`
- Test: `src/app/pages/__tests__/LearningPathDetail.test.tsx`

**Approach:**
- Import `InlineEditableField` from `@/app/components/figma/InlineEditableField`
- Import `useNavigate` from `react-router`
- In the header section (lines 661-698), replace the static `<h1>{path.name}</h1>` with:
  ```tsx
  <InlineEditableField
    value={path.name}
    onSave={(name) => renamePath(path.id, name)}
    ariaLabel={`Edit path name`}
    maxLength={100}
    className="text-4xl md:text-5xl font-extrabold tracking-tight font-display"
  />
  ```
- Replace the static `<p>{path.description}</p>` with an `InlineEditableField` (textarea mode)
- The `InlineEditableField` only triggers edit mode when the text itself is clicked, not the surrounding header area -- this preserves R6 (existing action buttons are not affected)
- Add a delete button in the header's action area (alongside existing share/AI buttons). Clicking it calls `deletePathWithUndo(path.id)` and then `navigate('/learning-paths')`.
- If the detail page is currently viewing a path that gets deleted by undo-timer expiry (5 seconds after navigating away), the `LearningPaths` list page already reflects the deletion. If the user is still on the detail page when the timer expires, the path removal triggers the "Path not found" empty state.

**Execution note:** The detail page header refactoring is primarily a UI integration task. Start with the `InlineEditableField` integration in the header, then add the delete button.

**Patterns to follow:**
- Existing header layout in `src/app/pages/LearningPathDetail.tsx` (lines 662-698)
- Back navigation pattern: `navigate('/learning-paths')`

**Test scenarios:**
- Happy path: Clicking path name on detail page enters edit mode; saving updates the heading text
- Happy path: Clicking path description enters textarea edit mode; saving updates the description
- Edge case: Clicking header area outside the title/description text does not trigger edit mode (action buttons remain clickable)
- Happy path: Clicking delete button removes path and navigates to `/learning-paths`
- Happy path: Undo toast appears after delete; clicking Undo restores the path (user sees it on the list page)
- Edge case: After navigating away, the undo toast is still visible (Sonner global)
- Edge case: If undo timer expires while on list page, path stays deleted

**Verification:**
- Detail page tests pass (updated for inline editing and delete behavior)
- Navigation after delete works correctly

---

### Unit 6: Remove the three dialog components from `LearningPaths.tsx`

**Goal:** Delete the dialog component definitions and clean up unused imports.

**Requirements:** R11, R12, R13, R14

**Dependencies:** Unit 3, Unit 4

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`

**Approach:**
- Delete `RenameDialog` function component (lines 74-140)
- Delete `EditDescriptionDialog` function component (lines 144-211)
- Delete `DeleteConfirmDialog` function component (lines 215-260)
- Remove the three JSX renderings at the bottom of the page (lines 787-807):
  ```tsx
  <RenameDialog ... />
  <EditDescriptionDialog ... />
  <DeleteConfirmDialog ... />
  ```
- Remove the `renamePath`, `editDescPath`, `deletePath` state variables from the parent component
- Remove the `onRename`, `onEditDescription`, `onDelete` callback props from `PathCard` interface and invocations
- Remove unused imports: `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle` from `@/app/components/ui/dialog` (only if `Dialog` is not used elsewhere on the page -- check: the AI Order confirmation dialog on `LearningPathDetail` uses `Dialog`, but that's a different file)
- Remove unused imports: `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` from `@/app/components/ui/alert-dialog`
- Remove unused icon imports: `Pencil`, `FileText` (only if not used elsewhere)
- Remove unused imports: `Input`, `Textarea`, `Label` from `@/app/components/ui/*` (only if not used elsewhere)
- Remove `useEffect` import if no longer needed on the page
- Re-verify: check that the page compiles and all remaining functionality works

**Patterns to follow:**
- Clean import removal: check each import's usage across the file before removing

**Test scenarios:**
- Test expectation: none -- this is a removal-only unit. Verification is through compilation and existing tests continuing to pass.

**Verification:**
- `npm run build` passes with no errors
- `npm run lint` passes with no errors
- All existing `LearningPaths` tests pass
- Grep for `RenameDialog`, `EditDescriptionDialog`, `DeleteConfirmDialog` returns no results in `src/`

---

### Unit 7: Update tests for inline editing and undo behavior

**Goal:** Update existing page tests to reflect the new UI behavior and add coverage for inline editing and delete-with-undo flows.

**Requirements:** R1-R10 (validation coverage)

**Dependencies:** Units 3, 4, 5, 6

**Files:**
- Modify: `src/app/pages/__tests__/LearningPaths.test.tsx`
- Modify: `src/app/pages/__tests__/LearningPathDetail.test.tsx`
- Modify: `src/stores/__tests__/useLearningPathStore.test.ts`

**Approach:**
- Store tests (Unit 1 covers the new `deletePathWithUndo` / `restorePath` tests):
  - Add tests for timer behavior: use `vi.useFakeTimers()` to control the 5-second window
  - Verify pendingDeletes map state before and after operations
- Page tests (`LearningPaths.test.tsx`):
  - Update mock to include `deletePathWithUndo` and `restorePath` in mockLearningPathState
  - Remove tests that verify dialog behavior (dialog rendering, dialog form submission)
  - Add tests for inline editing: clicking name text, typing, pressing Enter
  - Add tests for delete-with-undo: clicking delete in dropdown, verifying undo callback
  - Add tests for keyboard behavior: Escape to cancel edit
- Detail page tests (`LearningPathDetail.test.tsx`):
  - Add tests for inline editing on the detail page header
  - Add test for delete button with navigation

**Execution note:** Update tests alongside implementation. Store tests can be written test-first for `deletePathWithUndo`/`restorePath` (Unit 1). Page tests should be updated after UI changes land (Units 3-5).

**Patterns to follow:**
- Existing test patterns in `src/app/pages/__tests__/LearningPaths.test.tsx` -- mocked store, `userEvent`, `MemoryRouter`
- Mock Sonner toast: `vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))` -- update mock to include the base `toast` function with `action` support

**Test scenarios:**
- Store: `deletePathWithUndo` removes from state and queues pendingDelete
- Store: `restorePath` reinserts and clears pendingDelete
- Store: Timer expiry calls finalizeDelete and persists to Dexie
- Page (list): Clicking path name enters edit mode; pressing Enter saves
- Page (list): Clicking path name; pressing Escape reverts
- Page (list): Clicking "Delete" in dropdown immediately removes card
- Page (list): Undo toast appears with correct path name
- Page (detail): Inline editing on name/description in header
- Page (detail): Delete button navigates to /learning-paths

**Verification:**
- All new and updated tests pass
- Test coverage does not regress for the learning-path pages and store

## System-Wide Impact

- **Interaction graph:** The `PathCard` dropdown menu loses two items (Rename, Edit Description) and one item changes behavior (Delete -- from confirm-dialog to immediate). The `LearningPathDetail` header gains inline editing and a delete button. No other components affected.
- **Error propagation:** Store errors (failed Dexie writes) are already handled with rollback + `toast.error`. The new `deletePathWithUndo` follows the same pattern. If `finalizeDelete` fails, the path remains visually deleted but not persisted -- on next load it reappears from Dexie. This is acceptable for an edge case (Dexie write failures are rare).
- **State lifecycle risks:** The `pendingDeletes` map holds path+entries in memory. If a user deletes hundreds of paths rapidly (extremely unlikely), memory grows. The 5-second timer naturally bounds this. No persistence risk -- if the app crashes, pending deletes are lost and paths remain in Dexie (deletion never finalized).
- **API surface parity:** The store gains two new public methods (`deletePathWithUndo`, `restorePath`) and one new state field (`pendingDeletes`). The existing `deletePath` is preserved for internal use. No other store consumers need changes.
- **Integration coverage:** The undo toast is global (Sonner) and survives page navigation. This is critical -- verify that clicking Undo on the list page after navigating away from the detail page correctly restores the path.
- **Unchanged invariants:** `renamePath` and `updateDescription` store methods are unchanged -- they are called from the new `InlineEditableField` instead of from dialog form submissions. `deletePath` is unchanged for internal callers. The `PathCardHeader` component is untouched. Course entry interactions (drag-and-drop, reorder, remove) are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `InlineEditableField` click handling conflicts with the `<Link>` wrapper around path cards | The component calls `e.stopPropagation()` on the text click to prevent navigation. Tested in Unit 3. |
| Undo timer fires after component unmount (e.g., navigating away from detail page) | The timer callback checks `get().pendingDeletes` before finalizing. If the user already clicked Undo (clearing the entry), it's a no-op. |
| Sonner toast `action.onClick` captures stale closure over `restorePath` | The `restorePath` call is made via `useLearningPathStore.getState().restorePath(pathId)` inside the onClick, avoiding closure issues. |
| Removing `Dialog`/`AlertDialog` imports breaks other parts of the page | Reviewed: `LearningPaths.tsx` does not use `Dialog` or `AlertDialog` outside the three removed dialogs. `LearningPathDetail.tsx` uses `Dialog` for the AI Order confirmation (not affected). |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-03-learning-paths-04-inline-editing-dialog-reduction-requirements.md](docs/brainstorms/2026-05-03-learning-paths-04-inline-editing-dialog-reduction-requirements.md)
- Related code: `src/stores/useLearningPathStore.ts` (lines 150-268 -- renamePath, updateDescription, deletePath)
- Related code: `src/app/pages/LearningPaths.tsx` (lines 74-260 -- dialog components; lines 264-426 -- PathCard)
- Related code: `src/app/pages/LearningPathDetail.tsx` (lines 266-1201 -- full page)
- Related code: `src/app/components/figma/PathCardHeader.tsx` (gradient header -- no changes needed)
- Sonner docs: https://sonner.emilkowal.ski/
