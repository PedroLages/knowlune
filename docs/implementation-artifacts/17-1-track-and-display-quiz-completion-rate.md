---
story_id: E17-S01
story_name: "Track and Display Quiz Completion Rate"
status: done
started: 2026-03-22
completed: 2026-03-22
reviewed: true
review_started: 2026-03-22
review_gates_passed:
  - working-tree-clean
  - build
  - lint
  - typescript
  - prettier
  - unit-tests
  - e2e-smoke
  - e2e-story-spec
  - code-review
  - code-review-testing
  - design-review
burn_in_validated: false
---

# Story 17.1: Track and Display Quiz Completion Rate

## Story

As a learner,
I want to see my quiz completion rate,
so that I can understand how often I finish quizzes I start.

## Acceptance Criteria

**Given** I have started and completed multiple quizzes
**When** I view the analytics or reports section
**Then** I see my overall quiz completion rate as a percentage
**And** the calculation is: (unique quizzes completed / unique quizzes started) * 100

**Given** I have started a quiz but not completed it
**When** that quiz is still in progress (tracked in localStorage quiz store)
**Then** it counts as "started" but not "completed"

**Given** I have completed a quiz multiple times
**When** calculating completion rate
**Then** completion rate uses unique quizzes, not raw attempts (3 attempts of same quiz = 1 completed quiz)

**Given** no quiz data exists
**When** I view the analytics section
**Then** I see a "No quizzes started yet" empty state message

**Given** the completion rate is displayed
**When** viewing the metric
**Then** I see a visual indicator (progress bar or circular progress)
**And** I see the raw numbers (e.g., "12 of 15 started quizzes completed")

## Tasks / Subtasks

- [ ] Task 1: Add `calculateCompletionRate` function to `src/lib/analytics.ts` (AC: 1, 2, 3)
  - [ ] 1.1 Implement `calculateCompletionRate` querying `db.quizAttempts` for unique completed quizIds
  - [ ] 1.2 Parse `levelup-quiz-store` from localStorage for in-progress count (fallback to `currentProgress ? 1 : 0`)
  - [ ] 1.3 Return `{ completionRate, completedCount, startedCount }`

- [ ] Task 2: Display quiz completion card in `src/app/pages/Reports.tsx` (AC: 4, 5)
  - [ ] 2.1 Add `useState` + `useEffect` to fetch quiz completion rate on mount (ignore-flag pattern)
  - [ ] 2.2 Update `hasActivity` to include `quizData.startedCount > 0` so quiz-only users see the page
  - [ ] 2.3 Add Quiz Completion Rate card with Progress bar, percentage, raw count, and empty state
  - [ ] 2.4 Add `data-testid="quiz-completion-card"` for E2E targeting

- [ ] Task 3: Unit tests in `src/lib/__tests__/analytics.test.ts` (AC: 1, 2, 3, 4)
  - [ ] 3.1 Test completion rate with multiple unique quizIds (completed only)
  - [ ] 3.2 Test zero attempts → 0% rate + startedCount = 0
  - [ ] 3.3 Test multiple attempts of same quiz → counts as 1 unique completed
  - [ ] 3.4 Test in-progress quiz parsed from localStorage `currentProgress` → startedCount + 1
  - [ ] 3.5 Test `inProgressQuizIds` array path in localStorage (legacy-compatible)

- [ ] Task 4: E2E tests in `tests/e2e/story-e17-s01.spec.ts` (AC: 4, 5)
  - [ ] 4.1 Seed 3 completed quizzes + 1 in-progress → verify "75%" displayed
  - [ ] 4.2 Navigate to Reports → verify quiz card visible with progress bar
  - [ ] 4.3 Seed no quiz data → verify "No quizzes started yet" empty state

## Design Guidance

The quiz completion card follows the existing `Card` pattern used throughout Reports.tsx:

- Card with `CardHeader` / `CardContent`
- `CardTitle` with a quiz-relevant icon (e.g., `CheckCircle` or `ClipboardList`)
- Progress bar from `@/app/components/ui/progress`
- Percentage in `text-2xl font-bold` alongside the bar
- Raw count in `text-sm text-muted-foreground` below

Placement: New Row after existing analytics rows, before "Recent Activity Timeline" (or as a 5th standalone row after Row 4).

Empty state: Inside the card, show a muted message — not the page-level `<EmptyState>` component.

## Implementation Notes

See implementation plan: [docs/plans/e17-s01-plan.md](plans/e17-s01-plan.md)

### Key Architecture Decisions

1. **`calculateCompletionRate` in `src/lib/analytics.ts`** — Analytics module already exists for topic analysis. Extending it maintains cohesion for quiz analytics functions (E17 will add more here in S02+).

2. **localStorage in-progress detection** — The store's `partialize` only persists `currentProgress` and `currentQuiz`. A non-null `currentProgress` means exactly 1 in-progress quiz. The function handles both `inProgressQuizIds` (possible future key) and `currentProgress` for resilience.

3. **async data fetch in Reports** — Follows the existing `getTotalStudyNotes()` pattern: `useEffect` with ignore flag, error logged to console, state initialized to safe zero.

4. **`hasActivity` update** — Adding `quizData.startedCount > 0` ensures quiz-active users (no lesson data) see the analytics page rather than the page-level empty state.

### DB Schema

`quizAttempts` table (v17): `'id, quizId, [quizId+completedAt], completedAt'`

Use `db.quizAttempts.toArray()` to get all attempts, then extract unique quizIds via `Set`.

### localStorage Structure

```
levelup-quiz-store → { state: { currentProgress: QuizProgress | null, currentQuiz: Quiz | null } }
```

In-progress detection:
```
inProgressCount = parsed?.state?.inProgressQuizIds?.length ?? (parsed?.state?.currentProgress ? 1 : 0)
```

## Testing Notes

Unit tests use `fake-indexeddb/auto` (see `src/lib/__tests__/progress.test.ts` pattern). The DB is the real Dexie instance with in-memory IndexedDB.

For localStorage mocking in unit tests: use `vi.stubGlobal` or `vi.spyOn(Storage.prototype, 'getItem')`.

E2E tests seed data via IndexedDB helpers (see `tests/support/` for existing seeders).

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
