## Test Coverage Review: E18-S08 — Display Quiz Availability Badges on Courses Page

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Lesson with quiz → "Take Quiz" badge visible (muted style) | None | `tests/e2e/story-e18-s08.spec.ts:152` | Covered |
| 2 | Lesson without quiz → no badge shown | None | `tests/e2e/story-e18-s08.spec.ts:160` | Covered |
| 3 | Lesson with completed quiz → "Quiz: X%" badge with best score in success color | None | `tests/e2e/story-e18-s08.spec.ts:167` | Partial |
| 4 | Click badge → navigates to `/courses/:courseId/lessons/:lessonId/quiz` | None | `tests/e2e/story-e18-s08.spec.ts:175` | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four ACs have at least one E2E test.

---

#### High Priority

- **`tests/e2e/story-e18-s08.spec.ts:167` (confidence: 82)**: AC3 asserts the badge text "Quiz: 85%" but does not assert the success color on the score span. The AC explicitly requires "success color", and the implementation places the color on an inner `<span className="text-success">` child — not on the button element with the `data-testid`. The current assertion `toContainText('Quiz: 85%')` only validates the text content; a CSS-class or computed-style check on the span is absent. If the `text-success` class is accidentally removed from `src/app/components/courses/QuizBadge.tsx:37`, the test still passes.

  Fix: Add an assertion targeting the inner span. Because Playwright's `getByTestId` returns the button, locating the child can be done with `.locator('span').first()` or — better — by adding a `data-testid="quiz-score-text"` attribute on the span in `QuizBadge.tsx` and asserting `await expect(badge.getByTestId('quiz-score-text')).toHaveClass(/text-success/)`.

- **`tests/e2e/story-e18-s08.spec.ts` (confidence: 78)**: The spec has no `afterEach` cleanup for the `quizzes`, `quizAttempts`, or `courses` stores seeded via the local `seedToStore` helper. Playwright's `indexedDBFixture` (which auto-clears `importedCourses` on teardown) is extended by the merged fixture in `tests/support/fixtures/index.ts`, but the stores written directly in `setupCourseDetail` — `courses`, `quizzes`, and `quizAttempts` — are never cleared. If tests share a browser context (possible with `reuseExistingServer: true` in CI), a passing attempt from a previous test can leak into the next test that expects a null score, causing AC1 to fail intermittently.

  Fix: Add an `afterEach` block that calls `seedToStore` with an empty array using the `store.clear()` path, or preferably use `clearIndexedDBStore` from `tests/support/helpers/indexeddb-seed.ts` which already exists and handles retries:
  ```ts
  import { clearIndexedDBStore } from '../support/helpers/indexeddb-seed'
  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
    await clearIndexedDBStore(page, 'ElearningDB', 'quizzes')
    await clearIndexedDBStore(page, 'ElearningDB', 'courses')
  })
  ```
  This gap is also flagged in the story's pre-review checklist at line 95: `[ ] E2E afterEach cleanup uses await (not fire-and-forget)` — the checkbox is unchecked, confirming the author identified this but did not resolve it before review.

---

#### Medium

- **`tests/e2e/story-e18-s08.spec.ts:163` (confidence: 72)**: The "no badge" assertion uses `not.toBeVisible()`. Because `QuizBadge` is conditionally rendered via `quizScoreMap.has(lesson.id)` in `ModuleAccordion.tsx:167`, the element is not in the DOM at all when the quiz is absent — it is not hidden via CSS. `not.toBeVisible()` passes for both "not in DOM" and "in DOM but hidden", so the assertion is correct but weaker than intended. A stricter assertion is `not.toBeAttached()` which only passes when the element is entirely absent from the DOM, making it a true structural check rather than a visibility check. If a future change renders the badge with `display:none` instead, `not.toBeVisible()` would still pass while `not.toBeAttached()` would catch the regression.

  Fix: Change line 165 to `await expect(badge).not.toBeAttached()`.

- **`tests/e2e/story-e18-s08.spec.ts` (confidence: 70)**: The local `seedToStore` function (lines 76-116) reimplements logic that already exists in `tests/support/helpers/indexeddb-seed.ts` (`seedIndexedDBStore`, `seedQuizzes`, `seedQuizAttempts`). The shared helper uses `requestAnimationFrame`-based retry timing; the local copy uses `setTimeout`. These are functionally equivalent but the duplication means two divergent implementations to maintain and the test misses the frame-accurate timing the shared helper was designed to provide.

  Fix: Replace `seedToStore` and all its call sites with the existing helper functions. Import `seedQuizzes` and `seedQuizAttempts` directly from `tests/support/helpers/indexeddb-seed.ts`.

