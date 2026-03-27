---
story_id: E33-S06
story_name: "Add Testable Import Path — Drag-and-Drop File Import"
status: in-progress
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
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

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Populated after implementation]
