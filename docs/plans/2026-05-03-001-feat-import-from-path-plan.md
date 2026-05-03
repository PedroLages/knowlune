---
title: feat: Add Import-from-Path — Close the Import-Path Loop
type: feat
status: active
date: 2026-05-03
origin: docs/brainstorms/2026-05-03-learning-paths-07-import-from-path-requirements.md
deepened: 2026-05-03
---

# feat: Add Import-from-Path — Close the Import-Path Loop

## Overview

Parameterize the `ImportWizardDialog` with an optional `targetPathId` so the import wizard can be invoked from path contexts (list page, detail page, eventually template gaps). Add "Import Course" buttons to `LearningPaths.tsx` and `LearningPathDetail.tsx`, and enforce a singleton wizard instance to prevent duplicate dialogs. This closes the loop between path management and content acquisition — the reverse direction that was missing from the original path-placement feature (E26-S04), which only allowed path assignment during import from the Courses page.

## Problem Frame

The import wizard already supports path placement during import (Flow C in the original design), but only when invoked from the Courses page. From a path context, there is no way to import new courses — the `CoursePickerDialog` on the path detail page only shows already-imported courses. This creates a disconnected experience: when a user is building a path and discovers they're missing a course, they must leave the path entirely, navigate to Courses, and start a separate import flow.

