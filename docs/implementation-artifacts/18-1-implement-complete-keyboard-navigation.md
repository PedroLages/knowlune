---
story_id: E18-S01
story_name: "Implement Complete Keyboard Navigation"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 18.1: Implement Complete Keyboard Navigation

## Story

As a learner using only a keyboard,
I want to navigate and complete quizzes without using a mouse,
So that I can access quiz features independently.

## Acceptance Criteria

**Given** I am navigating the quiz using only keyboard
**When** I press Tab
**Then** focus moves sequentially through all interactive elements in logical order:
  - Answer options (radio buttons or checkboxes)
  - "Mark for Review" toggle
  - Navigation buttons (Previous, Next, Submit)
  - Question grid

**Given** the quiz starts or I navigate to a new question
**When** the question renders
**Then** the question text container (with `tabindex="-1"`) receives programmatic focus via `useEffect` keyed on `currentQuestionIndex`
**And** screen readers announce the question text
**But** the question text is NOT reachable via Tab (it is not in the tab order)

**Given** I am answering a multiple choice question
**When** using keyboard controls
**Then** I can Tab to the first radio button
**And** I can use Arrow keys (Up/Down) to select different options
**And** I can press Space to select the focused option

**Given** I am answering a multiple select question
**When** using keyboard controls
**Then** I can Tab to each checkbox independently
**And** I can press Space to toggle each checkbox

**Given** I want to navigate to a specific question
**When** the question grid has focus
**Then** I can use Arrow Left/Right to move between question numbers
**And** I can press Enter to jump to that question

**Given** I press Escape anywhere in the quiz
**When** a modal or dialog is open
**Then** it closes and focus returns to the trigger element
**And** focus is trapped within the modal while it is open (Tab and Shift+Tab cycle within modal boundaries)

## Implementation Plan

See [plan](plans/e18-s01-keyboard-navigation.md)

## Tasks / Subtasks

- [ ] Task 1: Add `tabIndex={-1}` question text ref + programmatic focus on question change (AC: #2)
- [ ] Task 2: Implement roving tabindex arrow navigation in QuestionGrid (AC: #5)
- [ ] Task 3: Verify/enhance RadioGroup keyboard behavior for MC/TF questions (AC: #3)
- [ ] Task 4: Verify/enhance Checkbox keyboard behavior for MultipleSelect (AC: #4)
- [ ] Task 5: Ensure logical tab order across entire quiz page (AC: #1)
- [ ] Task 6: Verify AlertDialog focus trap and Escape behavior (AC: #6)
- [ ] Task 7: Enhance focus indicators for WCAG 4.5:1 contrast
- [ ] Task 8: Write E2E tests for keyboard-only quiz completion
- [ ] Task 9: Write E2E tests for QuestionGrid arrow navigation
- [ ] Task 10: Write E2E tests for modal focus trap and Escape

## Design Guidance

Focus indicators should use the existing `focus-visible:ring-[3px] focus-visible:ring-ring/50` pattern established in the codebase. The QuestionGrid arrow navigation should follow WAI-ARIA grid pattern with roving tabindex. Modal dialogs already use Radix UI AlertDialog which provides built-in focus trapping.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
