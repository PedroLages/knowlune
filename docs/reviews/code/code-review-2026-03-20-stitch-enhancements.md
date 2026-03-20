## Code Review: E12-S06 -- Calculate and Display Quiz Score (Stitch Enhancements, Pass 3)

### What Works Well

1. **Tier-based scoring is well-structured.** `getScoreTier()` in `ScoreSummary.tsx` cleanly maps percentage ranges to labels, messages, and semantic color tokens with a single source of truth. Boundary tests at 90%, 89%, 50%, and 49% verify the logic exhaustively. The percentage clamping added in the fix pass is thorough.

2. **Accessibility is solid across all new components.** `useId()` for unique heading IDs on `AreasForGrowth`, `aria-live="polite"` for score announcements, `role="note"` on `QuestionHint`, ARIA labels on status icons in `QuestionBreakdown`, `motion-reduce:transition-none` on the score ring, and consistent `min-h-[44px]` touch targets throughout.

3. **Defensive coding in Quiz.tsx.** Zod validation of localStorage progress, the `ignore` flag for race-condition-safe unmounting, questionOrder integrity check before restoring state, and proper error handling in the Dexie fetch effect demonstrate careful engineering.

### Findings

#### Blockers

*None*

#### High Priority

- **[Recurring] `tests/e2e/story-12-6.spec.ts:65-101` (confidence: 90)**: Manual IndexedDB seeding duplicates the shared helper. The local `seedQuizData` function reimplements the exact retry-loop logic already available via `seedQuizzes()` from `tests/support/helpers/indexeddb-seed.ts` (line 251). This is a recurring anti-pattern -- every new spec that copies this logic diverges from the canonical implementation. Why: When the seeding helper is improved (e.g., retry strategy changes, error handling updates), this spec won't benefit. Fix: Replace with:
  ```typescript
  import { seedQuizzes } from '../support/helpers/indexeddb-seed'
  // then in navigateToQuiz:
  await seedQuizzes(page, [quiz])
  ```

- **`src/app/pages/Quiz.tsx:58-61` (confidence: 82)**: `countUnanswered` misses empty-array edge case for multiple-select questions. The check `a === undefined || a === ''` does not catch `[]` (an empty array). When a learner selects then deselects all options on a multiple-select question, `submitAnswer` stores `[]` for that question ID. An empty array passes neither `=== undefined` nor `=== ''`, so it counts as "answered." Why: The unanswered confirmation dialog (line 170) would not warn about this question, and the learner submits unknowingly with zero selections scored as incorrect. Fix:
  ```typescript
  return a === undefined || a === '' || (Array.isArray(a) && a.length === 0)
  ```

- **`src/app/pages/Quiz.tsx:159` (confidence: 78)**: Empty catch block in `handleSubmitConfirm` silently swallows errors. The comment says "Store already shows error toast" but if the store's toast mechanism fails or the error type changes, this becomes a fully silent failure with no diagnostic trail. Why: Learner clicks Submit, the operation fails, no error is logged anywhere at the component level. Fix: Add at minimum `console.error('[Quiz] Submit failed:', err)` in the catch block, matching the logging pattern already used in the Dexie fetch effect (line 116).

- **`src/app/pages/QuizResults.tsx:30-39` (confidence: 75)**: Missing cleanup for the `loadAttempts` effect. If the component unmounts before the Promise resolves (e.g., learner navigates away quickly), `setAttemptsLoaded(true)` fires on a stale component. This is inconsistent with the `ignore` flag pattern already used in `Quiz.tsx:99-124`. Why: While React 18+ tolerates this without warnings, it's a state update on an unmounted component that can cause subtle bugs if the component remounts. Fix: Add the same `ignore` flag pattern:
  ```typescript
  useEffect(() => {
    let ignore = false
    if (currentQuiz?.id) {
      loadAttempts(currentQuiz.id)
        .then(() => { if (!ignore) setAttemptsLoaded(true) })
        .catch((err: unknown) => {
          console.error('[QuizResults] Failed to load attempts:', err)
          if (!ignore) {
            toast.error('Could not load quiz results. Please try again.')
            setAttemptsLoaded(true)
          }
        })
    }
    return () => { ignore = true }
  }, [currentQuiz?.id, loadAttempts])
  ```

