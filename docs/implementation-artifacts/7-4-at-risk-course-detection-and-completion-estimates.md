---
story_id: E07-S04
story_name: "At-Risk Course Detection & Completion Estimates"
status: in-progress
started: 2026-03-08
completed:
reviewed: true           # false | in-progress | true
review_started: 2026-03-08  # YYYY-MM-DD — set when /review-story begins
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]  # tracks completed gates: [build, lint, unit-tests, e2e-tests, design-review, code-review]
---

# Story 7.4: At-Risk Course Detection & Completion Estimates

## Story

As a learner,
I want courses with no activity for 14 or more days to be flagged as "at risk" and to see estimated completion times for all my courses,
So that I can identify neglected courses before I fall too far behind and plan my study time around realistic completion estimates.

## Acceptance Criteria

**Given** a course has had no study activity for 14 or more consecutive days
**And** the course's momentum score is below 20
**When** the course library is rendered
**Then** the course card displays a visible "At Risk" badge or indicator using a warning color that is distinct from the hot/warm/cold momentum indicator

**Given** a course was previously flagged as at risk
**When** the user records a new study session for that course
**And** the momentum score recalculates to 20 or above
**Then** the "At Risk" indicator is removed from the course card

**Given** a course has remaining uncompleted content
**When** the course card is rendered
**Then** an estimated completion time is displayed, calculated as remaining content duration divided by the user's average study pace (average session duration over the past 30 days)

**Given** the user has no recorded study sessions (new user)
**When** the estimated completion time is calculated
**Then** the system uses a default average pace of 30 minutes per session as the baseline estimate

**Given** a course is both at risk and has an estimated completion time
**When** the course card is rendered
**Then** both the "At Risk" indicator and the estimated completion time are visible simultaneously without overlapping or conflicting visually

**Given** the user views the course library with at-risk courses present
**When** the user sorts by momentum
**Then** at-risk courses naturally appear at the bottom of the list due to their low momentum scores

## Tasks / Subtasks

- [ ] Task 1: Implement at-risk detection logic (AC: 1, 2)
  - [ ] 1.1 Create function to calculate days since last study session
  - [ ] 1.2 Implement at-risk flag logic (14+ days, momentum < 20)
  - [ ] 1.3 Add logic to remove at-risk flag when conditions no longer met

- [ ] Task 2: Implement completion time estimation (AC: 3, 4)
  - [ ] 2.1 Calculate user's average study pace (30-day window)
  - [ ] 2.2 Calculate remaining content duration
  - [ ] 2.3 Implement completion time estimate formula
  - [ ] 2.4 Handle new user case (default 30 min/session)

- [ ] Task 3: Update course card UI (AC: 5)
  - [ ] 3.1 Design and implement "At Risk" badge component
  - [ ] 3.2 Add completion time estimate display
  - [ ] 3.3 Ensure both indicators don't overlap/conflict
  - [ ] 3.4 Verify visual distinction from momentum indicators

- [ ] Task 4: Verify integration with existing features (AC: 6)
  - [ ] 4.1 Test at-risk courses appear at bottom when sorted by momentum
  - [ ] 4.2 Verify momentum score recalculation triggers at-risk update

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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

## Design Review Feedback

**Date:** 2026-03-08
**Report:** [docs/reviews/design/design-review-2026-03-08-e07-s04.md](../reviews/design/design-review-2026-03-08-e07-s04.md)
**Score:** 8.5/10

**Summary:** Excellent responsive design, accessibility, and visual distinction between At-Risk badges and momentum indicators. One high-priority UX issue and one medium polish item.

**High Priority:**
- "Infinity days" display on At-Risk badges for never-started courses (confusing UX) — `src/lib/atRisk.ts:28`

**Medium:**
- Badge border radius inconsistency (`rounded-sm` vs `rounded-lg`)

## Code Review Feedback

**Architecture Review Date:** 2026-03-08
**Architecture Report:** [docs/reviews/code/code-review-2026-03-08-e07-s04.md](../reviews/code/code-review-2026-03-08-e07-s04.md)
**Testing Review Date:** 2026-03-08
**Testing Report:** [docs/reviews/code/code-review-testing-2026-03-08-e07-s04.md](../reviews/code/code-review-testing-2026-03-08-e07-s04.md)

**Summary:** Clean architecture with proper separation of concerns. 10 high-priority issues identified across code quality, test coverage, and edge case handling. No blockers.

**High Priority Issues (10):**

**Code Quality (5):**
1. Hardcoded `text-gray-500` instead of theme token — `CompletionEstimate.tsx:29`
2. Division by zero when all sessions have `duration: 0` — `completionEstimate.ts:40,44`
3. No clamp on negative `remainingContentMinutes` — `completionEstimate.ts:44`
4. Hardcoded orange colors instead of theme tokens — `AtRiskBadge.tsx:26`
5. Missing sidebar state seed in E2E `beforeEach` — `story-e07-s04.spec.ts:12-15`

**Test Coverage (5):**
6. Boundary conditions untested (exactly 14 days, momentum exactly 20)
7. Missing unit tests for business logic functions (`calculateAtRiskStatus`, `calculateCompletionEstimate`)
8. Hard wait `page.waitForTimeout(500)` in AC6 test — `story-e07-s04.spec.ts:195`
9. Weak assertions in AC3 test (regex pattern doesn't verify calculation)
10. Non-deterministic `.first()` locator in AC4 test — `story-e07-s04.spec.ts:116`

**Medium (4):**
- JSX whitespace bug ("session s") — `CompletionEstimate.tsx:32-33`
- Date.now() makes functions impure (testability)
- Magic number 15 for minutes-per-lesson
- AC2 test reload lacks explicit wait

## Implementation Plan

See [plan](plans/wise-brewing-wall.md) for implementation approach.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
