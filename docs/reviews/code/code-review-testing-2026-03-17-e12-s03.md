## Test Coverage Review: E12-S03 — Create useQuizStore with Zustand

### AC Coverage Summary

**Acceptance Criteria Coverage:** 7/8 ACs tested (**87.5%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Store follows `create<State>()(persist(...))` pattern; exports individual selectors; implements optimistic update pattern; persist auto-saves `currentProgress` with key `levelup-quiz-store`; includes all required actions | `useQuizStore.test.ts:502` (partialize/key); all action describe blocks present | None | Partial — selectors exported but not exercised in tests; optimistic update tested indirectly via submitAnswer; all actions present in impl |
| 2 | `startQuiz`: loads quiz from Dexie by lessonId, applies Fisher-Yates shuffle when `shuffleQuestions` is true, persists `questionOrder`, initializes `QuizProgress` (index=0, empty answers, start time, empty markedForReview), sets `timeRemaining` from `timeLimit` | `useQuizStore.test.ts:53` (shuffle=true), `:104` (shuffle=false), `:150` (not found) | None | Partial — `timeLimit` branch only tested for `null`; non-null `timeLimit` mapping to `timeRemaining` untested |
| 3 | `submitAnswer`: stores answer in `currentProgress.answers[questionId]`; updates Zustand optimistically; localStorage auto-saves via persist (debounced); does NOT write to Dexie | `useQuizStore.test.ts:167` | None | Partial — no-op guard (no active progress) not exercised |
| 4 | `submitQuiz`: calculates score via `calculateQuizScore`; creates `QuizAttempt`; writes to Dexie with retry (3 attempts, backoff); on success clears `currentProgress`; on exhaustion reverts state, shows error toast, preserves `currentProgress` | `useQuizStore.test.ts:247` (success), `:299` (rollback+toast) | None | Covered |
| 5 | Cross-store: calls `useContentProgressStore.setItemStatus(courseId, lessonId, 'completed', modules)` only after Dexie write succeeds and score meets passing threshold | `useQuizStore.test.ts:265` (pass), `:283` (fail) | None | Covered |
| 6 | `retakeQuiz`: calls `startQuiz` with same lessonId, generates fresh shuffle order, resets all progress | `useQuizStore.test.ts:331` | None | Covered |
| 7 | `resumeQuiz`: rehydrates `currentProgress` including answers, `questionOrder`, `markedForReview`, `timerAccommodation`; does NOT re-shuffle | `useQuizStore.test.ts:382` | None | Covered — no-op behavior correctly verified |
| 8 | `toggleReviewMark`: adds/removes questionId from `currentProgress.markedForReview` | `useQuizStore.test.ts:412` (add), `:431` (remove) | None | Covered |

**Coverage**: 7/8 ACs fully or substantially covered | 0 complete gaps | 3 partial (AC1, AC2, AC3)

---

### Test Quality Findings

#### Blockers (untested ACs)

None — all ACs have at least one test.

#### High Priority

- **`src/lib/scoring.ts` — no test file (confidence: 95)**: `calculateQuizScore` is a pure function with four question-type branches (`multiple-choice`, `true-false`, `fill-in-blank`, `multiple-select`) and boundary logic (unanswered treated as incorrect, `maxScore=0` guard, percentage rounding to one decimal). There is no `src/lib/__tests__/scoring.test.ts`. The function is exercised transitively through `submitQuiz` tests, but only the `multiple-choice` path is ever hit. The `fill-in-blank` case-insensitive match, `multiple-select` all-or-nothing set comparison, partial-credit boundary (e.g. `1/3` questions correct → `33.3%`), and the `maxScore=0` guard (`percentage = 0`) are entirely untested.
  Suggested test file: `src/lib/__tests__/scoring.test.ts`. Key cases: each question type correct/incorrect, unanswered question counted as incorrect, `percentage` rounding (`1/3 * 100 = 33.3`), `passed` threshold boundary (exactly at `passingScore`), and empty questions array.

- **`src/stores/__tests__/useQuizStore.test.ts:167` — `submitAnswer` no-op guard not tested (confidence: 80)**: The AC states "does NOT write to Dexie" and the implementation guards with `state.currentProgress ?`. The story notes explicitly call out `submitAnswer with no active progress → no-op` as an edge case covered. However, examining the test file there is no test exercising a `submitAnswer` call when `currentProgress` is `null`. The single test always starts a quiz first. A call with no active quiz should leave `currentProgress` as `null` and not throw.
  Suggested test: in the `submitAnswer` describe block, call `submitAnswer('q1', 'A')` on a fresh store and assert `currentProgress` remains `null`.

- **AC1 — Exported selectors untested (confidence: 72)**: The store exports five individual selectors (`selectCurrentQuiz`, `selectCurrentProgress`, `selectAttempts`, `selectIsLoading`, `selectError`). The AC explicitly requires that "it exports individual selectors (never destructure full store)". No test verifies that these selectors exist, are callable, or return the expected slice. The absence of selector tests means a future refactor could silently break them.
  Suggested tests: import each selector and call `useQuizStore(selectCurrentQuiz)` etc., asserting the returned values match the raw state fields. These are trivial but provide a safety net for the exported API contract.

#### Medium

- **`src/stores/__tests__/useQuizStore.test.ts` — inline quiz fixtures instead of factory functions (confidence: 75)**: The test file inlines full quiz object literals 5 times (lines 54–88, 107–141, 170–194, 217–243, 335–360). The project has `tests/support/fixtures/factories/quiz-factory.ts` exporting `makeQuiz` and `makeQuestion` with `FIXED_DATE` timestamps. Using inline objects means timestamps are hardcoded strings (`'2025-01-15T12:00:00.000Z'`) rather than the canonical `FIXED_DATE`, and the inline objects must be updated in multiple places if the `Quiz` type changes. The `loadAttempts` test (line 458) also inlines `QuizAttempt` objects rather than using `makeAttempt`.
  Fix: replace inline quiz literals with `makeQuiz({ id: '...', lessonId: '...', shuffleQuestions: true, questions: [...] })` and inline attempt literals with `makeAttempt(...)`. The `makeQuestion` factory produces realistic question text and options — use it for question arrays.

- **`src/stores/__tests__/useQuizStore.test.ts:299` — rollback test uses `mockRejectedValueOnce` without verifying retry was attempted (confidence: 70)**: The `persistWithRetry` mock replaces the real implementation with `async (op) => op()` — a single-shot executor. The rollback test spies on `db.quizAttempts.add` and rejects once. This proves the catch block fires, but because `persistWithRetry` is mocked away entirely, the test does not verify that the store correctly wires the retry wrapper around the DB write. If someone changed `submitQuiz` to call `db.quizAttempts.add` directly (bypassing `persistWithRetry`), the rollback test would still pass. A comment in the test referencing `persistWithRetry.test.ts` is present — this is acceptable given the test strategy documented in the story — but flagged here at Medium because the integration boundary is invisible in the test output.

- **`src/stores/__tests__/useQuizStore.test.ts:502` — partialize fallback branch always passes (confidence: 65)**: The `persist partialize` test has a fallback path (`else { expect(true).toBe(true) }`) at line 528. This is a vacuous assertion that will always pass regardless of the actual partialize behavior. The condition is `if (persistApi)` — if Zustand ever removes the `.persist.getOptions()` API the test silently degrades to a no-op pass. Remove the fallback or replace it with `expect(persistApi).toBeDefined()` to make the failure visible.

#### Nits

- **Nit `src/stores/__tests__/useQuizStore.test.ts:53`** (confidence: 60): The `startQuiz` shuffle test at line 100 uses `expect.arrayContaining(['q1', 'q2'])` and `.toHaveLength(2)`, which is correct but does not assert that `questionOrder` contains only IDs from the quiz's questions (no duplicates or extraneous entries). For a two-question quiz this is fine; for future multi-question variants it could mask a bug in `shuffleArray`. Consider asserting `toEqual(expect.arrayContaining(['q1', 'q2']))` with a length check — already done — this is a minor observation.

- **Nit `src/stores/__tests__/useQuizStore.test.ts`** (confidence: 55): The `setupQuizInProgress` helper (line 214) is scoped inside the `submitQuiz` describe block but duplicates quiz construction logic that also appears in `retakeQuiz` and `startQuiz` tests. Extracting it to a module-level helper or using `makeQuiz` from the factory would reduce maintenance surface.

- **Nit `src/stores/__tests__/useQuizStore.test.ts:66`** (confidence: 50): The `startTime` field in `QuizProgress` is set to `Date.now()` inside `startQuiz` (store implementation line 65). The ESLint rule `test-patterns/deterministic-time` flags `Date.now()` in tests, but this `Date.now()` is in the production store code, not in the test. The tests never assert on `startTime` value — they only assert on `answers`, `quizId`, and `questionOrder`. This is acceptable but worth noting: if a future test needs to assert on `startTime` or `completedAt` (which also uses `new Date().toISOString()` in `submitQuiz` line 105), the non-deterministic timestamps will require mocking `Date` via `vi.useFakeTimers()`.

### Edge Cases to Consider

- **`timeLimit` non-null path**: `startQuiz` sets `timeRemaining: quiz.timeLimit ?? null`. All tests pass `timeLimit: null`. No test exercises a quiz with `timeLimit: 30` to confirm `timeRemaining` is initialized to `30` (not `null`). This is a two-line path in the store with zero test coverage.

- **`submitQuiz` called with no active quiz or progress**: The store guards `if (!currentQuiz || !currentProgress) return` at line 89. This early-return path is listed in the story notes as an edge case but has no corresponding test. A test calling `submitQuiz('course-1', [])` on a fresh store should assert that no DB write occurs and state remains unchanged.

- **`clearQuiz` action**: Implemented at line 147 as `set({ currentQuiz: null, currentProgress: null, attempts: [], error: null })`. The action is listed in the AC ("includes actions: ... clearQuiz") and in the required interface. No test exercises `clearQuiz` or verifies it resets all four fields.

- **`clearError` action**: Implemented at line 164 as `set({ error: null })`. Included in AC1 action list. No test covers it.

- **`loadAttempts` empty result**: The `loadAttempts` test seeds two records and expects two results. No test verifies behavior when no attempts exist for a `quizId` — the result should be an empty array, not an error.

- **`toggleReviewMark` with no active progress**: The implementation guards `if (!state.currentProgress) return {}`. If `currentProgress` is null (e.g. before `startQuiz`), calling `toggleReviewMark` should silently no-op. This path has no test.

- **`retakeQuiz` with non-existent lessonId**: If `startQuiz` sets `error: 'Quiz not found'` during a retake attempt, what is the resulting state? The test only covers the happy path where the quiz exists.

- **`calculateQuizScore` — `fill-in-blank` and `multiple-select` types**: These branches exist in `src/lib/scoring.ts` (lines 22–34) but are never invoked by any test. A quiz whose questions use these types would exercise untested code paths through the `submitQuiz` integration, but the pure-function isolation in `scoring.ts` makes dedicated unit tests the cleaner approach.

---

ACs: 7 covered / 8 total (87.5%) | Findings: 10 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 4
