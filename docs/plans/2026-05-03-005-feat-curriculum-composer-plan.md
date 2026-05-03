---
title: feat: Curriculum Composer — Unified Creation with Inline Course Selection
type: feat
status: active
date: 2026-05-03
origin: docs/brainstorms/2026-05-03-learning-paths-01-curriculum-composer-requirements.md
---

# feat: Curriculum Composer — Unified Creation with Inline Course Selection

## Overview

Replace the two-dialog path-creation flow (`CreatePathDialog` then `CoursePickerDialog`) with a single `CurriculumComposer` dialog that includes name, description, and an inline multi-select course picker. Extract the inline picker as a shared component used by both the composer and the detail page (replacing the modal `CoursePickerDialog`). Add batch-add, multi-select reorder, "Recently Imported", and AI "Suggested Next" sections.

## Problem Frame

Creating a learning path currently requires: (1) open `CreatePathDialog` for name + description, (2) land on an empty `LearningPathDetail` page, (3) open `CoursePickerDialog` repeatedly to add courses one at a time. This empty-path dead-end is every new user's first impression. The picker dialog sits on top of the detail page and must be reopened for each course addition. Four state-management surfaces coordinate through prop drilling and store subscriptions.

(see origin: docs/brainstorms/2026-05-03-learning-paths-01-curriculum-composer-requirements.md)

## Requirements Trace

- **R1.** Replace `CreatePathDialog` with a `CurriculumComposer` dialog that includes name, description, and an inline multi-select course picker in a single view. "Create Path" disabled until at least one course is selected.
- **R2.** Inline course picker supports: (a) full-text search by title/author, (b) multi-select via checkboxes with selected count, (c) AI-ranked "Suggested Next" section.
- **R3.** Courses not yet assigned to any path appear in a "Recently Imported" section at the top of the picker.
- **R4.** After creation, redirect to `LearningPathDetail` with courses already populated.
- **R5.** Inline course picker is a shared component used by both `CurriculumComposer` and `LearningPathDetail`.
- **R6.** On the detail page, the inline picker renders as a collapsible panel (not a modal).
- **R7.** Selected courses support accessible reorder via `MoveUpDownButtons` before creation.
- **R8.** Batch-add: selecting N courses adds all N as sequential entries in one operation.
- **R9.** Inline picker includes an "Import new course" action that opens the import wizard.

## Scope Boundaries

- No changes to the `useLearningPathStore` data model — `addCourseToPath` remains the underlying per-entry operation, but a new `batchAddCoursesToPath` method is added for atomic batch creation.
- No changes to how courses are rendered inside a path (entry cards, progress rings) — only how they are selected and added.
- The `CoursePickerDialog`'s `availableCourses` computation logic is preserved and moved into the shared `InlineCoursePicker`.
- No redesign of `LearningPathDetail` layout beyond replacing the modal course picker with the collapsible inline variant.
- The auto-name-suggestion feature (deferred to planning) is implemented as a lightweight enhancement: the name field auto-populates from the first selected course's tags if left empty.

### Deferred to Separate Tasks

- Persistent sidebar variant (`lg:` breakpoint) for the detail page inline picker — could be explored in a future iteration. Collapsible panel is the initial implementation.

## Context & Research

### Relevant Code and Patterns

