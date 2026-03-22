---
story_id: E16-S03
story_name: "Calculate and Display Score Improvement"
status: in-progress
started: 2026-03-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 16.3: Calculate and Display Score Improvement

## Story

As a learner,
I want to see how much my score improved between attempts,
so that I can measure my learning progress.

## Acceptance Criteria

**Given** I have taken a quiz multiple times
**When** I view my current attempt results
**Then** I see a comparison to my first attempt:
  - "First attempt: 60%"
  - "Current attempt: 85%"
  - "Improvement: +25%"

**Given** my current score is higher than my previous best
**When** viewing the improvement
**Then** the improvement is displayed in green with a positive indicator (+25%)
**And** I see an encouraging message with a trophy icon: "New personal best!"

**Given** my current score is lower than my previous best
**When** viewing the comparison
**Then** I see my best score with attempt number: "Your best: 90% (attempt #3)"
**And** I see the current score: "Current: 75%"
**And** there is NO negative messaging (no "You did worse" or red colors)
**And** I see neutral encouragement: "Keep practicing to beat your best!"

**Given** this is my first attempt
**When** viewing the results
**Then** no comparison is shown (nothing to compare against)
**And** I see a message: "First attempt complete! Retake to track improvement."

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/analytics.ts` with `calculateImprovement` function (AC: all)
  - [ ] 1.1 Implement the function signature exactly as specified in the epic
  - [ ] 1.2 Handle single-attempt edge case (returns null improvement, isNewBest: false)
  - [ ] 1.3 Sort attempts by completedAt ascending to determine chronological order
  - [ ] 1.4 Compute firstScore, currentScore, improvement delta
  - [ ] 1.5 Find bestAttemptNumber across ALL attempts (including current)
  - [ ] 1.6 isNewBest: true only when current > all previous attempts (strict greater than)

- [ ] Task 2: Refactor `ScoreSummary.tsx` props to accept rich improvement data (AC: all)
  - [ ] 2.1 Add `improvementData` prop (optional, type from analytics.ts return value)
  - [ ] 2.2 Remove `previousBestPercentage` prop — replace with improvementData (breaking change, update QuizResults.tsx call site)
  - [ ] 2.3 Render "First attempt complete! Retake to track improvement." when attempts.length === 1
  - [ ] 2.4 Render first/current/improvement panel when attempts.length > 1
  - [ ] 2.5 Trophy icon + "New personal best!" for isNewBest in green (text-success)
  - [ ] 2.6 Regression state: best score + attempt number + "Keep practicing to beat your best!" in neutral color (no red)
  - [ ] 2.7 Update aria-live sr-text to include improvement data

- [ ] Task 3: Update `QuizResults.tsx` to compute and pass improvement data (AC: all)
  - [ ] 3.1 Import calculateImprovement from analytics.ts
  - [ ] 3.2 Replace previousBestPercentage useMemo with improvementData useMemo (pass attempts)
  - [ ] 3.3 Pass improvementData to ScoreSummary

- [ ] Task 4: Unit tests for `calculateImprovement` (AC: all)
  - [ ] 4.1 Single attempt → no comparison, isNewBest: false
  - [ ] 4.2 Two attempts, improvement → correct firstScore, currentScore, improvement, isNewBest: true
  - [ ] 4.3 New personal best (strict greater than) — correctly identified
  - [ ] 4.4 Regression case — bestScore and bestAttemptNumber correct, isNewBest: false
  - [ ] 4.5 bestAttemptNumber counts correctly across all attempts

- [ ] Task 5: Update `ScoreSummary.test.tsx` for new prop shape (AC: all)
  - [ ] 5.1 Add tests for first-attempt state (message shown)
  - [ ] 5.2 Add tests for new personal best state (trophy + green)
  - [ ] 5.3 Add tests for regression state (neutral messaging, no red)
  - [ ] 5.4 Update existing improvement-summary test for new prop shape
  - [ ] 5.5 Verify no negative "You did worse" text appears in regression state

- [ ] Task 6: E2E test in `tests/e2e/e16-s03-score-improvement.spec.ts` (AC: all)
  - [ ] 6.1 First attempt → no comparison section visible
  - [ ] 6.2 Second attempt with higher score → "+X%" improvement shown in green
  - [ ] 6.3 Third attempt as new personal best → "New personal best!" with trophy
  - [ ] 6.4 Attempt lower than previous best → neutral best score display, no red

## Design Guidance

**Layout approach:** Add a `ScoreImprovementPanel` sub-section within `ScoreSummary`, below the time display. Use `bg-surface-sunken rounded-lg p-4 mt-4`. This keeps it grouped with the score ring visually.

**4 states to render:**
1. **First attempt only** — subtle muted message: "First attempt complete! Retake to track improvement." (no panel, just a text line)
2. **Improvement (isNewBest: true)** — panel with first/current/improvement rows, trophy icon in `text-success`, "New personal best!" in `text-success font-semibold`
3. **Regression (isNewBest: false, attempts > 1)** — panel showing best score with attempt#, current score, neutral encouragement in `text-muted-foreground`
4. **No data** — nothing rendered (attempts.length === 0 or improvementData is null)

**Color rules:**
- Positive improvement: `text-success font-semibold`
- Neutral/regression: `text-muted-foreground` — never `text-destructive` or red
- Trophy icon: `lucide-react` `Trophy` component, `h-4 w-4 text-success inline`

**Design tokens only** — no hardcoded colors.

## Implementation Notes

**Key architectural decision:** Replace `previousBestPercentage?: number` prop on `ScoreSummary` with `improvementData?: ReturnType<typeof calculateImprovement>`. This is a breaking internal change (no public API surface) — update the single call site in `QuizResults.tsx` simultaneously.

**`calculateImprovement` nuance:** The epic spec has a subtle bug — `bestAttempt` is calculated over ALL attempts (including current) while `isNewBest` compares current vs. `bestPrevious` (excluding current). This is correct behavior: bestAttemptNumber shows the overall best (may be current), while isNewBest only shows "new best" if current beats all PREVIOUS attempts. Follow this exactly.

**Sort stability:** `attempts` from the store may come in any order from Dexie. Always sort by `completedAt` ascending before identifying first/current.

**Plan file:** [docs/implementation-artifacts/plans/e16-s03-score-improvement.md](plans/e16-s03-score-improvement.md)

## Testing Notes

**Unit test location:** `src/lib/__tests__/analytics.test.ts` (new file)
**Unit test update:** `src/app/components/quiz/__tests__/ScoreSummary.test.tsx` (update existing)
**E2E test location:** `tests/e2e/e16-s03-score-improvement.spec.ts` (new file)

E2E seed pattern: Use `useQuizStore.setState({ attempts: [...] })` in beforeEach for unit tests. For E2E, complete actual quiz flows via Playwright.

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
- [ ] No hardcoded colors — design tokens only
- [ ] Regression state uses neutral colors — never destructive/red

## Design Review Feedback

_Awaiting /review-story._

## Code Review Feedback

_Awaiting /review-story._

## Web Design Guidelines Review

_Awaiting /review-story._

## Challenges and Lessons Learned

_Story not yet implemented. Update after implementation._
