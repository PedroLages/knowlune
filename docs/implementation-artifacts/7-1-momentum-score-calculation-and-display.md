---
story_id: E07-S01
story_name: "Momentum Score Calculation And Display"
status: done
started: 2026-03-08
completed: 2026-03-08
reviewed: true    # false | in-progress | true
review_started: 2026-03-08  # YYYY-MM-DD — set when /review-story begins
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
plan: docs/implementation-artifacts/plans/e07-s01-momentum-score-calculation-and-display.md
---

# Story 7.1: Momentum Score Calculation & Display

## Story

As a learner,
I want to see a momentum score for each course displayed as a hot, warm, or cold indicator and be able to sort my course list by momentum,
so that I can instantly identify which courses have strong engagement momentum and prioritize my study time accordingly.

## Acceptance Criteria

**Given** a course exists in the user's library with recorded study sessions
**When** the system calculates the momentum score
**Then** the score is computed as a weighted function of study recency (days since last session, normalized inversely), completion percentage, and study frequency (sessions per week over the past 30 days)
**And** the resulting score is a value between 0 and 100

**Given** a course has a calculated momentum score
**When** the course card is rendered in the course library
**Then** a visual indicator is displayed showing hot (score >= 70), warm (score 30-69), or cold (score < 30) using distinct colors and iconography (e.g., flame for hot, sun for warm, snowflake for cold)

**Given** a course has no recorded study sessions
**When** the momentum score is calculated
**Then** the score defaults to 0 and the indicator displays as cold

**Given** the course library is displayed
**When** the user selects "Sort by Momentum" from the sort options
**Then** courses are ordered from highest to lowest momentum score
**And** the hot/warm/cold indicator remains visible on each course card in the sorted view

**Given** the user completes a study session for a course
**When** the session is recorded
**Then** the momentum score for that course recalculates within the same page session without requiring a full page reload

## Tasks / Subtasks

- [ ] Task 1: Implement momentum score calculation library (AC: #1, #3)
  - [ ] 1.1 Create `src/lib/momentum.ts` with `calculateMomentumScore(courseId, sessions)` pure function
  - [ ] 1.2 Define formula: recency weight (40%) + completion weight (30%) + frequency weight (30%)
  - [ ] 1.3 Export `MomentumTier` type and `getMomentumTier(score)` helper
  - [ ] 1.4 Export `MomentumScore` interface

- [ ] Task 2: Unit tests for momentum calculation (AC: #1, #3)
  - [ ] 2.1 Create `src/lib/__tests__/momentum.test.ts`
  - [ ] 2.2 Test score range [0, 100]
  - [ ] 2.3 Test zero-session default (score = 0, tier = cold)
  - [ ] 2.4 Test hot/warm/cold tier thresholds
  - [ ] 2.5 Test recency normalization (recent sessions boost score)
  - [ ] 2.6 Test frequency component

- [ ] Task 3: Create MomentumBadge component (AC: #2)
  - [ ] 3.1 Create `src/app/components/figma/MomentumBadge.tsx`
  - [ ] 3.2 Hot: flame icon, orange/red color scheme
  - [ ] 3.3 Warm: sun icon, amber/yellow color scheme
  - [ ] 3.4 Cold: snowflake icon, blue/slate color scheme
  - [ ] 3.5 Show numeric score on hover (tooltip or badge)
  - [ ] 3.6 Proper ARIA label (e.g., "Momentum: Hot (82)")
  - [ ] 3.7 Respect prefers-reduced-motion

- [ ] Task 4: Integrate MomentumBadge into CourseCard (AC: #2)
  - [ ] 4.1 Add momentum score prop to `CourseCard` (optional, only shown in 'library' variant)
  - [ ] 4.2 Position badge on thumbnail (bottom-left, beside info button)

- [ ] Task 5: Integrate MomentumBadge into ImportedCourseCard (AC: #2)
  - [ ] 5.1 Add momentum score prop to `ImportedCourseCard`
  - [ ] 5.2 Same positioning as CourseCard

- [ ] Task 6: Sort by Momentum in Courses page (AC: #4)
  - [ ] 6.1 Add "Sort by Momentum" option to sort controls in `Courses.tsx`
  - [ ] 6.2 Load momentum scores for all courses asynchronously
  - [ ] 6.3 Apply sort when "Sort by Momentum" is active

- [ ] Task 7: Real-time momentum recalculation (AC: #5)
  - [ ] 7.1 Listen to study session events (or store subscription) in Courses page
  - [ ] 7.2 Trigger score refresh on session end without page reload

- [ ] Task 8: E2E tests (AC: #2, #4)
  - [ ] 8.1 Create `tests/e2e/story-e07-s01.spec.ts`
  - [ ] 8.2 Verify momentum indicator renders on course cards
  - [ ] 8.3 Verify "Sort by Momentum" option is present
  - [ ] 8.4 Verify indicator tier labels are accessible (ARIA)

## Implementation Notes

[To be populated during implementation — see plan for architecture decisions]

## Testing Notes

[To be populated during implementation]

## Design Review Feedback

**Reviewed**: 2026-03-08 | Report: `docs/reviews/design/design-review-2026-03-08-e07-s01.md`

- **Blocker**: MomentumBadge hardcoded colors need dark mode variants for WCAG AA contrast
- **High**: Badge `<span>` needs `tabIndex={0}` for keyboard tooltip access
- **Medium**: ImportedCourseCard momentum prop not wired up — document scope boundary

## Code Review Feedback

**Reviewed**: 2026-03-08 | Reports: `docs/reviews/code/code-review-2026-03-08-e07-s01.md`, `docs/reviews/code/code-review-testing-2026-03-08-e07-s01.md`

- **Blocker**: AC5 broken — `study-session-ended` event never dispatched anywhere in codebase
- **Blocker**: `@ts-nocheck` file (`fireMilestoneToasts.tsx`) should not ship
- **High**: No `.catch()` on `loadMomentumScores()` — silent failure
- **High**: No cleanup guard on async effect — unmount race condition
- **High**: ImportedCourseCard momentum never computed
- **Testing Blocker**: AC5 has zero test coverage
- **Testing High**: Sort E2E test doesn't verify actual ordering (all scores are 0)

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
