---
story_id: E18-S06
story_name: "Display Quiz Performance in Overview Dashboard"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: []
burn_in_validated: false
---

# Story 18.6: Display Quiz Performance in Overview Dashboard

## Story

As a learner,
I want to see my quiz performance summary on the Overview dashboard,
so that I can quickly see my quiz activity alongside other learning metrics.

## Acceptance Criteria

**AC1:** Given I have completed quizzes, When I view the Overview dashboard, Then I see a "Quiz Performance" card or section, And it displays my total quizzes completed, And it displays my average quiz score across all attempts, And it displays my quiz completion rate.

**AC2:** Given the Quiz Performance card is loading data, When Dexie queries are running, Then I see a skeleton loading state (not a blank card).

**AC3:** Given I click on the Quiz Performance card, When interacting with it, Then I navigate to the Reports section quiz tab (`/reports?tab=quizzes`), Or it expands to show more detail (recent quizzes, improvement trends).

**AC4:** Given I have NOT completed any quizzes, When viewing the Overview dashboard, Then I see an empty state: "No quizzes completed yet. Start a quiz to track your progress!", And I see a CTA: "Find Quizzes".

## Implementation Plan

See: [2026-03-23-quiz-performance-dashboard.md](plans/2026-03-23-quiz-performance-dashboard.md)

## Tasks / Subtasks

- [ ] Task 1: Add `calculateQuizDashboardMetrics()` to analytics.ts (AC: 1)
- [ ] Task 2: Create `QuizPerformanceCard` component (AC: 1, 2, 4)
- [ ] Task 3: Integrate card into Overview.tsx (AC: 1, 2, 3)
- [ ] Task 4: Write E2E tests (AC: 1, 2, 3, 4)

## Design Guidance

- Use `Card`/`CardHeader`/`CardContent`/`CardFooter` from shadcn/ui
- Follow existing dashboard card patterns (consistent spacing, rounded-[24px])
- Skeleton loading state using `<Skeleton>` component
- Empty state using `<EmptyState>` component with `actionHref`
- Design tokens only (no hardcoded colors)
- Link to `/reports` (no quiz tab exists yet)

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
