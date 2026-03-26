# Non-Functional Requirements Report: Epic 1B — Library Enhancements

**Date:** 2026-03-26
**Stories Assessed:** E1B-S01 through E1B-S04
**Overall Assessment:** PASS

---

## Scope

| Story   | Feature                          | Key Files                                                                |
|---------|----------------------------------|--------------------------------------------------------------------------|
| E1B-S01 | Bulk Course Import               | `BulkImportDialog.tsx`, `courseImport.ts` (parallel scan)                |
| E1B-S02 | Auto-Extract Video Metadata      | `courseImport.ts` (metadata extraction), `format.ts`, `fileSystem.ts`    |
| E1B-S03 | Import Progress Indicator        | `ImportProgressOverlay.tsx`, `useImportProgressStore.ts`                 |
| E1B-S04 | Course Card Thumbnails           | `autoThumbnail.ts`, `thumbnailService.ts`, `useLazyVisible.ts`, `ImportedCourseCard.tsx` |

---

## 1. Performance

### Build Time
- Production build compiles without errors. No heavy new dependencies introduced.
- All 4 stories add application code only (no new npm packages).
- **Verdict:** PASS.

### Bundle Size Impact
- **E1B-S01:** `BulkImportDialog.tsx` (647 lines) is a new dialog component using existing shadcn/ui primitives (Dialog, Progress, Checkbox, ScrollArea). Zero new imports.
- **E1B-S02:** `format.ts` adds 3 pure functions (~60 lines total). `fileSystem.ts` adds `extractVideoMetadata` that wraps browser `HTMLVideoElement` API. No new dependencies.
- **E1B-S03:** `ImportProgressOverlay.tsx` (293 lines) and `useImportProgressStore.ts` (168 lines). Uses existing Zustand, shadcn/ui Card, Progress, Button. No new dependencies.
- **E1B-S04:** `autoThumbnail.ts` (39 lines), `useLazyVisible.ts` (43 lines). Uses browser Canvas API and IntersectionObserver. No new dependencies.
- **Total new code:** ~1,720 lines across 18 files. Zero new npm packages.
- **Verdict:** PASS. Zero bundle size concern.

### Rendering Performance
- **E1B-S01:** Parallel scan limited to 5 concurrent folders. `Promise.allSettled()` with chunked processing prevents UI thread blocking. Zustand optimistic updates use batch state mutations.
- **E1B-S02:** Metadata extraction uses `HTMLVideoElement.loadedmetadata` event — browser-native, non-blocking. Results cached in scanned course data during import (one-time cost).
- **E1B-S03:** Progress overlay updates via Zustand store. `updateScanProgress` called every 10 files (not per-file) to prevent excessive re-renders. ETA calculation is O(1) division.
- **E1B-S04:** `useLazyVisible` uses IntersectionObserver with 200px rootMargin for pre-loading. One-shot observation (disconnects after first intersection). For 50+ courses, only visible cards load thumbnails. `URL.createObjectURL()` for blob-to-URL avoids base64 encoding overhead.
- **Verdict:** PASS. Deliberate throttling (10-file batches, 5-folder concurrency cap, lazy intersection) prevents performance degradation at scale.

### Memory Management
- **E1B-S04:** `autoThumbnail.ts` creates `URL.createObjectURL()` references stored in Zustand. These are not explicitly revoked on component unmount. For a typical library (10-50 courses), the memory impact is negligible (~10-50 object URLs, each pointing to a small JPEG blob). For very large libraries (500+), this could accumulate.
- **Verdict:** PASS (advisory). Object URL cleanup is a future optimization if libraries exceed ~200 courses.

---

## 2. Security

### XSS / Injection
- **E1B-S01:** Folder names from File System Access API are rendered via React JSX (auto-escaped). No `dangerouslySetInnerHTML`.
- **E1B-S02:** Metadata values (duration, size, resolution) are numeric. Format functions produce static strings. No user-supplied text rendered.
- **E1B-S03:** Progress text is computed from numeric counters and pre-defined phase strings. No user input.
- **E1B-S04:** Thumbnail blobs are generated via Canvas API from local video files. `URL.createObjectURL()` produces `blob:` URLs — same-origin only. No external content.
- **Verdict:** PASS. No XSS or injection vectors.

### File System Access
- **E1B-S01:** Uses File System Access API `showDirectoryPicker()` which requires explicit user gesture (click). Browser enforces permission prompts. No silent file access.
- **E1B-S04:** Video file handles accessed via stored `FileSystemFileHandle` — requires user permission grant. Canvas `toBlob()` output stays local.
- **Verdict:** PASS. Browser-enforced permission model.

---

## 3. Reliability

