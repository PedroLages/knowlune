## Code Review: E13-S01 — Navigate Between Questions

### What Works Well

1. **Clean component extraction.** The inline nav footer in `Quiz.tsx` was decomposed into `QuizActions`, `QuestionGrid`, and `QuizNavigation` with clear prop interfaces and single responsibilities. This is textbook component decomposition.

2. **Solid accessibility foundation.** Every bubble button has `aria-label="Question N"`, `aria-current` on the active question, `aria-hidden` on decorative icons, and the parent `<nav>` has a semantic `aria-label`. Keyboard navigation works out of the box via native `<button>` elements.

3. **Defensive store action.** `navigateToQuestion` properly guards against null state, negative indices, and out-of-bounds indices. Unit tests cover all four guard paths.

### Findings

#### Blockers

None.

#### High Priority

- **[Recurring] `src/app/components/quiz/QuestionGrid.tsx:38` (confidence: 90)**: `w-8 h-8` should be `size-8`. This recurring Tailwind v4 anti-pattern has been flagged since E02-S05. The `size-*` shorthand is the canonical v4 equivalent for equal width/height. Why: Inconsistent utility usage across the codebase makes future search-and-replace and linting harder. Fix: Replace `w-8 h-8` with `size-8`.

- **`src/app/components/quiz/QuestionGrid.tsx:26` (confidence: 85)**: `isAnswered` check for multi-select answers is incomplete. The code checks `answers[questionId] !== ''` which handles string answers, but multi-select questions store answers as `string[]`. An empty array `[]` is truthy and `!== ''`, so a question with an empty array answer (e.g., if a learner programmatically reaches this state) would appear "answered" in the grid. Why: Incorrect visual feedback in the question grid could mislead learners about which multi-select questions they still need to answer. Fix:
  ```typescript
  const a = questionId ? answers[questionId] : undefined
  const isAnswered = a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0)
  ```

- **[Recurring] `tests/e2e/regression/story-e13-s01.spec.ts:67-97` (confidence: 85)**: Manual IndexedDB seeding duplicates the shared `seedIndexedDBStore` helper at `tests/support/helpers/indexeddb-seed.ts`. The local `seedQuizData` function is a near-identical copy with hardcoded `'ElearningDB'` and `'quizzes'`. Why: Duplicated seeding logic drifts out of sync — if the DB name or retry logic changes, this test breaks silently. Fix: Replace the local helper with:
  ```typescript
  import { seedIndexedDBStore } from '../../support/helpers/indexeddb-seed'
  // Then:
  await seedIndexedDBStore(page, 'ElearningDB', 'quizzes', [quiz])
  ```

#### Medium

- **`src/app/components/quiz/QuizNavigation.tsx:35` (confidence: 75)**: The `total` prop uses `progress.questionOrder.length || quiz.questions.length` with a logical-OR fallback. If `questionOrder` is an empty array (length 0), this silently falls back to `quiz.questions.length`, which is correct. But the `||` operator also triggers on `NaN` or other falsy values, masking potential upstream bugs. The `questionOrder` array should always be populated when a quiz is active. Fix: Use an explicit check: `progress.questionOrder.length > 0 ? progress.questionOrder.length : quiz.questions.length`. Alternatively, assert on the invariant with a console.warn if `questionOrder` is unexpectedly empty.

- **`src/app/pages/Quiz.tsx:164-168` (confidence: 70)**: `handleQuestionClick` is a trivial wrapper around `navigateToQuestion` — it adds no logic, no transformation, no error handling. The `useCallback` adds memory overhead for zero benefit. Fix: Pass `navigateToQuestion` directly as the `onQuestionClick` prop:
  ```tsx
  <QuizNavigation onQuestionClick={navigateToQuestion} ... />
  ```
  Remove the `handleQuestionClick` wrapper entirely.

- **`src/app/components/quiz/QuestionGrid.tsx:29` (confidence: 72)**: `markedForReview.includes(questionId)` is O(n) per bubble, giving O(n*m) total for n bubbles and m marked items. For typical quiz sizes (< 50 questions) this is negligible, but converting `markedForReview` to a `Set` in the parent or inside the component would be more idiomatic. Fix: At the top of the render function:
  ```typescript
  const markedSet = new Set(markedForReview)
  // Then: markedSet.has(questionId) instead of markedForReview.includes(questionId)
  ```

- **`src/stores/__tests__/useQuizStore.test.ts:736-829` (confidence: 75)**: The `navigateToQuestion` test block manually constructs `baseQuiz` and `baseProgress` objects instead of using the `makeQuiz`/`makeQuestion`/`makeProgress` factories from `tests/support/fixtures/factories/quiz-factory.ts` (which are already used in the component tests). Why: Inline test data drifts from schema changes — if `Quiz` or `QuizProgress` types gain required fields, these tests break while factory-based tests don't. Fix: Import and use factories consistently:
  ```typescript
  import { makeQuiz, makeQuestion, makeProgress } from '../../../tests/support/fixtures/factories/quiz-factory'
  ```

#### Nits

- **Nit** `src/app/components/quiz/QuestionGrid.tsx:39` (confidence: 65): The min-width/min-height classes `min-w-[44px] min-h-[44px]` conflict visually with `size-8` (32px). The button renders at 44x44px due to min constraints, making the `size-8` declaration misleading. Consider using `size-11` (44px) directly and removing the min-width/min-height overrides for clarity.

- **Nit** `src/app/components/quiz/QuizActions.tsx:42` (confidence: 60): The Submit Quiz button uses `bg-brand text-brand-foreground` as raw classes instead of leveraging a shadcn/ui Button variant (e.g., `variant="default"` with brand styling, or a custom `brand` variant via CVA). This creates a styling one-off that doesn't benefit from centralized variant management.

- **Nit** `src/app/components/quiz/QuizNavigation.tsx:25` (confidence: 60): The `className` string on line 25 is quite long (100+ characters). Consider extracting it to a variable or splitting across lines for readability.

### Recommendations

1. **First**: Replace the manual IndexedDB seeding in the E2E spec with the shared `seedIndexedDBStore` helper — this prevents future drift and is a quick one-liner change.
2. **Second**: Fix the `isAnswered` check in `QuestionGrid` to handle `string[]` answers correctly — this is a correctness issue that affects multi-select question types.
3. **Third**: Replace `w-8 h-8` with `size-8` in `QuestionGrid` — quick recurring pattern fix.
4. **Fourth**: Remove the unnecessary `handleQuestionClick` wrapper in `Quiz.tsx`.
5. **Fifth**: Migrate inline test data in `useQuizStore.test.ts` to use factories for consistency.

---
Issues found: 9 | Blockers: 0 | High: 3 | Medium: 4 | Nits: 3
Confidence: avg 75 | >= 90: 1 | 70-89: 5 | < 70: 3
