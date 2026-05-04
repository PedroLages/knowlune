---
date: 2026-05-03
topic: learning-paths-import-from-path
parent: docs/ideation/2026-05-03-learning-paths-creation-ideation.md
---

# Import-from-Path — Close the Import↔Path Loop

## Problem Frame

The import wizard and path system were designed to connect: Flow C (`ImportWizardDialog` step 3) can create a path or assign the imported course to an existing path during import. But the reverse direction was never built — from a path context, there is no way to import new courses. The `CoursePickerDialog` only shows already-imported courses. The `LearningPaths.tsx` page has no import capability at all. This creates a disconnected experience: path creation and content acquisition live in separate worlds. When paired with templates (Idea #3), the gap is even more visible — a user forks a "Full-Stack Developer" template, sees 3 gap courses they don't have, and has no way to import them without leaving the path, navigating to Courses, and starting a separate import flow.

## Requirements

### Import Entry Points from Path Context

- **R1.** Add an "Import Course" button to the path list page (`LearningPaths.tsx`) — in the page header alongside the existing "Create Path" button, and/or in each path card's action menu.
- **R2.** Add an "Import Course" button to the path detail page (`LearningPathDetail.tsx`) — in the header action bar and/or the inline course picker (see Idea #1, R9).
- **R3.** When the import wizard is invoked from a path context, pass the target `pathId` as a parameter. The wizard uses this to: (a) pre-select the target path in step 3 (path placement), (b) call `usePathPlacementSuggestion` with the specific path context for smarter position suggestions.

### Wizard Behavior with Path Context

- **R4.** When invoked with a target path, step 3 of the import wizard (path placement) shows the target path pre-selected. The user can: (a) accept the pre-selected path + AI-suggested position (one click to confirm), (b) change the target path to a different one, (c) choose to create a new path instead, or (d) skip path placement entirely.
- **R5.** If the user chose "skip" in step 3, the course is imported without path assignment — it appears in the general library. This is the existing behavior and must remain available.
- **R6.** When import completes from a path context, the wizard closes and the user returns to the path they came from. The newly imported course appears in the path immediately (optimistic update or store refresh).

### Template Gap Import

- **R7.** In the template syllabus view (Idea #3, R8), gap entries (template courses not in the user's library) show an "Import" action that opens the import wizard in a targeted mode: the wizard's source step (YouTube URL, file upload, etc.) is the primary step, and the path placement is pre-filled to the template-forked path.
- **R8.** After importing to fill a template gap, the gap entry transitions from "Import" to the actual course (linked, with progress tracking). The syllabus view updates to reflect the filled gap.

### Consistency Across Entry Points

- **R9.** The import wizard already has two entry points: the Courses page (`BulkImportDialog` or direct import button) and the `ImportWizardDialog` used during initial setup. Adding path-context entry points brings the total to 3+. The wizard must behave consistently: same 3-step flow, same validation, same error handling, parameterized only by the pre-filled target path.
- **R10.** If the import wizard is already open when the user clicks "Import Course" from a path, focus the existing wizard instance and update its target path context (don't open a second wizard).

## Success Criteria

- From the path detail page, a user can click "Import Course", complete the import wizard, and see the new course in the path without navigating to the Courses page
- The import wizard invoked from a path context has step 3 pre-filled with the target path, reducing the interaction from "pick/create path" to "confirm or skip"
- Importing a course to fill a template gap transitions the gap entry to a linked course in under 1 second after import completion
- The import wizard behaves identically across all 3+ entry points (Courses page, path list, path detail) in terms of validation, error handling, and progress indication
- Importing a course that fails (network error, invalid URL) shows the error in the wizard without losing the path context

## Scope Boundaries

- The import wizard's internal flow (source → metadata → placement) is unchanged — only parameterized with an optional `targetPathId`
- No changes to how course import works (YouTube download, file upload, metadata extraction) — the import pipeline is consumed as-is
- No batch import from path context (single-course import only) — batch import remains a Courses-page feature
- The path context is a pre-fill, not a constraint — the user can always change or skip the target path in step 3
- No "Import all gaps" bulk action for templates — each gap must be imported individually (batch gap import is a future enhancement)

## Key Decisions

- **Pre-fill, not lock-in:** The target path is pre-selected in step 3 but the user can change it. This avoids the UX trap of "I clicked import from the wrong path and now I'm stuck." The pre-fill is a convenience, not a constraint.
- **Return-to-sender navigation:** After import completes, the user returns to the path context they came from (path list or detail page). This is the principle of least surprise — the user clicked "Import" from a path, they expect to end up back at that path.
- **Single wizard instance:** Only one import wizard can be open at a time. If the user clicks "Import" from a different context while the wizard is open, the wizard's target path is updated rather than opening a second instance. This prevents the confusion of multiple wizards and ensures the latest user intent is respected.
- **Template gap import as the killer use case:** The primary motivation for this feature is the template → gap → import flow. The path list/detail import buttons are secondary entry points that make the feature discoverable outside the template flow.

## Dependencies / Assumptions

- `ImportWizardDialog` accepts or can be extended to accept a `targetPathId` prop
- `usePathPlacementSuggestion` (AI hook) exists and works with a specific path context — verify it's the same as or compatible with `suggestPlacement` from `src/ai/learningPath/`
- The import wizard renders in a portal or at a consistent z-index that works above path pages (which may have their own dialogs like `CurriculumComposer`)
- After import, the course store (`useCourseImportStore`) updates reactively, and the path detail page re-renders to show the new course
- Template gap entries have enough metadata (topic, suggested source) to pre-fill the import wizard's source step with a search query or suggested URL

## Outstanding Questions

### Resolve Before Planning

- None yet — ideation provides sufficient clarity.

### Deferred to Planning

- [Affects R1] Where exactly should the "Import Course" button live on the path list page — header bar only, each card's action menu, or both?
- [Affects R4] Step 3 UI when target path is pre-filled: should it skip directly to position confirmation (collapsing the path selection UI), or show the full step 3 with the target path highlighted?
- [Affects R7] For template gap import: should the wizard's source step pre-fill a YouTube search query based on the gap topic? (e.g., gap is "SwiftUI Basics" → search YouTube for "SwiftUI Basics tutorial")
- [Affects R9] Does the import wizard currently track its invocation context? If not, what's the simplest way to pass `targetPathId` without threading props through intermediate components?
- [Affects R10] How is the "already open" state detected — a module-level ref, a store flag, or a DOM query? Need a reliable singleton pattern that works with React 19 concurrent features.

## Next Steps

-> Ready for `/ce:plan`. Low complexity (parameterization of existing wizard). Best implemented after Curriculum Composer (Idea #1) and Path Templates (Idea #3) are in place, since the template gap import flow is the highest-value use case.
