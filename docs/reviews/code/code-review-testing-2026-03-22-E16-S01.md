# Test Coverage Review — E16-S01: Review All Questions and Answers After Completion

**Date:** 2026-03-22
**Branch:** feature/e16-s01-review-all-questions-and-answers-after-completion
**Reviewer:** code-review-testing agent
**Coverage Gate:** PASS (6/6 ACs ≥80% threshold)

---

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | "Review Answers" button navigates to `/quiz/:quizId/review/:attemptId` | None | `story-e16-s01.spec.ts:124` (direct URL, not button click) | **Partial** |
| 2 | Each question displays submitted answer and correct answer | `QuizReview.test.tsx:118`, `MultipleChoiceQuestion.review.test.tsx:13,22,36` | `story-e16-s01.spec.ts:136` | Covered |
| 3 | Correct answers highlighted success, incorrect in warning | `MultipleChoiceQuestion.review.test.tsx` (MC only) | `story-e16-s01.spec.ts:136` | **Partial** — TF/MS/FIB untested |
| 4 | Previous/Next navigation | `QuizReview.test.tsx:136,146,154` | `story-e16-s01.spec.ts:150` | Covered |
| 5 | "Back to Results" on last question returns to results | `QuizReview.test.tsx:165` | `story-e16-s01.spec.ts:169` | Covered |
| 6 | Invalid attempt ID shows error state | `QuizReview.test.tsx:124,130` | `story-e16-s01.spec.ts:190` | Covered |

**6/6 ACs have at least one test.** 0 complete gaps. 2 partials.

---

## Findings

### High Priority

**H1: AC1 button click never exercised end-to-end (confidence: 88)**
- The E2E test skips the "Review Answers" button click and navigates directly to the review URL. The `handleReviewAnswers` callback in `QuizResults.tsx:89-92` (including the `!lastAttempt` guard and URL construction) is never exercised.
- **Fix:** Add an E2E scenario that seeds full results state, navigates to the quiz results route, clicks `getByRole('button', { name: /review answers/i })`, and asserts the URL matches `/quiz/review/${ATTEMPT_ID}`.

**H2: TrueFalseQuestion, MultipleSelectQuestion, FillInBlankQuestion have zero review mode unit tests (confidence: 85)**
- Only `MultipleChoiceQuestion` has a review-mode test file. Three other question types each contain non-trivial review logic:
  - `MultipleSelectQuestion.tsx:74-85` — `isMissed` dashed-border logic for partially correct answers
  - `TrueFalseQuestion.tsx:64-75` — identical structure to MC but untested
  - `FillInBlankQuestion.tsx:104-135` — three distinct states in review mode (correct, case-insensitive, wrong)
- **Fix:** Add `TrueFalseQuestion.review.test.tsx`, `MultipleSelectQuestion.review.test.tsx`, `FillInBlankQuestion.review.test.tsx` mirroring the MC test pattern.

**H3: QuizReview missing quiz-not-found error path (confidence: 80)**
- `QuizReview.tsx:81-84`: the attempt is found but `db.quizzes.get(a.quizId)` returns `undefined`. This path has no test. Existing tests cover `attempt === undefined` and a thrown exception, but not a missing quiz record.
- **Fix:** Add test: `mockQuizAttempts.get.mockResolvedValue(testAttempt)` + `mockQuizzes.get.mockResolvedValue(undefined)` → assert error state renders.

### Medium Priority

**M1: `aria-current` assertion is one-sided in `ReviewQuestionGrid.test.tsx:64` (confidence: 72)**
- Verifies Q1 button has `aria-current="step"` but never verifies Q2 does NOT. A bug where every button gets `aria-current` would go undetected.
- **Fix:** Add `expect(screen.getByRole('button', { name: /Question 2/i })).not.toHaveAttribute('aria-current')`.

**M2: Visual indicators (colored dot) not asserted in grid test (confidence: 70)**
- `ReviewQuestionGrid.tsx:44-53` renders a `<span>` with `bg-success`/`bg-warning` per question. Tests only check `aria-label` text. A regression removing the dot would go unnoticed.
- **Fix:** Add assertion for the indicator span's presence.

**M3: All page integration tests use only MultipleChoice questions (confidence: 68)**
- `QuizReview.test.tsx` fixture uses only `multiple-choice`. A regression in `QuestionDisplay` dispatch for other types would not be caught at the page level.
- **Fix:** Add a second fixture quiz with `true-false` question.

**M4: Manual IndexedDB seeding instead of shared helper in E2E (confidence: 65)**
- `story-e16-s01.spec.ts:75-107` implements its own `seedStore()` with retry logic rather than using project's shared helpers.
- This duplicates maintenance work if the schema changes.

### Nits

- **Nit:** `MultipleChoiceQuestion.review.test.tsx:6-10` — fixture defined at module scope, inconsistent with project's `beforeEach` pattern.
- **Nit:** `story-e16-s01.spec.ts:123` — test labelled "AC1: navigate directly to review URL" but AC1 is about button click; misleading label.
- **Nit:** `QuizReview.test.tsx:175-183` — `getAllByRole('button', { name: /Question 2/i })[0]` with `[0]` disambiguation; use `within()` scoping instead.

---

## Edge Cases Not Covered

- **Unanswered/skipped question in review mode** — `review-disabled` mode path not exercised in page tests; `makeSkippedAnswer` factory unused in QuizReview tests.
- **Single-question quiz** — when `isFirst` and `isLast` are both true simultaneously, no test verifies Previous is disabled + "Back to Results" appears.
- **Question ordering** — sort by `order` not verified; out-of-insertion-order questions untested.
- **Empty questions array** — `quiz.questions = []` causes runtime crash (no guard, no test).
- **E2E only seeds MultipleChoice** — AC2 covers Multiple Select and Fill-in-Blank but E2E only uses MC.

---

## Summary

| Severity | Count |
|----------|-------|
| Blocker  | 0 |
| High     | 3 |
| Medium   | 4 |
| Nit      | 3 |

ACs covered: 6/6 | Gate: **PASS**
