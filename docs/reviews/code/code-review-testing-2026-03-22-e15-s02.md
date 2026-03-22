## Test Coverage Review: E15-S02 — Configure Timer Duration and Accommodations

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Quiz start screen shows default time limit and accommodations button | None | `tests/e2e/story-e15-s02.spec.ts:81-99` | Covered |
| 2 | Modal shows radio options (standard, 150%, 200%, untimed) with explanation text | `src/types/__tests__/quiz.test.ts:381-397` (schema) | `tests/e2e/story-e15-s02.spec.ts:101-124` | Covered |
| 3 | 150% accommodation applies multiplier; timer shows 22:30 with annotation | None (unit) | `tests/e2e/story-e15-s02.spec.ts:126-152` | Covered (E2E only) |
| 4 | Untimed mode hides timer display; quiz still runs | None (unit) | `tests/e2e/story-e15-s02.spec.ts:154-179` | Covered (E2E only) |
| 5 | Preference persists across retakes (localStorage) | None (unit) | `tests/e2e/story-e15-s02.spec.ts:181-227` | Covered (E2E only) |

**Coverage**: 5/5 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All five ACs have at least one test.

---

#### High Priority

- **`src/stores/__tests__/useQuizStore.test.ts` — all `startQuiz` calls (confidence: 90)**: The store's `startQuiz` accepts an optional `accommodation` parameter (line 24 of `useQuizStore.ts`), and the multiplier branch at lines 87-89 is the core business logic for AC3, AC4, and AC5. Every call in the unit test suite passes no second argument, meaning `startQuiz('les-tl', '150%')`, `startQuiz('les-tl', '200%')`, and `startQuiz('les-tl', 'untimed')` are never exercised at the unit level. A regression in the multiplier arithmetic (e.g., accidentally inverting `1.5` to `0.5`) would not be caught until the E2E suite runs.

  Suggested tests to add to `src/stores/__tests__/useQuizStore.test.ts` inside a new `describe('startQuiz — accommodation multiplier')` block:

  - `'sets timeRemaining to 150% of timeLimit when accommodation is "150%"'` — call `startQuiz('les-xxx', '150%')` on a quiz with `timeLimit: 10`, assert `currentProgress.timeRemaining === 15` and `currentProgress.timerAccommodation === '150%'`.
  - `'sets timeRemaining to 200% of timeLimit when accommodation is "200%"'` — same setup, expect `timeRemaining === 20`.
  - `'sets timeRemaining to null when accommodation is "untimed"'` — expect `timeRemaining === null` and `timerAccommodation === 'untimed'`.
  - `'defaults accommodation to "standard" when argument is omitted'` — verify `timerAccommodation === 'standard'` and `timeRemaining` equals the raw `timeLimit`.

- **`tests/e2e/story-e15-s02.spec.ts:174-175` — `toBeHidden()` on a non-rendered element (confidence: 75)**: The AC4 timer assertion uses `page.locator('[data-testid="quiz-timer"]').toBeHidden()`. When `timerRemaining` is `null`, the `QuizTimer` component is not rendered at all (the `QuizHeader` renders it only when `timeRemaining !== null`). Playwright's `toBeHidden()` returns true for elements not in the DOM, so the assertion passes for the right reason — but the intent of the test is to assert absence, not hidden visibility. A stronger assertion would be `not.toBeInViewport()` or `expect(timerDisplay).toHaveCount(0)` using `page.locator(...)`. The current approach is not wrong but could silently pass if the element were rendered with `display: none` for an unrelated reason.

  Suggested fix: Replace line 174-175 with:
  ```
  await expect(page.locator('[data-testid="quiz-timer"]')).toHaveCount(0)
  ```
  This is unambiguous about the element not existing in the DOM.

---

#### Medium

- **`tests/e2e/story-e15-s02.spec.ts:205-209` — conditional submit confirm with `isVisible` + `.catch` (confidence: 65)**: The AC5 retake test uses a `try/catch` guard (`submitConfirm.isVisible({ timeout: 2000 }).catch(() => false)`) to handle an optional confirmation dialog. This pattern makes the test pass whether or not the dialog appears, which means a regression that silently swallows the submission confirmation would not be detected. If the confirmation dialog is a known, consistent part of the submit flow, the test should always assert and click it rather than treating it as optional.

- **`tests/e2e/story-e15-s02.spec.ts:215` — clearing `levelup-quiz-store` instead of `quiz-accommodation-` key (confidence: 80)**: In the AC5 persistence test, the test clears `levelup-quiz-store` from localStorage to force the start screen to appear again, but does not clear the quiz-specific progress key `quiz-progress-quiz-e15s02-timed`. The accommodation preference is stored under `quiz-accommodation-test-lesson-e15s02` (written by `handleAccommodationChange` in `Quiz.tsx` at line 165). The test correctly does not remove this key, since the whole point is to verify it persists. However, the test does not explicitly verify which localStorage key is being read — it only checks the UI reflects the saved value. A complementary unit test on `loadSavedAccommodation` (a pure function in `Quiz.tsx:63-72`) would provide faster, more explicit coverage of the Zod validation fallback path.

