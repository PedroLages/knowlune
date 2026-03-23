---
story_id: E18-S07
story_name: "Surface Quiz Analytics in Reports Section"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests]
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

Full report: `docs/reviews/design/design-review-2026-03-23-e18-s07.md`

**Blocker:** WCAG AA contrast failure on `text-brand` links in dark mode (3.07:1 vs 4.5:1 required) — `QuizAnalyticsDashboard.tsx:186,217,249`. Fix: use `text-brand-soft-foreground`.

**High:** Touch targets below 44px on mobile (Details links 17px height, tab triggers 36px). Missing H2 heading (H1→H3 skip) — add `<h2 className="sr-only">Quiz Analytics</h2>`. `fadeUp` animations silently inert (variant propagation blocked by Radix `TabsContent` — add `initial="hidden" animate="visible"` to root div).

**Medium:** Tab list has no `aria-label` (`aria-label="Analytics views"`). "Unknown Quiz" surfaces for orphaned attempts.

## Code Review Feedback

Full report: `docs/reviews/code/code-review-2026-03-23-e18-s07.md`

**High:** `topPerforming` and `needsImprovement` overlap when ≤5 unique quizzes — same quizzes appear in both lists (`analytics.ts:105-107`). No error state in `QuizAnalyticsDashboard` — DB failure silently shows "No quiz data yet" (`QuizAnalyticsDashboard.tsx:26-46`). String interpolation instead of `cn()` in 3 locations (`QuizAnalyticsDashboard.tsx:109,126,224`). `calculateQuizAnalytics()` has zero unit tests.

**Medium:** `toLocaleDateString()` without explicit locale (`QuizAnalyticsDashboard.tsx:181`). `setSearchParams({ tab })` replaces all query params — use functional form (`Reports.tsx:193`). `totalQuizzesCompleted` shows unique quizzes, not total attempts — consider clearer label.

## Web Design Guidelines Review

Full report: `docs/reviews/code/edge-case-review-2026-03-23-e18-s07.md` (combined with edge cases)

**High:** Arbitrary `?tab=` values accepted without validation — invalid tab shows blank content area. Orphaned attempts can push `completionRate` above 100% (`analytics.ts:94`). `attempt.percentage` NaN/undefined propagates through all averages. Malformed `completedAt` renders "Invalid Date" in table.

## Challenges and Lessons Learned

**useSearchParams() breaks Router-less unit tests:**
- Adding `useSearchParams()` to `Reports.tsx` for URL-based tab state caused all 4 existing Reports unit tests to fail with "useLocation() may be used only in the context of a Router component".
- Fix: wrap `render(<Reports />)` with `<MemoryRouter>` in all affected tests. Also mock the new `QuizAnalyticsDashboard` component so it doesn't trigger its own async side-effects in the test environment.
- Pattern: any time a page component gains a React Router hook (useSearchParams, useNavigate, useLocation), its unit tests must be updated with a Router wrapper.

**URL-driven tab state vs local state trade-off:**
- Migrating the Reports tab from `defaultValue` (uncontrolled) to `value + onValueChange + useSearchParams` (URL-controlled) means bookmarkable, shareable tab links but requires a Router in every rendering context. The previous `defaultValue="study"` required no Router context. This is a meaningful DX trade-off worth evaluating early.

**calculateQuizAnalytics() has no dedicated unit tests:**
- The new `calculateQuizAnalytics()` function in `analytics.ts` was not covered by unit tests at review time. The existing `analytics.test.ts` covers other exports but not the new quiz analytics summary function. This should be addressed — the function has non-trivial aggregation logic (grouping by quizId, computing averages, sorting top/bottom performers) that benefits from isolated test coverage.

**Partial story implementation pattern:**
- Tasks 4 (QuizDetailAnalytics page + route) and 5 (E2E tests) were not implemented in this branch. This means AC3 (quiz detail navigation) and test coverage (AC1-4) remain unverified. Story task checkboxes were left unchecked, which accurately reflects actual state — a good habit.

**Design token usage for score colouring:**
- The `scoreColor()` helper maps percentage ranges to `text-success`, `text-warning`, `text-destructive` design tokens rather than hardcoded Tailwind colors. This pattern should be reused anywhere conditional score-based colouring is needed.