The primary motivation is the template gap import flow (Idea #3), where a user forks a template, sees gap courses they don't own, and needs a way to import them without context-switching. The path list/detail import buttons are secondary entry points that make the feature discoverable outside the template flow.

(see origin: docs/brainstorms/2026-05-03-learning-paths-07-import-from-path-requirements.md)

## Requirements Trace

- R1. "Import Course" button on the path list page (`LearningPaths.tsx`) — page header and each path card's action menu
- R2. "Import Course" button on the path detail page (`LearningPathDetail.tsx`) — header action bar area
- R3. Pass target `pathId` through the wizard so step 3 is pre-filled and AI placement uses path-specific context
- R4. Step 3 shows target path pre-selected; user can accept, change, create new, or skip
- R5. Skip path placement remains available — course imports to general library without path assignment
- R6. After import completes from a path context, wizard closes and the user is back on the originating path page (navigation is unchanged — the wizard is a dialog overlay)
- R7. Template gap entries show "Import" action that opens the wizard with path pre-filled (scaffolding only — template gap rendering is in a separate feature)
- R8. After template gap import, gap entry transitions to linked course (deferred — depends on template syllabus view from Idea #3)
- R9. Wizard behavior is consistent across all entry points — same 3-step flow, parameterized only by pre-filled target path
- R10. Single wizard instance — if wizard is already open when "Import" is clicked from another context, update its target path rather than opening a second dialog

## Scope Boundaries

- The import wizard's internal flow (source -> metadata -> placement) is unchanged — only parameterized
- No changes to how course import works (YouTube download, file upload, metadata extraction) — the import pipeline is consumed as-is
- No batch import from path context (single-course import only)
- The path context is a pre-fill, not a constraint — user can always change or skip the target path in step 3
- No "Import all gaps" bulk action for templates

### Deferred to Separate Tasks

- R7/R8 template gap import UI: R7's "scaffolding only" refers to the work this plan delivers — the wizard accepting `targetPathId` (Unit 1) and the singleton guard — which are the infrastructure pieces the template gap flow needs. The actual template gap rendering (gap entries showing an "Import" action, UI for the gap card, transition to linked course after import) is deferred to the template syllabus view (Idea #3). That feature will call the wizard with `targetPathId` using the same pattern established in Units 2-3, requiring no wizard changes.
- `usePathPlacementSuggestion` with a constrained path context: The current hook suggests the best path among all paths. When a target path is pre-selected, the hook should suggest a position within that specific path. This enhancement is called out in Unit 4 but if it requires changes to the AI provider or prompt structure, it should be deferred to implementation-time discovery.

## Context & Research

### Relevant Code and Patterns

- **`ImportWizardDialog`** (`src/app/components/figma/ImportWizardDialog.tsx`): Existing 3-step wizard (select folder -> details -> path placement). Current props: `{ open, onOpenChange }`. Already has `selectedPathId`, `pathChoice`, `newPathName` state variables and `usePathPlacementSuggestion` integration from E26-S04. The path step conditionally renders based on `learningPaths.length > 0 || isPathPlacementAvailable()`.
- **`LearningPaths`** (`src/app/pages/LearningPaths.tsx`): Path list page with header (search + "Create Path" button), card grid (each card has a 3-item dropdown: rename, edit description, delete). Uses `useLearningPathStore` and `useCourseImportStore`.
- **`LearningPathDetail`** (`src/app/pages/LearningPathDetail.tsx`): Path detail page with back link, header stats, trail map, "Add Course" button (opens `CoursePickerDialog`), sortable course list, "Suggest Order" AI button. Uses `useLearningPathStore`, `useCourseImportStore`, `useAuthorStore`.
- **`CoursePickerDialog`** (inline in `LearningPathDetail.tsx`): Shows only already-imported courses not already in the path. Has search, course list with "Add" buttons.
- **`usePathPlacementSuggestion`** (`src/ai/hooks/usePathPlacementSuggestion.ts`): AI hook for suggesting path placement. Takes `courseName`, `courseTags`, `courseDescription`, `enabled`. Uses `useLearningPathStore` and `useCourseImportStore`. Currently evaluates all paths — does not accept a specific target path ID.
- **`Courses.tsx`** (`src/app/pages/Courses.tsx`): Reference for wizard invocation pattern: `const [wizardOpen, setWizardOpen] = useState(false)` -> `<ImportWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />`.
- **`useLearningPathStore`** (`src/stores/useLearningPathStore.ts`): Zustand store with `paths`, `entries`, `loadPaths`, `addCourseToPath`, `createPath`, `getEntriesForPath`, etc.
- **`useCourseImportStore`** (`src/stores/useCourseImportStore.ts`): Store for imported course data and thumbnail URLs.

### Institutional Learnings

- No directly relevant `docs/solutions/` entries found for wizard parameterization or dialog composition patterns.
- Design token enforcement is active — all new UI must use theme tokens from `theme.css` (brand, brand-soft, etc.), not hardcoded Tailwind colors.
- ESLint rule `error-handling/no-silent-catch` requires visible feedback in catch blocks — use `toast.error()` for user-facing operations.

### External References

- No external research needed. The codebase has strong local patterns for all components being modified. The wizard already has path placement, both path pages exist with established patterns, and the Courses page shows the canonical wizard invocation pattern.

## Key Technical Decisions

- **Add `targetPathId` prop to ImportWizardDialog**: The wizard already manages `selectedPathId` internally. The new prop pre-fills that state when the dialog opens. When `targetPathId` is provided, the path step shows the target path pre-selected and the `pathChoice` defaults to `'choose'` (not `'accept'` since AI hasn't run yet). (see origin: Key Decisions - "Pre-fill, not lock-in")
- **Module-level singleton guard tracking dialog open state**: Detecting "already open" state (R10) uses a module-level `let wizardOpenCount = 0` counter that the `ImportWizardDialog` increments and decrements inside its `onOpenChange` handler — only when the `open` prop transitions to/from `true`. This is critical because `Courses.tsx`, `LearningPaths.tsx`, and `LearningPathDetail.tsx` each render their own `<ImportWizardDialog>` instance, so a mount-based counter would reach 3 even with no wizard visible. An exported `isImportWizardOpen()` function returns `wizardOpenCount > 0`. When a path page triggers import, the click handler checks this function — if true, it dispatches a custom `'import-wizard-set-target'` event to update the target path instead of setting local state to open another wizard. This avoids React concurrent feature issues since the check is synchronous in the click handler.
- **"Import Course" button placement**: On the list page: one in the page header alongside "Create Path", one in each path card's dropdown menu (the latter passes that card's path ID). On the detail page: one in the header action bar area next to the existing "Add Course" button. (see origin: Deferred to Planning Q1, Q2)
- **Return-to-sender navigation**: After import completes, the wizard closes (calls `onOpenChange(false)`) and the user sees the path page they were already on. The course appears via store reactivity — `useCourseImportStore` triggers a re-render, and `LearningPathDetail` re-filters entries. No explicit navigation is needed since the wizard is a dialog overlay. (see origin: Key Decisions - "Return-to-sender navigation")
- **Step 3 UI when target path is pre-filled**: Show the full step 3 with the target path highlighted and pre-selected. This maintains consistency (R9) and allows the user to change their mind. The AI suggestion card still appears and can override the pre-selection. (see origin: Deferred to Planning Q2)

## Open Questions

### Resolved During Planning

- R1 button placement: Page header (alongside "Create Path") + each card's dropdown menu. Both are useful — header for general import, card-specific for context.
- R4 step 3 UI: Full step 3 with target path pre-selected/highlighted. Consistent and allows override.
- R9 invocation context tracking: Add `targetPathId` prop to `ImportWizardDialog` (simplest approach). The path page passes the prop when it has context.
- R10 singleton detection: Module-level `let wizardOpenCount = 0` counter tracking dialog open state transitions (incremented/decremented inside the `onOpenChange` handler, not on mount/unmount) + custom event for cross-component communication.

### Deferred to Implementation

- Whether `usePathPlacementSuggestion` needs changes to accept a specific target path — it currently evaluates all paths. The AI may need a prompt adjustment to suggest position within a known path. This is deferred because it depends on the actual AI provider behavior and prompt structure.
- Exact import of the `Download` icon (or similar) for the "Import Course" button — any icon that conveys "bring content in" will work; the implementer can choose from lucide-react at implementation time.
- Whether the `CoursePickerDialog` should also gain an "Import New Course" action — this is a UX polish decision that depends on how the detail page layout feels with both buttons.

## Implementation Units

- [ ] **Unit 1: Add `targetPathId` prop to ImportWizardDialog**

**Goal:** Extend the wizard to accept an optional `targetPathId` that pre-fills step 3 with the specified path, and add the singleton guard (R10).

**Requirements:** R3, R4, R5, R9, R10

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ImportWizardDialog.tsx`
- Test: `src/app/components/figma/__tests__/ImportWizardDialog.test.tsx`

**Approach:**
- Add `targetPathId?: string` to `ImportWizardDialogProps`
- When `targetPathId` is provided and the dialog opens (step 1), store it in a ref for later use in step 3
- When the user reaches step 3 with a `targetPathId`, pre-set `selectedPathId` to the target and `pathChoice` to `'choose'`
- If the AI suggestion arrives and the user accepts it, the AI suggestion overrides the pre-filled path (consistent with existing behavior where AI suggestion -> accept sets `selectedPathId`)
- Add a module-level `let wizardOpenCount = 0` counter incremented and decremented inside the dialog's `onOpenChange` handler, only when the `open` prop transitions to/from `true`. Export an `isImportWizardOpen()` function that returns `wizardOpenCount > 0` — this is the public API consumed by path pages to check for an existing wizard instance. Tracking `onOpenChange` transitions (not mount/unmount) is essential because three page components each render their own `<ImportWizardDialog>` instance, so a mount-based counter would reach 3 even when no wizard is visible
- Add a custom event listener pattern: the wizard listens for `'import-wizard-set-target'` events on `window`; when received, updates its internal `targetPathId` ref and navigates to step 3 with the new target pre-selected
- After import completes from a path context, the wizard closes normally (same as existing behavior)

**Patterns to follow:**
- Existing `ImportWizardDialog` structure with `useState`, `useCallback`, `useEffect`
- Existing `resetWizard` function — extend to also reset `targetPathId`
- The `useEffect` that syncs AI suggestion into `selectedPathId` (lines 153-160) already handles the accept flow

**Test scenarios:**
- Happy path: Wizard receives `targetPathId="path-1"`, user proceeds to step 3 -> target path is pre-selected in the Select dropdown, position field is visible
- Happy path: Wizard receives `targetPathId="path-1"`, user clicks "Add Later" -> course is imported without path assignment (skip works)
- Happy path: Wizard without `targetPathId` -> behaves exactly as before (no regression)
- Edge case: `targetPathId` refers to a non-existent path -> path not found in list, no pre-selection, wizard behaves as if no target was passed
- Edge case: `targetPathId` is provided but `learningPaths` is empty -> path step is hidden (existing behavior: `showPathStep` is false), wizard falls through to direct import
- Error path: AI suggestion changes the pre-selected path -> accept overrides, reject/choose reverts to pre-filled target
- Integration: Wizard is open, `import-wizard-set-target` event fires with new `targetPathId` -> wizard updates target and navigates to step 3
- Edge case: Two page components mount with `<ImportWizardDialog>` but neither is open -> `isImportWizardOpen()` returns `false` (counter tracks open state, not mount count)

**Verification:**
- Wizard with `targetPathId` pre-fills step 3 correctly
- Wizard without `targetPathId` has no behavior change (existing tests pass)
- `isImportWizardOpen()` returns true only when a wizard dialog is actually open (tracked via `onOpenChange` transitions, not mount state)
- Custom event handling updates target path for an already-open wizard

---

- [ ] **Unit 2: Add import entry points to LearningPathDetail page**

**Goal:** Add an "Import Course" button to the path detail page header, next to the existing "Add Course" button, that opens the import wizard with `targetPathId={pathId}`.

**Requirements:** R2, R3, R6, R9, R10

**Dependencies:** Unit 1 (needs `targetPathId` prop and singleton guard)

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`
- Test: `src/app/pages/__tests__/LearningPathDetail.test.tsx` (create)

**Approach:**
- Add `importWizardOpen` state and an "Import Course" button adjacent to the existing "Add Course" button in the right sidebar action area (lines 978-988)
- The button uses `variant="brand-outline"` to visually distinguish from the primary "Add Course" `variant="brand"` button
- Click handler: checks `isImportWizardOpen()`. If true, dispatches `'import-wizard-set-target'` custom event with the current `pathId`. If false, sets `importWizardOpen` local state to true
- Render `<ImportWizardDialog open={importWizardOpen} onOpenChange={setImportWizardOpen} targetPathId={pathId!} />` in the component's JSX
- After import completes (wizard closes), the new course appears in the path via store reactivity — `useCourseImportStore` triggers re-render of `importedCourses`, and `courseEntries` recomputes

**Patterns to follow:**
- `Courses.tsx` wizard invocation pattern: `const [wizardOpen, setWizardOpen] = useState(false)` -> `<ImportWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />`
- Existing "Add Course" button (`variant="brand"`, `onClick={() => setPickerOpen(true)}`) — new button follows same layout pattern
- The course list auto-updates via `useMemo` (lines 496-499) because `getEntriesForPath` depends on `entries` from the store, which updates when `addCourseToPath` is called by the wizard

**Test scenarios:**
- Happy path: User clicks "Import Course" on detail page -> wizard opens, pathId is passed -> user completes wizard -> wizard closes, user sees detail page, new course appears in path
- Happy path: Wizard is already open from another context -> clicking "Import Course" dispatches custom event -> target path updates, wizard shows step 3 with new path pre-selected
- Edge case: Path has no imported courses yet -> after import, path shows the single new course (empty state transitions to populated state)
- Edge case: User opens wizard, goes back to step 1, changes folder -> pathId context persists through the re-scan
- Error path: Import fails (network error) -> error toast shown in wizard, wizard stays open, path context preserved, user can retry
- Integration: User clicks "Import Course" then immediately cancels (closes wizard) -> wizard closes, path page returns to previous state, no side effects

**Verification:**
- "Import Course" button is present on the path detail page header area
- Clicking it opens the import wizard with the correct `targetPathId`
- After import completes, the new course appears in the path course list without page navigation
- Singleton guard works — second click updates existing wizard rather than opening a duplicate

---

- [ ] **Unit 3: Add import entry points to LearningPaths list page**

**Goal:** Add "Import Course" button to the page header (alongside "Create Path") and to each path card's dropdown menu that opens the import wizard with that path's ID.

**Requirements:** R1, R3, R9, R10

**Dependencies:** Unit 1 (needs `targetPathId` prop and singleton guard)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`
- Test: `src/app/pages/__tests__/LearningPaths.test.tsx` (create)

**Approach:**
- Add `importWizardOpen` and `importTargetPathId` state to the `LearningPaths` component
- In the page header (lines 646-682), add an "Import Course" button alongside the existing "Create Path" button. Use `variant="brand-outline"` to distinguish from the primary "Create Path" CTA. When clicked without a specific path context (header button), set `importTargetPathId` to `null` — the wizard opens without a pre-filled path
- In each `PathCard`'s action dropdown (lines 389-405), add a new `DropdownMenuItem` for "Import Course" (before "Rename", as the first action). This passes the card's `path.id` as the target
- The `PathCard` component needs a new `onImport` callback prop
- Click handler logic: if `isImportWizardOpen()`, dispatch custom event. Otherwise, set `importTargetPathId` and `importWizardOpen`
- Render `<ImportWizardDialog open={importWizardOpen} onOpenChange={setImportWizardOpen} targetPathId={importTargetPathId} />` at the bottom of the component (alongside other dialogs)

**Patterns to follow:**
- Existing `PathCard` dropdown menu items (Rename, Edit Description, Delete) — "Import Course" is added before Rename
- Existing callback pattern: `onRename`, `onEditDescription`, `onDelete` — add `onImport`
- Page-level dialog rendering pattern (lines 742-764) — all dialogs rendered at component root

**Test scenarios:**
- Happy path: User clicks header "Import Course" -> wizard opens without `targetPathId` -> user imports a course without path assignment
- Happy path: User opens path card dropdown, clicks "Import Course" -> wizard opens with that path's ID pre-filled -> import completes -> course added to that path
- Edge case: User clicks "Import Course" from a path card, then immediately clicks header "Import Course" -> custom event updates wizard (singleton guard), wizard now has no target path (header context overrides card context)
- Edge case: List page has zero paths -> "Import Course" header button still works (imports without path context)
- Edge case: User opens dropdown on a path card with no courses -> "Import Course" still works, path gets its first course after import
- Integration: After import completes, the path card's course count and progress ring update reactively via `pathStats` and `pathProgressMap`

**Verification:**
- "Import Course" button in page header opens wizard without target path
- Each path card dropdown has "Import Course" as first action, opens wizard with that card's path ID
- Importing a course from a card's context adds it to that specific path
- Singleton guard works across list page header and card dropdown contexts

---

- [ ] **Unit 4: Extend usePathPlacementSuggestion for constrained path context**

**Goal:** When a `targetPathId` is provided, the AI placement suggestion should focus on suggesting a position within that specific path rather than evaluating all paths. If the hook's AI provider doesn't support this, fall back to suggesting the first available position.

**Requirements:** R3

**Dependencies:** Unit 1 (needs `targetPathId` in wizard state)

**Files:**
- Modify: `src/ai/hooks/usePathPlacementSuggestion.ts`
- Modify: `src/ai/learningPath/suggestPlacement.ts` (if the AI function signature or prompt needs adjustment)
- Test: `src/ai/hooks/__tests__/usePathPlacementSuggestion.test.ts` (create if it doesn't exist, or add scenarios to existing)

**Approach:**
- Add optional `targetPathId?: string` parameter to `usePathPlacementSuggestion`
- When `targetPathId` is provided, filter `pathContexts` to only include the target path before passing to `suggestPathPlacement`
- The AI prompt remains the same — it already handles single-path context (it receives an array of path contexts, which can have one element)
- If `targetPathId` is provided but the path doesn't exist in `paths`, fall back to evaluating all paths (graceful degradation)
- The `ImportWizardDialog` passes its `targetPathId` through to the hook

**Execution note:** If the AI provider returns a different suggestion shape when given a single path (e.g., the position field but no pathId), handle that at implementation time. The fallback for implementation-time discovery: if AI fails with constrained context, retry without constraint.

**Patterns to follow:**
- Existing hook signature and return type — extend, don't break
- Existing abort controller pattern for cancellation

**Test scenarios:**
- Happy path: Hook receives `targetPathId="path-1"` -> only evaluates placement within path-1 -> returns `{ pathId: "path-1", position: 3, justification: "..." }`
- Edge case: `targetPathId` refers to non-existent path -> falls back to evaluating all paths (graceful degradation)
- Edge case: `targetPathId` is provided but AI is not available -> hook returns `hasFetched: false`, wizard falls back to manual path selection
- Edge case: Target path has no existing courses -> AI should suggest position 1
- Integration: Wizard receives AI suggestion for constrained path -> pre-fills position field, user can accept or adjust

**Verification:**
- When `targetPathId` is provided, only the target path is sent to the AI for placement evaluation
- Graceful degradation when target path doesn't exist or AI is unavailable
- Existing behavior (no `targetPathId`) is unchanged — all paths are evaluated

---

- [ ] **Unit 5: Add test files for LearningPaths and LearningPathDetail pages**

**Goal:** Create comprehensive test files for the path pages that validate the new import entry points, wizard integration, and existing page behavior.

**Requirements:** R1, R2, R3, R6, R9, R10 (via test coverage of the feature)

**Dependencies:** Units 2, 3 (test the implemented features)

**Files:**
- Create: `src/app/pages/__tests__/LearningPaths.test.tsx`
- Create: `src/app/pages/__tests__/LearningPathDetail.test.tsx`

**Approach:**
- Follow the existing test patterns from `ImportWizardDialog.test.tsx`: vitest + React Testing Library + userEvent, mock stores via `vi.mock`, mock AI hooks
- For `LearningPaths.test.tsx`: test the page header "Import Course" button, path card dropdown "Import Course" action, wizard open/close behavior, singleton guard interaction
- For `LearningPathDetail.test.tsx`: test the "Import Course" button in the sidebar, wizard open with `targetPathId`, course appearing after import, singleton guard

**Patterns to follow:**
- `ImportWizardDialog.test.tsx` mock patterns for stores and AI hooks (lines 1-65)
- `Courses.test.tsx` for page-level test structure (rendering page components with store mocks)
- Use `vi.mock('@/stores/useLearningPathStore', ...)` and `vi.mock('@/stores/useCourseImportStore', ...)` patterns
- Mock `ImportWizardDialog` as a simple controlled dialog to verify props rather than testing wizard internals (wizard internals are tested in its own test file)

**Test scenarios:**
- LearningPaths: Renders "Import Course" button in header when paths exist
- LearningPaths: Path card dropdown includes "Import Course" action
- LearningPaths: Header "Import Course" opens wizard without targetPathId
- LearningPaths: Card dropdown "Import Course" opens wizard with that card's pathId
- LearningPaths: Clicking "Import Course" while wizard is open dispatches custom event instead of opening second wizard
- LearningPathDetail: Renders "Import Course" button in sidebar
- LearningPathDetail: Clicking "Import Course" opens wizard with current pathId
- LearningPathDetail: Modal closes after import -> path detail page visible

**Verification:**
- All test files pass with `npm run test:unit`
- Tests cover happy path and edge cases for each entry point
- Tests don't break when existing store or AI hook behavior changes (mocks are isolated)

## System-Wide Impact

- **Interaction graph:** The import wizard (`ImportWizardDialog`) now has a bidirectional relationship with path pages. Previously, only `Courses.tsx` rendered the wizard. Now `LearningPaths.tsx` and `LearningPathDetail.tsx` also render it. The singleton guard (`isImportWizardOpen()`) and custom event (`'import-wizard-set-target'`) create a cross-component communication channel.
- **Error propagation:** Import failures are already handled in the wizard via toast notifications. No new error paths are introduced — the wizard's existing error handling covers all entry points equally.
- **State lifecycle risks:** The module-level `wizardOpenCount` counter tracks `onOpenChange` transitions (open-to-close) rather than mount/unmount. This avoids the mount-counting bug where three page components each rendering a `<ImportWizardDialog>` would drive the counter to 3 on page load. The remaining risk is that the counter could drift if `onOpenChange` fires in an unexpected order (e.g., the event handler updates `wizardOpenCount` before a synchronous state update in a parent). Mitigation: increment only when transitioning from closed to open (`prevOpen=false -> open=true`), decrement only when transitioning from open to closed (`prevOpen=true -> open=false`). Additionally, reset the counter to 0 if it ever becomes negative (defensive programming).
- **API surface parity:** The `ImportWizardDialog` prop interface expands from 2 props to 3. This is backward-compatible — all existing callers (`Courses.tsx`) work without changes.
- **Integration coverage:** The cross-layer scenario where import -> store update -> path page re-render -> new course appears cannot be fully tested in unit tests alone. It requires an integration test or manual verification. The unit tests in Unit 5 mock the store, so they verify the wiring is correct but not the actual store reactivity.
- **Unchanged invariants:** The wizard's 3-step flow, validation, error handling, and AI suggestion behavior are unchanged when no `targetPathId` is passed. The existing import pipeline (`scanCourseFolder`, `persistScannedCourse`) is not modified. The `CoursePickerDialog` (existing "Add Course" from already-imported courses) is not modified.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Singleton wizard counter drifts if `onOpenChange` fires in unexpected order (e.g., rapid double-click) | Increment only on closed-to-open transition, decrement only on open-to-closed transition. Reset to 0 if counter becomes negative (defensive programming) |
| `usePathPlacementSuggestion` AI prompt doesn't handle single-path context well | Fall back to manual path selection if AI fails with constrained context |
| Path pages don't have existing test files (greenfield tests) | Unit 5 creates test files with mock patterns proven in `ImportWizardDialog.test.tsx` |
| Store reactivity after import may have a delay (async IndexedDB) | Existing behavior — the path pages already handle async store updates via `useEffect` + `loadPaths`/`loadImportedCourses`. The wizard calls `addCourseToPath` which triggers store updates; the path page re-renders via Zustand subscription |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-03-learning-paths-07-import-from-path-requirements.md](docs/brainstorms/2026-05-03-learning-paths-07-import-from-path-requirements.md)
- Related code: `src/app/components/figma/ImportWizardDialog.tsx` (wizard component)
- Related code: `src/app/pages/LearningPaths.tsx` (path list page)
- Related code: `src/app/pages/LearningPathDetail.tsx` (path detail page)
- Related code: `src/app/pages/Courses.tsx` (wizard invocation reference)
- Related code: `src/ai/hooks/usePathPlacementSuggestion.ts` (AI placement hook)
- Related PRs: E26-S04 (original path placement feature)
