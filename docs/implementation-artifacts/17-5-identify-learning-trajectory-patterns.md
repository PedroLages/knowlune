---
story_id: E17-S05
story_name: "Identify Learning Trajectory Patterns"
status: done
started: 2026-03-24
completed: 2026-03-24
reviewed: true
review_started: 2026-03-24
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
burn_in_validated: false
---

# Story 17.5: Identify Learning Trajectory Patterns

## Story

As a learner,
I want to see my learning trajectory pattern after multiple quiz attempts,
So that I can understand whether my performance is improving, declining, or plateauing.

## Acceptance Criteria

**AC1:** Given I have 3+ quiz attempts, when viewing quiz results, then the ImprovementChart appears with a pattern label (e.g., "Consistent Improvement", "Accelerating Mastery", "Plateau").

**AC2:** Given the trajectory is detected, when viewing the chart, then a confidence percentage is displayed alongside the pattern.

**AC3:** Given the chart is rendered, then the section has an accessible aria-label describing the trajectory pattern, confidence, and number of attempts.

**AC4:** Given I have fewer than 3 quiz attempts, when viewing quiz results, then the ImprovementChart does not appear.

**AC5:** Given I complete a quiz 5 times with improving scores, when viewing results, then I see the chart with a pattern label indicating improvement.

## Tasks / Subtasks

- [x] Task 1: Add `detectLearningTrajectory` to `src/lib/analytics.ts`
- [x] Task 2: Create `ImprovementChart` component in `src/app/components/quiz/ImprovementChart.tsx`
- [x] Task 3: Integrate into QuizResults page
- [x] Task 4: Add E2E tests in `tests/e2e/story-e17-s05.spec.ts`

## Design Guidance

Uses recharts LineChart with brand color tokens. Pattern displayed via Badge component. Responsive height (200px mobile, 280px desktop).

## Implementation Notes

Trajectory detection uses R² goodness-of-fit across linear, logarithmic, and exponential models. Requires minimum 3 attempts. Handles plateau detection via score range check and declining pattern via negative slope.

## Testing Notes

**E2E tests** (Playwright, `tests/e2e/story-e17-s05.spec.ts`):
- AC5: 5 improving attempts → chart with pattern label
- AC2: Confidence percentage displayed
- AC3: Accessible aria-label
- AC4: < 3 attempts → chart not visible

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- **Use `useMediaQuery` over `useMemo` + `matchMedia` for reactive media queries.** Round 1 review caught that `prefersReducedMotion` used a one-shot `useMemo` check. Switching to `useMediaQuery()` with `addEventListener('change')` ensures the component reacts when the user toggles reduced motion mid-session.
- **Inline styles need justification comments.** When dynamic values (e.g., `chartHeight` computed from `isMobile`) require inline styles, adding a comment explaining why Tailwind can't handle it prevents future reviewers from flagging it as a design token violation.
- **R-squared edge cases matter.** The `calculateLinearR2` function needed guards for identical x-values (division by zero in SS_tot), fewer than 2 data points, and identical y-values (perfect plateau). Unit-testing these boundary conditions caught real bugs before integration.
- **Create story artifact files at `/start-story` time, not during implementation.** Round 1 flagged a missing story file. Creating the implementation artifact at story kickoff avoids this recurring issue.
- **Pure analytics functions simplify testing.** Keeping `detectLearningTrajectory` as a pure function with no side effects or I/O enabled 13 focused unit tests without mocking stores or IndexedDB.
