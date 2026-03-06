---
story_id: E05-S01
story_name: "Daily Study Streak Counter"
status: done
started: 2026-03-05
completed: 2026-03-06
reviewed: true
review_started: 2026-03-05
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 5.1: Daily Study Streak Counter

## Story

As a learner,
I want to see my current daily study streak prominently on the dashboard,
so that I feel motivated to maintain consistent study habits.

## Acceptance Criteria

**AC1** — **Given** a learner has completed study sessions on consecutive days
**When** they view the Overview dashboard
**Then** a streak counter widget displays the current streak count with a fire emoji
**And** the counter is visually prominent within the dashboard layout

**AC2** — **Given** a learner completes a study session on a new calendar day
**When** the session is recorded
**Then** the streak count increments by one
**And** a pulse animation plays on the streak counter (respecting prefers-reduced-motion)

**AC3** — **Given** a learner views the Overview dashboard
**When** the streak calendar is displayed
**Then** a visual calendar shows study history with color-coded activity levels
**And** the calendar is keyboard-navigable for accessibility

## Tasks / Subtasks

- [x] Task 1: Implement `getStreakSnapshot()` parse-once pattern in `studyLog.ts` (AC: 1, 2)
- [x] Task 2: Build `StudyStreakCalendar` component with streak counter + calendar heatmap (AC: 1, 3)
- [x] Task 3: Add `study-log-updated` CustomEvent dispatch for live updates (AC: 2)
- [x] Task 4: Integrate into Overview page replacing old StudyStreak widget (AC: 1)
- [x] Task 5: Delete orphaned `StudyStreak.tsx` and `studyStreak.ts` (cleanup)
- [x] Task 6: Migrate `ProgressStats.tsx` to use new streak API (cleanup)
- [x] Task 7: Add 53 unit tests for streak logic with DST edge cases (AC: 1, 2, 3)
- [x] Task 8: Add 6 E2E tests in `story-e05-s01.spec.ts` (AC: 1, 2, 3)

## Implementation Notes

- Parse-once pattern: `getStreakSnapshot()` reads localStorage once and derives current streak, longest streak, and 90-day activity array from a single parse
- DST-safe date handling via `toLocalDateString()` (Swedish locale) and `parseLocalDate()` with `Math.round()` on day diffs
- O(n+m) activity counting with pre-built `Map<string, number>`

## Challenges and Lessons Learned

- Round 1 review found 8 issues including a blocker (missing event dispatch for AC2). All resolved in round 2.
- DST-safe date arithmetic requires `setDate(getDate() - 1)` instead of `Date.now() - 86400000`.
