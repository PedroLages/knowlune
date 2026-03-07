---
story_id: E05-S06
story_name: "Streak Milestone Celebrations"
status: done
started: 2026-03-07
completed: 2026-03-07
reviewed: true
review_started: 2026-03-07
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 5.6: Streak Milestone Celebrations

## Story

As a learner,
I want to receive celebratory notifications when I hit streak milestones,
So that I feel rewarded for my consistency and motivated to keep going.

## Acceptance Criteria

**Given** a learner's streak count reaches 7 days
**When** the milestone is triggered
**Then** a Sonner toast notification appears with a 7-day milestone badge
**And** a celebratory animation plays (confetti, sparkle, or equivalent)
**And** the badge is saved to the learner's milestone collection

**Given** a learner's streak count reaches 30 days
**When** the milestone is triggered
**Then** a toast notification appears with a 30-day milestone badge and celebration animation

**Given** a learner's streak count reaches 60 days
**When** the milestone is triggered
**Then** a toast notification appears with a 60-day milestone badge and celebration animation

**Given** a learner's streak count reaches 100 days
**When** the milestone is triggered
**Then** a toast notification appears with a 100-day milestone badge and celebration animation

**Given** a learner has the prefers-reduced-motion media query active
**When** any milestone celebration triggers
**Then** the celebratory animation is suppressed or replaced with a static badge display
**And** the toast notification still appears with the badge

**Given** a learner has earned milestone badges
**When** they view their milestone collection (accessible from the streak widget or profile)
**Then** all earned badges are displayed with the date achieved
**And** unearned milestones are shown as locked or dimmed placeholders

**Given** a learner's streak resets and they reach a milestone again
**When** the repeated milestone is triggered
**Then** the celebration toast appears again
**And** the new achievement date is recorded alongside the previous one

## Tasks / Subtasks

- [ ] Task 1: Add milestone data model to Dexie schema (AC: all)
  - [ ] 1.1 Add `streakMilestones` table to IndexedDB schema
  - [ ] 1.2 Define milestone types (7, 30, 60, 100 days)
- [ ] Task 2: Implement milestone detection logic (AC: 1-4, 7)
  - [ ] 2.1 Add milestone check to streak increment flow
  - [ ] 2.2 Handle repeat milestones after streak reset
- [ ] Task 3: Create celebration toast notifications (AC: 1-4)
  - [ ] 3.1 Design milestone badge components for each tier
  - [ ] 3.2 Integrate with Sonner toast system
- [ ] Task 4: Add confetti/celebration animation (AC: 1-4, 5)
  - [ ] 4.1 Implement celebration animation
  - [ ] 4.2 Respect prefers-reduced-motion
- [ ] Task 5: Build milestone collection view (AC: 6)
  - [ ] 5.1 Create milestone gallery component
  - [ ] 5.2 Show earned badges with dates
  - [ ] 5.3 Show locked/dimmed placeholders for unearned
  - [ ] 5.4 Make accessible from streak widget

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

**2026-03-07 (R2)** — 2 blockers, 1 high, 3 medium, 2 nits. Report: `docs/reviews/design/design-review-2026-03-07-e05-s06.md`

Blockers: (1) Restore `tabIndex={0}` on heatmap cells — keyboard users can't access tooltips (WCAG 2.1.1), (2) Remove `role="status"` from toast — causes double screen reader announcement inside Sonner's `aria-live`.
High: Locked gallery badges missing accessible "Locked" context for screen readers.

## Code Review Feedback

**2026-03-07 (R2)** — 2 blockers, 3 high, 2 medium, 3 nits. Report: `docs/reviews/code/code-review-2026-03-07-e05-s06.md`

Blocker: (1) Uncommitted working tree changes — branch ships broken code without sessionStorage dedup guard, missing TIER_CONFIG refactor, missing cn() usage. (2) AC7 E2E seed missing `streakStartDate` — test passes for wrong reason (fix exists in working tree, needs commit).
High: MilestoneGallery stale data on popover open, useEffect empty deps on celebrateMilestones, confetti useEffect keyed on milestoneValue instead of id.

**Test Coverage 2026-03-07 (R2)** — 0/7 ACs fully covered (all partial). Report: `docs/reviews/code/code-review-testing-2026-03-07-e05-s06.md`

High: AC7 seed missing streakStartDate + no persistence assertion, AC5 missing badge assertion, AC1 confetti split from badge test, AC6 date regex `/\d/` too broad, sessionStorage not cleared between tests.

## Implementation Plan

See [plan](plans/e05-s06-streak-milestone-celebrations.md) for implementation approach.

## Challenges and Lessons Learned

- **Test seed data must mirror runtime shape exactly.** The AC7 blocker arose because the E2E seed omitted `streakStartDate`, so `getUncelebratedMilestones()` never matched — the test passed for the wrong reason. Always copy the full type shape when seeding test data.
- **Commit all working changes before requesting code review.** R1 flagged uncommitted fixes as blockers because the review ran against the committed snapshot. Stage and commit iterative fixes before triggering review.
- **Use `cn()` consistently for conditional classNames.** String interpolation with template literals works but breaks the project convention and makes Tailwind class merging unreliable. `cn()` from `@/app/components/ui/utils` is the standard.
- **Canvas-confetti colors bypass the theme system.** Confetti hex colors can't use CSS variables — this is an acceptable deviation for third-party canvas libraries. Document in code comments.
- **`prefers-reduced-motion` testing in Playwright.** Use `page.emulateMedia({ reducedMotion: 'reduce' })` before navigation. Assert both animation suppression AND continued badge/toast display.
