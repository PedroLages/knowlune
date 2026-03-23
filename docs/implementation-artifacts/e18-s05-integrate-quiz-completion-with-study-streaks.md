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

**Given** I complete a quiz
**When** I submit the quiz
**Then** the study log is updated with today's activity
**And** my current streak continues or increments
**And** if I hadn't studied today yet, today's date is marked as active

**Given** I complete multiple quizzes in one day
**When** submitting each quiz
**Then** the streak is updated only once per day (idempotent)
**And** additional quizzes don't create duplicate streak entries

**Given** I view my streak calendar after completing a quiz
**When** the calendar displays
**Then** today's date shows as active (filled dot or color)
**And** the streak counter reflects the quiz completion

**Given** the streak recording fails (e.g., localStorage write error)
**When** submitting a quiz
**Then** the quiz submission still succeeds (streak failure must not block submission)
**And** the error is logged but not shown to the user

## Tasks / Subtasks

- [x] Task 1: Extend `StudyAction.type` with `'quiz_complete'` and update streak math (AC: 1, 2, 3)
  - [x] 1.1 Add `'quiz_complete'` to `StudyAction.type` union in `studyLog.ts`
  - [x] 1.2 Update `studyDaysFromLog` to count `quiz_complete` toward streak
  - [x] 1.3 Update `activityFromLog` to count `quiz_complete` in calendar activity
- [x] Task 2: Wire `submitQuiz` to `logStudyAction` (fire-and-forget) (AC: 1, 4)
  - [x] 2.1 Import `logStudyAction` in `useQuizStore.ts`
  - [x] 2.2 Call `logStudyAction({ type: 'quiz_complete', ... })` after successful DB write
  - [x] 2.3 Wrap in isolated try/catch — failure logs but does not block submission
- [x] Task 3: Unit tests for streak integration
  - [x] 3.1 `submitQuiz` calls `logStudyAction` on success
  - [x] 3.2 `logStudyAction` failure does not block quiz submission
  - [x] 3.3 `studyDaysFromLog` counts `quiz_complete` toward streak calculation
  - [x] 3.4 Calendar activity counts `quiz_complete`
- [x] Task 4: E2E test spec

## Implementation Notes

**Architecture decision:** No new `useStreakStore` was created. The codebase uses a
compute-on-demand snapshot pattern — `logStudyAction()` writes to `localStorage['study-log']`
and emits a `study-log-updated` event. The `StudyStreakCalendar` listens to this event and
recomputes the streak from scratch. Adding `quiz_complete` to the log type union + updating
the streak math is sufficient.

**Fire-and-forget pattern:** Identical to the existing `setItemStatus` cross-store call in
`submitQuiz`. Quiz attempt DB write must succeed first, then streak logging happens in an
isolated try/catch. Streak failure never rolls back the quiz attempt.

**Idempotency:** Naturally handled by `studyDaysFromLog` which deduplicates by date. Multiple
`quiz_complete` events on the same day all resolve to the same YYYY-MM-DD key.

## Testing Notes

- `logStudyAction` is called synchronously (localStorage write) — no async concerns in tests
- Uses `vi.spyOn(studyLogModule, 'logStudyAction')` pattern after dynamic `vi.resetModules()`
- `studyLog.test.ts` extended with `quiz_complete` streak calculation tests

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions — N/A (no new components)
- [x] No optimistic UI updates before persistence — streak logged after DB write
- [x] Type guards on all dynamic lookups — N/A
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocalDateString` pattern (not `toISOString().split('T')[0]`)
- [x] No external APIs — N/A

## Design Review Feedback

N/A — integration logic only, no UI changes.

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

N/A — no UI changes.

## Challenges and Lessons Learned

[To be filled after implementation]