#### Medium

- **`src/app/pages/QuizResults.tsx:42` (confidence: 70)**: `lastAttempt` assumes array ordering. `attempts[attempts.length - 1]` assumes the store returns attempts in chronological order. If `loadAttempts` retrieves from an IndexedDB index scan or the store accumulates attempts from multiple calls, the "last" element may not be the most recent. Fix: Either sort explicitly by `completedAt` or document the ordering guarantee with a comment.

- **`src/app/components/quiz/ScoreSummary.tsx:75` (confidence: 70)**: The SVG track circle uses `text-muted/30` which applies the `--color-muted` background token (light: `#e9e7e4`, dark: `#32334a`) as a stroke color at 30% opacity. In dark mode, this renders as a barely-visible track. Why: The score ring track may be invisible to learners using dark mode. Fix: Consider `text-muted-foreground/20` or `text-border` for better visibility in both themes.

- **`src/app/components/quiz/QuestionBreakdown.tsx:38-43` (confidence: 68)**: Answers referencing questions removed after an attempt are silently dropped. The `.filter()` on line 41-43 excludes rows where `answerMap.get(question.id)` returns undefined, but the inverse -- answers for question IDs not in the current `questions` array -- are also silently lost. If a quiz is edited between attempts, the breakdown shows fewer rows than the learner actually answered. Fix: Add orphan detection or a "Question no longer available" placeholder row.

- **`src/app/pages/QuizResults.tsx:44-47` (confidence: 65)**: `useMemo` on `maxScore` depends on `lastAttempt`, which is a new reference every render (derived from `attempts` array on line 42). The memo recomputes every render cycle. Since the computation is a single `.reduce()` over a typically small array (3-20 answers), the `useMemo` adds cognitive overhead without meaningful optimization. Fix: Either remove the `useMemo` or stabilize `lastAttempt` with its own `useMemo`.

#### Nits

- **Nit** `src/app/components/quiz/ScoreSummary.tsx:97,121` (confidence: 65): `Math.round(clampedPct)` is computed in `ScoreRing` (line 97) and the clamping logic is duplicated inline in the `aria-live` region (line 121: `Math.min(100, Math.max(0, percentage))`). Extract a single `displayPercentage` variable in `ScoreSummary` and pass it to `ScoreRing` for consistency.

- **Nit** `src/app/components/quiz/AreasForGrowth.tsx:53` (confidence: 60): The "Show all" button uses `size="sm"` with `min-h-[44px]`. The `min-h` overrides the small size's height at runtime, making `size="sm"` misleading. Consider using the default size variant so the intent matches the rendered output.

- **Nit** `src/app/components/quiz/QuestionBreakdown.tsx:77` (confidence: 55): `cn('flex items-center gap-3 rounded-xl px-4 py-2 min-h-[44px]', 'bg-card')` -- the second argument is a static class that could be part of the first string. `cn()` is useful for conditional merging; using it to concatenate two static strings adds a function call for no benefit.

### Recommendations

Ordered by impact:

1. **First**: Replace manual IndexedDB seeding with `seedQuizzes()` helper (HIGH -- recurring anti-pattern, prevents divergence).
2. **Second**: Fix `countUnanswered` to handle empty arrays for multiple-select questions (HIGH -- correctness bug in confirmation dialog).
3. **Third**: Add error logging to the empty catch in `handleSubmitConfirm` (HIGH -- silent failure, 1-line fix).
4. **Fourth**: Add unmount cleanup to `loadAttempts` effect in `QuizResults.tsx` (HIGH -- consistency with `Quiz.tsx` pattern).
5. **Fifth**: Address medium findings as time permits -- they are polish, not blockers.

---
Issues found: 11 | Blockers: 0 | High: 4 | Medium: 4 | Nits: 3
Confidence: avg 73 | >= 90: 1 | 70-89: 6 | < 70: 4
