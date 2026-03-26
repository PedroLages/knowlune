# E1B-S03: Import Progress Indicator

## Status: Done

## Summary

Added a non-blocking floating import progress overlay that shows real-time progress during course folder imports. Supports both single-folder and bulk import flows with file-level scanning progress, estimated time remaining, and immediate cancellation.

## Acceptance Criteria

| AC | Description | Status |
|----|------------|--------|
| AC1 | Import starts → progress overlay: "Scanning folder... 0 of ? files processed" (non-blocking) | Done |
| AC2 | Progress updates every 10 files with percentage; after 20 files shows ETA | Done |
| AC3 | Bulk import: overall progress "Importing 3 of 7 courses..." with per-course status | Done |
| AC4 | Cancel button stops immediately, no partial data saved, toast confirms | Done |
| AC5 | Completion: "Import complete! 3 courses added." Auto-dismiss after 3s | Done |

## Implementation

### New Files
- `src/stores/useImportProgressStore.ts` — Zustand store for detailed import progress state (phases, cancellation, per-course tracking)
- `src/app/components/figma/ImportProgressOverlay.tsx` — Floating overlay component with progress bars, ETA calculation, cancel button

### Modified Files
- `src/lib/courseImport.ts` — Integrated progress events into `scanCourseFolder()` and `scanCourseFolderFromHandle()` with cancellation support
- `src/app/components/figma/BulkImportDialog.tsx` — Wired bulk imports to progress store for per-course tracking
- `src/app/components/Layout.tsx` — Mounted ImportProgressOverlay globally

### Architecture
- Progress overlay is mounted in Layout (available on all routes — AC1: non-blocking)
- Zustand store enables progress updates from import library code without prop drilling
- Cancellation uses a `cancelRequested` flag checked between file scan iterations and metadata extraction batches
- ETA calculated from elapsed time / files processed rate, shown after 20 files threshold
- Auto-dismiss timer (3s) with manual close option

## Lessons Learned

- **Progress granularity matters**: Updating every 10 files during scanning provides good UX without excessive re-renders. The batch metadata extraction naturally provides per-file updates.
- **Cancellation in async iterators**: The File System Access API's `scanDirectory` async generator cannot be aborted mid-iteration, so cancellation is checked between iterations. This means cancellation is "between files" rather than truly instant, but fast enough for user perception.
- **Dual progress stores**: The existing `useCourseImportStore.importProgress` is kept for backward compatibility with the ImportWizardDialog, while the new `useImportProgressStore` handles the richer overlay UX. A future refactor could consolidate these.
