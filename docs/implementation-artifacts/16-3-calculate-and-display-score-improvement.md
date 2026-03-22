---
story_id: E16-S03
story_name: "Calculate and Display Score Improvement"
status: done
started: 2026-03-22
completed: 2026-03-22
reviewed: true
review_started: 2026-03-22
review_gates_passed:
  - build
  - lint
  - type-check
  - prettier
  - unit-tests
  - e2e-smoke
  - e2e-story-spec
  - code-review
  - code-review-testing
  - design-review
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

- [x] Task 1: Create `src/lib/analytics.ts` with `calculateImprovement` function (AC: all)
  - [x] 1.1 Implement the function signature exactly as specified in the epic
  - [x] 1.2 Handle single-attempt edge case (returns null improvement, isNewBest: false)
  - [x] 1.3 Sort attempts by completedAt ascending to determine chronological order
  - [x] 1.4 Compute firstScore, currentScore, improvement delta
  - [x] 1.5 Find bestAttemptNumber across ALL attempts (including current)
  - [x] 1.6 isNewBest: true only when current > all previous attempts (strict greater than)

- [x] Task 2: Refactor `ScoreSummary.tsx` props to accept rich improvement data (AC: all)
  - [x] 2.1 Add `improvementData` prop (optional, type from analytics.ts return value)
  - [x] 2.2 Remove `previousBestPercentage` prop — replace with improvementData (breaking change, update QuizResults.tsx call site)
  - [x] 2.3 Render "First attempt complete! Retake to track improvement." when attempts.length === 1
  - [x] 2.4 Render first/current/improvement panel when attempts.length > 1
  - [x] 2.5 Trophy icon + "New personal best!" for isNewBest in green (text-success)
  - [x] 2.6 Regression state: best score + attempt number + "Keep practicing to beat your best!" in neutral color (no red)
  - [x] 2.7 Update aria-live sr-text to include improvement data

- [x] Task 3: Update `QuizResults.tsx` to compute and pass improvement data (AC: all)
  - [x] 3.1 Import calculateImprovement from analytics.ts
  - [x] 3.2 Replace previousBestPercentage useMemo with improvementData useMemo (pass attempts)
  - [x] 3.3 Pass improvementData to ScoreSummary

- [x] Task 4: Unit tests for `calculateImprovement` (AC: all)
  - [x] 4.1 Single attempt → no comparison, isNewBest: false
  - [x] 4.2 Two attempts, improvement → correct firstScore, currentScore, improvement, isNewBest: true
  - [x] 4.3 New personal best (strict greater than) — correctly identified
  - [x] 4.4 Regression case — bestScore and bestAttemptNumber correct, isNewBest: false
  - [x] 4.5 bestAttemptNumber counts correctly across all attempts

- [x] Task 5: Update `ScoreSummary.test.tsx` for new prop shape (AC: all)
  - [x] 5.1 Add tests for first-attempt state (message shown)
  - [x] 5.2 Add tests for new personal best state (trophy + green)
  - [x] 5.3 Add tests for regression state (neutral messaging, no red)
  - [x] 5.4 Update existing improvement-summary test for new prop shape
  - [x] 5.5 Verify no negative "You did worse" text appears in regression state

- [x] Task 6: E2E test in `tests/e2e/e16-s03-score-improvement.spec.ts` (AC: all)
  - [x] 6.1 First attempt → no comparison section visible
  - [x] 6.2 Second attempt with higher score → "+X%" improvement shown in green
  - [x] 6.3 Third attempt as new personal best → "New personal best!" with trophy
  - [x] 6.4 Attempt lower than previous best → neutral best score display, no red

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

## Dev Agent Record

### Implementation Notes

- `calculateImprovement` added to existing `src/lib/analytics.ts` (file already existed with topic analysis). Co-locates all quiz analytics in one module.
- Single-attempt: `improvement: null, isNewBest: false` — the `null` check gates the panel display cleanly without needing `attempts.length`.
- `bestAttemptNumber` computed over the original (unsorted) `attempts` array to preserve consistent 1-based insertion-order numbering.
- E2E seeding: seeds Zustand persist state (`levelup-quiz-store` localStorage key) with `currentQuiz` before page load, seeds Dexie `quizAttempts` after app init so `loadAttempts()` picks them up.
- "New personal best!" text appears in both the sr-only aria-live region and the visible panel — E2E tests scope to `[data-testid="improvement-summary"]` to avoid strict mode violations.

### File List

- `src/lib/analytics.ts` — added `ImprovementData` type + `calculateImprovement()`
- `src/lib/__tests__/analytics.test.ts` — added 9 `calculateImprovement` unit tests
- `src/app/components/quiz/ScoreSummary.tsx` — replaced `previousBestPercentage` prop with `improvementData`; added `ScoreImprovementPanel` sub-component
- `src/app/components/quiz/__tests__/ScoreSummary.test.tsx` — updated for new prop shape; added 12 improvement panel tests
- `src/app/pages/QuizResults.tsx` — replaced previousBestPercentage useMemo with calculateImprovement
- `tests/e2e/e16-s03-score-improvement.spec.ts` — 4 E2E scenarios (all 4 ACs)

## Challenges and Lessons Learned

- Zustand store's `levelup-quiz-store` localStorage key uses `partialize: state => ({ currentProgress, currentQuiz })` — only these two fields are persisted, so seeding just those fields is sufficient to make `QuizResults.tsx` skip its redirect guard.
- Playwright strict mode fails when `getByText()` matches both sr-only aria-live regions and visible elements with the same text. Always scope improvement panel assertions to `getByTestId('improvement-summary')`.
- `isNewBest: false` for single attempt (not `true`) avoids "New personal best!" appearing on first attempt — the `improvement !== null` check in the panel gates the comparison display.
