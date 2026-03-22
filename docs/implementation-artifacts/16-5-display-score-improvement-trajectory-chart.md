---
story_id: E16-S05
story_name: "Display Score Improvement Trajectory Chart"
status: in-progress
started: 2026-03-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 16.5: Display Score Improvement Trajectory Chart

## Story

As a learner,
I want to see a visual chart of my score trajectory across quiz attempts,
So that I can quickly understand my improvement trend at a glance.

## Acceptance Criteria

**Given** I have completed a quiz at least 2 times
**When** I view the quiz results or attempt history
**Then** I see a line chart showing my score trajectory
**And** the x-axis shows attempt number (1, 2, 3, ...)
**And** the y-axis shows score percentage (0-100%)

**Given** the trajectory chart is displayed
**When** viewing the chart
**Then** I see a horizontal dashed line indicating the passing score threshold
**And** the line is labeled (e.g., "Passing: 70%")
**And** data points above the line are visually distinguished from those below

**Given** I have only 1 attempt
**When** viewing the results
**Then** the trajectory chart is not displayed (requires at least 2 data points)

**Given** I am on a mobile device
**When** viewing the trajectory chart
**Then** the chart height is 200px (vs 300px on desktop)
**And** the chart remains readable and interactive

## Tasks / Subtasks

- [ ] Task 1: Create ScoreTrajectoryChart component (AC: 1, 2, 3, 4)
  - [ ] 1.1 Create `src/app/components/quiz/ScoreTrajectoryChart.tsx`
  - [ ] 1.2 Implement line chart with recharts via ChartContainer pattern
  - [ ] 1.3 Add passing score ReferenceLine (dashed, labeled)
  - [ ] 1.4 Color dots: green for above/at passing, brand for below
  - [ ] 1.5 Guard: return null when attempts.length < 2
  - [ ] 1.6 Responsive height: 200px on mobile, 300px on desktop via useIsMobile

- [ ] Task 2: Integrate chart into QuizResults page (AC: 1)
  - [ ] 2.1 Map attempts to `{ attemptNumber, percentage }` in QuizResults
  - [ ] 2.2 Import and render ScoreTrajectoryChart below ScoreSummary (or below AreasForGrowth)
  - [ ] 2.3 Pass passingScore from currentQuiz

- [ ] Task 3: E2E tests (AC: 1–4)
  - [ ] 3.1 Create `tests/e2e/story-e16-s05.spec.ts`
  - [ ] 3.2 Test: chart appears after 2+ attempts
  - [ ] 3.3 Test: chart hidden with 1 attempt
  - [ ] 3.4 Test: passing score line labeled correctly

## Design Guidance

**Chart placement:** Below the ScoreSummary ring (above QuestionBreakdown or after AreasForGrowth) — should feel like a secondary analytics section, not the hero.

**Responsive height:** Use `useIsMobile()` hook to switch between `h-[200px]` (mobile) and `h-[300px]` (desktop).

**Dot color differentiation:** Use a custom `dot` render prop in recharts `<Line>` to color dots: `text-success` for `percentage >= passingScore`, `text-brand` for below.

**Pass/fail line:** `<ReferenceLine>` with `stroke="var(--color-success)"`, `strokeDasharray="5 5"`, label showing `Passing: N%`.

**Chart wrapper:** Use the existing `ChartContainer` + `ChartConfig` pattern from `src/app/components/ui/chart.tsx` (not raw `ResponsiveContainer`) for consistent theming.

## Implementation Notes

**Plan file:** [docs/implementation-artifacts/plans/2026-03-22-e16-s05-score-trajectory-chart.md](plans/2026-03-22-e16-s05-score-trajectory-chart.md)

**Architecture:**
- New component: `src/app/components/quiz/ScoreTrajectoryChart.tsx`
- Modified: `src/app/pages/QuizResults.tsx` (import + render chart, pass data)
- New E2E test: `tests/e2e/story-e16-s05.spec.ts`

**Key dependencies already available:**
- `recharts` (already in project)
- `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig` from `@/app/components/ui/chart`
- `useIsMobile` from `@/app/hooks/useMediaQuery`

## Testing Notes

**E2E strategy:** Use the same pattern as story-12-6.spec.ts — seed a quiz via IndexedDB, complete it twice, verify chart visibility. For single-attempt test, complete once and verify chart is absent.

**Unit test strategy:** `src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx` — mock recharts (importOriginal pattern from Reports.test.tsx), test null render guard, test data transformation.

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
