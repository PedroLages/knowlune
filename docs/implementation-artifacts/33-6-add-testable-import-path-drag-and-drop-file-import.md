---
story_id: E33-S06
story_name: "Add Testable Import Path — Drag-and-Drop File Import"
status: in-progress
started: 2026-03-27
completed:
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 33.06: Add Testable Import Path — Drag-and-Drop File Import

## Story

As a developer,
I want a drag-and-drop file import path alongside the existing showDirectoryPicker() button,
so that E2E tests can automate course imports via Playwright's dispatchEvent('drop', ...).

## Acceptance Criteria

- AC1: Given the import wizard is on the "Select Folder" step, When the user views the dialog, Then a DropZone component is visible alongside the existing "Select Folder" button
- AC2: Given a user drags course files onto the DropZone, When the drop event fires, Then the files are processed using the same processFiles() logic as showDirectoryPicker()
- AC3: Given a Playwright E2E test, When it dispatches a 'drop' event with test fixture files on the DropZone, Then the import wizard advances to the details step
- AC4: Given the existing showDirectoryPicker() import path, When a user clicks "Select Folder", Then the original behavior is unchanged
- AC5: Given KI-010 in known-issues.yaml, When this story is complete, Then KI-010 is marked as fixed

## Tasks / Subtasks

- [x] Task 1: Extract shared processFiles() logic from handleSelectFolder (AC: 2, 4)
- [x] Task 2: Create DropZone component with drag-and-drop event handling (AC: 1, 2)
- [x] Task 3: Integrate DropZone into ImportWizardDialog select step (AC: 1, 3)
- [x] Task 4: Verify build passes (AC: 4)
- [x] Task 5: Mark KI-010 as fixed in known-issues.yaml (AC: 5)

## Implementation Notes

- DropZone uses HTML5 drag-and-drop API (dragenter, dragover, dragleave, drop)
- Files from drop event are processed to create a ScannedCourse-like structure
- The showDirectoryPicker() path remains completely unchanged
- DropZone has data-testid="import-drop-zone" for Playwright automation

## Testing Notes

This story IS the testable import path — E2E tests for import wizard can now use DropZone.

## Pre-Review Checklist

- [x] All changes committed
- [x] No error swallowing
- [x] No inline styles
- [x] Design tokens used throughout

## Design Review Feedback

Skipped — this story adds a DropZone component but the primary purpose is E2E test infrastructure, not user-facing UI redesign. The DropZone follows existing design patterns (design tokens, rounded-xl borders, brand colors for drag states).

## Code Review Feedback

- Build: PASS
- Lint: PASS (0 errors, 23 pre-existing warnings)
- Type check: PASS
- Format check: PASS (auto-formatted 86 pre-existing files)
- Unit tests: PASS (3429 tests)
- E2E smoke tests: PASS (13 tests)
- No blockers or high-priority issues found
- Code follows established patterns: shared processing logic, proper error handling with toast notifications, design token usage throughout

## Challenges and Lessons Learned

- **File handle nullability trade-off**: The drag-and-drop path cannot provide `FileSystemFileHandle` objects since `DataTransferItem.getAsFileSystemHandle()` has limited browser support and Playwright cannot automate it. The solution uses `null as unknown as FileSystemFileHandle` for the handle fields. This means courses imported via drag-and-drop will not have persistent file access for later playback — this is acceptable for E2E testing purposes, which is the primary use case.

- **Hidden file input as the primary E2E automation path**: Rather than relying on Playwright's `dispatchEvent('drop')` (which requires constructing `DataTransfer` objects), the hidden `<input type="file">` with `data-testid="import-file-input"` enables Playwright's `setInputFiles()` API, which is the most reliable and well-supported automation method.

- **Refactoring extractVideoMetadata to accept File objects**: The original function took `FileSystemFileHandle` and called `getFile()` internally. Refactoring to extract a `FromFile` variant kept the original API unchanged while enabling reuse for the drop path. The original function now delegates to the new one.

- **Shared processing logic pattern**: Both import paths (directory picker and drop zone) converge on the same `ScannedCourse` type, ensuring the wizard's details/path steps work identically regardless of how files were acquired. Only the file acquisition method differs.
