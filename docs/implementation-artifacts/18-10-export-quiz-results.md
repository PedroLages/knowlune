---
story_id: E18-S10
story_name: "Export Quiz Results"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
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

See `docs/reviews/design/design-review-2026-03-23-e18-s10.md`

**High:** H1 — Button text contrast failure in dark mode (brand-outline: 2.76:1, needs 4.5:1); H2 — Export button 32px on mobile (need ≥44px)
**Medium:** M1 — No flex-wrap on mobile layout; M2 — Disabled state shows no supporting text
**Nits:** Download icon duplication; missing aria-busy during export

## Code Review Feedback

See `docs/reviews/code/code-review-2026-03-23-e18-s10.md`

**BLOCKER:** CSV formula injection — `escapeCsv` doesn't sanitize `=`, `+`, `-`, `@` prefixes (quizExport.ts:93)
**High:** Silent DB failure in count query shows misleading "no data" state; `Math.max(...scores)` spread on large arrays; non-deterministic `new Date()` in export filenames
**Medium:** Missing focus indicator on disabled span; `waitForLoadState('networkidle')` fragile; `formatTimeSpent` lacks NaN/negative guard

## Web Design Guidelines Review

See `docs/reviews/code/web-design-guidelines-2026-03-23-e18-s10.md`

**High:** Redundant TooltipProvider wrapper; disabled-state reason not announced via aria-describedby
**Medium:** No keydown guard on disabled span; flash of empty state on load; mr-2 overrides Button gap spacing

## Challenges and Lessons Learned

- **jsPDF bundle size**: Adding jsPDF introduced a ~391 kB minified chunk (`jspdf.es.min`). This is expected for PDF generation but worth noting — the export feature lazy-loads correctly via the existing Vite code-split setup so it doesn't affect initial load.

- **AC4 test — `hasActivity` surface condition**: The disabled-button test requires the Reports analytics section to be visible (`hasActivity=true`). Seeding a `StudySession` does NOT trigger this (study sessions aren't included in the `hasActivity` check). The correct approach is `seedNotes` since `studyNotes > 0` satisfies the condition. The `SEED_NOTE` constant was already defined at the top of the spec for this purpose, but the test body incorrectly referenced the non-existent `seedStudySessions` + `SEED_STUDY_SESSION`. Fixed during review.

- **Radix tooltip strict mode violation**: Radix UI renders `TooltipContent` twice in the DOM (once hidden for positioning calculation, once visible). `page.getByText('...')` resolves to 2 elements and fails strict mode. Fix: use `.first()` to target the initially visible element, or scope to the tooltip portal via a test ID on `TooltipContent`.

- **CSV export bundles as ZIP**: The implementation wraps both CSV files (`quiz-attempts.csv`, `quiz-questions.csv`) in a JSZip archive for a cleaner single-download UX. The E2E test validates the zip structure by reading the downloaded file with `JSZip` in Node — a useful pattern for validating file content beyond just filename/extension.

- **Per-question breakdown in CSV**: The AC required per-question data (question text, selected answer, correct answer, result) in a separate CSV sheet. Splitting into two CSV files (`attempts` + `questions`) within one zip was cleaner than cramming all columns into a single wide CSV — also avoids row-count mismatches between attempt-level and question-level data.

- **`aria-disabled` vs `disabled` for tooltip triggering**: The export button uses `aria-disabled` (not the native HTML `disabled` attribute) because disabled buttons suppress mouse events, preventing the Radix tooltip from firing. Wrapping in a `span[tabindex="0"]` allows hover events to propagate for the tooltip while visually and semantically communicating the disabled state.
