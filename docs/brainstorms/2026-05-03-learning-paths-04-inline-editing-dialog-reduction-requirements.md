---
date: 2026-05-03
topic: learning-paths-inline-editing-dialog-reduction
parent: docs/ideation/2026-05-03-learning-paths-creation-ideation.md
---

# Inline Editing & Dialog Reduction — Simplify the Management Surface

## Problem Frame

The learning path management surface uses 4 separate dialogs for basic CRUD operations: `CreatePathDialog` (name + description → create), `RenameDialog` (rename), `EditDescriptionDialog` (description), and `DeleteConfirmDialog` (confirm deletion). Each dialog carries the full overhead of a modal: open/close state, `useEffect` synchronization, separate form submission, focus trapping, and portal rendering. For rename and description edits — which are single-field text changes — this is disproportionate complexity. The `DeleteConfirmDialog` pattern (confirm → delete) is a solved UX problem with a lighter-weight alternative: immediate delete + undo toast.

This idea is the "dialog diet" companion to Idea #1 (Curriculum Composer). Together they reduce the dialog count from 4 to 1 (the `CurriculumComposer` itself).

## Requirements

### Inline Editing on Path Cards

- **R1.** Path name on `PathCardHeader` becomes click-to-edit: clicking the title text replaces it with an `<input>` field pre-filled with the current value. Pressing Enter saves; pressing Escape cancels and reverts. Clicking outside (blur) also saves.
- **R2.** Path description on `PathCardHeader` becomes click-to-edit with the same pattern: click the description text → `<textarea>` (or `<input>` for short descriptions) → Enter to save, Escape to cancel.
- **R3.** During inline editing, the input field must: (a) have a visible focus ring (`ring-2 ring-brand`), (b) match the font size/weight of the original text to avoid layout shift, (c) announce itself to screen readers via `aria-label="Edit path name"`.
- **R4.** Save operations call the existing store methods (`renamePath`, `updatePathDescription`) — no new store methods needed. A brief success indicator (subtle checkmark flash or input border transition to green for 1 second) confirms the save without a toast.

### Inline Editing on Detail Page

- **R5.** The path detail page (`LearningPathDetail.tsx`) header shows the path name and description as inline-editable fields using the same pattern as the path cards. This replaces the current edit buttons that open dialogs.
- **R6.** The path detail header already has action buttons (share, AI reorder, delete). Inline editing must not conflict with these — clicking the title text triggers edit mode; clicking elsewhere in the header does not.

### Delete with Undo Toast

- **R7.** Replace `DeleteConfirmDialog` with immediate deletion: clicking "Delete" on a path card or detail page removes the path from the store immediately and shows a Sonner toast: "Path 'X' deleted. [Undo]". The Undo button restores the path within a 5-second window.
- **R8.** The deleted path is held in a `pendingDeletes` map in the store (not persisted to IndexedDB) for the 5-second undo window. After 5 seconds, the deletion is finalized (removed from Dexie).
- **R9.** If the user navigates away from the page during the 5-second undo window, the undo toast persists (Sonner is global). If the toast expires, the delete is finalized on the next store write.
- **R10.** The delete action on the detail page must navigate back to the path list after deletion (or after the undo window expires, whichever the user chooses).

### Remove Remaining Dialogs

- **R11.** Delete `RenameDialog` component — replaced by R1.
- **R12.** Delete `EditDescriptionDialog` component — replaced by R2.
- **R13.** Delete `DeleteConfirmDialog` component — replaced by R7.
- **R14.** `CreatePathDialog` is replaced by `CurriculumComposer` (Idea #1). The dialog count goes from 4 to 1.

## Success Criteria

- Clicking a path name on the list page or detail page turns it into an editable input with no modal
- Editing a path name and pressing Enter saves and shows a brief visual confirmation (no toast)
- Deleting a path shows an undo toast; clicking Undo restores the path exactly as it was
- The undo toast survives page navigation (Sonner `duration: 5000` + global positioning)
- All 3 replaced dialogs (`RenameDialog`, `EditDescriptionDialog`, `DeleteConfirmDialog`) are deleted from the codebase
- Keyboard: Tab enters edit mode on the name, Enter saves, Escape cancels, Tab moves to description
- Screen readers announce edit mode entry and save/cancel outcomes

## Scope Boundaries

- Only path name and description are inline-editable — course entries within a path are not (those use drag-and-drop + MoveUpDownButtons)
- The `CurriculumComposer` dialog (Idea #1) is out of scope — this idea only covers rename, description edit, and delete
- No changes to how path sharing, AI reorder, or other secondary actions work
- The undo mechanism is local-only (Dexie deferred delete) — no server-side soft-delete or trash folder
- No bulk delete or bulk edit operations

## Key Decisions

- **Blur saves (not cancel):** Clicking outside the input saves the edit. This matches the behavior of notion, linear, and other tools where inline editing is common. Escape is the explicit cancel action.
- **Undo over confirm:** Immediate delete with undo is faster for the happy path (one click vs. two: confirm + delete) and equally safe (undo is available). The 5-second window is short enough that the in-memory hold is trivial but long enough to reverse a mistake.
- **No inline editing for path course entries:** Course entries inside a path have more complex state (progress, position, AI justification). Inline editing those fields would require different save semantics per field. Keep the existing interaction patterns for entries.
- **Sonner for undo, not a custom toast:** Sonner is already in the project and handles global positioning, stacking, and duration. The undo action is a Sonner `action` prop.

## Dependencies / Assumptions

- `useLearningPathStore` supports `renamePath(pathId, name)` and `updatePathDescription(pathId, description)` methods
- `useLearningPathStore` supports `deletePath(pathId)` and `restorePath(pathId, previousState)` or can be extended with a `pendingDeletes` map
- Sonner is installed and configured globally (`<Toaster />` in the app root)
- `PathCardHeader` currently renders name and description as read-only text elements — making them interactive requires minimal markup change
- The detail page header does not have conflicting click handlers on the title area

## Outstanding Questions

### Resolve Before Planning

- None yet — ideation provides sufficient clarity.

### Deferred to Planning

- [Affects R1-R2] Should the inline edit input auto-grow to match the text length, or use a fixed width based on the card/detail layout?
- [Affects R7] What happens if the user deletes a path that is currently being viewed on another tab? (IndexedDB multi-tab — Dexie's `on('changes')` may trigger a refresh.)
- [Affects R8] Should the `pendingDeletes` map be persisted to sessionStorage so the undo survives a page refresh? (Probably not — keep it simple with in-memory only.)
- [Affects R5] Does the detail page header currently use the same `PathCardHeader` component, or does it inline its own name/description rendering? If the latter, inline editing needs to be added in two places or the component needs to be extracted.

## Next Steps

-> Ready for `/ce:plan`. Low complexity, high confidence — good candidate to implement early in the batch, potentially alongside or right after Curriculum Composer since the delete undo pattern is independent.