- `CreatePathDialog` — inline in `src/app/pages/LearningPaths.tsx` (lines 75-160): simple name + description form dialog
- `CoursePickerDialog` — inline in `src/app/pages/LearningPathDetail.tsx` (lines 273-444): search + single-course-add modal with `availableCourses` computation (lines 299-328)
- `MoveUpDownButtons` — `src/app/components/figma/MoveUpDownButtons.tsx`: accessible reorder buttons (WCAG 2.5.7 compliant)
- `useLearningPathStore` — `src/stores/useLearningPathStore.ts`: `createPath`, `addCourseToPath`, `removeCourseFromPath`, `reorderCourse`
- `useCourseImportStore` — `src/stores/useCourseImportStore.ts`: `importedCourses`, `thumbnailUrls`, `loadImportedCourses`
- `useAuthorStore` — `src/stores/useAuthorStore.ts`: `authors`
- `ImportWizardDialog` — `src/app/components/figma/ImportWizardDialog.tsx`: uses window events (`IMPORT_WIZARD_SET_TARGET`) for singleton coordination
- `suggestPathPlacement` — `src/ai/learningPath/suggestPlacement.ts`: existing AI function for placing a single course into a path
- `usePathPlacementSuggestion` — `src/ai/hooks/usePathPlacementSuggestion.ts`: existing hook wrapping `suggestPathPlacement`
- Tests: `src/app/pages/__tests__/LearningPaths.test.tsx`, `src/app/pages/__tests__/LearningPathDetail.test.tsx`, `src/stores/__tests__/useLearningPathStore.test.ts`
- Figma components pattern: extracted components live in `src/app/components/figma/` (e.g., `ImportWizardDialog`, `MoveUpDownButtons`, `PathProgressRing`)

### Institutional Learnings

- `docs/solutions/` singleton dialog pattern: `ImportWizardDialog` uses custom events (`IMPORT_WIZARD_SET_TARGET`) to avoid mount/unmount issues with the singleton wizard — follow the same pattern for "Import new course" coordination.
- Optimistic updates with rollback are the standard pattern in `useLearningPathStore` — `batchAddCoursesToPath` should follow the same `syncableWrite` + rollback approach.
- Catalog courses table was dropped (E89-S01) — the `availableCourses` computation only uses imported courses now.

## Key Technical Decisions

- **New `suggestNextCourses` AI function** (not reusing `suggestPlacement`): Calling `suggestPlacement` N times (once per unselected course) would be expensive and race-condition-prone. A single AI call that takes the partial selection context + all unselected courses and returns a ranked list is more efficient. The requirements doc's assumption about `suggestPlacement` working with partial lists needs this adaptation.
- **Collapsible panel over sidebar** for the detail page inline picker: Less layout disruption, consistent with the detail page's existing single-column content area. A persistent sidebar can be explored separately.
- **Batch-add via new `batchAddCoursesToPath` store method**: Creating a path + adding N courses should be atomic. The new method creates the path first, then bulk-adds all entries in sequence, with a full rollback on failure.
- **Multi-select mode toggle**: The shared `InlineCoursePicker` supports two modes — `multiSelect` (for composer, with checkboxes + selected count + reorder) and `singleSelect` (for detail page, replacing the current single-click-add pattern).
- **Auto-name suggestion**: If the name field is empty when courses are selected, auto-populate by scanning the first selected course's `tags` for a topic-like tag (a single word with semantic weight, not a format tag like "video" or "pdf") and appending " Development" or " Fundamentals". Falls back to the course name without its first word. This is a lightweight heuristic, not AI-driven.
- **"Recently Imported" detection**: Courses in `useCourseImportStore.importedCourses` where `course.id` does not appear in any `useLearningPathStore.entries[i].courseId`. Computed via `useMemo` in the picker component.

## Implementation Units

- [ ] **Unit 1: Add `batchAddCoursesToPath` to store**

**Goal:** Add an atomic batch-add method that creates a path and adds N courses in one operation.

**Requirements:** R1, R4, R8

**Dependencies:** None

**Files:**
- Modify: `src/stores/useLearningPathStore.ts`
- Test: `src/stores/__tests__/useLearningPathStore.test.ts`

**Approach:**
- Add `batchAddCoursesToPath(pathId: string, courses: Array<{courseId: string, courseType: 'imported' | 'catalog'}>)`: calls `addCourseToPath` for each course sequentially using `persistWithRetry`, with a single rollback scope that removes all entries on any failure.
- Also add `createPathWithCourses(name: string, description: string | undefined, courses: Array<{courseId: string, courseType: 'imported' | 'catalog'}>)`: creates the path, then batch-adds all courses, returns the new path ID. Full rollback on failure (delete path + all added entries).
- Follow the optimistic update + rollback pattern used by existing methods in the store.
- The `createPathWithCourses` method is the primary API used by `CurriculumComposer`.