- **`tests/e2e/story-e18-s08.spec.ts:31-46` (confidence: 65)**: Module-level construction of `lessonWithQuiz`, `lessonWithoutQuiz`, `testModule`, `testCourse`, `quiz`, and `completedAttempt` means these objects are shared across all four tests. If any test mutates the seeded data at runtime (unlikely but possible via `store.put` with the same ID and modified fields), that mutation could be observable by later tests. The current tests do not mutate, so this is low risk today but is a latent isolation concern.

  Fix: Wrap the fixture construction in a helper function called inside `setupCourseDetail` so each test receives freshly constructed data, consistent with the factory pattern established in `tests/support/fixtures/factories/`.

---

#### Nits

- **Nit** `tests/e2e/story-e18-s08.spec.ts:1` (confidence: 60): No `test.describe` blocks are used to group the four tests. Other story specs in the regression suite (`story-e23-s05.spec.ts:30`) use `test.describe('AC1: …')` wrapping. Grouping by AC improves CI output readability, especially when individual tests fail.

- **Nit** `tests/e2e/story-e18-s08.spec.ts:64-68` (confidence: 55): `completedAttempt` has `percentage: 85`. This value is representative, but no test covers the two boundary extremes: `percentage: 0` (score of zero — badge should show "Quiz: 0%" not "Take Quiz") and `percentage: 100` (perfect score). The `Math.round(best)` call in `useQuizScoresForCourse.ts:55` makes both safe in production, but a score-of-0 test would verify the three-state distinction (`null` vs `0`) is handled correctly, since `bestScore != null` in `QuizBadge.tsx:36` treats `0` as a completed score.

---

### Edge Cases to Consider

1. **Score of 0% not tested.** `useQuizScoresForCourse` sets `map.set(quiz.lessonId, Math.round(best))` which produces `0` for a zero-score attempt. `QuizBadge` checks `bestScore != null`, so `0` correctly renders "Quiz: 0%" rather than "Take Quiz". However, no test seeds a `percentage: 0` attempt to verify this boundary. Suggested test: `'lesson with zero-score attempt shows "Quiz: 0%" badge'` in `tests/e2e/story-e18-s08.spec.ts`, seeding `makeAttempt({ quizId: QUIZ_ID, percentage: 0, passed: false })`.

2. **Multiple quiz attempts — best score selection not verified.** `useQuizScoresForCourse.ts:54` uses `Math.max(...quizAttempts.map(a => a.percentage))` to compute the best score. No test seeds multiple attempts (e.g., 40% then 85%) to confirm the displayed badge shows the higher value. Suggested test: `'lesson with multiple attempts shows best score badge'` seeding two attempts with `percentage: 40` and `percentage: 85`, asserting "Quiz: 85%".

3. **Empty modules array.** If `modules` is `[]`, `lessonIdKey` is `""` and the `useEffect` guard `if (!lessonIdKey) return` exits early, returning an empty map. This is correct behavior but has no test. If the guard is accidentally removed, the hook would call `lessonIdKey.split(',')` yielding `['']` and attempt a Dexie query with an empty lessonId, potentially returning unexpected results.

4. **Click propagation not independently tested.** `QuizBadge.tsx:29` calls `e.stopPropagation()` to prevent the parent `<Link>` from also navigating. The AC4 test at line 175 only asserts navigation to the quiz URL; it does not assert that the lesson URL (`/courses/:courseId/:lessonId`) was NOT triggered alongside it. This is correct in practice because `stopPropagation` on a button inside a link prevents the link activation, but there is no explicit assertion.

5. **Module accordion closed state.** All four tests call `setupCourseDetail` which expands the accordion via `page.getByRole('button', { name: /Test Module/i }).click()`. There is no test verifying badge absence while the accordion is collapsed (i.e., the badge is not visible when the lesson row is hidden). This is a behavioral correctness check rather than a functional regression risk.

6. **No unit tests for `QuizBadge` component or `useQuizScoresForCourse` hook.** All coverage is E2E-only. The `bestScore=0` boundary, the three-state semantic of the score map, and the `useMemo` lessonIdKey stability are all implemented in `src/hooks/useQuizScoresForCourse.ts` but untested at the unit level. Unit tests would run in milliseconds and provide faster feedback on regressions in the hook logic (particularly the `Math.max` best-score computation) without requiring a full Playwright browser context.

---

ACs: 4 covered / 4 total | Findings: 7 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 2
