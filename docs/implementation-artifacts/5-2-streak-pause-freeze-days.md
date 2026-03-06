---
story_id: E05-S02
story_name: "Streak Pause & Freeze Days"
status: done
started: 2026-03-06
completed: 2026-03-06
reviewed: true
review_started: 2026-03-06
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 5.2: Streak Pause & Freeze Days

## Story

As a learner,
I want to pause my streak or configure weekly freeze days,
So that I can take planned rest days without losing my streak progress.

## Acceptance Criteria

**Given** a learner has an active study streak
**When** they toggle the streak pause control
**Then** the streak enters a paused state
**And** the dashboard streak counter displays a paused indicator (e.g., pause icon or "Paused" label)
**And** the streak count is preserved and does not reset while paused

**Given** a learner has a paused streak
**When** they resume the streak
**Then** the paused state is cleared
**And** the streak counter resumes from its previous value
**And** the 24-hour inactivity window resets from the moment of resumption

**Given** a learner wants to configure freeze days
**When** they open the freeze day settings
**Then** they can select 1 to 3 days of the week as freeze days
**And** the selected days are visually indicated

**Given** a learner has configured freeze days
**When** a freeze day passes with no study activity
**Then** the streak does not reset
**And** the freeze day is recorded distinctly in the study history
**And** the streak counter from Story 5.1 respects freeze days in its 24-hour evaluation

**Given** a learner studies on a configured freeze day
**When** the session is recorded
**Then** the day counts as a regular study day (not consumed as a freeze)
**And** the streak increments normally

**Given** a learner attempts to select more than 3 freeze days
**When** they try to toggle a fourth day
**Then** the selection is prevented
**And** a validation message explains the maximum of 3 freeze days per week

**Given** a learner has both a paused streak and configured freeze days
**When** the streak is paused
**Then** freeze day logic is suspended until the streak is resumed

## Tasks / Subtasks

- [ ] Task 1: Extend streak data model for pause state and freeze days (AC: 1-2, 7)
  - [ ] 1.1 Add `isPaused`, `pausedAt` fields to streak store
  - [ ] 1.2 Add `freezeDays` (array of day indices) to streak config
  - [ ] 1.3 Update streak evaluation logic to respect pause and freeze states
- [ ] Task 2: Implement streak pause/resume UI (AC: 1-2)
  - [ ] 2.1 Add pause/resume toggle to streak widget on dashboard
  - [ ] 2.2 Display paused indicator on streak counter
  - [ ] 2.3 Reset 24-hour window on resume
- [ ] Task 3: Implement freeze day configuration UI (AC: 3, 6)
  - [ ] 3.1 Create freeze day selector component (day-of-week picker)
  - [ ] 3.2 Enforce max 3 freeze days with validation message
  - [ ] 3.3 Visual indication of selected freeze days
- [ ] Task 4: Update streak evaluation logic for freeze days (AC: 4-5, 7)
  - [ ] 4.1 Skip streak reset on freeze days with no activity
  - [ ] 4.2 Record freeze days distinctly in study history
  - [ ] 4.3 Count study on freeze day as regular day
  - [ ] 4.4 Suspend freeze logic when streak is paused

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

Report: [design-review-2026-03-06-e05-s02.md](../reviews/design/design-review-2026-03-06-e05-s02.md)

**Re-review #3:** All previous high findings fixed. Mobile overflow resolved, heatmap cells use div+role="img", theme tokens applied.
**0 high.** **2 medium:** Dialog focus restore race with Radix; --primary token renders near-black vs blue-600.

## Code Review Feedback

Report: [code-review-2026-03-06-e05-s02.md](../reviews/code/code-review-2026-03-06-e05-s02.md)
Test coverage: [code-review-testing-2026-03-06-e05-s02.md](../reviews/code/code-review-testing-2026-03-06-e05-s02.md)

**Re-review #3:** All previous high fixes verified correct. No blockers (uncommitted code expected per workflow).
**High (warnings):** getLongestStreak() standalone doesn't pass freeze days; calculateStreakFromDate no safety bound; clearStreakPause() side effect in getter.
**Test coverage:** 5/7 ACs covered, 2 partial (AC2 24h reset, AC4 "distinctly" UI).

## Implementation Plan

See [plan](plans/e05-s02-streak-pause-freeze-days.md) for implementation approach.

## Challenges and Lessons Learned

### Patterns

- **Feature interaction testing**: AC7 (pause suspends freeze) required a distinguishing test — same seed data must produce different results with/without the feature. `seedStudyDays([0, 2])` + `freezeDays=[3]` yields streak=2 without pause, streak=1 with pause. Without this, the test could pass vacuously.
- **Defense-in-depth validation**: Freeze days validated on both write (`setFreezeDays` truncates to 3, filters invalid indices) and read (`getFreezeDays` re-validates). Protects against corrupted localStorage or direct manipulation.
- **Backward walk for streak calculation**: `calculateStreakFromDate` walks backward from a start date, skipping freeze days. Reused by both `currentStreakFromDays` and `longestStreakFromDays`, eliminating logic duplication.

### Pitfalls

- **Multi-day pause loses streak**: Initial implementation started streak walk from today/yesterday. When paused for multiple days, the walk found no recent activity and returned 0. Fix: start from `studyDays[studyDays.length - 1]` (most recent study day) when paused.
- **getLongestStreak() standalone API**: The standalone function didn't pass freeze days, making it inconsistent with `getStreakSnapshot`. Caught by code review — always check standalone wrappers when adding parameters to internal helpers.
- **Side effects in getters**: `clearStreakPause()` was called inside `currentStreakFromDays` when pause expired. This mutates localStorage and dispatches events during a calculation, risking re-entrant snapshot refreshes. Flagged as a warning — acceptable for current localStorage-based architecture but would need refactoring for reactive state.

### Review Cycles

- 3 review cycles to resolve all findings. Round 1 fixed 5 issues (multi-day pause, O(n) lookups, hardcoded colors, mobile overflow, dialog focus). Round 2 fixed 5 more (freeze-aware longestStreak, consolidated Date(), getCurrentStreak with freeze days, heatmap semantics, AC7 distinguishing test). Round 3 verified all fixes, surfaced warnings only.