**Patterns to follow:**
- `createPath` (lines 99-137): optimistic update, `syncableWrite`, rollback
- `addCourseToPath` (lines 266-319): position calculation, duplicate prevention, `syncableWrite`

**Test scenarios:**
- Happy path: `createPathWithCourses` creates path, adds all courses, returns path ID
- Happy path: entries are created with correct sequential positions
- Edge case: calling with empty courses array still creates the path (graceful degradation)
- Edge case: duplicate course ID in the input is skipped gracefully
- Error path: `syncableWrite` failure rolls back both path and all entries
- Error path: partial failure (some courses added, one fails) rolls back all

**Verification:**
- All existing tests pass
- New store methods work with existing `syncableWrite` infrastructure

---

- [ ] **Unit 2: Create shared `InlineCoursePicker` component**

**Goal:** Extract the course list + search + selection UI as a reusable component.

**Requirements:** R2, R3, R5, R7, R9

**Dependencies:** Unit 1 (for understanding store API, but not strongly coupled)

**Files:**
- Create: `src/app/components/figma/InlineCoursePicker.tsx`
- Create: `src/app/components/figma/__tests__/InlineCoursePicker.test.tsx`

**Approach:**
- Extract the `availableCourses` computation from `CoursePickerDialog` (lines 299-328 of `LearningPathDetail.tsx`) into the new component.
- Accept props:
  - `mode: 'multiSelect' | 'singleSelect'`
  - `excludeCourseIds: Set<string>` — courses already in the path
  - `onAdd: (courses: Array<{courseId: string, courseType: 'imported' | 'catalog'}>) => void` — called on confirm
  - `selectedCourseIds: string[]` / `onSelectionChange: (ids: string[]) => void` — controlled multi-select state
  - `showRecentlyImported?: boolean` — show the Recently Imported section
  - `showSuggestedNext?: boolean` — show the AI Suggested Next section
  - `showImportAction?: boolean` — show the "Import new course" button
  - `onImportCourse?: () => void` — handler for import action
- Multi-select mode:
  - Checkboxes next to each course row
  - Selected count indicator ("N courses selected")
  - Confirm/Add button below the list
  - After confirm, call `onAdd` with all selected courses
  - `MoveUpDownButtons` for reordering selected items
- Single-select mode:
  - Click/Add button per course row (current behavior)
  - Immediate add on click
- Sections within the picker list:
  1. "Recently Imported" (top) — courses not assigned to any path
  2. "Suggested Next" (optional, premium-gated) — AI-ranked suggestions
  3. All available courses (filtered by search)
- Search bar at top: filters all sections by course name/author
- "Import new course" action button in the footer
- Responsive: single-column card list at all viewports; 375px tested

**Patterns to follow:**
- `CoursePickerDialog` in `LearningPathDetail.tsx` for the search + course row layout
- `MoveUpDownButtons` integration follows the pattern in `SortableCourseRow` (same file)
- ImportWizardDialog coordination pattern for the import action

**Test scenarios:**
- Happy path: multi-select mode renders checkboxes, selecting courses updates count
- Happy path: single-select mode renders "Add" buttons per course
- Happy path: search filters courses by name and author
- Happy path: confirmed multi-select calls `onAdd` with all selected course IDs in order
- Edge case: search with no results shows empty state message
- Edge case: all courses excluded shows "All courses are already in this path"
- Edge case: Recently Imported section shows only unassigned courses
- Edge case: reorder buttons are disabled at list boundaries (first/last)
- Integration: "Import new course" action renders when `showImportAction` and `onImportCourse` are provided
- Accessibility: Tab through search -> checkbox list -> reorder buttons -> confirm with visible focus rings
- Accessibility: selected count announcement via `aria-live="polite"`

**Verification:**
- Component renders in both modes
- All existing `CoursePickerDialog` functionality is preserved

---

- [ ] **Unit 3: Create `CurriculumComposer` dialog**

**Goal:** Replace `CreatePathDialog` with a single dialog that includes name, description, and inline multi-select course picker.

**Requirements:** R1, R2, R3, R4, R7, R8

