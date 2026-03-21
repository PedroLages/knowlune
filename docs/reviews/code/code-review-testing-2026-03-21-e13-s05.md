## Test Coverage Review: E13-S05 — Randomize Question Order with Fisher-Yates Shuffle

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | `shuffleQuestions: true` → Fisher-Yates randomization, equal probability (1/n!), unbiased | `src/lib/__tests__/shuffle.test.ts:34` (distribution 10K runs) | `tests/e2e/story-e13-s05.spec.ts:102` | Covered |
| 2 | Retake → different order, independent of prior attempts | None | `tests/e2e/story-e13-s05.spec.ts:121` | Covered |
| 3 | `shuffleQuestions: false` → original `order` sequence, no shuffle applied | None | `tests/e2e/story-e13-s05.spec.ts:157` | Covered |
| 4 | `src/lib/shuffle.ts`: Fisher-Yates, O(n), immutable, generic | `src/lib/__tests__/shuffle.test.ts:5,12,19,23,27` | None | Covered (see note on O(n)) |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`tests/e2e/story-e13-s05.spec.ts:118` (confidence: 82)**: AC1 E2E test asserts `expect(order).not.toEqual(originalOrder)`, which has a 1/120 (~0.83%) probability of producing a false failure when the shuffle legitimately returns the original order. The AC requires equal probability across all permutations, but a single-run inequality check is an imperfect proxy. The unit-level distribution test at `src/lib/__tests__/shuffle.test.ts:34` provides the rigorous coverage here, so the E2E test is acceptable as a smoke check — but the test comment should acknowledge this is a probabilistic assertion, not a deterministic one. Fix: Document the limitation explicitly (comment is already partially there at line 116) and consider adding a note that AC1's statistical guarantee is fully covered by the unit distribution test rather than by this E2E assertion.

- **`tests/e2e/story-e13-s05.spec.ts:154` (confidence: 78)**: AC2 retake test also uses a single `expect(secondOrder).not.toEqual(firstOrder)` assertion. Two independent shuffles of 5 items have a 1/120 (~0.83%) chance of producing identical orderings, making this test probabilistically flaky. This is the same pattern as AC1 but the risk is slightly higher because it compares two live shuffle outputs rather than one against a known sequence. Fix: Accept the known flakiness rate (document it) or switch to asserting that `questionOrder` in the store changes between attempts by inspecting `localStorage` state, which is deterministic.

#### Medium

- **`tests/e2e/story-e13-s05.spec.ts:67` (confidence: 72)**: The `getCurrentQuestionText` helper uses `page.locator('fieldset legend')` — a structural CSS selector that will break if the quiz question component is ever refactored away from a `fieldset`/`legend` pattern. The quiz question component should expose a `data-testid="question-text"` attribute, or the selector should use an ARIA role such as `getByRole('group')` with an accessible name. Fix: Add `data-testid="question-text"` to the question legend element and update the helper to `page.getByTestId('question-text')`.

- **`tests/e2e/story-e13-s05.spec.ts:59` (confidence: 65)**: The `seedQuizData` local wrapper duplicates the `seedQuizzes` convenience function already exported from `tests/support/helpers/indexeddb-seed.ts` (line 251). This introduces a parallel seeding path that could diverge from the shared helper if the database name or store name ever changes. Fix: Replace the local `seedQuizData` with a direct import of `seedQuizzes` from the shared helper.

- **`tests/e2e/story-e13-s05.spec.ts:20` (confidence: 60)**: Test-level question data (`questions`, `shuffledQuiz`, `unshuffledQuiz`) is defined as module-level constants with fixed IDs (`q1-e13s05` through `q5-e13s05`, `quiz-e13s05-shuffle`, `quiz-e13s05-noshuffle`). While the data is read-only and Playwright provides per-test browser context isolation, the shared module-level state means any test that mutates the array (currently none do) would corrupt subsequent tests in the same module without a clear error. Fix: Low-risk as-is given read-only usage; acceptable until a test needs to mutate fixture data, at which point move to per-test factory calls.

#### Nits

- **Nit** `src/lib/__tests__/shuffle.test.ts:34` (confidence: 55): The distribution test uses a 5% tolerance (`±5%`) across 10,000 runs. For 5 items the expected count per cell is 2,000. A ±5% tolerance allows counts as low as 1,900 or as high as 2,100. This is statistically robust but the tolerance value is undocumented. Consider adding a comment explaining the statistical rationale (e.g., "±5% at 10K runs gives >99.99% confidence of detecting position bias") for future maintainers.

- **Nit** `src/lib/__tests__/shuffle.test.ts` (confidence: 45): AC4 specifies O(n) time complexity but no test asserts this. O(n) is the natural property of a correct Fisher-Yates implementation (single loop, one swap per iteration) and is verifiable by code inspection of `src/lib/shuffle.ts:2-8`. No action required — this is a structural property, not an observable behavior.

- **Nit** `tests/e2e/story-e13-s05.spec.ts:93` (confidence: 40): `test.describe` has a `beforeEach` that seeds `localStorage.setItem('eduvi-sidebar-v1', 'false')` via `addInitScript`. There is no `afterEach` cleanup. This is intentionally safe because Playwright's per-test browser context isolation handles teardown, but adding a brief comment to that effect would make the intent explicit for reviewers unfamiliar with the context isolation model.

---

### Edge Cases to Consider

- **Two-question quiz shuffle**: The current tests use 5 questions. Fisher-Yates with 2 items has only 2 possible permutations (50/50 chance). A test with 2 questions asserting "not equal to original" would flake 50% of the time. This edge case is not tested but is low-risk in practice since the distribution unit test covers it implicitly.

- **Single-question quiz with `shuffleQuestions: true`**: `fisherYatesShuffle([singleId])` returns the single-element array unchanged (covered by unit test at `src/lib/__tests__/shuffle.test.ts:23`), and `startQuiz` would apply the shuffle path. The E2E "original order" assertion would still pass. Not a risk, but worth noting.

- **`questionOrder` persistence on page reload**: `useQuizStore` persists `currentProgress` (including `questionOrder`) via `zustand/middleware persist` (`useQuizStore.ts:226`). There is no test verifying that a mid-quiz reload restores the same question order rather than re-shuffling. If `resumeQuiz` were ever changed to call `startQuiz` instead of relying on hydration, order would change mid-attempt. This is a behavioral edge case with no current test.

- **`shuffleQuestions` field absent from seeded record**: The `makeQuiz` factory defaults `shuffleQuestions` to `false` (`quiz-factory.ts:37`). If an older persisted quiz record lacks the field entirely (e.g., pre-story data), `quiz.shuffleQuestions` evaluates to `undefined` which is falsy — no shuffle applied. This is safe but not explicitly tested with a `undefined` field value.

---

ACs: 4 covered / 4 total | Findings: 8 | Blockers: 0 | High: 2 | Medium: 2 | Nits: 4
