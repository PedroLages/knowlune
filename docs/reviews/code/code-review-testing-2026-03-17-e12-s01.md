## Test Coverage Review: E12-S01 — Create Quiz Type Definitions

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Exports all required interfaces (Quiz, Question, QuizAttempt, Answer, QuizProgress, QuestionMedia); Zod schemas use `.safeParse()`; QuestionType has all 4 variants; JSDoc present; importable via `@/types/quiz` | `quiz.test.ts:94–127` (media), `133–174` (question), `259–309` (quiz), `315–348` (answer), `354–428` (attempt), `434–493` (progress), `500–519` (type inference) | None (no UI) | Covered |
| 2 | Question `correctAnswer` is `string \| string[]`; `options` optional; `media` uses `QuestionMedia` type | `quiz.test.ts:154–161` (media field), `510–518` (string correctAnswer), `515–518` (string[] correctAnswer) | None | Covered |
| 3 | QuizProgress includes `markedForReview: string[]`, `questionOrder: string[]`, `timerAccommodation: 'standard' \| '150%' \| '200%' \| 'untimed'` | `quiz.test.ts:435–462` (valid progress with all three fields), `379–395` (all 4 accommodation values) | None | Covered |
| 4 | `passingScore` constrained to 0-100 via `z.number().min(0).max(100)` | `quiz.test.ts:270–288` (boundary -1, 101, 0, 100) | None | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four ACs have direct test coverage.

---

#### High Priority

- **`src/types/quiz.ts:101` (confidence: 92)**: The exported `Question` type is inferred from `BaseQuestionSchema` (the pre-refinement schema), not from the refinement-augmented `QuestionSchema`. This means callers who use the `Question` type for static typing can construct values that would fail runtime validation — for example, a `Question` with `type: 'multiple-choice'` and `options: undefined` is type-correct but schema-invalid. The type annotation on the test factory (`makeMCQuestion(): Question`) masks this: `makeMCQuestion({ options: undefined })` is accepted by TypeScript even though `QuestionSchema.safeParse()` correctly rejects it. The test at `quiz.test.ts:17–29` uses `Question` as the return type annotation, so the type-inference tests (lines 501–518) only verify `BaseQuestionSchema`'s shape, not the constrained shape. Fix: infer `Question` from `QuestionSchema` using a Zod `.transform()` or `.brand()` workaround, or document the deliberate split prominently and add a test that explicitly asserts the type divergence is intentional (e.g., a comment-guarded compile-error test).

- **`src/types/__tests__/quiz.test.ts` (confidence: 75)**: The `QuestionSchema` refinement error message (`'Question options do not match the expected constraints for this question type'`) is never asserted. All refinement-failure tests only check `result.success === false`, not the error path content. When downstream code surfaces validation errors to users or logs them for debugging, a meaningless or missing message is a silent failure. Suggested test in `quiz.test.ts` inside the `'QuestionSchema — type-specific refinements'` describe block:
  ```
  it('refinement failure carries descriptive error message', () => {
    const result = QuestionSchema.safeParse(makeMCQuestion({ options: undefined }))
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map(i => i.message)
      expect(msgs).toContain('Question options do not match the expected constraints for this question type')
    }
  })
  ```

---

#### Medium

- **`src/types/__tests__/quiz.test.ts:1–11` (confidence: 80)**: `QuestionTypeEnum` and `TimerAccommodationEnum` are exported public API surface but are never imported or directly tested. The enum tests are indirect (they appear inside question/attempt validations). A dedicated test verifying that each enum rejects invalid values (e.g., `QuestionTypeEnum.safeParse('essay')` returns `{ success: false }`) would protect against future enum changes silently breaking callers. Suggested addition in a new `'QuestionTypeEnum / TimerAccommodationEnum'` describe block at the top of the test file.

