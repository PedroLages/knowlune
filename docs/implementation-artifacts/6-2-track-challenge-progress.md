---
story_id: E06-S02
story_name: "Track Challenge Progress"
status: in-progress
started: 2026-03-07
completed:
reviewed: true
review_started: 2026-03-07
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 6.2: Track Challenge Progress

## Story

As a learner,
I want to see my active challenges with real-time progress indicators,
So that I can understand how close I am to achieving each goal.

## Acceptance Criteria

**Given** the user has one or more active challenges saved in IndexedDB
**When** they view the challenges section
**Then** a dashboard widget displays each active challenge with its name, type icon, progress bar, percentage complete, and remaining time until deadline

**Given** a completion-based challenge exists with a target of N videos
**When** the progress is calculated
**Then** the system counts the user's completed videos from session/completion data since the challenge creation date
**And** the progress bar reflects (completed / target) as a percentage capped at 100%

**Given** a time-based challenge exists with a target of N study hours
**When** the progress is calculated
**Then** the system sums the user's logged study session durations since the challenge creation date
**And** the progress bar reflects (hours logged / target hours) as a percentage capped at 100%

**Given** a streak-based challenge exists with a target of N streak days
**When** the progress is calculated
**Then** the system reads the user's current or longest streak count since the challenge creation date
**And** the progress bar reflects (streak days / target days) as a percentage capped at 100%

**Given** a challenge's deadline has passed and the target was not reached
**When** the user views the challenges section
**Then** the challenge is visually marked as expired with a muted style
**And** it is separated from active challenges (e.g., shown in an "Expired" group or collapsed section)

**Given** no active challenges exist
**When** the user views the challenges section
**Then** an empty state is displayed with a message encouraging the user to create their first challenge
**And** a prominent call-to-action links to the create challenge form

## Tasks / Subtasks

- [ ] Task 1: Progress calculation engine (AC: 2, 3, 4)
  - [ ] 1.1 Completion-based: count completed videos since challenge creation
  - [ ] 1.2 Time-based: sum study session durations since challenge creation
  - [ ] 1.3 Streak-based: read current/longest streak since challenge creation
  - [ ] 1.4 Cap all progress at 100%
- [ ] Task 2: Challenge dashboard widget (AC: 1)
  - [ ] 2.1 Challenge card with name, type icon, progress bar, percentage
  - [ ] 2.2 Remaining time until deadline display
  - [ ] 2.3 Integrate progress calculations into cards
- [ ] Task 3: Expired challenge handling (AC: 5)
  - [ ] 3.1 Detect expired challenges (deadline passed, target not reached)
  - [ ] 3.2 Muted visual style for expired challenges
  - [ ] 3.3 Separate "Expired" group or collapsed section
- [ ] Task 4: Empty state (AC: 6)
  - [ ] 4.1 Empty state message and illustration
  - [ ] 4.2 CTA linking to create challenge form

## Implementation Plan

See [plan](plans/e06-s02-track-challenge-progress.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

**2026-03-07** — 2 high, 2 medium, 3 nits. No blockers.
- H1: Heading level skips H2 (WCAG 1.3.1) — add sr-only H2 before active grid
- H2: CollapsibleTrigger missing focus-visible ring
- M1: Progress bar aria-label is generic (doesn't identify challenge)
- M2: Loading state needs `role="status"` / `aria-live="polite"`
Report: `docs/reviews/design/design-review-2026-03-07-e06-s02.md`

## Code Review Feedback

**2026-03-07** — 0 blockers, 3 high, 4 medium, 3 nits.
- HIGH: String date comparison in `calculateCompletionProgress` — use `new Date()` parsing
- HIGH: useEffect missing cleanup (stale updates on unmount)
- HIGH: Optimistic UI update before DB write in `refreshAllProgress`
- MEDIUM: Streak progress not scoped to challenge creation date (contradicts AC4)
- MEDIUM: Full table scan for completion progress (no `updatedAt` index)
- MEDIUM: CollapsibleTrigger icon missing `aria-hidden`
- MEDIUM: E2E afterEach IDB cleanup swallows errors
Report: `docs/reviews/code/code-review-2026-03-07-e06-s02.md`

**Test Coverage (2026-03-07)** — 2/6 ACs fully covered, 3 partial, 1 code-path-only.
- HIGH: `refreshAllProgress` has zero unit tests (confidence 95)
- HIGH: 100% cap untested at every layer (confidence 92)
- HIGH: Streak unit test is a no-op (confidence 90)
- HIGH: AC5 never asserts muted style (confidence 88)
Report: `docs/reviews/code/code-review-testing-2026-03-07-e06-s02.md`

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