- **`src/app/pages/Quiz.tsx:63-72` — `loadSavedAccommodation` Zod fallback path has no test (confidence: 78)**: The `loadSavedAccommodation` helper validates the stored string via `TimerAccommodationEnum.safeParse()` and falls back to `'standard'` for tampered or unknown values. The Challenges and Lessons Learned section of the story explicitly calls this out as an important edge case. Neither the unit tests nor the E2E spec exercise this path (setting `quiz-accommodation-<lessonId>` to `'300%'` or `'hack'` in localStorage and then loading the quiz page).

  Suggested unit test location: `src/app/pages/__tests__/Quiz.accommodation.test.ts` or added to the E2E spec as a focused scenario:
  - Seed `localStorage.setItem('quiz-accommodation-test-lesson-e15s02', '300%')` before navigation.
  - Verify the start screen opens the modal with "Standard time" pre-selected (the fallback).

- **`tests/e2e/story-e15-s02.spec.ts` — no test for 200% accommodation multiplier (confidence: 72)**: AC2 verifies the "200% extended time" option appears in the modal. AC3 only tests the 150% path end-to-end (timer shows 22:30 with annotation). The 200% path (timer should show 30:00 with annotation) has no corresponding E2E test for the full flow — modal selection through timer display. This is a gap in multiplier coverage given that 150% and 200% use different multiplier constants.

  Suggested test: Add `'AC3b: 200% accommodation applies multiplier — timer shows 30:00 with annotation'` to the spec, following the same pattern as the AC3 test but selecting the 200% radio and asserting `page.getByText('30:00')` is visible.

---

#### Nits

- **Nit `tests/e2e/story-e15-s02.spec.ts:19-20`**: `COURSE_ID` and `LESSON_ID` are module-level constants that never change across tests. They could be colocated with the quiz fixture as named properties (`timedQuiz.courseId` / `timedQuiz.lessonId` equivalents) to make the seeding helper self-contained and reduce the distance between fixture definition and its dependencies.

- **Nit `tests/e2e/story-e15-s02.spec.ts:70-74`**: The `startQuiz` helper duplicates the `page.getByRole('button', { name: /start quiz/i })` pattern. Since this helper is only used in two tests (AC3 and AC4), it is fine — but consider naming it `clickStartQuiz` to distinguish it from the store action of the same name and reduce cognitive load when reading the file.

- **Nit `src/stores/__tests__/useQuizStore.test.ts:398-437`**: The `retakeQuiz — resets timeRemaining` test at line 398 verifies that `timeRemaining` returns to `30` after a retake, which is correct for the standard accommodation. It should also be noted (not necessarily tested here) that a retake with an accommodation passes the accommodation through `retakeQuiz → startQuiz`, so the timer would be reset to the accommodated value, not the raw `timeLimit`. A brief comment in the test or a companion test would document this contract.

---

### Edge Cases to Consider

- **Tampered localStorage accommodation value**: `localStorage.setItem('quiz-accommodation-<lessonId>', 'invalid')` then navigate to quiz — should silently fall back to `'standard'`. Currently exercised only by implementation code; no test covers this path. (See Medium finding above.)

- **Untimed accommodation on a quiz that already has `timeLimit: null`**: The accommodations button is conditionally rendered only when `quiz.timeLimit != null` (line 97 of `QuizStartScreen.tsx`). This guard means the button is correctly absent for inherently untimed quizzes. No test verifies this negative: that the accommodations button does NOT appear when the quiz has no time limit. A targeted assertion — seed a quiz with `timeLimit: null`, navigate, and assert the accommodations button is absent — would lock in this contract.

- **Modal local state reset on re-open without saving**: The `TimerAccommodationsModal` resets its internal `selected` state from the `value` prop via `useEffect` on open (line 54-56 of `TimerAccommodationsModal.tsx`). There is no test for the scenario where a user opens the modal, changes the radio selection, presses Escape to dismiss (no save), then reopens — the previous committed value should be pre-selected, not the dismissed intermediate selection.

- **200% accommodation timer annotation**: `QuizHeader` renders the `annotation="Extended Time"` string for both `'150%'` and `'200%'` (line 29 of `QuizHeader.tsx`). The annotation display for the 200% path is untested end-to-end.

- **Accommodation selection interaction with in-progress resume**: If a user starts a quiz with `'150%'`, saves progress mid-quiz, then returns and the store rehydrates the `timerAccommodation: '150%'` from localStorage, the timer should resume with the extended time, not the base time. This resume-with-accommodation path is not covered by any test.

---

ACs: 5 covered / 5 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 3