- **`src/types/__tests__/quiz.test.ts:379–395` (confidence: 72)**: The timer accommodation test in `QuizAttemptSchema` iterates all four valid values in a single `it` block using a `for` loop. If one iteration fails, the failure message only reports the loop variable value via the assertion, not which test case triggered it. Prefer `it.each` (Vitest's parameterized test API) to get a distinct test row per accommodation value and a cleaner failure output. This is a quality/reporting issue, not a correctness gap.

- **`src/types/__tests__/quiz.test.ts:72–88` (confidence: 68)**: The `makeQuiz` factory casts `questions` with `as unknown as Quiz['questions']` to work around the `BaseQuestionSchema` vs `QuestionSchema` type mismatch described above in the High Priority finding. This cast silently papers over the type issue at test time and would need to be removed if the `Question` type is corrected to infer from `QuestionSchema`. The cast is a smell that signals the type divergence, not a test correctness problem in isolation.

- **`src/types/__tests__/quiz.test.ts:354–428` (confidence: 65)**: `QuizAttemptSchema` field constraint tests are sparse. `percentage` is tested for the upper bound (>100 rejected at line 413), but the lower bound (percentage < 0 rejected) has no test. `score`, `timeSpent`, and `pointsEarned` lower-bound tests exist for `AnswerSchema` but `QuizAttemptSchema`'s own `score` and `timeSpent` min(0) constraints are untested. Suggested additions: `'rejects negative percentage'`, `'rejects negative score'`, `'rejects negative timeSpent'` in the `QuizAttemptSchema` describe block.

---

#### Nits

- **Nit** `src/types/__tests__/quiz.test.ts:260–309` (confidence: 55): The `QuizSchema` describe block tests `rejects quiz with missing required fields` by passing `{ id: 'quiz-1' }` (line 296). This is a coarse smoke test. If the intent is to verify that each required field independently produces a failure, it would be more targeted to test one field at a time (e.g., `makeQuiz()` with `title` deleted). As written it is still useful but provides less diagnostic precision.

- **Nit** `src/types/__tests__/quiz.test.ts:280–288` (confidence: 50): `passingScore` boundary tests at 0 and 100 are present (lines 280, 285), which is good. There is no test for `passingScore` as a non-integer float (e.g., `70.5`). The Zod schema uses `z.number().min(0).max(100)` without `.int()`, so a float passes. Whether this is intentional (percentages are continuous) or an oversight is worth a comment in the schema. No test change required unless the intent is integers only.

- **Nit** `src/types/__tests__/quiz.test.ts:163–173` (confidence: 45): The MC boundary tests (min 2 options, max 6 options) are present but the `multiple-select` counterpart only tests the rejection of `options: undefined` (line 208). The MS boundary tests for 1 option (below minimum) and 7 options (above maximum) are absent, though this is low risk given the MC refinement uses the same code path (`2-6` constraint is shared).

---

### Edge Cases to Consider

1. **`QuestionSchema` with `correctAnswer: []` (empty array for MS)**: An MS question with `correctAnswer: []` is an empty string-array, which is a valid `string[]` per the union type and passes `BaseQuestionSchema`. No test verifies whether this is accepted or rejected — the schema does not constrain `correctAnswer` count, so it silently passes. This would be a nonsensical quiz question.

2. **`QuizProgressSchema` with `answers` record containing unknown question IDs**: The `answers` record is typed as `Record<string, string | string[]>` with no cross-validation against `questionOrder`. A crash-recovery state containing answers for question IDs not in `questionOrder` will parse as valid. This is a deliberate schema boundary (cross-object validation belongs in the store layer), but it should be documented as an acknowledged gap.

3. **`QuizSchema` with `questions` array containing duplicate IDs**: Two questions with `id: 'q1'` would parse as valid. No uniqueness constraint exists at the schema level. This is a reasonable omission for a types-only story but worth a note for the store/service layer in Epic 12.

4. **`AnswerSchema` with `pointsEarned > pointsPossible`**: No inter-field constraint prevents a valid `Answer` where `pointsEarned: 20, pointsPossible: 10`. The schema validates each field independently. Likely deferred to scoring logic in Epic 14, but worth a comment.

5. **`QuizAttemptSchema` `percentage` not derived from `score`**: The schema accepts a `percentage: 0` with `score: 100` — no cross-field validation. Again, expected for a types-only story, but the discrepancy would be a silent bug if callers construct attempts manually.

---

ACs: 4 covered / 4 total | Findings: 10 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 4
