---
story_id: E18-S11
story_name: "Track Quiz Progress In Content Completion"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 18.11: Track Quiz Progress in Content Completion

## Story

As a learner,
I want quiz completion to mark the associated lesson as complete,
So that my content progress accurately reflects quiz-based learning activities.

## Acceptance Criteria

**AC1:** Given I complete a quiz with a passing score, When the quiz results are saved, Then `useContentProgressStore.setItemStatus(lessonId, 'completed')` is called And the associated lesson shows as completed in the course progress UI.

**AC2:** Given I complete a quiz but do NOT achieve a passing score, When the quiz results are saved, Then the lesson is NOT marked as complete And the lesson progress remains unchanged.

**AC3:** Given I retake a quiz and achieve a passing score, When the quiz results are saved, Then the lesson is marked as complete (if not already).

**AC4:** Given the content progress update fails, When the quiz submission completes, Then the quiz result is still saved successfully (progress failure is non-blocking) And the error is logged.

## Implementation Plan

See: [plans/e18-s11-track-quiz-progress-plan.md](plans/e18-s11-track-quiz-progress-plan.md)

## Tasks / Subtasks

- [ ] Task 1: Validate existing cross-store integration in useQuizStore.submitQuiz (AC: 1, 2, 3, 4)
- [ ] Task 2: Add retake-specific unit test for idempotent completion (AC: 3)
- [ ] Task 3: Write E2E test — pass quiz → lesson shows completed in course view (AC: 1)
- [ ] Task 4: Write E2E test — fail quiz → lesson NOT completed (AC: 2)
- [ ] Task 5: Verify console.error logging on progress failure path (AC: 4)

## Design Guidance

N/A — integration logic only, no UI changes.

## Implementation Notes

**Key finding:** The core cross-store integration is already implemented in `useQuizStore.ts:152-165` (done as part of E12-S03-AC5). This story primarily validates completeness and adds E2E coverage.

## Testing Notes

Unit tests exist in `src/stores/__tests__/useQuizStore.crossStore.test.ts`. E2E coverage for the quiz→progress integration does not yet exist.

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
