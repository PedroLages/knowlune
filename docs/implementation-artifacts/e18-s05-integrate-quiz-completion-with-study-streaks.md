---
story_id: E18-S05
story_name: "Integrate Quiz Completion with Study Streaks"
status: done
started: 2026-03-23
completed: 2026-03-23
reviewed: true
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing, web-design-guidelines-skipped]
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

**Review Date:** 2026-03-23 | **Verdict: PASS** — 0 blockers, 5 HIGH, 5 MEDIUM, 5 nits

**High Priority (should fix):**
- `studyLog.test.ts:424` — test named "only counts lesson_complete actions" is now factually wrong; add `quiz_complete` coverage to `getStudyActivity` suite
- `story-e18-s05.spec.ts` — AC4 listed in file header but no E2E test exists; add test or remove from header
- `useQuizStore.streakIntegration.test.ts` — missing `vi.useFakeTimers()` in beforeEach; timestamp assertions use `expect.any(String)` hiding non-determinism
- `useQuizStore.ts:176` — `metadata` object missing `quizId` and `score` fields per implementation plan
- `activityFromLog` — `lessonCount` field now increments for `quiz_complete`; any UI rendering "N lessons completed" will over-report

**Medium:**
- `studyLog.ts:saveLog` — no try/catch inside `logStudyAction`; 5 call sites in `progress.ts` have no protection (pre-existing, expanded blast radius)
- `story-e18-s05.spec.ts:44` — `TODAY_STR` computed with Node.js timezone; app uses browser timezone; CI timezone mismatch risk
- `story-e18-s05.spec.ts` — `afterEach` doesn't clear `quizzes` IDB store
- `useQuizStore.streakIntegration.test.ts` — asymmetric mock cleanup; switch `beforeEach` to `vi.resetAllMocks()`

**Reports:**
- `docs/reviews/code/code-review-2026-03-23-e18-s05.md`
- `docs/reviews/code/code-review-testing-2026-03-23-e18-s05.md`
- `docs/reviews/code/edge-case-review-2026-03-23-e18-s05.md`

## Web Design Guidelines Review

N/A — no UI changes.

## Challenges and Lessons Learned

**Extending an existing type union is low-risk but requires tracing all consumers:**
Adding `'quiz_complete'` to `StudyAction.type` meant checking every function that switches on `type` — `studyDaysFromLog`, `activityFromLog`, `getStudyLogForCourse`. TypeScript's exhaustiveness checking caught no gaps because the type union uses a string literal (not discriminated union with a default branch). Manual grep was required to verify all sites were updated.

**Fire-and-forget pattern: always wrap in isolated try/catch, never await in the main flow:**
The `logStudyAction` call in `submitQuiz` follows the same pattern already used by `setItemStatus` — DB write first, then side-effect in a non-awaited try/catch. The temptation was to `await` the streak call for cleaner error logging, but that would make streak failures block quiz submission (violating AC4). The pattern is: succeed the primary operation first, then best-effort the side effect.

**E2E date mocking: `addInitScript` is required for app-side timestamp determinism:**
The initial test used `new Date()` inside `page.evaluate()` for today's date comparison. This worked locally but triggered the `test-patterns/deterministic-time` lint error and the pattern validator. The correct approach is to mock `Date` via `page.addInitScript()` so the app's `new Date().toISOString()` in `useQuizStore` writes a known timestamp (`FIXED_DATE`), and assertions reference `TODAY_STR` derived from `FIXED_DATE`. Without the mock, tests pass but are non-deterministic across midnight boundaries.

**Retake quiz flow has different button label ("Retake Quiz" vs "Start Quiz"):**
The `completeQuiz` test helper initially only matched `/start quiz/i`. After completing a quiz and navigating back, the page shows "Retake Quiz" — a different label not covered by the original regex. The fix is `/(start|retake) quiz/i` to handle both states. This was caught by the AC2 idempotency test, which is the only test that exercises the retake flow.

**`seedQuizzes()` helper exists in `indexeddb-seed.ts` but is not widely advertised:**
The first implementation used raw `indexedDB.open()` for quiz seeding (triggered `manualIndexedDB` warning). The shared `seedQuizzes()` wrapper already existed with retry logic. Checking `indexeddb-seed.ts` exports first before writing custom IDB code saves time and produces more robust tests.