**Dependencies:** Unit 1 (store `createPathWithCourses`), Unit 2 (shared `InlineCoursePicker`)

**Files:**
- Create: `src/app/components/figma/CurriculumComposer.tsx`
- Create: `src/app/components/figma/__tests__/CurriculumComposer.test.tsx`

**Approach:**
- Dialog size: `max-w-2xl` (672px), full-screen sheet on mobile (<640px)
- Layout:
  - Top: name input (auto-focused)
  - Below name: description textarea (optional)
  - Below description: `InlineCoursePicker` in `multiSelect` mode
  - Footer: Cancel + "Create Path" button
- "Create Path" button is disabled until at least one course is selected
- Name auto-suggestion: if name is empty when courses are selected, populate from the first selected course's tags (e.g., selecting a course tagged "React" suggests "React Fundamentals"). Scans `tags` for a topic-like tag and appends " Development" or " Fundamentals". Falls back to the course name without its first word. This is a heuristic — not AI-driven.
- On submit:
  1. Call `useLearningPathStore.createPathWithCourses(name, description, selectedCourses)`
  2. On success: close dialog, navigate to `/learning-paths/{newPathId}`
  3. On failure: show toast error, keep dialog open
- After creation, courses are already in the path — user never sees empty state
- ImportWizardDialog coordination: InlineCoursePicker's "Import new course" action opens the import wizard; on completion, refresh the imported courses list and select the newly imported course

**Patterns to follow:**
- `CreatePathDialog` for the form layout pattern (lines 75-160 of `LearningPaths.tsx`)
- `ImportWizardDialog` coordination pattern (window events, `isImportWizardOpen`)

**Test scenarios:**
- Happy path: select 3 courses, fill name+desc, click Create Path -> path created with courses, navigates to detail page
- Happy path: Create Path button is disabled when no courses selected
- Happy path: auto-name suggestion populates from first selected course's topic
- Edge case: creating with 1 course creates a single-entry path
- Edge case: creating with 20+ courses works without layout shift
- Edge case: form validation prevents empty name submission (use auto-suggested name as fallback)
- Error path: store failure shows toast, dialog stays open
- Accessibility: Tab through name -> description -> search -> course list -> confirm with visible focus rings
- Accessibility: full-screen sheet on mobile (<640px) is closable via swipe down or Escape

**Verification:**
- A new user can create a path with 3+ courses without ever seeing an empty path page
- Creating a path with N courses requires 1 dialog open + 1 confirm action
- CoursePickerDialog is never opened during the flow

---

- [ ] **Unit 4: Integrate `InlineCoursePicker` into `LearningPathDetail`**

**Goal:** Replace the modal `CoursePickerDialog` with the shared `InlineCoursePicker` as a collapsible panel.

**Requirements:** R5, R6

**Dependencies:** Unit 2 (shared `InlineCoursePicker`)

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`
- Modify: `src/app/pages/__tests__/LearningPathDetail.test.tsx`

**Approach:**
- Replace the `<CoursePickerDialog>` element at line 1225 with an inline `Collapsible` section containing the `InlineCoursePicker` in `singleSelect` mode.
- The collapsible panel is positioned in the right sidebar (`aside`, line 1099), replacing the current "Add Course" button's action.
- "Add Course" button (line 1102) toggles the collapsible panel open.
- On course add: call `addCourseToPath` directly (single-select immediate add).
- Remove the inline `CoursePickerDialog` function definition (lines 273-444).
- Remove the `CoursePickerDialog` import and usage.

**Patterns to follow:**
- Existing `Collapsible` usage in the detail page (line 239, gap entries section)
- The sidebar "Coming Up Next" card layout for the collapsible panel

**Test scenarios:**
- Happy path: clicking "Add Course" opens the collapsible panel, showing the InlineCoursePicker
- Happy path: selecting a course in single-select mode adds it to the path immediately
- Happy path: the panel collapses after adding a course (or has an explicit "Done" button)
- Edge case: no available courses shows "All courses are already in this path" message
- Regression: detail page layout is preserved (trail map, hero, completed courses, coming up next, suggest order)
- Accessibility: collapsible panel trigger has proper `aria-expanded` and `aria-controls`

**Verification:**
- `CoursePickerDialog` function definition is deleted from `LearningPathDetail.tsx`
- All existing detail page tests pass (updated to account for collapsible panel)

---

- [ ] **Unit 5: Integrate `CurriculumComposer` into `LearningPaths` page**

**Goal:** Replace the inline `CreatePathDialog` with `CurriculumComposer` on the learning paths listing page.

**Requirements:** R1, R4

**Dependencies:** Unit 3 (`CurriculumComposer`)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`
- Modify: `src/app/pages/__tests__/LearningPaths.test.tsx`

