## External Code Review: E108-S01 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-11
**Story**: E108-S01

### Findings

#### Blockers

- **[src/app/hooks/useBulkImport.ts:53-55 (confidence: 85)]**: **Double invocation causes concurrent bulk imports and stale `importResults`.** `startBulkImport` is an async function passed directly as a callback. React's strict-mode `<StrictMode>` (which Vite React projects use in dev) double-invokes effects and can cause `startBulkImport` to be called twice concurrently. The second call overwrites `abortRef.current`, so `cancel()` only aborts the second run — the first continues silently. Both write to the same `importResults` array and the second `setResults(importResults)` overwrites the first's results (data loss). Fix: Add an `isRunning` ref guard at the top of `startBulkImport`:
  ```ts
  const isRunningRef = useRef(false)
  // In startBulkImport:
  if (isRunningRef.current) return
  isRunningRef.current = true
  try { /* existing logic */ } finally { isRunningRef.current = false }
  ```

#### High Priority

- **[src/app/hooks/useBulkImport.ts:85-86 (confidence: 75)]**: **Race condition between abort check and `setPhase('cancelled')`.** The only place `setPhase('cancelled')` is called is at line 85, inside the `if (controller.signal.aborted)` check at the top of the loop. If abort is detected after an `await` (lines 102, 109, 119, 131), the code `break`s out of the loop but falls through to line 149 where `if (!controller.signal.aborted) setPhase('done')` — since the signal *is* aborted, `setPhase` is never called and the phase remains `'importing'` permanently. Fix: Change the late-break abort checks to also call `setPhase('cancelled')`:
  ```ts
  if (controller.signal.aborted) { setPhase('cancelled'); break }
  ```
  Or restructure the post-loop phase logic to set `'cancelled'` when `controller.signal.aborted` is true.

- **[src/app/components/library/BookImportDialog.tsx:348 (confidence: 80)]**: **Drop zone hidden during bulk import prevents re-import until dialog close.** When `bulkImport.phase` is `'done'` or `'cancelled'`, the drop zone (`bulkImport.phase === 'idle'`) stays hidden and the bulk progress panel shows instead. The user must click "Done" → `handleClose(false)` to close the dialog, which calls `reset()`. If `onOpenChange(false)` is a no-op (dialog stays open due to parent state), the user is stuck seeing only the summary with no way to start a new import. Fix: In the summary "Done" button handler, call `reset()` directly so the drop zone reappears regardless of dialog state:
  ```tsx
  onClick={() => { bulkImport.reset(); handleClose(false) }}
  ```

- **[src/app/components/library/BookImportDialog.tsx:191 (confidence: 90)]**: **Drag-drop with mixed EPUB + non-EPUB files silently drops non-EPUBs.** When a user drops 5 files but only 2 are `.epub`, the code filters to just the EPUBs and proceeds with `bulkImport.startBulkImport(epubFiles)`. There's no user feedback about the discarded files. The user may believe all 5 were imported. Fix: Show a toast informing about filtered files:
  ```ts
  if (epubFiles.length < droppedFiles.length) {
    toast.info(`${droppedFiles.length - epubFiles.length} non-EPUB file(s) skipped`)
  }
  ```

#### Medium

- **[src/app/hooks/useBulkImport.ts:93-94 (confidence: 70)]**: **`MAX_FILE_SIZE_MB` is unreachable dead code.** The callers (`handleDrop` at line 191 and `handleFileInput` at line 226) already filter to `.epub` files only before calling `startBulkImport`. The file type validation at line 93 (`!file.name.toLowerCase().endsWith('.epub')`) can never trigger, making the 500 MB size check at line 94 effectively unreachable in practice. The test at line 156 (`'skips non-epub files with error result'`) creates a scenario that can't happen through the UI. Fix: Either remove the client-side filter in `BookImportDialog` and let the hook handle all validation (cleaner), or acknowledge this is defensive validation and leave it (acceptable).

- **[src/app/hooks/useBulkImport.ts:146-147 (confidence: 60)]**: **State update on unmounted component possible.** If the dialog unmounts mid-import (e.g., route change), `setResults`, `setPhase`, and `setProgress` will fire on an unmounted component. In React 19 this isn't a crash, but the toast at line 155 will also fire after unmount. Fix: Check `controller.signal.aborted` before the final toast, or abort on unmount via a `useEffect` cleanup.

#### Nits

- **[src/app/components/library/BookImportDialog.tsx:400 (confidence: 50)]**: `Progress value={((bulkImport.progress.current) / bulkImport.progress.total) * 100}` — extra parentheses around `bulkImport.progress.current` are unnecessary. Pure style, no functional impact.

---
Issues found: 8 | Blockers: 1 | High: 3 | Medium: 2 | Nits: 1