### Error Handling
- **E1B-S01:** `ImportError` class with typed codes (`NO_FILES`, `PERMISSION_DENIED`, `SCAN_ERROR`, `DUPLICATE`). Bulk import uses `Promise.allSettled()` — individual folder failures do not abort the batch. Consolidated error toast for failures. Successful imports persist even when siblings fail.
- **E1B-S02:** Metadata extraction wraps video loading in try-catch. Returns null metadata on failure (silent degradation). Course card displays without metadata fields when absent.
- **E1B-S03:** Cancellation uses `cancelRequested` flag checked between file iterations. On cancel, `confirmCancellation()` resets progress store. No partial data persisted — cancellation fires before `persistScannedCourse()`.
- **E1B-S04:** `autoGenerateThumbnail` in `autoThumbnail.ts` is called in a fire-and-forget pattern. Failures are silent. Card falls back to placeholder icon (FolderOpen from lucide-react). Idempotent — checks existing thumbnail before regenerating.
- **Verdict:** PASS. Consistent error handling: errors are caught, user is notified via toast or silent fallback, and partial failures do not corrupt state.

### Data Integrity
- **E1B-S01:** Duplicate detection checks `db.importedCourses` for existing folder name before persisting. Prevents double-import.
- **E1B-S03:** Cancellation explicitly avoids partial persistence — the cancel flag is checked before the `persistScannedCourse()` call, not after.
- **E1B-S04:** Thumbnails stored in IndexedDB via `saveCourseThumbnail()`. Idempotent — `autoGenerateThumbnail()` short-circuits if `thumbnailUrls[courseId]` already exists.
- **Verdict:** PASS.

---

## 4. Maintainability

### Code Quality
- **E1B-S01:** `BulkImportDialog.tsx` (647 lines) is the largest new file. It is a self-contained dialog component with clear state machine phases (idle -> selecting -> scanning -> importing -> done). Internal types (`FolderEntry`, `ImportItem`, `ImportItemStatus`) are well-defined.
- **E1B-S02:** `format.ts` functions are pure, well-documented, and comprehensively unit-tested (296 lines of tests for ~60 lines of code). Excellent test-to-code ratio.
- **E1B-S03:** Zustand store follows existing project conventions. `ImportProgressOverlay.tsx` uses standard shadcn/ui patterns.
- **E1B-S04:** `autoThumbnail.ts` (39 lines) is minimal — delegates to `thumbnailService.ts` for extraction and storage. `useLazyVisible.ts` is a reusable hook with SSR fallback.
- **Advisory:** `useImportProgressStore.ts` and `useCourseImportStore.importProgress` have overlapping concerns (dual progress stores, noted in E1B-S03 lessons learned). A future consolidation would reduce confusion.
- **Verdict:** PASS (advisory). Clean code, good separation, one minor tech debt item (dual progress stores).

### Test Coverage
- ~30 new unit test cases across 4 test files. No E2E tests due to File System Access API limitation (KI-010).
- `format.test.ts` has exceptional coverage (296 lines for 60 lines of production code).
- **Verdict:** PASS. Appropriate testing strategy for browser-API-dependent features.

### Technical Debt
- **Dual progress stores:** `useImportProgressStore` (new, for overlay) vs `useCourseImportStore.importProgress` (existing, for wizard). Documented in E1B-S03 story file as a future consolidation target.
- **Object URL cleanup:** `URL.createObjectURL()` in `autoThumbnail.ts` — not revoked on unmount. Negligible for current scale.
- **Pre-existing:** 4 MyClass.test.tsx failures carried through E1B (not caused by E1B).
- **Verdict:** PASS (advisory). No new significant debt introduced.

---

## 5. Accessibility

### WCAG Compliance
- **E1B-S01:** BulkImportDialog uses Radix `Dialog` with proper `DialogTitle`, `DialogDescription`. Checkboxes have associated labels via Radix `Checkbox` + `label` elements. Focus management handled by Radix.
- **E1B-S03:** ImportProgressOverlay uses `Card` component with semantic content. Cancel button is a standard `<Button>`. Progress bar uses shadcn/ui `Progress` which renders `role="progressbar"` with `aria-valuenow`.
- **E1B-S04:** Course card thumbnails have `alt` attributes. Skeleton loading state is purely visual. Placeholder fallback (FolderOpen icon) has `aria-hidden="true"`.
- **Verdict:** PASS. Components use Radix primitives that provide correct ARIA by default.

### Keyboard Navigation
- BulkImportDialog: Tab through checkboxes, Enter to confirm, Escape to close. Standard Radix Dialog behavior.
- ImportProgressOverlay: Cancel button is focusable. Overlay does not trap focus (non-modal by design — AC1 "non-blocking").
- **Verdict:** PASS.

---

## Assessment Summary

| Category | Rating | Notes |
|----------|--------|-------|
| Performance | PASS | Throttled updates, lazy loading, concurrency cap. Advisory: object URL cleanup at scale |
| Security | PASS | Browser-enforced file permissions, no user input rendered |
| Reliability | PASS | Typed errors, silent degradation, cancellation without data corruption |
| Maintainability | PASS (advisory) | Clean code, good tests. Dual progress stores noted for consolidation |
| Accessibility | PASS | Radix primitives, proper ARIA, non-blocking overlay |

**Overall: PASS**
