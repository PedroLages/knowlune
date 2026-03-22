---
story_id: E16-S02
story_name: "Display Score History Across All Attempts"
status: in-progress
started: 2026-03-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 16.2: Display Score History Across All Attempts

## Story

As a learner,
I want to see my score history for all quiz attempts,
so that I can track my improvement over time.

## Acceptance Criteria

**Given** I have completed a quiz multiple times
**When** I view the quiz results screen
**Then** I see a "View Attempt History" link or button
**And** clicking it expands a section showing all my past attempts

**Given** the attempt history is displayed
**When** viewing the list
**Then** I see each attempt with: attempt number, date/time, score percentage, time spent, passed/failed status
**And** attempts are sorted by date (most recent first)
**And** the current attempt is highlighted or marked as "Current"

**Given** only one attempt exists
**When** viewing the trigger button
**Then** I see "(1 attempt)" with correct singular form

**Given** multiple attempts exist
**When** viewing the trigger button
**Then** I see "(N attempts)" with correct plural form

**Given** I want to review a past attempt
**When** I click on any attempt in the history
**Then** I navigate to the review mode for that specific attempt
**And** I see the questions/answers from that attempt (not current)

## Tasks / Subtasks

- [ ] Task 1: Fix `loadAttempts` sort order — reverse to most-recent-first (AC: sorted by date)
  - [ ] 1.1 Update `useQuizStore.loadAttempts` to call `.reverse()` after `.sortBy('completedAt')`
  - [ ] 1.2 Add unit test: `loadAttempts` returns attempts in descending order

- [ ] Task 2: Create `AttemptHistory` component with collapsible table (AC: expand section, all fields, current highlighted)
  - [ ] 2.1 Create `src/app/components/quiz/AttemptHistory.tsx`
  - [ ] 2.2 Use `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` from shadcn/ui
  - [ ] 2.3 Render trigger button: "View Attempt History (N attempt[s])" with `variant="link"`
  - [ ] 2.4 Desktop (≥640px): render `Table` with columns: Attempt #, Date, Score, Time, Status, Review
  - [ ] 2.5 Mobile (<640px): render stacked card layout instead of table (avoid horizontal scroll)
  - [ ] 2.6 Highlight current attempt row with `bg-brand-soft` class
  - [ ] 2.7 Mark current attempt with "Current" badge
  - [ ] 2.8 Passed/not-passed status badges (design token classes, no hardcoded colors)
  - [ ] 2.9 "Review" button per row — navigates to review route (stub toast since E16-S01 not done)
  - [ ] 2.10 Accessibility: `<table>` with `scope` headers, collapsible keyboard-accessible, ARIA labels

- [ ] Task 3: Integrate `AttemptHistory` into `QuizResults` page (AC: trigger visible on results screen)
  - [ ] 3.1 Replace the disabled "View All Attempts (Coming Soon)" placeholder with `<AttemptHistory>`
  - [ ] 3.2 Pass `attempts`, `currentAttemptId` (= last attempt's id), `courseId`, `lessonId` as props
  - [ ] 3.3 Remove `History` icon import if no longer used

- [ ] Task 4: Unit tests for `AttemptHistory` component
  - [ ] 4.1 Singular label "(1 attempt)" renders correctly
  - [ ] 4.2 Plural label "(3 attempts)" renders correctly
  - [ ] 4.3 All attempt data fields visible (attempt #, date, score, time, status)
  - [ ] 4.4 Current attempt row has `bg-brand-soft` class or "Current" marker
  - [ ] 4.5 Collapsible is closed by default and opens on click

- [ ] Task 5: E2E tests (story spec)
  - [ ] 5.1 Complete quiz 3 times → click "View Attempt History" → see 3 attempts in table
  - [ ] 5.2 Attempts are sorted most-recent-first (attempt #3 appears at top)
  - [ ] 5.3 Current attempt is highlighted/marked "Current"
  - [ ] 5.4 Review button is visible per attempt (stub — navigates to coming-soon route)

## Design Guidance

**Layout:** Collapsible section within the existing `QuizResults` card (`max-w-2xl mx-auto`). Trigger is a `variant="link"` button. Content is a Table on desktop, stacked cards on mobile.

**Responsive Strategy:**
- ≥640px: `<Table>` with 6 columns (Attempt, Date, Score, Time, Status, Review)
- <640px: Stack each attempt as a card with the same fields, wrapping naturally

**Current Attempt Highlight:**
- Row: `className={cn(attempt.id === currentAttemptId ? 'bg-brand-soft' : '')}`
- Badge: Small "Current" pill using `bg-brand-soft text-brand-soft-foreground`

**Status Badges:**
- Passed: `bg-success-soft text-success rounded-full px-2 py-0.5 text-xs font-medium`
- Not Passed: `bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium`

**Date Formatting:** Use `new Date(attempt.completedAt).toLocaleDateString('sv-SE')` for YYYY-MM-DD (project convention) or `toLocaleString()` for date+time. Prefer readable locale format.

**Review Button:** `variant="ghost" size="sm"`. Since E16-S01 is not done, shows a toast: "Review mode coming soon." on click.

**Accessibility:**
- `<table>` must have `<th scope="col">` for each column header
- Collapsible trigger must be a button (already handled by `CollapsibleTrigger asChild`)
- Screen reader: `aria-expanded` state on trigger (managed by Radix)

## Implementation Notes

**Implementation Plan:** See [docs/implementation-artifacts/plans/e16-s02-implementation-plan.md](plans/e16-s02-implementation-plan.md)

**Key Dependency:** E16-S01 (review past attempts route) is not yet implemented. The "Review" button in the history table will show a toast placeholder until E16-S01 creates the review route.

**Sort Order Gap:** `useQuizStore.loadAttempts` currently returns oldest-first (missing `.reverse()`). Task 1 fixes this.

**`success-soft` token:** The epic references `bg-success-soft` — verify this token exists in `src/styles/theme.css` before using. Fall back to `bg-success/10` if absent.

## Testing Notes

**E2E Strategy:** Seed `quizAttempts` directly into IndexedDB (pattern from `story-12-6.spec.ts`). Seed quiz into `quizzes` store, seed 3 attempts into `quizAttempts` store with different `completedAt` timestamps, navigate to QuizResults with Zustand state pre-seeded.

**Zustand State Seeding for E2E:** The `attempts` array in `QuizResults` comes from Zustand (seeded via `loadAttempts` from IDB). Tests must seed IDB `quizAttempts` AND set Zustand `currentQuiz` via localStorage (`levelup-quiz-store` key).

**FIXED_DATE:** Use `FIXED_DATE` / `FIXED_TIMESTAMP` from `tests/utils/test-time.ts` for all attempt timestamps in unit tests.

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

Pending — run `/review-story E16-S02` after implementation to populate via Playwright MCP.

## Code Review Feedback

Pending — run `/review-story E16-S02` after implementation to populate via adversarial code review.

## Web Design Guidelines Review

Pending — run `/review-story E16-S02` after implementation to populate.

## Challenges and Lessons Learned

**Pre-implementation notes:**
- E16-S01 (review past attempts) is not yet implemented — the "Review" button per attempt must be stubbed with a toast until E16-S01 is merged.
- `loadAttempts` sort-order bug (oldest-first) exists from initial implementation — must be fixed as Task 1.
- `bg-success-soft` and `bg-brand-soft` design tokens confirmed present in `src/styles/theme.css`; safe to use without fallback.
