---
story_id: E13-S05
story_name: "Randomize Question Order with Fisher-Yates Shuffle"
status: done
started: 2026-03-21
completed: 2026-03-21
reviewed: true
review_started: 2026-03-21
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines-skipped]
burn_in_validated: false
---

# Story 13.5: Randomize Question Order with Fisher-Yates Shuffle

## Story

As a learner,
I want quiz questions to appear in random order on each attempt,
so that I cannot rely on memorizing question positions.

## Acceptance Criteria

**Given** a quiz with `shuffleQuestions: true`
**When** I start the quiz
**Then** the questions are randomized using Fisher-Yates shuffle algorithm
**And** every permutation of question order has equal probability (1/n!)
**And** the randomization is unbiased (no position bias)

**Given** I retake the same quiz
**When** starting a new attempt
**Then** the questions are shuffled again in a different order
**And** the shuffle is independent of previous attempts (new random seed each time)

**Given** a quiz with `shuffleQuestions: false`
**When** I start the quiz
**Then** questions appear in their original `order` property sequence
**And** no shuffling is applied

**Given** the shuffling algorithm
**When** implemented in `src/lib/shuffle.ts`
**Then** it uses Fisher-Yates shuffle with O(n) time complexity
**And** it creates a new array (does not mutate the original)
**And** it works with any array type (generic implementation)

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/shuffle.ts` with Fisher-Yates implementation (AC: 1, 4)
  - [ ] 1.1 Implement generic `fisherYatesShuffle<T>` function
  - [ ] 1.2 Ensure immutability (new array, no mutation)
  - [ ] 1.3 O(n) time complexity
- [ ] Task 2: Integrate shuffle into `useQuizStore.startQuiz` (AC: 1, 2, 3)
  - [ ] 2.1 Apply shuffle when `quiz.shuffleQuestions === true`
  - [ ] 2.2 Skip shuffle when `shuffleQuestions === false`
  - [ ] 2.3 Ensure new shuffle on each attempt
- [ ] Task 3: Write unit tests for `fisherYatesShuffle` (AC: 4)
  - [ ] 3.1 Valid permutation test (all elements present)
  - [ ] 3.2 Immutability test (original not mutated)
  - [ ] 3.3 Distribution test (uniform distribution over 50,000 runs)
- [ ] Task 4: Write E2E tests (AC: 1, 2, 3)
  - [ ] 4.1 Shuffle enabled → questions in random order
  - [ ] 4.2 Retake → different order
  - [ ] 4.3 Shuffle disabled → original order preserved

## Implementation Plan

See [plan](plans/e13-s05-randomize-question-order.md) for implementation approach.

## Implementation Notes

- Extracted existing inline `shuffleArray` from `useQuizStore.ts` to `src/lib/shuffle.ts` as `fisherYatesShuffle<T>`
- No new dependencies — pure algorithm extraction

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

Skipped — no UI changes in this story (pure algorithm extraction + store integration).

## Code Review Feedback

**2026-03-21** — 0 blockers, 1 high, 3 medium, 2 nits.
- HIGH: E2E flakiness — `not.toEqual` assertions have 1/120 chance of false failure (documented, unit distribution test provides rigorous coverage)
- MEDIUM: `.sort()` mutates array under test, `readonly` parameter type, distribution test tolerance
- See full report: `docs/reviews/code/code-review-2026-03-21-e13-s05.md`

## Web Design Guidelines Review

Skipped — no UI changes in this story.

## Challenges and Lessons Learned

- **Existing implementation found**: Fisher-Yates was already implemented inline in `useQuizStore.ts` — the story became an extraction refactor rather than new algorithm work. Always check for existing code before implementing.
- **Distribution testing**: The 10K-run uniformity test validates statistical correctness that E2E tests can't cover. Each element must appear in each position ~20% ±5% of the time for an unbiased shuffle.
- **Immutability matters**: The spread-copy-then-swap pattern ensures callers can safely pass arrays without defensive copies.
- **Deterministic mock design**: The `mockMathRandom` helper needed two review rounds to simplify — avoid shadowing parameter names with inner variables, and prefer flat sequence arrays over wrapper functions.
- **E2E shuffle assertions are inherently probabilistic**: `not.toEqual` for randomness has a 1/n! false-failure rate. For a 5-element array that's 1/120 per assertion — acceptable for E2E, but unit distribution tests are the real correctness gate.
- **Review-driven refactoring pays off**: Two review cycles caught a shadowed parameter, missing defensive guard on `quiz.questions`, and `.sort()` mutating the array under test — all subtle bugs that manual testing wouldn't surface.
