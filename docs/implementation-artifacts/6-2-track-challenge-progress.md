---
story_id: E06-S02
story_name: "Track Challenge Progress"
status: in-progress
started: 2026-03-07
completed:
reviewed: in-progress
review_started: 2026-03-07
review_gates_passed: []
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

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
