---
date: 2026-05-03
topic: learning-paths-curriculum-composer
parent: docs/ideation/2026-05-03-learning-paths-creation-ideation.md
---

# Curriculum Composer — Unified Creation with Inline Course Selection

## Problem Frame

Creating a learning path currently requires three disconnected steps: (1) open `CreatePathDialog`, enter name + description, (2) land on an empty `LearningPathDetail` page, (3) open `CoursePickerDialog` to add courses one at a time. This empty-path dead-end is every new user's first impression of the learning paths feature. The `CoursePickerDialog` modal sits on top of the detail page and must be reopened for each course addition. Four separate state-management surfaces (`CreatePathDialog`, `CoursePickerDialog`, `LearningPathDetail`, `useLearningPathStore`) coordinate through prop drilling and store subscriptions.

## Requirements

### Core: Single-Dialog Creation

- **R1.** Replace `CreatePathDialog` with a `CurriculumComposer` dialog that includes name, description, and an inline multi-select course picker in a single view. The path is never persisted until at least one course is selected — the "Create Path" button remains disabled on an empty selection.
- **R2.** The inline course picker must support: (a) full-text search across imported courses by title/author, (b) multi-select via checkboxes with selected count indicator, (c) AI-ranked "Suggested Next" section that surfaces courses the AI recommends adding to this specific path context.
- **R3.** When the dialog opens, if the user has recently imported courses not yet assigned to any path, those courses appear in a "Recently Imported" section at the top of the picker.
- **R4.** After path creation, redirect to `LearningPathDetail` with the courses already populated — the user sees a populated path immediately, never an empty state.

### Reuse: Inline Picker on Detail Page

- **R5.** Extract the inline course picker as a shared component used by both the `CurriculumComposer` dialog and the `LearningPathDetail` page (replacing the modal `CoursePickerDialog`).
- **R6.** On the detail page, the inline picker can be rendered as a collapsible section ("Add Courses" expandable panel) or as a persistent sidebar panel at `lg:` breakpoint — avoiding a modal entirely for course addition.

### Multi-Select & Batch Operations

- **R7.** Selected courses in the picker support accessible reorder via `MoveUpDownButtons` (already WCAG 2.5.7 compliant) before the path is created.
- **R8.** Batch-add: selecting N courses and confirming adds all N as sequential entries in one operation, rather than N individual add operations.

### Import-from-Path Integration

- **R9.** The inline picker includes an "Import new course" action that opens the import wizard. When the wizard completes, the newly imported course appears selected in the picker. (Coordination point with Idea #7 — Import-from-Path.)

## Success Criteria

- A new user can create a path with 3+ courses without ever seeing an empty path page
- The `CoursePickerDialog` modal component is deleted (replaced by the shared inline picker)
- Creating a path with N courses requires 1 dialog open + 1 confirm action (down from 1 dialog + N modal opens + N confirms)
- The inline picker renders correctly at 375px viewport width (single-column card list)
- Multi-select with 20+ courses does not cause layout shift or scroll jank
- Keyboard: Tab through search → checkbox list → reorder buttons → Create, with visible focus rings throughout

## Scope Boundaries

- No changes to the `useLearningPathStore` data model — `addCourseToPath` and `createPath` remain the underlying operations
- No changes to how courses are rendered inside a path (entry cards, progress rings) — only how they are selected and added
- The `CoursePickerDialog`'s `availableCourses` computation logic (from `useCourseImportStore` + `useAuthorStore`) is preserved, just moved
- No redesign of `LearningPathDetail` layout beyond replacing the modal course picker with the inline variant

## Key Decisions

- **Dialog size:** The `CurriculumComposer` dialog should be `max-w-2xl` (672px) to accommodate search + course list without feeling cramped. On mobile (<640px), it becomes a full-screen sheet.
- **Multi-select vs single-select:** Multi-select with checkboxes is the right UX for initial creation (batch mindset). Single-select + immediate add is better for the ongoing "add one more" flow on the detail page — the shared component must support both modes.
- **AI suggestions in picker:** The "Suggested Next" section calls `suggestPlacement` (existing AI function) with the current partial selection as context, returning ranked suggestions. This is a premium feature but the section renders regardless — non-premium users see a "Upgrade to unlock AI suggestions" placeholder.
- **Empty path prevention:** The "Create Path" button is disabled when no courses are selected. The name field can be auto-filled from the first selected course's topic if left empty.

## Dependencies / Assumptions

- `suggestPlacement` AI function works with a partial course list (not just existing path entries) — needs verification
- The import wizard can accept a `returnTo` parameter to re-focus the picker after import completes (coordination with Idea #7)
- `useCourseImportStore` and `useAuthorStore` are available in the dialog context
- The `MoveUpDownButtons` component handles checkbox-selected items (currently used for ordered lists — needs multi-select adaptation)

## Outstanding Questions

### Resolve Before Planning

- None yet — ideation provides sufficient clarity.

### Deferred to Planning

- [Affects R1] Should the dialog auto-suggest a path name based on selected courses' topics/tags? (e.g., selecting 3 React courses suggests "React Development")
- [Affects R5] For the detail page inline picker: collapsible panel (less layout commitment) or persistent sidebar (always visible, better for frequent addition)?
- [Affects R7] How does multi-select reorder interact with existing path entries? Should new courses be inserted at a specific position or appended?
- [Affects R9] Should the "Import new course" action be a button in the picker footer, an item in the course list, or both?

## Next Steps

-> Ready for `/ce:plan` to produce implementation plan with component breakdown, file changes, and test strategy.
