---
story_id: E15-S06
story_name: "Track Time To Completion For Each Attempt"
status: in-progress
started: 2026-03-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 15.6: Track Time-to-Completion for Each Attempt

## Story

As a learner,
I want to see how long I spent on each quiz attempt,
So that I can understand my pacing and efficiency improvements.

## Acceptance Criteria

**Given** I start a quiz
**When** the quiz initializes
**Then** the start time is recorded (ISO 8601 timestamp)

**Given** I complete a quiz
**When** I submit the quiz
**Then** the completion time is recorded
**And** the time spent is calculated as elapsed wall-clock time (completion time - start time)
**And** the time spent is stored in the QuizAttempt record in seconds

**Given** I view the quiz results screen
**When** the results load
**Then** I see my time-to-completion displayed in a human-readable format (e.g., "8m 32s" or "1h 15m 45s")
**And** the time display is prominent but not overwhelming

**Given** I completed an untimed quiz
**When** viewing the results screen
**Then** time-to-completion is tracked but NOT displayed on the results per UX spec

**Given** I have multiple attempts on the same quiz
**When** I view my attempt history
**Then** I see the time spent for each attempt
**And** I can compare my speed across attempts (e.g., "Previous: 10m 15s, Current: 8m 32s")

## Tasks / Subtasks

- [ ] Task 1: Add `showTimeSpent` and `previousAttemptTimeSpent` props to `ScoreSummary` (AC: AC3, AC4, AC5)
  - [ ] 1.1 Add `showTimeSpent?: boolean` prop (default `true`) — hides time for untimed quizzes
  - [ ] 1.2 Add `previousAttemptTimeSpent?: number` prop — shows time comparison row
  - [ ] 1.3 Update aria-live SR text when time is visible

- [ ] Task 2: Update `QuizResults` to pass new props (AC: AC4, AC5)
  - [ ] 2.1 Pass `showTimeSpent={lastAttempt.timerAccommodation !== 'untimed'}` to `ScoreSummary`
  - [ ] 2.2 Calculate `previousAttemptTimeSpent` from prior attempts and pass it

- [ ] Task 3: Add unit tests for new ScoreSummary behavior (AC: AC3, AC4, AC5)
  - [ ] 3.1 Test time hidden when `showTimeSpent={false}`
  - [ ] 3.2 Test time comparison renders correctly
  - [ ] 3.3 Test formatDuration extended edge cases (1h 15m 45s pattern from spec)

- [ ] Task 4: Add E2E spec for E15-S06 (AC: AC2, AC3, AC4, AC5)
  - [ ] 4.1 Timed quiz: complete → see "Completed in Xm Ys"
  - [ ] 4.2 Untimed quiz: complete → no time display
  - [ ] 4.3 Two attempts: see time comparison on second attempt results

## Design Guidance

**Time display (timed quizzes only):**
- "Completed in 8m 32s" — existing line in ScoreSummary, already styled as `text-sm text-muted-foreground`
- For multi-attempt comparison, add a second line: `"Previous: 10m 15s"` in same style

**Untimed quizzes:**
- Time is tracked in DB but not rendered on results screen (AC4 requirement)

**Previous attempt time:**
- Use most-recent prior attempt (not best time — temporal comparison is more intuitive)
- Display only when `showTimeSpent` is true and previous time exists

## Implementation Plan

[docs/implementation-artifacts/plans/2026-03-22-e15-s06-track-time-to-completion.md](plans/2026-03-22-e15-s06-track-time-to-completion.md)

## Implementation Notes

**Key discovery:** The data layer is already complete:
- `QuizProgress.startTime` (ms timestamp) is set in `startQuiz` ✅
- `QuizAttempt.timeSpent` (ms elapsed) is calculated in `submitQuiz` ✅
- `QuizAttempt.startedAt` and `completedAt` are stored ✅
- `formatDuration(ms)` utility exists and is tested ✅
- `ScoreSummary` already displays "Completed in X" ✅

Work remaining:
- AC4: `ScoreSummary` always shows time; needs `showTimeSpent` guard
- AC5: No time comparison UI between attempts exists yet
- E2E tests with Playwright `page.clock` mocking

Note: `timeSpent` is stored in **milliseconds** (not seconds as the epic spec suggests) — consistent with `Date.now()` subtraction and `formatDuration(ms)` input.

## Testing Notes

E2E tests use `page.clock.setSystemTime()` for deterministic time control — no `Date.now()` in tests (ESLint rule `test-patterns/deterministic-time`).

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

Pending — will be populated by `/review-story`.

## Code Review Feedback

Pending — will be populated by `/review-story`.

## Web Design Guidelines Review

Pending — will be populated by `/review-story`.

## Challenges and Lessons Learned

To be documented after implementation. Key areas to watch:
- `timeSpent` is stored in ms (not seconds as the epic spec suggests) — verify `formatDuration` calls are consistent
- Playwright `page.clock.setSystemTime()` must be called before `page.goto()` for `Date.now()` mocking to work in the quiz store
- The `showTimeSpent` guard uses `timerAccommodation === 'untimed'` from the attempt (not `timeLimit` from the quiz)
