---
story_id: E18-S10
story_name: "Export Quiz Results"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: []
burn_in_validated: false
---

# Story 18.10: Export Quiz Results

## Story

As a learner,
I want to export my quiz attempt history,
so that I can review my performance offline or share it with instructors.

## Acceptance Criteria

**Given** I am viewing quiz analytics in the Reports section
**When** I click "Export Results"
**Then** I can choose between CSV and PDF format

**Given** I export as CSV
**When** the export completes
**Then** a CSV file downloads containing:
  - Quiz name, date, time spent, score (%), pass/fail status
  - Per-question breakdown (question text, selected answer, correct answer, result)

**Given** I export as PDF
**When** the export completes
**Then** a formatted PDF downloads with the same data as CSV
**And** it includes summary statistics (average score, total attempts, best score)

**Given** I have no quiz attempts
**When** I try to export
**Then** the export button is disabled with tooltip: "Complete a quiz to enable export"

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/quizExport.ts` — CSV and PDF generation (AC: 2, 3)
  - [ ] 1.1 Define export data types and column mappings
  - [ ] 1.2 Implement `generateQuizCsv()` using csvSerializer pattern
  - [ ] 1.3 Implement `generateQuizPdf()` using jsPDF
  - [ ] 1.4 Implement summary statistics calculation (avg, total, best)
- [ ] Task 2: Add export button to Reports quiz section (AC: 1, 4)
  - [ ] 2.1 Create `QuizExportButton` component with format dropdown
  - [ ] 2.2 Wire up Dexie queries to load all quiz attempts
  - [ ] 2.3 Implement disabled state with tooltip when no attempts
- [ ] Task 3: Write unit tests for export logic (AC: all)
  - [ ] 3.1 CSV generation produces correct columns and data
  - [ ] 3.2 PDF generation includes summary stats
  - [ ] 3.3 Empty attempts returns empty/disabled state
- [ ] Task 4: Write E2E test for export flow (AC: 1, 2)
  - [ ] 4.1 Navigate to Reports → verify export button
  - [ ] 4.2 Seed quiz data → export → verify file download

## Design Guidance

[To be populated during implementation]

## Implementation Notes

**Plan:** [2026-03-23-e18-s10-export-quiz-results.md](plans/2026-03-23-e18-s10-export-quiz-results.md)

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
