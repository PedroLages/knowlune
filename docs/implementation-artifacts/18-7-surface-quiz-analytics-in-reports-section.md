---
story_id: E18-S07
story_name: "Surface Quiz Analytics in Reports Section"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 18.7: Surface Quiz Analytics in Reports Section

## Story

As a learner,
I want to see detailed quiz analytics in the Reports section,
so that I can understand my quiz performance alongside other learning metrics.

## Acceptance Criteria

**AC1: Quiz Analytics tab with metrics**
**Given** I navigate to the Reports section
**When** the page loads
**Then** I see a "Quiz Analytics" tab or section
**And** it displays all quiz-related metrics:
  - Total quizzes completed
  - Average score
  - Completion rate
  - Average retake frequency
  - Recent quiz attempts (last 5)
  - Top performing quizzes (highest average scores)
  - Quizzes needing improvement (lowest scores)

**AC2: Empty state**
**Given** I have no quiz data
**When** the Quiz Analytics tab loads
**Then** I see an empty state with a message: "No quiz data yet. Complete a quiz to see your analytics."
**And** I see a CTA linking to available quizzes

**AC3: Quiz detail navigation**
**Given** I want to see details for a specific quiz
**When** I click on a quiz in the list
**Then** I navigate to that quiz's detailed analytics at `/reports/quiz/:quizId`:
  - All attempt history
  - Score improvement trajectory
  - Item difficulty analysis
  - Discrimination indices
  - Normalized gain

**AC4: Responsive layout**
**Given** I view the Quiz Analytics on a mobile viewport
**When** the page renders
**Then** the metric cards display in a single column (responsive: 3-col -> 1-col on mobile)

## Tasks / Subtasks

- [ ] Task 1: Create `calculateQuizAnalytics()` in `src/lib/analytics.ts` (AC: 1)
  - [ ] 1.1 Aggregate total quizzes, average score, completion rate from Dexie
  - [ ] 1.2 Compute top performing quizzes (highest avg scores)
  - [ ] 1.3 Compute quizzes needing improvement (lowest scores)
  - [ ] 1.4 Fetch recent attempts (last 5)
- [ ] Task 2: Create `QuizAnalyticsDashboard.tsx` component (AC: 1, 2, 4)
  - [ ] 2.1 Metric cards row (3-col -> 1-col responsive grid)
  - [ ] 2.2 Recent quizzes table
  - [ ] 2.3 Top performing / needing improvement cards
  - [ ] 2.4 Empty state when no quiz data
- [ ] Task 3: Add "Quiz Analytics" tab to Reports page (AC: 1, 2)
  - [ ] 3.1 Add tab trigger and content
  - [ ] 3.2 Support `?tab=quizzes` URL parameter
- [ ] Task 4: Create `QuizDetailAnalytics.tsx` page + route (AC: 3)
  - [ ] 4.1 Add `/reports/quiz/:quizId` route
  - [ ] 4.2 Load quiz + all attempts from Dexie
  - [ ] 4.3 Render attempt history, trajectory chart, item difficulty, discrimination, normalized gain
- [ ] Task 5: E2E tests (AC: 1, 2, 3, 4)
  - [ ] 5.1 Quiz Analytics tab renders with seeded data
  - [ ] 5.2 Empty state displays when no quiz data
  - [ ] 5.3 Click quiz navigates to detail page
  - [ ] 5.4 Mobile viewport stacks metric cards

## Design Guidance

**Layout approach:** Add a third tab "Quiz Analytics" to the existing Reports Tabs component. The tab content follows the same card-based grid pattern used in Study Analytics.

**Component structure:**
- `QuizAnalyticsDashboard` — top-level tab content (metric cards + recent + top/bottom lists)
- `QuizDetailAnalytics` — full page for per-quiz drill-down (reuses existing quiz components)

**Design system usage:**
- Metric cards: reuse `StatsCard` or simpler Card + stat layout from Study Analytics
- Tables: shadcn Table component
- Empty state: reuse `EmptyState` component
- Charts: existing `ScoreTrajectoryChart`, `ItemDifficultyAnalysis`, `DiscriminationAnalysis`

**Responsive strategy:** 3-col grid -> 1-col on mobile (sm breakpoint), matching Study Analytics stat cards pattern.

**Accessibility:** Semantic tab panel, keyboard navigation, proper headings hierarchy.

## Implementation Notes

**Plan:** [e18-s07-surface-quiz-analytics-in-reports-section.md](plans/e18-s07-surface-quiz-analytics-in-reports-section.md)

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story -- Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
