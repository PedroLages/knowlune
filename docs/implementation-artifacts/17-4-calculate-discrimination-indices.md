---
story_id: E17-S04
story_name: "Calculate Discrimination Indices"
status: reviewed
started: 2026-03-23
completed: 2026-03-23
reviewed: true
review_started: 2026-03-23
review_gates_passed:
  - build
  - lint
  - typecheck
  - prettier
  - unit-tests
  - e2e-smoke
  - e2e-story
  - code-review
  - code-review-testing
  - design-review
burn_in_validated: false
---

# Story 17.4: Calculate Discrimination Indices

## Story

As a learner,
I want to see which questions effectively distinguish between my strong and weak attempts,
So that I can understand which questions are most indicative of my knowledge.

## Acceptance Criteria

**Given** I have multiple attempts on a quiz (minimum 5 attempts for meaningful results)
**When** calculating discrimination for each question
**Then** the system uses point-biserial correlation between question correctness and total score

**Given** I have fewer than 5 attempts on a quiz
**When** viewing discrimination indices
**Then** I see a message: "Need at least 5 attempts for meaningful discrimination analysis"

**Given** a question is highly discriminating
**When** viewing its discrimination index
**Then** I see a high value (>0.3)
**And** this indicates: "You tend to get this question right on high-scoring attempts and wrong on low-scoring attempts."

**Given** a question has medium discrimination (0.2 to 0.3)
**When** viewing the metric
**Then** I see an indicator: "Moderate discriminator — this question partially differentiates strong and weak attempts."

**Given** a question has low discrimination (<0.2)
**When** viewing the metric
**Then** I see an indicator: "This question doesn't correlate well with overall performance - might be ambiguous or overly easy/hard."

## Tasks / Subtasks

- [ ] Task 1: Add `calculateDiscriminationIndices` to `src/lib/analytics.ts` (AC: 1, 2, 3, 4, 5)
  - [ ] 1.1 Write failing unit tests in `src/lib/__tests__/analytics.test.ts`
  - [ ] 1.2 Implement the function
  - [ ] 1.3 Run unit tests and verify they pass

- [ ] Task 2: Create `DiscriminationAnalysis` component (AC: 2, 3, 4, 5)
  - [ ] 2.1 Create `src/app/components/quiz/DiscriminationAnalysis.tsx`
  - [ ] 2.2 Handle the `null` (< 5 attempts) empty state
  - [ ] 2.3 Render discrimination index list with interpretation text

- [ ] Task 3: Integrate `DiscriminationAnalysis` into `QuizResults.tsx`
  - [ ] 3.1 Import and render `DiscriminationAnalysis` below `ItemDifficultyAnalysis`
  - [ ] 3.2 Pass `currentQuiz` and `attempts` props

- [ ] Task 4: Add E2E tests
  - [ ] 4.1 Create `tests/e2e/regression/story-e17-s04.spec.ts`
  - [ ] 4.2 AC1: 5 attempts → discrimination values visible
  - [ ] 4.3 AC2: < 5 attempts → "Need at least 5 attempts" message

## Design Guidance

**Component placement:** Below `ItemDifficultyAnalysis` in `QuizResults.tsx`, same card-based layout pattern.

**Empty state:** `<p className="text-sm text-muted-foreground">Need at least 5 attempts for meaningful discrimination analysis.</p>` — consistent with ItemDifficultyAnalysis empty state.

**Discrimination value display:** Rounded to 2 decimal places (`toFixed(2)`), similar to P-value display pattern.

**Interpretation badges/text:** Use `text-muted-foreground text-xs` for interpretation strings (consistent with ItemDifficultyAnalysis suggestion text).

**Design tokens:** Never use hardcoded colors — use `text-muted-foreground`, `text-success`, `text-warning`, `text-destructive-soft-foreground`, etc.

## Implementation Notes

**Point-biserial correlation formula:**
- X = question correctness (0 or 1) across all attempts
- Y = total quiz score (attempt.score — raw points, not percentage)
- Groups: group1 = attempts where question is correct; group0 = incorrect
- Formula: `rpb = ((mean1 - mean0) / sd) * sqrt(p * (1-p))`
- sd = sample standard deviation (n-1 denominator)
- Guard: return `{ discriminationIndex: 0, interpretation: 'All scores identical — cannot discriminate' }` when sd === 0
- Guard: return `{ discriminationIndex: 0, interpretation: 'Not enough data' }` when group1 or group0 is empty

**Thresholds:**
- rpb > 0.3 → "High discriminator — you tend to get this right on strong attempts and wrong on weak ones."
- rpb >= 0.2 → "Moderate discriminator — this question partially differentiates strong and weak attempts."
- rpb < 0.2 → "Low discriminator — doesn't correlate well with overall performance. Might be ambiguous or overly easy/hard."

**Dependency note:** This story's QuizResults integration depends on E17-S03 having landed (ItemDifficultyAnalysis component). If E17-S03 is merged before this story, import ItemDifficultyAnalysis normally. If it hasn't landed on main yet, the branch should be rebased on top of E17-S03.

**Implementation plan:** [docs/implementation-artifacts/plans/2026-03-23-e17-s04-discrimination-indices.md](plans/2026-03-23-e17-s04-discrimination-indices.md)

## Testing Notes

**Unit tests** (in `src/lib/__tests__/analytics.test.ts`, new `describe('calculateDiscriminationIndices')` block):
- Known data set with manually verified rpb value
- Returns null when < 5 attempts
- Returns discriminationIndex: 0 when sd === 0 (all scores identical)
- Handles edge cases: all correct, all incorrect
- Correct interpretation text for each tier (high/medium/low)
- Uses sample standard deviation (n-1)

**E2E tests** (Playwright, `tests/e2e/regression/story-e17-s04.spec.ts`):
- 5+ attempts → component renders with discrimination values
- < 5 attempts → "Need at least 5 attempts" message shown

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
