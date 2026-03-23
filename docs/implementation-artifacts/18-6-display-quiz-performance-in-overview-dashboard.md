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

- **`quizAttempts` schema discovery** — The `db.quizAttempts` table only stores *submitted* attempts; in-progress attempts live in localStorage via Zustand persist middleware. This made `completionRate` trivially 100% for now, requiring a TODO comment to revisit when Story 17.1 adds abandoned-attempt tracking. Always audit how an entity lifecycle is split across storage layers (IndexedDB vs Zustand persist) before computing derived metrics.

- **Button-wrapping an interactive Link** — Wrapping a `<Link>` inside a `<button>` creates a nested interactive element that fails accessibility checks. The solution was to make the entire card a `<button>` for the primary navigation action, then use `e.stopPropagation()` on the inner "View Detailed Analytics" `<Link>` to prevent double-navigation. This is the canonical pattern for "card = primary CTA + footer link = secondary CTA" layouts.

- **Ignore-flag pattern for async useEffect** — Used `let ignore = false` with cleanup `ignore = true` to avoid setting state after unmount in the `calculateQuizMetrics()` `useEffect`. This is the React team's recommended approach (avoiding AbortController for Dexie queries that don't support cancellation). Worth using consistently on all data-fetching effects.

- **`quizMetrics.ts` as a separate module** — The analytics calculation was extracted into `src/lib/quizMetrics.ts` (not added to the existing `analytics.ts`) to keep concerns separated. `analytics.ts` handles study-time/session analytics; quiz metrics are a distinct domain. This prevents the analytics file from becoming a catch-all blob.

- **Test anti-pattern caught by validator** — The initial spec defined an inline `seedQuizAttempts()` function duplicating logic that already exists in `tests/support/helpers/indexeddb-seed.ts`. The validator caught this as MEDIUM severity. Fix: import from the shared helper. Lesson: always check `indexeddb-seed.ts` before writing inline IDB seeding in new specs.

- **Skeleton-before-empty-state ordering** — `metrics === null` (loading) must render the skeleton, while `metrics.totalQuizzes === 0` (loaded but empty) must render the empty state inside the card. Getting this ordering wrong produces a flash from skeleton → empty state that looks broken. The `null` check must be exhaustive before accessing any property on `metrics`.
