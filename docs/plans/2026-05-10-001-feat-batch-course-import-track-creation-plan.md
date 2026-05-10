---
title: "feat: Add batch course import to track creation flow, remove confusing Import Track button"
type: feat
status: active
date: 2026-05-10
sourcePlan: /Users/pedro/.claude/plans/in-the-learning-tracks-page-tingly-shell.md
---

# feat: Add batch course import to track creation flow

## Overview

Remove the confusing "Import Track" button (which requires a `track-manifest.json` file most users don't have) and instead integrate batch course import into the track creation dialog. The CurriculumComposer already supports single-course import during creation; this adds batch import so users can import multiple courses at once while building a track.

## Problem Frame

The LearningTracks page header has three buttons: "Create Track", "Import Course", and "Import Track". The "Import Track" button requires users to have a directory with a `track-manifest.json` file — a power-user feature that most users don't understand or have. Users creating a new track want to import courses (single or batch) directly from the creation dialog, not as a separate top-level action.

The CurriculumComposer (opened by "Create Track") already has an "Import new course" button in its InlineCoursePicker that opens the ImportWizardDialog for single-course import. After import, a `COURSE_IMPORTED` custom event auto-selects the new course in the picker. What's missing is batch import — the ability to import multiple course folders at once during creation.

## Requirements Trace

- **R1.** The "Import Track" button is removed from the LearningTracks page header. The underlying `trackManifestImport.ts` library is preserved but has no UI entry point on this page.
- **R2.** The CurriculumComposer's InlineCoursePicker gains a "Import multiple" button (alongside the existing "Import new course" single-import button) that opens the BulkImportDialog.
- **R3.** After batch import completes, all successfully imported courses are auto-selected in the InlineCoursePicker, ready to be included in the new track.
- **R4.** The existing single-course import flow ("Import new course" → ImportWizardDialog → auto-select) continues to work unchanged.

## Scope Boundaries

- The BulkImportDialog's internal flow (choose source → select folders → scan → review → import → results) is unchanged
- The `track-manifest.json` batch import library (`src/lib/trackManifestImport.ts`) is preserved — it may be reused later
- No changes to how ImportWizardDialog works
- No changes to the `createPathWithCourses` store method
- No changes to the track card dropdown menu (it already has "Import Course" for existing tracks)

### Deferred to Separate Tasks

- Improving the "Import Track" manifest-based flow to be more discoverable: future iteration if user demand exists

## Context & Research

### Relevant Code and Patterns

- [CurriculumComposer.tsx](src/app/components/figma/CurriculumComposer.tsx) — Track creation dialog. Already listens for `COURSE_IMPORTED` events and auto-selects new courses (lines 143-159). Has `showImportAction` and `onImportCourse` props wired to InlineCoursePicker.
- [InlineCoursePicker.tsx](src/app/components/figma/InlineCoursePicker.tsx) — Course multi-select with "Import new course" footer button (lines 717-728). Props: `showImportAction`, `onImportCourse`.
- [BulkImportDialog.tsx](src/app/components/figma/BulkImportDialog.tsx) — 6-step batch import dialog. Props: `open`, `onOpenChange`, `onSingleImport`, `onYouTubeImport`. Does NOT currently fire completion events or accept an `onComplete` callback.
- [LearningTracks.tsx](src/app/pages/LearningTracks.tsx) — "Import Track" button at line 400, handler at line 179, inline confirmation dialog at lines 583-655.
- [ImportWizardDialog.tsx](src/app/components/figma/ImportWizardDialog.tsx) — Dispatches `COURSE_IMPORTED` custom event (line 513) that CurriculumComposer listens for.
- `COURSE_IMPORTED` constant — Defined in CurriculumComposer.tsx (line 43), imported by ImportWizardDialog.

### Institutional Learnings

- No relevant `docs/solutions/` entries for this specific change.

## Key Technical Decisions

- **Callback over events for batch:** BulkImportDialog imports N courses. Firing N `COURSE_IMPORTED` events would cause N re-renders. Instead, add an `onComplete(courseIds: string[])` callback prop to BulkImportDialog that fires once with all successfully imported course IDs.
- **"Import Track" button removal, not library deletion:** The `trackManifestImport.ts` library and its types stay. Removing the library would be a breaking change if anything else imports it. Only the UI entry point (button + inline dialog) is removed.
- **InlineCoursePicker gains `onBatchImport` prop:** Mirror the existing `onImportCourse` / `showImportAction` pattern. Add `onBatchImport` and `showBatchImportAction` props. When both are provided, show a second button "Import multiple" next to "Import new course".

## Implementation Units

### Unit 1: Remove "Import Track" button and dialog from LearningTracks

**Goal:** Remove the confusing "Import Track" header button and its associated state/dialog from the LearningTracks page.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningTracks.tsx`

**Approach:**
- Remove the `<Button>` at ~line 400 (the "Import Track" button with FolderTree icon)
- Remove `handleImportTrack` handler (~lines 179-197)
- Remove `handleConfirmTrackImport` handler (~lines 199-226)
- Remove state: `trackImportOpen`, `trackImportSummary`, `trackImportError`, `trackImportDirHandleRef`, `trackImportManifestRef`
- Remove the inline track import confirmation/error dialog (~lines 583-655)
- Clean up unused imports: `FolderTree` icon, `readTrackManifest`, `batchImportTrackCourses`, `TrackManifestSummary`
- Keep the "Import Course" button (brand-outline) — it opens ImportWizardDialog and is well-understood

**Verification:**
- `grep -n "Import Track\|handleImportTrack\|trackImportOpen\|batchImportTrackCourses" src/app/pages/LearningTracks.tsx` returns no results
- Build passes with no unused import warnings
- Page renders correctly with remaining two buttons

### Unit 2: Add `onComplete` callback to BulkImportDialog

**Goal:** BulkImportDialog accepts an optional `onComplete(importedCourseIds: string[])` callback, called when batch import finishes successfully.

**Requirements:** R3 (enables auto-selection after batch import)

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/BulkImportDialog.tsx`

**Approach:**
- Add optional `onComplete?: (courseIds: string[]) => void` to `BulkImportDialogProps`
- In the `results` step, after successful imports complete, collect all `courseId`s from items with `status === 'success'` that have a `scannedCourse`
- Call `onComplete(importedIds)` when the "Done" button is clicked or the dialog closes after a successful batch
- The callback is a prop — no change to the dialog's internal state management

**Patterns to follow:**
- Optional callback pattern: `onComplete?.(ids)` — called only if provided
- Same pattern as `onSingleImport` and `onYouTubeImport` existing props

**Verification:**
- Batch import 2+ course folders → verify callback receives correct course IDs
- Existing BulkImportDialog callers (Courses page) continue to work without passing onComplete

### Unit 3: Add batch import button to CurriculumComposer's InlineCoursePicker

**Goal:** The track creation dialog shows a "Import multiple" button that opens BulkImportDialog. After batch import, all new courses are auto-selected.

**Requirements:** R2, R3

**Dependencies:** Unit 2 (BulkImportDialog onComplete)

**Files:**
- Modify: `src/app/components/figma/CurriculumComposer.tsx`
- Modify: `src/app/components/figma/InlineCoursePicker.tsx`

**Approach:**

**InlineCoursePicker changes:**
- Add two optional props: `showBatchImportAction?: boolean` and `onBatchImport?: () => void`
- In the footer (near lines 717-728), when `showBatchImportAction && onBatchImport`, render a "Import multiple" button (variant="brand-outline", `Folders` icon) alongside the existing "Import new course" button
- The footer layout: both buttons side by side with `gap-2`

**CurriculumComposer changes:**
- Add local state: `batchImportOpen: boolean`
- Add `handleBatchImport` function: opens BulkImportDialog
- Add `handleBatchImportComplete(importedIds: string[])`: adds all imported course IDs to `selectedCourseIds` and refreshes the course list
- Render `<BulkImportDialog>` with `open={batchImportOpen}`, `onOpenChange={setBatchImportOpen}`, `onComplete={handleBatchImportComplete}`, and existing `onSingleImport` / `onYouTubeImport` delegates
- Pass `showBatchImportAction` and `onBatchImport={() => setBatchImportOpen(true)}` to InlineCoursePicker

**Verification:**
- Create a new track → click "Import multiple" → select a parent folder with 3 course subfolders → complete import → verify all 3 courses appear selected with position badges → name the track → click "Create Path" → verify new track has all 3 courses

## System-Wide Impact

- **Interaction graph:** BulkImportDialog gains an optional callback — no existing callers are affected. CurriculumComposer gains a new child dialog — z-index stacking is handled by Radix Dialog portal.
- **Unchanged invariants:** `createPathWithCourses` store method unchanged. ImportWizardDialog unchanged. BulkImportDialog internal flow unchanged. Track card dropdown "Import Course" unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| BulkImportDialog + CurriculumComposer both being Dialogs causes z-index stacking issues | Radix Dialog uses portals with increasing z-indices; test on mobile where nested dialogs are most problematic |
| BulkImportDialog `onComplete` called with stale IDs if courses are deleted between import and callback | Use the IDs returned by `persistScannedCourse` which are the actual Dexie row IDs — they're stable |

## Verification

1. **Build check:** `npm run build` passes with no errors
2. **Type check:** `npx tsc --noEmit` passes
3. **Manual smoke test:**
   - Navigate to `/learning-tracks`
   - Verify header has only "Create Track" and "Import Course" buttons (no "Import Track")
   - Click "Create Track" → CurriculumComposer opens
   - Verify footer has both "Import new course" and "Import multiple" buttons
   - Click "Import multiple" → BulkImportDialog opens
   - Complete batch import of 2+ courses
   - Verify courses appear selected with position badges in the picker
   - Fill in track name → click "Create Path"
   - Verify redirected to new track detail page with all courses in syllabus
4. **Regression check:** Single-course import via "Import new course" button still works
5. **Regression check:** "Import Course" button in page header still works (opens ImportWizardDialog without target path)
