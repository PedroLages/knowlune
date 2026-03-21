---
story_id: E13-S05
story_name: "Randomize Question Order with Fisher-Yates Shuffle"
status: in-progress
started: 2026-03-21
completed:
reviewed: false
review_started:
review_gates_passed: []
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
  - [ ] 3.3 Distribution test (uniform distribution over 10,000 runs)
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

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- **Existing implementation found**: Fisher-Yates was already implemented inline in `useQuizStore.ts` — the story became an extraction refactor rather than new algorithm work. Always check for existing code before implementing.
- **Distribution testing**: The 10K-run uniformity test validates statistical correctness that E2E tests can't cover. Each element must appear in each position ~20% ±5% of the time for an unbiased shuffle.
- **Immutability matters**: The spread-copy-then-swap pattern ensures callers can safely pass arrays without defensive copies.
