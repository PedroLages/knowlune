---
title: "fix: Resolve 5 HIGH production bugs in URL batch import"
type: fix
status: active
date: 2026-06-29
origin: docs/brainstorms/2026-06-28-course-import-experience-requirements.md
---

# fix: Resolve 5 HIGH production bugs in URL batch import

## Overview

Fix 5 HIGH-severity bugs discovered during the R3 review of the deferred-issues hardening pass (PR #626). Three bugs are in `BulkImportDialog.tsx` (stale async state contamination, error recovery, override loss) and two are in `courseImport.ts` (silent truncation, concurrent file cap race). All fixes follow established concurrency patterns already present in the codebase.

## Problem Frame

After implementing 13 MEDIUM and 10 LOW deferred findings from the URL batch import feature's R3 review, a final review (R3 escalation) uncovered 5 HIGH-severity production bugs that the deferred list missed:

1. **KI-101**: `handleRetry` sets an item's status to `'scanning'` then awaits `scanCourseFromSource`. If that call throws (network error, CORS timeout), no catch block resets the status — the item is permanently stuck in `'scanning'` and the retry button is dead.
2. **KI-103**: `handleScanFolders` has no generation counter guard. If the user closes and reopens the dialog while a scan is in flight, the stale scan's completion handlers mutate the new dialog's state with old data.
3. **KI-105**: `handleRetry` re-scans the course, getting a fresh `crypto.randomUUID()` from `scanCourseFolderFromServer`. The user's configured course overrides (name, description, cover image) are keyed by the original course ID — the new UUID doesn't match, so overrides are silently dropped.
4. **KI-102**: `MAX_SERVER_SCAN_FILES` (5000) truncation sets `truncated: true` on the `ScannedCourse` but that flag is never surfaced to the UI. Users see a completed import with no indication that courses were dropped.
5. **KI-104**: `filesFound` is a local variable in `scanCourseFolderFromServer`, but the cap check (`filesFound < MAX_SERVER_SCAN_FILES`) and increment (`filesFound++`) are separated by asynchronous operations. Between the read and the write, other concurrent `Promise.allSettled` branches can also read the same stale `filesFound` value and push files — exceeding the cap. The real fix is to use the combined length of `allVideos` and `allPdfs` (both also local accumulators) for the cap check, which is atomic within each synchronous callback.

## Requirements Trace

- R1. handleRetry must recover from scan failures by resetting item status to `'error'` — the retry button must not dead-end (KI-101)
- R2. handleScanFolders must use a generation counter guard so stale scan completions cannot contaminate state after dialog close/reopen (KI-103)
- R3. handleRetry must preserve user-configured course overrides (name, description, cover) after re-scan — overrides must not be silently lost (KI-105)
- R3a. Override lookup must survive a retry-after-persist-failure cycle: capture the original course ID in a ref (`originalCourseIdRef`) before the first scan in `handleScanFolders` so it survives across retries; always look up overrides using that ref, never the live scan result ID.
- R4. MAX_SERVER_SCAN_FILES truncation must be surfaced to the user with a visible warning indicator per truncated item (KI-102)
- R5. The file cap in scanCourseFolderFromServer must be race-free — the actual file count must never exceed MAX_SERVER_SCAN_FILES (KI-104)

## Scope Boundaries

- Only the 5 HIGH bugs (KI-101 through KI-105). Remaining 22 MEDIUM/LOW findings (KI-106 through KI-127) are out of scope.
- Only `BulkImportDialog.tsx` and `courseImport.ts` are in scope. ImportWizardDialog bugs are out of scope.
- No new UI components — use existing toast/dialog patterns.
- Changes to `ImportItem` are limited to adding `truncated?: boolean` — a minimal, backward-compatible optional field to surface truncation to the UI.

## Context & Research

### Relevant Code and Patterns

- **Generation guard pattern**: `src/app/components/figma/BulkImportDialog.tsx:598-636` (`handleConfirmImport`) — captures `gen = ++generationRef.current`, checks `gen !== generationRef.current` after every await. This is the canonical pattern to replicate in `handleScanFolders`.
- **Ref-lock pattern**: `src/app/components/figma/BulkImportDialog.tsx` — `retryLockRef` and `scanningRef` both use `if (ref.current) return; ref.current = true; try { ... } finally { ref.current = false }`.
- **Error recovery pattern**: `src/app/components/figma/BulkImportDialog.tsx` — `handleConfirmImport` catches persist failures with `toast.error()` + status reset. Match this in `handleRetry`.
- **Truncation surfacing**: `ScannedCourse.truncated?: boolean` already exists on the type (see `src/lib/courseImport.ts:1360`). The flag is set but never read by callers.
- **Atomic counter**: JavaScript's single-threaded event loop means `array.length` reads are atomic within a synchronous callback. Replace `filesFound++` with checking `allVideos.length + allPdfs.length`.
- **`useStableCallback`**: `src/app/hooks/useStableCallback.ts` — already used for `onComplete` prop. Reuse for callback stability.

### Institutional Learnings

- `docs/solutions/developer-experience/implementation-lessons-deferred-issues-hardening-2026-06-28.md` §2 — Four ref patterns for concurrency guards (scanningRef, generationRef, retryLockRef, abortRef). Boolean/counter refs preferred over Set-based guards.
- `docs/solutions/developer-experience/implementation-lessons-url-batch-import-2026-06-28.md` — `scanCourseFromSource` as normalized wrapper; never branch inline.
- `docs/solutions/developer-experience/track-import-consolidation-lessons-2026-05-10.md` Lesson 2 — Every await in a dialog handler needs try-catch + state recovery. On failure: `toast.error()` + reset step to `'review'`.

## Key Technical Decisions

- **Generation guard in handleScanFolders uses existing `generationRef`**: No new ref needed. Increment it at the top, capture `gen`, check after each await. Same ref already used by `handleServerUrlScan` and `handleConfirmImport` — consistent.
- **Override preservation via original course ID capture**: Before re-scanning in `handleRetry`, save `item.scannedCourse?.id` as `originalCourseId`. After re-scan, if the new `scanResult.course.id` differs, look up overrides using `originalCourseId`. Simpler than threading the ID through `scanCourseFolderFromServer`.
- **Truncation surfaced via `'truncated'` status + UI badge**: Add `'truncated'` to the `ImportItemStatus` union type and `truncated?: boolean` to `ImportItem`. The results step renders a ⚠️ warning icon with `"Truncated to N files"` text and fires `toast.warning()` once per dialog open.
- **Atomic counter via `allVideos.length + allPdfs.length`**: Replace the mutable `filesFound` counter with `allVideos.length + allPdfs.length` checks. In JavaScript, `Array.prototype.push` and `.length` reads are safe within a single synchronous callback — the event loop ensures no interleaving within one microtask. No mutex needed.

## Implementation Units

- [x] **Unit 1: Fix BulkImportDialog bugs (KI-101, KI-103, KI-105)**

**Goal:** Fix stale async state contamination in `handleScanFolders`, error recovery in `handleRetry`, and override loss in `handleRetry`.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/BulkImportDialog.tsx`
- Test: `src/app/components/figma/__tests__/BulkImportDialog.test.tsx`

**Approach:**

1. **KI-103 — Add generation guard to `handleScanFolders`** (lines ~460-566):
   - At the top of the handler, after the `scanningRef` guard: `generationRef.current++` and `const gen = generationRef.current`.
   - After `await scanCourseFromSource(item)` (inside `runWithConcurrency` callback): check `if (abortRef.current || gen !== generationRef.current) return`.
   - After the cover image blob loading loop (after `await response.blob()`): same check.
   - Before the final `setImportItems` with scanned results: same check.
   - Pattern reference: `handleConfirmImport` lines 598-636.

2. **KI-101 — Add error recovery to `handleRetry`** (lines ~785-893):
   - Wrap the `scanCourseFromSource(item)` call in the `retryLockRef` body with try/catch.
   - On catch: call `updateItemInList` to set status to `'error'` with the error message.
   - Call `toast.error()` with the error message.
   - The `retryLockRef.current = false` is already in `finally` — verify all exit paths reach it.
   - Pattern reference: `handleConfirmImport` error handling + `docs/solutions/developer-experience/track-import-consolidation-lessons-2026-05-10.md` Lesson 2.

3. **KI-105 — Preserve course overrides on retry** (lines ~785-893):
   - Before re-scanning, capture `originalCourseId = item.scannedCourse?.id`.
   - After re-scan, if `scanResult.status === 'success'` and `originalCourseId` exists, look up overrides using `originalCourseId` (not the new `scanResult.course.id`).
   - Apply overrides to the new `scanResult.course` before persisting.
   - If the new course ID differs from the original, also carry the override lookup forward for the persist step.
   - **Double-retry survivability**: Add a `originalCourseIdRef` ref that is set once in `handleScanFolders` (before the first scan, i.e., when the dialog opens) and never overwritten. `handleRetry` reads overrides from this ref rather than from the live item's `scannedCourse.id`, so even if a prior retry re-scanned and got a new UUID, the override lookup still finds the correct overrides.

**Execution note:** Implement KI-103 first (generation guard) since it establishes the pattern for the other fixes to build on.

**Patterns to follow:**
- `handleConfirmImport` generation guard (lines 598-636)
- `updateItemInList` helper for immutable state updates (lines 101-112)
- `toast.error()` pattern for user-facing error feedback

**Test scenarios:**

- Happy path: `handleScanFolders` called, dialog closed and reopened during scan → stale completion is discarded, new scan state is correct
- Happy path: `handleRetry` called on a failed item → scan succeeds → overrides (name, description, cover) are applied to the re-scanned course
- Edge case: `handleRetry` called, `scanCourseFromSource` throws (mock rejection) → item status transitions to `'error'`, `toast.error` is called, retry button remains clickable
- Edge case: `handleRetry` called on an item with no overrides → re-scan succeeds → no overrides applied (no crash on missing overrides)
- Edge case: Dialog is closed and reopened rapidly twice during scan → only the latest generation's results land in state
- Error path: `handleRetry` called, `scanCourseFromSource` returns `{ status: 'error' }` (not throw) → item status transitions to `'error'`
- Error path: `handleRetry` called, `persistScannedCourse` rejects after successful scan → item transitions to `'error'`, locked state is released

**Verification:**
- `handleScanFolders` has `generationRef.current++` and `gen` capture visible at the top of the handler
- `handleRetry` has try/catch around the scan call with status reset
- Original course ID is captured before re-scan in `handleRetry`
- All 7 test scenarios pass

- [x] **Unit 2: Fix courseImport.ts bugs (KI-102, KI-104)**

**Goal:** Make MAX_SERVER_SCAN_FILES truncation race-free and surface the truncation flag to callers.

**Requirements:** R4, R5

**Dependencies:** Unit 1 (BulkImportDialog needs the truncation flag surfaced from this unit)

**Files:**
- Modify: `src/lib/courseImport.ts`
- Test: `src/lib/__tests__/courseServerImport.test.ts`

**Approach:**

1. **KI-104 — Fix concurrent file cap race** (lines ~1412-1464):
   - Remove the mutable `filesFound` counter.
   - Replace all `filesFound >= MAX_SERVER_SCAN_FILES` checks with `(allVideos.length + allPdfs.length) >= MAX_SERVER_SCAN_FILES`.
   - Replace `filesFound++` with no-op (array `.push()` already increments length).
   - This is safe because JavaScript's event loop processes one microtask at a time — within a single `Promise.allSettled` callback, the push+check is atomic.
   - Update the `hitCap` check after the BFS loop: `const hitCap = (allVideos.length + allPdfs.length) >= MAX_SERVER_SCAN_FILES`.

2. **KI-102 — Surface truncation to callers and UI** (lines ~1489-1496):
   - The `truncated: true` flag is already set on the returned `ScannedCourse` when `hitCap` is true.
   - In `scanCourseFromSource` (lines ~1024-1051): when the result is `{ status: 'success', course }` and `course.truncated`, add a `truncated: true` field to the `BulkScanResult` (need to extend the type).
   - Add `'truncated'` to the `ImportItemStatus` union type so items can surface the truncated state.
   - In `BulkImportDialog.tsx` `handleScanFolders`: after receiving a scan result with `truncated: true`, add a toast warning: `toast.warning('Some files were skipped — server directory exceeded the 5,000 file limit')`. Use a `truncationWarnedRef` boolean ref to fire the toast only once per dialog open. Also set `truncated: true` on the `ImportItem` in the status update so the results step can display a per-item truncated badge.
   - **Results-step rendering**: In the results list (`step === 'review'` section), when `item.truncated === true`, show a ⚠️ warning icon alongside the item with text `"Truncated to N files"` where N is the actual file count from `scannedCourse.videoFiles.length + scannedCourse.pdfFiles.length`. Use the existing badge/tooltip pattern from the step's list rendering.

**Patterns to follow:**
- Existing `truncated?: boolean` on `ScannedCourse` type
- `toast.warning()` pattern for non-critical user notifications
- `updateItemInList` helper in BulkImportDialog for per-item status

**Test scenarios:**

- Happy path: scan with fewer than MAX_SERVER_SCAN_FILES files → no truncation warning, all files collected
- Edge case: scan with exactly MAX_SERVER_SCAN_FILES files → no truncation (at cap but not over), all files collected
- Edge case: scan with MAX_SERVER_SCAN_FILES + 1 files across 10 concurrent subdirectories → exactly MAX_SERVER_SCAN_FILES files collected (race-free), `truncated: true` returned
- Edge case: scan with 2× MAX_SERVER_SCAN_FILES files → capped at MAX_SERVER_SCAN_FILES, `truncated: true` returned
- Integration: `scanCourseFromSource` returns a BulkScanResult with `truncated: true` → BulkImportDialog shows toast warning
- Regression: local folder scan (FileSystemDirectoryHandle path) is unaffected — no truncation behavior changes

**Verification:**
- No `filesFound` variable remains in `scanCourseFolderFromServer`
- `allVideos.length + allPdfs.length` is used for all cap checks
- `truncated` flag propagates through `scanCourseFromSource` → `BulkScanResult` → `ImportItem`
- `'truncated'` is added to the `ImportItemStatus` union type
- Toast warning fires in `handleScanFolders` when truncation is detected, once per dialog open
- Results-step rendering shows ⚠️ icon + `"Truncated to N files"` badge for truncated items
- All 6 test scenarios pass

- [x] **Unit 3: Integration tests for the fix bundle**

**Goal:** Add integration-level tests that exercise the fixed behaviors end-to-end.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** Units 1 and 2

**Files:**
- Test: `src/app/components/figma/__tests__/BulkImportDialog.test.tsx`
- Test: `src/lib/__tests__/courseServerImport.test.ts`

**Approach:**
- BulkImportDialog tests: Add a test for the generation guard (close dialog during scan → reopen → verify clean state), a test for retry with overrides preserved, and a test for truncated scan surfacing.
- courseServerImport tests: Add a concurrent-directory test that verifies the cap is not exceeded with 10 concurrent subdirectory scans.
- Use existing mock infrastructure: `mockScanCourseFromSource`, `mockPersistScannedCourse`, `makeAutoindexResponse`, `mockDirHandle`.

**Patterns to follow:**
- Existing test patterns in `BulkImportDialog.test.tsx` (mock factory functions, step navigation helpers)
- Existing test patterns in `courseServerImport.test.ts` (fake-indexeddb, fetch save/restore)

**Test scenarios:**
- Integration: Full retry flow with overrides — user sets name/description/cover, import fails, retry, overrides are applied to re-scanned course
- Integration: Dialog close/reopen during scan — open dialog, start scan, close dialog, reopen, start new scan, verify only the second scan's results appear
- Integration: Truncation toast — scan a large directory with >5000 files, verify toast warning appears and truncated items are marked
- Integration: Concurrent directory scan cap — 10 subdirectories each with 600 files, verify total files collected ≤ 5000
- Integration: Double-retry override preservation — first scan succeeds, persist fails, user retries (gets new UUID), persist fails again, user retries again, overrides still applied from original course ID via ref

**Verification:**
- All new tests pass
- Existing tests not broken (full test suite green)
- Build, lint, and typecheck pass

## System-Wide Impact

- **Interaction graph:** `scanCourseFolderFromServer` → `scanCourseFromSource` → `handleScanFolders` / `handleRetry` → React state (`importItems`, `step`). All changes are within this existing call chain.
- **Error propagation:** `handleRetry` now catches and surfaces errors that were previously swallowed, using the established `toast.error()` pattern.
- **State lifecycle risks:** The generation guard in `handleScanFolders` introduces `generationRef` increment on scan start — verify `handleConfirmImport` (which also increments `generationRef`) is never concurrent with `handleScanFolders` (they run in different dialog steps: `scanning` vs `importing`).
- **Unchanged invariants:** Local folder import (FileSystemDirectoryHandle path) is unaffected by the `filesFound` → `allVideos.length` refactor — that code path does not use `scanCourseFolderFromServer`. The `scanCourseFromSource` wrapper remains the single dispatch point. `ImportItem` gains only `truncated?: boolean` — backward-compatible.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `generationRef` shared across `handleScanFolders`, `handleServerUrlScan`, and `handleConfirmImport` — incrementing it in one handler could interfere with another | These handlers run in different dialog steps (`enter-url` → `scanning` → `importing`) and are never concurrent. The increment is safe because it only races within the same handler. |
| `allVideos.length + allPdfs.length` as atomic counter relies on JS event loop semantics | This is the standard JS concurrency model — synchronous callback execution is not interleaved. Any `await` point where other callbacks could run is followed by a fresh length check on the next iteration. |
| Override preservation depends on `originalCourseId` being present on the `ImportItem` | Guard with `if (originalCourseId)` before lookup — if absent, skip override application (no crash). This handles edge cases where the item was created before the fix. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-06-28-course-import-experience-requirements.md](../brainstorms/2026-06-28-course-import-experience-requirements.md)
- **Known issues:** KI-101 through KI-105 in [docs/known-issues.yaml](../known-issues.yaml)
- **Prior plan:** [docs/plans/2026-06-28-001-feat-url-batch-import-dialog-redesign-plan.md](2026-06-28-001-feat-url-batch-import-dialog-redesign-plan.md)
- **Compound lessons:** [docs/solutions/developer-experience/implementation-lessons-deferred-issues-hardening-2026-06-28.md](../solutions/developer-experience/implementation-lessons-deferred-issues-hardening-2026-06-28.md)
- **Concurrency patterns:** [docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md](../solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md)
- **Callback patterns:** [docs/solutions/design-patterns/batch-course-import-track-creation-callback-stable-ref-patterns-2026-05-10.md](../solutions/design-patterns/batch-course-import-track-creation-callback-stable-ref-patterns-2026-05-10.md)
- Related code: `src/app/components/figma/BulkImportDialog.tsx`, `src/lib/courseImport.ts`
- Related PR: [#626](https://github.com/PedroLages/knowlune/pull/626)
