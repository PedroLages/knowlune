---
story_id: E06-S03
story_name: "Challenge Milestone Celebrations"
status: done
started: 2026-03-08
completed: 2026-03-08
reviewed: true
review_started: 2026-03-08
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 6.3: Challenge Milestone Celebrations

## Story

As a learner,
I want to receive celebratory feedback when I reach 25%, 50%, 75%, and 100% of a challenge target,
So that I feel recognized and motivated as I make progress toward my goals.

## Acceptance Criteria

**Given** a challenge's progress crosses the 25% threshold for the first time
**When** the milestone is detected
**Then** a Sonner toast notification appears with a milestone badge showing "25% Complete" and the challenge name
**And** the milestone is recorded in IndexedDB so it is not triggered again for the same threshold

**Given** a challenge's progress crosses the 50% threshold for the first time
**When** the milestone is detected
**Then** a toast notification appears with a "Halfway There" milestone badge and a supportive message

**Given** a challenge's progress crosses the 75% threshold for the first time
**When** the milestone is detected
**Then** a toast notification appears with a "Almost There" milestone badge and an encouraging message

**Given** a challenge's progress reaches 100%
**When** the milestone is detected
**Then** a toast notification appears with a celebratory "Challenge Complete" badge
**And** the challenge card in the dashboard transitions to a completed state with a distinct visual treatment (e.g., confetti animation, checkmark overlay, gold accent)
**And** the completed challenge is moved to a "Completed" section

**Given** the user has enabled prefers-reduced-motion in their OS settings
**When** a milestone celebration is triggered
**Then** all animations (confetti, badge entrance, card transitions) are suppressed or replaced with instant/static alternatives
**And** the toast and badge content remain fully visible and accessible

**Given** multiple milestones are crossed simultaneously (e.g., progress jumps from 20% to 80%)
**When** the milestones are detected
**Then** the system triggers toasts sequentially for each uncelebrated threshold (25%, 50%, 75%) with a brief stagger delay
**And** each milestone is individually recorded as celebrated in IndexedDB

## Tasks / Subtasks

- [ ] Task 1: Add milestone tracking to Dexie schema (AC: all)
  - [ ] 1.1 Add `celebratedMilestones` field to challenge records or create milestone table
  - [ ] 1.2 Create helper to check/record celebrated milestones
- [ ] Task 2: Implement milestone detection logic (AC: 1-4, 6)
  - [ ] 2.1 Create milestone detection function that compares current vs previous progress
  - [ ] 2.2 Handle simultaneous milestone crossing with sequential stagger
- [ ] Task 3: Create milestone celebration UI components (AC: 1-4)
  - [ ] 3.1 Create MilestoneBadge component with themed variants (25%, 50%, 75%, 100%)
  - [ ] 3.2 Implement Sonner toast notifications with badge and message
- [ ] Task 4: Implement completion state visual treatment (AC: 4)
  - [ ] 4.1 Add confetti animation to challenge card on 100% completion
  - [ ] 4.2 Create completed challenge card visual treatment (checkmark, gold accent)
  - [ ] 4.3 Move completed challenges to "Completed" section
- [ ] Task 5: Accessibility — prefers-reduced-motion support (AC: 5)
  - [ ] 5.1 Detect and respect prefers-reduced-motion
  - [ ] 5.2 Replace animations with static alternatives

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

Round 2: 1 blocker (toast message contrast WCAG AA failure), 3 medium (touch target, chevron motion-reduce, close button), 2 nits. See `docs/reviews/design/design-review-2026-03-08-e06-s03.md`.

## Code Review Feedback

Round 2: 0 blockers, 3 high (celebratedMilestones undefined defense, refreshAllProgress race, confetti double-fire), 3 medium. Testing: 3/6 ACs fully covered, 3 partial. See `docs/reviews/code/code-review-2026-03-08-e06-s03.md` and `docs/reviews/code/code-review-testing-2026-03-08-e06-s03.md`.

## Implementation Plan

See [plan](plans/e06-s03-challenge-milestone-celebrations.md) for implementation approach.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
