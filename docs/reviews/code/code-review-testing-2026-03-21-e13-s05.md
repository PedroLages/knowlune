## Test Coverage Review: E13-S05 — Randomize Question Order with Fisher-Yates Shuffle

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | `shuffleQuestions: true` → Fisher-Yates randomization, equal probability (1/n!), unbiased | `src/lib/__tests__/shuffle.test.ts:41` (50K-run distribution, ±8% tolerance) | `tests/e2e/story-e13-s05.spec.ts:139` (deterministic mock, asserts shuffled != original) | Covered |
| 2 | Retake → different order each attempt, independent of prior attempts | None | `tests/e2e/story-e13-s05.spec.ts:162` (two deterministic sequences, asserts orders differ) | Covered |
| 3 | `shuffleQuestions: false` → original `order` property sequence, no shuffle | None | `tests/e2e/story-e13-s05.spec.ts:204` (no mock, asserts strict equality to original) | Covered |
| 4 | `src/lib/shuffle.ts`: Fisher-Yates O(n), immutable new array, generic `<T>` | `src/lib/__tests__/shuffle.test.ts:5,12,19,26,30,34` (permutation, immutability, readonly, empty, single-element, strings) | None | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`tests/e2e/story-e13-s05.spec.ts:75-98` (confidence: 88)**: The `mockMathRandom` function has a misleading design that introduces a latent correctness risk. The outer function signature is `function mockMathRandom(sequences: number[][])` but its body immediately discards the `sequences` parameter — the body consists only of `return (sequences: number[][]) => { ... }` where the inner function's own `sequences` parameter shadows and replaces the outer one. The actual sequences reach the browser via the second argument to `addInitScript(fn, arg)`. This works correctly today because both call sites at lines 143 and 164 pass the correct arg, but anyone reading the call `mockMathRandom([RANDOM_SEQUENCE_A])` would reasonably conclude the sequences are bound at that call — they are not. If a future developer removes the `addInitScript` second argument, the mock silently falls through to `originalRandom()` and the test becomes probabilistically flaky with no error. Fix: Rename `mockMathRandom` to a plain factory-free arrow function and inline the sequences directly as the `addInitScript` arg, or add a comment in the function body stating `// outer `sequences` param is intentionally unused — data arrives via addInitScript arg`.

#### Medium

- **`tests/e2e/story-e13-s05.spec.ts:162-201` (confidence: 75)**: The AC2 retake test answers all 5 questions by navigating backward 4 times then forward 4 times, clicking radio option 'A' each time. This is correct but fragile: if the shuffle mock produces an order where `getByRole('radio', { name: 'A' })` matches ambiguously (multiple radios with accessible name 'A' on screen), the click could target the wrong element. The options in the test fixture are `['A', 'B', 'C', 'D']` which is fine, but the test's correctness depends on the option labels being short enough to match role names. A more stable pattern would be `page.getByRole('radio').first().click()` or selecting by `value` attribute via `page.locator('[value="A"]')`. Confidence deducted because current fixtures make this safe in practice. Fix: Scope radio selection with `.within()` the current question container, or use `page.getByRole('radio').first()`.

- **`tests/e2e/story-e13-s05.spec.ts:139-160` (confidence: 72)**: The AC1 test does not verify that the shuffled order specifically matches the expected permutation `[5,2,4,3,1]` produced by RANDOM_SEQUENCE_A. It asserts only `expect(order).not.toEqual(originalOrder)`, which would pass even if the mock were silently no-oping (as long as some other non-identity shuffle occurred). The deterministic mock's value is fully realized only if the assertion checks the exact expected output. Fix: Assert `expect(order).toEqual(['Question 5', 'Question 2', 'Question 4', 'Question 3', 'Question 1'])` (or derive it from the documented swap sequence). This converts the test from a probabilistic smoke check into a deterministic, proof-of-mock-correctness assertion.

