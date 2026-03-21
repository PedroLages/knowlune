---
story_id: E14-S03
story_name: "Display Fill-in-Blank Questions"
status: in-progress
started: 2026-03-21
completed:
reviewed: in-progress
review_started: 2026-03-21
review_gates_passed: []
burn_in_validated: false
---

# Story 14.3: Display Fill-in-Blank Questions

## Story

As a learner,
I want to answer Fill-in-Blank questions by typing text,
So that I can demonstrate recall without multiple choice hints.

## Acceptance Criteria

**Given** a quiz with Fill-in-Blank questions
**When** I view a Fill-in-Blank question
**Then** I see the question text clearly displayed
**And** I see a text input field with a placeholder (e.g., "Type your answer here")
**And** the input field is appropriately sized (not too small)
**And** I can type my answer freely

**Given** I type an answer
**When** I enter text into the input field
**Then** my input is saved to quiz state with a 300ms debounce
**And** my answer persists if I navigate away and return
**And** the input enforces a maximum of 500 characters
**And** a character counter displays the current count (e.g., "42 / 500")
**And** input is prevented beyond 500 characters

**Given** Fill-in-Blank scoring
**When** the quiz is submitted
**Then** my answer is compared to the correct answer
**And** the comparison is case-insensitive (e.g., "React" = "react" = "REACT")
**And** leading/trailing whitespace is trimmed before comparison
**And** the score is all-or-nothing (0% or 100%)

**Given** semantic HTML structure
**When** the component renders
**Then** it uses `<fieldset>/<legend>` structure to associate the question text with the input field

## Tasks / Subtasks

- [ ] Task 1: Create FillInBlankQuestion component (AC: 1, 2, 4)
  - [ ] 1.1 Create `src/app/components/quiz/questions/FillInBlankQuestion.tsx`
  - [ ] 1.2 Implement text input with placeholder and 500-char limit
  - [ ] 1.3 Add character counter display
  - [ ] 1.4 Implement 300ms debounce for state saving
  - [ ] 1.5 Use fieldset/legend semantic structure
- [ ] Task 2: Integrate into QuestionDisplay (AC: 1)
  - [ ] 2.1 Add 'fill-in-blank' case to QuestionDisplay.tsx
- [ ] Task 3: Add fill-in-blank scoring logic (AC: 3)
  - [ ] 3.1 Update scoring.ts with case-insensitive, trimmed comparison
- [ ] Task 4: Write E2E tests (AC: 1, 2, 3)
  - [ ] 4.1 Test typing updates input
  - [ ] 4.2 Test answer persistence on navigation
  - [ ] 4.3 Test case-insensitive scoring
  - [ ] 4.4 Test character counter and limit

## Implementation Plan

See [plan](plans/e14-s03-fill-in-blank-questions.md) for implementation approach.

## Implementation Notes

- Created `FillInBlankQuestion` component (~85 lines) with `useEffect` + `setTimeout` debounce pattern
- Reused existing scoring logic from `src/lib/scoring.ts` (case-insensitive, trim comparison already scaffolded in E12-S06)
- Added `fill-in-blank` case to `QuestionDisplay.tsx` switch — minimal integration (10 lines)
- `onBlur` handler provides immediate save as safety net before debounce timer fires
- `isInitialMount` ref prevents unnecessary store update on first render

## Testing Notes

- 7 E2E tests covering all 4 ACs, 8 unit tests in QuestionDisplay.test.tsx
- Used `input.blur()` instead of `waitForTimeout(500)` to trigger immediate save — deterministic, no timing dependency
- Updated "unsupported type" unit tests from `fill-in-blank` to `essay` since fill-in-blank is now supported
- Quiz seeding uses `makeQuiz`/`makeQuestion` factories with `fill-in-blank` type

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

- Fill-in-blank scoring was already scaffolded in E12-S06 (`src/lib/scoring.ts:20-26`) — no scoring changes needed
- Debounce pattern uses `useEffect` + `setTimeout` with `isInitialMount` ref to prevent unnecessary store update on first render
- `onBlur` handler provides immediate save as safety net before debounce timer fires
