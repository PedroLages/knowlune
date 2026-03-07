---
story_id: E05-S03
story_name: "Study Goals & Weekly Adherence"
status: done
started: 2026-03-06
completed: 2026-03-07
reviewed: true
review_started: 2026-03-07
review_gates_passed: [build, lint-skipped, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 5.3: Study Goals & Weekly Adherence

## Story

As a learner,
I want to set daily or weekly study goals and see my progress against them,
So that I can hold myself accountable to a consistent study schedule.

## Acceptance Criteria

**Given** a learner has not configured any study goals
**When** they view the goals widget on the dashboard
**Then** an empty state prompts them to set their first goal with a clear call-to-action

**Given** a learner wants to configure a study goal
**When** they open the goal configuration form
**Then** they can choose between a daily goal or a weekly goal
**And** they can select goal type as time-based (minutes per day/week) or session-based (sessions per day/week)
**And** they can set a numeric target value

**Given** a learner has an active daily study goal
**When** they view the Overview dashboard
**Then** a progress widget shows current progress toward today's goal (e.g., "45 / 60 min")
**And** a visual progress indicator (progress bar or ring) reflects the percentage completed

**Given** a learner has an active weekly study goal
**When** they view the Overview dashboard
**Then** the widget shows weekly cumulative progress against the weekly target

**Given** a learner has been active for at least one week with a goal configured
**When** they view the dashboard or analytics
**Then** a weekly adherence percentage is displayed calculated as (actual study days / target study days) x 100
**And** the adherence percentage updates in real time as sessions are completed

**Given** a learner meets their daily or weekly goal
**When** the goal threshold is reached
**Then** the progress widget visually indicates completion (e.g., filled ring, checkmark)

## Tasks / Subtasks

- [ ] Task 1: Create study goal Zustand store (AC: 2, 3, 4, 5, 6)
  - [ ] 1.1 Define goal types (daily/weekly, time/session-based)
  - [ ] 1.2 Persist goals in Dexie.js
  - [ ] 1.3 Compute daily/weekly progress from session history
  - [ ] 1.4 Calculate weekly adherence percentage
- [ ] Task 2: Build goal configuration form (AC: 1, 2)
  - [ ] 2.1 Empty state with CTA in goals widget
  - [ ] 2.2 Goal type selection (daily/weekly)
  - [ ] 2.3 Goal metric selection (time/sessions)
  - [ ] 2.4 Numeric target input with validation
- [ ] Task 3: Build progress widget for Overview dashboard (AC: 3, 4, 6)
  - [ ] 3.1 Progress ring/bar component
  - [ ] 3.2 Daily progress display
  - [ ] 3.3 Weekly progress display
  - [ ] 3.4 Goal completion visual indicator
- [ ] Task 4: Weekly adherence display (AC: 5)
  - [ ] 4.1 Adherence percentage calculation
  - [ ] 4.2 Adherence display on dashboard

## Implementation Plan

See [plan](plans/e05-s03-study-goals-weekly-adherence.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

See [design-review-2026-03-07-e05-s03.md](../reviews/design/design-review-2026-03-07-e05-s03.md).

**Re-run (post-fixes):** Previous blockers resolved. Remaining:
- 2 High: CTA button 32px, dialog footer buttons 36px (touch targets)
- 2 Medium: Custom input 38px, no aria-live on widget wrapper
- 1 Nit: OptionCard buttons lack aria-pressed

## Code Review Feedback

See [code-review-2026-03-07-e05-s03.md](../reviews/code/code-review-2026-03-07-e05-s03.md) and [code-review-testing-2026-03-07-e05-s03.md](../reviews/code/code-review-testing-2026-03-07-e05-s03.md).

**Re-run (post-fixes):** Previous blockers (div/zero, touch target, aria-hidden, non-null assertions) all resolved. Remaining:
- 3 High (code): Inconsistent week definition, handleSave validation, getStudyLog validation
- 3 Medium (code): ProgressRing cn(), custom input, isToday midnight risk
- 4 High (testing): Uncommitted state (process), AC5 shallow assertion
- 3 Medium (testing): Weekly frequency path, sessions-weekly test, preset buttons

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