- **`src/lib/__tests__/shuffle.test.ts:9` (confidence: 65)**: The valid-permutation test sorts both `result` and the expected array before comparison: `expect([...result].sort()).toEqual([1, 2, 3, 4, 5])`. The sort call operates on numbers using JavaScript's default lexicographic comparator, which orders `[1, 2, 3, 4, 5]` correctly by coincidence. If the test were extended with values like `[10, 9, 2]`, `sort()` would produce `[10, 2, 9]` (lexicographic) rather than `[2, 9, 10]` (numeric), making the assertion subtly wrong. This is a Nit-level risk for the current fixture but worth noting as a pattern. Fix: Use `[...result].sort((a, b) => a - b)` for numeric arrays.

#### Nits

- **Nit** `tests/e2e/story-e13-s05.spec.ts:131-137` (confidence: 45): The `beforeEach` seeds `localStorage.setItem('knowlune-sidebar-v1', 'false')` via `addInitScript` but there is no `afterEach` cleanup. This is intentionally safe because Playwright provides full browser-context isolation per test. A brief comment (`// No afterEach needed — Playwright isolates browser context per test`) would make the intent explicit for reviewers unfamiliar with this guarantee.

- **Nit** `src/lib/__tests__/shuffle.test.ts:57` (confidence: 40): The distribution test documents the ±8% tolerance rationale in a comment (`// ±8% tolerance = ±800, well beyond 3σ (268) — negligible false failure rate`). This is good. The comment could be strengthened by also stating the implied false-positive rate for completeness (approximately 1 in 10^13 per assertion at 3σ), which would help future maintainers calibrate whether the tolerance is too tight if run count is ever lowered.

- **Nit** `src/stores/useQuizStore.ts:56-63` (confidence: 35): The `startQuiz` empty-questions guard added in this story (`error: 'Quiz has no questions'`) has no corresponding unit or integration test. The E2E tests do not exercise this path. This is a new behavioral branch in the store that is not covered. Low severity because it is a defensive guard rather than a user-facing feature, but a unit test asserting the error state would complete the branch coverage. Suggested test location: `src/stores/__tests__/useQuizStore.test.ts`, asserting `store.error === 'Quiz has no questions'` when `startQuiz` is called with a quiz that has an empty `questions` array.

---

### Edge Cases to Consider

- **`questionOrder` persistence across page reload**: `useQuizStore` persists `currentProgress` (including `questionOrder`) via Zustand's persist middleware. There is no test verifying that a mid-quiz page reload restores the same shuffled order from localStorage rather than re-shuffling. If `retakeQuiz` or `resumeQuiz` were ever modified to call `startQuiz` on hydration, the order would silently change mid-attempt. A test asserting that `questionOrder` is unchanged after `page.reload()` during an active quiz would close this gap.

- **`shuffleQuestions` field absent from quiz record**: `startQuiz` evaluates `quiz.shuffleQuestions ? fisherYatesShuffle(...) : identity(...)`. If a quiz record stored before this story was written lacks the field entirely, `quiz.shuffleQuestions` evaluates to `undefined` (falsy) — no shuffle applied. This is the correct safe default, but is not explicitly tested. A unit test with `shuffleQuestions: undefined` would confirm the contract.

- **Two-question quiz with shuffle enabled**: Fisher-Yates on 2 items has exactly 2 permutations. A `not.toEqual(original)` assertion on a two-question quiz would flake 50% of the time. The current 5-question test fixture avoids this, but if the minimum question count is ever relaxed, this class of test would be unreliable. The distribution unit test covers 5-element arrays; adding a 2-element distribution check would document the boundary behavior.

- **`questionOrder` contains question IDs, display depends on lookup**: `startQuiz` stores shuffled question IDs in `questionOrder`, not the question objects themselves. The display layer must look up each question by its ID from `currentQuiz.questions`. There is no test verifying that the rendered display order matches `questionOrder` when IDs and question array positions diverge. This is an implicit integration assumption.

---

ACs: 4 covered / 4 total | Findings: 6 | Blockers: 0 | High: 1 | Medium: 3 | Nits: 2 (plus 1 Nit under Medium threshold)
