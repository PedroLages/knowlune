# Test Coverage Review: E24-S02 Import Wizard Folder Selection

**Date:** 2026-03-25
**Story:** E24-S02
**Reviewer:** Claude Code (automated)

## Test File

`src/app/components/figma/__tests__/ImportWizardDialog.test.tsx` (new, 355 lines)

## Acceptance Criteria Coverage

### AC: Dialog opens from Import Course button
- COVERED: "renders the dialog when open" (line 89)
- COVERED: "does not render content when closed" (line 95)

### AC: Step 1 - Folder Selection
- COVERED: "shows folder selection step initially" (line 100)
- COVERED: "shows step indicator with step 1 active" (line 106)
- COVERED: "shows scanning state on the select folder button" (line 277)
- COVERED: "stays on select step if user cancels the folder picker" (line 262)

### AC: Step 2 - Course Details
- COVERED: "transitions to details step after scanning" (line 114)
- COVERED: "allows editing the course name" (line 136)
- COVERED: "disables import button when name is empty" (line 155)
- COVERED: "shows validation error when name is cleared" (line 337)
- COVERED: "displays singular form for 1 video and 1 PDF" (line 301)

### AC: Import with overrides
- COVERED: "calls persistScannedCourse with overrides when name is changed" (line 175)
- COVERED: "calls persistScannedCourse without overrides when name unchanged" (line 213)

### AC: Navigation
- COVERED: "goes back to folder selection when Back is clicked" (line 242)

## Test Quality Assessment

### Strengths
- Factory function `makeScannedCourse()` with override support -- clean pattern
- Proper `waitFor` usage for async state transitions
- Tests cover both happy path and edge cases (cancellation, empty name)
- Mock isolation is correct (scanCourseFolder, persistScannedCourse mocked separately)
- Tests verify both UI state and function call arguments

### Gaps (Advisory)
- **No E2E test for the wizard flow** -- only unit tests exist. An E2E spec would catch integration issues (e.g., actual dialog rendering in the full app context).
- **No test for dialog close button (X)** -- Radix provides this, but a quick test would verify it resets wizard state.
- **No test for persisting error** -- what happens if `persistScannedCourse` rejects? The wizard should show the error state (currently it just stays on the details step with `isPersisting` reset to false, which is fine but untested).

## Verdict: GOOD COVERAGE

12 unit tests cover all primary acceptance criteria. Advisory gaps are minor and non-blocking.