**Approach:**
- Import and replace `<CreatePathDialog>` with `<CurriculumComposer>` at line 890.
- Remove the inline `CreatePathDialog` function definition (lines 75-160).
- The "Create Path" button (line 747) remains the trigger for the composer dialog.
- `CurriculumComposer` handles the full flow including navigation to the new detail page.

**Patterns to follow:**
- The dialog trigger pattern in `LearningPaths.tsx` (line 747: `onClick={() => setCreateDialogOpen(true)}`)

**Test scenarios:**
- Happy path: clicking "Create Path" opens the CurriculumComposer dialog
- Regression: empty state with no paths still renders the "Create Path" empty state button
- Regression: the LearningPaths page renders all existing path cards correctly
- Edge case: composer dialog does not affect path card rendering below the dialog backdrop
- Accessibility: dialog traps focus while open

**Verification:**
- `CreatePathDialog` function definition is deleted from `LearningPaths.tsx`
- All existing LearningPaths tests pass (updated)

---

- [ ] **Unit 6: AI "Suggested Next" section implementation**

**Goal:** Add the AI-ranked "Suggested Next" section to the `InlineCoursePicker`.

**Requirements:** R2(c)

**Dependencies:** Unit 2 (`InlineCoursePicker`)

**Files:**
- Create: `src/ai/learningPath/suggestNextCourses.ts`
- Create: `src/ai/learningPath/__tests__/suggestNextCourses.test.ts`
- Modify: `src/app/components/figma/InlineCoursePicker.tsx`

**Approach:**
- Create `suggestNextCourses(context: SuggestNextContext)` function:
  - Input: partial selection of course IDs + all available courses (with names, tags, descriptions)
  - Output: ranked list of suggested course IDs with justifications
  - Uses the same AI provider pattern as `suggestPathPlacement` (API key, config, temperature 0.3)
  - Single API call, returns top 3-5 suggestions
