---
story_id: E18-S05
story_name: "Integrate Quiz Completion with Study Streaks"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 18.5: Integrate Quiz Completion with Study Streaks

## Story

As a learner,
I want quiz completions to count toward my study streak,
So that taking quizzes contributes to my daily learning activity.

## Acceptance Criteria

**AC1:** Given I complete a quiz, When I submit the quiz, Then useStreakStore is updated with today's activity, And my current streak continues or increments, And if I hadn't studied today yet, today's date is marked as active.

**AC2:** Given I complete multiple quizzes in one day, When submitting each quiz, Then the streak is updated only once per day (idempotent), And additional quizzes don't create duplicate streak entries.

**AC3:** Given I view my streak calendar after completing a quiz, When the calendar displays, Then today's date shows as active (filled dot or color), And the streak counter reflects the quiz completion.

**AC4:** Given the streak recording fails (e.g., localStorage write error), When submitting a quiz, Then the quiz submission still succeeds (streak failure must not block submission), And the error is logged but not shown to the user.

## Tasks / Subtasks

- [ ] Task 1: Add `quiz_complete` to StudyAction type union (AC: 1, 2)
  - [ ] 1.1 Extend `StudyAction.type` union in `src/lib/studyLog.ts`
  - [ ] 1.2 Update `studyDaysFromLog()` to count `quiz_complete` alongside `lesson_complete`
  - [ ] 1.3 Unit tests for new action type and streak counting

- [ ] Task 2: Integrate streak recording into quiz submission (AC: 1, 4)
  - [ ] 2.1 Import `logStudyAction` in `src/stores/useQuizStore.ts`
  - [ ] 2.2 Call `logStudyAction({ type: 'quiz_complete', ... })` in `submitQuiz()` with isolated try/catch
  - [ ] 2.3 Unit tests: submitQuiz calls logStudyAction, failure is non-blocking

- [ ] Task 3: Verify idempotent streak behavior (AC: 2)
  - [ ] 3.1 Unit test: two quiz completions same day → streak incremented once
  - [ ] 3.2 Unit test: quiz + lesson completion same day → streak incremented once

- [ ] Task 4: Verify calendar reflects quiz activity (AC: 3)
  - [ ] 4.1 Unit test: `getStudyActivity()` returns `hasActivity: true` for days with only quiz completions
  - [ ] 4.2 Unit test: `getStreakSnapshot()` includes quiz_complete in streak calculation

- [ ] Task 5: E2E test (AC: 1, 2, 3)
  - [ ] 5.1 E2E: complete quiz → streak counter increments → calendar shows today as active

## Design Guidance

N/A — integration logic only, no UI changes.

## Implementation Notes

**Key architectural finding:** The epic's technical details reference `useStreakStore` and a `streaks` Dexie table, but the actual streak system is `src/lib/studyLog.ts` — a plain-function module backed by localStorage. The implementation must adapt to this real architecture.

**Implementation plan:** [docs/plans/e18-s05-plan.md](../plans/e18-s05-plan.md)

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