- The "Suggested Next" section in `InlineCoursePicker`:
  - Renders only when `showSuggestedNext` is true and courses are selected
  - Premium check: call `isPathPlacementAvailable()` as gate — if false, show "Upgrade to unlock AI suggestions" placeholder
  - Debounce the AI call: trigger 500ms after the selection changes
  - Cache the result per selection set to avoid redundant calls
  - Results show course name + thumbnail + brief justification
  - Checkboxes on suggestions (they're part of the main selection set)
- Mock injection: follow the same `window.__mockPathPlacementResponse` pattern from `suggestPathPlacement` for testability

**Patterns to follow:**
- `suggestPathPlacement` (`src/ai/learningPath/suggestPlacement.ts`) for the AI call pattern (provider config, API key, timeout, JSON parsing)
- `usePathPlacementSuggestion` hook for the debounce + loading state pattern

**Test scenarios:**
- Happy path: with valid API key and selection, returns ranked suggestions
- Happy path: suggestions show checkboxes and are selectable
- Edge case: empty selection returns no suggestions (do not call AI)
- Edge case: all courses already selected returns empty suggestions
- Edge case: AI provider error shows graceful fallback (hide the section, not an error toast)
- Edge case: premium user without API key shows "Upgrade" placeholder
- Edge case: debounce prevents rapid-fire API calls on fast checkbox toggling
- Integration: selecting a suggested course updates the selection count
- Integration: suggested section disappears when all courses are selected

**Verification:**
- New `suggestNextCourses` function is testable in isolation
- `InlineCoursePicker` renders suggestions or placeholder based on premium status

---

- [ ] **Unit 7: Cleanup and polish**

**Goal:** Remove all dead code, verify test suites pass, and finalize.

**Requirements:** (meta — cleanup after Units 1-6)

**Dependencies:** Units 1-6

**Files:**
- Cleanup in: `src/app/pages/LearningPaths.tsx` (verify all code referring to deleted `CreatePathDialog` is removed)
- Cleanup in: `src/app/pages/LearningPathDetail.tsx` (verify all code referring to deleted `CoursePickerDialog` is removed)

**Approach:**
- Verify no dead imports remain in modified files
- Remove unused dialog-related state variables:
  - In `LearningPaths.tsx`: the `createDialogOpen` state and its setter remain (retriggered by `CurriculumComposer`)
  - Actually `CurriculumComposer` uses the same `createDialogOpen` state — keep it
- Remove unused imports in modified files
- Run full test suite and fix any regressions
- Verify success criteria:
  - A new user can create a path with 3+ courses without ever seeing an empty path page
  - The `CoursePickerDialog` modal component is deleted (replaced by the shared inline picker)
  - Creating a path with N courses requires 1 dialog open + 1 confirm action
  - The inline picker renders correctly at 375px viewport width
  - Multi-select with 20+ courses does not cause layout shift or scroll jank
  - Keyboard: Tab through search -> checkbox list -> reorder buttons -> Create, with visible focus rings throughout

**Test scenarios:**
- Regression: no broken imports in LearningPaths.tsx or LearningPathDetail.tsx
- Regression: full test suite passes (unit + e2e for learning paths)

**Verification:**
- `CoursePickerDialog` no longer exists in any source file
- `CreatePathDialog` no longer exists in any source file
- `npm run build` passes
- `npm run test:unit` passes
- `npx tsc --noEmit` passes

## System-Wide Impact

- **Interaction graph:** The "Import new course" action in `InlineCoursePicker` dispatches custom events that `ImportWizardDialog` listens for. The singleton guard (`isImportWizardOpen`) is already in place.
- **Error propagation:** `CurriculumComposer` create failures should keep the dialog open with an error toast. `createPathWithCourses` has full rollback — the user never sees a half-created path.
- **State lifecycle risks:** `RecentImported` computation is a `useMemo` derived from store state — it updates reactively as courses are imported or assigned.
- **API surface parity:** The `CoursePickerDialog` was an internal component (not exported), so no external API impact. The store's new `batchAddCoursesToPath` and `createPathWithCourses` are public methods.
- **Unchanged invariants:** `useLearningPathStore` data model, course rendering inside paths, `addCourseToPath` signature, `MoveUpDownButtons` API.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| AI "Suggested Next" may have latency issues with debounce | Debounce 500ms, cache per selection, show skeleton during loading |
| `createPathWithCourses` rollback may leave partial state on browser close/crash | Acceptable risk — same pattern as existing optimistic updates; full rollback on caught errors |
| ImportWizardDialog coordination may have timing issues | Follow existing `isImportWizardOpen` / `IMPORT_WIZARD_SET_TARGET` pattern already proven in LearningPaths and LearningPathDetail |
| Multi-select reorder state can drift from course list selection | Keep selected IDs in parent state, reorder only reorders the selected list, not the filtered results |

## Documentation / Operational Notes

- Unit tests for all new components and store methods
- No new external API dependencies
- No config/settings changes needed

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-03-learning-paths-01-curriculum-composer-requirements.md`
- Related code: `src/app/pages/LearningPaths.tsx`, `src/app/pages/LearningPathDetail.tsx`, `src/stores/useLearningPathStore.ts`, `src/app/components/figma/MoveUpDownButtons.tsx`, `src/ai/learningPath/suggestPlacement.ts`
- Related tests: `src/app/pages/__tests__/LearningPaths.test.tsx`, `src/app/pages/__tests__/LearningPathDetail.test.tsx`, `src/stores/__tests__/useLearningPathStore.test.ts`
